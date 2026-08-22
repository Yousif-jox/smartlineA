// src/config.js — environment configuration (Task 61: no secrets in code)
try { require('dotenv').config(); } catch { /* dotenv is optional */ }

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TTL_DAYS || 7),
};
