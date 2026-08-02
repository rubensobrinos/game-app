'use strict';

// Session-vorm uit docs/multiplayer/DATA-MODEL.md ("Session"). Zie
// docs/data-model-plan/prompts/DM2a-game-configuration-and-session.md voor de
// volledige spec.
//
// Pure module: geen Redis, geen sockets, geen klok, geen hashing-implementatie
// (tokenHash is een opaque string — het hashalgoritme is checkpoint 10, `auth`,
// ADR-plichtig, en wordt hier niet vastgelegd).

/**
 * @typedef {{
 *   id: string,
 *   roomId: string,
 *   roles: Array<"host" | "player">,
 *   playerId: string | null,
 *   tokenHash: string,
 *   createdAt: number,
 *   lastSeenAt: number,
 *   connectedSocketIds: string[],
 *   revoked: boolean,
 * }} Session
 */

const ROLE_VALUES = Object.freeze(['host', 'player']);

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
 * Werpt TypeError/RangeError als value niet aan de Session-vorm voldoet.
 * `tokenHash` wordt uitsluitend gecontroleerd op "niet-lege string" — GEEN
 * prefixcheck (bijv. op "sha256:"). Het voorbeeld in DATA-MODEL.md toont die
 * prefix, maar dat is illustratief, geen formaatgarantie: het hashalgoritme is
 * checkpoint 10 (auth, ADR-plichtig) en een prefixcheck zou die nog niet
 * genomen beslissing feitelijk al vastleggen (REVIEW-DM2-DM9.md bevinding 8).
 * @param {unknown} value
 */
function assertSessionShape(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`Session must be an object, got: ${value === null ? 'null' : typeof value}`);
  }

  assertNonEmptyString(value.id, 'id');
  assertNonEmptyString(value.roomId, 'roomId');

  if (!Array.isArray(value.roles) || value.roles.length === 0) {
    throw new TypeError(`roles must be a non-empty array, got: ${JSON.stringify(value.roles)}`);
  }
  for (const role of value.roles) {
    if (!ROLE_VALUES.includes(role)) {
      throw new RangeError(`roles elements must be one of ${JSON.stringify(ROLE_VALUES)}, got: ${JSON.stringify(role)}`);
    }
  }

  if (value.playerId !== null) {
    assertNonEmptyString(value.playerId, 'playerId');
  }

  assertNonEmptyString(value.tokenHash, 'tokenHash');

  if (typeof value.createdAt !== 'number') {
    throw new TypeError(`createdAt must be a number, got: ${typeof value.createdAt}`);
  }
  if (typeof value.lastSeenAt !== 'number') {
    throw new TypeError(`lastSeenAt must be a number, got: ${typeof value.lastSeenAt}`);
  }

  if (!Array.isArray(value.connectedSocketIds) || !value.connectedSocketIds.every((id) => typeof id === 'string')) {
    throw new TypeError(`connectedSocketIds must be an array of strings, got: ${JSON.stringify(value.connectedSocketIds)}`);
  }

  if (typeof value.revoked !== 'boolean') {
    throw new TypeError(`revoked must be a boolean, got: ${typeof value.revoked}`);
  }
}

module.exports = { assertSessionShape, ROLE_VALUES };
