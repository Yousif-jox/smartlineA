const { test } = require('node:test');
const assert = require('node:assert');
const { groupPickupPoints } = require('../../src/algorithms/day1/pickup-clustering');
const { haversineMeters } = require('../../src/algorithms/day1/geometry');

// ~100 m north of (30,30): 1 degree of latitude ≈ 111,195 m
const p = (employeeId, lat, lng) => ({ employeeId, lat, lng });

test('three close points + one far point -> two clusters', () => {
  const points = [
    p('e1', 30.0, 30.0),
    p('e2', 30.001, 30.0), // ~111 m
    p('e3', 30.002, 30.0), // ~222 m
    p('e4', 31.0, 30.0),   // ~111 km away
  ];
  const clusters = groupPickupPoints(points, 500);
  assert.strictEqual(clusters.length, 2);
  const far = clusters.find((c) => c.includes('e4'));
  assert.deepStrictEqual(far, ['e4']);
});

test('all identical points -> one cluster', () => {
  const points = [p('e1', 30, 30), p('e2', 30, 30), p('e3', 30, 30)];
  const clusters = groupPickupPoints(points, 100);
  assert.strictEqual(clusters.length, 1);
  assert.strictEqual(clusters[0].length, 3);
});

test('single outlier forms its own cluster', () => {
  const points = [p('e1', 30, 30), p('e2', 31, 31)];
  const clusters = groupPickupPoints(points, 500);
  assert.strictEqual(clusters.length, 2);
});

test('points exactly at max distance ARE connected (inclusive <=)', () => {
  const a = p('e1', 30.0, 30.0);
  const b = p('e2', 30.001, 30.0);
  const d = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  // exactly at the boundary -> connected
  assert.strictEqual(groupPickupPoints([a, b], d).length, 1);
  // epsilon less -> not connected
  assert.strictEqual(groupPickupPoints([a, b], d - 0.001).length, 2);
});

test('chained proximity: A-B and B-C within range, A-C beyond -> one cluster', () => {
  const a = p('e1', 30.000, 30.0);
  const b = p('e2', 30.001, 30.0); // ~111 m from a
  const c = p('e3', 30.002, 30.0); // ~111 m from b, ~222 m from a
  const clusters = groupPickupPoints([a, b, c], 150); // 150 m: a-b ok, b-c ok, a-c no
  assert.strictEqual(clusters.length, 1);
  assert.strictEqual(clusters[0].length, 3);
});

test('empty input returns no clusters', () => {
  assert.deepStrictEqual(groupPickupPoints([], 100), []);
});

test('single point returns one cluster', () => {
  assert.deepStrictEqual(groupPickupPoints([p('e1', 30, 30)], 100), [['e1']]);
});
