// Task 10 — Trip Time-Overlap Detection for a Captain.
//
// Given a captain's trips (each with start/end times), return the list of
// overlapping trip pairs. Times are numeric (e.g., minutes since midnight).
//
// Boundary decisions (documented in src/algorithms/day1/README.md):
//  1. Adjacent trips (A ends 08:00, B starts 08:00) are NOT an overlap —
//     the captain finishes one trip exactly when the next begins.
//  2. Zero-duration trips (start === end) represent a single instant and are
//     EXCLUDED from conflict detection — conflicts require a positive-duration
//     intersection. A captain being present at one instant cannot conflict.
//
// Approach: sort by start time, then sweep with an early break — once a trip's
// start time reaches or passes the current trip's end, no further pair with the
// current trip can overlap, so we stop. This avoids the blind O(n^2) comparison.
//
// Complexity: O(n log n) for the sort + O(k) to report the k overlapping pairs.
// In the worst case all trips overlap and k = O(n^2) — that is the size of the
// output itself and is unavoidable.

function findOverlappingTrips(trips) {
  const pairs = [];
  // Zero-duration trips are instants, not spans — exclude them (decision 2).
  const spans = (trips || []).filter((t) => t.end - t.start > 0);
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].start >= sorted[i].end) break; // decision 1: adjacency is not overlap
      pairs.push({ tripA: sorted[i].tripId, tripB: sorted[j].tripId });
    }
  }
  return pairs;
}

module.exports = { findOverlappingTrips };
