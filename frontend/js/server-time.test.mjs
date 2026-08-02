import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateServerOffset, secondsRemaining } from './server-time.mjs';

test('estimateServerOffset: empty samples -> 0', () => {
  assert.equal(estimateServerOffset([]), 0);
});

test('estimateServerOffset: non-array input -> 0', () => {
  assert.equal(estimateServerOffset(null), 0);
  assert.equal(estimateServerOffset(undefined), 0);
});

test('estimateServerOffset: single sample, server exactly matches local midpoint -> 0 offset', () => {
  const samples = [{ requestSentAt: 1000, serverTime: 1050, responseReceivedAt: 1100 }];
  assert.equal(estimateServerOffset(samples), 0);
});

test('estimateServerOffset: single sample, server ahead of local clock -> positive offset', () => {
  const samples = [{ requestSentAt: 1000, serverTime: 2050, responseReceivedAt: 1100 }];
  // localMidpoint = 1050, offset = 2050 - 1050 = 1000
  assert.equal(estimateServerOffset(samples), 1000);
});

test('estimateServerOffset: single sample, server behind local clock -> negative offset', () => {
  const samples = [{ requestSentAt: 1000, serverTime: 900, responseReceivedAt: 1100 }];
  // localMidpoint = 1050, offset = 900 - 1050 = -150
  assert.equal(estimateServerOffset(samples), -150);
});

test('estimateServerOffset: multiple samples pick the one with the smallest round trip', () => {
  const samples = [
    // roundTrip 400ms, offset would be 500
    { requestSentAt: 0, serverTime: 700, responseReceivedAt: 400 },
    // roundTrip 20ms, offset would be 100 -- this one should win
    { requestSentAt: 1000, serverTime: 1110, responseReceivedAt: 1020 },
  ];
  assert.equal(estimateServerOffset(samples), 100);
});

test('estimateServerOffset: malformed samples are ignored, valid ones still used', () => {
  const samples = [
    null,
    {},
    { requestSentAt: 'nope', serverTime: 1, responseReceivedAt: 2 },
    { requestSentAt: 1000, serverTime: 1050, responseReceivedAt: 1100 },
  ];
  assert.equal(estimateServerOffset(samples), 0);
});

test('estimateServerOffset: negative round trip (clock skew glitch) is ignored', () => {
  const samples = [{ requestSentAt: 1100, serverTime: 1000, responseReceivedAt: 1000 }];
  assert.equal(estimateServerOffset(samples), 0);
});

test('secondsRemaining: never negative once endsAt is in the past', () => {
  const now = Date.now();
  assert.equal(secondsRemaining(now - 10000, now - 5000, 0), 0);
});

test('secondsRemaining: counts down toward endsAt with zero offset', () => {
  const now = Date.now();
  const remaining = secondsRemaining(now - 1000, now + 5000, 0);
  // ~5s remaining; allow slack for time elapsed while the test itself runs.
  assert.ok(remaining >= 4 && remaining <= 5, `expected 4-5, got ${remaining}`);
});

test('secondsRemaining: a positive offsetMs (server clock ahead) reduces remaining time', () => {
  const now = Date.now();
  const remaining = secondsRemaining(now - 1000, now + 2000, 5000);
  // effective "now" is 5s ahead, past endsAt -> clamped to 0.
  assert.equal(remaining, 0);
});

// Corrected after review: this function answers "seconds until endsAt",
// full stop -- startsAt plays no role in the calculation. Before a round
// starts, that honestly means a larger number than the round's own
// duration, not a clamped "duration from start" value.
test('secondsRemaining: now before startsAt still returns endsAt - now, not a clamped duration', () => {
  const now = Date.now();
  const remaining = secondsRemaining(now + 10000, now + 15000, 0);
  assert.ok(remaining >= 14 && remaining <= 15, `expected 14-15, got ${remaining}`);
});

test('secondsRemaining: invalid startsAt/endsAt -> 0', () => {
  assert.equal(secondsRemaining(NaN, Date.now() + 1000, 0), 0);
  assert.equal(secondsRemaining(Date.now(), undefined, 0), 0);
  assert.equal(secondsRemaining('x', 'y', 0), 0);
});

test('secondsRemaining: non-numeric offsetMs is treated as 0', () => {
  const now = Date.now();
  const remaining = secondsRemaining(now - 1000, now + 3000, 'not-a-number');
  assert.ok(remaining >= 2 && remaining <= 3, `expected 2-3, got ${remaining}`);
});
