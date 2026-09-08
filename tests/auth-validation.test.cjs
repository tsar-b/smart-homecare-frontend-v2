const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');

const { isValidEmail, registrationPasswordError, validateRegistrationFields } =
  loadTypeScript('src/auth/validation.ts');
const { createSubmissionLock } = loadTypeScript('src/auth/submissionLock.ts');

const valid = {
  name: 'Test User', phone: '010-1234-5678', email: 'test@example.com',
  password: 'TestPass123', confirmPassword: 'TestPass123', agreed: true,
};

test('registration rejects two empty passwords even when all other fields are valid', () => {
  const errors = validateRegistrationFields({ ...valid, password: '', confirmPassword: '' });
  assert.equal(errors.password, '비밀번호를 입력해 주세요.');
  assert.equal(errors.confirm, '비밀번호를 다시 입력해 주세요.');
});

test('registration accepts valid credentials without modifying the password', () => {
  const input = { ...valid, password: ' Test1234 ', confirmPassword: ' Test1234 ' };
  assert.deepEqual(validateRegistrationFields(input), {});
  assert.equal(input.password, ' Test1234 ');
});

test('password validation enforces minimum length and letter/number requirements', () => {
  assert.match(registrationPasswordError('abc'), /8/);
  assert.match(registrationPasswordError('abcdefgh'), /영문과 숫자/);
  assert.match(registrationPasswordError('12345678'), /영문과 숫자/);
  assert.match(registrationPasswordError('        '), /영문과 숫자/);
  assert.equal(registrationPasswordError('Abcdef12'), null);
});

test('registration enforces the API password length boundary', () => {
  const accepted = `a1${'a'.repeat(198)}`;
  assert.equal(registrationPasswordError(accepted), null);
  assert.match(registrationPasswordError(`${accepted}a`), /200/);
});

test('registration marks mismatch separately from password strength', () => {
  const errors = validateRegistrationFields({ ...valid, confirmPassword: 'OtherPass123' });
  assert.equal(errors.password, undefined);
  assert.equal(errors.confirm, '비밀번호가 서로 다릅니다.');
});

test('registration rejects missing identity fields and consent', () => {
  const errors = validateRegistrationFields({ ...valid, name: ' ', phone: '', email: '', agreed: false });
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'name', 'phone', 'terms']);
});

test('registration name length matches the API upper bound', () => {
  assert.equal(validateRegistrationFields({ ...valid, name: '가'.repeat(120) }).name, undefined);
  assert.match(validateRegistrationFields({ ...valid, name: '가'.repeat(121) }).name, /120/);
});

test('email validation rejects multiple @ characters accepted by the old form expression', () => {
  assert.equal(isValidEmail('a@@example.com'), false);
  assert.equal(isValidEmail('a@b@example.com'), false);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('user name@example.com'), false);
  assert.equal(isValidEmail(' user+tag@example.co.kr '), true);
});

test('phone validation accepts formatted phone numbers and rejects truncated numbers', () => {
  assert.equal(validateRegistrationFields(valid).phone, undefined);
  assert.equal(validateRegistrationFields({ ...valid, phone: '01012345678' }).phone, undefined);
  assert.ok(validateRegistrationFields({ ...valid, phone: '010123' }).phone);
});

test('submission lock rejects a second keyboard/button event before React can render pending', async () => {
  const lock = createSubmissionLock();
  let releaseRequest;
  let requests = 0;
  const request = new Promise((resolve) => { releaseRequest = resolve; });
  const submit = async () => {
    if (!lock.tryAcquire()) return;
    try { requests += 1; await request; } finally { lock.release(); }
  };
  const first = submit();
  await submit();
  assert.equal(requests, 1);
  releaseRequest();
  await first;
  await submit();
  assert.equal(requests, 2);
});

test('submission lock permits a deliberate retry after request failure', async () => {
  const lock = createSubmissionLock();
  assert.equal(lock.tryAcquire(), true);
  try { await Promise.reject(new Error('offline')); } catch {} finally { lock.release(); }
  assert.equal(lock.tryAcquire(), true);
});
