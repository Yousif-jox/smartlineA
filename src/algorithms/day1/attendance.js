// Task 13 — Attendance Aggregation Under Duplicate Events.
//
// Given a raw stream of attendance events (possibly with duplicates and
// out-of-order timestamps) for a trip, compute the final attendance state per
// employee: the latest event by timestamp wins; duplicates by eventId are
// ignored (an event is only ever counted once, whichever copy arrives).
//
// Decisions (documented in README.md):
//  - Latest timestamp wins, even if it arrives second (chronological truth).
//  - Identical timestamps with different statuses: deterministic tie-break by
//    eventId (higher eventId wins) — arrival order is not reliable, so the
//    tie-break must not depend on it.
//  - Events without employeeId are invalid and skipped.
//
// Complexity: O(n) — two Map passes, no sorting needed. Idempotent and
// order-independent: the same event set always produces the same result
// regardless of arrival order.

function resolveAttendance(events) {
  // Pass 1: dedupe by eventId, keeping the copy with the latest timestamp
  // (and the eventId tie-break if timestamps are identical).
  const byEvent = new Map();
  for (const ev of events || []) {
    if (ev.employeeId === undefined || ev.employeeId === null) continue; // invalid
    const prev = byEvent.get(ev.eventId);
    const isNewer =
      !prev ||
      ev.timestamp > prev.timestamp ||
      (ev.timestamp === prev.timestamp && ev.eventId > prev.eventId);
    if (isNewer) byEvent.set(ev.eventId, ev);
  }

  // Pass 2: per employee, keep the EVENT with the latest timestamp
  // (comparisons need the full event, not just the status).
  const latest = new Map();
  for (const ev of byEvent.values()) {
    const cur = latest.get(ev.employeeId);
    const isNewer =
      !cur ||
      ev.timestamp > cur.timestamp ||
      (ev.timestamp === cur.timestamp && ev.eventId > cur.eventId);
    if (isNewer) latest.set(ev.employeeId, ev);
  }

  // Convert to the final employeeId -> status map.
  const result = new Map();
  for (const [employeeId, ev] of latest) result.set(employeeId, ev.status);
  return result;
}

module.exports = { resolveAttendance };
