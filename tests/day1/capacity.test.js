const { test } = require('node:test');
const assert = require('node:assert');
const { findCapacityViolations } = require('../../src/algorithms/day1/capacity');

test('returns no violations when every trip fits', () => {
  const trips = [
    { tripId: 't1', employeeIds: ['e1', 'e2'] },
    { tripId: 't2', employeeIds: ['e3'] },
  ];
  assert.deepStrictEqual(findCapacityViolations(2, trips), []);
});

test('flags a trip that exceeds capacity with the overflow count', () => {
  const trips = [{ tripId: 't1', employeeIds: Array.from({ length: 15 }, (_, i) => `e${i}`) }];
  assert.deepStrictEqual(findCapacityViolations(14, trips), [{ tripId: 't1', overflow: 1 }]);
});

test('exact fit (count === capacity) is not a violation', () => {
  const trips = [{ tripId: 't1', employeeIds: Array.from({ length: 14 }, (_, i) => `e${i}`) }];
  assert.deepStrictEqual(findCapacityViolations(14, trips), []);
});

test('duplicate employee IDs inside one trip are counted once', () => {
  const trips = [{ tripId: 't1', employeeIds: ['e1', 'e1', 'e1'] }];
  // unique count = 1 <= capacity 2 -> no violation despite 3 entries
  assert.deepStrictEqual(findCapacityViolations(2, trips), []);
  // but if the same 3 IDs were 3 people at capacity 2 -> overflow 1
  assert.deepStrictEqual(
    findCapacityViolations(2, [{ tripId: 't1', employeeIds: ['e1', 'e2', 'e3'] }]),
    [{ tripId: 't1', overflow: 1 }]
  );
});

test('capacity of 0 flags any trip with employees', () => {
  const trips = [{ tripId: 't1', employeeIds: ['e1', 'e2'] }];
  assert.deepStrictEqual(findCapacityViolations(0, trips), [{ tripId: 't1', overflow: 2 }]);
});

test('empty employee list never violates', () => {
  const trips = [{ tripId: 't1', employeeIds: [] }];
  assert.deepStrictEqual(findCapacityViolations(0, trips), []);
});

test('empty trip list returns empty result', () => {
  assert.deepStrictEqual(findCapacityViolations(10, []), []);
});

test('multiple violating trips are all reported', () => {
  const trips = [
    { tripId: 't1', employeeIds: ['a', 'b', 'c'] }, // overflow 1 at cap 2
    { tripId: 't2', employeeIds: ['x', 'y'] },      // fits
    { tripId: 't3', employeeIds: ['p', 'q', 'r', 's'] }, // overflow 2 at cap 2
  ];
  assert.deepStrictEqual(findCapacityViolations(2, trips), [
    { tripId: 't1', overflow: 1 },
    { tripId: 't3', overflow: 2 },
  ]);
});
