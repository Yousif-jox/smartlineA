// Unit tests — RBAC matrix (Task 52/64) — pure logic, no DB
const { test } = require('node:test');
const assert = require('node:assert');
const { can, RBAC } = require('../../src/rbac');

test('manager can manage trips and employees of own company', () => {
  assert.strictEqual(can('company_manager', 'trip.create'), true);
  assert.strictEqual(can('company_manager', 'trip.assign'), true);
  assert.strictEqual(can('company_manager', 'employee.manage'), true);
  assert.strictEqual(can('company_manager', 'wallet.read'), true);
});

test('manager CANNOT record attendance or transact wallet', () => {
  assert.strictEqual(can('company_manager', 'attendance.record'), false);
  assert.strictEqual(can('company_manager', 'wallet.transact'), false);
});

test('captain can change trip status and record attendance only', () => {
  assert.strictEqual(can('captain', 'trip.status'), true);
  assert.strictEqual(can('captain', 'attendance.record'), true);
  assert.strictEqual(can('captain', 'trip.assign'), false);
  assert.strictEqual(can('captain', 'wallet.read'), false);
});

test('employee can submit complaints and read own data only', () => {
  assert.strictEqual(can('employee', 'complaint.submit'), true);
  assert.strictEqual(can('employee', 'trip.read'), true);
  assert.strictEqual(can('employee', 'employee.manage'), false);
  assert.strictEqual(can('employee', 'complaint.handle'), false);
});

test('call center has the narrow cross-tenant lookup action only', () => {
  assert.strictEqual(can('call_center', 'complaint.lookup'), true);
  assert.strictEqual(can('call_center', 'complaint.handle'), true);
  // must NOT have tenant-bypass powers
  assert.strictEqual(can('call_center', 'user.manage'), false);
  assert.strictEqual(can('call_center', 'wallet.read'), false);
});

test('admin is the only user manager', () => {
  assert.strictEqual(can('admin', 'user.manage'), true);
  assert.strictEqual(can('admin', 'audit.read'), true);
  assert.strictEqual(can('company_manager', 'user.manage'), false);
});

test('unknown role or action is denied', () => {
  assert.strictEqual(can('hacker', 'trip.read'), false);
  assert.strictEqual(can('admin', 'does.not.exist'), false);
});

test('every role has at least the actions declared in the matrix', () => {
  for (const role of Object.keys(RBAC)) {
    assert.ok(Object.keys(RBAC[role]).length >= 5, `${role} has too few actions`);
  }
});
