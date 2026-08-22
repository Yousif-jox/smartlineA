// src/repositories/trip.repo.js — data access (Task 66)
// Every query binds company_id (Task 53). State updates use optimistic
// concurrency: WHERE state = $current — a stale writer gets null.

const { pool } = require('../db');

const TRIP_COLS = `id, company_id, route_id, vehicle_id, captain_id,
  trip_date, start_time, end_time, state, stops_snapshot`;

async function findById(tenant, id) {
  const { rows } = await pool.query(
    `SELECT ${TRIP_COLS} FROM trip WHERE company_id = $1 AND id = $2`,
    [tenant, id],
  );
  return rows[0] || null;
}

// Build the stops snapshot from the route (Day 2 decision: written once, immutable)
async function buildStopsSnapshot(tenant, routeId) {
  const { rows } = await pool.query(
    `SELECT rs.pickup_location_id, rs.position
     FROM route_stop rs
     JOIN route r ON r.id = rs.route_id AND r.branch_id IN (SELECT id FROM branch WHERE company_id = $1)
     WHERE rs.route_id = $2
     ORDER BY rs.position`,
    [tenant, routeId],
  );
  return rows;
}

async function create(tenant, { routeId, vehicleId, captainId, tripDate, startTime, endTime }) {
  const snapshot = await buildStopsSnapshot(tenant, routeId);
  const { rows } = await pool.query(
    `INSERT INTO trip (company_id, route_id, vehicle_id, captain_id,
                       trip_date, start_time, end_time, state, stops_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Scheduled', $8)
     RETURNING ${TRIP_COLS}`,
    [tenant, routeId, vehicleId, captainId, tripDate, startTime, endTime, JSON.stringify(snapshot)],
  );
  return rows[0];
}

async function hasActiveConflict(table, column, value, tripDate, startTime, endTime, excludeId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM trip
     WHERE ${column} = $1 AND trip_date = $2
       AND start_time < $4 AND end_time > $3
       AND state NOT IN ('Cancelled', 'Failed')
       ${excludeId ? 'AND id <> $5' : ''}
     LIMIT 1`,
    [value, tripDate, startTime, endTime, ...(excludeId ? [excludeId] : [])],
  );
  return rows.length > 0;
}

async function captainConflict(captainId, tripDate, startTime, endTime, excludeId) {
  return hasActiveConflict('trip', 'captain_id', captainId, tripDate, startTime, endTime, excludeId);
}

async function vehicleConflict(vehicleId, tripDate, startTime, endTime, excludeId) {
  return hasActiveConflict('trip', 'vehicle_id', vehicleId, tripDate, startTime, endTime, excludeId);
}

// Optimistic state transition — returns null on stale/missing row
async function updateState(tenant, id, currentState, newState) {
  const { rows } = await pool.query(
    `UPDATE trip SET state = $4
     WHERE company_id = $1 AND id = $2 AND state = $3
     RETURNING ${TRIP_COLS}`,
    [tenant, id, currentState, newState],
  );
  return rows[0] || null;
}

// Task 67 — assignment inside ONE transaction with a row lock (Task 38).
// The FOR UPDATE on the trip row serializes concurrent assignments to the
// same trip: the second writer re-reads the fresh capacity after the first
// commits. Returns a result object; the service maps it to HTTP errors.
async function assignWithLock(tenant, tripId, employeeId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const t = await client.query(
      `SELECT id, state, vehicle_id FROM trip WHERE company_id = $1 AND id = $2 FOR UPDATE`,
      [tenant, tripId],
    );
    const trip = t.rows[0];
    if (!trip) { await client.query('ROLLBACK'); return { error: 'NOT_FOUND' }; }
    if (trip.state !== 'Scheduled' && trip.state !== 'Assigned') {
      await client.query('ROLLBACK');
      return { error: 'ILLEGAL_STATE', state: trip.state };
    }

    // capacity check inside the lock (Task 9 semantics: unique employees)
    const v = await client.query(`SELECT capacity FROM vehicle WHERE id = $1`, [trip.vehicle_id]);
    const c = await client.query(
      `SELECT COUNT(DISTINCT employee_id)::int AS n FROM trip_employee WHERE trip_id = $1`,
      [tripId],
    );
    if (v.rows[0] && c.rows[0].n + 1 > v.rows[0].capacity) {
      await client.query('ROLLBACK');
      return { error: 'CAPACITY_EXCEEDED', capacity: v.rows[0].capacity, assigned: c.rows[0].n };
    }

    // employee overlap on the same day (FR-007) — inside the same lock
    const ov = await client.query(
      `SELECT 1 FROM trip_employee te
       JOIN trip t ON t.id = te.trip_id
       WHERE te.employee_id = $1
         AND t.state NOT IN ('Cancelled', 'Failed')
         AND t.id <> $2
         AND t.trip_date = (SELECT trip_date FROM trip WHERE id = $2)
         AND t.start_time < (SELECT end_time FROM trip WHERE id = $2)
         AND (SELECT start_time FROM trip WHERE id = $2) < t.end_time
       LIMIT 1`,
      [employeeId, tripId],
    );
    if (ov.rows.length > 0) { await client.query('ROLLBACK'); return { error: 'EMPLOYEE_OVERLAP' }; }

    const ins = await client.query(
      `INSERT INTO trip_employee (trip_id, employee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING trip_id`,
      [tripId, employeeId],
    );
    if (ins.rowCount === 0) { await client.query('ROLLBACK'); return { error: 'ALREADY_ASSIGNED' }; }

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// FR-008: removal allowed until the trip is Completed
async function removeAssignment(tenant, tripId, employeeId) {
  const { rows } = await pool.query(
    `DELETE FROM trip_employee te
     USING trip t
     WHERE te.trip_id = t.id AND t.company_id = $1
       AND te.trip_id = $2 AND te.employee_id = $3
     RETURNING te.trip_id`,
    [tenant, tripId, employeeId],
  );
  return rows.length > 0;
}

module.exports = { findById, create, captainConflict, vehicleConflict, updateState, assignWithLock, removeAssignment };
