// Day 6 — Task 79: tenant-isolation security suite (the gate suite).
// REQUIRES DATABASE_URL + seeds. Four tenant-scoped resources, two companies:
// every cross-tenant request must be a 404 (no existence oracle, NFR-009),
// plus the call-center positive case (documented Task-52 exception).
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const employeeService = require('../../src/services/employee.service');
const tripService = require('../../src/services/trip.service');
const walletService = require('../../src/services/wallet.service');
const complaintService = require('../../src/services/complaint.service');

before(async () => {
  // NOTE: this suite never creates wallet transactions (every charge 404s), so
  // it must NOT touch wallet 1's balance — wallet.test.js owns that fixture and
  // files run in parallel. Only complaint 1's state is restored (owned here).
  await pool.query(`UPDATE complaint SET state = 'assigned', assigned_agent_id = 4, resolution = NULL WHERE id = 1`);
});

after(async () => {
  await pool.query(`UPDATE complaint SET state = 'assigned', assigned_agent_id = 4, resolution = NULL WHERE id = 1`);
  await pool.end();
});

const expect404 = (p, label) => assert.rejects(p, (e) => {
  assert.strictEqual(e.status, 404, `${label} must be 404, got ${e.status} ${e.code}`);
  return true;
}, label);

test('employees: company-1 token reading company-3 employee -> 404', async () => {
  await expect404(employeeService.getById(1, 41), 'employee 41 (company 3) via tenant 1');
  await expect404(employeeService.getById(1, 999999), 'missing employee via tenant 1');
});

test('trips: company-1 token touching company-2/3 trip -> 404', async () => {
  await expect404(tripService.updateStatus(1, 6, 'Cancelled'), 'trip 6 (company 2) via tenant 1');
  await expect404(tripService.updateStatus(1, 4, 'Cancelled'), 'trip 4 (company 3) via tenant 1');
  await expect404(tripService.removeAssignment(1, 6, 26), 'assignment on company-2 trip via tenant 1');
});

test('trips: CREATE with cross-tenant references -> 404 (Day-6 fix)', async () => {
  // route 2 / vehicle 3 / captain 3 all belong to company 2.
  await expect404(
    tripService.create(1, { routeId: 2, vehicleId: 3, captainId: 3, tripDate: '2026-08-25', startTime: '10:00', endTime: '11:00' }),
    'trip create with company-2 references via tenant 1',
  );
  // and a missing reference is indistinguishable -> same 404
  await expect404(
    tripService.create(1, { routeId: 1, vehicleId: 1, captainId: 999, tripDate: '2026-08-25', startTime: '10:00', endTime: '11:00' }),
    'trip create with missing captain',
  );
});

test('wallets: company-1 token charging company-2 wallet -> 404', async () => {
  await expect404(walletService.charge(1, 2, { amount: 10 }, 'iso-k1'), 'wallet 2 (company 2) via tenant 1');
});

test('complaints: company-1 token on company-2 complaint -> 404; cross-tenant employee submit -> 404', async () => {
  await expect404(
    complaintService.transition(1, 2, 'resolve', { resolution: 'x', role: 'company_manager' }),
    'complaint 2 (company 2) via tenant 1',
  );
  await expect404(complaintService.create(1, 41, { category: 'Late pickup' }), 'complaint for employee 41 (company 3)');
});

test('call-center positive case (documented exception): works WITHOUT a tenant', async () => {
  // complaint 1 belongs to company 1; the call center (tenant null) may handle it.
  const updated = await complaintService.transition(null, 1, 'escalate', { agentId: 4, role: 'call_center' });
  assert.strictEqual(updated.state, 'escalated');
  // restore seed state for re-runnability
  await pool.query(`UPDATE complaint SET state = 'assigned', resolution = NULL WHERE id = 1`);
});

test('call center cannot create complaints (no tenant, RBAC denies anyway)', async () => {
  await expect404(complaintService.create(null, 1, { category: 'x' }), 'call-center create with no tenant');
});
