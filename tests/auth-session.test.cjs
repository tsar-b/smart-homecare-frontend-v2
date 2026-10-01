const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');

const user = { id: 'user-a', name: 'Test User', isAdmin: false, isGuest: false };
const session = { accessToken: 'access-a', refreshToken: 'refresh-a', expiresAt: null, expiresIn: null, user };
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// Only React scheduling and native storage are stubbed. The provider and
// storage queue under test are the production TypeScript modules.
function providerHarness({ configured = true, stored = null, api = {}, onSave } = {}) {
  const secure = new Map(stored ? [['shc.session', JSON.stringify(stored)]] : []);
  const hooks = [];
  const effects = [];
  let cursor = 0;
  let apiOptions;
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[index].value, value => {
        hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { current: initial };
      return hooks[index];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!hooks[index] || deps.some((value, i) => value !== hooks[index].deps[i])) {
        hooks[index] = { value: factory(), deps };
      }
      return hooks[index].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!hooks[index] || deps.some((value, i) => value !== hooks[index].deps[i])) {
        hooks[index] = { deps };
        effects.push(effect);
      }
    },
  };
  const client = {
    auth: { login: async () => session, logout: async () => {}, ...api.auth },
    profile: { get: async () => user, ...api.profile },
  };
  class ApiConfigurationError extends Error {}
  const { AuthProvider } = loadTypeScript('src/context/AuthContext.tsx', {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { Platform: { OS: 'android' } },
    '@react-native-async-storage/async-storage': { getItem: async () => null, removeItem: async () => {} },
    'expo-secure-store': {
      getItemAsync: async key => secure.get(key) ?? null,
      setItemAsync: async (key, value) => { await onSave?.(key, value); secure.set(key, value); },
      deleteItemAsync: async key => { secure.delete(key); },
    },
    '../api': {
      ApiConfigurationError,
      adaptUserProfile: value => value,
      customerSafeErrorMessage: () => '안전한 오류 메시지',
      createV2Api: options => {
        apiOptions = options;
        if (!configured) throw new ApiConfigurationError('missing configuration');
        return client;
      },
    },
  });
  const render = () => {
    cursor = 0;
    const rendered = AuthProvider({ children: null });
    while (effects.length) effects.shift()();
    return rendered.props.value;
  };
  return { render, secure, get apiOptions() { return apiOptions; } };
}

test('missing API keeps cached admin credentials stored but does not activate them in preview', async () => {
  const stored = { ...session, user: { ...user, isAdmin: true } };
  const harness = providerHarness({ configured: false, stored });
  harness.render();
  await tick();
  const state = harness.render();
  assert.equal(state.isLoading, false);
  assert.equal(state.token, null);
  assert.equal(state.currentUser, null);
  assert.ok(state.configurationError);
  assert.deepEqual(JSON.parse(harness.secure.get('shc.session')), stored);
});

test('standard login normalizes only the email and persists a refreshable member session', async () => {
  let submitted;
  const harness = providerHarness({ api: { auth: { login: async input => { submitted = input; return session; } } } });
  harness.render();
  await tick();
  await harness.render().loginEmail('  Member@Example.com  ', ' password123 ');
  assert.deepEqual(submitted, { email: 'member@example.com', password: ' password123 ' });
  assert.equal(harness.render().token, session.accessToken);
  assert.equal(harness.render().currentUser.id, user.id);
  assert.equal(harness.apiOptions.getRefreshToken(), session.refreshToken);
  assert.deepEqual(JSON.parse(harness.secure.get('shc.session')), session);
});

test('a rejected standard login leaves no session and can be retried successfully', async () => {
  let attempts = 0;
  const failure = new Error('email confirmation required');
  const harness = providerHarness({ api: { auth: { login: async () => {
    if (++attempts === 1) throw failure;
    return session;
  } } } });
  harness.render();
  await tick();
  await assert.rejects(harness.render().loginEmail('member@example.com', 'password123'), error => error === failure);
  assert.equal(harness.render().token, null);
  assert.equal(harness.secure.has('shc.session'), false);
  await harness.render().loginEmail('member@example.com', 'password123');
  assert.equal(harness.render().token, session.accessToken);
});

test('a profile response arriving after logout cannot restore the old customer', async () => {
  const response = deferred();
  const harness = providerHarness({ api: { profile: { get: () => response.promise } } });
  harness.render();
  await tick();
  await harness.render().loginEmail('test@example.com', 'TestPass123');
  const pendingProfile = harness.render().refreshProfile();
  await harness.render().logout();
  response.resolve({ ...user, name: 'Late profile' });
  assert.equal(await pendingProfile, null);
  assert.equal(harness.render().token, null);
  assert.equal(harness.render().currentUser, null);
  assert.equal(harness.secure.has('shc.session'), false);
});

test('logout cleanup follows an in-flight native session write and prevents session resurrection', async () => {
  const write = deferred();
  const entered = deferred();
  const harness = providerHarness({ onSave: async () => { entered.resolve(); await write.promise; } });
  harness.render();
  await tick();
  const pendingLogin = harness.render().loginEmail('test@example.com', 'TestPass123');
  await entered.promise;
  const pendingLogout = harness.render().logout();
  await tick();
  write.resolve();
  await Promise.all([pendingLogin, pendingLogout]);
  assert.equal(harness.secure.has('shc.session'), false);
  assert.equal(harness.render().token, null);
  assert.equal(harness.render().currentUser, null);
});

test('a failed session save does not activate the account or poison later saves', async () => {
  let attempts = 0;
  const harness = providerHarness({ onSave: async () => { if (++attempts === 1) throw new Error('storage unavailable'); } });
  harness.render();
  await tick();
  await assert.rejects(harness.render().loginEmail('test@example.com', 'TestPass123'), /storage unavailable/);
  assert.equal(harness.render().token, null);
  await harness.render().loginEmail('test@example.com', 'TestPass123');
  assert.equal(harness.render().token, session.accessToken);
});

test('an older login response cannot overwrite a later account selection', async () => {
  const responseA = deferred();
  const sessionB = { ...session, accessToken: 'access-b', refreshToken: 'refresh-b', user: { ...user, id: 'user-b' } };
  let attempts = 0;
  const harness = providerHarness({ api: { auth: { login: async () => ++attempts === 1 ? responseA.promise : sessionB } } });
  harness.render();
  await tick();
  const loginA = harness.render().loginEmail('a@example.com', 'TestPass123');
  await harness.render().loginEmail('b@example.com', 'TestPass123');
  responseA.resolve(session);
  await loginA;
  assert.equal(harness.render().token, 'access-b');
  assert.equal(harness.render().currentUser.id, 'user-b');
  assert.equal(JSON.parse(harness.secure.get('shc.session')).accessToken, 'access-b');
});

test('replacing a legacy token drops the previous profile and administrator state', async () => {
  const adminSession = { ...session, user: { ...user, isAdmin: true } };
  const harness = providerHarness({ api: { auth: { login: async () => adminSession } } });
  harness.render();
  await tick();
  await harness.render().loginEmail('admin@example.com', 'TestPass123');
  assert.equal(harness.render().currentUser.isAdmin, true);
  await harness.render().setToken('new-unresolved-token');
  assert.equal(harness.render().currentUser, null);
  assert.equal(harness.render().isGuestMode, false);
  assert.equal(harness.render().token, 'new-unresolved-token');
});

test('profile save queued behind token refresh retains the refreshed credentials', async () => {
  const write = deferred();
  const entered = deferred();
  const refreshed = { ...session, accessToken: 'access-refreshed', refreshToken: 'refresh-refreshed' };
  const harness = providerHarness({ onSave: async (_key, value) => {
    if (JSON.parse(value).accessToken === refreshed.accessToken) {
      entered.resolve();
      await write.promise;
    }
  } });
  harness.render();
  await tick();
  await harness.render().loginEmail('test@example.com', 'TestPass123');
  const refresh = harness.apiOptions.onSessionRefreshed(refreshed);
  await entered.promise;
  const profile = harness.render().refreshProfile();
  await tick();
  write.resolve();
  await Promise.all([refresh, profile]);
  const persisted = JSON.parse(harness.secure.get('shc.session'));
  assert.equal(persisted.accessToken, refreshed.accessToken);
  assert.equal(persisted.refreshToken, refreshed.refreshToken);
  assert.equal(harness.apiOptions.getRefreshToken(), refreshed.refreshToken);
});
