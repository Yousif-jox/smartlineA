# Cross-Diagram Consistency Review

**Task:** Day 2 — Task 28
**Scope reviewed:** use-case diagram (20), use-case descriptions (21–22), sequence diagram (23), activity diagram (24), trip state machine (25), attendance state machine (26), NFR scenarios (27).

---

## Finding 1 — Priority contradiction: FR-016 (Should) vs NFR-002 (hard target) vs Task 23 architecture

**Contradiction:** FR-016 declares real-time status push a **Should** (could be dropped), while NFR-002 sets a hard **2-second** target and Task 23 commits an entire architectural chain (API → Redis Pub/Sub → WebSocket gateway) to it. A "Should" requirement does not justify a dedicated subsystem with a strict latency SLA.

**Resolution:** FR-016 is upgraded to **Must** — real-time status is in-scope item S5 and a core dashboard capability (Day 1 scope, Task 08). The sequence diagram, NFR-002, and FR-016 now agree on criticality.

**Impact:** SRS updated to v1.0 with FR-016 = Must (changelog entry). No other diagram changes.

## Finding 2 — Activity diagram (Task 24) is state-agnostic

**Contradiction:** The activity diagram jumps from "Scheduled trip loaded" straight into stop-by-stop execution and attendance recording, without referencing the trip states. A strict reader could conclude that attendance can be recorded while the trip is still in **Scheduled** — which Task 26/FR-010 forbid (boarding only exists on an operating trip), and Task 25 forbids (Scheduled → In Progress is illegal).

**Resolution:** Annotate the activity diagram semantics: the operational section (stops, attendance, decisions) corresponds to states **Started → In Progress**; the breakdown exit maps to **Started/In Progress → Failed**; the final step maps to **In Progress → Completed**. No state machine change needed — the activity diagram describes *what happens inside* the operational states, and the state machine guards *which states may be entered*.

## Finding 3 — Attendance freeze (Task 26) vs out-of-order ingestion (Task 13)

**Tension:** Task 26 says no new attendance events are accepted after the trip is Completed (frozen), but Task 13's algorithm resolves events by latest timestamp — a late event with an earlier timestamp could, in principle, contradict the freeze.

**Resolution:** two distinct layers, explicitly ordered: (1) the **acceptance boundary** (API/state layer) rejects any new event once the trip is Completed — state rule wins; (2) within accepted events, Task 13's latest-timestamp-wins + eventId tie-break applies. A late event arriving after completion is rejected by the boundary regardless of its timestamp. Documented in both state-machine and algorithm docs (no code change — the algorithm was always boundary-agnostic).

---

## Verification

- Re-checked Tasks 20–27 pairwise after the resolutions above: no remaining contradictions.
- The resolutions were applied to: SRS v1.0 (Finding 1), activity diagram annotations (Finding 2 — note added to `trip-execution.puml`), state-machine doc (Finding 3).
