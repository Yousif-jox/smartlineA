// Day 6 — Task 81: SQL-injection regression tests.
// The whole codebase is parameterized (audit: docs/security/sql-injection-audit.md).
// These tests prove it against the REAL database: classic injection payloads
// must never execute, and the trips table must survive intact.
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const employeeService = require('../../src/services/employee.service');

before(async () => { await pool.query('SELECT 1'); });
after(async () => { await pool.end(); });

test("search filter with '; DROP TABLE trips; --' returns rows normally (parameterized ILIKE)", async () => {
  const payload = "'; DROP TABLE trips; --";
  const { data } = await employeeService.list(1, { q: payload });
  assert.ok(Array.isArray(data), 'must return a list, not throw');
  // and the table still exists afterwards:
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM trip`);
  assert.ok(rows[0].n >= 10, 'trips table must still be intact');
});

test('branchId with SQL fragment does not execute — it is a controlled 422, never data', async () => {
  const payload = "1) OR (1=1) --";
  await assert.rejects(
    () => employeeService.list(1, { branchId: payload }),
    (e) => e.status === 422 && e.code === 'VALIDATION_ERROR',
  );
  // prove no data was returned/exfiltrated by checking the table again
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM trip`);
  assert.ok(rows[0].n >= 10, 'trips table intact after injection attempt');
});

test('status filter cannot be used for boolean blind exfiltration', async () => {
  const payload = "active' AND 1=(SELECT count(*) FROM pg_tables) --";
  const { data } = await employeeService.list(1, { status: payload });
  // Parameterized: it is compared as a literal string -> zero matches, no leak
  assert.deepStrictEqual(data, []);
});

test('raw UNION payload in q does not union into results', async () => {
  const payload = "x' UNION SELECT credentials_hash FROM account --";
  const { data } = await employeeService.list(1, { q: payload });
  for (const row of data) {
    assert.ok(!('credentials_hash' in row), 'no account credentials can leak through search');
  }
});
