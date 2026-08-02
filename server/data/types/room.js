'use strict';

// Room-vorm uit docs/multiplayer/DATA-MODEL.md ("Room"). Zie
// docs/data-model-plan/prompts/DM2b-room.md voor de oorspronkelijke spec.
//
// GEEN contentVersion/rendererVersion hier — niet als tijdelijk gat, maar
// definitief: docs/multiplayer/DECISIONS.md #21 (bevestigd door de
// producteigenaar) legt vast dat die twee velden canoniek en onveranderlijk
// op `Match` horen, niet op Room (zie types/match.js). Dit lost checkpoint 4
// op.
//
// Hernoemd van `RoomCore`/`assertRoomCoreShape` naar `Room`/`assertRoomShape`
// (docs/data-model-plan/prompts/DM-RESUME-AFTER-DECISIONS.md, opdracht 1):
// zolang checkpoint 4 open stond was `RoomCore` een bewust gemarkeerde
// tussenvorm; nu de beslissing definitief is, hoort Room hier niet langer als
// "onvolledig surrogaattype" te blijven hangen — dit IS het complete,
// canonieke Room-type.
//
// Pure module: geen Redis, geen sockets, geen klok.

const { assertGameConfigurationShape } = require('./game-configuration');

/**
 * @typedef {{
 *   id: string,
 *   code: string,
 *   inviteId: string,
 *   phase: "LOBBY" | "COUNTDOWN" | "ROUND_ACTIVE" | "ROUND_RESULT" | "SCOREBOARD" | "PAUSED" | "FINISHED",
 *   createdAt: number,
 *   lastActivityAt: number,
 *   hostSessionIds: string[],
 *   locked: boolean,
 *   config: import('./game-configuration').GameConfiguration,
 *   currentMatchId: string | null,
 * }} Room
 */

// Bron: server/architecture/state-machine.js's PHASES-export (ARCHITECTURE.md
// §State machine). Bewust NIET geïmporteerd: dat bestand is een gedragslaag
// (transition()-reducer), geen neutrale constantsmodule, en
// server/data -> server/architecture is de verkeerde richting zodra
// architecture ooit zelf een repository gebruikt (REVIEW-DM2-DM9.md
// bevinding 10). Zie docs/data-model-plan/HANDOFF.md §5 voor het voorstel van
// een neutrale gedeelde module; deze lijst moet handmatig in sync blijven
// totdat die bestaat. Dezelfde lijst staat onafhankelijk getranscribeerd in
// types/match.js — zie de cross-bestand-consistentietest in match.test.js.
const ROOM_PHASE_VALUES = Object.freeze([
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
 * Werpt TypeError/RangeError als value niet aan de Room-vorm voldoet.
 * `contentVersion`/`rendererVersion` worden, indien aanwezig op `value`,
 * genegeerd — niet gevalideerd, niet vereist (bewust, zie bestandscommentaar).
 * @param {unknown} value
 */
function assertRoomShape(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`Room must be an object, got: ${value === null ? 'null' : typeof value}`);
  }

  assertNonEmptyString(value.id, 'id');
  assertNonEmptyString(value.code, 'code');
  assertNonEmptyString(value.inviteId, 'inviteId');

  if (!ROOM_PHASE_VALUES.includes(value.phase)) {
    throw new RangeError(`phase must be one of ${JSON.stringify(ROOM_PHASE_VALUES)}, got: ${JSON.stringify(value.phase)}`);
  }

  if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt) || value.createdAt < 0) {
    throw new TypeError(`createdAt must be a finite, non-negative number, got: ${value.createdAt}`);
  }
  if (typeof value.lastActivityAt !== 'number' || !Number.isFinite(value.lastActivityAt) || value.lastActivityAt < 0) {
    throw new TypeError(`lastActivityAt must be a finite, non-negative number, got: ${value.lastActivityAt}`);
  }

  if (
    !Array.isArray(value.hostSessionIds) ||
    value.hostSessionIds.length === 0 ||
    !value.hostSessionIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    throw new TypeError(
      `hostSessionIds must be a non-empty array of non-empty strings, got: ${JSON.stringify(value.hostSessionIds)}`
    );
  }

  if (typeof value.locked !== 'boolean') {
    throw new TypeError(`locked must be a boolean, got: ${typeof value.locked}`);
  }

  assertGameConfigurationShape(value.config);

  if (value.currentMatchId !== null) {
    assertNonEmptyString(value.currentMatchId, 'currentMatchId');
  }
}

module.exports = { assertRoomShape, ROOM_PHASE_VALUES };
