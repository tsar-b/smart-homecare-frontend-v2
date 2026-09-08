const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');
const { LatestRequest } = loadTypeScript('src/utils/latestRequest.ts');
const { parseAdminPrice, selectedAddressPatch } = loadTypeScript('src/screens/admin/adminInput.ts');

test('a late history response cannot overwrite a newer refresh or clear its spinner', async () => {
  const requests = new LatestRequest();
  const older = requests.start();
  const newer = requests.start();
  const state = { rows: [], refreshing: true };
  const settle = (request, rows) => {
    if (!request.isCurrent()) return;
    state.rows = rows;
    state.refreshing = false;
  };
  settle(older, ['old booking']);
  assert.deepEqual(state, { rows: [], refreshing: true });
  settle(newer, ['current booking']);
  settle(older, ['old booking']);
  assert.deepEqual(state, { rows: ['current booking'], refreshing: false });
  assert.equal(older.signal.aborted, true);
});

test('leaving a screen invalidates the response even when a transport still resolves', () => {
  const requests = new LatestRequest();
  const request = requests.start();
  requests.cancel();
  assert.equal(request.signal.aborted, true);
  assert.equal(request.isCurrent(), false);
  const next = requests.start();
  assert.equal(next.isCurrent(), true);
  assert.equal(request.isCurrent(), false);
});

test('admin price accepts whole KRW or a blank unchanged quote', () => {
  assert.equal(parseAdminPrice('  '), undefined);
  assert.equal(parseAdminPrice('0'), 0);
  assert.equal(parseAdminPrice('120000'), 120000);
  assert.equal(parseAdminPrice(' 120,000 '), 120000);
});

test('admin price never truncates decimal, exponent, partial, or unsafe numbers', () => {
  for (const price of ['12.5', '100abc', '1e6', '-1', '1,00', '1 00', '1_000', '9007199254740992']) {
    assert.throws(() => parseAdminPrice(price), undefined, price);
  }
});

test('selecting a new address clears the previous apartment detail when blank', () => {
  const old = { address: 'Old building', addressDetail: 'Unit 401' };
  assert.deepEqual({ ...old, ...selectedAddressPatch(' New building ', undefined) }, {
    address: 'New building', addressDetail: '',
  });
  assert.deepEqual(selectedAddressPatch('New building', '  Unit 2  '), {
    address: 'New building', addressDetail: 'Unit 2',
  });
});
