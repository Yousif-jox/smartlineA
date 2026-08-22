# Day 6 — Planning Sheet (محتوى للنسخ بخط يدك — بالإنجليزي)

**Name:** ____________ &nbsp;&nbsp; **Task:** Day 6 planning (76–90) &nbsp;&nbsp; **Date:** ____________

---

## 1) Attacker-perspective security flow (draw arrows, at least 2 endpoints)

```
Attacker (token of company A)
  -> GET /employees/{id}            (id belongs to B)      -> expect 404, got ?
  -> POST /trips  {routeId/vehicleId/captainId of B}       -> expect 404/422, got ?  <-- Day-6 gap found
  -> POST /complaints {employeeId of B}                    -> expect 404, got ?
  -> PATCH /complaints/{id} as call_center (tenant=null)   -> RBAC ok, execution ?  <-- Day-6 gap found
  -> POST /auth/login with duplicate name/phone            -> which account wins?   <-- nondeterministic
  -> raw SQL with '; DROP TABLE trips; --' in q filter     -> parameterized?        <-- verify
```

## 2) The 4-second query — hypothesis boxes

- Endpoint to add: `GET /employees/:id/trips` (manager dashboard, FR-016)
- Suspects: seq scan on 20M `trip`? missing covering index? ORDER BY sort? stale stats?
- Plan: EXPLAIN ANALYZE before -> add index -> after; no regression on existing indexes

## 3) Test strategy per layer (draw)

| Layer | What | Files |
|-------|------|-------|
| Unit (no DB) | capacity, state machines, attendance analyzer, parseId, auth negatives, RBAC escalation, file-upload guard, selectAccount | tests/unit/day6/* |
| Integration (real DB) | tenant isolation 4 resources, SQLi regression, wallet stress, RLS via SET ROLE | tests/integration/*, tests/database/*.sql |
| Security | RLS policies + FORCE + test role | migration 006 |

## 4) The two root-cause questions to answer on paper

1. Wallet duplicate: "where could a check-then-act race live, and why does the current FOR UPDATE + UNIQUE design make it impossible?" (Task 89)
2. Intermittent auth failure: "why is `SELECT ... UNION ... rows[0]` nondeterministic, and what makes the fix deterministic?" (Task 90)

## 5) Signoff evidence checklist (draw)

- [ ] Tenant isolation blocked at 4 resources (404)
- [ ] Slow point meets NFR (EXPLAIN numbers)
- [ ] No secrets in history/tree (audit doc)
- [ ] Both injected errors fixed with passing regression tests
