-- Rollback 003: exclusion constraints + extension
ALTER TABLE trip DROP CONSTRAINT IF EXISTS ex_vehicle_no_overlap;
ALTER TABLE trip DROP CONSTRAINT IF EXISTS ex_captain_no_overlap;
DROP EXTENSION IF EXISTS btree_gist;
