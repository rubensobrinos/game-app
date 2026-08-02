import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialLeaveState, transition, leaveRequestFor } from './leave-state.mjs';

test('1. initialLeaveState() is idle', () => {
  assert.deepStrictEqual(initialLeaveState(), { status: 'idle' });
});

test('2. REQUEST_LEAVE from idle moves to confirming', () => {
  const state = transition(initialLeaveState(), { type: 'REQUEST_LEAVE' });
  assert.deepStrictEqual(state, { status: 'confirming' });
});

test('3. CANCEL from confirming moves back to idle', () => {
  const confirming = transition(initialLeaveState(), { type: 'REQUEST_LEAVE' });
  const state = transition(confirming, { type: 'CANCEL' });
  assert.deepStrictEqual(state, { status: 'idle' });
});

test('4. CONFIRM from confirming moves to leaving; leaveRequestFor yields {}', () => {
  const confirming = transition(initialLeaveState(), { type: 'REQUEST_LEAVE' });
  const state = transition(confirming, { type: 'CONFIRM' });
  assert.deepStrictEqual(state, { status: 'leaving' });
  assert.deepStrictEqual(leaveRequestFor(state), {});
});

test('5. LEFT from leaving moves to left', () => {
  const confirming = transition(initialLeaveState(), { type: 'REQUEST_LEAVE' });
  const leaving = transition(confirming, { type: 'CONFIRM' });
  const state = transition(leaving, { type: 'LEFT' });
  assert.deepStrictEqual(state, { status: 'left' });
});

test('6. leaveRequestFor is null outside leaving (idle, confirming, left)', () => {
  const idle = initialLeaveState();
  const confirming = transition(idle, { type: 'REQUEST_LEAVE' });
  const leaving = transition(confirming, { type: 'CONFIRM' });
  const left = transition(leaving, { type: 'LEFT' });

  assert.strictEqual(leaveRequestFor(idle), null);
  assert.strictEqual(leaveRequestFor(confirming), null);
  assert.strictEqual(leaveRequestFor(left), null);
});

test('7. CONFIRM from idle is ignored (cannot skip confirming), state unchanged', () => {
  const idle = initialLeaveState();
  assert.deepStrictEqual(transition(idle, { type: 'CONFIRM' }), idle);
});

test('8. REQUEST_LEAVE from leaving or left is ignored, state unchanged', () => {
  const confirming = transition(initialLeaveState(), { type: 'REQUEST_LEAVE' });
  const leaving = transition(confirming, { type: 'CONFIRM' });
  const left = transition(leaving, { type: 'LEFT' });

  assert.deepStrictEqual(transition(leaving, { type: 'REQUEST_LEAVE' }), leaving);
  assert.deepStrictEqual(transition(left, { type: 'REQUEST_LEAVE' }), left);
});

test('9. CANCEL from idle, leaving or left is ignored, state unchanged', () => {
  const idle = initialLeaveState();
  const confirming = transition(idle, { type: 'REQUEST_LEAVE' });
  const leaving = transition(confirming, { type: 'CONFIRM' });
  const left = transition(leaving, { type: 'LEFT' });

  assert.deepStrictEqual(transition(idle, { type: 'CANCEL' }), idle);
  assert.deepStrictEqual(transition(leaving, { type: 'CANCEL' }), leaving);
  assert.deepStrictEqual(transition(left, { type: 'CANCEL' }), left);
});

test('10a. transition with null state does not throw and returns null', () => {
  assert.strictEqual(transition(null, { type: 'REQUEST_LEAVE' }), null);
});

test('10b. transition with undefined state does not throw and returns undefined', () => {
  assert.strictEqual(transition(undefined, { type: 'REQUEST_LEAVE' }), undefined);
});

test('10c. transition with undefined event does not throw and returns state unchanged', () => {
  const idle = initialLeaveState();
  assert.deepStrictEqual(transition(idle, undefined), idle);
});

test('10d. transition with an unknown event type does not throw and returns state unchanged', () => {
  const idle = initialLeaveState();
  assert.deepStrictEqual(transition(idle, { type: 'SOMETHING_ELSE' }), idle);
});

// Beyond the required table: defensive cases matching the sibling join-state
// module's contract for malformed input.

test('leaveRequestFor with null state does not throw and returns null', () => {
  assert.strictEqual(leaveRequestFor(null), null);
});

test('leaveRequestFor with undefined state does not throw and returns null', () => {
  assert.strictEqual(leaveRequestFor(undefined), null);
});

test('there is no route from idle to leaving without passing through confirming', () => {
  const idle = initialLeaveState();
  const direct = transition(idle, { type: 'CONFIRM' });
  assert.deepStrictEqual(direct, idle);
  assert.notStrictEqual(direct.status, 'leaving');
});
