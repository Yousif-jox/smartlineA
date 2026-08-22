// src/repositories/complaint.repo.js — data access (Task 70)
// Day-6 fix (Task 79): tenant scoping is conditional — when the actor has no
// tenant (call_center/admin, req.tenant === null, the documented Task-52
// exception) the lookup runs WITHOUT the company filter; tenant-scoped actors
// (employee/manager) always get the company filter -> cross-tenant is a 404.
const { pool } = require('../db');

async function create(tenant, { employeeId, category, priority }) {
  const { rows } = await pool.query(
    `INSERT INTO complaint (company_id, employee_id, category, priority, state)
     VALUES ($1, $2, $3, $4, 'submitted')
     RETURNING id, company_id, employee_id, category, priority, state, created_at`,
    [tenant, employeeId, category, priority],
  );
  return rows[0];
}

// Day-6: verify the complaint's employee belongs to the caller's tenant.
// Missing or cross-tenant -> false -> service 404 (NFR-009, no existence oracle).
async function employeeInTenant(tenant, employeeId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM active_employee WHERE company_id = $1 AND id = $2 LIMIT 1`,
    [tenant, employeeId],
  );
  return rows.length > 0;
}

async function findById(tenant, id) {
  const params = [id];
  let where = 'id = $1';
  if (tenant != null) { params.push(tenant); where += ' AND company_id = $2'; }
  const { rows } = await pool.query(
    `SELECT id, company_id, employee_id, category, priority, state, assigned_agent_id, resolution, created_at
     FROM complaint WHERE ${where}`,
    params,
  );
  return rows[0] || null;
}

async function updateState(tenant, id, currentState, newState, { agentId, resolution } = {}) {
  const params = [id, currentState, newState, agentId ?? null, resolution ?? null];
  let where = 'id = $1 AND state = $2';
  if (tenant != null) { params.push(tenant); where += ' AND company_id = $6'; }
  const { rows } = await pool.query(
    `UPDATE complaint
     SET state = $3,
         assigned_agent_id = COALESCE($4, assigned_agent_id),
         resolution = COALESCE($5, resolution)
     WHERE ${where}
     RETURNING id, company_id, employee_id, category, priority, state, assigned_agent_id, resolution`,
    params,
  );
  return rows[0] || null;
}

module.exports = { create, employeeInTenant, findById, updateState };
