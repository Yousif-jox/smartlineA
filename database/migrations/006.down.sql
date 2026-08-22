-- ============================================================
-- Smart Line — Day 6 — Migration 006 rollback
-- ============================================================

DROP POLICY IF EXISTS tenant_isolation_refresh_tokens ON refresh_tokens;
DROP POLICY IF EXISTS tenant_isolation_audit_log ON audit_log;
DROP POLICY IF EXISTS tenant_isolation_notification ON notification;
DROP POLICY IF EXISTS tenant_isolation_account ON account;
DROP POLICY IF EXISTS tenant_isolation_complaint ON complaint;
DROP POLICY IF EXISTS tenant_isolation_wallet_transaction ON wallet_transaction;
DROP POLICY IF EXISTS tenant_isolation_wallet ON wallet;
DROP POLICY IF EXISTS tenant_isolation_attendance_event ON attendance_event;
DROP POLICY IF EXISTS tenant_isolation_attendance ON attendance;
DROP POLICY IF EXISTS tenant_isolation_trip_employee ON trip_employee;
DROP POLICY IF EXISTS tenant_isolation_trip ON trip;
DROP POLICY IF EXISTS tenant_isolation_employee_pickup ON employee_pickup;
DROP POLICY IF EXISTS tenant_isolation_route_stop ON route_stop;
DROP POLICY IF EXISTS tenant_isolation_route ON route;
DROP POLICY IF EXISTS tenant_isolation_vehicle ON vehicle;
DROP POLICY IF EXISTS tenant_isolation_captain ON captain;
DROP POLICY IF EXISTS tenant_isolation_pickup_location ON pickup_location;
DROP POLICY IF EXISTS tenant_isolation_employee ON employee;
DROP POLICY IF EXISTS tenant_isolation_branch ON branch;
DROP POLICY IF EXISTS tenant_isolation_company ON company;

ALTER TABLE refresh_tokens     DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification       DISABLE ROW LEVEL SECURITY;
ALTER TABLE account            DISABLE ROW LEVEL SECURITY;
ALTER TABLE complaint          DISABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transaction DISABLE ROW LEVEL SECURITY;
ALTER TABLE wallet             DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_event   DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance         DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_employee      DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip               DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_pickup    DISABLE ROW LEVEL SECURITY;
ALTER TABLE route_stop         DISABLE ROW LEVEL SECURITY;
ALTER TABLE route              DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle            DISABLE ROW LEVEL SECURITY;
ALTER TABLE captain            DISABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_location    DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee           DISABLE ROW LEVEL SECURITY;
ALTER TABLE branch             DISABLE ROW LEVEL SECURITY;
ALTER TABLE company            DISABLE ROW LEVEL SECURITY;

ALTER VIEW active_employee RESET (security_invoker);
ALTER VIEW active_captain  RESET (security_invoker);
ALTER VIEW active_vehicle  RESET (security_invoker);

DROP ROLE IF EXISTS smartline_rls_test;

DROP FUNCTION IF EXISTS app_company_id();
