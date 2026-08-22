// Integration tests — trip creation + legal transitions (Task 66)
// REQUIRES DATABASE_URL + seeded data (Day 3 seeds):
//   t1 Completed · t5 Started · t6 In Progress (captain 3) · t7 Failed · t3 Cancelled
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const service = require('../../src/services/trip.service');

before(async () => {
  // restore seed states in case a previous run crashed mid-way
  await pool.query(`UPDATE trip SET state = 'Completed'   WHERE id = 1`);
  await pool.query(`UPDATE trip SET state = 'Started'     WHERE id = 5`);
  await pool.query(`UPDATE trip SET state = 'In Progress' WHERE id = 6`);
  await pool.query(`UPDATE trip SET state = 'Cancelled'   WHERE id = 3`);
});

after(async () => { await pool.end(); });

test('create trip -> state Scheduled with stops snapshot from route', async () => {
  const trip = await service.create(1, {
    routeId: 1, vehicleId: 2, captainId: 2,
    tripDate: '2026-08-24', startTime: '07:00', endTime: '08:30',
  });
  assert.strictEqual(trip.state, 'Scheduled');
  assert.ok(Array.isArray(trip.stops_snapshot) && trip.stops_snapshot.length >= 1);
  await pool.query('DELETE FROM trip WHERE id = $1', [trip.id]);
});

test('creating a trip with a conflicting captain -> 409', async () => {
  // seed t6: captain 3, In Progress, 2026-08-19 07:00-08:30
  await assert.rejects(
    () => service.create(1, {
      routeId: 2, vehicleId: 4, captainId: 3,
      tripDate: '2026-08-19', startTime: '07:00', endTime: '08:30',
    }),
    (err) => err.status === 409,
  );
});

test('illegal transition (Completed -> Started) -> 409 with current/attempted', async () => {
  await assert.rejects(
    () => service.updateStatus(1, 1, 'Started'), // t1 is Completed
    (err) => err.status === 409
      && err.code === 'TRIP_ILLEGAL_STATE'
      && err.details.currentState === 'Completed'
      && err.details.attemptedState === 'Started',
  );
});

test('legal transition (Started -> In Progress) succeeds', async () => {
  const trip = await service.updateStatus(1, 5, 'In Progress'); // t5 is Started
  assert.strictEqual(trip.state, 'In Progress');
  // no restore here — the before() hook resets seed states every run
});

test('rescheduling is illegal (Cancelled -> Scheduled) -> 409', async () => {
  await assert.rejects(
    () => service.updateStatus(2, 3, 'Scheduled'), // t3 is Cancelled (company 2)
    (err) => err.status === 409 && err.code === 'TRIP_ILLEGAL_STATE',
  );
});

test('two concurrent status updates -> exactly one wins (optimistic concurrency)', async () => {
  // t6 is In Progress (company 2); two writers both try Completed
  const results = await Promise.allSettled([
    service.updateStatus(2, 6, 'Completed'),
    service.updateStatus(2, 6, 'Completed'),
  ]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  assert.strictEqual(ok.length, 1, 'exactly one writer must win');
  assert.strictEqual(rejected.length, 1, 'the other must be rejected');
  // BOTH are correct loser outcomes depending on timing:
  //  - TRIP_CONCURRENT_UPDATE: loser read the old state, then lost the optimistic write
  //  - TRIP_ILLEGAL_STATE:     loser read the new state after the winner committed
  assert.ok(
    ['TRIP_CONCURRENT_UPDATE', 'TRIP_ILLEGAL_STATE'].includes(rejected[0].reason.code),
    `unexpected loser code: ${rejected[0].reason.code}`,
  );
});
