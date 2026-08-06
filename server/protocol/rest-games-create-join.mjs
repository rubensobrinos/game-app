/**
 * @file PR3 — rest-games (create/join-deel): request/response-validators voor
 *   `POST /api/v1/games` en `POST /api/v1/games/join`.
 * @see docs/multiplayer/PROTOCOL.md — §REST-endpoints.
 * @see docs/protocol-plan/prompts/PR3-rest-schemas.md — module 3 (`rest-games`),
 *   alleen het create/join-deel: `validateCreateGameRequest`,
 *   `validateCreateGameResponse`, `hostParticipatesInvariantHolds`,
 *   `validateJoinGameRequest`, `validateJoinGameResponse`. De overige
 *   `rest-games`-functies (`validateGetStateRequestShape`,
 *   `validateLeaveGameRequestShape`, `validateTimeResponse`) horen niet bij
 *   dit bestand.
 *
 * Pure vorm-validatie, geen I/O: geen Redis-/Postgres-lookup, geen
 * sessiestore. Het daadwerkelijk bestaan van een `code`/`inviteId`/room
 * (→ `GAME_NOT_FOUND`, `GAME_FULL`, `GAME_ALREADY_STARTED`,
 * `LATE_JOIN_DISABLED`, `ROOM_LOCKED`, `CODE_RATE_LIMITED`) hoort bij het
 * latere serverproces, niet bij deze module ('Niet in scope', PR3-prompt).
 *
 * Foutcode-conventie voor generieke vorm-afwijkingen (bijgewerkt in de
 * PR-slotlichting): `PROTOCOL.md` §Foutcodes kent sindsdien `INVALID_REQUEST`
 * voor een misvormde requestbody zonder specifiekere code. De
 * CREATE-validator gebruikt die (een misvormde create heeft niets met een
 * invite te maken; de UI toonde eerder "ongeldige uitnodiging" bij het
 * aanmaken van een game). JOIN-locatorproblemen blijven `INVITE_INVALID` —
 * daar gáát het over de uitnodiging. Specifieke schendingen met een eigen
 * gedocumenteerde code (`NAME_INVALID`/`NAME_TOO_LONG` via
 * `normalizeAndValidateDisplayName`) gebruiken die eigen code onveranderd.
 */
import { ALL_ERROR_CODES } from './error-codes.mjs';
import { normalizeAndValidateDisplayName } from './input-safety.mjs';

/** @typedef {import('./error-codes.mjs').ErrorCode} ErrorCode */

/**
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, code: ErrorCode }} ValidationResult
 */

const INVITE_INVALID = 'INVITE_INVALID';
const INVALID_REQUEST = 'INVALID_REQUEST';

// Deze module verzint geen eigen foutcodes — ze leent uitsluitend van
// `error-codes.mjs` (single source of truth). Fail fast bij module-load als
// deze codes ooit uit die enum verdwijnen.
for (const code of [INVITE_INVALID, INVALID_REQUEST]) {
  if (!ALL_ERROR_CODES.has(code)) {
    throw new Error(`rest-games-create-join: foutcode "${code}" ontbreekt in ALL_ERROR_CODES`);
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * docs/openstaand/spelersidentiteit.md, stap 4 — zelfde vorm/reden als
 * `snapshot-shape.mjs`'s `isValidIdentity` (lokaal herhaald, geen gedeelde
 * validator-module in dit bestand, zelfde afweging als `isPlainObject`
 * hierboven): `null` of een `{ country, word }`-paar van twee niet-lege
 * strings, nooit gerenderde tekst.
 * @param {unknown} identity
 * @returns {boolean}
 */
function isValidIdentity(identity) {
  if (identity === null) return true;
  if (!isPlainObject(identity)) return false;
  const keys = Object.keys(identity);
  if (keys.length !== 2 || !keys.includes('country') || !keys.includes('word')) return false;
  return (
    typeof identity.country === 'string' && identity.country.length > 0 &&
    typeof identity.word === 'string' && identity.word.length > 0
  );
}

/**
 * Zelfde syntactische vorm als het `{code}` path-parameter elders in
 * `rest-games` (exact zes ASCII-cijfers, `/^[0-9]{6}$/`) — hier lokaal
 * herhaald omdat die validator (`validateGetStateRequestShape`) in een ander
 * bestand van deze module leeft, geen gedeelde bron van waarheid.
 * @type {RegExp}
 */
const GAME_CODE_FORMAT = /^[0-9]{6}$/;

/** @type {ReadonlySet<'host' | 'player'>} */
const VALID_CREATE_ROLES = new Set(['host', 'player']);

/** `joinSource`: `qr | shared_link | code | unknown` (PROTOCOL.md §REST-endpoints). */
const VALID_JOIN_SOURCES = new Set(['qr', 'shared_link', 'code', 'unknown']);

/**
 * Valideert of `value` een syntactisch geldige absolute URL-string is, via
 * een niet-gooiende `new URL(value)`-poging. Open vraag §5 (PR3-prompt,
 * `../README.md`): de constructie van `joinUrl` (basis-URL + `inviteId`)
 * staat nergens gespecificeerd — deze validator neemt dus geen aangenomen
 * basis-URL aan en toetst uitsluitend syntactische geldigheid, niets meer.
 * @param {unknown} value
 * @returns {boolean}
 */
function isSyntacticallyValidUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Valideert een optioneel `displayName`-veld (`string | null`) via
 * `normalizeAndValidateDisplayName` wanneer het een string is; `null` is
 * altijd geldig, elke andere waarde (bv. `undefined`, getal) is ongeldig.
 * @param {unknown} displayName
 * @returns {ValidationResult<string | null>}
 */
function validateOptionalDisplayName(displayName) {
  if (displayName === null) {
    return { ok: true, value: null };
  }
  if (typeof displayName !== 'string') {
    return { ok: false, code: INVITE_INVALID };
  }
  return normalizeAndValidateDisplayName(displayName);
}

/**
 * @param {unknown} body - de rauwe, geparste JSON-requestbody van
 *   `POST /api/v1/games`.
 * @returns {ValidationResult<{
 *   config: { preset: string, language: string },
 *   hostParticipates: boolean,
 *   displayName: string | null,
 * }>}
 */
export function validateCreateGameRequest(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: INVALID_REQUEST };
  }
  const { config, hostParticipates, displayName } = body;

  if (!isPlainObject(config) || typeof config.preset !== 'string' || typeof config.language !== 'string') {
    return { ok: false, code: INVALID_REQUEST };
  }
  if (typeof hostParticipates !== 'boolean') {
    return { ok: false, code: INVALID_REQUEST };
  }

  const displayNameResult = validateOptionalDisplayName(displayName);
  if (!displayNameResult.ok) {
    return displayNameResult;
  }

  return {
    ok: true,
    value: {
      config: { preset: config.preset, language: config.language },
      hostParticipates,
      displayName: displayNameResult.value,
    },
  };
}

/**
 * @param {unknown} body - de rauwe responsebody van `POST /api/v1/games`.
 * @returns {ValidationResult<{
 *   roomId: string, gameCode: string, inviteId: string, joinUrl: string,
 *   sessionToken: string, roles: Array<'host' | 'player'>,
 *   playerId: string | null, effectiveName: string | null,
 *   identity: {country: string, word: string} | null,
 *   state: Record<string, unknown>,
 * }>}
 */
export function validateCreateGameResponse(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: INVITE_INVALID };
  }
  const { roomId, gameCode, inviteId, joinUrl, sessionToken, roles, playerId, effectiveName, identity, state } = body;

  if (typeof roomId !== 'string' || roomId.length === 0) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (typeof gameCode !== 'string' || !GAME_CODE_FORMAT.test(gameCode)) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (typeof inviteId !== 'string' || inviteId.length === 0) {
    return { ok: false, code: INVITE_INVALID };
  }
  // Open vraag §5 — zie isSyntacticallyValidUrl: geen aangenomen basis-URL.
  if (!isSyntacticallyValidUrl(joinUrl)) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (typeof sessionToken !== 'string' || sessionToken.length === 0) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (!Array.isArray(roles) || roles.length === 0 || !roles.every((role) => VALID_CREATE_ROLES.has(role))) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (playerId !== null && typeof playerId !== 'string') {
    return { ok: false, code: INVITE_INVALID };
  }
  if (effectiveName !== null && typeof effectiveName !== 'string') {
    return { ok: false, code: INVITE_INVALID };
  }
  if (!isValidIdentity(identity)) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (!isPlainObject(state)) {
    return { ok: false, code: INVITE_INVALID };
  }

  return {
    ok: true,
    value: {
      roomId,
      gameCode,
      inviteId,
      joinUrl,
      sessionToken,
      roles: [...roles],
      playerId,
      effectiveName,
      identity,
      state,
    },
  };
}

/**
 * Cross-field-invariant uit `PROTOCOL.md`: "Wanneer `hostParticipates =
 * false` zijn `playerId` en `effectiveName` `null`." Losstaand van de
 * losse response-shapecheck hierboven, omdat dit een relatie tussen request
 * en response toetst, niet een enkel object.
 *
 * @param {{ hostParticipates: boolean }} request
 * @param {{ playerId: string | null, effectiveName: string | null }} response
 * @returns {boolean}
 */
export function hostParticipatesInvariantHolds(request, response) {
  if (request.hostParticipates === false) {
    return response.playerId === null && response.effectiveName === null;
  }
  return response.playerId !== null && response.effectiveName !== null;
}

/**
 * @param {unknown} body - de rauwe requestbody van `POST /api/v1/games/join`.
 *   Moet precies één van `inviteId`/`gameCode` bevatten ("Request, precies
 *   één locator"). Geen van beide, of beide tegelijk, wordt afgewezen met
 *   `INVITE_INVALID` (dichtstbijzijnde bestaande Room/join-code — er is geen
 *   aparte "MISSING_OR_DUPLICATE_LOCATOR"-code in `PROTOCOL.md`; dit is een
 *   toepassingskeuze van deze validator, geen citaat).
 * @returns {ValidationResult<
 *   | { inviteId: string, displayName: string | null,
 *       joinSource: 'qr' | 'shared_link' | 'code' | 'unknown' }
 *   | { gameCode: string, displayName: string | null,
 *       joinSource: 'qr' | 'shared_link' | 'code' | 'unknown' }
 * >}
 */
export function validateJoinGameRequest(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: INVITE_INVALID };
  }
  const { inviteId, gameCode, displayName, joinSource } = body;

  const providesInviteId = inviteId !== undefined && inviteId !== null;
  const providesGameCode = gameCode !== undefined && gameCode !== null;
  if (providesInviteId === providesGameCode) {
    // Beide aanwezig, of geen van beide — "precies één locator" geschonden.
    return { ok: false, code: INVITE_INVALID };
  }

  if (providesInviteId && (typeof inviteId !== 'string' || inviteId.length === 0)) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (providesGameCode && (typeof gameCode !== 'string' || !GAME_CODE_FORMAT.test(gameCode))) {
    return { ok: false, code: INVITE_INVALID };
  }

  // Open vraag §6 — joinSource wordt getoetst tegen precies de 4
  // gedocumenteerde waarden, als opaak veld; geen reconciliatie met
  // `share:opened.method`'s 3 waarden, geen vijfde/vierde waarde toegevoegd.
  if (typeof joinSource !== 'string' || !VALID_JOIN_SOURCES.has(joinSource)) {
    return { ok: false, code: INVITE_INVALID };
  }

  const displayNameResult = validateOptionalDisplayName(displayName);
  if (!displayNameResult.ok) {
    return displayNameResult;
  }

  return providesInviteId
    ? { ok: true, value: { inviteId, displayName: displayNameResult.value, joinSource } }
    : { ok: true, value: { gameCode, displayName: displayNameResult.value, joinSource } };
}

/**
 * @param {unknown} body - de rauwe responsebody van
 *   `POST /api/v1/games/join`.
 * @returns {ValidationResult<{
 *   roomId: string, gameCode: string, sessionToken: string,
 *   roles: ['player'], playerId: string, effectiveName: string,
 *   identity: {country: string, word: string} | null,
 *   state: Record<string, unknown>,
 * }>}
 */
export function validateJoinGameResponse(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: INVITE_INVALID };
  }
  const { roomId, gameCode, sessionToken, roles, playerId, effectiveName, identity, state } = body;

  if (typeof roomId !== 'string' || roomId.length === 0) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (typeof gameCode !== 'string' || !GAME_CODE_FORMAT.test(gameCode)) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (typeof sessionToken !== 'string' || sessionToken.length === 0) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (!Array.isArray(roles) || roles.length !== 1 || roles[0] !== 'player') {
    return { ok: false, code: INVITE_INVALID };
  }
  if (typeof playerId !== 'string' || playerId.length === 0) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (typeof effectiveName !== 'string' || effectiveName.length === 0) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (!isValidIdentity(identity)) {
    return { ok: false, code: INVITE_INVALID };
  }
  if (!isPlainObject(state)) {
    return { ok: false, code: INVITE_INVALID };
  }

  return {
    ok: true,
    value: { roomId, gameCode, sessionToken, roles: ['player'], playerId, effectiveName, identity, state },
  };
}
