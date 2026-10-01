const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');
test('locale switches update subscribers without changing source content or prices', () => {
  const i18n = loadTypeScript('src/i18n/store.ts');
  const events = [];
  const unsubscribe = i18n.subscribeLocale(() => events.push(i18n.getLocale()));
  assert.equal(i18n.t('로그인'), '로그인');
  i18n.setLocale('en');
  assert.equal(i18n.t('로그인'), 'Sign in');
  assert.equal(i18n.t('고객이 직접 입력한 내용'), '고객이 직접 입력한 내용');
  assert.match(i18n.formatMoney(40000), /KRW\s*40,000/);
  assert.equal(i18n.formatMoney(-1), 'Quote after consultation');
  // USD is supported only for amounts already denominated in USD.
  assert.match(i18n.formatMoney(29.5, 'USD'), /USD\s*29\.50/);
  i18n.setLocale('ko');
  assert.equal(i18n.t('로그인'), '로그인');
  assert.deepEqual(events, ['en', 'ko']);
  unsubscribe();
});
test('complete translated messages interpolate parameters without altering unknown placeholders', () => {
  const i18n = loadTypeScript('src/i18n/store.ts');
  assert.equal(i18n.t('{name}: {count}', { name: 'Original', count: 2 }), 'Original: 2');
  assert.equal(i18n.t('{missing}', {}), '{missing}');
});
