// Day 6 — Task 76: extra unit tests for the vehicle-capacity algorithm (Task 9)
const { test } = require('node:test');
const assert = require('node:assert');
const { findCapacityViolations } = require('../../../src/algorithms/day1/capacity');

test('empty trip list -> no violations', () => {
  assert.deepStrictEqual(findCapacityViolations(10, []), []);
  assert.deepStrictEqual(findCapacityViolations(10, undefined), []);
  assert.deepStrictEqual(findCapacityViolations(10, null), []);
});

test('trip with null/undefined employeeIds is treated as empty (no violation)', () => {
  assert.deepStrictEqual(findCapacityViolations(1, [{ tripId: 1, employeeIds: null }]), []);
  assert.deepStrictEqual(findCapacityViolations(1, [{ tripId: 2 }]), []);
});

test('exactly-at-capacity is NOT a violation (boundary)', () => {
  assert.deepStrictEqual(findCapacityViolations(3, [{ tripId: 1, employeeIds: [1, 2, 3] }]), []);
});

test('zero-capacity vehicle: any assignment is a violation', () => {
  const r = findCapacityViolations(0, [{ tripId: 1, employeeIds: [7] }]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].overflow, 1);
});

test('duplicate ids inside one trip are counted ONCE (documented decision)', () => {
  const r = findCapacityViolations(2, [{ tripId: 1, employeeIds: [1, 1, 1, 2, 2] }]);
  assert.deepStrictEqual(r, [], '3 copies of id 1 + 2 copies of id 2 = 2 unique people = capacity');
});

test('overflow reports the exact unique-count surplus', () => {
  const r = findCapacityViolations(4, [{ tripId: 9, employeeIds: [1, 2, 3, 4, 5, 6, 6, 6] }]);
  assert.strictEqual(r[0].overflow, 2, '6 unique - capacity 4 = 2');
});

test('multiple violating trips are all reported in order', () => {
  const r = findCapacityViolations(2, [
    { tripId: 1, employeeIds: [1, 2, 3] },
    { tripId: 2, employeeIds: [9] },
    { tripId: 3, employeeIds: [4, 5, 6, 7] },
  ]);
  assert.deepStrictEqual(r, [{ tripId: 1, overflow: 1 }, { tripId: 3, overflow: 2 }]);
});

test('a trip without a tripId still reports (defensive, no crash)', () => {
  const r = findCapacityViolations(1, [{ employeeIds: [1, 2] }]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].overflow, 1);
});

test('huge capacity never overflows', () => {
  assert.deepStrictEqual(findCapacityViolations(1_000_000, [{ tripId: 1, employeeIds: [1, 2, 3] }]), []);
});
