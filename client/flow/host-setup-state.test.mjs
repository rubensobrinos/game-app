import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialHostSetupState, transition, createRequestFor } from './host-setup-state.mjs';

// DECISIONS.md #31/#32/#35: Groepsbattle and mixed games are not built for
// this MVP — the quick-start default is single-gameType (flags_mc).
const DEFAULT_CONFIG = {
  preset: 'default',
  gameTypes: ['flags_mc'],
  language: 'nl',
  difficulty: 'normal',
  totalRounds: 10,
  pacing: 'auto',
  speedBonus: true,
  allowLateJoin: true,
  mode: 'individual',
};

test('1. initialHostSetupState() carries the confirmed quick-start default and hostParticipates: true', () => {
  const state = initialHostSetupState();
  assert.deepStrictEqual(state.config, DEFAULT_CONFIG);
  assert.strictEqual(state.hostParticipates, true);
  assert.strictEqual(state.mode, 'quick-start');
  assert.strictEqual(state.status, 'editing');
  assert.strictEqual(state.displayName, null);
  assert.strictEqual(state.errorCode, null);
});

// Corrected after cross-module review: createRequestFor is only non-null
// during 'creating', mirroring join-state's joinRequestFor during 'submitting'
// (GF2a). The original version of this module gated on 'editing' instead —
// internally consistent on its own, but the opposite convention from its
// sibling, which would have tripped up any wiring code written against both
// with the same assumption. Every test below now dispatches SUBMIT before
// calling createRequestFor.
test('2. SUBMIT right after init, with no SET_FIELD calls, yields a valid request with the defaults', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  const request = createRequestFor(submitting);
  assert.deepStrictEqual(request, {
    config: DEFAULT_CONFIG,
    hostParticipates: true,
    displayName: null,
  });
});

test('3. SET_FIELD(difficulty, hard) then submit: request has difficulty hard, other fields unchanged', () => {
  const edited = transition(initialHostSetupState(), {
    type: 'SET_FIELD',
    key: 'difficulty',
    value: 'hard',
  });
  const submitting = transition(edited, { type: 'SUBMIT' });
  const request = createRequestFor(submitting);
  assert.strictEqual(request.config.difficulty, 'hard');
  assert.deepStrictEqual(request.config, { ...DEFAULT_CONFIG, difficulty: 'hard' });
});

test('4. SET_FIELD with an unknown key is ignored; config is unchanged', () => {
  const initial = initialHostSetupState();
  const state = transition(initial, { type: 'SET_FIELD', key: 'notARealField', value: 'x' });
  assert.deepStrictEqual(state.config, DEFAULT_CONFIG);
  assert.deepStrictEqual(state, initial);
});

test('5. TOGGLE_HOST_PARTICIPATES to false after a filled-in name: displayName is null in the next createRequestFor', () => {
  const named = transition(initialHostSetupState(), { type: 'NAME_CHANGED', value: 'Ruben' });
  assert.strictEqual(named.displayName, 'Ruben');

  const toggledOff = transition(named, { type: 'TOGGLE_HOST_PARTICIPATES' });
  assert.strictEqual(toggledOff.hostParticipates, false);

  const submitting = transition(toggledOff, { type: 'SUBMIT' });
  const request = createRequestFor(submitting);
  assert.strictEqual(request.displayName, null);
});

test('6. toggling hostParticipates back to true does not restore the previous name', () => {
  const named = transition(initialHostSetupState(), { type: 'NAME_CHANGED', value: 'Ruben' });
  const toggledOff = transition(named, { type: 'TOGGLE_HOST_PARTICIPATES' });
  const toggledOn = transition(toggledOff, { type: 'TOGGLE_HOST_PARTICIPATES' });

  assert.strictEqual(toggledOn.hostParticipates, true);
  assert.strictEqual(toggledOn.displayName, null);
});

// Same chosen behavior as GF2a join-state test 5: truncate to 20 grapheme
// clusters rather than reject.
test('7a. NAME_CHANGED with 21 plain characters is truncated to 20', () => {
  const raw = 'a'.repeat(21);
  const state = transition(initialHostSetupState(), { type: 'NAME_CHANGED', value: raw });
  assert.strictEqual(state.displayName, 'a'.repeat(20));
  assert.strictEqual(state.displayName.length, 20);
});

test('7b. a 4-codepoint family emoji + 19 other characters counts as 20 grapheme clusters, not truncated', () => {
  const familyEmoji = '\u{1F469}\u{1F3FD}\u{200D}\u{1F466}';
  const raw = familyEmoji + 'a'.repeat(19);
  assert.strictEqual([...raw].length, 23);

  const state = transition(initialHostSetupState(), { type: 'NAME_CHANGED', value: raw });
  assert.strictEqual(state.displayName, raw);

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  assert.strictEqual([...segmenter.segment(state.displayName)].length, 20);
});

test('8a. CREATE_SUCCEEDED from creating moves to created', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  assert.strictEqual(submitting.status, 'creating');

  const created = transition(submitting, { type: 'CREATE_SUCCEEDED' });
  assert.strictEqual(created.status, 'created');
  assert.strictEqual(created.errorCode, null);
});

test('8b. CREATE_FAILED from creating moves to error with the error code', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  const errored = transition(submitting, { type: 'CREATE_FAILED', errorCode: 'room_limit_reached' });
  assert.strictEqual(errored.status, 'error');
  assert.strictEqual(errored.errorCode, 'room_limit_reached');
});

test('8c. RETRY from error returns to editing, resetting displayName and errorCode to null', () => {
  const named = transition(initialHostSetupState(), { type: 'NAME_CHANGED', value: 'Ruben' });
  const submitting = transition(named, { type: 'SUBMIT' });
  const errored = transition(submitting, { type: 'CREATE_FAILED', errorCode: 'server_error' });

  const retried = transition(errored, { type: 'RETRY' });
  assert.strictEqual(retried.status, 'editing');
  assert.strictEqual(retried.displayName, null);
  assert.strictEqual(retried.errorCode, null);
  assert.deepStrictEqual(retried.config, DEFAULT_CONFIG);
});

test('9a. createRequestFor during editing (before SUBMIT) is null', () => {
  assert.strictEqual(createRequestFor(initialHostSetupState()), null);
});

test('9b. createRequestFor during created is null', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  const created = transition(submitting, { type: 'CREATE_SUCCEEDED' });
  assert.strictEqual(createRequestFor(created), null);
});

test('9c. createRequestFor during error is null', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  const errored = transition(submitting, { type: 'CREATE_FAILED', errorCode: 'server_error' });
  assert.strictEqual(createRequestFor(errored), null);
});

test('9d. createRequestFor during creating (the intended window) is non-null', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  assert.notStrictEqual(createRequestFor(submitting), null);
});

// Beyond the required table: additional cases proving no function throws for
// malformed input or out-of-status events, matching the sibling modules'
// contract (route-resolver, join-state).

test('OPEN_ADVANCED switches mode to advanced without touching config', () => {
  const state = transition(initialHostSetupState(), { type: 'OPEN_ADVANCED' });
  assert.strictEqual(state.mode, 'advanced');
  assert.deepStrictEqual(state.config, DEFAULT_CONFIG);
});

test('OPEN_ADVANCED outside editing is ignored, no throw', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  assert.deepStrictEqual(transition(submitting, { type: 'OPEN_ADVANCED' }), submitting);
});

test('SET_FIELD outside editing is ignored, no throw', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  const result = transition(submitting, { type: 'SET_FIELD', key: 'difficulty', value: 'hard' });
  assert.deepStrictEqual(result, submitting);
});

test('TOGGLE_HOST_PARTICIPATES outside editing is ignored, no throw', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  assert.deepStrictEqual(transition(submitting, { type: 'TOGGLE_HOST_PARTICIPATES' }), submitting);
});

test('NAME_CHANGED outside editing is ignored, no throw', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  assert.deepStrictEqual(transition(submitting, { type: 'NAME_CHANGED', value: 'Ruben' }), submitting);
});

test('NAME_CHANGED with an empty string resets displayName to null', () => {
  const named = transition(initialHostSetupState(), { type: 'NAME_CHANGED', value: 'Ruben' });
  const cleared = transition(named, { type: 'NAME_CHANGED', value: '' });
  assert.strictEqual(cleared.displayName, null);
});

test('NAME_CHANGED with a non-string value does not throw and clears to null', () => {
  const state = transition(initialHostSetupState(), { type: 'NAME_CHANGED', value: 42 });
  assert.strictEqual(state.displayName, null);
});

test('SUBMIT outside editing (double submit) is ignored, no throw', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  assert.deepStrictEqual(transition(submitting, { type: 'SUBMIT' }), submitting);
});

test('CREATE_SUCCEEDED outside creating is ignored, no throw', () => {
  const initial = initialHostSetupState();
  assert.deepStrictEqual(transition(initial, { type: 'CREATE_SUCCEEDED' }), initial);
});

test('CREATE_FAILED outside creating is ignored, no throw', () => {
  const initial = initialHostSetupState();
  assert.deepStrictEqual(transition(initial, { type: 'CREATE_FAILED', errorCode: 'x' }), initial);
});

test('CREATE_FAILED with a non-string errorCode falls back to "unknown", no throw', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  const errored = transition(submitting, { type: 'CREATE_FAILED', errorCode: undefined });
  assert.strictEqual(errored.errorCode, 'unknown');
});

test('RETRY outside error is ignored, no throw', () => {
  const initial = initialHostSetupState();
  assert.deepStrictEqual(transition(initial, { type: 'RETRY' }), initial);
});

test('transition with null state does not throw and returns null', () => {
  assert.strictEqual(transition(null, { type: 'SUBMIT' }), null);
});

test('transition with undefined event does not throw and returns state unchanged', () => {
  const initial = initialHostSetupState();
  assert.deepStrictEqual(transition(initial, undefined), initial);
});

test('transition with an unknown event type does not throw and returns state unchanged', () => {
  const initial = initialHostSetupState();
  assert.deepStrictEqual(transition(initial, { type: 'SOMETHING_ELSE' }), initial);
});

test('createRequestFor with null state does not throw and returns null', () => {
  assert.strictEqual(createRequestFor(null), null);
});

test('createRequestFor does not leak a shared gameTypes array reference', () => {
  const submitting = transition(initialHostSetupState(), { type: 'SUBMIT' });
  const request = createRequestFor(submitting);
  request.config.gameTypes.push('mutated');
  assert.deepStrictEqual(submitting.config.gameTypes, DEFAULT_CONFIG.gameTypes);
});
