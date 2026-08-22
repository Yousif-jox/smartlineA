// Day 6 — Task 78: 10+ negative authentication cases (status + envelope shape)
// Exercises the middleware chain directly (authenticate + authorize) — no DB.
process.env.JWT_SECRET = 'day6-test-secret';
process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../../../src/middleware/auth');

function callAuthenticate(headers) {
  return new Promise((resolve) => {
    const req = { headers: headers || {} };
    authenticate(req, {}, (err) => resolve({ err, req }));
  });
}

function callAuthorize(action, auth) {
  return new Promise((resolve) => {
    const req = { auth };
    authorize(action)(req, {}, (err) => resolve({ err, req }));
  });
}

const valid = jwt.sign({ accountId: 1, companyId: 1, role: 'company_manager' }, process.env.JWT_SECRET, { expiresIn: '15m' });

test('no Authorization header -> 401 UNAUTHENTICATED', async () => {
  const { err } = await callAuthenticate({});
  assert.strictEqual(err.status, 401);
  assert.strictEqual(err.code, 'UNAUTHENTICATED');
});

test('wrong scheme (Basic instead of Bearer) -> 401', async () => {
  const { err } = await callAuthenticate({ authorization: `Basic ${valid}` });
  assert.strictEqual(err.status, 401);
});

test('empty token -> 401', async () => {
  const { err } = await callAuthenticate({ authorization: 'Bearer ' });
  assert.strictEqual(err.status, 401);
});

test('malformed token (garbage) -> 401', async () => {
  const { err } = await callAuthenticate({ authorization: 'Bearer not.a.jwt' });
  assert.strictEqual(err.status, 401);
});

test('expired token -> 401', async () => {
  const expired = jwt.sign({ accountId: 1 }, process.env.JWT_SECRET, { expiresIn: '-1s' });
  const { err } = await callAuthenticate({ authorization: `Bearer ${expired}` });
  assert.strictEqual(err.status, 401);
});

test('token signed with a different secret -> 401', async () => {
  const other = jwt.sign({ accountId: 1 }, 'some-other-secret', { expiresIn: '15m' });
  const { err } = await callAuthenticate({ authorization: `Bearer ${other}` });
  assert.strictEqual(err.status, 401);
});

test('tampered signature (flip one char) -> 401', async () => {
  const [h, p, s] = valid.split('.');
  const tampered = `${h}.${p}.${s.slice(0, -1)}x`;
  const { err } = await callAuthenticate({ authorization: `Bearer ${tampered}` });
  assert.strictEqual(err.status, 401);
});

test('tampered ROLE claim (employee -> admin) invalidates the signature -> 401', async () => {
  const payload = Buffer.from(JSON.stringify({ accountId: 1, companyId: 1, role: 'employee' })).toString('base64url');
  const [h, , s] = valid.split('.');
  const forged = `${h}.${payload}.${s}`; // old signature over a new payload
  const { err } = await callAuthenticate({ authorization: `Bearer ${forged}` });
  assert.strictEqual(err.status, 401);
});

test('authorize without prior authentication -> 401', async () => {
  const { err } = await callAuthorize('trip.read', undefined);
  assert.strictEqual(err.status, 401);
  assert.strictEqual(err.code, 'UNAUTHENTICATED');
});

test('authorize denies an action the role lacks -> 403 FORBIDDEN (envelope carries role)', async () => {
  const { err } = await callAuthorize('wallet.transact', { role: 'employee', accountId: 2, companyId: 1 });
  assert.strictEqual(err.status, 403);
  assert.strictEqual(err.code, 'FORBIDDEN');
  assert.match(err.message, /employee/);
});

test('unknown role in a VALID token -> 403 (never falls through open)', async () => {
  const { err } = await callAuthorize('trip.read', { role: 'superuser', accountId: 1 });
  assert.strictEqual(err.status, 403);
});

test('success path still binds req.auth and passes through', async () => {
  const { err, req } = await callAuthenticate({ authorization: `Bearer ${valid}` });
  assert.strictEqual(err, undefined);
  assert.strictEqual(req.auth.role, 'company_manager');
  assert.strictEqual(req.auth.companyId, 1);
});
