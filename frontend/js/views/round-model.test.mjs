// Tests voor round-model.mjs — UI3. Zelfde vlakke node:test-stijl als de rest
// van frontend/js.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialRoundModel,
  applyRoundStarted,
  hydrateFromSnapshot,
  selectOption,
  applyAnswerAccepted,
  applyAnswerRejected,
  applyProgress,
  applyRoundEnded,
  displayState,
  optionsLocked,
} from './round-model.mjs';

const STARTED = {
  roundId: 'round_03',
  roundNumber: 3,
  totalRounds: 10,
  question: { targetIso2: 'FR', optionIso2s: ['FR', 'DE', 'IT', 'ES'] },
  startsAt: 1000,
  endsAt: 16000,
};

test('round:started vult de vraag en reset alles van de vorige ronde', () => {
  const stale = applyRoundEnded(
    selectOption(applyRoundStarted({ ...STARTED, roundId: 'round_02' }), 'DE'),
    { roundId: 'round_02', correctAnswer: { optionId: 'FR' }, selfCorrect: false, selfScore: 0 },
  );
  const model = applyRoundStarted(STARTED);
  assert.equal(model.roundId, 'round_03');
  assert.equal(model.answerStatus, 'idle');
  assert.equal(model.result, null);
  assert.equal(displayState(model), 'question');
  assert.equal(optionsLocked(model), false);
  // en de oude state is onaangeraakt (pure functies)
  assert.equal(stale.roundId, 'round_02');
});

test('selectOption vergrendelt: tweede tik en onbekende optie zijn no-ops', () => {
  const once = selectOption(applyRoundStarted(STARTED), 'DE');
  assert.equal(once.answerStatus, 'sending');
  assert.equal(once.selectedOptionId, 'DE');
  assert.equal(optionsLocked(once), true);
  assert.equal(selectOption(once, 'IT'), once);
  assert.equal(selectOption(applyRoundStarted(STARTED), 'XX').answerStatus, 'idle');
});

test('answer-accepted telt alleen voor de actieve ronde en vanuit sending', () => {
  const sending = selectOption(applyRoundStarted(STARTED), 'FR');
  assert.equal(applyAnswerAccepted(sending, { roundId: 'round_03' }).answerStatus, 'accepted');
  assert.equal(applyAnswerAccepted(sending, { roundId: 'round_02' }), sending);
  const idle = applyRoundStarted(STARTED);
  assert.equal(applyAnswerAccepted(idle, { roundId: 'round_03' }), idle);
});

test('rejection: DEADLINE_PASSED/ALREADY_ANSWERED blijven vergrendeld, andere codes geven de beurt terug', () => {
  const sending = selectOption(applyRoundStarted(STARTED), 'FR');
  const late = applyAnswerRejected(sending, 'DEADLINE_PASSED');
  assert.equal(late.answerStatus, 'rejected');
  assert.equal(late.selectedOptionId, 'FR');
  assert.equal(optionsLocked(late), true);
  const transient = applyAnswerRejected(sending, 'RATE_LIMITED');
  assert.equal(transient.answerStatus, 'idle');
  assert.equal(transient.selectedOptionId, null);
  assert.equal(optionsLocked(transient), false);
});

test('round:ended is de enige bron van goed/fout en negeert de verkeerde ronde', () => {
  const sending = selectOption(applyRoundStarted(STARTED), 'FR');
  const ended = applyRoundEnded(sending, {
    roundId: 'round_03',
    correctAnswer: { optionId: 'FR' },
    selfCorrect: true,
    selfScore: 187,
    distribution: { FR: 2, DE: 1 },
  });
  assert.equal(displayState(ended), 'result');
  assert.deepEqual(ended.result, {
    correctOptionId: 'FR',
    selfCorrect: true,
    selfNoAnswer: false,
    selfScore: 187,
    distribution: { FR: 2, DE: 1 },
  });
  assert.equal(applyRoundEnded(sending, { roundId: 'round_99', correctAnswer: { optionId: 'DE' } }), sending);
});

test('round:ended — selfNoAnswer: idle en DEADLINE_PASSED tellen als geen antwoord, ALREADY_ANSWERED en accepted niet', () => {
  const endedPayload = { roundId: 'round_03', correctAnswer: { optionId: 'FR' }, selfCorrect: false, selfScore: 0 };

  const neverAnswered = applyRoundStarted(STARTED); // answerStatus: 'idle'
  assert.equal(applyRoundEnded(neverAnswered, endedPayload).result.selfNoAnswer, true);

  const tooLate = applyAnswerRejected(selectOption(applyRoundStarted(STARTED), 'FR'), 'DEADLINE_PASSED');
  assert.equal(applyRoundEnded(tooLate, endedPayload).result.selfNoAnswer, true);

  // ALREADY_ANSWERED betekent dat er wél een eerder antwoord telt — deze
  // retry was overbodig, niet "geen antwoord".
  const retryAfterAlreadyAnswered = applyAnswerRejected(selectOption(applyRoundStarted(STARTED), 'FR'), 'ALREADY_ANSWERED');
  assert.equal(applyRoundEnded(retryAfterAlreadyAnswered, endedPayload).result.selfNoAnswer, false);

  const accepted = applyAnswerAccepted(selectOption(applyRoundStarted(STARTED), 'FR'), { roundId: 'round_03' });
  assert.equal(applyRoundEnded(accepted, endedPayload).result.selfNoAnswer, false);
});

test('hydrateFromSnapshot: geen actieve ronde geeft het initiële model', () => {
  assert.deepEqual(hydrateFromSnapshot({}, false), initialRoundModel());
  assert.deepEqual(hydrateFromSnapshot(null, false), initialRoundModel());
});

test('hydrateFromSnapshot: actieve ronde zonder bevestigd antwoord staat op idle (vraag zichtbaar, niet vergrendeld)', () => {
  const model = hydrateFromSnapshot(STARTED, false);
  assert.equal(model.roundId, 'round_03');
  assert.equal(model.question.targetIso2, 'FR');
  assert.equal(model.answerStatus, 'idle');
  assert.equal(optionsLocked(model), false);
});

test('hydrateFromSnapshot: answeredCurrentRound=true vergrendelt zonder een gekozen optie te verzinnen', () => {
  const model = hydrateFromSnapshot(STARTED, true);
  assert.equal(model.answerStatus, 'accepted');
  assert.equal(model.selectedOptionId, null);
  assert.equal(optionsLocked(model), true);
});

test('hydrateFromSnapshot ná reconnect: round:ended toont dan terecht geen GEEN ANTWOORD', () => {
  const rehydrated = hydrateFromSnapshot(STARTED, true);
  const ended = applyRoundEnded(rehydrated, {
    roundId: 'round_03',
    correctAnswer: { optionId: 'FR' },
    selfCorrect: true,
    selfScore: 100,
  });
  assert.equal(ended.result.selfNoAnswer, false);
});

test('progress: laatste telling wint, zonder namen', () => {
  const m = applyProgress(applyRoundStarted(STARTED), { answeredCount: 2, eligiblePlayerCount: 5 });
  const m2 = applyProgress(m, { answeredCount: 4, eligiblePlayerCount: 5 });
  assert.deepEqual(m2.progress, { answeredCount: 4, eligiblePlayerCount: 5 });
});

test('modellen zijn bevroren', () => {
  const m = applyRoundStarted(STARTED);
  assert.throws(() => { m.answerStatus = 'accepted'; }, TypeError);
  assert.throws(() => { initialRoundModel().roundId = 'x'; }, TypeError);
});
