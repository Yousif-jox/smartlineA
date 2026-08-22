// Day 6 — unit tests for the clean DB-error mapping (Task 81/NFR-010)
// Raw PostgreSQL messages (constraint/table names) must never reach the client.
const { test } = require('node:test');
const assert = require('node:assert');
const { errorHandler, ApiError } = require('../../../src/middleware/error');

function callHandler(err) {
  let captured;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { captured = body; return this; },
  };
  errorHandler(err, { id: 'req-123' }, res, () => {});
  return { status: res.statusCode, body: captured };
}

test('23505 unique violation -> 409 DUPLICATE_RESOURCE, raw message NEVER leaked', () => {
  const { status, body } = callHandler({
    code: '23505',
    message: 'duplicate key value violates unique constraint "employee_phone_key"',
  });
  assert.strictEqual(status, 409);
  assert.strictEqual(body.error.code, 'DUPLICATE_RESOURCE');
  assert.ok(!body.error.message.includes('employee_phone_key'), 'constraint name must not leak');
});

test('23503 foreign key violation -> 409 REFERENCE_VIOLATION, no table names leaked', () => {
  const { status, body } = callHandler({
    code: '23503',
    message: 'insert or update on table "trip" violates foreign key constraint "trip_captain_id_fkey"',
  });
  assert.strictEqual(status, 409);
  assert.strictEqual(body.error.code, 'REFERENCE_VIOLATION');
  assert.ok(!body.error.message.includes('trip'), 'table name must not leak');
});

test('23514 check violation -> 409 CHECK_VIOLATION', () => {
  const { status, body } = callHandler({ code: '23514', message: 'check constraint "wallet_balance_check" violated' });
  assert.strictEqual(status, 409);
  assert.strictEqual(body.error.code, 'CHECK_VIOLATION');
});

test('23P01 exclusion violation -> 409 EXCLUSION_VIOLATION', () => {
  const { status, body } = callHandler({ code: '23P01', message: 'conflicting key value violates exclusion constraint' });
  assert.strictEqual(status, 409);
  assert.strictEqual(body.error.code, 'EXCLUSION_VIOLATION');
});

test('unknown internal error -> 500 INTERNAL_ERROR with a safe generic message', () => {
  const { status, body } = callHandler({ message: 'connection refused', stack: 'at x' });
  assert.strictEqual(status, 500);
  assert.strictEqual(body.error.code, 'INTERNAL_ERROR');
  assert.strictEqual(body.error.message, 'Internal server error');
  assert.ok(!JSON.stringify(body).includes('connection refused'), 'internal detail must not leak');
});

test('ApiError passes through unchanged with its own code and details', () => {
  const err = new ApiError(409, 'CAPTAIN_CONFLICT', 'Captain already has an overlapping trip', { currentState: 'Scheduled' });
  const { status, body } = callHandler(err);
  assert.strictEqual(status, 409);
  assert.strictEqual(body.error.code, 'CAPTAIN_CONFLICT');
  assert.strictEqual(body.error.details.currentState, 'Scheduled');
  assert.strictEqual(body.error.requestId, 'req-123');
});
