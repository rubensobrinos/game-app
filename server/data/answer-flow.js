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

  // Stap 5: reeds bestaand antwoord.
  if (ctx.existingAnswerForRound !== null) {
    return { ok: false, code: 'ALREADY_ANSWERED' };
  }

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
      updatedPlayer: {
        id: ctx.player.id,
        score: ctx.player.score + score.points,
        correctCount: ctx.player.correctCount + (validation.correct ? 1 : 0),
        correctResponseTimeMsTotal: accumulateCorrectResponseTime(
          ctx.player.correctResponseTimeMsTotal,
          { correct: validation.correct, responseTimeMs }
        ),
      },
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
