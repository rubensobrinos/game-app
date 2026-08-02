import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialJoinState, transition, joinRequestFor } from './join-state.mjs';

const inviteLocator = { type: 'invite', inviteId: 'N4x7pQm2K8tW', joinSource: 'qr' };
const codeLocator = { type: 'code', code: '482917' };

const nameEntryWithInvite = () =>
  transition(initialJoinState(), {
    type: 'LOCATOR_READY',
    locator: inviteLocator,
    suggestedName: 'Vrolijke Vos',
  });

test('1. initialJoinState() is idle', () => {
  assert.deepStrictEqual(initialJoinState(), { status: 'idle' });
});

test('2. LOCATOR_READY with invite + suggestion moves to name-entry with that suggestedName', () => {
  const state = transition(initialJoinState(), {
    type: 'LOCATOR_READY',
    locator: inviteLocator,
    suggestedName: 'Vrolijke Vos',
  });
  assert.deepStrictEqual(state, {
    status: 'name-entry',
    locator: inviteLocator,
    suggestedName: 'Vrolijke Vos',
    displayName: null,
  });
});

test('3. LOCATOR_READY without a suggestion yields suggestedName: null and displayName: null', () => {
  const state = transition(initialJoinState(), {
    type: 'LOCATOR_READY',
    locator: inviteLocator,
    suggestedName: null,
  });
  assert.deepStrictEqual(state, {
    status: 'name-entry',
    locator: inviteLocator,
    suggestedName: null,
    displayName: null,
  });
});

test('4. NAME_CHANGED with <=20 graphemes updates displayName, stays in name-entry', () => {
  const state = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  assert.strictEqual(state.status, 'name-entry');
  assert.strictEqual(state.displayName, 'Sanne');
});

// Chosen behavior for test 5 (truncate vs reject): truncate to 20 grapheme
// clusters. JoinState's name-entry shape has no "invalid" flag to carry a
// rejection, and truncating matches ordinary <input maxlength> UX — see the
// matching rationale comment in join-state.mjs next to truncateToGraphemes.
test('5. NAME_CHANGED with 21 plain characters is truncated to 20', () => {
  const raw = 'a'.repeat(21);
  const state = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: raw });
  assert.strictEqual(state.status, 'name-entry');
  assert.strictEqual(state.displayName, 'a'.repeat(20));
  assert.strictEqual(state.displayName.length, 20);
});

test('6. a 4-codepoint family emoji + 19 other characters counts as 20 grapheme clusters', () => {
  const familyEmoji = '\u{1F469}\u{1F3FD}\u{200D}\u{1F466}';
  const raw = familyEmoji + 'a'.repeat(19);
  assert.strictEqual([...raw].length, 23);

  const state = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: raw });
  assert.strictEqual(state.status, 'name-entry');
  assert.strictEqual(state.displayName, raw);

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  assert.strictEqual([...segmenter.segment(state.displayName)].length, 20);
});

test('7. SUBMIT from name-entry moves to submitting; joinRequestFor yields inviteId, never gameCode', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const state = transition(named, { type: 'SUBMIT' });
  assert.deepStrictEqual(state, {
    status: 'submitting',
    locator: inviteLocator,
    displayName: 'Sanne',
  });

  const request = joinRequestFor(state);
  assert.strictEqual(request.inviteId, inviteLocator.inviteId);
  assert.strictEqual('gameCode' in request, false);
  assert.strictEqual(request.displayName, 'Sanne');
  assert.strictEqual(request.joinSource, 'qr');
});

test('7b. SUBMIT with a code locator yields gameCode, never inviteId', () => {
  const nameEntry = transition(initialJoinState(), {
    type: 'LOCATOR_READY',
    locator: codeLocator,
    suggestedName: null,
  });
  const state = transition(nameEntry, { type: 'SUBMIT' });

  const request = joinRequestFor(state);
  assert.strictEqual(request.gameCode, codeLocator.code);
  assert.strictEqual('inviteId' in request, false);
  assert.strictEqual(request.displayName, null);
});

test('8. JOIN_SUCCEEDED from submitting moves to joined with the session data', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const session = { playerId: 'p1', effectiveName: 'Sanne' };

  const state = transition(submitting, { type: 'JOIN_SUCCEEDED', session });
  assert.deepStrictEqual(state, { status: 'joined', session });
});

test('9. JOIN_FAILED from submitting moves to error, keeping the locator for RETRY', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });

  const state = transition(submitting, { type: 'JOIN_FAILED', code: 'invite_expired' });
  assert.deepStrictEqual(state, {
    status: 'error',
    code: 'invite_expired',
    locator: inviteLocator,
  });
});

test('10. RETRY from error returns to name-entry with the same locator, names reset to null', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const errored = transition(submitting, { type: 'JOIN_FAILED', code: 'invite_expired' });

  const state = transition(errored, { type: 'RETRY' });
  assert.deepStrictEqual(state, {
    status: 'name-entry',
    locator: inviteLocator,
    suggestedName: null,
    displayName: null,
  });
});

test('11a. SUBMIT from idle is ignored: state unchanged, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(transition(idle, { type: 'SUBMIT' }), idle);
});

test('11b. SUBMIT from joined is ignored: state unchanged, no throw', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const joined = transition(submitting, { type: 'JOIN_SUCCEEDED', session: { playerId: 'p1' } });

  assert.deepStrictEqual(transition(joined, { type: 'SUBMIT' }), joined);
});

test('12a. joinRequestFor outside submitting (idle) is null', () => {
  assert.strictEqual(joinRequestFor(initialJoinState()), null);
});

test('12b. joinRequestFor outside submitting (name-entry) is null', () => {
  assert.strictEqual(joinRequestFor(nameEntryWithInvite()), null);
});

test('12c. joinRequestFor outside submitting (joined) is null', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const joined = transition(submitting, { type: 'JOIN_SUCCEEDED', session: { playerId: 'p1' } });
  assert.strictEqual(joinRequestFor(joined), null);
});

test('12d. joinRequestFor outside submitting (error) is null', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const errored = transition(submitting, { type: 'JOIN_FAILED', code: 'invite_expired' });
  assert.strictEqual(joinRequestFor(errored), null);
});

// Beyond the required table: defensive cases proving no function throws for
// malformed input, matching the sibling route-resolver module's contract.

test('NAME_CHANGED with empty string resets displayName to null', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const cleared = transition(named, { type: 'NAME_CHANGED', value: '' });
  assert.strictEqual(cleared.displayName, null);
});

test('NAME_CHANGED with a non-string value does not throw and clears to null', () => {
  const state = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 42 });
  assert.strictEqual(state.status, 'name-entry');
  assert.strictEqual(state.displayName, null);
});

test('NAME_CHANGED outside name-entry is ignored, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(transition(idle, { type: 'NAME_CHANGED', value: 'Sanne' }), idle);
});

test('LOCATOR_READY with an unrecognized joinSource falls back to unknown', () => {
  const state = transition(initialJoinState(), {
    type: 'LOCATOR_READY',
    locator: { type: 'invite', inviteId: 'abc', joinSource: 'carrier_pigeon' },
    suggestedName: null,
  });
  assert.strictEqual(state.locator.joinSource, 'unknown');
});

test('LOCATOR_READY with a malformed locator is ignored, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(
    transition(idle, { type: 'LOCATOR_READY', locator: { type: 'invite' }, suggestedName: null }),
    idle,
  );
});

test('JOIN_FAILED with a non-string code falls back to "unknown", no throw', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const state = transition(submitting, { type: 'JOIN_FAILED', code: undefined });
  assert.strictEqual(state.code, 'unknown');
});

test('RETRY outside error is ignored, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(transition(idle, { type: 'RETRY' }), idle);
});

test('JOIN_SUCCEEDED outside submitting is ignored, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(
    transition(idle, { type: 'JOIN_SUCCEEDED', session: { playerId: 'p1' } }),
    idle,
  );
});

test('transition with null state does not throw and returns null', () => {
  assert.strictEqual(transition(null, { type: 'SUBMIT' }), null);
});

test('transition with undefined event does not throw and returns state unchanged', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(transition(idle, undefined), idle);
});

test('transition with an unknown event type does not throw and returns state unchanged', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(transition(idle, { type: 'SOMETHING_ELSE' }), idle);
});

test('joinRequestFor with null state does not throw and returns null', () => {
  assert.strictEqual(joinRequestFor(null), null);
});
