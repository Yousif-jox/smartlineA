// src/routes/auth.routes.js — login / refresh / logout (Task 64)
const { Router } = require('express');
const { login, refresh, logout } = require('../services/auth.service');

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body || {};
    if (!phone || !password) {
      const { ApiError } = require('../middleware/error');
      return next(new ApiError(422, 'VALIDATION_ERROR', 'phone and password are required'));
    }
    const result = await login({ phone, password });
    return res.status(200).json(result);
  } catch (err) { return next(err); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      const { ApiError } = require('../middleware/error');
      return next(new ApiError(422, 'VALIDATION_ERROR', 'refreshToken is required'));
    }
    return res.status(200).json(await refresh(refreshToken));
  } catch (err) { return next(err); }
});

router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) await logout(refreshToken);
    return res.status(204).end();
  } catch (err) { return next(err); }
});

module.exports = router;
