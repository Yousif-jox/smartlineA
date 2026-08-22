// Day 5 PRACTICAL CHALLENGE — end-to-end trip lifecycle integration test
// Against a REAL database:
//   create -> assign to capacity -> over-assign rejected -> legal statuses
//   -> Completed -> attendance (with a duplicate event) -> wallet charged ONCE
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const tripService = require('../../src/services/trip.service');
const attendanceService = require('../../src/services/attendance.service');
const walletService = require('../../src/services/wallet.service');

let tripId;

before(async () => {
  await pool.query(`DELETE FROM trip WHERE trip_date = '2026-08-26' AND company_id = 1`);
  await pool.query(`DELETE FROM wallet_transaction WHERE idempotency_key LIKE 'it-lifecycle-%'`);
  await pool.query(`UPDATE wallet SET balance = 1600 WHERE id = 1`);
});

after(async () => {
  await pool.query(`DELETE FROM trip WHERE id = $1`, [tripId]);
  await pool.query(`DELETE FROM wallet_transaction WHERE idempotency_key LIKE 'it-lifecycle-%'`);
  await pool.query(`UPDATE wallet SET balance = 1600 WHERE id = 1`);
  await pool.end();
});

test('THE FULL WEEK ON ONE TRIP — create, fill, overflow, complete, attend, charge once', async () => {
  // 1. create
  const trip = await tripService.create(1, {
    routeId: 1, vehicleId: 2, captainId: 2,
    tripDate: '2026-08-26', startTime: '07:00', endTime: '08:30',
  });
  tripId = trip.id;
  assert.strictEqual(trip.state, 'Scheduled');

  // 2. assign to capacity (vehicle 2 = 12 seats)
  for (let e = 1; e <= 12; e++) {
    await tripService.assignEmployee(1, trip.id, e);
  }

  // 3. over-assign rejected
  await assert.rejects(
    () => tripService.assignEmployee(1, trip.id, 13),
    (err) => err.status === 409 && err.code === 'CAPACITY_EXCEEDED',
  );

  // 4. legal status transitions all the way to Completed
  assert.strictEqual((await tripService.updateStatus(1, trip.id, 'Assigned')).state, 'Assigned');
  assert.strictEqual((await tripService.updateStatus(1, trip.id, 'Started')).state, 'Started');
  assert.strictEqual((await tripService.updateStatus(1, trip.id, 'In Progress')).state, 'In Progress');
  assert.strictEqual((await tripService.updateStatus(1, trip.id, 'Completed')).state, 'Completed');

  // 5. attendance: duplicate event applied once (idempotent)
  const evt = { eventId: 'it-lifecycle-e1', state: 'Boarded', timestamp: '2026-08-26T07:20:00Z' };
  // NOTE: attendance recording requires Started/In Progress — record BEFORE completion.
  // (This runs logically before step 4 completes; reorder for clarity below.)
  void evt;

  // 6. wallet charged exactly once (idempotency key)
  const first = await walletService.charge(1, 1, { amount: 250, tripId: trip.id }, 'it-lifecycle-charge');
  assert.strictEqual(first.duplicate, false);
  const retry = await walletService.charge(1, 1, { amount: 250, tripId: trip.id }, 'it-lifecycle-charge');
  assert.strictEqual(retry.duplicate, true);
  assert.strictEqual(retry.transaction.id, first.transaction.id);
  const { rows } = await pool.query(`SELECT balance FROM wallet WHERE id = 1`);
  assert.strictEqual(Number(rows[0].balance), 1350, 'charged exactly once: 1600 - 250');

  // 5b. attendance duplicate handling (on a fresh Started trip to keep the timeline honest)
  const t2 = await tripService.create(1, {
    routeId: 1, vehicleId: 1, captainId: 1,
    tripDate: '2026-08-26', startTime: '09:00', endTime: '10:30',
  });
  await tripService.assignEmployee(1, t2.id, 1);
  await tripService.updateStatus(1, t2.id, 'Assigned');
  await tripService.updateStatus(1, t2.id, 'Started');
  const applied = await attendanceService.record(1, t2.id, 1, { eventId: 'it-lifecycle-e1', state: 'Boarded', timestamp: '2026-08-26T09:20:00Z' });
  assert.deepStrictEqual(applied, { applied: true, state: 'Boarded' });
  const dup = await attendanceService.record(1, t2.id, 1, { eventId: 'it-lifecycle-e1', state: 'Absent', timestamp: '2026-08-26T09:30:00Z' });
  assert.deepStrictEqual(dup, { applied: false, reason: 'duplicate_event' });
  const list = await attendanceService.list(1, t2.id);
  assert.strictEqual(list.find((a) => a.employee_id === 1).state, 'Boarded', 'duplicate must not corrupt state');
  await pool.query(`DELETE FROM trip WHERE id = $1`, [t2.id]);
});
