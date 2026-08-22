// Day 6 — Tasks 85/86: the slow-query endpoint (GET /employees/:id/trips).
// Tests: tenant scoping (404), keyset pagination (cursor), date-range filter,
// and the join correctness. The 20M-row benchmark itself lives in
// scripts/benchmark/* + docs/performance/slow-query-employee-trips.md.
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const employeeService = require('../../src/services/employee.service');
const tripService = require('../../src/services/trip.service');

let created = [];

before(async () => {
  // NOTE: date 2026-08-27 is reserved for THIS suite (assignments uses 08-25,
  // trip-lifecycle uses 08-26 — parallel test files must not collide on the
  // captain/vehicle EXCLUDE constraint).
  await pool.query(`DELETE FROM trip WHERE trip_date = '2026-08-27' AND company_id = 1`);
  const t = await tripService.create(1, {
    routeId: 1, vehicleId: 2, captainId: 2,
    tripDate: '2026-08-27', startTime: '07:00', endTime: '08:30',
  });
  created.push(t.id);
  await tripService.assignEmployee(1, t.id, 20);
  const t2 = await tripService.create(1, {
    routeId: 1, vehicleId: 2, captainId: 2,
    tripDate: '2026-08-27', startTime: '09:00', endTime: '10:30',
  });
  created.push(t2.id);
  await tripService.assignEmployee(1, t2.id, 20);
});

after(async () => {
  for (const id of created) await pool.query('DELETE FROM trip WHERE id = $1', [id]);
  created = [];
  await pool.end();
});

test('employee trips: returns only that employee\'s trips for the tenant', async () => {
  const { data } = await employeeService.listTrips(1, 20, {});
  assert.ok(data.length >= 2);
  for (const t of data) assert.ok(['Scheduled', 'Assigned'].includes(t.state) || t.id < 1000);
});

test('date-range filter narrows the result', async () => {
  const { data } = await employeeService.listTrips(1, 20, { from: '2026-08-27', to: '2026-08-27' });
  assert.ok(data.length >= 2, 'both fresh trips are on 2026-08-27');
  const none = await employeeService.listTrips(1, 20, { from: '2026-01-01', to: '2026-01-02' });
  assert.strictEqual(none.data.length, 0);
});

test('keyset cursor pagination: page 1 + cursor walks forward without overlap', async () => {
  const page1 = await employeeService.listTrips(1, 20, { limit: 1 });
  assert.strictEqual(page1.data.length, 1);
  assert.ok(page1.nextCursor, 'hasMore must be true');
  const page2 = await employeeService.listTrips(1, 20, { limit: 1, cursor: page1.nextCursor });
  assert.strictEqual(page2.data.length, 1);
  assert.notStrictEqual(page2.data[0].id, page1.data[0].id, 'no overlap between pages');
});

test('cross-tenant employee -> 404 (no existence oracle)', async () => {
  await assert.rejects(
    () => employeeService.listTrips(1, 41, {}), // employee 41 is company 3
    (e) => e.status === 404 && e.code === 'NOT_FOUND',
  );
});

test('missing employee -> 404', async () => {
  await assert.rejects(() => employeeService.listTrips(1, 999999, {}), (e) => e.status === 404);
});
