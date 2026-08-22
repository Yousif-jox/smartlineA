-- ============================================================
-- Smart Line — Day 6, Task 79
-- Migration 006: Row-Level Security — the independent last layer
--
-- The Day-5 app-layer tenant filters (middleware + every repository
-- query, Task 53) are the FIRST line. RLS is the SECOND: any role
-- that is not BYPASSRLS is confined to current_setting('app.company_id')
-- — even a buggy future query cannot cross tenants (NFR-009).
--
-- Operational model (documented honestly):
--  * On Supabase the app connects as `postgres` (BYPASSRLS) — RLS does
--    not constrain the app itself; the app keeps its explicit filters.
--  * RLS constrains EVERY other role: leaked credentials, analyst roles,
--    ad-hoc SQL tools, buggy code running under a limited role.
--  * The proof lives in tests/database/rls_policy_test.sql: it runs as
--    smartline_rls_test (a NOLOGIN role) via SET ROLE and shows that
--    without the config zero rows are visible, and with the config only
--    the configured company's rows are visible.
-- ============================================================

-- Tenant context helper: NULL when unset/empty -> every comparison is
-- NULL -> zero rows (fail closed).
CREATE OR REPLACE FUNCTION app_company_id() RETURNS bigint
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.company_id', true), '')::bigint $$;

-- ---------- Enable RLS (tenant-scoped tables) ----------

ALTER TABLE company            ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch             ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_location    ENABLE ROW LEVEL SECURITY;
ALTER TABLE captain            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle            ENABLE ROW LEVEL SECURITY;
ALTER TABLE route              ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stop         ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_pickup    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip               ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_employee      ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_event   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet             ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint          ENABLE ROW LEVEL SECURITY;
ALTER TABLE account            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens     ENABLE ROW LEVEL SECURITY;

-- ---------- Policies (USING = read + existing rows; WITH CHECK = DML) ----------

CREATE POLICY tenant_isolation_company ON company
  USING (id = app_company_id()) WITH CHECK (id = app_company_id());

CREATE POLICY tenant_isolation_branch ON branch
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

CREATE POLICY tenant_isolation_employee ON employee
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

CREATE POLICY tenant_isolation_pickup_location ON pickup_location
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

CREATE POLICY tenant_isolation_captain ON captain
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

CREATE POLICY tenant_isolation_vehicle ON vehicle
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

-- route has no direct company_id -> resolved through branch
CREATE POLICY tenant_isolation_route ON route
  USING (EXISTS (SELECT 1 FROM branch b
                 WHERE b.id = route.branch_id AND b.company_id = app_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM branch b
                      WHERE b.id = route.branch_id AND b.company_id = app_company_id()));

CREATE POLICY tenant_isolation_route_stop ON route_stop
  USING (EXISTS (SELECT 1 FROM route r
                 JOIN branch b ON b.id = r.branch_id
                 WHERE r.id = route_stop.route_id AND b.company_id = app_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM route r
                      JOIN branch b ON b.id = r.branch_id
                      WHERE r.id = route_stop.route_id AND b.company_id = app_company_id()));

CREATE POLICY tenant_isolation_employee_pickup ON employee_pickup
  USING (EXISTS (SELECT 1 FROM employee e
                 WHERE e.id = employee_pickup.employee_id AND e.company_id = app_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM employee e
                      WHERE e.id = employee_pickup.employee_id AND e.company_id = app_company_id()));

CREATE POLICY tenant_isolation_trip ON trip
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

CREATE POLICY tenant_isolation_trip_employee ON trip_employee
  USING (EXISTS (SELECT 1 FROM trip t
                 WHERE t.id = trip_employee.trip_id AND t.company_id = app_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM trip t
                      WHERE t.id = trip_employee.trip_id AND t.company_id = app_company_id()));

CREATE POLICY tenant_isolation_attendance ON attendance
  USING (EXISTS (SELECT 1 FROM trip t
                 WHERE t.id = attendance.trip_id AND t.company_id = app_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM trip t
                      WHERE t.id = attendance.trip_id AND t.company_id = app_company_id()));

CREATE POLICY tenant_isolation_attendance_event ON attendance_event
  USING (EXISTS (SELECT 1 FROM attendance a
                 JOIN trip t ON t.id = a.trip_id
                 WHERE a.id = attendance_event.attendance_id AND t.company_id = app_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM attendance a
                      JOIN trip t ON t.id = a.trip_id
                      WHERE a.id = attendance_event.attendance_id AND t.company_id = app_company_id()));

CREATE POLICY tenant_isolation_wallet ON wallet
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

CREATE POLICY tenant_isolation_wallet_transaction ON wallet_transaction
  USING (EXISTS (SELECT 1 FROM wallet w
                 WHERE w.id = wallet_transaction.wallet_id AND w.company_id = app_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM wallet w
                      WHERE w.id = wallet_transaction.wallet_id AND w.company_id = app_company_id()));

CREATE POLICY tenant_isolation_complaint ON complaint
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

-- account.company_id is nullable (Admin/Call Center) — tenant users only see
-- accounts of their own company; global roles stay hidden from tenants.
CREATE POLICY tenant_isolation_account ON account
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

CREATE POLICY tenant_isolation_notification ON notification
  USING (EXISTS (SELECT 1 FROM account a
                 WHERE a.id = notification.recipient_id AND a.company_id = app_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM account a
                      WHERE a.id = notification.recipient_id AND a.company_id = app_company_id()));

CREATE POLICY tenant_isolation_audit_log ON audit_log
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
  USING (EXISTS (SELECT 1 FROM account a
                 WHERE a.id = refresh_tokens.account_id AND a.company_id = app_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM account a
                      WHERE a.id = refresh_tokens.account_id AND a.company_id = app_company_id()));

-- ---------- Read-boundary views become SECURITY INVOKER ----------
-- Without this, a view owned by the (bypass) table owner would defeat RLS
-- for every caller that has SELECT on the view. With security_invoker the
-- underlying RLS applies to the CALLING role. The app (postgres) is
-- unaffected — it bypasses RLS and owns the tables directly.
ALTER VIEW active_employee SET (security_invoker = true);
ALTER VIEW active_captain  SET (security_invoker = true);
ALTER VIEW active_vehicle  SET (security_invoker = true);

-- ---------- Test role (NOLOGIN — used via SET ROLE only) ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'smartline_rls_test') THEN
    CREATE ROLE smartline_rls_test NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO smartline_rls_test;
GRANT SELECT ON company, branch, employee, pickup_location, captain, vehicle,
  route, route_stop, employee_pickup, trip, trip_employee, attendance,
  attendance_event, wallet, wallet_transaction, complaint, account,
  notification, audit_log, refresh_tokens TO smartline_rls_test;
GRANT SELECT ON active_employee, active_captain, active_vehicle TO smartline_rls_test;
