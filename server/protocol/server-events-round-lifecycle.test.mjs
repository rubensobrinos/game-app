import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGamePausedPayload,
  validateGameResumedPayload,
  validateRoundStartedPayload,
  validateRoundAnswerAcceptedPayload,
} from './server-events-round-lifecycle.mjs';

// Letterlijke fixture uit PROTOCOL.md §Voorbeeld `round:started` (Brondocument
// in PR5-server-events.md) — payload-deel van de envelope.
function buildLiteralRoundStartedPayload() {
  return {
    matchId: 'match_01J...',
    roundId: 'round_07',
    roundNumber: 7,
    totalRounds: 10,
    gameType: 'real_or_fake_flag',
    contentVersion: '2026.08.1',
    question: {
      promptKey: 'btnRealOrFakePrompt',
      image: {
        kind: 'generated_flag',
        seed: 'fx_91b2',
        rendererVersion: 'flag-renderer-1',
        spec: { pattern: 'nordic', palette: ['#003082', '#FFFFFF', '#CE1126'] },
      },
      options: [
        { optionId: 'real', labelKey: 'btnReal' },
        { optionId: 'fake', labelKey: 'btnFake' },
      ],
    },
    startsAt: 1785623412000,
    endsAt: 1785623427000,
  };
}

// Rij 11 — vier losse gevallen, elk representatief voor één van de vier
// scenario's uit Open vraag §2 (host-disconnect, drie lege rondes,
// expliciete hostpauze, serverherstart) — geen daarvan als foutieve waarde
// behandeld.
const pauseReasonScenarios = [
  ['host-disconnect na 60s', 'host_disconnect'],
  ['drie opeenvolgende lege rondes', 'three_consecutive_empty_rounds'],
  ['expliciete hostpauze', 'host_pause'],
  ['serverherstart (GAME-FLOW.md edge case #14)', 'server_restart'],
];
for (const [label, reason] of pauseReasonScenarios) {
  test(`validateGamePausedPayload: reason="${reason}" (${label}) → ok:true`, () => {
    assert.deepEqual(validateGamePausedPayload({ reason }), { ok: true });
  });
}

// Rij 12
test('validateGamePausedPayload: reason als getal (123) → afgewezen', () => {
  assert.deepEqual(validateGamePausedPayload({ reason: 123 }), { ok: false, code: null });
});
test('validateGamePausedPayload: {} (reason ontbreekt) → afgewezen', () => {
  assert.deepEqual(validateGamePausedPayload({}), { ok: false, code: null });
});

// Rij 13
test('validateGameResumedPayload: { countdownEndsAt } → ok:true', () => {
  assert.deepEqual(validateGameResumedPayload({ countdownEndsAt: 1785623412000 }), { ok: true });
});

// Rij 14
test('validateGameResumedPayload: countdownEndsAt als string ("straks") → afgewezen', () => {
  assert.deepEqual(
    validateGameResumedPayload({ countdownEndsAt: 'straks' }),
    { ok: false, code: null },
  );
});

// Rij 15 — het volledige, letterlijke voorbeeld
test('validateRoundStartedPayload: het volledige round:started-voorbeeld → ok:true', () => {
  assert.deepEqual(validateRoundStartedPayload(buildLiteralRoundStartedPayload()), { ok: true });
});

// Rij 16 — drie losse structurele defecten op hetzelfde voorbeeld
test('validateRoundStartedPayload: zonder question.options → afgewezen', () => {
  const payload = buildLiteralRoundStartedPayload();
  delete payload.question.options;
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: zonder startsAt → afgewezen', () => {
  const payload = buildLiteralRoundStartedPayload();
  delete payload.startsAt;
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: endsAt < startsAt → afgewezen (vormcontrole)', () => {
  const payload = buildLiteralRoundStartedPayload();
  payload.endsAt = payload.startsAt - 1;
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});

// Rij 17 — andere gameType met een question die niet aan de MC-vorm voldoet
test('validateRoundStartedPayload: gameType "higher_or_lower" met generieke question → ok:true (Open vraag §10)', () => {
  const payload = buildLiteralRoundStartedPayload();
  payload.gameType = 'higher_or_lower';
  payload.question = { promptKey: 'x' };
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: true });
});

// Rij 18
test('validateRoundAnswerAcceptedPayload: { roundId: "round_07" } → ok:true', () => {
  assert.deepEqual(validateRoundAnswerAcceptedPayload({ roundId: 'round_07' }), { ok: true });
});

// Rij 19 — drie losse gevallen
test('validateRoundAnswerAcceptedPayload: {} → afgewezen', () => {
  assert.deepEqual(validateRoundAnswerAcceptedPayload({}), { ok: false, code: null });
});
test('validateRoundAnswerAcceptedPayload: { roundId: "" } → afgewezen', () => {
  assert.deepEqual(validateRoundAnswerAcceptedPayload({ roundId: '' }), { ok: false, code: null });
});
test('validateRoundAnswerAcceptedPayload: { roundId: 7 } → afgewezen', () => {
  assert.deepEqual(validateRoundAnswerAcceptedPayload({ roundId: 7 }), { ok: false, code: null });
});
