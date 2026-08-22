-- Rollback 005: soft deletes
DROP VIEW IF EXISTS active_vehicle;
DROP VIEW IF EXISTS active_captain;
DROP VIEW IF EXISTS active_employee;
DROP INDEX IF EXISTS uq_captain_phone_active;
DROP INDEX IF EXISTS uq_employee_phone_active;
ALTER TABLE employee ADD CONSTRAINT employee_phone_key UNIQUE (phone);
ALTER TABLE captain ADD CONSTRAINT captain_phone_key UNIQUE (phone);
ALTER TABLE vehicle DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE captain  DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE employee DROP COLUMN IF EXISTS deleted_at;
