// src/repositories/complaint.repo.js — data access (Task 70)
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

async function findById(tenant, id) {
  const { rows } = await pool.query(
    `SELECT id, company_id, employee_id, category, priority, state, assigned_agent_id, resolution, created_at
     FROM complaint WHERE company_id = $1 AND id = $2`,
    [tenant, id],
  );
  return rows[0] || null;
}

async function updateState(tenant, id, currentState, newState, { agentId, resolution } = {}) {
  const { rows } = await pool.query(
    `UPDATE complaint
     SET state = $4,
         assigned_agent_id = COALESCE($5, assigned_agent_id),
         resolution = COALESCE($6, resolution)
     WHERE company_id = $1 AND id = $2 AND state = $3
     RETURNING id, company_id, employee_id, category, priority, state, assigned_agent_id, resolution`,
    [tenant, id, currentState, newState, agentId ?? null, resolution ?? null],
  );
  return rows[0] || null;
}

module.exports = { create, findById, updateState };
