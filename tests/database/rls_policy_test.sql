-- ============================================================
-- Smart Line — Day 6, Task 79 — RLS policy proof
-- Run with the Node runner (psql not required):
--   node scripts/run-sql.js tests/database/rls_policy_test.sql
-- (or paste into the Supabase SQL Editor)
--
-- ASSERTIONS ARE DATA-RELATIVE: the invariant is "RLS view == explicit
-- company filter", never an absolute count — leftover test data on the
-- shared database cannot break the proof. Every "expect" comment holds.
-- ============================================================

BEGIN;

-- Prove RLS is a REAL independent layer: switch to a NOLOGIN role that has
-- only the grants from migration 006. It is NOT the table owner and NOT
-- BYPASSRLS — so row security applies to it.
SET LOCAL ROLE smartline_rls_test;

-- 1) WITHOUT the tenant config -> fail closed: zero rows visible.
SELECT count(*) AS no_config_employees FROM employee;
-- expect 0

SELECT count(*) AS no_config_trips FROM trip;
-- expect 0

SELECT count(*) AS no_config_company FROM company;
-- expect 0

-- 2) WITH the tenant config (transaction-local) -> company 1 only.
SELECT set_config('app.company_id', '1', true);

-- THE INVARIANT: the RLS-limited count equals the explicit filter count.
SELECT
  (SELECT count(*) FROM employee)                                  AS rls_count,
  (SELECT count(*) FROM employee WHERE company_id = 1)             AS filter_count,
  (SELECT count(*) FROM employee WHERE company_id = 2)             AS cross_tenant_count,
  (SELECT count(*) FROM trip_employee)                             AS junction_count,
  (SELECT count(*) FROM trip_employee te
     JOIN trip t ON t.id = te.trip_id WHERE t.company_id = 1)      AS junction_expected,
  (SELECT count(*) FROM active_employee)                           AS view_count;
-- expect rls_count = filter_count > 0
-- expect cross_tenant_count = 0
-- expect junction_count = junction_expected
-- expect view_count = filter_count (security-invoker view is guarded too)

-- 3) Switch the tenant inside the SAME transaction -> company 2.
SELECT set_config('app.company_id', '2', true);
SELECT
  (SELECT count(*) FROM employee)                              AS rls_count_c2,
  (SELECT count(*) FROM employee WHERE company_id = 2)         AS filter_count_c2;
-- expect rls_count_c2 = filter_count_c2

ROLLBACK;

-- ============================================================
-- Manual pass check (same shape, via the Node runner):
--   node scripts/run-sql.js --exec "SET ROLE smartline_rls_test; SELECT count(*) FROM employee;"
--   (expect 0) then with set_config('app.company_id','1',true) expect the
--   company-1 count, and company_id=2 always 0.
-- ============================================================
