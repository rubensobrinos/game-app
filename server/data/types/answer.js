'use strict';

// Answer-vorm uit docs/multiplayer/DATA-MODEL.md ("Answer") — volledig
// gegeven, geen open interpretatievraag. Zie
// docs/data-model-plan/prompts/DM3-player-match-round-answer-presentation.md.

/**
 * @typedef {{
 *   roundId: string,
 *   playerId: string,
 *   actionId: string,
 *   answer: object,
 *   receivedAt: number,
 *   responseTimeMs: number,
 *   correct: boolean,
 *   points: number,
 * }} Answer
 */

const MAX_POINTS_PER_ROUND = 200; // GAME-RULES.md §Puntentelling: "maximaal 200 punten per ronde"

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
 * Werpt TypeError/RangeError als value niet aan de Answer-vorm voldoet.
 * `answer`'s interne vorm hangt af van gameType (zie
 * server/rules/validators.js's extractClientField) — hier alleen "is het een
 * plain object", geen dubbele validatie.
 * @param {unknown} value
 */
function assertAnswerShape(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`Answer must be an object, got: ${value === null ? 'null' : typeof value}`);
  }

  assertNonEmptyString(value.roundId, 'roundId');
  assertNonEmptyString(value.playerId, 'playerId');
  assertNonEmptyString(value.actionId, 'actionId');

  if (
    typeof value.answer !== 'object' ||
    value.answer === null ||
    Array.isArray(value.answer) ||
    Object.getPrototypeOf(value.answer) !== Object.prototype
  ) {
    throw new TypeError(`answer must be a plain object, got: ${JSON.stringify(value.answer)}`);
  }

  if (typeof value.receivedAt !== 'number' || !Number.isFinite(value.receivedAt) || value.receivedAt < 0) {
    throw new TypeError(`receivedAt must be a finite, non-negative number, got: ${value.receivedAt}`);
  }

  if (typeof value.responseTimeMs !== 'number' || !Number.isInteger(value.responseTimeMs) || value.responseTimeMs < 0) {
    throw new RangeError(`responseTimeMs must be a non-negative integer, got: ${JSON.stringify(value.responseTimeMs)}`);
  }

  if (typeof value.correct !== 'boolean') {
    throw new TypeError(`correct must be a boolean, got: ${typeof value.correct}`);
  }

  if (
    typeof value.points !== 'number' ||
    !Number.isInteger(value.points) ||
    value.points < 0 ||
    value.points > MAX_POINTS_PER_ROUND
  ) {
    throw new RangeError(`points must be an integer in [0, ${MAX_POINTS_PER_ROUND}], got: ${JSON.stringify(value.points)}`);
  }
}

module.exports = { assertAnswerShape, MAX_POINTS_PER_ROUND };
