// Unit tests — JWT auth middleware (Task 64) — no DB required
// The secret MUST be set BEFORE any module reads config.
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const cfg = require('../../src/config');
assert.strictEqual(cfg.jwtSecret, 'test-secret-not-for-production');
const { verifyToken } = require('../../src/middleware/auth');
const { can } = require('../../src/rbac');

const makeToken = (payload) => jwt.sign(payload, cfg.jwtSecret, { expiresIn: '15m' });

test('verifyToken accepts a valid signed token and returns claims', () => {
  const token = makeToken({ accountId: 1, companyId: 2, role: 'company_manager' });
  const claims = verifyToken(token);
  assert.strictEqual(claims.companyId, 2);
  assert.strictEqual(claims.role, 'company_manager');
});

test('verifyToken rejects a tampered token', () => {
  const token = makeToken({ accountId: 1, companyId: 2, role: 'company_manager' });
  const [h, p, s] = token.split('.');
  const tampered = `${h}.${p}.${s.slice(0, -1)}x`;
  assert.throws(() => verifyToken(tampered));
});

test('verifyToken rejects an expired token', () => {
  const expired = jwt.sign({ accountId: 1 }, cfg.jwtSecret, { expiresIn: '-10s' });
  assert.throws(() => verifyToken(expired));
});

test('verifyToken rejects a token signed with a different secret', () => {
  const token = jwt.sign({ accountId: 1 }, 'other-secret');
  assert.throws(() => verifyToken(token));
});

test('a company_manager token can perform manager actions via RBAC', () => {
  const claims = verifyToken(makeToken({ accountId: 1, companyId: 1, role: 'company_manager' }));
  assert.strictEqual(can(claims.role, 'trip.assign'), true);
});

test('an employee token cannot perform manager actions', () => {
  const claims = verifyToken(makeToken({ accountId: 2, companyId: 1, role: 'employee' }));
  assert.strictEqual(can(claims.role, 'trip.assign'), false);
});
