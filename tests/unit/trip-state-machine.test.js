// Unit tests — Trip state machine matrix (Task 25/66). Pure, no DB.
const { test } = require('node:test');
const assert = require('node:assert');
const { STATES, LEGAL, isLegal } = require('../../src/state-machines/trip');

test('all 9 legal transitions from the Day 2 table are legal', () => {
  assert.ok(isLegal('Scheduled', 'Assigned'));
  assert.ok(isLegal('Scheduled', 'Cancelled'));
  assert.ok(isLegal('Assigned', 'Started'));
  assert.ok(isLegal('Assigned', 'Cancelled'));
  assert.ok(isLegal('Started', 'In Progress'));
  assert.ok(isLegal('Started', 'Failed'));
  assert.ok(isLegal('In Progress', 'Completed'));
  assert.ok(isLegal('In Progress', 'Cancelled'));
  assert.ok(isLegal('In Progress', 'Failed'));
});

test('terminal states have NO outgoing transitions', () => {
  for (const from of ['Completed', 'Cancelled', 'Failed']) {
    for (const to of STATES) {
      assert.strictEqual(isLegal(from, to), false, `${from} -> ${to} must be illegal`);
    }
  }
});

test('the explicitly-illegal transitions are illegal', () => {
  assert.strictEqual(isLegal('Cancelled', 'Scheduled'), false); // reschedule = new trip
  assert.strictEqual(isLegal('Completed', 'Started'), false);
  assert.strictEqual(isLegal('Failed', 'Completed'), false);
  assert.strictEqual(isLegal('Scheduled', 'Started'), false);  // skips Assigned
  assert.strictEqual(isLegal('Scheduled', 'In Progress'), false);
  assert.strictEqual(isLegal('Assigned', 'In Progress'), false);
  assert.strictEqual(isLegal('Assigned', 'Completed'), false);
  assert.strictEqual(isLegal('Started', 'Completed'), false);  // skips In Progress
  assert.strictEqual(isLegal('Started', 'Cancelled'), false);
});

test('the matrix is complete and symmetric-consistent for every pair', () => {
  for (const from of STATES) {
    assert.ok(Array.isArray(LEGAL[from]), `LEGAL missing state ${from}`);
    for (const to of LEGAL[from]) {
      assert.ok(STATES.includes(to), `${to} is not a state`);
      assert.strictEqual(isLegal(from, to), true, `isLegal mismatch for ${from}->${to}`);
    }
  }
  // no duplicates in any transition list
  for (const from of STATES) {
    assert.strictEqual(new Set(LEGAL[from]).size, LEGAL[from].length, `duplicate in ${from}`);
  }
});

test('unknown state is rejected', () => {
  assert.strictEqual(isLegal('Scheduled', 'Unknown'), false);
  assert.strictEqual(isLegal('Unknown', 'Scheduled'), false);
});
