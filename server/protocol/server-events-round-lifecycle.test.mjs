import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGamePausedPayload,
  validateGameResumedPayload,
  validateRoundStartedPayload,
  validateRoundAnswerAcceptedPayload,
} from './server-events-round-lifecycle.mjs';

// PR11 §2 — de fixture is herbouwd op de ECHTE `publicQuestionPayload`-vorm
// die `server/rules/question-selection.js` daadwerkelijk produceert (niet de
// eerder verzonnen `promptKey`/`image`/`options`-vorm, die met geen enkele
// spelvorm overeenkwam). Envelope bevat nu ook het algemene top-level
// `rendererVersion`-roundveld (DECISIONS.md punt 21), naast het geneste
// `rendererVersion` binnen `real_or_fake_flag`'s `{ kind: 'generated', ... }`.
function buildRoundStartedPayload({ gameType, question, rendererVersion = 'flag-renderer-1' }) {
  return {
    matchId: 'match_01J...',
    roundId: 'round_07',
    roundNumber: 7,
    totalRounds: 10,
    gameType,
    contentVersion: '2026.08.1',
    rendererVersion,
    // Ondiepe kopie: sommige tests `delete` een toplevel question-sleutel op
    // het geretourneerde payload (bv. "zonder question.spec"). Zonder kopie
    // zou dat het gedeelde `VALID_QUESTIONS_BY_GAME_TYPE`-fixture-object zelf
    // muteren en latere, ogenschijnlijk ongerelateerde tests laten falen.
    question: { ...question },
    startsAt: 1785623412000,
    endsAt: 1785623427000,
  };
}

// De vijf echte `publicQuestionPayload`-vormen uit `question-selection.js`,
// één per `gameType` (`selectFlagsMcQuestion`, `selectCapitalsMcQuestion`,
// `selectRealOrFakeFlagQuestion` (twee kinds), `selectHigherLowerQuestion`,
// `selectOddOneOutQuestion`). Elke fixture 1-op-1 herleidbaar tot de
// bijbehorende `select*Question`-return in dat bestand.
const VALID_QUESTIONS_BY_GAME_TYPE = {
  flags_mc: { targetIso2: 'FR', optionIso2s: ['FR', 'DE', 'ES', 'IT'] },
  capitals_mc: { targetIso2: 'FR', optionIso2s: ['FR', 'DE', 'ES', 'IT'] },
  real_or_fake_flag_real: { kind: 'real', iso2: 'FR' },
  real_or_fake_flag_generated: {
    kind: 'generated',
    seed: 'fx_91b2c3d4',
    rendererVersion: 'flag-renderer-1',
    spec: { pattern: 'nordic', palette: ['#003082', '#FFFFFF', '#CE1126'] },
  },
  higher_lower: {
    metric: 'population',
    sides: [
      { side: 0, iso2: 'FR' },
      { side: 1, iso2: 'DE' },
    ],
  },
  odd_one_out: {
    cards: [
      { cardIndex: 0, iso2: 'FR' },
      { cardIndex: 1, iso2: 'DE' },
      { cardIndex: 2, iso2: 'ES' },
      { cardIndex: 3, iso2: 'BR' },
    ],
  },
};

// Letterlijke fixture voor de tests die niet spelvorm-specifiek zijn
// (envelopevelden, startsAt/endsAt, ...) — gebruikt `real_or_fake_flag`'s
// "generated"-variant, de vorm met de meeste velden.
function buildLiteralRoundStartedPayload() {
  return buildRoundStartedPayload({
    gameType: 'real_or_fake_flag',
    question: VALID_QUESTIONS_BY_GAME_TYPE.real_or_fake_flag_generated,
  });
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
test('validateRoundStartedPayload: zonder question.spec (real_or_fake_flag "generated") → afgewezen', () => {
  const payload = buildLiteralRoundStartedPayload();
  delete payload.question.spec;
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

// Rij 17 — onbekende gameType (typo, geen van de vijf echte spelvormen) met
// een generieke question → coulantere fallback blijft van toepassing.
test('validateRoundStartedPayload: gameType "higher_or_lower" (onbekend) met generieke question → ok:true (fallback)', () => {
  const payload = buildLiteralRoundStartedPayload();
  payload.gameType = 'higher_or_lower';
  payload.question = { promptKey: 'x' };
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: true });
});

// PR11 §2 — top-level rendererVersion (algemeen roundveld naast
// contentVersion, DECISIONS.md punt 21).
test('validateRoundStartedPayload: zonder top-level rendererVersion → afgewezen', () => {
  const payload = buildLiteralRoundStartedPayload();
  delete payload.rendererVersion;
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: rendererVersion als lege string → afgewezen', () => {
  const payload = buildLiteralRoundStartedPayload();
  payload.rendererVersion = '';
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: rendererVersion als getal → afgewezen', () => {
  const payload = buildLiteralRoundStartedPayload();
  payload.rendererVersion = 1;
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: onbekende gameType, extra top-level sleutel naast rendererVersion → afgewezen', () => {
  const payload = buildLiteralRoundStartedPayload();
  payload.extraField = 'oops';
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});

// PR11 §2 — discriminated question-payload per spelvorm, 1-op-1 op de echte
// `publicQuestionPayload`-vorm uit `question-selection.js`
// (`VALID_QUESTIONS_BY_GAME_TYPE` hierboven).

// flags_mc — selectFlagsMcQuestion: { targetIso2, optionIso2s }.
test('validateRoundStartedPayload: flags_mc met echte { targetIso2, optionIso2s } → ok:true', () => {
  const payload = buildRoundStartedPayload({
    gameType: 'flags_mc',
    question: VALID_QUESTIONS_BY_GAME_TYPE.flags_mc,
  });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: true });
});
test('validateRoundStartedPayload: flags_mc zonder targetIso2 → afgewezen', () => {
  const question = { ...VALID_QUESTIONS_BY_GAME_TYPE.flags_mc };
  delete question.targetIso2;
  const payload = buildRoundStartedPayload({ gameType: 'flags_mc', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: flags_mc met optionIso2s als niet-array → afgewezen', () => {
  const question = { ...VALID_QUESTIONS_BY_GAME_TYPE.flags_mc, optionIso2s: 'FR,DE,ES,IT' };
  const payload = buildRoundStartedPayload({ gameType: 'flags_mc', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: flags_mc met expliciet correctheidsveld (correctOptionId) → afgewezen (niet-afleidbaar-eis)', () => {
  const question = { ...VALID_QUESTIONS_BY_GAME_TYPE.flags_mc, correctOptionId: 'FR' };
  const payload = buildRoundStartedPayload({ gameType: 'flags_mc', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});

// capitals_mc — selectCapitalsMcQuestion: exact dezelfde vorm als flags_mc.
test('validateRoundStartedPayload: capitals_mc met echte { targetIso2, optionIso2s } → ok:true', () => {
  const payload = buildRoundStartedPayload({
    gameType: 'capitals_mc',
    question: VALID_QUESTIONS_BY_GAME_TYPE.capitals_mc,
  });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: true });
});
test('validateRoundStartedPayload: capitals_mc zonder optionIso2s → afgewezen', () => {
  const question = { ...VALID_QUESTIONS_BY_GAME_TYPE.capitals_mc };
  delete question.optionIso2s;
  const payload = buildRoundStartedPayload({ gameType: 'capitals_mc', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});

// real_or_fake_flag — selectRealOrFakeFlagQuestion: discriminated union op
// `kind` — 'real' (isReal branch) of 'generated' (fake-generatie branch).
test('validateRoundStartedPayload: real_or_fake_flag kind "real" → ok:true', () => {
  const payload = buildRoundStartedPayload({
    gameType: 'real_or_fake_flag',
    question: VALID_QUESTIONS_BY_GAME_TYPE.real_or_fake_flag_real,
  });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: true });
});
test('validateRoundStartedPayload: real_or_fake_flag kind "real" met extra spec-sleutel → afgewezen', () => {
  const question = { ...VALID_QUESTIONS_BY_GAME_TYPE.real_or_fake_flag_real, spec: {} };
  const payload = buildRoundStartedPayload({ gameType: 'real_or_fake_flag', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: real_or_fake_flag kind "generated" → ok:true', () => {
  const payload = buildRoundStartedPayload({
    gameType: 'real_or_fake_flag',
    question: VALID_QUESTIONS_BY_GAME_TYPE.real_or_fake_flag_generated,
  });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: true });
});
test('validateRoundStartedPayload: real_or_fake_flag kind "generated" zonder geneste rendererVersion → afgewezen', () => {
  const question = { ...VALID_QUESTIONS_BY_GAME_TYPE.real_or_fake_flag_generated };
  delete question.rendererVersion;
  const payload = buildRoundStartedPayload({ gameType: 'real_or_fake_flag', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: real_or_fake_flag onbekende kind ("maybe") → afgewezen', () => {
  const question = { kind: 'maybe', iso2: 'FR' };
  const payload = buildRoundStartedPayload({ gameType: 'real_or_fake_flag', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: real_or_fake_flag met expliciet correctheidsveld (choice) → afgewezen', () => {
  const question = { ...VALID_QUESTIONS_BY_GAME_TYPE.real_or_fake_flag_real, choice: 'real' };
  const payload = buildRoundStartedPayload({ gameType: 'real_or_fake_flag', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});

// higher_lower — selectHigherLowerQuestion: { metric, sides: [{ side, iso2 }] }
// met precies 2 sides (side 0 en side 1). resultDetails.values (de rauwe
// metriekwaarden) mag nooit meelekken — dat verraadt het antwoord.
test('validateRoundStartedPayload: higher_lower met echte { metric, sides } → ok:true', () => {
  const payload = buildRoundStartedPayload({
    gameType: 'higher_lower',
    question: VALID_QUESTIONS_BY_GAME_TYPE.higher_lower,
  });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: true });
});
test('validateRoundStartedPayload: higher_lower met ongeldige metric ("gdp_per_capita") → afgewezen', () => {
  const question = { ...VALID_QUESTIONS_BY_GAME_TYPE.higher_lower, metric: 'gdp_per_capita' };
  const payload = buildRoundStartedPayload({ gameType: 'higher_lower', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: higher_lower met 1 side → afgewezen (precies 2 vereist)', () => {
  const question = { ...VALID_QUESTIONS_BY_GAME_TYPE.higher_lower, sides: [{ side: 0, iso2: 'FR' }] };
  const payload = buildRoundStartedPayload({ gameType: 'higher_lower', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: higher_lower met twee keer side 0 → afgewezen', () => {
  const question = {
    ...VALID_QUESTIONS_BY_GAME_TYPE.higher_lower,
    sides: [{ side: 0, iso2: 'FR' }, { side: 0, iso2: 'DE' }],
  };
  const payload = buildRoundStartedPayload({ gameType: 'higher_lower', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: higher_lower met rules-only resultDetails.values-lek → afgewezen', () => {
  const question = {
    ...VALID_QUESTIONS_BY_GAME_TYPE.higher_lower,
    resultDetails: { values: [{ side: 0, value: 67 }, { side: 1, value: 83 }] },
  };
  const payload = buildRoundStartedPayload({ gameType: 'higher_lower', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});

// odd_one_out — selectOddOneOutQuestion: { cards: [{ cardIndex, iso2 }] } met
// precies 4 cards. resultDetails.majorityContinent/minorityContinent mag
// nooit meelekken — dat verraadt het antwoord.
test('validateRoundStartedPayload: odd_one_out met echte { cards } (4 stuks) → ok:true', () => {
  const payload = buildRoundStartedPayload({
    gameType: 'odd_one_out',
    question: VALID_QUESTIONS_BY_GAME_TYPE.odd_one_out,
  });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: true });
});
test('validateRoundStartedPayload: odd_one_out met 3 cards → afgewezen (precies 4 vereist)', () => {
  const question = { cards: VALID_QUESTIONS_BY_GAME_TYPE.odd_one_out.cards.slice(0, 3) };
  const payload = buildRoundStartedPayload({ gameType: 'odd_one_out', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: odd_one_out met dubbele cardIndex (geen permutatie van 0..3) → afgewezen', () => {
  const question = {
    cards: [
      { cardIndex: 0, iso2: 'FR' },
      { cardIndex: 0, iso2: 'DE' },
      { cardIndex: 2, iso2: 'ES' },
      { cardIndex: 3, iso2: 'BR' },
    ],
  };
  const payload = buildRoundStartedPayload({ gameType: 'odd_one_out', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: odd_one_out met rules-only resultDetails.majorityContinent-lek → afgewezen', () => {
  const question = {
    ...VALID_QUESTIONS_BY_GAME_TYPE.odd_one_out,
    resultDetails: { majorityContinent: 'Europe', minorityContinent: 'South America' },
  };
  const payload = buildRoundStartedPayload({ gameType: 'odd_one_out', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
});
test('validateRoundStartedPayload: odd_one_out met expliciet correctheidsveld (isCorrect) → afgewezen', () => {
  const question = { ...VALID_QUESTIONS_BY_GAME_TYPE.odd_one_out, isCorrect: true };
  const payload = buildRoundStartedPayload({ gameType: 'odd_one_out', question });
  assert.deepEqual(validateRoundStartedPayload(payload), { ok: false, code: null });
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
