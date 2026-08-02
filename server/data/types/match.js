'use strict';

// Match-vorm uit docs/multiplayer/DATA-MODEL.md ("Match"). Zie
// docs/data-model-plan/prompts/DM3-player-match-round-answer-presentation.md
// voor de volledige spec.
//
// contentVersion/rendererVersion: NIET in DATA-MODEL.md's oorspronkelijke
// Match-voorbeeld, maar hier toegevoegd na docs/multiplayer/DECISIONS.md #21
// ("bevestigd door producteigenaar"): "contentVersion en rendererVersion zijn
// canoniek en onveranderlijk op Match; roundpayloads dragen ze mee voor
// clients." Dit lost checkpoint 4 op (de eerdere Room/Match/round-payload-
// tegenstrijdigheid) — Room (DM2b) bevat deze velden bewust niet, dat
// blijft correct.
//
// Pure module: geen Redis, geen sockets, geen klok.

/**
 * @typedef {{
 *   previousPhase: string,
 *   remainingMs: number,
 *   reason: string,
 *   pausedAt: number,
 * }} MatchPausedState
 */

/**
 * @typedef {{
 *   id: string,
 *   roomId: string,
 *   sequence: number,
 *   phase: "LOBBY" | "COUNTDOWN" | "ROUND_ACTIVE" | "ROUND_RESULT" | "SCOREBOARD" | "PAUSED" | "FINISHED",
 *   startedAt: number,
 *   finishedAt: number | null,
 *   roundIndex: number,
 *   roundIds: string[],
 *   usedQuestionKeys: string[],
 *   previousMatchQuestionKeys: string[],
 *   pausedState: MatchPausedState | null,
 *   contentVersion: string,
 *   rendererVersion: string,
 * }} Match
 */

// Bron: server/architecture/state-machine.js (ARCHITECTURE.md §State machine).
// Lokale kopie, NIET geïmporteerd — dat bestand is een gedragslaag
// (transition()-reducer), geen neutrale constantsmodule; server/data ->
// server/architecture is de verkeerde richting (REVIEW-DM2-DM9.md bevinding
// 10). Zie docs/data-model-plan/HANDOFF.md §5 voor het voorstel van een
// neutrale gedeelde module. Dezelfde lijst staat onafhankelijk
// getranscribeerd in types/room.js (ROOM_PHASE_VALUES) — zie de
// cross-bestand-consistentietest hieronder in match.test.js.
const MATCH_PHASE_VALUES = Object.freeze([
  'LOBBY', 'COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD',
  'PAUSED', 'FINISHED',
]);

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
function assertStringArray(value, fieldName) {
  if (!Array.isArray(value) || !value.every((el) => typeof el === 'string')) {
    throw new TypeError(`${fieldName} must be an array of strings, got: ${JSON.stringify(value)}`);
  }
}

/**
 * Werpt TypeError/RangeError als value niet aan de MatchPausedState-vorm
 * voldoet.
 * @param {unknown} value
 */
function assertPausedStateShape(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`pausedState must be an object, got: ${value === null ? 'null' : typeof value}`);
  }
  if (!MATCH_PHASE_VALUES.includes(value.previousPhase)) {
    throw new RangeError(
      `pausedState.previousPhase must be one of ${JSON.stringify(MATCH_PHASE_VALUES)}, got: ${JSON.stringify(value.previousPhase)}`
    );
  }
  if (typeof value.remainingMs !== 'number' || !Number.isFinite(value.remainingMs) || value.remainingMs < 0) {
    throw new TypeError(`pausedState.remainingMs must be a finite, non-negative number, got: ${value.remainingMs}`);
  }
  assertNonEmptyString(value.reason, 'pausedState.reason');
  if (typeof value.pausedAt !== 'number' || !Number.isFinite(value.pausedAt)) {
    throw new TypeError(`pausedState.pausedAt must be a finite number, got: ${value.pausedAt}`);
  }
}

/**
 * Werpt TypeError/RangeError als value niet aan de Match-vorm voldoet.
 * `roundIndex` wordt als 0-based aangenomen (HANDOFF.md §2) — een interpretatie,
 * geen citaat.
 * @param {unknown} value
 */
function assertMatchShape(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`Match must be an object, got: ${value === null ? 'null' : typeof value}`);
  }

  assertNonEmptyString(value.id, 'id');
  assertNonEmptyString(value.roomId, 'roomId');

  if (typeof value.sequence !== 'number' || !Number.isInteger(value.sequence) || value.sequence < 1) {
    throw new RangeError(`sequence must be an integer >= 1, got: ${JSON.stringify(value.sequence)}`);
  }

  if (!MATCH_PHASE_VALUES.includes(value.phase)) {
    throw new RangeError(`phase must be one of ${JSON.stringify(MATCH_PHASE_VALUES)}, got: ${JSON.stringify(value.phase)}`);
  }

  if (typeof value.startedAt !== 'number' || !Number.isFinite(value.startedAt)) {
    throw new TypeError(`startedAt must be a finite number, got: ${value.startedAt}`);
  }
  if (value.finishedAt !== null && (typeof value.finishedAt !== 'number' || !Number.isFinite(value.finishedAt))) {
    throw new TypeError(`finishedAt must be a finite number or null, got: ${JSON.stringify(value.finishedAt)}`);
  }

  if (typeof value.roundIndex !== 'number' || !Number.isInteger(value.roundIndex) || value.roundIndex < 0) {
    throw new RangeError(`roundIndex must be an integer >= 0, got: ${JSON.stringify(value.roundIndex)}`);
  }

  assertStringArray(value.roundIds, 'roundIds');
  assertStringArray(value.usedQuestionKeys, 'usedQuestionKeys');
  assertStringArray(value.previousMatchQuestionKeys, 'previousMatchQuestionKeys');

  if (value.pausedState !== null) {
    assertPausedStateShape(value.pausedState);
  }

  // DECISIONS.md #21: canoniek en onveranderlijk op Match.
  assertNonEmptyString(value.contentVersion, 'contentVersion');
  assertNonEmptyString(value.rendererVersion, 'rendererVersion');
}

module.exports = { assertMatchShape, MATCH_PHASE_VALUES };
