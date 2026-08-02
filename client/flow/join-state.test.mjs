import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialJoinState,
  transition,
  previewRequestFor,
  joinRequestFor,
} from './join-state.mjs';

const inviteLocator = { type: 'invite', inviteId: 'N4x7pQm2K8tW', joinSource: 'qr' };
const codeLocator = { type: 'code', code: '482917' };

const previewingWithInvite = () =>
  transition(initialJoinState(), { type: 'LOCATOR_OBTAINED', locator: inviteLocator });

const nameEntryWithInvite = (suggestedName = 'Vrolijke Vos') =>
  transition(previewingWithInvite(), { type: 'PREVIEW_SUCCEEDED', suggestedName });

test('1. initialJoinState() is idle', () => {
  assert.deepStrictEqual(initialJoinState(), { status: 'idle' });
});

test('2. LOCATOR_OBTAINED with an invite locator moves idle to previewing', () => {
  const state = transition(initialJoinState(), { type: 'LOCATOR_OBTAINED', locator: inviteLocator });
  assert.deepStrictEqual(state, { status: 'previewing', locator: inviteLocator });
});

// PROTOCOL.md's preview endpoint is invite-only (GET /api/v1/games/preview
// takes only inviteId) — a code locator has nothing to preview, so it skips
// 'previewing' entirely and lands directly in name-entry with no suggestion.
test('3. LOCATOR_OBTAINED with a code locator skips previewing, moves idle straight to name-entry', () => {
  const state = transition(initialJoinState(), { type: 'LOCATOR_OBTAINED', locator: codeLocator });
  assert.deepStrictEqual(state, {
    status: 'name-entry',
    locator: codeLocator,
    suggestedName: null,
    displayName: null,
  });
});

test('4. LOCATOR_OBTAINED outside idle is ignored, no throw', () => {
  const previewing = previewingWithInvite();
  assert.deepStrictEqual(
    transition(previewing, { type: 'LOCATOR_OBTAINED', locator: codeLocator }),
    previewing,
  );
});

test('5. previewRequestFor during previewing yields inviteId for an invite locator, never gameCode', () => {
  const request = previewRequestFor(previewingWithInvite());
  assert.deepStrictEqual(request, { inviteId: 'N4x7pQm2K8tW' });
  assert.strictEqual('gameCode' in request, false);
});

test('6. previewRequestFor is null for a code locator — it never reaches previewing', () => {
  const nameEntry = transition(initialJoinState(), { type: 'LOCATOR_OBTAINED', locator: codeLocator });
  assert.strictEqual(nameEntry.status, 'name-entry');
  assert.strictEqual(previewRequestFor(nameEntry), null);
});

test('7. previewRequestFor outside previewing is null (idle, name-entry, submitting, joined, error)', () => {
  assert.strictEqual(previewRequestFor(initialJoinState()), null);
  assert.strictEqual(previewRequestFor(nameEntryWithInvite()), null);

  const submitting = transition(
    transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' }),
    { type: 'SUBMIT' },
  );
  assert.strictEqual(previewRequestFor(submitting), null);

  const joined = transition(submitting, { type: 'JOIN_SUCCEEDED', session: { playerId: 'p1' } });
  assert.strictEqual(previewRequestFor(joined), null);

  const errored = transition(previewingWithInvite(), { type: 'PREVIEW_FAILED', code: 'INVITE_INVALID' });
  assert.strictEqual(previewRequestFor(errored), null);
});

test('8. PREVIEW_SUCCEEDED with a suggestion moves previewing to name-entry with that suggestedName', () => {
  const state = transition(previewingWithInvite(), {
    type: 'PREVIEW_SUCCEEDED',
    suggestedName: 'Vrolijke Vos',
  });
  assert.deepStrictEqual(state, {
    status: 'name-entry',
    locator: inviteLocator,
    suggestedName: 'Vrolijke Vos',
    displayName: null,
  });
});

test('9. PREVIEW_SUCCEEDED without a suggestion yields suggestedName: null', () => {
  const state = transition(previewingWithInvite(), { type: 'PREVIEW_SUCCEEDED', suggestedName: null });
  assert.strictEqual(state.suggestedName, null);
});

test('10. PREVIEW_SUCCEEDED outside previewing is ignored, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(transition(idle, { type: 'PREVIEW_SUCCEEDED', suggestedName: 'x' }), idle);
});

test('11. PREVIEW_FAILED moves previewing to an error, stage preview, locator kept, no suggestion', () => {
  const state = transition(previewingWithInvite(), { type: 'PREVIEW_FAILED', code: 'INVITE_INVALID' });
  assert.deepStrictEqual(state, {
    status: 'error',
    stage: 'preview',
    code: 'INVITE_INVALID',
    locator: inviteLocator,
    suggestedName: null,
  });
});

test('12. PREVIEW_FAILED outside previewing is ignored, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(transition(idle, { type: 'PREVIEW_FAILED', code: 'x' }), idle);
});

test('13. NAME_CHANGED with <=20 graphemes updates displayName, stays in name-entry', () => {
  const state = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  assert.strictEqual(state.status, 'name-entry');
  assert.strictEqual(state.displayName, 'Sanne');
});

test('14. NAME_CHANGED with 21 plain characters is truncated to 20', () => {
  const raw = 'a'.repeat(21);
  const state = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: raw });
  assert.strictEqual(state.displayName, 'a'.repeat(20));
});

test('15. a 4-codepoint family emoji + 19 other characters counts as 20 grapheme clusters', () => {
  const familyEmoji = '\u{1F469}\u{1F3FD}\u{200D}\u{1F466}';
  const raw = familyEmoji + 'a'.repeat(19);
  assert.strictEqual([...raw].length, 23);

  const state = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: raw });
  assert.strictEqual(state.displayName, raw);

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  assert.strictEqual([...segmenter.segment(state.displayName)].length, 20);
});

test('16. NAME_CHANGED outside name-entry is ignored, no throw', () => {
  const previewing = previewingWithInvite();
  assert.deepStrictEqual(transition(previewing, { type: 'NAME_CHANGED', value: 'Sanne' }), previewing);
});

test('17. SUBMIT from name-entry moves to submitting, carrying the suggestion; joinRequestFor yields inviteId', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const state = transition(named, { type: 'SUBMIT' });
  assert.deepStrictEqual(state, {
    status: 'submitting',
    locator: inviteLocator,
    suggestedName: 'Vrolijke Vos',
    displayName: 'Sanne',
  });

  const request = joinRequestFor(state);
  assert.deepStrictEqual(request, { inviteId: 'N4x7pQm2K8tW', displayName: 'Sanne', joinSource: 'qr' });
});

test('18. SUBMIT with a code locator (no preview step) yields gameCode and joinSource "code", never inviteId', () => {
  const named = transition(initialJoinState(), { type: 'LOCATOR_OBTAINED', locator: codeLocator });
  assert.strictEqual(named.status, 'name-entry');
  const submitting = transition(named, { type: 'SUBMIT' });

  const request = joinRequestFor(submitting);
  assert.deepStrictEqual(request, { gameCode: '482917', displayName: null, joinSource: 'code' });
});

test('19. SUBMIT outside name-entry is ignored, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(transition(idle, { type: 'SUBMIT' }), idle);
});

test('20. JOIN_SUCCEEDED from submitting moves to joined with the session data', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const session = { playerId: 'p1', effectiveName: 'Sanne' };

  const state = transition(submitting, { type: 'JOIN_SUCCEEDED', session });
  assert.deepStrictEqual(state, { status: 'joined', session });
});

test('21. JOIN_SUCCEEDED outside submitting is ignored, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(
    transition(idle, { type: 'JOIN_SUCCEEDED', session: { playerId: 'p1' } }),
    idle,
  );
});

test('22. JOIN_FAILED from submitting moves to an error, stage submit, keeping locator and suggestion', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });

  const state = transition(submitting, { type: 'JOIN_FAILED', code: 'NAME_TOO_LONG' });
  assert.deepStrictEqual(state, {
    status: 'error',
    stage: 'submit',
    code: 'NAME_TOO_LONG',
    locator: inviteLocator,
    suggestedName: 'Vrolijke Vos',
  });
});

test('23. JOIN_FAILED outside submitting is ignored, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(transition(idle, { type: 'JOIN_FAILED', code: 'x' }), idle);
});

test('24. RETRY from a preview-stage error returns to previewing with the same locator', () => {
  const errored = transition(previewingWithInvite(), { type: 'PREVIEW_FAILED', code: 'INVITE_INVALID' });
  const state = transition(errored, { type: 'RETRY' });
  assert.deepStrictEqual(state, { status: 'previewing', locator: inviteLocator });
});

test('25. RETRY from a submit-stage error returns to name-entry, keeping the suggestion, clearing the typed name', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const errored = transition(submitting, { type: 'JOIN_FAILED', code: 'NAME_TOO_LONG' });

  const state = transition(errored, { type: 'RETRY' });
  assert.deepStrictEqual(state, {
    status: 'name-entry',
    locator: inviteLocator,
    suggestedName: 'Vrolijke Vos',
    displayName: null,
  });
});

test('26. RETRY outside error is ignored, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(transition(idle, { type: 'RETRY' }), idle);
});

test('27a. joinRequestFor outside submitting (idle) is null', () => {
  assert.strictEqual(joinRequestFor(initialJoinState()), null);
});

test('27b. joinRequestFor outside submitting (previewing) is null', () => {
  assert.strictEqual(joinRequestFor(previewingWithInvite()), null);
});

test('27c. joinRequestFor outside submitting (name-entry) is null', () => {
  assert.strictEqual(joinRequestFor(nameEntryWithInvite()), null);
});

test('27d. joinRequestFor outside submitting (joined) is null', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const joined = transition(submitting, { type: 'JOIN_SUCCEEDED', session: { playerId: 'p1' } });
  assert.strictEqual(joinRequestFor(joined), null);
});

test('27e. joinRequestFor outside submitting (error) is null', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const errored = transition(submitting, { type: 'JOIN_FAILED', code: 'x' });
  assert.strictEqual(joinRequestFor(errored), null);
});

// Beyond the required table: defensive cases proving no function throws for
// malformed input, matching the sibling modules' contract.

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

test('LOCATOR_OBTAINED with an unrecognized joinSource falls back to unknown', () => {
  const state = transition(initialJoinState(), {
    type: 'LOCATOR_OBTAINED',
    locator: { type: 'invite', inviteId: 'abc', joinSource: 'carrier_pigeon' },
  });
  assert.strictEqual(state.locator.joinSource, 'unknown');
});

test('LOCATOR_OBTAINED with a malformed locator is ignored, no throw', () => {
  const idle = initialJoinState();
  assert.deepStrictEqual(
    transition(idle, { type: 'LOCATOR_OBTAINED', locator: { type: 'invite' } }),
    idle,
  );
});

test('PREVIEW_FAILED with a non-string code falls back to "unknown", no throw', () => {
  const state = transition(previewingWithInvite(), { type: 'PREVIEW_FAILED', code: undefined });
  assert.strictEqual(state.code, 'unknown');
});

test('JOIN_FAILED with a non-string code falls back to "unknown", no throw', () => {
  const named = transition(nameEntryWithInvite(), { type: 'NAME_CHANGED', value: 'Sanne' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const state = transition(submitting, { type: 'JOIN_FAILED', code: undefined });
  assert.strictEqual(state.code, 'unknown');
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

test('previewRequestFor and joinRequestFor with null state do not throw and return null', () => {
  assert.strictEqual(previewRequestFor(null), null);
  assert.strictEqual(joinRequestFor(null), null);
});
