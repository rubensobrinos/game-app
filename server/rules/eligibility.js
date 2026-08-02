'use strict';

// Late join en disconnect-accounting. Zie docs/multiplayer/GAME-RULES.md
// ("Late join", "Speler verlaat of disconnect") en
// docs/game-rules-plan/prompts/GR5-eligibility.md voor de volledige spec.
//
// Geen enkele functie hier raakt Redis, sockets, bestanden of de klok: nowMs
// en alle tijden komen altijd binnen als parameter.

const PHASES = ['LOBBY', 'COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD', 'PAUSED', 'FINISHED'];

/**
 * Bepaalt vanaf welke ronde een net toegetreden speler mag meetellen/
 * antwoorden. Werpt RangeError bij een onbekende `phase`, een
 * `remainingFraction` buiten [0,1] (en niet null), of een niet-positieve
 * `currentRoundNumber`/ongeldige `nearEndThreshold`.
 * @param {{
 *   currentRoundNumber: number,
 *   phase: "LOBBY"|"COUNTDOWN"|"ROUND_ACTIVE"|"ROUND_RESULT"|"SCOREBOARD"|"PAUSED"|"FINISHED",
 *   remainingFraction: number | null,
 *   nearEndThreshold: number,
 * }} p
 * @returns {number}
 */
function computeEligibleFromRound({ currentRoundNumber, phase, remainingFraction, nearEndThreshold }) {
  if (!Number.isInteger(currentRoundNumber) || currentRoundNumber < 1) {
    throw new RangeError(`currentRoundNumber must be a positive integer, got: ${currentRoundNumber}`);
  }
  if (!PHASES.includes(phase)) {
    throw new RangeError(`Unknown phase: ${JSON.stringify(phase)}`);
  }
  if (!Number.isFinite(nearEndThreshold) || nearEndThreshold < 0 || nearEndThreshold > 1) {
    throw new RangeError(`nearEndThreshold must be a finite number in [0, 1], got: ${nearEndThreshold}`);
  }
  if (remainingFraction !== null && (!Number.isFinite(remainingFraction) || remainingFraction < 0 || remainingFraction > 1)) {
    throw new RangeError(`remainingFraction must be null or a finite number in [0, 1], got: ${remainingFraction}`);
  }

  if (phase === 'ROUND_ACTIVE' && remainingFraction !== null && remainingFraction >= nearEndThreshold) {
    return currentRoundNumber;
  }
  return currentRoundNumber + 1;
}

/**
 * @param {number} eligibleFromRound
 * @param {number} roundNumber
 * @returns {boolean}
 */
function isEligibleForRound(eligibleFromRound, roundNumber) {
  return roundNumber >= eligibleFromRound;
}

/**
 * Werpt RangeError bij een niet-positieve integer.
 * @param {number} eligibleFromRound
 * @returns {{ isLateJoin: boolean, eligibleFromRound: number }}
 */
function describeLateJoin(eligibleFromRound) {
  if (!Number.isInteger(eligibleFromRound) || eligibleFromRound < 1) {
    throw new RangeError(`eligibleFromRound must be a positive integer, got: ${eligibleFromRound}`);
  }
  return { isLateJoin: eligibleFromRound > 1, eligibleFromRound };
}

/**
 * Bepaalt of een speler meetelt in de noemer van antwoordvoortgang voor
 * `roundNumber`. Werpt RangeError als `connected: false` zonder geldige
 * `disconnectedSinceMs`, of bij een negatieve `graceMs`.
 * @param {{ left: boolean, kicked: boolean, eligibleFromRound: number, connected: boolean, disconnectedSinceMs: number | null }} player
 * @param {{ roundNumber: number, nowMs: number, graceMs: number }} context
 * @returns {boolean}
 */
function countsTowardAnswerDenominator(player, context) {
  const { left, kicked, eligibleFromRound, connected, disconnectedSinceMs } = player;
  const { roundNumber, nowMs, graceMs } = context;

  if (!Number.isFinite(graceMs) || graceMs < 0) {
    throw new RangeError(`graceMs must be a finite, non-negative number, got: ${graceMs}`);
  }
  if (!connected && (!Number.isFinite(disconnectedSinceMs) || disconnectedSinceMs > nowMs)) {
    throw new RangeError(
      `disconnectedSinceMs must be a finite number <= nowMs when connected is false, got: ${disconnectedSinceMs}`
    );
  }

  if (left || kicked) {
    return false;
  }
  if (!isEligibleForRound(eligibleFromRound, roundNumber)) {
    return false;
  }
  if (!connected) {
    const disconnectedForMs = nowMs - disconnectedSinceMs;
    if (disconnectedForMs >= graceMs) {
      return false;
    }
  }
  return true;
}

module.exports = {
  computeEligibleFromRound,
  isEligibleForRound,
  describeLateJoin,
  countsTowardAnswerDenominator,
};
