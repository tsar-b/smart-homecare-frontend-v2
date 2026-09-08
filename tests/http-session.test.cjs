const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');
const { createHttpClient } = loadTypeScript('src/api/http.ts');
const config = { baseUrl: 'https://example.test', timeoutMs: 1000 };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const unauthorized = request => new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', request, null, {
  status: 401, data: {}, headers: {}, config: request,
});
const success = request => ({ status: 200, data: { ok: true }, headers: {}, config: request });

test('concurrent expired-token requests share one refresh and replay with the new token', async () => {
  let token = 'old'; let refreshes = 0; let clears = 0;
  const gate = deferred();
  const client = createHttpClient(config, {
    getAccessToken: () => token,
    refreshAccessToken: async () => { refreshes++; await gate.promise; token = 'new'; return token; },
    onUnauthorized: () => { clears++; },
  });
  client.defaults.adapter = async request => {
    if (request.headers.get('Authorization') === 'Bearer old') throw unauthorized(request);
    return success(request);
  };
  const requests = Promise.all([client.get('/a'), client.get('/b')]);
  await new Promise(resolve => setImmediate(resolve));
  gate.resolve();
  assert.equal((await requests).length, 2);
  assert.equal(refreshes, 1); assert.equal(clears, 0);
});

test('a refresh network failure preserves the session and returns the network error', async () => {
  let clears = 0;
  const client = createHttpClient(config, {
    getAccessToken: () => 'old',
    refreshAccessToken: async () => { throw new axios.AxiosError('Offline', 'ERR_NETWORK'); },
    onUnauthorized: () => { clears++; },
  });
  client.defaults.adapter = async request => { throw unauthorized(request); };
  await assert.rejects(client.get('/profile'), error => error.code === 'NETWORK_ERROR');
  assert.equal(clears, 0);
});

test('an invalid refresh token still clears the matching session', async () => {
  let clears = 0;
  const client = createHttpClient(config, {
    getAccessToken: () => 'old',
    refreshAccessToken: async () => { throw unauthorized({}); },
    onUnauthorized: () => { clears++; },
  });
  client.defaults.adapter = async request => { throw unauthorized(request); };
  await assert.rejects(client.get('/profile'), error => error.status === 401);
  assert.equal(clears, 1);
});

test('a late 401 cannot clear or refresh a newly signed-in account', async () => {
  let token = 'old'; let clears = 0; let refreshes = 0;
  const gate = deferred();
  const client = createHttpClient(config, {
    getAccessToken: () => token,
    refreshAccessToken: () => { refreshes++; return 'new'; },
    onUnauthorized: () => { clears++; },
  });
  client.defaults.adapter = async request => { await gate.promise; throw unauthorized(request); };
  const request = client.get('/profile');
  await new Promise(resolve => setImmediate(resolve));
  token = 'other-account'; gate.resolve();
  await assert.rejects(request, error => error.status === 401);
  assert.equal(clears, 0); assert.equal(refreshes, 0);
});

test('a request cancelled while refreshing is not replayed and does not log out', async () => {
  let token = 'old'; let attempts = 0; let clears = 0;
  const gate = deferred(); const controller = new AbortController();
  const client = createHttpClient(config, {
    getAccessToken: () => token,
    refreshAccessToken: async () => { await gate.promise; token = 'new'; return token; },
    onUnauthorized: () => { clears++; },
  });
  client.defaults.adapter = async request => { attempts++; throw unauthorized(request); };
  const request = client.get('/profile', { signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort(); gate.resolve();
  await assert.rejects(request, error => error.code === 'REQUEST_CANCELLED');
  assert.equal(attempts, 1); assert.equal(clears, 0);
});

test('a refresh response after logout cannot restore the old account', async () => {
  let token = 'old'; let refreshToken = 'old-refresh'; let restores = 0; let clears = 0;
  const gate = deferred(); const started = deferred();
  const mockedAxios = Object.assign({}, axios, {
    create: options => axios.create({ ...options, adapter: async request => {
      if (request.url === '/api/auth/refresh') {
        started.resolve(); await gate.promise;
        return { ...success(request), data: { session: { access_token: 'new', refresh_token: 'new-refresh' } } };
      }
      throw unauthorized(request);
    } }),
  });
  const { createV2Api } = loadTypeScript('src/api/v2Api.ts', { axios: mockedAxios });
  const api = createV2Api({ baseUrl: config.baseUrl, getAccessToken: () => token,
    getRefreshToken: () => refreshToken, onSessionRefreshed: () => { restores++; },
    onUnauthorized: () => { clears++; } });
  const request = api.profile.get();
  await started.promise;
  token = null; refreshToken = null; gate.resolve();
  await assert.rejects(request, error => error.status === 401);
  assert.equal(restores, 0); assert.equal(clears, 0);
});

test('a newly selected account never joins the previous account pending refresh', async () => {
  let token = 'account-a';
  let refreshes = 0;
  let clears = 0;
  const gate = deferred();
  const client = createHttpClient(config, {
    getAccessToken: () => token,
    refreshAccessToken: async () => {
      const startingToken = token;
      refreshes++;
      await gate.promise;
      if (token !== startingToken) return null;
      token = `${startingToken}-refreshed`;
      return token;
    },
    onUnauthorized: () => { clears++; },
  });
  client.defaults.adapter = async request => {
    if (request.headers.get('Authorization') === 'Bearer account-b-refreshed') return success(request);
    throw unauthorized(request);
  };
  const previousAccount = client.get('/account-a').catch(error => error);
  await new Promise(resolve => setImmediate(resolve));
  token = 'account-b';
  const currentAccount = client.get('/account-b');
  await new Promise(resolve => setImmediate(resolve));
  gate.resolve();
  assert.equal((await previousAccount).status, 401);
  assert.equal((await currentAccount).status, 200);
  assert.equal(refreshes, 2);
  assert.equal(clears, 0);
  assert.equal(token, 'account-b-refreshed');
});
