# API Resources & Versioning — Smart Line

**Task:** Day 4 — Task 50
**Rule:** resources nested only where ownership is a real hierarchy; everything else is top-level with filters. Tenant scope NEVER comes from the URL — it comes from the authenticated principal (Task 53).

---

## Versioning

**Decision: URL path versioning** — `/api/v1/...`.

Why over header negotiation: explicit and debuggable (mobile clients, proxies, cache keys all see it); a stale client sends v1 and gets the old contract; headers are easy to get wrong and invisible in URLs/links. Version bumps are additive-first; breaking changes cut a new major (Day 7 compatibility task 93 relies on this).

## Resource map

| Resource | Path | Nesting rationale |
|---|---|---|
| Companies | `GET/PATCH /companies/{id}` | top-level (tenant root) |
| Branches | `GET /companies/{companyId}/branches` · `POST ...` | **nested** — a branch belongs to a company (real hierarchy, BR-1) |
| Employees | `GET/POST /employees` · `GET/PATCH /employees/{id}` | top-level (addressed directly; company scoping via token) |
| Captains | `GET/POST /captains` · `GET /captains/{id}` | top-level |
| Vehicles | `GET/POST /vehicles` · `GET /vehicles/{id}` | top-level (A9: company pool — no branch in path) |
| Routes | `GET/POST /routes` · `GET /routes/{id}` | top-level (tied to branch by `branchId` filter/field, not path) |
| Trips | `GET/POST /trips` · `GET /trips/{id}` | top-level — a trip has route+vehicle+captain; no single parent |
| Trip status | `PATCH /trips/{id}/status` | sub-resource of trip (state machine, Task 25) |
| Assignments | `GET/POST /trips/{id}/assignments` · `DELETE /trips/{id}/assignments/{employeeId}` | **nested** — assignment belongs to the trip (FR-009) |
| Attendance | `GET /trips/{id}/attendance` · `POST /trips/{id}/attendance/events` | **nested** — attendance is per trip |
| Wallets | `GET /wallets/{id}` | top-level |
| Wallet transactions | `POST /wallets/{id}/transactions` | **nested** — the ledger belongs to the wallet (Task 39) |
| Complaints | `GET/POST /complaints` · `GET /complaints/{id}` | top-level — **no company in path**: the call center handles cross-company by design (Task 52/53 exception) |

## Key decisions

- **No `/companies/{id}/trips`** — a trip query already filters by the token's tenant; duplicating the company in the path invites tenant confusion (whose company? the URL's or the token's?) and is exactly the IDOR seed (Task 53).
- **No `/trips/{id}/vehicle` sub-resources** — vehicle/captain are references (IDs in the trip payload), not owned children.
- **Complaints deliberately path-agnostic to tenant** — the call-center role legitimately works across companies; company resolution happens in the service via the verified-key lookup (Task 52), never in the URL.

## Consistency

- Nested collections use cursor pagination (Task 42/51).
- `PATCH /trips/{id}/status` returns 409 on illegal transitions (Task 25/51).
- Wallet transactions require `Idempotency-Key` (Task 39/58).
