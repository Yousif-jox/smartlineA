// Day 6 — Task 89: wallet TOCTOU stress test (regression suite).
// The Day-5 implementation already serializes on the wallet row lock
// (FOR UPDATE) + UNIQUE(wallet_id, idempotency_key) + CHECK(balance >= 0).
// These tests PROVE the invariant under the harshest race: N concurrent
// requests with the SAME key must produce exactly one charge; parallel
// different-key charges must never drive the balance negative or lose a debit.
// If the lock were removed, these tests would fail (documented in
// docs/debugging/wallet-toctou.md).
//
// FIXTURE: this suite uses its OWN wallet (company 4, wallet id 4) — the
// Day-5 wallet.test.js suite owns wallet 1 and asserts its exact balance, and
// node:test runs files in PARALLEL, so sharing wallet 1 would be a race.
const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const service = require('../../src/services/wallet.service');

const TENANT = 4;
const WALLET = 4;

beforeEach(async () => {
  await pool.query(`DELETE FROM wallet_transaction WHERE wallet_id = $1`, [WALLET]);
  await pool.query(`INSERT INTO company (id, name, status) VALUES (4, 'Stress Co', 'active') ON CONFLICT (id) DO NOTHING`);
  await pool.query(`INSERT INTO wallet (id, company_id, balance) VALUES (4, 4, 1600) ON CONFLICT (id) DO UPDATE SET balance = 1600`);
});

after(async () => {
  await pool.query(`DELETE FROM wallet_transaction WHERE wallet_id = $1`, [WALLET]);
  await pool.query(`DELETE FROM wallet WHERE id = $1`, [WALLET]);
  await pool.query(`DELETE FROM company WHERE id = 4`);
  await pool.end();
});

test('8 CONCURRENT requests with the SAME key -> exactly one charge, one duplicate, exact balance', async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => service.charge(TENANT, WALLET, { amount: 100 }, 'stress-same-key')),
  );
  assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 8, 'no request may error');
  const duplicates = results.filter((r) => r.value.duplicate).length;
  assert.strictEqual(duplicates, 7, 'exactly one winner, seven duplicates');
  const { rows } = await pool.query(`SELECT balance FROM wallet WHERE id = $1`, [WALLET]);
  assert.strictEqual(Number(rows[0].balance), 1500, 'debited exactly once');
});

test('8 CONCURRENT requests with DIFFERENT keys -> 8 debits, balance exact, never negative', async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, (_, i) => service.charge(TENANT, WALLET, { amount: 100 }, `stress-k${i}`)),
  );
  const ok = results.filter((r) => r.status === 'fulfilled');
  assert.strictEqual(ok.length, 8, 'all different-key charges succeed');
  const { rows } = await pool.query(`SELECT balance FROM wallet WHERE id = $1`, [WALLET]);
  assert.strictEqual(Number(rows[0].balance), 800, '1600 - 8*100 = 800');
});

test('parallel charges racing toward zero balance: the balance can never go negative', async () => {
  // reset to a low balance, then fire 5 parallel 300-charges: at most 2 may win
  await pool.query(`UPDATE wallet SET balance = 700 WHERE id = $1`, [WALLET]);
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, (_, i) => service.charge(TENANT, WALLET, { amount: 300 }, `stress-race-${i}`)),
  );
  const winners = results.filter((r) => r.status === 'fulfilled').length;
  assert.ok(winners <= 2, `at most floor(700/300)=2 winners, got ${winners}`);
  assert.strictEqual(winners, 2, 'exactly 2 can win (serialized lock, exact check)');
  const { rows } = await pool.query(`SELECT balance FROM wallet WHERE id = $1`, [WALLET]);
  assert.strictEqual(Number(rows[0].balance), 100, '700 - 2*300 = 100');
  await pool.query(`UPDATE wallet SET balance = 1600 WHERE id = $1`, [WALLET]);
});

test('a retry AFTER success returns the ORIGINAL transaction id (200 semantics)', async () => {
  const first = await service.charge(TENANT, WALLET, { amount: 50 }, 'stress-retry');
  const retry = await service.charge(TENANT, WALLET, { amount: 50 }, 'stress-retry');
  assert.strictEqual(retry.duplicate, true);
  assert.strictEqual(retry.transaction.id, first.transaction.id);
});
