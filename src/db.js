// src/db.js — PostgreSQL connection pool (Task 62/63)
const { Pool } = require('pg');
const config = require('./config');

// BIGINT (OID 20) is returned as string by default — parse to Number so the
// API returns numeric ids (ids here stay well below 2^53).
const { types } = require('pg');
types.setTypeParser(20, (v) => parseInt(v, 10));

if (!config.databaseUrl) {
  console.warn('[db] DATABASE_URL is not set — database features are disabled.');
}

const pool = new Pool({
  connectionString: config.databaseUrl || undefined,
  max: 20,
  idleTimeoutMillis: 30_000,
});

// Task 63: GET /health must touch the database and reflect failures
async function ping() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0].ok === 1;
}

module.exports = { pool, ping };
