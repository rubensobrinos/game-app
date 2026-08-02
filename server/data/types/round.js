'use strict';

// Round-vorm uit docs/multiplayer/DATA-MODEL.md ("Round"), uitgebreid met
// validOptionIds/resultDetails na reconciliatie met de herziene
// GR4-question-selection.md (game-rules-plan). Zie
// docs/data-model-plan/prompts/DM3-player-match-round-answer-presentation.md
// voor de volledige spec.
//
// correctAnswer, validOptionIds en resultDetails mogen NOOIT vóór round:ended
// naar de client (PROTOCOL.md Basisregel 4) — zie toActiveRoundSnapshot().

const { GOLF_1_GAME_TYPES } = require('./game-types');

/**
 * @typedef {{
 *   id: string,
 *   matchId: string,
 *   gameType: string,
 *   questionKey: string,
 *   publicQuestionPayload: object,
 *   correctAnswer: object,
 *   validOptionIds?: string[],
 *   resultDetails?: object,
 *   startsAt: number,
 *   endsAt: number,
 *   status: string,
 * }} Round
 */

// gameTypes die validOptionIds verplicht hebben (GR4: optionIso2s in de
// payload, plus deze losse lijst apart voor validateAnswer()'s roundContext).
const GAME_TYPES_REQUIRING_VALID_OPTION_IDS = Object.freeze(['flags_mc', 'capitals_mc']);

// gameTypes die resultDetails verplicht hebben (GR4: waarden/continenten die
// de ronde-uitslag nodig heeft maar die het antwoord zouden verklappen).
const GAME_TYPES_REQUIRING_RESULT_DETAILS = Object.freeze(['higher_lower', 'odd_one_out']);

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
function assertPlainObject(value, fieldName) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${fieldName} must be a plain object, got: ${JSON.stringify(value)}`);
  }
}

/**
 * Valideert alleen de VORM van correctAnswer zelf per gameType — niet of een
 * ingezonden antwoord ermee overeenkomt (dat is server/rules/validators.js's
 * validateAnswer(), niet hier gedupliceerd).
 * @param {string} gameType
 * @param {unknown} correctAnswer
 */
function assertCorrectAnswerShape(gameType, correctAnswer) {
  if (typeof correctAnswer !== 'object' || correctAnswer === null) {
    throw new TypeError(`correctAnswer must be an object, got: ${JSON.stringify(correctAnswer)}`);
  }

  switch (gameType) {
    case 'flags_mc':
    case 'capitals_mc':
      assertNonEmptyString(correctAnswer.optionId, 'correctAnswer.optionId');
      return;
    case 'real_or_fake_flag':
      if (correctAnswer.choice !== 'real' && correctAnswer.choice !== 'fake') {
        throw new RangeError(`correctAnswer.choice must be "real" or "fake", got: ${JSON.stringify(correctAnswer.choice)}`);
      }
      return;
    case 'higher_lower':
      if (correctAnswer.side !== 0 && correctAnswer.side !== 1) {
        throw new RangeError(`correctAnswer.side must be 0 or 1, got: ${JSON.stringify(correctAnswer.side)}`);
      }
      return;
    case 'odd_one_out':
      if (!Number.isInteger(correctAnswer.cardIndex) || correctAnswer.cardIndex < 0) {
        throw new RangeError(`correctAnswer.cardIndex must be an integer >= 0, got: ${JSON.stringify(correctAnswer.cardIndex)}`);
      }
      return;
    default:
      throw new RangeError(`Unknown or non-Golf-1 gameType: ${JSON.stringify(gameType)}`);
  }
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function assertValidOptionIdsShape(value, fieldName) {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every((id) => typeof id === 'string' && id.length > 0) ||
    new Set(value).size !== 4
  ) {
    throw new RangeError(`${fieldName} must contain exactly 4 unique, non-empty strings, got: ${JSON.stringify(value)}`);
  }
}

/**
 * Werpt TypeError/RangeError als value niet aan de Round-vorm voldoet.
 * @param {unknown} value
 */
function assertRoundShape(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`Round must be an object, got: ${value === null ? 'null' : typeof value}`);
  }

  assertNonEmptyString(value.id, 'id');
  assertNonEmptyString(value.matchId, 'matchId');
  assertNonEmptyString(value.questionKey, 'questionKey');

  if (!GOLF_1_GAME_TYPES.includes(value.gameType)) {
    throw new RangeError(`gameType must be one of ${JSON.stringify(GOLF_1_GAME_TYPES)}, got: ${JSON.stringify(value.gameType)}`);
  }

  assertPlainObject(value.publicQuestionPayload, 'publicQuestionPayload');
  assertCorrectAnswerShape(value.gameType, value.correctAnswer);

  const requiresValidOptionIds = GAME_TYPES_REQUIRING_VALID_OPTION_IDS.includes(value.gameType);
  if (requiresValidOptionIds) {
    if (!Object.prototype.hasOwnProperty.call(value, 'validOptionIds')) {
      throw new RangeError(`validOptionIds is required for gameType ${JSON.stringify(value.gameType)}`);
    }
    assertValidOptionIdsShape(value.validOptionIds, 'validOptionIds');
  } else if (Object.prototype.hasOwnProperty.call(value, 'validOptionIds')) {
    throw new RangeError(`validOptionIds must be absent for gameType ${JSON.stringify(value.gameType)}`);
  }

  const requiresResultDetails = GAME_TYPES_REQUIRING_RESULT_DETAILS.includes(value.gameType);
  if (requiresResultDetails) {
    if (!Object.prototype.hasOwnProperty.call(value, 'resultDetails')) {
      throw new RangeError(`resultDetails is required for gameType ${JSON.stringify(value.gameType)}`);
    }
    assertPlainObject(value.resultDetails, 'resultDetails');
  } else if (Object.prototype.hasOwnProperty.call(value, 'resultDetails')) {
    throw new RangeError(`resultDetails must be absent for gameType ${JSON.stringify(value.gameType)}`);
  }

  if (typeof value.startsAt !== 'number' || !Number.isFinite(value.startsAt)) {
    throw new TypeError(`startsAt must be a finite number, got: ${value.startsAt}`);
  }
  if (typeof value.endsAt !== 'number' || !Number.isFinite(value.endsAt)) {
    throw new TypeError(`endsAt must be a finite number, got: ${value.endsAt}`);
  }
  if (value.endsAt <= value.startsAt) {
    throw new RangeError(`endsAt must be greater than startsAt, got startsAt=${value.startsAt}, endsAt=${value.endsAt}`);
  }

  assertNonEmptyString(value.status, 'status');
}

/**
 * Projecteert een Round naar de vorm die veilig is voor een ACTIEVE-ronde-
 * snapshot richting de client — expliciete allowlist, geen object-spread.
 * Werpt als round.status niet "ACTIVE" is (REVIEW-DM2-DM9.md bevinding 15), of
 * als match.id niet overeenkomt met round.matchId.
 * Bevat nooit correctAnswer, resultDetails, validOptionIds of questionKey.
 *
 * `contentVersion`/`rendererVersion` komen van `match` (DECISIONS.md #21: die
 * twee zijn canoniek op Match, niet op Room of Round) — "roundpayloads dragen
 * ze mee voor clients", vandaar de tweede parameter.
 * @param {Round} round
 * @param {import('./match').Match} match
 * @returns {{ id: string, matchId: string, gameType: string, publicQuestionPayload: object, startsAt: number, endsAt: number, status: string, contentVersion: string, rendererVersion: string }}
 */
function toActiveRoundSnapshot(round, match) {
  assertRoundShape(round);
  if (round.status !== 'ACTIVE') {
    throw new RangeError(`toActiveRoundSnapshot expects an ACTIVE round, got status: ${round.status}`);
  }
  if (typeof match !== 'object' || match === null) {
    throw new TypeError(`match must be an object, got: ${match === null ? 'null' : typeof match}`);
  }
  if (match.id !== round.matchId) {
    throw new RangeError(`match.id (${JSON.stringify(match.id)}) does not match round.matchId (${JSON.stringify(round.matchId)})`);
  }
  return {
    id: round.id,
    matchId: round.matchId,
    gameType: round.gameType,
    publicQuestionPayload: round.publicQuestionPayload,
    startsAt: round.startsAt,
    endsAt: round.endsAt,
    status: round.status,
    contentVersion: match.contentVersion,
    rendererVersion: match.rendererVersion,
  };
}

module.exports = {
  assertRoundShape,
  assertCorrectAnswerShape,
  toActiveRoundSnapshot,
  GAME_TYPES_REQUIRING_VALID_OPTION_IDS,
  GAME_TYPES_REQUIRING_RESULT_DETAILS,
};
