const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');
const { localDateKey, startOfBookingToday, isPastBookingSlot, formatBookingPrice } = loadTypeScript('src/utils/bookingTime.ts');

test('booking today follows Korea when UTC and the device are still on the previous day', () => {
  assert.equal(localDateKey(startOfBookingToday(new Date('2026-09-07T16:00:00Z'))), '2026-09-08');
});
test('past-slot calculation uses the booking timezone, including previous days', () => {
  const now = new Date('2026-09-08T00:30:00Z');
  const day = new Date(2026, 8, 8);
  assert.equal(isPastBookingSlot(day, '09:30', now), true);
  assert.equal(isPastBookingSlot(day, '09:31', now), false);
  assert.equal(isPastBookingSlot(new Date(2026, 8, 7), '23:59', now), true);
  assert.equal(isPastBookingSlot(new Date(2026, 8, 9), '00:00', now), false);
});
test('invalid slot times and dates fail closed', () => {
  for (const time of ['24:00', '12:61', '9:00', 'bad', '']) {
    assert.equal(isPastBookingSlot(new Date(2026, 8, 9), time), true);
  }
  assert.equal(isPastBookingSlot(new Date('invalid'), '09:00'), true);
});
test('consultation quote is not presented as negative won', () => {
  assert.equal(formatBookingPrice(-1), '상담 후 안내');
  assert.equal(formatBookingPrice(45000), '45,000원');
  assert.equal(formatBookingPrice(0), '0원');
});
