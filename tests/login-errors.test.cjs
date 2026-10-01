const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');
const { ApiError, customerSafeErrorMessage, normalizeApiError } = loadTypeScript('src/api/errors.ts');
const { t, setLocale } = loadTypeScript('src/i18n/store.ts');

test('email sign-in failures show distinct, translated and redacted recovery advice', () => {
  const cases = [
    ['INVALID_LOGIN', 401, 'Your email or password is incorrect.'],
    ['EMAIL_CONFIRMATION_REQUIRED', 403, 'Confirm your email using the link we sent, then sign in again.'],
    ['AUTH_RATE_LIMITED', 429, 'Too many requests. Please try again shortly.'],
    ['AUTH_SERVICE_UNAVAILABLE', 503, 'Email sign-in is temporarily unavailable. Please try again shortly.'],
    ['EMAIL_LOGIN_UNAVAILABLE', 503, 'Email sign-in is temporarily unavailable. Please try again shortly.'],
    ['ACCOUNT_UNAVAILABLE', 403, 'This account cannot sign in. Please contact support.'],
  ];
  for (const [code, status, expected] of cases) {
    const error = normalizeApiError({ isAxiosError: true, response: { status,
      data: { code, message: 'private upstream database/password detail' } } });
    assert.ok(error instanceof ApiError);
    const message = customerSafeErrorMessage(error);
    setLocale('en');
    assert.equal(t(message), expected);
    setLocale('ko');
    assert.equal(t(message), message);
    assert.doesNotMatch(message, /private upstream/);
  }
});
