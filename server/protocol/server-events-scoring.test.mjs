import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRoundProgressPayload,
  validateRoundEndedPayload,
  validateScoreboardUpdatedPayload,
  validateGameFinishedPayload,
} from './server-events-scoring.mjs';

// Rij 20
test('validateRoundProgressPayload: { answeredCount: 3, eligiblePlayerCount: 5 } → ok:true', () => {
  assert.deepEqual(
    validateRoundProgressPayload({ answeredCount: 3, eligiblePlayerCount: 5 }),
    { ok: true },
  );
});

// Rij 21 — vier losse gevallen
test('validateRoundProgressPayload: answeredCount > eligiblePlayerCount → afgewezen', () => {
  const result = validateRoundProgressPayload({ answeredCount: 5, eligiblePlayerCount: 3 });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateRoundProgressPayload: answeredCount negatief → afgewezen', () => {
  const result = validateRoundProgressPayload({ answeredCount: -1, eligiblePlayerCount: 5 });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateRoundProgressPayload: eligiblePlayerCount negatief → afgewezen', () => {
  const result = validateRoundProgressPayload({ answeredCount: 0, eligiblePlayerCount: -1 });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateRoundProgressPayload: eligiblePlayerCount ontbreekt → afgewezen', () => {
  const result = validateRoundProgressPayload({ answeredCount: 3 });
  assert.deepEqual(result, { ok: false, code: null });
});

// Rij 22
test('validateRoundEndedPayload: geldige fixture → ok:true', () => {
  assert.deepEqual(
    validateRoundEndedPayload({
      roundId: 'round_07',
      correctAnswer: { optionId: 'opt_2' },
      ownPoints: 120,
    }),
    { ok: true },
  );
});

// Rij 23 — extra distribution-veld verandert de uitkomst niet
test('validateRoundEndedPayload: zelfde fixture + extra distribution → nog steeds ok:true (Open vraag §11)', () => {
  assert.deepEqual(
    validateRoundEndedPayload({
      roundId: 'round_07',
      correctAnswer: { optionId: 'opt_2' },
      ownPoints: 120,
      distribution: { opt_1: 4, opt_2: 9 },
    }),
    { ok: true },
  );
});

// Rij 24 — twee losse gevallen
test('validateRoundEndedPayload: ontbrekend roundId → afgewezen', () => {
  const result = validateRoundEndedPayload({
    correctAnswer: { optionId: 'opt_2' },
    ownPoints: 120,
  });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateRoundEndedPayload: ownPoints negatief (-5) → afgewezen', () => {
  const result = validateRoundEndedPayload({
    roundId: 'round_07',
    correctAnswer: { optionId: 'opt_2' },
    ownPoints: -5,
  });
  assert.deepEqual(result, { ok: false, code: null });
});

// Rij 25
test('validateScoreboardUpdatedPayload: geldige fixture → ok:true', () => {
  assert.deepEqual(
    validateScoreboardUpdatedPayload({
      top: [{ playerId: 'p_1', score: 900 }],
      self: { position: 4 },
    }),
    { ok: true },
  );
});

// Rij 26 — twee losse gevallen
test('validateScoreboardUpdatedPayload: top als object i.p.v. array → afgewezen', () => {
  const result = validateScoreboardUpdatedPayload({ top: { 0: {} }, self: { position: 4 } });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateScoreboardUpdatedPayload: self ontbreekt → afgewezen', () => {
  const result = validateScoreboardUpdatedPayload({ top: [] });
  assert.deepEqual(result, { ok: false, code: null });
});

// Rij 27
test('validateGameFinishedPayload: geldige fixture → ok:true', () => {
  assert.deepEqual(
    validateGameFinishedPayload({ podium: [{ playerId: 'p_1' }], self: { score: 900 } }),
    { ok: true },
  );
});

// Rij 28 — twee losse gevallen
test('validateGameFinishedPayload: podium als string → afgewezen', () => {
  const result = validateGameFinishedPayload({ podium: 'p_1', self: { score: 900 } });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateGameFinishedPayload: self ontbreekt → afgewezen', () => {
  const result = validateGameFinishedPayload({ podium: [{ playerId: 'p_1' }] });
  assert.deepEqual(result, { ok: false, code: null });
});
