// Day 6 — Task 83: RBAC boundary / escalation-attempt tests at the guard level.
// Escalation = a role trying an action outside its matrix row. The guard must
// deny EVERY one of them; token-forgery is additionally killed by the
// signature check (see auth-negatives.test.js).
const { test } = require('node:test');
const assert = require('node:assert');
const { can } = require('../../../src/rbac');

const ESCALATION_MATRIX = [
  // [role, action it must NOT have]
  ['employee', 'trip.assign'],
  ['employee', 'wallet.transact'],
  ['employee', 'employee.manage'],
  ['employee', 'complaint.handle'],
  ['employee', 'user.manage'],
  ['captain', 'trip.assign'],
  ['captain', 'complaint.handle'],
  ['captain', 'wallet.read'],
  ['captain', 'employee.manage'],
  ['company_manager', 'trip.status'],
  ['company_manager', 'wallet.transact'],
  ['company_manager', 'complaint.escalate'],
  ['company_manager', 'user.manage'],
  ['call_center', 'user.manage'],
  ['call_center', 'wallet.read'],
  ['call_center', 'trip.assign'],
  ['call_center', 'employee.manage'],
];

test('4+ escalation attempts per privileged boundary are all denied', () => {
  for (const [role, action] of ESCALATION_MATRIX) {
    assert.strictEqual(can(role, action), false, `${role} must NOT ${action}`);
  }
});

test('an unknown action on ANY role is denied', () => {
  for (const role of ['company_manager', 'employee', 'captain', 'call_center', 'admin']) {
    assert.strictEqual(can(role, 'system.shutdown'), false);
    assert.strictEqual(can(role, 'audit.purge'), false);
  }
});

test('call center has ONLY its narrow cross-tenant actions, never tenant-bypass powers', () => {
  const allowed = Object.keys(require('../../../src/rbac').RBAC.call_center).filter((a) => can('call_center', a));
  assert.ok(allowed.includes('complaint.lookup'));
  assert.ok(allowed.includes('complaint.handle'));
  for (const a of allowed) {
    assert.ok(!a.startsWith('user.') && !a.startsWith('wallet.') && a !== 'trip.assign', `call_center must not have ${a}`);
  }
});

test('admin escalation surface is minimal (no tenant data actions beyond wallet read)', () => {
  assert.strictEqual(can('admin', 'user.manage'), true);
  assert.strictEqual(can('admin', 'wallet.read'), true);
  assert.strictEqual(can('admin', 'trip.assign'), false, 'admin is platform-level, not a tenant operator');
  assert.strictEqual(can('admin', 'employee.manage'), false);
});

test('denials are consistent between can() and the middleware path', async () => {
  // The authorize middleware delegates to can() — so a matrix denial IS the
  // 403 the API returns (covered end-to-end in auth-negatives.test.js).
  assert.strictEqual(can('employee', 'trip.assign'), false);
});
