// src/middleware/rate-limit.js — per-user + per-IP limiting (Task 54/72)
// DESIGN: shared counters live in Redis (multi-instance correct, NFR-005).
// If REDIS_URL is unset, we degrade to a per-instance in-memory counter —
// documented fail-soft (availability first, Task 54), with an alert log.
const { ApiError } = require('./error');

let redis = null;
try {
  const { createClient } = require('redis');
  if (process.env.REDIS_URL) {
    redis = createClient({ url: process.env.REDIS_URL });
    redis.connect().catch(() => { redis = null; });
  }
} catch { /* redis client optional */ }

const memoryBuckets = new Map(); // key -> { tokens, lastRefill }
const WINDOW_MS = 1000;

function refill(key, limit, now) {
  const b = memoryBuckets.get(key);
  if (!b) { memoryBuckets.set(key, { tokens: limit - 1, lastRefill: now }); return true; }
  const elapsed = now - b.lastRefill;
  b.tokens = Math.min(limit, b.tokens + (elapsed / WINDOW_MS) * limit);
  b.lastRefill = now;
  if (b.tokens >= 1) { b.tokens -= 1; return true; }
  return false;
}

function rateLimit({ userLimit = 100, ipLimit = 50 } = {}) {
  return async (req, res, next) => {
    const now = Date.now();
    const userKey = req.auth ? `user:${req.auth.accountId}` : null;
    const ipKey = `ip:${req.ip}`;

    const check = async (key, limit) => {
      if (redis) {
        const count = await redis.incr(`rl:${key}`);
        if (count === 1) await redis.expire(`rl:${key}`, 1);
        return count <= limit;
      }
      return refill(key, limit, now);
    };

    let ok = true;
    if (userKey) ok = await check(userKey, userLimit);
    if (ok) ok = await check(ipKey, ipLimit);

    if (!ok) {
      if (!redis) console.warn('[rate-limit] using in-memory fallback (REDIS_URL not set)');
      res.set('Retry-After', '1');
      return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    }
    return next();
  };
}

module.exports = { rateLimit };
