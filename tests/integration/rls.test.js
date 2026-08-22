// Day 6 — Task 79: RLS proof as a JS integration test (mirrors
// tests/database/rls_policy_test.sql). Skips cleanly when migration 006
// (role smartline_rls_test) is not applied yet.
//
// ASSERTIONS ARE DATA-RELATIVE, not absolute: the invariant is that the
// RLS-limited view EQUALS the explicit `company_id` filter — so leftover
// test data on the shared Supabase DB can never break the suite. Absolute
// seed counts (25/15/55) were the first version and broke when a stale
// employee existed; the guarantee that matters is equality, not a number.
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');

before(async () => { await pool.query('SELECT 1'); });
after(async () => { await pool.end(); });

async function rlsAvailable() {
  const { rows } = await pool.query(`SELECT 1 FROM pg_roles WHERE rolname = 'smartline_rls_test'`);
  return rows.length > 0;
}

async function rlsQuery(client, text) {
  const { rows } = await client.query(text);
  return rows[0].n;
}

test('RLS: a non-bypass role WITHOUT the tenant config sees ZERO rows (fail closed)', async (t) => {
  if (!(await rlsAvailable())) return t.skip('migration 006 not applied (smartline_rls_test missing)');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE smartline_rls_test');
    assert.strictEqual(await rlsQuery(client, 'SELECT count(*)::int AS n FROM employee'), 0, 'no config -> no rows');
    assert.strictEqual(await rlsQuery(client, 'SELECT count(*)::int AS n FROM trip'), 0);
    await client.query('ROLLBACK');
  } finally { client.release(); }
});

test('RLS: visible set EQUALS the explicit company filter; cross-tenant is 0; view guarded', async (t) => {
  if (!(await rlsAvailable())) return t.skip('migration 006 not applied (smartline_rls_test missing)');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE smartline_rls_test');
    await client.query(`SELECT set_config('app.company_id', '1', true)`);

    const all = await rlsQuery(client, 'SELECT count(*)::int AS n FROM employee');
    const filtered = await rlsQuery(client, 'SELECT count(*)::int AS n FROM employee WHERE company_id = 1');
    const activeFiltered = await rlsQuery(client, 'SELECT count(*)::int AS n FROM employee WHERE company_id = 1 AND deleted_at IS NULL');
    assert.strictEqual(all, filtered, `RLS-limited count (${all}) must equal the explicit filter (${filtered})`);
    assert.ok(all > 0, 'company 1 must have data');

    const cross = await rlsQuery(client, 'SELECT count(*)::int AS n FROM employee WHERE company_id = 2');
    assert.strictEqual(cross, 0, 'cross-tenant read blocked by policy');

    const junction = await rlsQuery(client, 'SELECT count(*)::int AS n FROM trip_employee');
    const junctionExpected = await rlsQuery(
      client,
      `SELECT count(*)::int AS n FROM trip_employee te JOIN trip t ON t.id = te.trip_id WHERE t.company_id = 1`,
    );
    assert.strictEqual(junction, junctionExpected, 'junction rows resolve through parent trip company');

    const view = await rlsQuery(client, 'SELECT count(*)::int AS n FROM active_employee');
    assert.strictEqual(view, activeFiltered, 'security-invoker view is RLS-guarded too');
    await client.query('ROLLBACK');
  } finally { client.release(); }
});

test('RLS: switching the config switches the visible tenant inside one session', async (t) => {
  if (!(await rlsAvailable())) return t.skip('migration 006 not applied (smartline_rls_test missing)');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE smartline_rls_test');
    await client.query(`SELECT set_config('app.company_id', '1', true)`);
    const c1 = await rlsQuery(client, 'SELECT count(*)::int AS n FROM employee');
    await client.query(`SELECT set_config('app.company_id', '2', true)`);
    const c2 = await rlsQuery(client, 'SELECT count(*)::int AS n FROM employee');
    const c2Filtered = await rlsQuery(client, 'SELECT count(*)::int AS n FROM employee WHERE company_id = 2');
    assert.ok(c1 > 0, 'company 1 has data');
    assert.strictEqual(c2, c2Filtered, 'company-2 view equals its explicit filter');
    assert.ok(c1 !== c2, 'different tenants see different sets');
    await client.query('ROLLBACK');
  } finally { client.release(); }
});
