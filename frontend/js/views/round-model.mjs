// views/round-model.mjs — UI3. Pure, lokale rondedata-state voor het
// spelscherm. Bewust GEEN onderdeel van client/flow's match-phase-state: dat
// bewaart alleen fase + matchId + pausedState; rondedata (vraag, opties,
// eigen antwoordstatus, voortgang, uitslag) is expliciet de
// verantwoordelijkheid van dit scherm (UI3-gameplay-screen.md §Regels).
//
// Zelfde reducer-stijl als client/flow: pure functies, geen DOM, geen timers,
// geen transport — daardoor volledig testbaar onder node:test. De DOM-laag
// (gameplay.mjs) rendert uitsluitend wat hier staat en stuurt gebruikers-
// intenties hierheen.
//
// 14-S09-S10: dit model was ooit flags_mc-only. `gameType` bepaalt nu welke
// van de drie selectie-vormen (`selectedOptionId`/`selectedChoice`/
// `selectedSide`) en welk deel van `result` (`correctOptionId`/`correctChoice`/
// `correctSide`) relevant is — de niet-toepasselijke velden blijven `null`,
// geen aparte modelvorm per spelvorm. `answerPayloadFor()` is de ene plek die
// weet welke velden bij welk `gameType` horen; de DOM-laag hoeft dat zelf niet
// te weten.
//
// Serverwaarheid: goed/fout of punten worden hier nooit berekend of voorspeld
// — alles komt letterlijk uit de payloads (round:ended). Vóór round:ended
// bestaat er geen goed/fout, alleen een verzendstatus.

/** @typedef {'idle' | 'sending' | 'accepted' | 'rejected'} AnswerStatus */
/** @typedef {'flags_mc' | 'real_or_fake_flag' | 'higher_lower'} GameType */

export function initialRoundModel() {
  return Object.freeze({
    roundId: null,
    roundNumber: null,
    totalRounds: null,
    gameType: null, // PROTOCOL.md `round:started`'s `gameType`
    question: null, // vorm hangt van `gameType` af — zie PROTOCOL.md per type
    startsAt: null,
    endsAt: null,
    selectedOptionId: null, // flags_mc
    selectedChoice: null, // real_or_fake_flag: 'real' | 'fake'
    selectedSide: null, // higher_lower: 0 | 1
    selectedCardIndex: null, // odd_one_out: 0..3
    answerStatus: /** @type {AnswerStatus} */ ('idle'),
    rejectionCode: null,
    progress: null, // { answeredCount, eligiblePlayerCount }
    result: null, // { correctOptionId, correctChoice, correctSide, correctCardIndex, selfCorrect, selfNoAnswer, roundPoints, distribution, resultDetails }
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
    // Bestaande callers (transport-mock.mjs, alle huidige tests) sturen geen
    // `gameType` mee — `flags_mc` blijft de default zodat niets daarvan breekt.
    gameType: payload.gameType ?? 'flags_mc',
    question: payload.question ?? null,
    startsAt: payload.startsAt ?? null,
    endsAt: payload.endsAt ?? null,
  });
}

/**
 * `room:state` — hydrateert dit lokale model bij (her)verbinden, iets wat tot
 * nu toe nergens gebeurde: na een reconnect/reload bleef `roundModel` op
 * `initialRoundModel()` staan terwijl er wél al een actieve ronde was.
 * `answerStatus` was daardoor na een reconnect altijd `'idle'`, ook als de
 * server allang een antwoord had geaccepteerd — precies het probleem dat
 * `applyRoundEnded`'s `selfNoAnswer`-afleiding onbetrouwbaar maakte.
 *
 * Server-autoritatief: `answeredCurrentRound` komt letterlijk uit de snapshot
 * (`PROTOCOL.md`, `self.answeredCurrentRound`) — dit bestand verzint niets,
 * het leest alleen wat de server al meegeeft en nu nog genegeerd werd.
 *
 * `givenAnswer` is de ENIGE uitzondering op "nooit zelf een selectie
 * verzinnen": PROTOCOL.md's echte server stuurt 'm niet mee (`self` kent
 * geen zo'n veld) en dan blijft dit precies het oude gedrag — vergrendeld,
 * geen gemarkeerde optie. `transport-mock.mjs` stuurt 'm wél mee
 * (`self.answeredValue`, mock-only) zodat solo na een herlaadbeurt kan tonen
 * wát je koos (docs/openstaand/solo-antwoordvolgorde.md, punt 2), niet alleen
 * dát je iets koos. Dezelfde ruwe vorm als `round:answer`'s payload:
 * optionId-string (flags_mc), 'real'|'fake' (real_or_fake_flag) of een
 * kaartindex als tekst (odd_one_out) — nooit verzonnen, alleen doorgegeven,
 * en alleen aangenomen als de waarde ook echt bij deze vraag hoort.
 *
 * @param {object} currentRoundPayload snapshot's `currentRound` (`{}` als er geen actieve ronde is)
 * @param {boolean} answeredCurrentRound snapshot's `self.answeredCurrentRound`
 * @param {string | null} [givenAnswer] snapshot's `self.answeredValue`, indien de transport dat kent
 */
export function hydrateFromSnapshot(currentRoundPayload, answeredCurrentRound, givenAnswer = null) {
  if (currentRoundPayload === null || typeof currentRoundPayload !== 'object' || currentRoundPayload.roundId == null) {
    return initialRoundModel();
  }
  const started = applyRoundStarted(currentRoundPayload);
  if (answeredCurrentRound !== true) {
    return started;
  }
  const accepted = { ...started, answerStatus: 'accepted' };
  return Object.freeze(typeof givenAnswer === 'string' ? withGivenAnswer(accepted, givenAnswer) : accepted);
}

/** Zet `givenAnswer` op het veld dat bij `model.gameType` hoort — zie `hydrateFromSnapshot`. */
function withGivenAnswer(model, givenAnswer) {
  if (model.gameType === 'real_or_fake_flag') {
    return givenAnswer === 'real' || givenAnswer === 'fake' ? { ...model, selectedChoice: givenAnswer } : model;
  }
  if (model.gameType === 'odd_one_out') {
    const kaarten = Array.isArray(model.question?.cards) ? model.question.cards : [];
    const cardIndex = Number(givenAnswer);
    return kaarten.some((kaart) => kaart.cardIndex === cardIndex) ? { ...model, selectedCardIndex: cardIndex } : model;
  }
  if (model.gameType === 'higher_lower') {
    const side = Number(givenAnswer);
    return side === 0 || side === 1 ? { ...model, selectedSide: side } : model;
  }
  const opties = Array.isArray(model.question?.optionIso2s) ? model.question.optionIso2s : [];
  return opties.includes(givenAnswer) ? { ...model, selectedOptionId: givenAnswer } : model;
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

/** `real_or_fake_flag` — S09. Zelfde vergrendelregels als `selectOption`. */
export function selectChoice(model, choice) {
  if (model.answerStatus !== 'idle' || model.question === null) {
    return model;
  }
  if (choice !== 'real' && choice !== 'fake') {
    return model;
  }
  return Object.freeze({ ...model, selectedChoice: choice, answerStatus: 'sending' });
}

/** `higher_lower` — S10. Zelfde vergrendelregels als `selectOption`. */
export function selectSide(model, side) {
  if (model.answerStatus !== 'idle' || model.question === null) {
    return model;
  }
  if (side !== 0 && side !== 1) {
    return model;
  }
  return Object.freeze({ ...model, selectedSide: side, answerStatus: 'sending' });
}

/**
 * `odd_one_out` — besluit C-2 (5 aug 2026). Zelfde vergrendelregels als
 * `selectOption`: één antwoord per speler per ronde. De kaartindex komt uit de
 * payload zelf (`cards[].cardIndex`), niet uit de weergavevolgorde.
 */
export function selectCard(model, cardIndex) {
  if (model.answerStatus !== 'idle' || model.question === null) {
    return model;
  }
  const kaarten = Array.isArray(model.question.cards) ? model.question.cards : [];
  if (!kaarten.some((kaart) => kaart.cardIndex === cardIndex)) {
    return model;
  }
  return Object.freeze({ ...model, selectedCardIndex: cardIndex, answerStatus: 'sending' });
}

/**
 * De ene plek die weet welke `round:answer`-payloadvorm bij welk `gameType`
 * hoort (`PROTOCOL.md` per type) — de DOM-/transportlaag hoeft dat zelf niet
 * te weten, roept alleen `selectOption`/`selectChoice`/`selectSide` aan en
 * leest hier de vorm terug. `null` als er (nog) niets geselecteerd is.
 */
export function answerPayloadFor(model) {
  if (model.gameType === 'real_or_fake_flag') {
    return model.selectedChoice === null ? null : { choice: model.selectedChoice };
  }
  if (model.gameType === 'higher_lower') {
    return model.selectedSide === null ? null : { side: model.selectedSide };
  }
  if (model.gameType === 'odd_one_out') {
    return model.selectedCardIndex === null ? null : { cardIndex: model.selectedCardIndex };
  }
  return model.selectedOptionId === null ? null : { optionId: model.selectedOptionId };
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

/**
 * `game:resumed` met een nieuwe rondedeadline (R2-7).
 *
 * Pauzeren schuift `Round.endsAt` op met de pauzeduur; zonder dit blijft de
 * client naar de óude wandkloktijd tellen en staat de timer na het hervatten
 * meteen op nul, terwijl er nog gewoon geantwoord kan worden. Alleen de
 * deadline verandert — antwoordstatus, vraag en selectie blijven staan, want
 * er is niets nieuws begonnen.
 *
 * @param {object} model
 * @param {{ roundEndsAt?: number }} payload
 */
export function applyRoundResumed(model, payload) {
  const nieuw = payload?.roundEndsAt;
  if (typeof nieuw !== 'number' || !Number.isFinite(nieuw) || model.roundId === null) {
    return model;
  }
  return Object.freeze({ ...model, endsAt: nieuw });
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

/**
 * `round:ended` — de enige bron van goed/fout en punten.
 *
 * `selfNoAnswer` is hier bewust NIET `answerStatus === 'idle'`: dat klopt
 * voor "nooit iets verstuurd", maar `rejected` heeft twee heel verschillende
 * oorzaken (zie `applyAnswerRejected`) — `ALREADY_ANSWERED` betekent dat er
 * wél een eerder antwoord telt (deze poging was een overbodige retry),
 * `DEADLINE_PASSED` betekent dat er nooit één is aangekomen. Alleen dat
 * laatste (plus `idle`) is echt "geen antwoord"; `sending` (ack onderweg
 * kwijtgeraakt) blijft een grijs gebied dat `hydrateFromSnapshot` na een
 * reconnect meestal al oplost vóórdat dit event binnenkomt.
 */
export function applyRoundEnded(model, payload) {
  if (payload.roundId !== model.roundId) {
    return model;
  }
  const selfNoAnswer =
    model.answerStatus === 'idle' || (model.answerStatus === 'rejected' && model.rejectionCode === 'DEADLINE_PASSED');
  return Object.freeze({
    ...model,
    result: {
      correctOptionId: payload.correctAnswer?.optionId ?? null,
      // 14-S09-S10: correctAnswer's vorm hangt van `gameType` af
      // (`{optionId}` | `{choice}` | `{side}`, PROTOCOL.md) — alle drie
      // staan hier altijd op het model, niet-toepasselijke blijven `null`.
      correctChoice: payload.correctAnswer?.choice ?? null,
      correctSide: typeof payload.correctAnswer?.side === 'number' ? payload.correctAnswer.side : null,
      correctCardIndex: typeof payload.correctAnswer?.cardIndex === 'number' ? payload.correctAnswer.cardIndex : null,
      selfCorrect: payload.ownCorrect === true,
      selfNoAnswer,
      // Punten van déze ronde, geen lopend totaal — dat laatste bestaat
      // alleen in `scoreboard:updated` (zie standings-model.mjs). `round:ended`
      // levert nooit een cumulatief veld, ook niet vóór deze fix (de oude
      // `selfScore`-lezing verwachtte een veld dat de echte server nooit
      // heeft gestuurd — zie PROGRESS.md §9's bugmelding).
      roundPoints: typeof payload.ownPoints === 'number' ? payload.ownPoints : null,
      distribution: payload.distribution ?? null,
      // `resultDetails` draagt bij odd_one_out de twee continenten voor de
      // uitlegregel (doelbeeld v2 §1). Andere gameTypes sturen 'm niet mee.
      resultDetails: payload.resultDetails ?? null,
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
