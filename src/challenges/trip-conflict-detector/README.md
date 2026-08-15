# Trip Conflict Detector — Day 1 Practical Challenge

## Problem

Smart Line dispatch needs a standalone tool that, given each captain's full trip list for a week, flags every scheduling conflict **before** trips go live.

**Input:** a list of captains, each with a list of trips `{ tripId, date, start, end }` (times in minutes of day).

**Output:** per-captain list of conflicting trip pairs + summary count of captains with at least one conflict.

## Approach

1. **Normalize to absolute instants.** Each trip becomes `dayIndex * 1440 + minutes`, where `dayIndex` is the calendar day since an epoch. This makes dates comparable and eliminates timezone-style false overlaps: trips on different dates can never appear to collide unless they truly do. A trip whose `end <= start` is treated as crossing midnight and extended by 1440 minutes.
2. **Reuse Task 10's overlap logic.** The detector imports `findOverlappingTrips` from `src/algorithms/day1/trip-overlap.js` — the same sort-based sweep, so boundary decisions (adjacent trips are not conflicts, zero-duration trips excluded) are consistent across the week's work.
3. **Aggregate.** For each captain: list of conflicting pairs; then count captains having at least one conflict.

## Complexity

O(n log n) per captain (the sort dominates; the sweep reports only the actual conflicting pairs). Worst case: 500 captains × 50 trips = 25,000 trips → comfortably under 1 second.

## Edge cases handled

- **Trips spanning midnight** (23:00 → 01:00): `end <= start` → shifted to the next day's minutes.
- **Trips on different dates:** absolute day offsets prevent false overlaps; a genuine overlap across midnight is still detected (the 23:00–01:00 trip covers 00:00–00:30 of the next day).
- **Captain with zero trips:** no conflicts, not counted in the summary.

## How to run the tests

```bash
node --test tests/day1/
```

## Files

- `src/challenges/trip-conflict-detector/index.js` — the detector (module)
- `tests/day1/trip-conflict-detector.test.js` — its tests
