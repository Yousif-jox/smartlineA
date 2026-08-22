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

// Day-6 (Task 85/86): the manager-dashboard query — an employee's trips,
// tenant-scoped, keyset-paginated (Task 42 cursor, not OFFSET). The (trip_date,
// start_time, id) keyset predicate makes deep pages cheap: the planner walks
// the index, it never scans 20M rows to skip 100k pages.
async function listTrips(tenant, employeeId, { from, to, cursor, limit = 20 } = {}) {
  const params = [tenant, employeeId];
  let where = 'te.employee_id = $2 AND t.company_id = $1';
  if (from) { params.push(from); where += ` AND t.trip_date >= $${params.length}`; }
  if (to) { params.push(to); where += ` AND t.trip_date <= $${params.length}`; }
  if (cursor) {
    params.push(cursor);
    where += ` AND (t.trip_date, t.start_time, t.id) >
                 (SELECT trip_date, start_time, id FROM trip
                  WHERE id = $${params.length} AND company_id = $1)`;
  }
  params.push(limit + 1);
  const { rows } = await pool.query(
    `SELECT t.id, t.trip_date, t.start_time, t.end_time, t.state,
            t.route_id, t.vehicle_id, t.captain_id
     FROM trip_employee te
     JOIN trip t ON t.id = te.trip_id
     WHERE ${where}
     ORDER BY t.trip_date, t.start_time, t.id
     LIMIT $${params.length}`,
    params,
  );
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return { data, nextCursor: hasMore ? String(data[data.length - 1].id) : null };
}

module.exports = { list, findById, create, update, softDelete, listTrips };
