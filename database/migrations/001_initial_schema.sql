-- ============================================================
-- Smart Line — Day 3, Task 35
-- Migration 001: initial schema (19 tables)
-- PostgreSQL 16+
-- Rules applied:
--   * company_id NOT NULL on every tenant-scoped table (Task 36)
--   * explicit ON DELETE on every FK (no defaults left implicit)
--   * CHECK constraints: trip state (Task 25), attendance state (Task 26),
--     wallet balance >= 0 (A8), vehicle capacity >= 0
--   * UNIQUE: wallet 1:1 per company, idempotency key per wallet (Task 39),
--     event_id dedup (Task 13/FR-017)
-- ============================================================

-- ---------- Core tenant chain ----------

CREATE TABLE company (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'suspended', 'deactivated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE branch (
  id         BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES company(id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  address    TEXT
);

CREATE TABLE employee (
  id         BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES company(id) ON DELETE RESTRICT,
  branch_id  BIGINT REFERENCES branch(id) ON DELETE SET NULL,  -- A1: branch optional
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'inactive', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pickup_location (
  id         BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES company(id) ON DELETE CASCADE,  -- A3: company-scoped
  name       TEXT NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  address    TEXT
);

CREATE TABLE employee_pickup (
  employee_id        BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  pickup_location_id BIGINT NOT NULL REFERENCES pickup_location(id) ON DELETE CASCADE,
  is_default         INT NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),  -- A2: one default
  PRIMARY KEY (employee_id, pickup_location_id)
);

-- Exactly one default pickup per employee (partial unique index)
CREATE UNIQUE INDEX uq_employee_default_pickup
  ON employee_pickup (employee_id) WHERE is_default = 1;

CREATE TABLE captain (
  id         BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES company(id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'inactive', 'deleted'))
);

CREATE TABLE vehicle (
  id         BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES company(id) ON DELETE RESTRICT,  -- A9: company fleet
  capacity   INT NOT NULL CHECK (capacity >= 0),                         -- FR-006
  status     TEXT NOT NULL DEFAULT 'available'
             CHECK (status IN ('available', 'unavailable')),             -- FR-003 / O3
  plate      TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL DEFAULT 'minibus'                             -- V2 minimum set
);

CREATE TABLE route (
  id        BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branch(id) ON DELETE RESTRICT,    -- BR-1
  name      TEXT NOT NULL
);

CREATE TABLE route_stop (
  id                BIGSERIAL PRIMARY KEY,
  route_id          BIGINT NOT NULL REFERENCES route(id) ON DELETE CASCADE,
  pickup_location_id BIGINT NOT NULL REFERENCES pickup_location(id) ON DELETE RESTRICT,
  position          INT NOT NULL CHECK (position >= 0),
  UNIQUE (route_id, position)                                           -- Task 12 ordering
);

-- ---------- Execution chain ----------

CREATE TABLE trip (
  id             BIGSERIAL PRIMARY KEY,
  company_id     BIGINT NOT NULL REFERENCES company(id) ON DELETE RESTRICT,  -- direct tenant column
  route_id       BIGINT NOT NULL REFERENCES route(id) ON DELETE RESTRICT,
  vehicle_id     BIGINT NOT NULL REFERENCES vehicle(id) ON DELETE RESTRICT,  -- A5: one vehicle per trip
  captain_id     BIGINT NOT NULL REFERENCES captain(id) ON DELETE RESTRICT,
  trip_date      DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  state          TEXT NOT NULL DEFAULT 'Scheduled'
                 CHECK (state IN ('Scheduled', 'Assigned', 'Started',
                                  'In Progress', 'Completed', 'Cancelled', 'Failed')),  -- Task 25
  stops_snapshot JSONB NOT NULL,  -- immutable executed stops (Day 2 finding 2)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trip_employee (
  trip_id     BIGINT NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at  TIMESTAMPTZ,                                                -- FR-008: removal, not delete
  PRIMARY KEY (trip_id, employee_id)                                     -- FR-009: assignment source of truth
);

CREATE TABLE attendance (
  id         BIGSERIAL PRIMARY KEY,
  trip_id    BIGINT NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  state      TEXT NOT NULL DEFAULT 'Unknown'
             CHECK (state IN ('Unknown', 'Boarded', 'Not Boarded', 'Absent', 'Cancelled')),  -- Task 26
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, employee_id)                                          -- one final record per employee per trip
);

CREATE TABLE attendance_event (
  id            BIGSERIAL PRIMARY KEY,
  attendance_id BIGINT NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  event_id      TEXT NOT NULL UNIQUE,                                    -- idempotency (Task 13)
  state         TEXT NOT NULL CHECK (state IN ('Boarded', 'Not Boarded', 'Absent')),
  ts            TIMESTAMPTZ NOT NULL,
  recorded_by   BIGINT REFERENCES captain(id) ON DELETE SET NULL         -- A6: captain is the writer
);

-- ---------- Financial chain ----------

CREATE TABLE wallet (
  id         BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL UNIQUE REFERENCES company(id) ON DELETE RESTRICT,  -- A7: 1:1 per company
  balance    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),            -- A8: never negative
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wallet_transaction (
  id              BIGSERIAL PRIMARY KEY,
  wallet_id       BIGINT NOT NULL REFERENCES wallet(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,                                             -- Task 39
  amount          NUMERIC(12, 2) NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('charge', 'refund')),
  trip_id         BIGINT REFERENCES trip(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('completed', 'pending', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, idempotency_key)                                       -- exactly-once per wallet (Task 39)
);

-- ---------- Support chain ----------

CREATE TABLE account (
  id               BIGSERIAL PRIMARY KEY,
  company_id       BIGINT REFERENCES company(id) ON DELETE SET NULL,  -- nullable: Admin / Call Center (Task 52)
  role             TEXT NOT NULL CHECK (role IN ('company_manager', 'employee',
                                                 'captain', 'call_center', 'admin')),
  name             TEXT NOT NULL,
  credentials_hash TEXT NOT NULL
);

CREATE TABLE complaint (
  id                BIGSERIAL PRIMARY KEY,
  company_id        BIGINT NOT NULL REFERENCES company(id) ON DELETE RESTRICT,
  employee_id       BIGINT NOT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  category          TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  state             TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (state IN ('submitted', 'assigned', 'escalated', 'resolved')),  -- Task 22
  assigned_agent_id BIGINT REFERENCES account(id) ON DELETE SET NULL,
  resolution        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification (
  id          BIGSERIAL PRIMARY KEY,
  recipient_id BIGINT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'sent', 'failed')),
  event_id    TEXT NOT NULL UNIQUE,                                    -- FR-017 dedup
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES company(id) ON DELETE RESTRICT,
  actor_id   BIGINT REFERENCES account(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  BIGINT,
  old_value  JSONB,
  new_value  JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Performance indexes are in migration 002 (Task 37).
-- ============================================================
