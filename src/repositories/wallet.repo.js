// src/repositories/wallet.repo.js — data access (Task 68)
// Task 39 implemented: one transaction, wallet row locked FOR UPDATE,
// UNIQUE(wallet_id, idempotency_key) as the exactly-once gate,
// CHECK(balance >= 0) as the final guard.

const { pool } = require('../db');

async function findById(tenant, walletId) {
  const { rows } = await pool.query(
    `SELECT id, company_id, balance FROM wallet WHERE company_id = $1 AND id = $2`,
    [tenant, walletId],
  );
  return rows[0] || null;
}

async function findTransactionById(walletId, txId) {
  const { rows } = await pool.query(
    `SELECT id, wallet_id, idempotency_key, amount, type, trip_id, status, created_at
     FROM wallet_transaction WHERE wallet_id = $1 AND id = $2`,
    [walletId, txId],
  );
  return rows[0] || null;
}

async function chargeWithLock(walletId, key, amount, tripId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query(
      `SELECT id, balance FROM wallet WHERE id = $1 FOR UPDATE`,
      [walletId],
    );
    if (!w.rows[0]) { await client.query('ROLLBACK'); return { error: 'NOT_FOUND' }; }

    // exactly-once gate: a retried key returns the ORIGINAL transaction
    const dup = await client.query(
      `SELECT id FROM wallet_transaction WHERE wallet_id = $1 AND idempotency_key = $2`,
      [walletId, key],
    );
    if (dup.rows.length) { await client.query('ROLLBACK'); return { error: 'DUPLICATE', txId: dup.rows[0].id }; }

    if (w.rows[0].balance - amount < 0) {
      await client.query('ROLLBACK');
      return { error: 'INSUFFICIENT_BALANCE', balance: w.rows[0].balance };
    }

    const ins = await client.query(
      `INSERT INTO wallet_transaction (wallet_id, idempotency_key, amount, type, trip_id, status)
       VALUES ($1, $2, $3, 'charge', $4, 'completed')
       RETURNING id, wallet_id, idempotency_key, amount, type, trip_id, status, created_at`,
      [walletId, key, amount, tripId],
    );
    await client.query(
      `UPDATE wallet SET balance = balance - $1, updated_at = now() WHERE id = $2`,
      [amount, walletId],
    );
    await client.query('COMMIT');
    return { ok: true, transaction: ins.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { findById, findTransactionById, chargeWithLock };
