// src/repositories/employee.repo.js — data access (Task 65)
// EVERY query binds company_id from the tenant context (Task 53).
// Reads go through the active_employee view (Task 41) — no repeated
// deleted_at filters. Cross-tenant lookups return null -> service 404.

const { pool } = require('../db');

async function list(tenant, { branchId, status, q, cursor, limit = 20 } = {}) {
  const params = [tenant];
  let where = 'WHERE company_id = $1';
  if (branchId) { params.push(branchId); where += ` AND branch_id = $${params.length}`; }
  if (status) { params.push(status); where += ` AND status = $${params.length}`; }
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
  }
  params.push(limit + 1);
  const { rows } = await pool.query(
    `SELECT id, company_id, branch_id, name, phone, status
     FROM active_employee ${where}
     ORDER BY id
     LIMIT $${params.length}`,
    params,
  );
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return { data, nextCursor: hasMore ? String(data[data.length - 1].id) : null };
}

async function findById(tenant, id) {
  const { rows } = await pool.query(
    `SELECT id, company_id, branch_id, name, phone, status
     FROM active_employee WHERE company_id = $1 AND id = $2`,
    [tenant, id],
  );
  return rows[0] || null; // null = not found OR hidden by tenant — same result (NFR-009)
}

async function create(tenant, { branchId, name, phone }) {
  const { rows } = await pool.query(
    `INSERT INTO employee (company_id, branch_id, name, phone, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING id, company_id, branch_id, name, phone, status`,
    [tenant, branchId ?? null, name, phone],
  );
  return rows[0];
}

async function update(tenant, id, fields) {
  const set = [];
  const params = [tenant, id];
  for (const [key, value] of Object.entries(fields)) {
    if (['branch_id', 'name', 'phone', 'status'].includes(key) && value !== undefined) {
      params.push(value);
      set.push(`${key} = $${params.length}`);
    }
  }
  if (!set.length) return null;
  const { rows } = await pool.query(
    `UPDATE active_employee SET ${set.join(', ')} WHERE company_id = $1 AND id = $2
     RETURNING id, company_id, branch_id, name, phone, status`,
    params,
  );
  return rows[0] || null;
}

async function softDelete(tenant, id) {
  const { rows } = await pool.query(
    `UPDATE employee SET deleted_at = now(), status = 'deleted'
     WHERE company_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [tenant, id],
  );
  return rows.length > 0;
}

module.exports = { list, findById, create, update, softDelete };
