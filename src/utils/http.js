// src/utils/http.js — shared HTTP helpers (Task 73 refactoring target)
const { ApiError } = require('../middleware/error');

// Parse a route param as a positive integer id — one place for all routes.
// Day-6 hardening (Task 80): ids beyond Number.MAX_SAFE_INTEGER lose precision
// when parsed to JS Number (BIGINT -> Number rounding) — reject them loudly
// instead of querying with a silently-corrupted id.
function parseId(raw, name = 'id') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) {
    throw new ApiError(422, 'VALIDATION_ERROR', `invalid ${name}`);
  }
  return id;
}

// Wrap an async route handler — one place for try/next
function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { parseId, wrap };
