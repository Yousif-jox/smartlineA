// Integration tests — tenant-isolated employee CRUD (Task 65)
// REQUIRES a real database: DATABASE_URL must point to your PostgreSQL
// (Supabase works). Runs against seeded data (Day 3 seeds):
//   employee 1..25 belong to company 1; 26..40 to company 2.
// Run: set DATABASE_URL=... && npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const service = require('../../src/services/employee.service');

const URL = process.env.DATABASE_URL;

before(async () => {
  if (!URL) {
    throw new Error('DATABASE_URL is required for integration tests');
  }
  // clean leftovers from previous runs (tests are re-runnable)
  await pool.query(`DELETE FROM employee WHERE phone = '0109999001'`);
});

after(async () => {
  await pool.end();
});

test('manager of company 1 sees ONLY company-1 employees (tenant isolation)', async () => {
  const { data } = await service.list(1, {});
  assert.ok(data.length > 0);
  for (const e of data) assert.strictEqual(e.company_id, 1, 'leaked a cross-tenant row');
});

test('cross-tenant read returns 404 (no existence leak — NFR-009)', async () => {
  // employee 41 belongs to company 3 — a company-1 tenant must get NOT_FOUND
  await assert.rejects(
    () => service.getById(1, 41),
    (err) => err.status === 404 && err.code === 'NOT_FOUND',
  );
});

test('create + read + soft-delete lifecycle within tenant', async () => {
  const created = await service.create(1, { name: 'Test Employee', phone: '0109999001' });
  assert.strictEqual(created.company_id, 1);
  const fetched = await service.getById(1, created.id);
  assert.strictEqual(fetched.name, 'Test Employee');
  await service.remove(1, created.id);
  // soft-deleted => gone from active reads
  await assert.rejects(() => service.getById(1, created.id), (err) => err.status === 404);
});

test('duplicate ACTIVE phone in the same tenant is rejected (409)', async () => {
  // create an ACTIVE employee with the phone, then a second one with the same phone
  await service.create(1, { name: 'Dup A', phone: '0108888001' });
  await assert.rejects(
    () => service.create(1, { name: 'Dup B', phone: '0108888001' }),
    (err) => err.status === 409 && err.code === 'DUPLICATE_PHONE',
  );
  await pool.query(`DELETE FROM employee WHERE phone = '0108888001'`);
});

test('phone is reusable after soft delete (Task 41 partial index)', async () => {
  const a = await service.create(1, { name: 'Rehire A', phone: '0107777001' });
  await service.remove(1, a.id); // soft delete
  // same phone can be used again by an ACTIVE employee
  const b = await service.create(1, { name: 'Rehire B', phone: '0107777001' });
  assert.ok(b.id > 0);
  await pool.query(`DELETE FROM employee WHERE phone = '0107777001'`);
});
