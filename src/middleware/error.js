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

function errorHandler(err, req, res, _next) {
  const status = err.status || (err.code === '23505' ? 409 : err.code === '23503' || err.code === '23514' ? 409 : 500);
  const code = err.code && typeof err.code === 'string' && err.code.length <= 32 ? err.code : 'INTERNAL_ERROR';
  const message = status >= 500 ? 'Internal server error' : (err.message || 'Unknown error');

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
