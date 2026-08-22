// Day 6 — Task 77: dedicated assignment integration suite (real DB).
// Complements the Day-5 assignments.test.js with edge cases it does NOT
// cover: cancelled-trip rejection, re-assignment after removal (FR-008
// semantics), concurrent DIFFERENT employees (no false rejection), and
// removal after Started.
// NOTE: date 2026-08-28 is reserved for THIS suite (08-24 trips, 08-25
// assignments, 08-26 lifecycle, 08-27 employee-trips — parallel files must
// not collide on the captain/vehicle EXCLUDE constraint).
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const tripService = require('../../src/services/trip.service');

before(async () => {
  await pool.query(`DELETE FROM trip WHERE trip_date = '2026-08-28' AND company_id = 1`);
});

after(async () => {
  await pool.query(`DELETE FROM trip WHERE trip_date = '2026-08-28' AND company_id = 1`);
  await pool.end();
});

async function freshTrip(start = '07:00', end = '08:30') {
  return tripService.create(1, {
    routeId: 1, vehicleId: 2, captainId: 2,
    tripDate: '2026-08-28', startTime: start, endTime: end,
  });
}

test('assign to a Cancelled trip -> 409 TRIP_ILLEGAL_STATE', async () => {
  const trip = await freshTrip();
  try {
    await tripService.updateStatus(1, trip.id, 'Cancelled');
    await assert.rejects(
      () => tripService.assignEmployee(1, trip.id, 5),
      (e) => e.status === 409 && e.code === 'TRIP_ILLEGAL_STATE',
    );
  } finally { await pool.query('DELETE FROM trip WHERE id = $1', [trip.id]); }
});

test('assign -> remove -> RE-ASSIGN the same employee succeeds (FR-008 semantics)', async () => {
  const trip = await freshTrip();
  try {
    await tripService.assignEmployee(1, trip.id, 5);
    await tripService.removeAssignment(1, trip.id, 5);
    const again = await tripService.assignEmployee(1, trip.id, 5);
    assert.ok(again.tripId, 're-assignment after removal must succeed');
  } finally { await pool.query('DELETE FROM trip WHERE id = $1', [trip.id]); }
});

test('two DIFFERENT employees racing concurrently -> BOTH succeed (no false rejection)', async () => {
  const trip = await freshTrip();
  try {
    const results = await Promise.allSettled([
      tripService.assignEmployee(1, trip.id, 5),
      tripService.assignEmployee(1, trip.id, 6),
    ]);
    assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 2, 'different seats never conflict');
  } finally { await pool.query('DELETE FROM trip WHERE id = $1', [trip.id]); }
});

test('removal is allowed while Started (blocked only at Completed)', async () => {
  const trip = await freshTrip();
  try {
    await tripService.assignEmployee(1, trip.id, 5);
    await tripService.updateStatus(1, trip.id, 'Assigned');
    await tripService.updateStatus(1, trip.id, 'Started');
    const removed = await tripService.removeAssignment(1, trip.id, 5);
    assert.strictEqual(removed.removed, true);
  } finally { await pool.query('DELETE FROM trip WHERE id = $1', [trip.id]); }
});

test('cross-tenant assignment stays 404 (regression for the Day-6 create fix)', async () => {
  const trip = await freshTrip();
  try {
    await assert.rejects(
      () => tripService.assignEmployee(1, trip.id, 41), // employee 41 = company 3
      (e) => e.status === 404 && e.code === 'NOT_FOUND',
    );
  } finally { await pool.query('DELETE FROM trip WHERE id = $1', [trip.id]); }
});
