// mock/match.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK uit transport-mock.mjs's "Rondelogica"-kopje:
// startGame, startRound, endRound, showScoreboard, finishGame, rematch. Geen
// gedragsverandering.
//
// `showScoreboard` plant bij pacing 'auto' de volgende overgang
// (`advanceFromScoreboard`), en die functie woont in mock/pacing.mjs. Zou
// dit bestand haar rechtstreeks importeren, dan zou pacing.mjs (dat juist
// startRound/endRound/showScoreboard/finishGame van hier importeert) een
// kringverwijzing worden. In plaats daarvan leest `showScoreboard` 'm van
// `ctx.advanceFromScoreboard` — hetzelfde, door transport-mock.mjs éénmalig
// opgebouwde object, pas gevuld NADAT mock/pacing.mjs is opgebouwd. Dat is
// geen probleem: de geplande `scheduleTimer`-callback leest die waarde pas
// wanneer hij afgaat, ruim na de synchrone opbouw. Zie ook mock/events.mjs se
// kopnotitie voor hetzelfde patroon.

import { CONTENT_VERSION } from '../../../shared/content/index.mjs';
import { broadcast, broadcastPersonalized } from './events.mjs';
import { scheduleTimer } from './timers.mjs';
import { ProtocolError } from './protocol-error.mjs';
import { countActivePlayers, rankPlayers, findRanked, toScoreboardEntry } from './players.mjs';
import { optionValuesOf, correctValueOf, buildDistribution, RENDERER_VERSION } from './questions.mjs';
import { randomId } from './ids.mjs';

// Rondetiming — kort gehouden voor handmatig doorklikken (zie
// transport-mock.mjs se moduledoc). Geen protocolvereiste. Gedeeld met
// mock/pacing.mjs (rearmTimer/resumeGame plannen dezelfde overgangen na een
// reload/hervatting), vandaar hier geëxporteerd i.p.v. lokaal.
export const COUNTDOWN_MS = 1200;
export const ROUND_ACTIVE_MS = 8000;
const ROUND_RESULT_MS = 2500;
export const SCOREBOARD_AUTO_ADVANCE_MS = 2500;

export function startGame(target, ctx) {
  if (target.phase !== 'LOBBY') {
    throw new ProtocolError('INVALID_PHASE', 'game:start requires phase LOBBY.');
  }
  if (countActivePlayers(target) < 1) {
    throw new ProtocolError('INVALID_PHASE', 'game:start requires at least one player.');
  }

  target.phase = 'COUNTDOWN';
  const countdownEndsAt = Date.now() + COUNTDOWN_MS;
  target.phaseDeadline = countdownEndsAt;
  broadcast(target, 'game:started', {
    matchId: target.matchId,
    totalRounds: target.questions.length,
    countdownEndsAt,
  }, ctx);

  scheduleTimer(target, COUNTDOWN_MS, () => startRound(target, 0, ctx));
  return {};
}

export function startRound(target, index, ctx) {
  if (target.phase === 'FINISHED') {
    return;
  }
  const question = target.questions[index];
  if (question === undefined) {
    return finishGame(target, ctx);
  }

  target.roundIndex = index;
  for (const player of target.players.values()) {
    player.answeredCurrentRound = false;
  }

  const startsAt = Date.now() + 250;
  const endsAt = startsAt + ROUND_ACTIVE_MS;
  target.currentRound = {
    roundId: `round_${String(index + 1).padStart(2, '0')}`,
    roundNumber: index + 1,
    totalRounds: target.questions.length,
    question,
    startsAt,
    endsAt,
    answers: new Map(),
  };
  target.phase = 'ROUND_ACTIVE';
  target.phaseDeadline = endsAt;

  broadcast(target, 'round:started', {
    matchId: target.matchId,
    roundId: target.currentRound.roundId,
    roundNumber: target.currentRound.roundNumber,
    totalRounds: target.currentRound.totalRounds,
    gameType: target.gameType,
    contentVersion: CONTENT_VERSION,
    rendererVersion: RENDERER_VERSION,
    question: question.payload,
    startsAt,
    endsAt,
  }, ctx);

  // Fase 4 (autoReveal, besluit 51): staat autoReveal uit, dan plant de
  // mock — net als de echte server — GEEN automatisch ronde-einde. De ronde
  // blijft ROUND_ACTIVE voorbij de deadline; `submitAnswer` sluit al af op
  // `endsAt` (zie daar), en `game:reveal` roept `endRound` rechtstreeks aan.
  if (target.config.autoReveal !== false) {
    scheduleTimer(target, endsAt - Date.now(), () => endRound(target, index, ctx));
  }
}

export function endRound(target, index, ctx) {
  if (target.phase !== 'ROUND_ACTIVE' || target.currentRound === null) {
    return;
  }
  const { question, answers, roundId } = target.currentRound;
  const correctAnswer = question.correct;
  const distribution = buildDistribution(optionValuesOf(question), answers);

  target.phase = 'ROUND_RESULT';
  target.phaseDeadline = Date.now() + ROUND_RESULT_MS;
  broadcastPersonalized(target, 'round:ended', (playerId) => {
    const ownCorrect = playerId !== null && answers.get(playerId) === correctValueOf(question);
    return {
      roundId,
      correctAnswer,
      ...(question.resultDetails === undefined ? {} : { resultDetails: question.resultDetails }),
      distribution,
      ownCorrect,
      ownPoints: ownCorrect ? 100 : 0,
      ownResponseTimeMs: null,
    };
  }, ctx);

  scheduleTimer(target, ROUND_RESULT_MS, () => showScoreboard(target, ctx));
}

export function showScoreboard(target, ctx) {
  if (target.phase !== 'ROUND_RESULT') {
    return;
  }
  target.phase = 'SCOREBOARD';
  const ranked = rankPlayers(target);
  broadcastPersonalized(target, 'scoreboard:updated', (playerId) => ({
    top: ranked.slice(0, 5).map(toScoreboardEntry),
    self: playerId !== null ? toScoreboardEntry(findRanked(ranked, playerId)) : null,
  }), ctx);

  if (target.pacing === 'auto') {
    target.phaseDeadline = Date.now() + SCOREBOARD_AUTO_ADVANCE_MS;
    scheduleTimer(target, SCOREBOARD_AUTO_ADVANCE_MS, () => ctx.advanceFromScoreboard(target, ctx));
  } else {
    // pacing === 'host': wacht op een expliciete `game:next` (zie advanceOnHostCue).
    target.phaseDeadline = null;
  }
}

export function finishGame(target, ctx) {
  target.phase = 'FINISHED';
  target.currentRound = null;
  target.phaseDeadline = null;
  const ranked = rankPlayers(target);
  broadcastPersonalized(target, 'game:finished', (playerId) => ({
    podium: ranked.slice(0, 5).map(toScoreboardEntry),
    self: playerId !== null ? toScoreboardEntry(findRanked(ranked, playerId)) : null,
  }), ctx);
  return {};
}

export function rematch(target, ctx) {
  if (target.phase !== 'FINISHED') {
    throw new ProtocolError('INVALID_PHASE', 'game:rematch requires phase FINISHED.');
  }
  target.phase = 'LOBBY';
  target.matchId = randomId('match');
  target.matchSequence += 1;
  target.roundIndex = -1;
  target.currentRound = null;
  target.phaseDeadline = null;
  for (const player of target.players.values()) {
    player.score = 0;
    player.correctCount = 0;
    player.correctResponseTimeMsTotal = 0;
    player.answeredCurrentRound = false;
  }
  broadcast(target, 'game:rematch-started', { matchId: target.matchId }, ctx);
  return {};
}
