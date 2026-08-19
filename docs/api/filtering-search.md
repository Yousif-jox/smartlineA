# Filtering & Search — Smart Line

**Task:** Day 4 — Task 56
**Rule:** filters are combinable (AND), each maps to a Day 3 index, and no combination is allowed to degenerate into a full scan of 20M rows.

---

## Allowed filters per endpoint (whitelist — no arbitrary columns)

| Endpoint | Filter params | Index (Day 3) |
|---|---|---|
| `GET /trips` | `date` (range), `state`, `captainId`, `vehicleId`, `routeId` | `idx_trip_company_date`, `idx_trip_captain_schedule`, `idx_trip_vehicle_schedule` |
| `GET /employees` | `branchId`, `status`, `q` (name/phone search) | `idx_employee_branch`, partial phone index |
| `GET /complaints` | `state`, `priority`, `category` | `idx_complaint_queue` |

- Unknown or mistyped params → **422** (whitelist is the contract).
- All filters AND together; combination is validated before execution (cheap, at the controller boundary).

## Mapping & cost rules

1. **Single-filter queries** map to an index directly (e.g., `date` → `idx_trip_company_date`). Cost: O(log n) seek + bounded scan.
2. **Multiple filters with a covering index** — e.g., `state` + `date` → the planner uses `idx_trip_company_date` and filters state in the scan (state is low-cardinality; an index on it alone would be useless — documented in Day 3 strategy).
3. **A combination with NO supporting index** — e.g., `captainId` + `vehicleId` at once: accepted, but bounded:
   - the planner picks the best partial index and filters the rest in-scan;
   - a `LIMIT` is mandatory (pagination cursor, Task 42);
   - **a seq scan of the full table is rejected by construction**: the query template always includes `company_id` (tenant, Task 53) + date range when the planner would otherwise go sequential — the Day 6 benchmark (Task 86) asserts no seq scan at 20M rows.
4. **Search (`q`):** prefix search on `phone` (index-backed); name search via `ILIKE` with a trigram GIN index (`pg_trgm`) — noted as an optional Day 6 index if the benchmark needs it.

## Edge cases

- **Filter + cursor:** filters must be part of the cursor contract (the cursor encodes the last row of the *filtered* result — Task 42 semantics), otherwise pages shift between requests.
- **Empty result** is a normal 200 with `data: []` — never 404 (a filter isn't a lookup).
- **Cross-tenant filter attempt** (`companyId` param on trips): rejected/ignored — tenant comes from the token (Task 53); the whitelist doesn't include tenant params for tenant-scoped endpoints (except complaints for agent/admin roles, Task 52).
