-- ============================================================
-- Smart Line — Day 5, Task 65: soft deletes (Task 41 implemented)
-- Adds deleted_at, converts full phone UNIQUE to partial UNIQUE
-- (phone reuse after soft delete), and creates the active_* views
-- that repositories read through (default exclusion).
-- ============================================================

ALTER TABLE employee ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE captain  ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE vehicle  ADD COLUMN deleted_at TIMESTAMPTZ;

-- phone reuse after soft delete (Task 41 edge case)
ALTER TABLE employee DROP CONSTRAINT IF EXISTS employee_phone_key;
CREATE UNIQUE INDEX uq_employee_phone_active ON employee (phone) WHERE deleted_at IS NULL;
ALTER TABLE captain DROP CONSTRAINT IF EXISTS captain_phone_key;
CREATE UNIQUE INDEX uq_captain_phone_active  ON captain (phone) WHERE deleted_at IS NULL;

-- read boundary views (Task 41): repositories never repeat deleted_at filters
CREATE OR REPLACE VIEW active_employee AS SELECT * FROM employee WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_captain  AS SELECT * FROM captain  WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_vehicle  AS SELECT * FROM vehicle  WHERE deleted_at IS NULL;
