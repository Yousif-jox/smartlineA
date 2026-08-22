// Day 6 — Task 76: attendance analyzer extras (Tasks 13/69)
// Order-independence and idempotency are the flagships: the same event set
// must produce the same result no matter the arrival order.
const { test } = require('node:test');
const assert = require('node:assert');
const { resolveAttendance } = require('../../../src/algorithms/day1/attendance');

test('empty stream -> empty result', () => {
  assert.deepStrictEqual([...resolveAttendance([])], []);
  assert.deepStrictEqual([...resolveAttendance(null)], []);
  assert.deepStrictEqual([...resolveAttendance(undefined)], []);
});

test('events without employeeId are skipped (invalid)', () => {
  const r = resolveAttendance([
    { eventId: 'a', employeeId: null, timestamp: 10, status: 'Boarded' },
    { eventId: 'b', timestamp: 10, status: 'Absent' },
    { eventId: 'c', employeeId: 1, timestamp: 5, status: 'Boarded' },
  ]);
  assert.deepStrictEqual([...r], [[1, 'Boarded']]);
});

test('duplicate eventId: only one copy counts, latest timestamp wins', () => {
  const r = resolveAttendance([
    { eventId: 'e1', employeeId: 1, timestamp: 100, status: 'Boarded' },
    { eventId: 'e1', employeeId: 1, timestamp: 200, status: 'Absent' },
    { eventId: 'e1', employeeId: 1, timestamp: 150, status: 'Not Boarded' },
  ]);
  assert.deepStrictEqual([...r], [[1, 'Absent']]);
});

test('ORDER-INDEPENDENCE: shuffled arrival produces the identical result', () => {
  const events = [
    { eventId: 'e1', employeeId: 1, timestamp: 100, status: 'Boarded' },
    { eventId: 'e2', employeeId: 1, timestamp: 300, status: 'Absent' },
    { eventId: 'e3', employeeId: 2, timestamp: 100, status: 'Not Boarded' },
    { eventId: 'e4', employeeId: 2, timestamp: 200, status: 'Boarded' },
  ];
  // Map preserves insertion order (arrival order) — the invariant is the SET of
  // (employee, status) pairs, not their order. Compare sorted.
  const sorted = (m) => [...m].sort((a, b) => a[0] - b[0]);
  const forward = sorted(resolveAttendance(events));
  const shuffled = sorted(resolveAttendance([events[3], events[0], events[2], events[1]]));
  const reversed = sorted(resolveAttendance([...events].reverse()));
  assert.deepStrictEqual(shuffled, forward);
  assert.deepStrictEqual(reversed, forward);
  assert.deepStrictEqual(forward, [[1, 'Absent'], [2, 'Boarded']]);
});

test('identical timestamps: deterministic tie-break by HIGHER eventId', () => {
  const r = resolveAttendance([
    { eventId: 'evt-1', employeeId: 1, timestamp: 500, status: 'Boarded' },
    { eventId: 'evt-2', employeeId: 1, timestamp: 500, status: 'Absent' },
  ]);
  assert.deepStrictEqual([...r], [[1, 'Absent']], 'evt-2 > evt-1 -> Absent wins');
  // and the reverse arrival order gives the SAME winner
  const r2 = resolveAttendance([
    { eventId: 'evt-2', employeeId: 1, timestamp: 500, status: 'Absent' },
    { eventId: 'evt-1', employeeId: 1, timestamp: 500, status: 'Boarded' },
  ]);
  assert.deepStrictEqual([...r2], [[1, 'Absent']]);
});

test('older event after newer one never overwrites (stale-event rule)', () => {
  const r = resolveAttendance([
    { eventId: 'e5', employeeId: 3, timestamp: 999, status: 'Boarded' },
    { eventId: 'e6', employeeId: 3, timestamp: 100, status: 'Absent' },
  ]);
  assert.deepStrictEqual([...r], [[3, 'Boarded']]);
});
