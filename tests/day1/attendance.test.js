const { test } = require('node:test');
const assert = require('node:assert');
const { resolveAttendance } = require('../../src/algorithms/day1/attendance');

const ev = (employeeId, status, timestamp, eventId) => ({ employeeId, status, timestamp, eventId });

test('duplicate events with the same eventId are counted once', () => {
  const events = [
    ev('e1', 'boarded', 100, 'evt-1'),
    ev('e1', 'boarded', 100, 'evt-1'), // duplicate retry
  ];
  const result = resolveAttendance(events);
  assert.strictEqual(result.get('e1'), 'boarded');
});

test('latest timestamp wins even if it arrives second (out-of-order)', () => {
  const events = [
    ev('e1', 'absent', 200, 'evt-a'),     // arrives first, later timestamp
    ev('e1', 'boarded', 100, 'evt-b'),    // arrives second, earlier timestamp
  ];
  const result = resolveAttendance(events);
  assert.strictEqual(result.get('e1'), 'absent');
});

test('the assessment example: late-arriving event with a LATER timestamp wins', () => {
  // Doc example, read consistently with the stated rule ("latest event by
  // timestamp ... unless timestamps say otherwise"): a late-arriving event wins
  // only when its timestamp is actually later.
  const events = [
    ev('e1', 'absent', 100, 'evt-a'),   // arrives first, earlier timestamp
    ev('e1', 'boarded', 200, 'evt-b'),  // arrives second, later timestamp -> wins
  ];
  const result = resolveAttendance(events);
  assert.strictEqual(result.get('e1'), 'boarded');
});

test('a late-arriving event with an EARLIER timestamp loses (timestamps say otherwise)', () => {
  const events = [
    ev('e1', 'absent', 150, 'evt-a'),  // first, later timestamp
    ev('e1', 'boarded', 100, 'evt-b'), // second, earlier timestamp -> must lose
  ];
  const result = resolveAttendance(events);
  assert.strictEqual(result.get('e1'), 'absent');
});

test('identical timestamps with different statuses: deterministic tie-break by eventId', () => {
  const events = [
    ev('e1', 'absent', 100, 'evt-a'),
    ev('e1', 'boarded', 100, 'evt-b'), // same timestamp, higher eventId
  ];
  const result = resolveAttendance(events);
  assert.strictEqual(result.get('e1'), 'boarded');
});

test('events without employeeId are skipped', () => {
  const events = [
    { employeeId: null, status: 'boarded', timestamp: 100, eventId: 'evt-x' },
    ev('e1', 'absent', 100, 'evt-a'),
  ];
  const result = resolveAttendance(events);
  assert.strictEqual(result.size, 1);
  assert.strictEqual(result.get('e1'), 'absent');
});

test('multiple employees resolve independently', () => {
  const events = [
    ev('e1', 'absent', 100, 'evt-a'),
    ev('e2', 'boarded', 100, 'evt-b'),
    ev('e1', 'boarded', 200, 'evt-c'), // e1 updates to boarded
  ];
  const result = resolveAttendance(events);
  assert.strictEqual(result.get('e1'), 'boarded');
  assert.strictEqual(result.get('e2'), 'boarded');
});

test('result is order-independent (same event set, any arrival order)', () => {
  const events = [
    ev('e1', 'boarded', 300, 'evt-1'),
    ev('e1', 'absent', 100, 'evt-2'),
    ev('e2', 'absent', 50, 'evt-3'),
    ev('e1', 'boarded', 300, 'evt-1'), // duplicate
  ];
  const shuffled = [...events].reverse();
  const a = resolveAttendance(events);
  const b = resolveAttendance(shuffled);
  assert.deepStrictEqual([...a.entries()].sort(), [...b.entries()].sort());
  assert.strictEqual(a.get('e1'), 'boarded');
  assert.strictEqual(a.get('e2'), 'absent');
});

test('empty event stream returns empty map', () => {
  assert.strictEqual(resolveAttendance([]).size, 0);
});
