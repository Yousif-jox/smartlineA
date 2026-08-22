// Integration tests — attendance recording (Task 69)
// Uses seed trip 5 (Started, company 1, employees 1..15 assigned).
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const service = require('../../src/services/attendance.service');

before(async () => {
  await pool.query(`UPDATE trip SET state = 'Started' WHERE id = 5`);
  await pool.query(`DELETE FROM attendance_event WHERE event_id LIKE 'it-test-%'`);
  await pool.query(`DELETE FROM attendance WHERE trip_id = 5 AND employee_id = 1`);
});

after(async () => {
  await pool.query(`UPDATE trip SET state = 'Started' WHERE id = 5`);
  await pool.query(`DELETE FROM attendance_event WHERE event_id LIKE 'it-test-%'`);
  await pool.query(`DELETE FROM attendance WHERE trip_id = 5 AND employee_id = 1`);
  await pool.end();
});

test('record boarded -> applied', async () => {
  const r = await service.record(1, 5, 1, { eventId: 'it-test-e1', state: 'Boarded', timestamp: '2026-08-19T07:20:00Z' });
  assert.deepStrictEqual(r, { applied: true, state: 'Boarded' });
});

test('duplicate eventId -> no-op (idempotent)', async () => {
  const r = await service.record(1, 5, 1, { eventId: 'it-test-e1', state: 'Absent', timestamp: '2026-08-19T07:30:00Z' });
  assert.deepStrictEqual(r, { applied: false, reason: 'duplicate_event' });
  const list = await service.list(1, 5);
  assert.strictEqual(list.find((a) => a.employee_id === 1).state, 'Boarded', 'duplicate must not change state');
});

test('out-of-order event (older timestamp) -> ignored (stale_event)', async () => {
  const r = await service.record(1, 5, 1, { eventId: 'it-test-e2', state: 'Absent', timestamp: '2026-08-19T07:10:00Z' });
  assert.deepStrictEqual(r, { applied: false, reason: 'stale_event' });
  const list = await service.list(1, 5);
  assert.strictEqual(list.find((a) => a.employee_id === 1).state, 'Boarded');
});

test('newer event wins (latest timestamp)', async () => {
  const r = await service.record(1, 5, 1, { eventId: 'it-test-e3', state: 'Not Boarded', timestamp: '2026-08-19T07:40:00Z' });
  assert.deepStrictEqual(r, { applied: true, state: 'Not Boarded' });
});

test('walk-on (unassigned employee) -> 409 EMPLOYEE_NOT_ASSIGNED', async () => {
  // t5 has employees 1..15; employee 30 is not assigned
  await assert.rejects(
    () => service.record(1, 5, 30, { eventId: 'it-test-e4', state: 'Boarded', timestamp: '2026-08-19T07:20:00Z' }),
    (err) => err.status === 409 && err.code === 'EMPLOYEE_NOT_ASSIGNED',
  );
});

test('recording is frozen once the trip is Completed -> 409', async () => {
  await service.record(1, 5, 1, { eventId: 'it-test-e5', state: 'Boarded', timestamp: '2026-08-19T08:00:00Z' });
  await pool.query(`UPDATE trip SET state = 'Completed' WHERE id = 5`);
  await assert.rejects(
    () => service.record(1, 5, 2, { eventId: 'it-test-e6', state: 'Boarded', timestamp: '2026-08-19T08:05:00Z' }),
    (err) => err.status === 409 && err.code === 'TRIP_ILLEGAL_STATE',
  );
});
