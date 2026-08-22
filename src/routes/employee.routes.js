// src/routes/employee.routes.js — controllers only (Task 47/65)
const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { bindTenant, requireTenant } = require('../middleware/tenant');
const service = require('../services/employee.service');
const { ApiError } = require('../middleware/error');

const router = Router();

// Order matters: auth -> tenant binding (Task 53) -> role check
router.use(authenticate, bindTenant, requireTenant);

router.get('/', authorize('employee.read'), async (req, res, next) => {
  try {
    const { branchId, status, q, cursor, limit } = req.query;
    return res.json(await service.list(req.tenant, { branchId, status, q, cursor, limit }));
  } catch (err) { return next(err); }
});

router.post('/', authorize('employee.manage'), async (req, res, next) => {
  try {
    const employee = await service.create(req.tenant, req.body);
    return res.status(201).json(employee);
  } catch (err) { return next(err); }
});

router.get('/:id', authorize('employee.read'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new ApiError(422, 'VALIDATION_ERROR', 'invalid id'));
    return res.json(await service.getById(req.tenant, id));
  } catch (err) { return next(err); }
});

router.patch('/:id', authorize('employee.manage'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new ApiError(422, 'VALIDATION_ERROR', 'invalid id'));
    return res.json(await service.update(req.tenant, id, req.body || {}));
  } catch (err) { return next(err); }
});

router.delete('/:id', authorize('employee.manage'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new ApiError(422, 'VALIDATION_ERROR', 'invalid id'));
    return res.json(await service.remove(req.tenant, id));
  } catch (err) { return next(err); }
});

module.exports = router;
