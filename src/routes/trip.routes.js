// src/routes/trip.routes.js — controllers only (Task 66)
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { bindTenant, requireTenant } = require('../middleware/tenant');
const service = require('../services/trip.service');
const { ApiError } = require('../middleware/error');

const router = Router();

router.use(authenticate, bindTenant, requireTenant);

router.post('/', authorize('trip.create'), async (req, res, next) => {
  try {
    const trip = await service.create(req.tenant, req.body);
    return res.status(201).json(trip);
  } catch (err) { return next(err); }
});

router.patch('/:id/status', authorize('trip.status'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { state } = req.body || {};
    if (!Number.isInteger(id) || !state) {
      return next(new ApiError(422, 'VALIDATION_ERROR', 'trip id and state are required'));
    }
    return res.json(await service.updateStatus(req.tenant, id, state));
  } catch (err) { return next(err); }
});

router.post('/:id/assignments', authorize('trip.assign'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { employeeId } = req.body || {};
    if (!Number.isInteger(id) || !Number.isInteger(employeeId)) {
      return next(new ApiError(422, 'VALIDATION_ERROR', 'trip id and employeeId are required'));
    }
    return res.status(201).json(await service.assignEmployee(req.tenant, id, employeeId));
  } catch (err) { return next(err); }
});

router.delete('/:id/assignments/:employeeId', authorize('trip.assign'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const employeeId = Number(req.params.employeeId);
    if (!Number.isInteger(id) || !Number.isInteger(employeeId)) {
      return next(new ApiError(422, 'VALIDATION_ERROR', 'invalid ids'));
    }
    return res.json(await service.removeAssignment(req.tenant, id, employeeId));
  } catch (err) { return next(err); }
});

module.exports = router;
