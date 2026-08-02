import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateOptionIdAnswer,
  validateChoiceAnswer,
  validateSideAnswer,
  validateCardIndexAnswer,
  validateTextAnswer,
} from './client-events-round-answer-variants.mjs';
import {
  validateGameStartPayload,
  validateGamePausePayload,
  validateGameResumePayload,
  validateGameNextPayload,
} from './client-events-game-lifecycle-a.mjs';
import {
  validateGameLockPayload,
  validateGameKickPayload,
  validateGameFinishPayload,
  validateGameRematchPayload,
} from './client-events-game-lifecycle-b.mjs';
import {
  validatePlayerRenamePayload,
  validatePlayerLeavePayload,
  validateRoundAnswerEnvelope,
  validateShareOpenedPayload,
} from './client-events-dispatch.mjs';

// Rij 26/27 — optionId.
test('validateOptionIdAnswer: { optionId: "opt_2" } -> ok', () => {
  assert.deepEqual(validateOptionIdAnswer({ optionId: 'opt_2' }), { ok: true });
});

test('validateOptionIdAnswer: { optionId: "" } -> afgewezen', () => {
  assert.deepEqual(validateOptionIdAnswer({ optionId: '' }), { ok: false, code: null });
});

test('validateOptionIdAnswer: { optionId: 2 } -> afgewezen (verkeerd type)', () => {
  assert.deepEqual(validateOptionIdAnswer({ optionId: 2 }), { ok: false, code: null });
});

// Rij 28/29 — choice.
test('validateChoiceAnswer: { choice: "real" } -> ok', () => {
  assert.deepEqual(validateChoiceAnswer({ choice: 'real' }), { ok: true });
});

test('validateChoiceAnswer: { choice: "fake" } -> ok', () => {
  assert.deepEqual(validateChoiceAnswer({ choice: 'fake' }), { ok: true });
});

test('validateChoiceAnswer: { choice: "" } -> afgewezen', () => {
  assert.deepEqual(validateChoiceAnswer({ choice: '' }), { ok: false, code: null });
});

test('validateChoiceAnswer: { choice: 1 } -> afgewezen (verkeerd type)', () => {
  assert.deepEqual(validateChoiceAnswer({ choice: 1 }), { ok: false, code: null });
});

// Rij 30/31 — side.
test('validateSideAnswer: { side: 0 } -> ok', () => {
  assert.deepEqual(validateSideAnswer({ side: 0 }), { ok: true });
});

test('validateSideAnswer: { side: 1 } -> ok', () => {
  assert.deepEqual(validateSideAnswer({ side: 1 }), { ok: true });
});

test('validateSideAnswer: { side: -1 } -> afgewezen', () => {
  assert.deepEqual(validateSideAnswer({ side: -1 }), { ok: false, code: null });
});

test('validateSideAnswer: { side: 1.5 } -> afgewezen', () => {
  assert.deepEqual(validateSideAnswer({ side: 1.5 }), { ok: false, code: null });
});

test('validateSideAnswer: { side: "0" } -> afgewezen (verkeerd type)', () => {
  assert.deepEqual(validateSideAnswer({ side: '0' }), { ok: false, code: null });
});

// Rij 32/33 — cardIndex.
test('validateCardIndexAnswer: { cardIndex: 0 } -> ok', () => {
  assert.deepEqual(validateCardIndexAnswer({ cardIndex: 0 }), { ok: true });
});

test('validateCardIndexAnswer: { cardIndex: 3 } -> ok', () => {
  assert.deepEqual(validateCardIndexAnswer({ cardIndex: 3 }), { ok: true });
});

test('validateCardIndexAnswer: { cardIndex: -1 } -> afgewezen', () => {
  assert.deepEqual(validateCardIndexAnswer({ cardIndex: -1 }), { ok: false, code: null });
});

test('validateCardIndexAnswer: { cardIndex: 1.5 } -> afgewezen', () => {
  assert.deepEqual(validateCardIndexAnswer({ cardIndex: 1.5 }), { ok: false, code: null });
});

// Rij 34/35 — text.
test('validateTextAnswer: { text: "Argentinie" } -> ok', () => {
  assert.deepEqual(validateTextAnswer({ text: 'Argentinie' }), { ok: true });
});

test('validateTextAnswer: { text: "" } -> afgewezen', () => {
  assert.deepEqual(validateTextAnswer({ text: '' }), { ok: false, code: null });
});

test('validateTextAnswer: { text: "   " } -> afgewezen (alleen whitespace)', () => {
  assert.deepEqual(validateTextAnswer({ text: '   ' }), { ok: false, code: null });
});

test('validateTextAnswer: { text: 123 } -> afgewezen (verkeerd type)', () => {
  assert.deepEqual(validateTextAnswer({ text: 123 }), { ok: false, code: null });
});

// Rij 36 — elke variant-validator met een tweede, vreemde sleutel erbij:
// stuk voor stuk afgewezen (strikt schema).
const variantValidatorsWithFixture = [
  ['optionId', validateOptionIdAnswer, { optionId: 'opt_2' }],
  ['choice', validateChoiceAnswer, { choice: 'real' }],
  ['side', validateSideAnswer, { side: 0 }],
  ['cardIndex', validateCardIndexAnswer, { cardIndex: 0 }],
  ['text', validateTextAnswer, { text: 'Argentinie' }],
];

for (const [label, validator, fixture] of variantValidatorsWithFixture) {
  test(`${label}: extra sleutel "correctOptionId" -> afgewezen (strikt schema)`, () => {
    assert.deepEqual(validator({ ...fixture, correctOptionId: 'opt_2' }), { ok: false, code: null });
  });
}

// Rij 25 — cross-cutting negatieve test (Basisregel 3), over alle 17
// schema's (12 client-events + 5 PR4d-varianten): een overigens geldige
// fixture met telkens één extra sessionToken/token/bearer/authorization-
// sleutel erbij moet worden afgewezen. Geen enkel schema kent deze namen bij
// naam — de strikte "geen extra sleutels"-regel (Ontwerpkeuze #1 in alle
// PR4-bestanden) maakt dit vanzelf waar.
const allSeventeenSchemas = [
  ['game:start', validateGameStartPayload, {}],
  ['game:pause', validateGamePausePayload, {}],
  ['game:resume', validateGameResumePayload, {}],
  ['game:next', validateGameNextPayload, {}],
  ['game:lock', validateGameLockPayload, { locked: true }],
  ['game:kick', validateGameKickPayload, { playerId: 'p_1' }],
  ['game:finish', validateGameFinishPayload, {}],
  ['game:rematch', validateGameRematchPayload, {}],
  ['player:rename', validatePlayerRenamePayload, { displayName: 'Ruben' }],
  ['player:leave', validatePlayerLeavePayload, {}],
  [
    'round:answer (envelope)',
    validateRoundAnswerEnvelope,
    { roundId: 'round_07', answer: { optionId: 'opt_2' }, clientAnsweredAt: 1785623418451 },
  ],
  ['share:opened', validateShareOpenedPayload, { method: 'qr' }],
  ['round:answer.answer optionId-variant', validateOptionIdAnswer, { optionId: 'opt_2' }],
  ['round:answer.answer choice-variant', validateChoiceAnswer, { choice: 'real' }],
  ['round:answer.answer side-variant', validateSideAnswer, { side: 0 }],
  ['round:answer.answer cardIndex-variant', validateCardIndexAnswer, { cardIndex: 0 }],
  ['round:answer.answer text-variant', validateTextAnswer, { text: 'Argentinie' }],
];

test('cross-cutting Bearer-test: exact 17 schema-fixtures worden getoetst (12 events + 5 varianten)', () => {
  assert.equal(allSeventeenSchemas.length, 17);
});

const bearerLikeKeys = ['sessionToken', 'token', 'bearer', 'authorization'];

for (const [label, validator, fixture] of allSeventeenSchemas) {
  // Baseline: de fixture zelf moet ok zijn, anders bewijst de afwijzing
  // hieronder niets over het Bearer-veld specifiek.
  test(`cross-cutting Bearer-test — baseline: "${label}" fixture is zelf ok`, () => {
    assert.deepEqual(validator(fixture), { ok: true });
  });

  for (const bearerKey of bearerLikeKeys) {
    test(`cross-cutting Bearer-test: "${label}" + "${bearerKey}"-sleutel -> afgewezen`, () => {
      const polluted = { ...fixture, [bearerKey]: 'secret-value' };
      const result = validator(polluted);
      assert.equal(result.ok, false);
    });
  }
}
