// src/routes/attendance.routes.js — controllers only (Task 69)
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { bindTenant, requireTenant } = require('../middleware/tenant');
const service = require('../services/attendance.service');
const { ApiError } = require('../middleware/error');

const router = Router();

router.use(authenticate, bindTenant, requireTenant);

router.post('/trips/:id/attendance/events', authorize('attendance.record'), async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    const employeeId = Number(req.body?.employeeId);
    if (!Number.isInteger(tripId) || !Number.isInteger(employeeId)) {
      return next(new ApiError(422, 'VALIDATION_ERROR', 'trip id and employeeId are required'));
    }
    return res.status(201).json(await service.record(req.tenant, tripId, employeeId, req.body));
  } catch (err) { return next(err); }
});

router.get('/trips/:id/attendance', authorize('attendance.read'), async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    if (!Number.isInteger(tripId)) return next(new ApiError(422, 'VALIDATION_ERROR', 'invalid trip id'));
    return res.json(await service.list(req.tenant, tripId));
  } catch (err) { return next(err); }
});

module.exports = router;
