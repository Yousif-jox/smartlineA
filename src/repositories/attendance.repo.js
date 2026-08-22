// src/repositories/attendance.repo.js — data access (Task 69)
// Idempotent event recording (Task 13 semantics at the DB level):
//  - event_id UNIQUE -> retried events are no-ops
//  - only the LATEST timestamp wins (out-of-order safe)
//  - events accepted only while the trip is Started / In Progress (freeze rule)

const { pool } = require('../db');

async function recordEvent(tenant, tripId, employeeId, { eventId, state, ts, recordedBy }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // trip must belong to the tenant and be recordable (freeze after completion)
    const t = await client.query(
      `SELECT state FROM trip WHERE company_id = $1 AND id = $2 FOR UPDATE`,
      [tenant, tripId],
    );
    if (!t.rows[0]) { await client.query('ROLLBACK'); return { error: 'NOT_FOUND' }; }
    if (t.rows[0].state !== 'Started' && t.rows[0].state !== 'In Progress') {
      await client.query('ROLLBACK');
      return { error: 'ILLEGAL_STATE', state: t.rows[0].state };
    }

    // FR-010: only ASSIGNED employees can be marked (walk-on rejected)
    const a = await client.query(
      `SELECT 1 FROM trip_employee WHERE trip_id = $1 AND employee_id = $2`,
      [tripId, employeeId],
    );
    if (!a.rows.length) { await client.query('ROLLBACK'); return { error: 'NOT_ASSIGNED' }; }

    // the final record (one per employee per trip) — Unknown initially
    const att = await client.query(
      `INSERT INTO attendance (trip_id, employee_id, state)
       VALUES ($1, $2, 'Unknown')
       ON CONFLICT (trip_id, employee_id) DO UPDATE SET trip_id = EXCLUDED.trip_id
       RETURNING id, state, updated_at`,
      [tripId, employeeId],
    );
    const attendanceId = att.rows[0].id;

    // idempotency: the same event_id is only ever applied once
    const dup = await client.query(
      `SELECT 1 FROM attendance_event WHERE event_id = $1`,
      [eventId],
    );
    if (dup.rows.length) { await client.query('ROLLBACK'); return { error: 'DUPLICATE_EVENT' }; }

    // out-of-order guard: an older timestamp never overwrites a newer one
    if (att.rows[0].state !== 'Unknown' && new Date(att.rows[0].updated_at) >= new Date(ts)) {
      await client.query('ROLLBACK');
      return { error: 'STALE_EVENT', state: att.rows[0].state };
    }

    await client.query(
      `INSERT INTO attendance_event (attendance_id, event_id, state, ts, recorded_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [attendanceId, eventId, state, ts, recordedBy],
    );
    await client.query(
      `UPDATE attendance SET state = $1, updated_at = $2 WHERE id = $3`,
      [state, ts, attendanceId],
    );
    await client.query('COMMIT');
    return { ok: true, state };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listForTrip(tenant, tripId) {
  const { rows } = await pool.query(
    `SELECT a.employee_id, a.state, a.updated_at
     FROM attendance a JOIN trip t ON t.id = a.trip_id AND t.company_id = $1
     WHERE a.trip_id = $2`,
    [tenant, tripId],
  );
  return rows;
}

module.exports = { recordEvent, listForTrip };
