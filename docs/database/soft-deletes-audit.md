# Soft Deletes & Audit Log — Smart Line

**Task:** Day 3 — Task 41
**Goal:** delete nothing that history references; know exactly who changed what and when — without breaking FK integrity for historical trips.

---

## The soft-delete pattern

`employee`, `captain`, `vehicle` carry `deleted_at TIMESTAMPTZ NULL` (in addition to `status`):

- `deleted_at IS NULL` → active.
- `deleted_at IS NOT NULL` → soft-deleted; the **row stays**, so historical trips keep their FKs intact (FK `ON DELETE RESTRICT` never fires — nothing is actually deleted).
- `status` (active/inactive/deleted) drives *operational* availability (dispatch, assignment); `deleted_at` drives *referential* truth (history). Two orthogonal dimensions, deliberately.

## Why FK integrity is preserved

- A soft-deleted employee/captain/vehicle is still a valid row → `trip.captain_id` and `trip_employee.employee_id` keep resolving. Historical data renders correctly (names, plates) forever.
- Hard deletes are reserved for data-entry errors, and only via Admin + audit.

## Default exclusion without `WHERE deleted_at IS NULL` everywhere

PostgreSQL **views** as the read boundary (one place, not every query):

```sql
CREATE VIEW active_employee AS
  SELECT * FROM employee WHERE deleted_at IS NULL;

-- application reads through active_employee; write path stays on the table
```

- **Why views:** one definition, indexed (deleted_at partial index below), and the Day 5 repositories can bind to the view without repeating the predicate.
- **Production alternative:** an RLS policy (`USING (deleted_at IS NULL)`) achieves the same default exclusion at the DB layer — noted as the Day 4 hardening (Task 52/53), the view is the Day 3 structural choice.

## The audit trail

`audit_log` (schema, migration 001) records `actor_id, action, entity, entity_id, old_value, new_value, created_at, company_id`.

**Enforcement via DB triggers** (not application logging — a missed log call is a silent gap):

```sql
CREATE OR REPLACE FUNCTION audit_employee() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log (company_id, actor_id, action, entity, entity_id, old_value, new_value)
  VALUES (NEW.company_id, current_setting('app.actor_id')::bigint,
          TG_OP, 'employee', COALESCE(NEW.id, OLD.id),
          CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(OLD) END,
          to_jsonb(NEW));
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_employee
  AFTER INSERT OR UPDATE OR DELETE ON employee
  FOR EACH ROW EXECUTE FUNCTION audit_employee();
```

The same trigger pattern covers `captain`, `vehicle`, and — critically — `wallet_transaction` (financial trail: any charge/refund is audited even if the application crashes after commit).

## Edge cases

- **Re-activation:** setting `deleted_at = NULL` again is allowed and itself audited (the trigger fires on UPDATE).
- **Phone reuse after soft delete:** the `UNIQUE(phone)` constraint would block rehiring a phone → **partial unique index** instead:
  ```sql
  CREATE UNIQUE INDEX uq_employee_phone_active ON employee (phone) WHERE deleted_at IS NULL;
  ```
- **Audit growth:** audit_log is append-only, indexed by `(company_id, entity, entity_id)`, and retained independently of trip archival (Task 40).
