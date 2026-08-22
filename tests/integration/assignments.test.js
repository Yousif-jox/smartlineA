// Integration tests — trip assignment (Task 67 — the Day-5 gate task)
// REQUIRES DATABASE_URL + seeded data. Tests run against freshly created
// trips (cleaned up after) so seeds stay untouched.
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const tripService = require('../../src/services/trip.service');

before(async () => {
  // clean leftover test trips (cascades trip_employee) — re-runnable tests
  await pool.query(`DELETE FROM trip WHERE trip_date = '2026-08-25' AND company_id = 1`);
});

after(async () => { await pool.end(); });

async function freshTrip() {
  // vehicle 2 (capacity 12) / captain 2 — free on 2026-08-25
  return tripService.create(1, {
    routeId: 1, vehicleId: 2, captainId: 2,
    tripDate: '2026-08-25', startTime: '07:00', endTime: '08:30',
  });
}

async function cleanup(tripId) {
  await pool.query('DELETE FROM trip WHERE id = $1', [tripId]); // cascades trip_employee
}

test('assign up to capacity succeeds, one over capacity is rejected', async () => {
  const trip = await freshTrip();
  try {
    for (let e = 1; e <= 12; e++) await tripService.assignEmployee(1, trip.id, e);
    await assert.rejects(
      () => tripService.assignEmployee(1, trip.id, 13),
      (err) => err.status === 409 && err.code === 'CAPACITY_EXCEEDED',
    );
  } finally { await cleanup(trip.id); }
});

test('THE GATE TEST — two concurrent assignments racing the last seat: exactly one wins', async () => {
  const trip = await freshTrip(); // capacity 12
  try {
    for (let e = 1; e <= 11; e++) await tripService.assignEmployee(1, trip.id, e); // 11 of 12 seats
    const results = await Promise.allSettled([
      tripService.assignEmployee(1, trip.id, 12),
      tripService.assignEmployee(1, trip.id, 13), // both race for the last seat
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.strictEqual(ok.length, 1, 'exactly one assignment must win the race');
    assert.strictEqual(rejected.length, 1, 'the loser must be rejected');
    assert.strictEqual(rejected[0].reason.code, 'CAPACITY_EXCEEDED');
  } finally { await cleanup(trip.id); }
});

test('cross-company employee -> 404 (no existence leak, FR-005)', async () => {
  const trip = await freshTrip();
  try {
    await assert.rejects(
      () => tripService.assignEmployee(1, trip.id, 41), // employee 41 belongs to company 3
      (err) => err.status === 404 && err.code === 'NOT_FOUND',
    );
  } finally { await cleanup(trip.id); }
});

test('employee already on an overlapping trip the same day -> 409', async () => {
  const trip = await freshTrip(); // 07:00-08:30 on 2026-08-25
  const other = await tripService.create(1, {
    routeId: 1, vehicleId: 1, captainId: 1,
    tripDate: '2026-08-25', startTime: '07:15', endTime: '08:45', // overlaps trip
  });
  try {
    await tripService.assignEmployee(1, other.id, 20); // employee 20 on the overlapping trip
    await assert.rejects(
      () => tripService.assignEmployee(1, trip.id, 20),
      (err) => err.status === 409 && err.code === 'EMPLOYEE_OVERLAP',
    );
  } finally { await cleanup(trip.id); await cleanup(other.id); }
});

test('cannot assign when the trip is not assignable (e.g. Completed)', async () => {
  await assert.rejects(
    () => tripService.assignEmployee(1, 1, 5), // t1 is Completed (seed)
    (err) => err.status === 409 && err.code === 'TRIP_ILLEGAL_STATE',
  );
});

test('duplicate assignment -> 409 ALREADY_ASSIGNED', async () => {
  const trip = await freshTrip();
  try {
    await tripService.assignEmployee(1, trip.id, 1);
    await assert.rejects(
      () => tripService.assignEmployee(1, trip.id, 1),
      (err) => err.status === 409 && err.code === 'ALREADY_ASSIGNED',
    );
  } finally { await cleanup(trip.id); }
});

test('removal works before completion and is blocked after', async () => {
  const trip = await freshTrip();
  try {
    await tripService.assignEmployee(1, trip.id, 1);
    await tripService.removeAssignment(1, trip.id, 1);
    await assert.rejects(() => tripService.removeAssignment(1, 1, 1), (err) => err.status === 409); // t1 Completed
  } finally { await cleanup(trip.id); }
});
