// Tests voor round-model.mjs — UI3. Zelfde vlakke node:test-stijl als de rest
// van frontend/js.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialRoundModel,
  applyRoundStarted,
  applyRoundResumed,
  hydrateFromSnapshot,
  selectOption,
  selectChoice,
  selectSide,
  answerPayloadFor,
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
    { roundId: 'round_02', correctAnswer: { optionId: 'FR' }, ownCorrect: false, ownPoints: 0 },
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
    ownCorrect: true,
    ownPoints: 187,
    distribution: [{ optionId: 'FR', count: 2 }, { optionId: 'DE', count: 1 }],
  });
  assert.equal(displayState(ended), 'result');
  assert.deepEqual(ended.result, {
    correctOptionId: 'FR',
    correctChoice: null,
    correctSide: null,
    // C-2 (5 aug 2026): odd_one_out kwam erbij, met een kaartindex als
    // antwoordvorm en `resultDetails` voor de uitlegregel. Beide staan altijd
    // op het model; niet-toepasselijke blijven null.
    correctCardIndex: null,
    selfCorrect: true,
    selfNoAnswer: false,
    roundPoints: 187,
    distribution: [{ optionId: 'FR', count: 2 }, { optionId: 'DE', count: 1 }],
    resultDetails: null,
  });
  assert.equal(applyRoundEnded(sending, { roundId: 'round_99', correctAnswer: { optionId: 'DE' } }), sending);
});

test('round:ended — selfNoAnswer: idle en DEADLINE_PASSED tellen als geen antwoord, ALREADY_ANSWERED en accepted niet', () => {
  const endedPayload = { roundId: 'round_03', correctAnswer: { optionId: 'FR' }, ownCorrect: false, ownPoints: 0 };

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
    ownCorrect: true,
    ownPoints: 100,
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

// ---------------------------------------------------------------------------
// 14-S09-S10: gameType-generalisatie. Bestaande callers sturen geen gameType
// mee (transport-mock.mjs, alle tests hierboven) — flags_mc blijft de
// default, geen van de bestaande tests hierboven hoefde te wijzigen op dat
// punt.

test('gameType: ontbreekt in de payload -> flags_mc (bestaande callers blijven werken)', () => {
  assert.equal(applyRoundStarted(STARTED).gameType, 'flags_mc');
  assert.equal(initialRoundModel().gameType, null);
});

test('gameType: komt letterlijk uit round:started mee', () => {
  const model = applyRoundStarted({ ...STARTED, gameType: 'real_or_fake_flag', question: { kind: 'real', iso2: 'IT' } });
  assert.equal(model.gameType, 'real_or_fake_flag');
});

test('selectChoice (S09): vergrendelt op geldige keuze, negeert ongeldige/tweede tik', () => {
  const started = applyRoundStarted({ ...STARTED, gameType: 'real_or_fake_flag', question: { kind: 'real', iso2: 'IT' } });
  const once = selectChoice(started, 'real');
  assert.equal(once.answerStatus, 'sending');
  assert.equal(once.selectedChoice, 'real');
  assert.equal(optionsLocked(once), true);
  assert.equal(selectChoice(once, 'fake'), once);
  assert.equal(selectChoice(started, 'onzin'), started);
});

test('selectSide (S10): vergrendelt op geldige zijde (0 of 1), negeert ongeldige/tweede tik', () => {
  const question = { metric: 'population', sides: [{ side: 0, iso2: 'DE' }, { side: 1, iso2: 'PT' }] };
  const started = applyRoundStarted({ ...STARTED, gameType: 'higher_lower', question });
  const once = selectSide(started, 0);
  assert.equal(once.answerStatus, 'sending');
  assert.equal(once.selectedSide, 0);
  assert.equal(optionsLocked(once), true);
  assert.equal(selectSide(once, 1), once);
  assert.equal(selectSide(started, 2), started);
  // 0 is falsy — regressietest tegen een `!side`/`side ||`-achtige bug.
  const zeroSelected = selectSide(applyRoundStarted({ ...STARTED, gameType: 'higher_lower', question }), 0);
  assert.equal(zeroSelected.selectedSide, 0);
});

test('answerPayloadFor: levert de juiste round:answer-vorm per gameType, null zolang niets gekozen is', () => {
  const flagsMc = selectOption(applyRoundStarted(STARTED), 'FR');
  assert.deepEqual(answerPayloadFor(flagsMc), { optionId: 'FR' });
  assert.equal(answerPayloadFor(applyRoundStarted(STARTED)), null);

  const rofQuestion = { kind: 'real', iso2: 'IT' };
  const rof = selectChoice(applyRoundStarted({ ...STARTED, gameType: 'real_or_fake_flag', question: rofQuestion }), 'fake');
  assert.deepEqual(answerPayloadFor(rof), { choice: 'fake' });

  const hlQuestion = { metric: 'population', sides: [{ side: 0, iso2: 'DE' }, { side: 1, iso2: 'PT' }] };
  const hl = selectSide(applyRoundStarted({ ...STARTED, gameType: 'higher_lower', question: hlQuestion }), 1);
  assert.deepEqual(answerPayloadFor(hl), { side: 1 });
});

test('applyRoundEnded: correctChoice/correctSide komen uit correctAnswer, ongeacht gameType', () => {
  const rofEnded = applyRoundEnded(
    selectChoice(applyRoundStarted({ ...STARTED, gameType: 'real_or_fake_flag', question: { kind: 'real', iso2: 'IT' } }), 'real'),
    { roundId: 'round_03', correctAnswer: { choice: 'real' }, ownCorrect: true, ownPoints: 150 },
  );
  assert.equal(rofEnded.result.correctChoice, 'real');
  assert.equal(rofEnded.result.correctOptionId, null);
  assert.equal(rofEnded.result.correctSide, null);

  const hlQuestion = { metric: 'population', sides: [{ side: 0, iso2: 'DE' }, { side: 1, iso2: 'PT' }] };
  const hlEnded = applyRoundEnded(
    selectSide(applyRoundStarted({ ...STARTED, gameType: 'higher_lower', question: hlQuestion }), 0),
    { roundId: 'round_03', correctAnswer: { side: 0 }, ownCorrect: true, ownPoints: 120 },
  );
  assert.equal(hlEnded.result.correctSide, 0);
  assert.equal(hlEnded.result.correctChoice, null);
  assert.equal(hlEnded.result.correctOptionId, null);
});

// R2-7: pauzeren schuift de rondedeadline op. Zonder dit telt de client door
// naar de oude tijd en staat de timer na het hervatten meteen op nul.
test('applyRoundResumed: een nieuwe deadline verschuift alleen endsAt', () => {
  const actief = selectOption(applyRoundStarted(STARTED), 'FR');
  const hervat = applyRoundResumed(actief, { roundEndsAt: actief.endsAt + 8000 });
  assert.equal(hervat.endsAt, actief.endsAt + 8000);
  assert.equal(hervat.answerStatus, actief.answerStatus, 'antwoordstatus blijft');
  assert.equal(hervat.selectedOptionId, 'FR', 'de selectie blijft');
  assert.deepEqual(hervat.question, actief.question);
});

test('applyRoundResumed: zonder deadline of zonder ronde verandert er niets', () => {
  const actief = applyRoundStarted(STARTED);
  assert.equal(applyRoundResumed(actief, {}), actief);
  assert.equal(applyRoundResumed(actief, { roundEndsAt: 'straks' }), actief);
  const leeg = initialRoundModel();
  assert.equal(applyRoundResumed(leeg, { roundEndsAt: 123 }), leeg);
});
