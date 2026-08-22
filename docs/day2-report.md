# Day 2 — Daily Report

## 1) What did I complete?

- **SRS (Tasks 16–19):** full IEEE-style skeleton, scope restated from the Day 1 baseline (no scope expansion), 19 numbered FRs (FR-001–FR-019) with priorities and acceptance criteria, 14 NFRs (NFR-001–NFR-014) across 5 categories with Day-6 verification mapping, explicit FR dependency references, inline NFR conflict reconciliation, and a 100% traceability matrix (12/12 FRs, 12/12 NFRs, 8/8 business rules, 8/8 assumptions).
- **Use Case modeling (Tasks 20–23):** use-case diagram with 15 use cases (include/extend, shared use case without duplication), two full use-case descriptions (trip assignment, complaint lifecycle) with alternate and exception flows, and the real-time sequence diagram with a WebSocket-disconnected failure branch and multi-instance acknowledgement.
- **Activity & state modeling (Tasks 24–27):** activity diagram with three decision points, the Trip state machine (7 states, 9 legal + explicit illegal transitions, 3 documented decisions), the Attendance state machine (5 states, decoupled per BR-8), and two NFR scenario walkthroughs (2-second dashboard budget, Redis outage drill).
- **Consolidation (Tasks 28–30):** cross-diagram consistency review (3 real findings, all resolved), SRS signed off at v1.0, handwritten diagram index, and this report.
- **Practical challenge:** driver scheduling conflict model — a 5-rule validation table with reason codes (design only).

## 2) What did I fail to complete?

- Nothing content-wise. Delivery actions pending on my side: the handwritten photos (planning sheet, use-case, sequence, activity) and the final Git push for Day 2 (`feature/day-2-srs-uml`) — the files are ready, the repo upload was not yet executed.

## 3) What problems did I face?

- The consistency review surfaced **three real contradictions** in my own Day-2 work: FR-016's "Should" priority contradicted the hard 2-second NFR and the dedicated real-time architecture (upgraded to Must); the activity diagram was state-agnostic and could be misread as allowing attendance in Scheduled (annotated); and the attendance freeze conflicted on the surface with out-of-order event ingestion (resolved by separating the acceptance boundary from the event-resolution layer).
- The UML renderer (plantuml.com) was unreachable from my environment; I switched to an alternate renderer and verified all diagrams render correctly.

## 4) What decisions did I make?

- **Trip state machine:** rescheduling is a new trip (Cancelled → Scheduled is illegal); a Failed trip cannot be reopened; mid-route cancellation is legal with defined attendance effects; Started is deliberately short-lived.
- **Attendance state machine:** Unknown as the initial state (no data ≠ Absent); recorded states preserved under trip cancellation (BR-8); only unrecorded employees finalize to Cancelled; records freeze after trip completion.
- **SRS:** FR-016 upgraded to Must (Finding 1); FR dependency cross-references added; NFR conflicts reconciled inline with stated trade-offs.
- **Challenge:** reason codes `ILLEGAL_TRANSITION` / `CAPTAIN_OVERLAP` / `CAPTAIN_BUSY` / `CAPACITY_EXCEEDED`; overlap with Cancelled/Failed is allowed; capacity checked last.

## 5) What assumptions did I make?

- All A1–A8 carry forward from Day 1 (unchanged). A5 (one vehicle per trip) remains the least-confident assumption.
- Open questions E3/E4, T4/T5/T6, V1–V4, W3/W4, C1–C4 remain flagged in the SRS, not silently resolved.
- Default complaint category/priority used until C1 is answered (recorded in the complaint use case).

## 6) What would I improve?

- Handwrite the Day 2 planning sheet earlier — I drafted its content first and only produced the final hand-drawn photos late in the day (rule 3 wants them committed before digitization).
- Render and visually verify every UML diagram as I create it (I only rendered at the end — a syntax error would have cost time).
- The activity diagram could carry explicit state annotations from the start instead of adding them in the consistency pass.

## 7) What did I learn?

- "Handwritten first" is not a formality — it forces me to think through a diagram's semantics before producing the pretty version; my consistency findings mostly came from re-reading the hand-drawn sketches.
- A state machine is only trustworthy when **illegal** transitions are enumerated explicitly — the legal table alone is not a spec.
- Distinguishing the *acceptance boundary* (state layer) from the *resolution logic* (event layer) is the clean way to reconcile "frozen after completion" with "latest event wins".
