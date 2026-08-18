-- ============================================================
-- Smart Line — Day 3, Task 37
-- Migration 002: indexing strategy
-- Every index below maps to a concrete query; purpose and
-- selectivity are documented in docs/database/indexing-strategy.md
-- ============================================================

-- Captain schedule: overlap detection (Task 10 / Task 38) and dispatch
CREATE INDEX idx_trip_captain_schedule
  ON trip (captain_id, trip_date, start_time, end_time);

-- Manager dashboard: "my company's trips for today" (NFR-003, FR-016)
CREATE INDEX idx_trip_company_date
  ON trip (company_id, trip_date);

-- Vehicle double-booking guard queries (FR-003)
CREATE INDEX idx_trip_vehicle_schedule
  ON trip (vehicle_id, trip_date, start_time, end_time);

-- Employee's trips + same-day overlap check (FR-007); complements PK
CREATE INDEX idx_trip_employee_lookup
  ON trip_employee (employee_id, trip_id);

-- Wallet history listing (NFR-003; wallet reads are O(1) via balance column)
CREATE INDEX idx_wallet_tx_history
  ON wallet_transaction (wallet_id, created_at DESC);

-- Route stop ordering (Task 12); PK covers (route_id, position)
CREATE INDEX idx_route_stop_ordered
  ON route_stop (route_id, position);

-- Pickup clustering (Task 11): partial index — only defaults are read
CREATE INDEX idx_employee_pickup_default
  ON employee_pickup (employee_id) WHERE is_default = 1;

-- Best-fit vehicle allocation (Task 43): company pool filtered by status
CREATE INDEX idx_vehicle_pool
  ON vehicle (company_id, status, capacity);

-- Attendance event resolution (Task 13): latest-event-wins reads
CREATE INDEX idx_attendance_events
  ON attendance_event (attendance_id, ts);

-- Call-center queue (FR-015): by company, open states, priority
CREATE INDEX idx_complaint_queue
  ON complaint (company_id, state, priority);
