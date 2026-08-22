-- ============================================================
-- Smart Line — Day 3, Task 44
-- Seed 001: sample data for local development and tests
-- Idempotent: safe to re-run — every insert uses fixed IDs with
-- ON CONFLICT DO NOTHING, and sequences are synced at the end.
-- Coverage: 3 companies, 5 branches, 50 employees, 5 captains,
-- 5 vehicles, 3 routes, a week of trips with ALL states
-- (Scheduled/Assigned/Started/In Progress/Completed/Cancelled/Failed),
-- attendance + events, wallet + idempotent charges, complaints,
-- accounts (RBAC roles).
-- ============================================================

BEGIN;

-- ---------- Companies ----------
INSERT INTO company (id, name, status) VALUES
  (1, 'Acme Manufacturing', 'active'),
  (2, 'Beta Logistics',     'active'),
  (3, 'Gamma Foods',        'active')
ON CONFLICT (id) DO NOTHING;

-- ---------- Branches (5) ----------
INSERT INTO branch (id, company_id, name, address) VALUES
  (1, 1, 'Factory A', 'Industrial Zone 1'),
  (2, 1, 'Factory B', 'Industrial Zone 2'),
  (3, 2, 'Warehouse North', 'Port Road'),
  (4, 2, 'Warehouse South', 'Ring Road'),
  (5, 3, 'Main Plant', 'Food District')
ON CONFLICT (id) DO NOTHING;

-- ---------- Employees (50) ----------
-- e1–e25 company 1 (e25 intentionally WITHOUT branch — edge case A1),
-- e26–e40 company 2, e41–e50 company 3
INSERT INTO employee (id, company_id, branch_id, name, phone, status)
SELECT gs,
       CASE WHEN gs <= 25 THEN 1 WHEN gs <= 40 THEN 2 ELSE 3 END,
       CASE WHEN gs = 25 THEN NULL
            WHEN gs <= 20 THEN 1
            WHEN gs <= 25 THEN 2
            WHEN gs <= 33 THEN 3
            WHEN gs <= 40 THEN 4
            ELSE 5 END,
       'Employee ' || gs,
       '010' || lpad(gs::text, 7, '0'),
       'active'
FROM generate_series(1, 50) AS gs
ON CONFLICT (id) DO NOTHING;

-- ---------- Pickup locations (6) ----------
INSERT INTO pickup_location (id, company_id, name, lat, lng) VALUES
  (1, 1, 'Gate A', 30.05, 31.20),
  (2, 1, 'Gate B', 30.06, 31.21),
  (3, 2, 'Site 1 Gate', 30.10, 31.10),
  (4, 2, 'Site 2 Gate', 30.11, 31.11),
  (5, 3, 'Main Gate', 30.20, 31.30),
  (6, 3, 'North Gate', 30.21, 31.31)
ON CONFLICT (id) DO NOTHING;

-- Default pickup per employee (partial unique index enforces one default)
INSERT INTO employee_pickup (employee_id, pickup_location_id, is_default)
SELECT gs,
       CASE WHEN gs <= 10 THEN 1 WHEN gs <= 20 THEN 2 WHEN gs <= 25 THEN 1
            WHEN gs <= 33 THEN 3 WHEN gs <= 40 THEN 4 ELSE 5 END,
       1
FROM generate_series(1, 50) AS gs
ON CONFLICT (employee_id, pickup_location_id) DO NOTHING;
-- one non-default example (employee 1 also listed at Gate B, not default)
INSERT INTO employee_pickup (employee_id, pickup_location_id, is_default)
VALUES (1, 2, 0)
ON CONFLICT (employee_id, pickup_location_id) DO NOTHING;

-- ---------- Captains (5) ----------
INSERT INTO captain (id, company_id, name, phone, status) VALUES
  (1, 1, 'Captain Karim',   '0111000001', 'active'),
  (2, 1, 'Captain Sara',    '0111000002', 'active'),
  (3, 2, 'Captain Omar',    '0111000003', 'active'),
  (4, 2, 'Captain Mona',    '0111000004', 'active'),
  (5, 3, 'Captain Tarek',   '0111000005', 'active')
ON CONFLICT (id) DO NOTHING;

-- ---------- Vehicles (5) — v5 intentionally unavailable (edge FR-003) ----------
INSERT INTO vehicle (id, company_id, capacity, status, plate, type) VALUES
  (1, 1, 20, 'available',   'ABC-101', 'minibus'),
  (2, 1, 12, 'available',   'ABC-102', 'van'),
  (3, 2, 24, 'available',   'DEF-201', 'minibus'),
  (4, 2, 8,  'available',   'DEF-202', 'van'),
  (5, 3, 30, 'unavailable', 'GHI-301', 'bus')   -- under maintenance (O3 edge)
ON CONFLICT (id) DO NOTHING;

-- ---------- Routes + stops ----------
INSERT INTO route (id, branch_id, name) VALUES
  (1, 1, 'Factory A Morning Line'),
  (2, 3, 'Warehouse North Line'),
  (3, 5, 'Main Plant Line')
ON CONFLICT (id) DO NOTHING;

INSERT INTO route_stop (id, route_id, pickup_location_id, position) VALUES
  (1, 1, 1, 0), (2, 1, 2, 1),
  (3, 2, 3, 0), (4, 2, 4, 1),
  (5, 3, 5, 0), (6, 3, 6, 1)
ON CONFLICT (id) DO NOTHING;

-- ---------- Accounts (RBAC roles; credentials are placeholders — Day 5) ----------
INSERT INTO account (id, company_id, role, name, credentials_hash) VALUES
  (1, 1, 'company_manager', 'Acme Admin',    'hash-placeholder'),
  (2, 2, 'company_manager', 'Beta Admin',    'hash-placeholder'),
  (3, 3, 'company_manager', 'Gamma Admin',   'hash-placeholder'),
  (4, NULL, 'call_center',  'Call Center 1', 'hash-placeholder'),
  (5, NULL, 'admin',        'Platform Admin','hash-placeholder')
ON CONFLICT (id) DO NOTHING;

-- ---------- Wallets (1:1 per company) ----------
-- w1 = 10000 initial − 3000 (t1) − 2400 (t2) − 3000 (t9) = 1600
INSERT INTO wallet (id, company_id, balance) VALUES
  (1, 1, 1600.00),
  (2, 2, 5000.00),
  (3, 3, 2000.00)
ON CONFLICT (id) DO NOTHING;

-- ---------- Trips (a week, ALL states) ----------
INSERT INTO trip (id, company_id, route_id, vehicle_id, captain_id,
                  trip_date, start_time, end_time, state, stops_snapshot)
VALUES
  (1,  1, 1, 1, 1, '2026-08-17', '07:00', '08:30', 'Completed',   '[{"pickup_location_id":1,"position":0},{"pickup_location_id":2,"position":1}]'),
  (2,  1, 1, 2, 2, '2026-08-17', '07:00', '08:30', 'Completed',   '[{"pickup_location_id":1,"position":0},{"pickup_location_id":2,"position":1}]'),
  (3,  2, 2, 3, 3, '2026-08-18', '07:00', '08:30', 'Cancelled',   '[{"pickup_location_id":3,"position":0},{"pickup_location_id":4,"position":1}]'),
  (4,  3, 3, 4, 4, '2026-08-18', '09:00', '10:30', 'Assigned',    '[{"pickup_location_id":5,"position":0},{"pickup_location_id":6,"position":1}]'),
  (5,  1, 1, 1, 1, '2026-08-19', '07:00', '08:30', 'Started',     '[{"pickup_location_id":1,"position":0},{"pickup_location_id":2,"position":1}]'),
  (6,  2, 2, 3, 3, '2026-08-19', '07:00', '08:30', 'In Progress', '[{"pickup_location_id":3,"position":0},{"pickup_location_id":4,"position":1}]'),
  (7,  2, 2, 4, 4, '2026-08-20', '07:00', '08:30', 'Failed',      '[{"pickup_location_id":3,"position":0},{"pickup_location_id":4,"position":1}]'),
  (8,  1, 1, 2, 2, '2026-08-21', '07:00', '08:30', 'Scheduled',   '[{"pickup_location_id":1,"position":0},{"pickup_location_id":2,"position":1}]'),
  (9,  1, 1, 1, 1, '2026-08-21', '07:00', '08:30', 'Completed',   '[{"pickup_location_id":1,"position":0},{"pickup_location_id":2,"position":1}]'),
  (10, 3, 3, 4, 4, '2026-08-21', '16:00', '17:30', 'Cancelled',   '[{"pickup_location_id":5,"position":0},{"pickup_location_id":6,"position":1}]')
ON CONFLICT (id) DO NOTHING;

-- ---------- Assignments (trip_employee) ----------
INSERT INTO trip_employee (trip_id, employee_id)
SELECT 1, gs FROM generate_series(1, 15) AS gs
ON CONFLICT (trip_id, employee_id) DO NOTHING;   -- t1: 15 employees (cap 20)
INSERT INTO trip_employee (trip_id, employee_id)
SELECT 2, gs FROM generate_series(16, 25) AS gs
ON CONFLICT (trip_id, employee_id) DO NOTHING;   -- t2: 10 employees (cap 12)
INSERT INTO trip_employee (trip_id, employee_id)
SELECT 4, gs FROM generate_series(41, 45) AS gs
ON CONFLICT (trip_id, employee_id) DO NOTHING;   -- t4: 5 employees
INSERT INTO trip_employee (trip_id, employee_id)
SELECT 5, gs FROM generate_series(1, 15) AS gs
ON CONFLICT (trip_id, employee_id) DO NOTHING;   -- t5: 15 employees
INSERT INTO trip_employee (trip_id, employee_id)
SELECT 6, gs FROM generate_series(26, 30) AS gs
ON CONFLICT (trip_id, employee_id) DO NOTHING;   -- t6: 5 employees
INSERT INTO trip_employee (trip_id, employee_id)
SELECT 9, gs FROM generate_series(1, 15) AS gs
ON CONFLICT (trip_id, employee_id) DO NOTHING;   -- t9: 15 employees

-- ---------- Attendance (t1 mixed states incl. Unknown; t2 all Boarded) ----------
INSERT INTO attendance (id, trip_id, employee_id, state)
SELECT gs, 1, gs,
       CASE WHEN gs <= 12 THEN 'Boarded'
            WHEN gs = 13 THEN 'Absent'
            WHEN gs = 14 THEN 'Not Boarded'
            ELSE 'Unknown' END
FROM generate_series(1, 15) AS gs
ON CONFLICT (id) DO NOTHING;

INSERT INTO attendance (id, trip_id, employee_id, state)
SELECT gs + 100, 2, gs, 'Boarded'
FROM generate_series(16, 25) AS gs
ON CONFLICT (id) DO NOTHING;

-- ---------- Attendance events (idempotent, unique event_id) ----------
INSERT INTO attendance_event (id, attendance_id, event_id, state, ts, recorded_by)
SELECT gs, gs, 'evt-t1-e' || gs, 'Boarded', '2026-08-17 07:20:00+00', 1
FROM generate_series(1, 12) AS gs
ON CONFLICT (id) DO NOTHING;

-- ---------- Wallet transactions (idempotency keys — Task 39) ----------
INSERT INTO wallet_transaction (id, wallet_id, idempotency_key, amount, type, trip_id, status)
VALUES
  (1, 1, 'charge-t1', 3000.00, 'charge', 1, 'completed'),
  (2, 1, 'charge-t2', 2400.00, 'charge', 2, 'completed'),
  (3, 1, 'charge-t9', 3000.00, 'charge', 9, 'completed')
ON CONFLICT (id) DO NOTHING;

-- ---------- Complaints (submitted→assigned / resolved) ----------
INSERT INTO complaint (id, company_id, employee_id, category, priority, state, assigned_agent_id, resolution)
VALUES
  (1, 1, 1,  'Late pickup',      'high',   'assigned', 4, NULL),
  (2, 2, 26, 'Vehicle condition', 'normal', 'resolved', 4, 'Reassigned vehicle the next day')
ON CONFLICT (id) DO NOTHING;

-- ---------- Notifications (dedup by event_id — FR-017) ----------
INSERT INTO notification (id, recipient_id, type, payload, status, event_id)
VALUES
  (1, 1, 'trip_cancelled',     '{"trip_id":3}',     'sent',   'ntf-1'),
  (2, 4, 'complaint_assigned', '{"complaint_id":1}', 'pending', 'ntf-2')
ON CONFLICT (id) DO NOTHING;

-- ---------- Sequence sync (idempotency: re-runs never collide) ----------
SELECT setval(pg_get_serial_sequence('company', 'id'),            (SELECT MAX(id) FROM company));
SELECT setval(pg_get_serial_sequence('branch', 'id'),             (SELECT MAX(id) FROM branch));
SELECT setval(pg_get_serial_sequence('employee', 'id'),           (SELECT MAX(id) FROM employee));
SELECT setval(pg_get_serial_sequence('pickup_location', 'id'),    (SELECT MAX(id) FROM pickup_location));
SELECT setval(pg_get_serial_sequence('captain', 'id'),            (SELECT MAX(id) FROM captain));
SELECT setval(pg_get_serial_sequence('vehicle', 'id'),            (SELECT MAX(id) FROM vehicle));
SELECT setval(pg_get_serial_sequence('route', 'id'),              (SELECT MAX(id) FROM route));
SELECT setval(pg_get_serial_sequence('route_stop', 'id'),         (SELECT MAX(id) FROM route_stop));
SELECT setval(pg_get_serial_sequence('account', 'id'),            (SELECT MAX(id) FROM account));
SELECT setval(pg_get_serial_sequence('wallet', 'id'),             (SELECT MAX(id) FROM wallet));
SELECT setval(pg_get_serial_sequence('trip', 'id'),               (SELECT MAX(id) FROM trip));
SELECT setval(pg_get_serial_sequence('attendance', 'id'),         (SELECT MAX(id) FROM attendance));
SELECT setval(pg_get_serial_sequence('attendance_event', 'id'),   (SELECT MAX(id) FROM attendance_event));
SELECT setval(pg_get_serial_sequence('wallet_transaction', 'id'), (SELECT MAX(id) FROM wallet_transaction));
SELECT setval(pg_get_serial_sequence('complaint', 'id'),          (SELECT MAX(id) FROM complaint));
SELECT setval(pg_get_serial_sequence('notification', 'id'),       (SELECT MAX(id) FROM notification));

COMMIT;
