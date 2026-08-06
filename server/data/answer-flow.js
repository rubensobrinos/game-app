'use strict';

// Atomische antwoordverwerking: resolutielogica. Zie
// docs/data-model-plan/prompts/DM7-answer-flow.md voor de volledige spec.
//
// PURE resolutiefunctie: beslist, voert niets uit. resolveAnswer() geeft
// terug óf een foutcode, óf de precieze write-beschrijving (DM6's
// AcceptedAnswerWrite) die de aanroeper via saveAcceptedAnswerAtomically laat
// uitvoeren. Geen Redis, geen sockets, geen daadwerkelijke opslag hier.
//
// Uitvoeringsvolgorde wijkt bewust af van DATA-MODEL.md's genummerde lijst:
// idempotentie (daar stap 4) staat hier EERST, vóór sessie/speler/match/ronde/
// deadline — anders krijgt een retry na de deadline of na een faseovergang
// niet dezelfde ack als de oorspronkelijke, geslaagde aanroep
// (REVIEW-DM2-DM9.md bevinding 1; PROTOCOL.md §Idempotentie: "zelfde
// actionId: zelfde ack").

const { isAnswerAcceptable, scoreAnswer, accumulateCorrectResponseTime } = require('../rules/scoring');
const { validateAnswer } = require('../rules/validators');

/**
 * @param {{
 *   session: import('./types/session').Session,
 *   player: import('./types/player').Player,
 *   room: import('./types/room').Room,
 *   match: import('./types/match').Match,
 *   round: import('./types/round').Round,
 *   answer: unknown,
 *   actionId: string,
 *   receivedAt: number,
 *   deadlineGraceMs: number,
 *   existingAnswerForRound: import('./types/answer').Answer | null,
 *   existingActionCacheEntry: { actionId: string, ack: object } | null,
 * }} ctx
 * @returns {
 *   | { ok: false, code: string }
 *   | { ok: true, replay: true, ack: { roundId: string } }
 *   | { ok: true, replay: false, write: import('./repository').AcceptedAnswerWrite }
 * }
 */
function resolveAnswer(ctx) {
  // Stap 1 (was stap 4 in DATA-MODEL.md): actionId/idempotentie, EERST.
  // Snelpad, geen bron van waarheid meer sinds DM13: deze check draait op
  // context die vóór deze aanroep is ingelezen en dekt dus geen gelijktijdige
  // aanroep af. repository.js's saveAcceptedAnswerAtomically doet dezelfde
  // controle (en de "al beantwoord"-controle van stap 5 hieronder) opnieuw,
  // atomair met de write — dat is de garantie. Een aanroeper kan dus, ook na
  // een `ok:true, replay:false` hier, alsnog een `ALREADY_ANSWERED`-worp van
  // de atomaire operatie krijgen (het race-scenario) en moet die naar
  // dezelfde protocolrespons vertalen.
  if (
    ctx.existingActionCacheEntry !== null &&
    ctx.existingActionCacheEntry.actionId === ctx.actionId
  ) {
    return { ok: true, replay: true, ack: ctx.existingActionCacheEntry.ack };
  }

  // Stap 2 (was stap 1): sessie en speler.
  if (ctx.session.revoked) {
    return { ok: false, code: 'SESSION_REVOKED' };
  }
  if (ctx.session.roomId !== ctx.room.id) {
    return { ok: false, code: 'TOKEN_INVALID' };
  }
  if (ctx.session.playerId === null) {
    return { ok: false, code: 'NOT_PLAYER' };
  }
  if (ctx.player.kicked || ctx.player.left) {
    return { ok: false, code: 'NOT_PLAYER' };
  }

  // Stap 3 (was stap 2): match en ronde.
  if (ctx.round.matchId !== ctx.match.id) {
    return { ok: false, code: 'ROUND_NOT_ACTIVE' };
  }
  if (ctx.round.status !== 'ACTIVE') {
    return { ok: false, code: 'ROUND_NOT_ACTIVE' };
  }
  // roundIndex is 0-based (HANDOFF.md §2); publiek rondenummer is +1.
  const currentRoundNumber = ctx.match.roundIndex + 1;
  if (ctx.player.eligibleFromRound > currentRoundNumber) {
    return { ok: false, code: 'PLAYER_NOT_ELIGIBLE' };
  }

  // Stap 4 (was stap 3): deadline. Hergebruikt server/rules/scoring.js,
  // niet opnieuw geïmplementeerd.
  const acceptable = isAnswerAcceptable({
    receivedAt: ctx.receivedAt,
    endsAt: ctx.round.endsAt,
    deadlineGraceMs: ctx.deadlineGraceMs,
  });
  if (!acceptable) {
    return { ok: false, code: 'DEADLINE_PASSED' };
  }

  // Stap 5: reeds bestaand antwoord — sinds besluit 54 (6 aug 2026) GEEN
  // afwijzing meer maar een CORRECTIE. "Wijzigen mag, tot de tijd om is; de
  // laatste tik telt, ook voor de snelheidsbonus." Stap 4 hierboven bewaakt
  // die deadline al, dus na de tijd komt een tweede antwoord hier niet eens.
  //
  // Wat een correctie bijzonder maakt is niet de write maar de BOEKHOUDING:
  // score, correctCount en de opgetelde responstijd zijn cumulatief per
  // speler. De bijdrage van het vorige antwoord moet er dus eerst af voordat
  // die van het nieuwe erbij kan — anders levert twijfelen punten op.
  const vorige = ctx.existingAnswerForRound;

  // Stap 6: correctheid en punten.
  const roundContext = buildRoundContext(ctx.round);
  const validation = validateAnswer(ctx.round.gameType, ctx.answer, ctx.round.correctAnswer, roundContext);

  // valid: false -> INVALID_ANSWER_FORMAT, GEEN writes (REVIEW-DM2-DM9.md
  // bevinding 3). Dit is geen vervanging voor een protocol-schema-gate: GR3
  // valideert ook inhoudelijke waarden (lidmaatschap van validOptionIds), wat
  // een generieke schema-check niet kan zien.
  if (!validation.valid) {
    return { ok: false, code: 'INVALID_ANSWER_FORMAT' };
  }

  const score = scoreAnswer({
    correct: validation.correct,
    receivedAt: ctx.receivedAt,
    startsAt: ctx.round.startsAt,
    endsAt: ctx.round.endsAt,
    deadlineGraceMs: ctx.deadlineGraceMs,
    speedBonusEnabled: ctx.room.config.speedBonus,
  });
  // Stap 4 hierboven heeft de deadline al gecontroleerd, dus scoreAnswer's
  // eigen accepted-controle zou hier nooit false mogen zijn — expliciet
  // getest (answer-flow.test.js), niet stilzwijgend aangenomen.
  if (!score.accepted) {
    throw new Error('resolveAnswer: scoreAnswer() rejected an answer that isAnswerAcceptable() already accepted — invariant violated');
  }

  const responseTimeMs = ctx.receivedAt - ctx.round.startsAt;

  // Stappen 7–10: de write, in één keer voor DM6's saveAcceptedAnswerAtomically.
  return {
    ok: true,
    replay: false,
    write: {
      answer: {
        roundId: ctx.round.id,
        playerId: ctx.player.id,
        actionId: ctx.actionId,
        answer: ctx.answer,
        receivedAt: ctx.receivedAt,
        responseTimeMs,
        correct: validation.correct,
        points: score.points,
      },
      // Besluit 54: bij een correctie eerst het vorige antwoord terugdraaien.
      // `accumulateCorrectResponseTime` telt alleen op bij een goed antwoord,
      // dus het terugdraaien doet hetzelfde in spiegelbeeld.
      updatedPlayer: {
        id: ctx.player.id,
        score: ctx.player.score - (vorige === null ? 0 : vorige.points) + score.points,
        correctCount: ctx.player.correctCount
          - (vorige !== null && vorige.correct ? 1 : 0)
          + (validation.correct ? 1 : 0),
        correctResponseTimeMsTotal: accumulateCorrectResponseTime(
          vorige !== null && vorige.correct
            // `Math.max(0, …)` is geen sier: `accumulateCorrectResponseTime`
            // werpt op een negatief totaal, en dat is terecht — maar het mag
            // nooit gebeuren dat een correctie een speler dáárop laat
            // struikelen. Loopt het toch onder nul, dan klopte de optelling al
            // niet en is nul de enige verdedigbare uitkomst.
            ? Math.max(0, ctx.player.correctResponseTimeMsTotal - vorige.responseTimeMs)
            : ctx.player.correctResponseTimeMsTotal,
          { correct: validation.correct, responseTimeMs }
        ),
      },
      // De poort mag stilzwijgend overschrijven — maar alleen wanneer de
      // compositielaag dat expliciet bedoelt. Zonder deze vlag blijft de
      // "één antwoord per ronde"-bewaking staan, zodat een verdwaalde tweede
      // write nog steeds een fout is en geen stille mutatie.
      correctie: vorige !== null,
      actionCacheEntry: {
        actionId: ctx.actionId,
        ack: { roundId: ctx.round.id }, // GEEN correct/points (bevinding 2)
      },
    },
  };
}

/**
 * Bouwt validateAnswer()'s roundContext uit Round — validOptionIds komt uit
 * het DM3-veld Round.validOptionIds, NIET uit
 * publicQuestionPayload.options[].optionId (die vorm bestaat niet in de
 * echte, herziene GR4-output — REVIEW-DM2-DM9.md bevinding 6).
 * @param {import('./types/round').Round} round
 * @returns {{ validOptionIds?: string[], optionCount?: number }}
 */
function buildRoundContext(round) {
  switch (round.gameType) {
    case 'flags_mc':
    case 'capitals_mc':
      return { validOptionIds: round.validOptionIds };
    case 'odd_one_out':
      return { optionCount: round.publicQuestionPayload.cards.length };
    default:
      return {};
  }
}

module.exports = { resolveAnswer, buildRoundContext };
