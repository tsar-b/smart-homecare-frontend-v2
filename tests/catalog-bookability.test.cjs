const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');
const images = ['byukgulyee-icon.png', 'chungang4way-icon.png', 'chungang1way-icon.png', 'shiwaegi-icon.png', 'standairconditioner-icon.png', '2in1-icon.png'];
const { adaptServiceForSubtype } = loadTypeScript('src/screens/BookingSubtypeSelect.tsx', {
  'react-native': { StyleSheet: { create: value => value }, Platform: { select: value => value.android ?? value.default } },
  '@expo/vector-icons': {},
  '@react-navigation/native': {},
  '../components': {},
  '../context/AuthContext': {},
  ...Object.fromEntries(images.map(name => [`../../asset/icons/${name}`, 1])),
});
const service = { id: 'service-fix', key: 'fix', label: '수리' };
const subtype = { id: 'wall', key: 'wall', label: '벽걸이형', serviceOptions: ['service-fix'] };
const tier = { id: 'quote-tier', serviceTypeId: service.id, subtype: subtype.id, key: 'standard', label: '상담', basePrice: -1, sortOrder: 0, memo: null };
const catalog = { pricingTiers: [], options: [], assets: [] };

test('a live service without a normalized pricing ID is not made into an unsubmitable synthetic tier', () => {
  assert.equal(adaptServiceForSubtype(catalog, service, subtype), null);
});
test('real consultation tiers remain bookable and preserve their canonical ID', () => {
  const result = adaptServiceForSubtype({ ...catalog, pricingTiers: [tier] }, service, subtype);
  assert.equal(result.tiers[0].id, 'quote-tier');
  assert.equal(result.tiers[0].price, -1);
});
test('ambiguous duplicate pricing IDs cannot fall back to a fake consultation quote', () => {
  const result = adaptServiceForSubtype({ ...catalog, pricingTiers: [tier, { ...tier, id: 'conflict', basePrice: 50000 }] }, service, subtype);
  assert.equal(result, null);
});
