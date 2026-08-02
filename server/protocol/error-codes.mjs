/**
 * @file PR2 — foutcode-enum voor het server->client `error`-event.
 * @see docs/multiplayer/PROTOCOL.md — sectie "Foutcodes".
 *
 * Single source of truth: elke andere module (envelope, rest-games,
 * client-events, server-events, reconnect) importeert codes uitsluitend
 * hiervandaan, nooit als losse stringliteral. De contracttest
 * (`error-codes.contract.test.mjs`) bewaakt dat deze lijst en
 * `docs/multiplayer/PROTOCOL.md` niet uit elkaar lopen.
 */

/**
 * Alle 23 foutcodes uit PROTOCOL.md §Foutcodes, in hun 4 documentcategorieën.
 *
 * @typedef {
 *   | 'GAME_NOT_FOUND' | 'INVITE_INVALID' | 'GAME_FULL' | 'GAME_ALREADY_STARTED'
 *   | 'LATE_JOIN_DISABLED' | 'ROOM_LOCKED' | 'CODE_RATE_LIMITED'
 *   | 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'SESSION_REVOKED' | 'NOT_HOST'
 *   | 'NOT_PLAYER'
 *   | 'INVALID_PHASE' | 'ROUND_NOT_ACTIVE' | 'PLAYER_NOT_ELIGIBLE'
 *   | 'ALREADY_ANSWERED' | 'DEADLINE_PASSED' | 'INVALID_ANSWER_FORMAT'
 *   | 'UNSUPPORTED_EVENT'
 *   | 'NAME_TOO_LONG' | 'NAME_INVALID' | 'RATE_LIMITED'
 *   | 'PROTOCOL_VERSION_UNSUPPORTED' | 'INVALID_REQUEST'
 * } ErrorCode
 */

/**
 * @type {Readonly<Record<
 *   'ROOM_EN_JOIN' | 'AUTORISATIE' | 'GAME_EN_RONDE' | 'INPUT',
 *   ReadonlyArray<ErrorCode>
 * >>}
 */
export const ERROR_CODES_BY_CATEGORY = Object.freeze({
  ROOM_EN_JOIN: Object.freeze([
    // zie docs/protocol-plan/README.md, Open vragen §1 — TTL-verval (4 uur)
    // hergebruikt dit impliciet GAME_NOT_FOUND, of komt er een aparte code?
    // Onbeslist; deze enum legt hier bewust geen aanname vast.
    'GAME_NOT_FOUND',
    'INVITE_INVALID', 'GAME_FULL', 'GAME_ALREADY_STARTED',
    'LATE_JOIN_DISABLED', 'ROOM_LOCKED', 'CODE_RATE_LIMITED',
  ]),
  AUTORISATIE: Object.freeze([
    'TOKEN_INVALID', 'TOKEN_EXPIRED', 'SESSION_REVOKED', 'NOT_HOST',
    'NOT_PLAYER',
  ]),
  GAME_EN_RONDE: Object.freeze([
    'INVALID_PHASE', 'ROUND_NOT_ACTIVE', 'PLAYER_NOT_ELIGIBLE',
    'ALREADY_ANSWERED', 'DEADLINE_PASSED', 'INVALID_ANSWER_FORMAT',
    'UNSUPPORTED_EVENT',
  ]),
  INPUT: Object.freeze([
    'NAME_TOO_LONG', 'NAME_INVALID', 'RATE_LIMITED',
    'PROTOCOL_VERSION_UNSUPPORTED',
    // PR-slotlichting (INT-17-ronde): misvormde requestbody zonder
    // specifiekere code (bv. ontbrekende config.preset bij create). Vóór deze
    // code kreeg een misvormde create INVITE_INVALID, waardoor de UI
    // "ongeldige uitnodiging" toonde bij het AANMAKEN van een game.
    'INVALID_REQUEST',
  ]),
});

/**
 * Platte set van alle 24 codes, voor snelle membership-checks
 * (`ALL_ERROR_CODES.has(code)`) — afgeleid van `ERROR_CODES_BY_CATEGORY`, geen
 * tweede handmatige lijst die uit sync kan raken.
 * @type {ReadonlySet<ErrorCode>}
 */
export const ALL_ERROR_CODES = Object.freeze(
  new Set(Object.values(ERROR_CODES_BY_CATEGORY).flat()),
);
