const { test } = require('node:test');
const assert = require('node:assert');
const { detectTripConflicts } = require('../../src/challenges/trip-conflict-detector/index');

const trip = (tripId, date, start, end) => ({ tripId, date, start, end });

test('flags overlapping trips per captain and counts captains', () => {
  const captains = [
    {
      captainId: 'c1',
      trips: [
        trip('t1', '2026-08-17', 420, 480), // 07:00-08:00
        trip('t2', '2026-08-17', 450, 510), // 07:30-08:30 -> overlap with t1
      ],
    },
    {
      captainId: 'c2',
      trips: [
        trip('t3', '2026-08-17', 420, 480),
        trip('t4', '2026-08-18', 420, 480), // different day -> no overlap
      ],
    },
  ];
  const { captainsWithConflicts, results } = detectTripConflicts(captains);
  assert.strictEqual(captainsWithConflicts, 1);
  assert.strictEqual(results[0].conflicts.length, 1);
  assert.strictEqual(results[1].conflicts.length, 0);
});

test('trip spanning midnight conflicts with the next day early trip', () => {
  const captains = [
    {
      captainId: 'c1',
      trips: [
        trip('late', '2026-08-17', 1380, 60),  // 23:00 -> 01:00 next day (crosses midnight)
        trip('early', '2026-08-18', 0, 30),    // 00:00-00:30 next day -> real overlap
      ],
    },
  ];
  const { captainsWithConflicts, results } = detectTripConflicts(captains);
  assert.strictEqual(captainsWithConflicts, 1);
  assert.strictEqual(results[0].conflicts.length, 1);
});

test('trips on different dates do NOT falsely overlap', () => {
  const captains = [
    {
      captainId: 'c1',
      trips: [
        trip('mon', '2026-08-17', 420, 480),
        trip('tue', '2026-08-18', 420, 480),
      ],
    },
  ];
  const { captainsWithConflicts, results } = detectTripConflicts(captains);
  assert.strictEqual(captainsWithConflicts, 0);
  assert.strictEqual(results[0].conflicts.length, 0);
});

test('adjacent trips (touch at boundary) are not conflicts', () => {
  const captains = [
    {
      captainId: 'c1',
      trips: [
        trip('a', '2026-08-17', 420, 480),
        trip('b', '2026-08-17', 480, 540), // starts exactly when a ends
      ],
    },
  ];
  const { captainsWithConflicts, results } = detectTripConflicts(captains);
  assert.strictEqual(captainsWithConflicts, 0);
  assert.strictEqual(results[0].conflicts.length, 0);
});

test('captain with zero trips: no conflicts, not counted', () => {
  const { captainsWithConflicts, results } = detectTripConflicts([{ captainId: 'c1', trips: [] }]);
  assert.strictEqual(captainsWithConflicts, 0);
  assert.strictEqual(results[0].conflicts.length, 0);
});

test('500 captains x 50 trips completes quickly (under 1s)', () => {
  const captains = [];
  for (let c = 0; c < 500; c++) {
    const trips = [];
    for (let t = 0; t < 50; t++) {
      // 75-minute trips starting every 60 minutes -> every consecutive pair overlaps
      trips.push(trip(`c${c}-t${t}`, '2026-08-17', 60 * t, 60 * t + 75));
    }
    captains.push({ captainId: `c${c}`, trips });
  }
  const start = Date.now();
  const { captainsWithConflicts, results } = detectTripConflicts(captains);
  const elapsed = Date.now() - start;
  assert.strictEqual(results.length, 500);
  assert.ok(captainsWithConflicts > 0); // every captain has consecutive 30-min trips
  assert.ok(elapsed < 1000, `expected < 1s, took ${elapsed}ms`);
});
