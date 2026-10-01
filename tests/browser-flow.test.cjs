const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');
const { parsePendingFlow, parseAuthCallback, recoveryPasswordError, AUTH_FLOW_MAX_AGE_MS } = loadTypeScript('src/auth/browserFlow.ts');
const now = 1_800_000_000_000;
const flow = { kind: 'oauth', provider: 'google', state: 'a'.repeat(64), verifier: 'b'.repeat(64),
  redirectUri: 'smarthomecareapplication://auth/callback', createdAt: now };
const valid = `${flow.redirectUri}?state=${flow.state}&code=once-only-code`;

test('PKCE callback accepts only the exact return URI, matching state and one code', () => {
  assert.deepEqual(parseAuthCallback(valid, flow, now), { code: 'once-only-code' });
  for (const url of [valid.replace('auth/callback', 'evil/callback'), valid.replace('smarthomecareapplication:', 'https:'),
    valid.replace('once-only-code', ''), valid + '&code=other', valid + '&state=other',
    valid + '#access_token=secret', valid + '&access_token=secret', valid.replace(flow.state, 'c'.repeat(64))]) {
    assert.throws(() => parseAuthCallback(url, flow, now));
  }
});
test('expired, future and malformed pending flows fail closed', () => {
  assert.equal(parsePendingFlow(JSON.stringify(flow), now)?.provider, 'google');
  for (const item of [{ ...flow, createdAt: now + 1 }, { ...flow, createdAt: now - AUTH_FLOW_MAX_AGE_MS - 1 },
    { ...flow, verifier: '' }, { ...flow, provider: 'other' }, { ...flow, redirectUri: flow.redirectUri + '?injected=true' }]) {
    assert.equal(parsePendingFlow(JSON.stringify(item), now), null);
  }
  assert.equal(parsePendingFlow('not json', now), null);
});
test('provider errors do not return an authorization code or expose error details', () => {
  const denied = `${flow.redirectUri}?state=${flow.state}&error=access_denied&error_description=private`;
  assert.throws(() => parseAuthCallback(denied, flow, now), { message: 'AUTH_PROVIDER_CANCELLED' });
  for (const suffix of ['&code=once-only-code', '&access_token=secret', '&refresh_token=secret', '&error=other']) {
    assert.throws(() => parseAuthCallback(denied + suffix, flow, now), { message: 'AUTH_CALLBACK_INVALID' });
  }
});

test('Supabase error-only fragments report provider denial after validating query state', () => {
  const base = `${flow.redirectUri}?state=${flow.state}`;
  for (const fragment of ['error=access_denied', 'error_code=provider_error',
    'error=access_denied&error_code=provider_error&error_description=Private+provider+detail']) {
    assert.throws(() => parseAuthCallback(`${base}#${fragment}`, flow, now), { message: 'AUTH_PROVIDER_CANCELLED' });
  }
  const denied = `${base}#error=access_denied&error_description=private`;
  for (const url of [denied.replace(flow.state, 'c'.repeat(64)),
    denied.replace(`state=${flow.state}`, ''),
    denied.replace(`state=${flow.state}`, `state=${flow.state}&state=${flow.state}`),
    denied.replace('auth/callback', 'evil/callback'), denied.replace('smarthomecareapplication:', 'https:')]) {
    assert.throws(() => parseAuthCallback(url, flow, now), { message: 'AUTH_CALLBACK_INVALID' });
  }
});

test('denial fragments cannot inject tokens, a code, an alternative state or mixed query results', () => {
  const base = `${flow.redirectUri}?state=${flow.state}`;
  for (const field of ['access_token', 'refresh_token', 'id_token', 'provider_token', 'code', 'state', 'unknown']) {
    assert.throws(() => parseAuthCallback(`${base}#error=access_denied&${field}=injected`, flow, now),
      { message: 'AUTH_CALLBACK_INVALID' });
  }
  for (const query of ['&code=once-only-code', '&access_token=secret', '&error=conflicting_error', '&unknown=extra']) {
    assert.throws(() => parseAuthCallback(`${base}${query}#error=access_denied`, flow, now),
      { message: 'AUTH_CALLBACK_INVALID' });
  }
});

test('the live Supabase denial shape permits matching query/fragment errors and one empty sb marker', () => {
  const errors='error=access_denied&error_description=Private+provider+detail';
  const base=`${flow.redirectUri}?${errors}&state=${flow.state}`;
  for (const fragment of [errors, `${errors}&sb=`]) {
    assert.throws(() => parseAuthCallback(`${base}#${fragment}`, flow, now), { message:'AUTH_PROVIDER_CANCELLED' });
  }
  for (const fragment of [`${errors}&sb=nonempty`, `${errors}&sb=&sb=`,
    'error=other&error_description=Private+provider+detail&sb=',
    'error=access_denied&error_description=Conflicting+detail&sb=',
    `${errors}&state=${flow.state}&sb=`, `${errors}&code=injected&sb=`,
    `${errors}&access_token=secret&sb=`, `${errors}&error=access_denied&sb=`]) {
    assert.throws(() => parseAuthCallback(`${base}#${fragment}`, flow, now), { message:'AUTH_CALLBACK_INVALID' });
  }
  assert.throws(() => parseAuthCallback(`${base}&code=injected#${errors}&sb=`, flow, now), { message:'AUTH_CALLBACK_INVALID' });
  assert.throws(() => parseAuthCallback(`${base}&state=${flow.state}#${errors}&sb=`, flow, now), { message:'AUTH_CALLBACK_INVALID' });
  assert.throws(() => parseAuthCallback(`${valid}#sb=`, flow, now), { message:'AUTH_CALLBACK_INVALID' });
});

test('malformed and duplicate denial fields fail closed', () => {
  const base = `${flow.redirectUri}?state=${flow.state}`;
  for (const fragment of ['error_description=private', 'error=', 'error',
    'error=access_denied&error=other', 'error=access_denied&error_code=a&error_code=b',
    'error=access_denied&error_description=a&error_description=b', 'error=access_denied&%65rror=other']) {
    assert.throws(() => parseAuthCallback(`${base}#${fragment}`, flow, now), { message: 'AUTH_CALLBACK_INVALID' });
  }
  for (const query of ['error_description=private', 'error=', 'error=access_denied&error_description=a&error_description=b']) {
    assert.throws(() => parseAuthCallback(`${base}&${query}`, flow, now), { message: 'AUTH_CALLBACK_INVALID' });
  }
});
test('password reset requires matching passwords, a letter and a number, and preserves whitespace', () => {
  assert.equal(recoveryPasswordError('Example123 ', 'Example123 '), null);
  assert.equal(recoveryPasswordError('Example123 ', 'Example123'), 'mismatch');
  for (const value of ['short1', 'abcdefgh', '12345678', 'a1'.repeat(101)]) assert.equal(recoveryPasswordError(value, value), 'weak');
});
