// src/utils/http.js — shared HTTP helpers (Task 73 refactoring target)
const { ApiError } = require('../middleware/error');

// Parse a route param as a positive integer id — one place for all routes
function parseId(raw, name = 'id') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(422, 'VALIDATION_ERROR', `invalid ${name}`);
  }
  return id;
}

// Wrap an async route handler — one place for try/next
function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { parseId, wrap };
