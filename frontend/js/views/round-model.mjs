// views/round-model.mjs — UI3. Pure, lokale rondedata-state voor het
// spelscherm (flags_mc). Bewust GEEN onderdeel van client/flow's
// match-phase-state: dat bewaart alleen fase + matchId + pausedState; rondedata
// (vraag, opties, eigen antwoordstatus, voortgang, uitslag) is expliciet de
// verantwoordelijkheid van dit scherm (UI3-gameplay-screen.md §Regels).
//
// Zelfde reducer-stijl als client/flow: pure functies, geen DOM, geen timers,
// geen transport — daardoor volledig testbaar onder node:test. De DOM-laag
// (gameplay.mjs) rendert uitsluitend wat hier staat en stuurt gebruikers-
// intenties hierheen.
//
// Serverwaarheid: goed/fout of punten worden hier nooit berekend of voorspeld
// — alles komt letterlijk uit de payloads (round:ended). Vóór round:ended
// bestaat er geen goed/fout, alleen een verzendstatus.

/** @typedef {'idle' | 'sending' | 'accepted' | 'rejected'} AnswerStatus */

export function initialRoundModel() {
  return Object.freeze({
    roundId: null,
    roundNumber: null,
    totalRounds: null,
    question: null, // { targetIso2, optionIso2s } — iso2's zoals de payload ze geeft
    startsAt: null,
    endsAt: null,
    selectedOptionId: null,
    answerStatus: /** @type {AnswerStatus} */ ('idle'),
    rejectionCode: null,
    progress: null, // { answeredCount, eligiblePlayerCount }
    result: null, // { correctOptionId, selfCorrect, selfScore, distribution }
  });
}

/**
 * `round:started` — nieuwe ronde vervangt ALLE rondedata, inclusief een nog
 * hangende verzendstatus van de vorige ronde (gemiste acks verouderen hier
 * stil; de snapshot is elders leidend).
 */
export function applyRoundStarted(payload) {
  return Object.freeze({
    ...initialRoundModel(),
    roundId: payload.roundId,
    roundNumber: payload.roundNumber ?? null,
    totalRounds: payload.totalRounds ?? null,
    question: payload.question ?? null,
    startsAt: payload.startsAt ?? null,
    endsAt: payload.endsAt ?? null,
  });
}

/**
 * Gebruikers-tik op een optie. Alleen mogelijk vanuit 'idle' met een actieve
 * vraag; elke andere toestand is een no-op (opties zijn dan vergrendeld —
 * één antwoord per speler per ronde, PROTOCOL.md).
 */
export function selectOption(model, optionId) {
  if (model.answerStatus !== 'idle' || model.question === null) {
    return model;
  }
  if (!model.question.optionIso2s.includes(optionId)) {
    return model;
  }
  return Object.freeze({ ...model, selectedOptionId: optionId, answerStatus: 'sending' });
}

/** `round:answer-accepted` — alleen voor de actieve ronde. */
export function applyAnswerAccepted(model, payload) {
  if (payload.roundId !== model.roundId || model.answerStatus !== 'sending') {
    return model;
  }
  return Object.freeze({ ...model, answerStatus: 'accepted' });
}

/**
 * `send` verwierp (transportcontract: één foutmechanisme). DEADLINE_PASSED en
 * ALREADY_ANSWERED houden de opties vergrendeld — opnieuw proberen is per
 * definitie zinloos; andere codes geven de beurt terug aan de speler.
 */
export function applyAnswerRejected(model, code) {
  if (model.answerStatus !== 'sending') {
    return model;
  }
  const terminal = code === 'DEADLINE_PASSED' || code === 'ALREADY_ANSWERED';
  return Object.freeze({
    ...model,
    answerStatus: terminal ? 'rejected' : 'idle',
    selectedOptionId: terminal ? model.selectedOptionId : null,
    rejectionCode: code ?? 'UNKNOWN',
  });
}

/** `round:progress` — max 2×/s volgens PROTOCOL.md; laatste telling wint. */
export function applyProgress(model, payload) {
  return Object.freeze({
    ...model,
    progress: {
      answeredCount: payload.answeredCount,
      eligiblePlayerCount: payload.eligiblePlayerCount,
    },
  });
}

/** `round:ended` — de enige bron van goed/fout en punten. */
export function applyRoundEnded(model, payload) {
  if (payload.roundId !== model.roundId) {
    return model;
  }
  return Object.freeze({
    ...model,
    result: {
      correctOptionId: payload.correctAnswer?.optionId ?? null,
      selfCorrect: payload.selfCorrect === true,
      selfScore: typeof payload.selfScore === 'number' ? payload.selfScore : null,
      distribution: payload.distribution ?? null,
    },
  });
}

/**
 * Afgeleide weergavetoestand voor de DOM-laag: precies één van
 * 'question' | 'result' | 'empty'.
 */
export function displayState(model) {
  if (model.result !== null) return 'result';
  if (model.question !== null) return 'question';
  return 'empty';
}

/** Opties vergrendeld? (na tik, of na uitslag) */
export function optionsLocked(model) {
  return model.answerStatus !== 'idle' || model.result !== null;
}
