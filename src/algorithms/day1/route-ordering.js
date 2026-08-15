// Task 12 — Route Stop Ordering.
//
// Given a starting depot and a set of stops, produce a stop order that minimizes
// total travel distance. A practical heuristic is acceptable — this is not
// required to be the optimal TSP solution.
//
// Approach: Nearest-Neighbor greedy — from the depot, repeatedly pick the
// nearest unvisited stop. Ties are broken by stop id for determinism.
//
// Decision (edge cases):
//  - Two stops at the same coordinates: same distance from any point; the id
//    tie-break keeps the result deterministic.
//  - Single stop / empty list handled explicitly.
//
// Complexity: O(n^2) with n <= 25 stops — runs in well under 1 second
// (at most 25*25/2 = 312 distance evaluations).
// Justification vs exact TSP is in README.md.

const { haversineMeters } = require('./geometry');

function orderRouteStops(depot, stops) {
  const remaining = (stops || []).map((s) => ({ ...s }));
  const order = [];
  let current = depot;
  let total = 0;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMeters(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist || (d === bestDist && remaining[i].id < remaining[bestIdx].id)) {
        bestDist = d;
        bestIdx = i;
      }
    }
    order.push(remaining[bestIdx].id);
    total += bestDist;
    current = remaining[bestIdx];
    remaining.splice(bestIdx, 1);
  }

  return { order, totalDistanceMeters: Math.round(total) };
}

module.exports = { orderRouteStops };
