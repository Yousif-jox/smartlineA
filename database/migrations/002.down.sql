-- Rollback 002: indexes
DROP INDEX IF EXISTS idx_complaint_queue;
DROP INDEX IF EXISTS idx_attendance_events;
DROP INDEX IF EXISTS idx_vehicle_pool;
DROP INDEX IF EXISTS idx_employee_pickup_default;
DROP INDEX IF EXISTS idx_route_stop_ordered;
DROP INDEX IF EXISTS idx_wallet_tx_history;
DROP INDEX IF EXISTS idx_trip_employee_lookup;
DROP INDEX IF EXISTS idx_trip_vehicle_schedule;
DROP INDEX IF EXISTS idx_trip_company_date;
DROP INDEX IF EXISTS idx_trip_captain_schedule;
