// src/routes/health.js — Task 63: GET /health touches the DB and reflects failures
const { Router } = require('express');
const { ping } = require('../db');

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await ping();
    res.status(200).json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

module.exports = router;
