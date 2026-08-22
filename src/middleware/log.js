// src/middleware/log.js — structured JSON logging with correlation IDs (Task 71)
// Every request logs one JSON line: { ts, level, requestId, method, path,
// status, durationMs }. No secrets are ever logged (NFR-013/NFR-010).

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const entry = {
      ts: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    };
    console.log(JSON.stringify(entry));
  });
  next();
}

module.exports = { requestLogger };
