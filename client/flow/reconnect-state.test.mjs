import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialReconnectState,
  transition,
  backoffDelayMs,
  nextActionFor,
} from './reconnect-state.mjs';

test('1. initialReconnectState() is connected, attempt 0, no pending snapshot', () => {
  assert.deepStrictEqual(initialReconnectState(), {
    status: 'connected',
    attempt: 0,
    pendingSnapshotRequest: false,
  });
});

test('2. nextActionFor on the initial state is null', () => {
  assert.strictEqual(nextActionFor(initialReconnectState()), null);
});

test('3. backoffDelayMs(1..5) is 1000, 2000, 4000, 8000, 16000', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(backoffDelayMs), [1000, 2000, 4000, 8000, 16000]);
});

test('4. backoffDelayMs(6) and backoffDelayMs(7) are both 30000', () => {
  assert.strictEqual(backoffDelayMs(6), 30000);
  assert.strictEqual(backoffDelayMs(7), 30000);
});

test('5. DISCONNECTED from connected moves to disconnected, attempt 0', () => {
  const state = transition(initialReconnectState(), { type: 'DISCONNECTED' });
  assert.deepStrictEqual(state, {
    status: 'disconnected',
    attempt: 0,
    pendingSnapshotRequest: false,
  });
});

test('6. nextActionFor while disconnected, attempt 0, schedules the first reconnect', () => {
  const disconnected = transition(initialReconnectState(), { type: 'DISCONNECTED' });
  assert.deepStrictEqual(nextActionFor(disconnected), { type: 'schedule-reconnect', delayMs: 1000 });
});

test('7. RECONNECT_ATTEMPT_STARTED moves to reconnecting, attempt 1', () => {
  const disconnected = transition(initialReconnectState(), { type: 'DISCONNECTED' });
  const state = transition(disconnected, { type: 'RECONNECT_ATTEMPT_STARTED' });
  assert.strictEqual(state.status, 'reconnecting');
  assert.strictEqual(state.attempt, 1);
});

test('8. RECONNECT_FAILED after test 7 goes back to disconnected, attempt stays 1, next delay is 2000', () => {
  const disconnected = transition(initialReconnectState(), { type: 'DISCONNECTED' });
  const reconnecting = transition(disconnected, { type: 'RECONNECT_ATTEMPT_STARTED' });
  const failed = transition(reconnecting, { type: 'RECONNECT_FAILED' });

  assert.strictEqual(failed.status, 'disconnected');
  assert.strictEqual(failed.attempt, 1);
  assert.deepStrictEqual(nextActionFor(failed), { type: 'schedule-reconnect', delayMs: 2000 });
});

test('9. five consecutive RECONNECT_ATTEMPT_STARTED/RECONNECT_FAILED pairs: sixth nextActionFor is 30000', () => {
  let state = transition(initialReconnectState(), { type: 'DISCONNECTED' });

  for (let i = 0; i < 5; i += 1) {
    state = transition(state, { type: 'RECONNECT_ATTEMPT_STARTED' });
    state = transition(state, { type: 'RECONNECT_FAILED' });
  }

  assert.strictEqual(state.attempt, 5);
  assert.deepStrictEqual(nextActionFor(state), { type: 'schedule-reconnect', delayMs: 30000 });
});

test('10. RECONNECT_SUCCEEDED from reconnecting moves to connected, attempt 0, pending snapshot true', () => {
  const disconnected = transition(initialReconnectState(), { type: 'DISCONNECTED' });
  const reconnecting = transition(disconnected, { type: 'RECONNECT_ATTEMPT_STARTED' });
  const state = transition(reconnecting, { type: 'RECONNECT_SUCCEEDED' });

  assert.deepStrictEqual(state, { status: 'connected', attempt: 0, pendingSnapshotRequest: true });
});

test('11. nextActionFor after test 10 requests a snapshot', () => {
  const disconnected = transition(initialReconnectState(), { type: 'DISCONNECTED' });
  const reconnecting = transition(disconnected, { type: 'RECONNECT_ATTEMPT_STARTED' });
  const succeeded = transition(reconnecting, { type: 'RECONNECT_SUCCEEDED' });

  assert.deepStrictEqual(nextActionFor(succeeded), { type: 'request-snapshot' });
});

test('12. SNAPSHOT_REQUEST_SENT after test 10 clears the pending flag; nextActionFor is null', () => {
  const disconnected = transition(initialReconnectState(), { type: 'DISCONNECTED' });
  const reconnecting = transition(disconnected, { type: 'RECONNECT_ATTEMPT_STARTED' });
  const succeeded = transition(reconnecting, { type: 'RECONNECT_SUCCEEDED' });
  const sent = transition(succeeded, { type: 'SNAPSHOT_REQUEST_SENT' });

  assert.strictEqual(sent.pendingSnapshotRequest, false);
  assert.strictEqual(nextActionFor(sent), null);
});

test('13. DISCONNECTED while reconnecting with attempt 3 resets to attempt 0, not 3', () => {
  let state = transition(initialReconnectState(), { type: 'DISCONNECTED' });
  for (let i = 0; i < 2; i += 1) {
    state = transition(state, { type: 'RECONNECT_ATTEMPT_STARTED' });
    state = transition(state, { type: 'RECONNECT_FAILED' });
  }
  state = transition(state, { type: 'RECONNECT_ATTEMPT_STARTED' });
  assert.strictEqual(state.status, 'reconnecting');
  assert.strictEqual(state.attempt, 3);

  const disconnected = transition(state, { type: 'DISCONNECTED' });
  assert.deepStrictEqual(disconnected, {
    status: 'disconnected',
    attempt: 0,
    pendingSnapshotRequest: false,
  });
});

test('14. RECONNECT_FAILED while connected (a late signal) leaves state exactly unchanged', () => {
  const connected = initialReconnectState();
  assert.strictEqual(transition(connected, { type: 'RECONNECT_FAILED' }), connected);
});

test('15. RECONNECT_ATTEMPT_STARTED while connected leaves state exactly unchanged', () => {
  const connected = initialReconnectState();
  assert.strictEqual(transition(connected, { type: 'RECONNECT_ATTEMPT_STARTED' }), connected);
});

// Beyond the required table: defensive cases proving no function throws for
// malformed input, matching the sibling modules' contract (route-resolver,
// join-state, host-setup-state).

test('RECONNECT_SUCCEEDED outside reconnecting is ignored, no throw', () => {
  const connected = initialReconnectState();
  assert.strictEqual(transition(connected, { type: 'RECONNECT_SUCCEEDED' }), connected);
});

test('RECONNECT_ATTEMPT_STARTED while already reconnecting is ignored, no throw', () => {
  const disconnected = transition(initialReconnectState(), { type: 'DISCONNECTED' });
  const reconnecting = transition(disconnected, { type: 'RECONNECT_ATTEMPT_STARTED' });
  assert.strictEqual(transition(reconnecting, { type: 'RECONNECT_ATTEMPT_STARTED' }), reconnecting);
});

test('RECONNECT_FAILED while already disconnected is ignored, no throw', () => {
  const disconnected = transition(initialReconnectState(), { type: 'DISCONNECTED' });
  assert.strictEqual(transition(disconnected, { type: 'RECONNECT_FAILED' }), disconnected);
});

test('SNAPSHOT_REQUEST_SENT with no pending request is ignored, no throw', () => {
  const connected = initialReconnectState();
  assert.strictEqual(transition(connected, { type: 'SNAPSHOT_REQUEST_SENT' }), connected);
});

test('transition with null state does not throw and returns null', () => {
  assert.strictEqual(transition(null, { type: 'DISCONNECTED' }), null);
});

test('transition with undefined event does not throw and returns state unchanged', () => {
  const connected = initialReconnectState();
  assert.deepStrictEqual(transition(connected, undefined), connected);
});

test('transition with an unknown event type does not throw and returns state unchanged', () => {
  const connected = initialReconnectState();
  assert.deepStrictEqual(transition(connected, { type: 'SOMETHING_ELSE' }), connected);
});

test('nextActionFor with null state does not throw and returns null', () => {
  assert.strictEqual(nextActionFor(null), null);
});

test('nextActionFor with undefined state does not throw and returns null', () => {
  assert.strictEqual(nextActionFor(undefined), null);
});

test('backoffDelayMs does not throw for non-positive, non-finite, or non-number input', () => {
  assert.strictEqual(backoffDelayMs(0), 1000);
  assert.strictEqual(backoffDelayMs(-5), 1000);
  assert.strictEqual(backoffDelayMs(NaN), 1000);
  assert.strictEqual(backoffDelayMs(undefined), 1000);
  assert.strictEqual(backoffDelayMs('3'), 1000);
});

test('backoffDelayMs floors a fractional attempt', () => {
  assert.strictEqual(backoffDelayMs(2.9), 2000);
});
