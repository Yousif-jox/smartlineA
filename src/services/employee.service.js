// src/services/employee.service.js — business rules (Task 65)
// 404 semantics: a missing row and a cross-tenant row are indistinguishable
// (NFR-009). Tenant is ALWAYS passed by the middleware — never derived here.

const repo = require('../repositories/employee.repo');
const { ApiError } = require('../middleware/error');

async function list(tenant, filters) {
  return repo.list(tenant, filters);
}

async function getById(tenant, id) {
  const employee = await repo.findById(tenant, id);
  if (!employee) throw new ApiError(404, 'NOT_FOUND', 'Employee not found');
  return employee;
}

async function create(tenant, input) {
  if (!input?.name || !input?.phone) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'name and phone are required');
  }
  try {
    return await repo.create(tenant, input);
  } catch (err) {
    if (err.code === '23505') {
      throw new ApiError(409, 'DUPLICATE_PHONE', 'Phone is already in use');
    }
    throw err;
  }
}

async function update(tenant, id, fields) {
  const employee = await repo.update(tenant, id, fields);
  if (!employee) throw new ApiError(404, 'NOT_FOUND', 'Employee not found');
  return employee;
}

async function remove(tenant, id) {
  const ok = await repo.softDelete(tenant, id);
  if (!ok) throw new ApiError(404, 'NOT_FOUND', 'Employee not found');
  return { deleted: true };
}

module.exports = { list, getById, create, update, remove };
