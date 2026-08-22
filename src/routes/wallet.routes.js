// src/routes/wallet.routes.js — controllers only (Task 58/68)
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { bindTenant, requireTenant } = require('../middleware/tenant');
const service = require('../services/wallet.service');

const router = Router();

router.use(authenticate, bindTenant, requireTenant);

router.post('/:id/transactions', authorize('wallet.transact'), async (req, res, next) => {
  try {
    const walletId = Number(req.params.id);
    const key = req.headers['idempotency-key'];
    if (!Number.isInteger(walletId)) return next(new (require('../middleware/error').ApiError)(422, 'VALIDATION_ERROR', 'invalid wallet id'));
    const result = await service.charge(req.tenant, walletId, req.body || {}, key);
    return res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) { return next(err); }
});

module.exports = router;
