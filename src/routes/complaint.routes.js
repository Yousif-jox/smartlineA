// src/routes/complaint.routes.js — controllers only (Task 70)
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { bindTenant } = require('../middleware/tenant');
const service = require('../services/complaint.service');
const { ApiError } = require('../middleware/error');

const router = Router();

router.use(authenticate, bindTenant);

// NOTE: complaints deliberately do NOT requireTenant — the call-center role
// legitimately works across companies (Task 52/53 audited exception).
// Tenant-scoped callers (employee/manager) get tenant from their token.

router.post('/', authorize('complaint.submit'), async (req, res, next) => {
  try {
    const employeeId = req.auth.role === 'employee' ? Number(req.body?.employeeId) || req.auth.accountId : Number(req.body?.employeeId);
    if (!Number.isInteger(employeeId)) return next(new ApiError(422, 'VALIDATION_ERROR', 'employeeId is required'));
    return res.status(201).json(await service.create(req.tenant, employeeId, req.body));
  } catch (err) { return next(err); }
});

router.patch('/:id', authorize('complaint.handle'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { action, agentId, resolution } = req.body || {};
    if (!Number.isInteger(id)) return next(new ApiError(422, 'VALIDATION_ERROR', 'invalid complaint id'));
    return res.json(await service.transition(req.tenant, id, action, { agentId, resolution, role: req.auth.role }));
  } catch (err) { return next(err); }
});

module.exports = router;
