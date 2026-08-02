'use strict';

// Player-vorm uit docs/multiplayer/DATA-MODEL.md ("Player"). Zie
// docs/data-model-plan/prompts/DM3-player-match-round-answer-presentation.md
// voor de volledige spec en docs/data-model-plan/HANDOFF.md §3 voor de
// rematch-resetsemantiek (die hier NIET geïmplementeerd wordt — dat is
// repository/answer-flow-terrein, DM6/DM7).
//
// score/correctCount/correctResponseTimeMsTotal zijn niet-negatieve integers
// omdat server/rules/standings.js's assertValidPlayerForRanking dat al keihard
// eist van elke aanroeper (via rankPlayers()) — dezelfde grens hier overnemen.

/**
 * @typedef {{
 *   id: string,
 *   roomId: string,
 *   sessionId: string,
 *   displayName: string | null,
 *   generatedName: string,
 *   effectiveName: string,
 *   nameSource: string,
 *   teamId: string | null,
 *   score: number,
 *   correctCount: number,
 *   correctResponseTimeMsTotal: number,
 *   connected: boolean,
 *   eligibleFromRound: number,
 *   joinedAt: number,
 *   left: boolean,
 *   kicked: boolean,
 * }} Player
 */

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string, got: ${JSON.stringify(value)}`);
  }
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function assertNonNegativeInteger(value, fieldName) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} must be a non-negative integer, got: ${JSON.stringify(value)}`);
  }
}

/**
 * Werpt TypeError/RangeError als value niet aan de Player-vorm voldoet.
 * `nameSource` wordt uitsluitend gecontroleerd op "niet-lege string" — geen
 * gesloten enum. Alleen "generated" is ooit als letterlijke waarde getoond in
 * DATA-MODEL.md; de tegenhanger voor een zelfgekozen naam heeft geen
 * bevestigde string. Bewust open, niet vergeten.
 * @param {unknown} value
 */
function assertPlayerShape(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`Player must be an object, got: ${value === null ? 'null' : typeof value}`);
  }

  assertNonEmptyString(value.id, 'id');
  assertNonEmptyString(value.roomId, 'roomId');
  assertNonEmptyString(value.sessionId, 'sessionId');

  if (value.displayName !== null) {
    assertNonEmptyString(value.displayName, 'displayName');
  }

  assertNonEmptyString(value.generatedName, 'generatedName');
  assertNonEmptyString(value.effectiveName, 'effectiveName');
  assertNonEmptyString(value.nameSource, 'nameSource');

  if (value.teamId !== null) {
    assertNonEmptyString(value.teamId, 'teamId');
  }

  assertNonNegativeInteger(value.score, 'score');
  assertNonNegativeInteger(value.correctCount, 'correctCount');
  assertNonNegativeInteger(value.correctResponseTimeMsTotal, 'correctResponseTimeMsTotal');

  if (typeof value.connected !== 'boolean') {
    throw new TypeError(`connected must be a boolean, got: ${typeof value.connected}`);
  }

  if (typeof value.eligibleFromRound !== 'number' || !Number.isInteger(value.eligibleFromRound) || value.eligibleFromRound < 1) {
    throw new RangeError(`eligibleFromRound must be an integer >= 1, got: ${JSON.stringify(value.eligibleFromRound)}`);
  }

  if (typeof value.joinedAt !== 'number' || !Number.isFinite(value.joinedAt) || value.joinedAt < 0) {
    throw new TypeError(`joinedAt must be a finite, non-negative number, got: ${value.joinedAt}`);
  }

  if (typeof value.left !== 'boolean') {
    throw new TypeError(`left must be a boolean, got: ${typeof value.left}`);
  }
  if (typeof value.kicked !== 'boolean') {
    throw new TypeError(`kicked must be a boolean, got: ${typeof value.kicked}`);
  }
}

/**
 * Projecteert een Player naar exact de vier velden die
 * server/rules/standings.js's rankPlayers() consumeert (via
 * assertValidPlayerForRanking) — expliciete allowlist, geen spread. Zie
 * docs/data-model-plan/prompts/DM9-game-rules-reconciliation.md: de enige
 * projectie die hier gebouwd wordt, omdat rankPlayers() de enige echte,
 * bestaande consument is. toEligibilityPlayerView/toTeamPlayerView wachten op
 * GR5/GR6, die nog niet bestaan.
 * @param {Player} player
 * @returns {{ id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number }}
 */
function toStandingPlayerView(player) {
  assertPlayerShape(player);
  return {
    id: player.id,
    score: player.score,
    correctCount: player.correctCount,
    correctResponseTimeMsTotal: player.correctResponseTimeMsTotal,
  };
}

module.exports = { assertPlayerShape, toStandingPlayerView };
