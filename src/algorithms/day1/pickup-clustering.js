// Task 11 — Nearest Pickup Point Grouping.
//
// Group employees into clusters where every member is within maxDistanceMeters
// of at least one other member (chained proximity). This is exactly the
// connected-components problem over a graph whose edges connect points within
// the maximum walking distance.
//
// Decision (edge cases):
//  - Points exactly at maxDistanceMeters are connected (inclusive <=).
//  - Identical points (distance 0) are always in the same cluster.
//  - A single outlier forms its own cluster.
//
// Approach: BFS over the implicit graph. Distances use the haversine formula.
// Complexity: O(n^2) haversine evaluations — acceptable at n <= 2,000
// (4M distance checks). See README.md for the scaling strategy beyond 2,000
// points (spatial grid / quad-tree).

const { haversineMeters } = require('./geometry');

function groupPickupPoints(points, maxDistanceMeters) {
  const n = (points || []).length;
  const visited = new Array(n).fill(false);
  const clusters = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const cluster = [];
    const queue = [i];
    visited[i] = true;

    while (queue.length > 0) {
      const cur = queue.shift();
      cluster.push(points[cur].employeeId);
      for (let j = 0; j < n; j++) {
        if (visited[j]) continue;
        const d = haversineMeters(
          points[cur].lat, points[cur].lng,
          points[j].lat, points[j].lng
        );
        if (d <= maxDistanceMeters) {
          visited[j] = true;
          queue.push(j);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

module.exports = { groupPickupPoints };
