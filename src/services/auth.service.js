// src/services/auth.service.js — login / refresh (rotating) / logout (Task 52/64)
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const config = require('../config');
const { ApiError } = require('../middleware/error');

function signAccess(account) {
  return jwt.sign(
    { sub: String(account.id), accountId: account.id, companyId: account.company_id, role: account.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

function hashRefresh() {
  return crypto.randomBytes(48).toString('base64url');
}

// Refresh tokens are stored HASHED (never plaintext in the DB)
async function storeRefresh(accountId, token, ttlDays) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + ttlDays * 86400_000);
  await pool.query(
    `INSERT INTO refresh_tokens (account_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [accountId, tokenHash, expiresAt],
  );
  return token;
}

async function login({ phone, password }) {
  const { rows } = await pool.query(
    `SELECT a.* FROM account a
     JOIN employee e ON e.phone = $1 AND e.company_id = a.company_id
     WHERE a.role = 'employee' AND e.status = 'active'
     UNION
     SELECT * FROM account WHERE name = $1 AND role <> 'employee'`,
    [phone],
  );
  // NOTE: simplified lookup by phone/name; production matches by unique identifier
  const account = rows[0];
  if (!account || !(await bcrypt.compare(password, account.credentials_hash))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }
  const access = signAccess(account);
  const refresh = await storeRefresh(account.id, hashRefresh(), config.refreshTokenTtlDays);
  return { accessToken: access, refreshToken: refresh, account: { id: account.id, role: account.role } };
}

async function refresh(refreshToken) {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const { rows } = await pool.query(
    `SELECT rt.id, rt.account_id, a.role, a.company_id, rt.expires_at, rt.revoked_at
     FROM refresh_tokens rt JOIN account a ON a.id = rt.account_id
     WHERE rt.token_hash = $1`,
    [tokenHash],
  );
  const rec = rows[0];
  if (!rec || rec.revoked_at || new Date(rec.expires_at) < new Date()) {
    throw new ApiError(401, 'INVALID_REFRESH', 'Invalid or expired refresh token');
  }
  // Rotation: invalidate the old token, issue a new pair
  await pool.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [rec.id]);
  const access = signAccess({ id: rec.account_id, company_id: rec.company_id, role: rec.role });
  const newRefresh = await storeRefresh(rec.account_id, hashRefresh(), config.refreshTokenTtlDays);
  return { accessToken: access, refreshToken: newRefresh };
}

async function logout(refreshToken) {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await pool.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [tokenHash]);
}

module.exports = { login, refresh, logout };
