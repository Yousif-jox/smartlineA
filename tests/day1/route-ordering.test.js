const { test } = require('node:test');
const assert = require('node:assert');
const { orderRouteStops } = require('../../src/algorithms/day1/route-ordering');

const depot = { lat: 30.0, lng: 30.0 };
const stop = (id, lat, lng) => ({ id, lat, lng });

test('single stop: order is just that stop, distance is positive', () => {
  const { order, totalDistanceMeters } = orderRouteStops(depot, [stop('s1', 30.1, 30.1)]);
  assert.deepStrictEqual(order, ['s1']);
  assert.ok(totalDistanceMeters > 0);
});

test('empty stops: empty order, zero distance', () => {
  assert.deepStrictEqual(orderRouteStops(depot, []), { order: [], totalDistanceMeters: 0 });
});

test('straight line: greedy picks nearest first, no backtracking', () => {
  const stops = [
    stop('far', 30.2, 30.0),
    stop('near', 30.05, 30.0),
  ];
  const { order } = orderRouteStops(depot, stops);
  assert.deepStrictEqual(order, ['near', 'far']);
});

test('duplicate coordinates resolve deterministically by id tie-break', () => {
  // both stops at the same coordinates -> same distance; id 'a' < 'b' wins
  const stops = [
    stop('b', 30.1, 30.1),
    stop('a', 30.1, 30.1),
  ];
  const first = orderRouteStops(depot, stops);
  const shuffled = orderRouteStops(depot, [stops[1], stops[0]]);
  assert.deepStrictEqual(first.order, shuffled.order);
  assert.deepStrictEqual(first.order, ['a', 'b']);
});

test('result is deterministic regardless of input order', () => {
  const stops = [
    stop('s1', 30.0, 30.2),
    stop('s2', 30.2, 30.0),
    stop('s3', 30.1, 30.1),
  ];
  const a = orderRouteStops(depot, stops);
  const b = orderRouteStops(depot, [...stops].reverse());
  assert.deepStrictEqual(a, b);
});

test('25 scattered stops complete quickly with a valid tour', () => {
  const stops = [];
  for (let i = 0; i < 25; i++) {
    stops.push(stop(`s${i}`, 30.0 + (i % 5) * 0.01, 30.0 + Math.floor(i / 5) * 0.01));
  }
  const start = Date.now();
  const { order, totalDistanceMeters } = orderRouteStops(depot, stops);
  const elapsed = Date.now() - start;
  assert.strictEqual(order.length, 25);
  assert.ok(totalDistanceMeters > 0);
  assert.ok(elapsed < 1000, `expected < 1s, took ${elapsed}ms`);
  assert.strictEqual(new Set(order).size, 25); // no duplicates, all visited
});
