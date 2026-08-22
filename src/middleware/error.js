// src/middleware/error.js — unified error envelope (Task 54/71)
// { error: { code, message, details?, requestId } } — never leaks internals.

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Day-6 fix (Task 81/NFR-010): PostgreSQL error codes that escape to the
// handler are mapped to CLEAN envelopes — the raw message (which contains
// table/constraint names) is never returned to the client. Services that catch
// specific codes (e.g. 23505 -> DUPLICATE_PHONE) still map them themselves.
const DB_CODE_MAP = {
  '23505': { status: 409, code: 'DUPLICATE_RESOURCE', message: 'A resource with the same unique value already exists' },
  '23503': { status: 409, code: 'REFERENCE_VIOLATION', message: 'Operation references an invalid record' },
  '23514': { status: 409, code: 'CHECK_VIOLATION', message: 'Operation violates a data constraint' },
  '23P01': { status: 409, code: 'EXCLUSION_VIOLATION', message: 'Operation conflicts with an existing booking' },
  '22P02': { status: 422, code: 'VALIDATION_ERROR', message: 'Invalid input value' },
};

function errorHandler(err, req, res, _next) {
  const dbMapping = err.code && DB_CODE_MAP[err.code];
  const status = err.status || (dbMapping ? dbMapping.status : 500);
  const code = dbMapping
    ? dbMapping.code
    : (err.code && typeof err.code === 'string' && err.code.length <= 32 ? err.code : 'INTERNAL_ERROR');
  const message = dbMapping
    ? dbMapping.message
    : (status >= 500 ? 'Internal server error' : (err.message || 'Unknown error'));

  // NFR-013: structured logging with correlation ID; NEVER log secrets/stack to the client
  if (status >= 500) console.error(`[error] ${req.id || '-'} ${err.message}\n${err.stack}`);

  res.status(status).json({
    error: {
      code,
      message,
      ...(err.details ? { details: err.details } : {}),
      requestId: req.id || null,
    },
  });
}

function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found', requestId: req.id || null } });
}

module.exports = { ApiError, errorHandler, notFound };
