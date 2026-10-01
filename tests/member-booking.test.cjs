const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');
const { memberBookingState } = loadTypeScript('src/auth/memberBooking.ts');
test('new member bookings require a session and a loaded profile', () => {
  assert.equal(memberBookingState(null, {name:'Cached person'}), 'sign_in');
  assert.equal(memberBookingState('session', null), 'profile_unavailable');
});
test('legacy guest markers cannot enter the new member booking path', () => {
  assert.equal(memberBookingState('session', {name:'Guest',isGuest:true}), 'guest_unavailable');
  assert.equal(memberBookingState('session', {name:'Guest',provider:'guest',isGuest:false}), 'guest_unavailable');
});
test('email and social members share one profile-completion requirement', () => {
  for (const provider of ['standard','kakao','apple','google']) {
    assert.equal(memberBookingState('session', {name:'  ',provider}), 'complete_profile');
    assert.equal(memberBookingState('session', {name:'Member',provider}), 'ready');
  }
});
