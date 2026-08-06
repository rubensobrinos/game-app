// mock/pacing.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK: advanceOnHostCue, advanceFromScoreboard, revealAnswer
// en pauseGame/resumeGame uit transport-mock.mjs's "Rondelogica"-kopje, plus
// `rearmTimer` (stond bovenaan `createMockTransport`, vlak onder de opbouw
// van de mocktransport). Geen gedragsverandering.
//
// Importeert rechtstreeks uit mock/match.mjs (startRound/endRound/
// showScoreboard/finishGame) — dat mag, want match.mjs importeert niets terug
// van hier (zie de kopnotitie daar over `ctx.advanceFromScoreboard`).

import { ProtocolError } from './protocol-error.mjs';
import { broadcast } from './events.mjs';
import { scheduleTimer, clearTimers } from './timers.mjs';
import { startRound, endRound, showScoreboard, finishGame, COUNTDOWN_MS, ROUND_ACTIVE_MS, SCOREBOARD_AUTO_ADVANCE_MS } from './match.mjs';

// Fase 4 (autoReveal, besluit 51): dezelfde coulance als besluit 13's
// `deadlineGraceMs` voor de host-tik op "Toon antwoord" (zie `revealAnswer`).
// De host ziet die knop verschijnen op basis van ZIJN eigen klokschatting
// (`estimateServerOffset()`, die hier per definitie ~`SIMULATED_SERVER_SKEW_MS`
// afwijkt) — zonder marge zou een tik op het exacte moment dat de knop
// verschijnt hier stelselmatig te vroeg zijn. Ruim boven de skew, niet gelijk
// eraan: `estimateServerOffset` middelt drie metingen en kan er dus nog naast
// zitten.
const REVEAL_DEADLINE_GRACE_MS = 600;

export function advanceOnHostCue(target, ctx) {
  if (target.phase !== 'SCOREBOARD') {
    throw new ProtocolError('INVALID_PHASE', 'game:next requires phase SCOREBOARD.');
  }
  advanceFromScoreboard(target, ctx);
  return {};
}

export function advanceFromScoreboard(target, ctx) {
  if (target.phase !== 'SCOREBOARD') {
    return;
  }
  const nextIndex = target.roundIndex + 1;
  if (nextIndex < target.questions.length) {
    startRound(target, nextIndex, ctx);
  } else {
    finishGame(target, ctx);
  }
}

/**
 * Fase 4 (autoReveal, besluit 51). Zelfde `endRound()`-aanroep die de timer
 * anders had gedaan, alleen op het moment dat de host kiest — geen aparte
 * fase-overgang, precies zoals de echte server (`socket.mjs`'s
 * `case 'game:reveal'`). Twee poorten die `endRound()` zelf niet bewaakt:
 * autoReveal moet uit staan, en de deadline moet al voorbij zijn.
 */
export function revealAnswer(target, ctx) {
  if (target.config.autoReveal !== false) {
    throw new ProtocolError('INVALID_PHASE', 'game:reveal requires autoReveal:false.');
  }
  if (
    target.phase !== 'ROUND_ACTIVE'
    || target.currentRound === null
    || Date.now() < target.currentRound.endsAt - REVEAL_DEADLINE_GRACE_MS
  ) {
    throw new ProtocolError('INVALID_PHASE', 'game:reveal requires an active round past its deadline.');
  }
  endRound(target, target.roundIndex, ctx);
  return { phase: target.phase };
}

export function pauseGame(target, payload, ctx) {
  const pausableActivePhases = new Set(['COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD']);
  if (!pausableActivePhases.has(target.phase)) {
    throw new ProtocolError('INVALID_PHASE', 'game:pause requires an active game.');
  }
  const remainingMs =
    target.phase === 'ROUND_ACTIVE' && target.currentRound !== null
      ? Math.max(0, target.currentRound.endsAt - Date.now())
      : null;
  target.pausedState = {
    previousPhase: target.phase,
    remainingMs,
    reason: typeof payload.reason === 'string' ? payload.reason : 'host',
    pausedAt: Date.now(),
  };
  target.phase = 'PAUSED';
  target.phaseDeadline = null; // de klok staat stil; zie pausedState.remainingMs
  clearTimers(target);
  broadcast(target, 'game:paused', target.pausedState, ctx);
  return {};
}

export function resumeGame(target, ctx) {
  if (target.phase !== 'PAUSED' || target.pausedState === null) {
    throw new ProtocolError('INVALID_PHASE', 'game:resume requires phase PAUSED.');
  }
  const { previousPhase, remainingMs } = target.pausedState;
  target.phase = previousPhase;
  target.pausedState = null;

  broadcast(target, 'game:resumed', {
    phase: previousPhase,
    // Pariteit met de server (R2-7): bij het hervatten van een lopende ronde
    // reist de nieuwe deadline mee.
    ...(previousPhase === 'ROUND_ACTIVE' && target.currentRound !== null
      ? { roundEndsAt: target.currentRound.endsAt }
      : {}),
  }, ctx);

  if (previousPhase === 'ROUND_ACTIVE' && target.currentRound !== null) {
    const newEndsAt = Date.now() + (remainingMs ?? ROUND_ACTIVE_MS);
    target.currentRound.endsAt = newEndsAt;
    target.phaseDeadline = newEndsAt;
    scheduleTimer(target, newEndsAt - Date.now(), () => endRound(target, target.roundIndex, ctx));
  } else if (previousPhase === 'COUNTDOWN') {
    target.phaseDeadline = Date.now() + COUNTDOWN_MS;
    scheduleTimer(target, COUNTDOWN_MS, () => startRound(target, 0, ctx));
  } else if (previousPhase === 'SCOREBOARD' && target.pacing === 'auto') {
    target.phaseDeadline = Date.now() + SCOREBOARD_AUTO_ADVANCE_MS;
    scheduleTimer(target, SCOREBOARD_AUTO_ADVANCE_MS, () => advanceFromScoreboard(target, ctx));
  }
  return {};
}

/**
 * Zet, na herstel, precies één timer weer aan: die van de fase waarin de
 * room stond toen hij werd opgeslagen. `target.phaseDeadline` ligt door het
 * verstrijken van de tijd tussen opslaan en herstellen soms al in het
 * verleden (bv. de pagina lag een minuut stil middenin een ronde) —
 * `scheduleTimer` klemt een negatieve vertraging toch al af naar 0, dus dat
 * lost de overgang meteen in plaats van nooit op. Zelfde aanpak als
 * `resumeGame` hierboven na een `game:pause`/`game:resume`, alleen dan voor
 * een hele paginalaad in plaats van een expliciete hostactie.
 */
export function rearmTimer(target, ctx) {
  if (target.phaseDeadline === null) {
    return;
  }
  const remaining = Math.max(0, target.phaseDeadline - Date.now());
  switch (target.phase) {
    case 'COUNTDOWN':
      scheduleTimer(target, remaining, () => startRound(target, 0, ctx));
      break;
    case 'ROUND_ACTIVE':
      // Fase 4 (autoReveal): zelfde voorwaarde als in `startRound` — een
      // reload mag geen timer aanzetten die de compositie zelf ook niet
      // zou hebben gepland.
      if (target.config.autoReveal !== false) {
        scheduleTimer(target, remaining, () => endRound(target, target.roundIndex, ctx));
      }
      break;
    case 'ROUND_RESULT':
      scheduleTimer(target, remaining, () => showScoreboard(target, ctx));
      break;
    case 'SCOREBOARD':
      if (target.pacing === 'auto') {
        scheduleTimer(target, remaining, () => advanceFromScoreboard(target, ctx));
      }
      break;
    default:
      break; // LOBBY/PAUSED/FINISHED plannen zelf niets.
  }
}
