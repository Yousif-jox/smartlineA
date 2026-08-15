// Day 1 Practical Challenge — Trip Conflict Detector.
//
// Given a list of captains, each with a full week of trips (date + start/end
// minutes), flag every scheduling conflict before trips go live.
//
// Output: per-captain list of conflicting trip pairs + a summary count of
// captains with at least one conflict.
//
// Approach:
//  - Each trip's (date, start, end) is normalized to an ABSOLUTE minute offset
//    (dayIndex * 1440 + minutes). This makes different dates comparable and
//    exposes timezone-style bugs: two trips on different dates cannot falsely
//    overlap, and a trip crossing midnight (end <= start) is extended by 1440.
//  - Overlap detection reuses Task 10's sort-based sweep (no duplicated logic).
//
// Assumption (documented): all times are in the company-local timezone; the
// detector compares absolute instants, so date+time normalization is exact.
//
// Complexity: O(n log n) per captain (sort) — 500 captains × 50 trips = 25k
// trips total, runs well under 1 second.

const { findOverlappingTrips } = require('../../algorithms/day1/trip-overlap');

const MINUTES_PER_DAY = 1440;

function toAbsoluteMinutes(trip) {
  const [y, m, d] = trip.date.split('-').map(Number);
  const dayIndex = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  let start = dayIndex * MINUTES_PER_DAY + trip.start;
  let end = dayIndex * MINUTES_PER_DAY + trip.end;
  if (end <= start) end += MINUTES_PER_DAY; // trip spans midnight
  return { start, end };
}

function detectTripConflicts(captains) {
  const results = [];
  let captainsWithConflicts = 0;

  for (const captain of captains || []) {
    const trips = (captain.trips || []).map((t) => ({
      tripId: t.tripId,
      start: toAbsoluteMinutes(t).start,
      end: toAbsoluteMinutes(t).end,
    }));
    const conflicts = findOverlappingTrips(trips);
    results.push({ captainId: captain.captainId, conflicts });
    if (conflicts.length > 0) captainsWithConflicts += 1;
  }

  return { captainsWithConflicts, results };
}

module.exports = { detectTripConflicts, toAbsoluteMinutes };
