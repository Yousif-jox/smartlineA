# Day 1 — Algorithms (Tasks 09–13): Design Notes

This file documents the written deliverables required by Tasks 10, 11, 12 and 13.

---

## Task 10 — Trip Overlap: the boundary decision (one paragraph)

Two trips overlap only if they share a **positive-duration** intersection. Adjacent trips — one ending at 08:00 and the next starting at 08:00 — are **not** an overlap: the captain finishes one trip exactly when the other begins, with no instant where two duties are simultaneous. This is implemented with a strict comparison (`next.start >= current.end` → break), so touching endpoints never produce a conflict. **Zero-duration trips** (start === end) are treated as single instants, not spans, and are excluded from conflict detection: a captain present at one point in time cannot be in two places, and a point cannot conflict with another point. The one case a reviewer could push back on is a zero-duration trip sitting *inside* a normal trip; we deliberately chose not to flag it because the business consequence (attending an instant inside another span) is not a scheduling conflict — and flagging it would create noise for a case dispatch would never schedule.

## Task 11 — Scaling beyond 2,000 points (written note)

The BFS-over-implicit-graph approach is **O(n²)** haversine evaluations: fine at 2,000 points (≈4M checks), infeasible at 100,000 points (≈10¹⁰ checks ≈ minutes to hours). Scaling strategy for 100,000 points:

1. **Spatial grid (uniform bucketing):** overlay a grid over the bounding box with cell size ≈ maxDistanceMeters; each point only needs to check points in its own and the 8 neighboring cells. Average case drops to near O(n) with a small constant; worst case (all points in one cell) degrades back to O(n²).
2. **Quad-tree / k-d tree:** index points by location; range queries against the tree prune far points without scanning them.
3. **Union-Find over grid cells:** assign each point to its cell, union points across neighboring cells whose distance ≤ max; avoids materializing all pairs.

These preserve the **exact** chained-proximity semantics (no approximation) while keeping memory O(n). For approximate clustering at very large scale, grid-based GeoHash prefixes are a pragmatic alternative (buckets of same-prefix points), accepting slightly coarser cluster boundaries.

## Task 12 — Heuristic vs exact TSP (justification)

Exact TSP is NP-hard: brute force over 25 stops is 25! ≈ 1.5×10²⁵ orderings — impossible; Held-Karp dynamic programming is O(n²·2ⁿ) ≈ 25²×2²⁵ ≈ 2×10¹⁰ — still too heavy for a sub-second dispatch tool. **Nearest-Neighbor (O(n²) with n=25 → ~312 distance evaluations, microseconds)** gives a good practical order because real routes are spatially clustered along roads, where greedy next-nearest is near-optimal. The honest trade-off: NN can be up to ~2× worse than optimal on adversarial layouts, and it depends on the starting point. If dispatch later needs better orders, the cheap upgrade is **2-opt local search** on top of the NN seed (O(n³) worst case, still instant at n=25) — noted as future work, not required today.

## Task 13 — Attendance tie-break rule (decision)

- **Latest timestamp wins**, even if it arrives second (chronological truth — the business cares about what the clock said, not the network order).
- **Identical timestamps with different statuses:** the result must be deterministic and independent of arrival order, so the tie-break is **higher eventId wins**. (Device clock skew is acknowledged as a real risk; a shared clock source or server receipt time is the Day 5/6 hardening step.)
- **Missing employeeId:** the event is invalid and skipped.

The aggregation is **idempotent and order-independent**: replaying the same event set in any order always yields the same final state — the exact property the mobile app needs when retrying over poor connectivity.

---

## Complexity summary (as stated in code comments)

| Task | Complexity | Why |
|------|-----------|-----|
| 09 Capacity | O(n) over total assignments | One pass, Set per trip |
| 10 Overlap | O(n log n) + O(k) reported pairs | Sort + sweep with early break |
| 11 Clustering | O(n²) haversine | BFS over implicit graph; grid for 100k |
| 12 Route order | O(n²), n ≤ 25 | Nearest-neighbor greedy |
| 13 Attendance | O(n) | Two Map passes, no sort |
