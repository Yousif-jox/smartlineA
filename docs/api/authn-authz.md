# Authentication & Authorization — Smart Line

**Task:** Day 4 — Task 52
**Goal:** JWT authentication with refresh rotation, a full RBAC matrix (5 actors × 8+ actions), and the call-center cross-tenant exception reconciled without reopening the IDOR vulnerability (Task 53).

---

## Authentication

- **Access token:** JWT, short-lived (15 min), signed HS256 (secret from env — never in code; Day 5). Claims: `sub` (account id), `companyId` (nullable), `role`, `exp`.
- **Refresh token:** opaque, stored hashed in DB, 7-day expiry, **rotation on every use** (each refresh issues a new refresh token and invalidates the old — replay of a used token is rejected). `logout` revokes the current refresh token.
- **Passwords:** bcrypt/argon2 hashes (NFR-010); no plaintext anywhere; `credentials_hash` column already exists (Day 3 schema).
- **The tenant comes from the token, never from the URL or body** — this is the foundation of Task 53.

## RBAC matrix (5 actors × 10 actions)

| Action | Company Manager | Employee | Captain | Call Center Agent | Admin |
|---|---|---|---|---|---|
| Create/update trips | ✅ own company | — | — | — | — |
| Assign employees | ✅ own company | — | — | — | — |
| Update trip status | — | — | ✅ assigned trip | — | — |
| Record attendance | — | — | ✅ assigned trip | — | — |
| View trips/attendance | ✅ own company | ✅ own assignments | ✅ assigned | ✅ verified lookup | ✅ |
| View wallet | ✅ own company | — | — | ❌ (never financial) | ✅ |
| Handle complaints | ✅ escalated to them | — | — | ✅ all (audited) | ✅ |
| Escalate complaints | — | — | — | ✅ | — |
| Manage company data (branches/routes/vehicles) | ✅ own company | — | — | — | — |
| Manage users & roles | — | — | — | — | ✅ |

## Call Center cross-tenant exception (reconciled)

The agent's cross-company access (Day 2 answer) is narrowed to three rules:

1. **Verified-key lookup only** — `GET /complaints?phone=...` or national-ID lookup resolves to exactly the relevant records; there is **no list/browse endpoint across tenants** (no enumeration).
2. **Read-only + field-minimized** — never financial data; complaint + identity fields only.
3. **Fully audited** — every cross-tenant read writes an audit_log row (who/when/what/why) visible to the tenant admin.

**Implementation boundary:** this is enforced by the **same tenant middleware** (Task 53) with a documented role-override for the `call_center` role — not by per-endpoint ad-hoc checks. If the override is missing, the request falls back to tenant-scoped behavior (deny).

## Edge cases

- **Multi-role user** (Employee + Manager): capability is resolved per **role used** at request time; the token carries the role of the acting session.
- **Deactivated account / soft-deleted employee (Task 41):** token validation checks account status; attendance views of soft-deleted employees remain readable via views (history).
- **Expired access + valid refresh:** 401 on API → client refreshes silently → retry once; refresh rotation means stolen-token replay is detected.
