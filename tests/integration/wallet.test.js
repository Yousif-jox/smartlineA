// Integration tests — wallet idempotency (Task 68)
// Seeds: wallet 1 (company 1) balance 1600. Test keys prefixed it-test-.
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const service = require('../../src/services/wallet.service');

before(async () => {
  await pool.query(`DELETE FROM wallet_transaction WHERE idempotency_key LIKE 'it-test-%'`);
  await pool.query(`UPDATE wallet SET balance = 1600 WHERE id = 1`);
});

after(async () => {
  await pool.query(`DELETE FROM wallet_transaction WHERE idempotency_key LIKE 'it-test-%'`);
  await pool.query(`UPDATE wallet SET balance = 1600 WHERE id = 1`);
  await pool.end();
});

test('charge succeeds once; retry with the same key returns the ORIGINAL transaction', async () => {
  const first = await service.charge(1, 1, { amount: 100, tripId: 9 }, 'it-test-K1');
  assert.strictEqual(first.duplicate, false);
  const retry = await service.charge(1, 1, { amount: 100, tripId: 9 }, 'it-test-K1');
  assert.strictEqual(retry.duplicate, true);
  assert.strictEqual(retry.transaction.id, first.transaction.id, 'must be the SAME transaction');
  const { rows } = await pool.query(`SELECT balance FROM wallet WHERE id = 1`);
  assert.strictEqual(Number(rows[0].balance), 1500, 'charged exactly once');
});

test('missing Idempotency-Key -> 422', async () => {
  await assert.rejects(
    () => service.charge(1, 1, { amount: 100 }, undefined),
    (err) => err.status === 422 && err.code === 'IDEMPOTENCY_KEY_REQUIRED',
  );
});

test('insufficient balance -> 409, balance never goes negative', async () => {
  await assert.rejects(
    () => service.charge(1, 1, { amount: 999999 }, 'it-test-K2'),
    (err) => err.status === 409 && err.code === 'INSUFFICIENT_BALANCE',
  );
  const { rows } = await pool.query(`SELECT balance FROM wallet WHERE id = 1`);
  assert.ok(Number(rows[0].balance) >= 0);
});

test('concurrent duplicates with the same key -> exactly one charge', async () => {
  const results = await Promise.allSettled([
    service.charge(1, 1, { amount: 200 }, 'it-test-K3'),
    service.charge(1, 1, { amount: 200 }, 'it-test-K3'),
  ]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  assert.strictEqual(ok.length, 2, 'both calls return successfully (one charge + one duplicate)');
  const duplicates = ok.filter((r) => r.value.duplicate).length;
  assert.strictEqual(duplicates, 1, 'exactly one of them must be flagged duplicate');
  const { rows } = await pool.query(`SELECT balance FROM wallet WHERE id = 1`);
  assert.strictEqual(Number(rows[0].balance), 1300, 'charged exactly once despite concurrency');
});

test('cross-tenant wallet -> 404', async () => {
  await assert.rejects(
    () => service.charge(3, 1, { amount: 1 }, 'it-test-K4'), // tenant 3 asks for tenant-1 wallet
    (err) => err.status === 404,
  );
});
