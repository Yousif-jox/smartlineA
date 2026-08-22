// Day 6 — unit tests for the deterministic login fix (Task 90 root cause)
// The bug: UNION lookup + rows[0] without ORDER BY is nondeterministic — with
// duplicate names/phones the login could authenticate a DIFFERENT account.
// The fix: selectAccount() picks the lowest id deterministically.
const { test } = require('node:test');
const assert = require('node:assert');
const { selectAccount } = require('../../../src/services/auth.service');

test('selectAccount returns null for an empty result set', () => {
  assert.strictEqual(selectAccount([]), null);
  assert.strictEqual(selectAccount(null), null);
  assert.strictEqual(selectAccount(undefined), null);
});

test('selectAccount returns the single row as-is', () => {
  const rows = [{ id: 7, role: 'employee', name: 'E' }];
  assert.strictEqual(selectAccount(rows), rows[0]);
});

test('selectAccount is DETERMINISTIC with duplicate names: lowest id always wins', () => {
  // Simulates two accounts sharing a name — row order is shuffled to prove the
  // choice does not depend on the order PostgreSQL happened to return.
  const rowsA = [{ id: 5, role: 'call_center', name: 'Call Center 1' }, { id: 9, role: 'admin', name: 'Call Center 1' }];
  const rowsB = [{ id: 9, role: 'admin', name: 'Call Center 1' }, { id: 5, role: 'call_center', name: 'Call Center 1' }];
  const pickedA = selectAccount(rowsA);
  const pickedB = selectAccount(rowsB);
  assert.strictEqual(pickedA.id, 5);
  assert.strictEqual(pickedB.id, 5);
  assert.strictEqual(pickedA.role, 'call_center');
});

test('selectAccount never mutates the input array (pure function)', () => {
  const rows = [{ id: 3 }, { id: 1 }, { id: 2 }];
  const snapshot = JSON.stringify(rows);
  selectAccount(rows);
  assert.strictEqual(JSON.stringify(rows), snapshot, 'input order must not change');
});

test('selectAccount handles BIGINT ids returned as strings', () => {
  const rows = [{ id: '2', role: 'employee' }, { id: '1', role: 'employee' }];
  assert.strictEqual(selectAccount(rows).id, '1');
});
