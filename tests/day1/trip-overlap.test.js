const { test } = require('node:test');
const assert = require('node:assert');
const { findOverlappingTrips } = require('../../src/algorithms/day1/trip-overlap');

// Times are minutes since midnight: 07:00=420, 08:00=480, 08:15=495, 09:00=540.

test('adjacent trips (touch at exactly 08:00) are NOT an overlap', () => {
  const trips = [
    { tripId: 'A', start: 420, end: 480 },
    { tripId: 'B', start: 480, end: 495 },
  ];
  assert.deepStrictEqual(findOverlappingTrips(trips), []);
});

test('partially overlapping trips are reported', () => {
  const trips = [
    { tripId: 'A', start: 420, end: 480 },
    { tripId: 'B', start: 450, end: 495 },
  ];
  assert.deepStrictEqual(findOverlappingTrips(trips), [{ tripA: 'A', tripB: 'B' }]);
});

test('nested trips are reported', () => {
  const trips = [
    { tripId: 'outer', start: 420, end: 540 },
    { tripId: 'inner', start: 450, end: 480 },
  ];
  assert.deepStrictEqual(findOverlappingTrips(trips), [{ tripA: 'outer', tripB: 'inner' }]);
});

test('identical trips are reported once', () => {
  const trips = [
    { tripId: 'A', start: 420, end: 480 },
    { tripId: 'B', start: 420, end: 480 },
  ];
  assert.deepStrictEqual(findOverlappingTrips(trips), [{ tripA: 'A', tripB: 'B' }]);
});

test('three overlapping trips produce all three pairs', () => {
  const trips = [
    { tripId: 'A', start: 420, end: 540 },
    { tripId: 'B', start: 430, end: 500 },
    { tripId: 'C', start: 440, end: 520 },
  ];
  const pairs = findOverlappingTrips(trips);
  assert.strictEqual(pairs.length, 3);
});

test('zero-duration trips are excluded (decision: instants cannot conflict)', () => {
  const trips = [
    { tripId: 'Z1', start: 450, end: 450 },
    { tripId: 'Z2', start: 450, end: 450 },
  ];
  assert.deepStrictEqual(findOverlappingTrips(trips), []);
});

test('zero-duration trip inside a normal trip is not flagged (documented decision)', () => {
  const trips = [
    { tripId: 'A', start: 420, end: 540 },
    { tripId: 'Z', start: 480, end: 480 },
  ];
  assert.deepStrictEqual(findOverlappingTrips(trips), []);
});

test('single trip and empty list produce no pairs', () => {
  assert.deepStrictEqual(findOverlappingTrips([{ tripId: 'A', start: 420, end: 480 }]), []);
  assert.deepStrictEqual(findOverlappingTrips([]), []);
});

test('unsorted input still works (sort-based, not order-dependent)', () => {
  const trips = [
    { tripId: 'late', start: 450, end: 500 },
    { tripId: 'early', start: 400, end: 470 },
  ];
  const pairs = findOverlappingTrips(trips);
  assert.strictEqual(pairs.length, 1);
  assert.strictEqual(pairs[0].tripA, 'early');
  assert.strictEqual(pairs[0].tripB, 'late');
});
