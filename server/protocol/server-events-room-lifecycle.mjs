/**
 * @file PR5a — server→client payloadvalidators voor `room:state`,
 *   `room:player-changed`, `room:lock-changed` en `game:started`.
 * @see docs/multiplayer/PROTOCOL.md — §Server → client events.
 * @see docs/protocol-plan/prompts/PR5-server-events.md — sub-batch PR5a.
 *
 * Pure vorm-validatie, geen I/O. Deze module bepaalt geen inhoud (Uitgangspunt
 * 5 in `../README.md`) en geen foutcode — server→client-eventpayloads worden
 * hier gevalideerd op vórm alleen, niet als afwijzing van een clientactie
 * (dat is waar de 23 `error-codes.mjs`-codes voor zijn). Elke `ok: false`
 * hieronder draagt daarom `code: null` — er is geen PROTOCOL.md-foutcode die
 * "deze server-uitvoer had de verkeerde vorm" betekent.
 *
 * `room:state`'s payload is de volledige state-snapshot; de diepe
 * snapshot-vorm wordt pas in PR5d opgeleverd via `validateSnapshotShape`
 * (`./snapshot-shape.mjs`), waar `room:state` exact dezelfde vorm hergebruikt
 * — zelfde gelaagde aanpak als PR4c/PR4d voor `round:answer`. Deze module
 * levert voor `room:state` alleen de ondiepe plaatshoudercontrole.
 */

/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valideert de payload van `room:state`. Dit is voorlopig een ondiepe
 * plaatshoudercontrole (niet-null, niet-array object) — de volledige
 * snapshot-vorm wordt pas in PR5d opgeleverd via `validateSnapshotShape`. Een
 * leeg object (`{}`) telt hier al als geldig; deze functie toetst uitsluitend
 * "is dit een object", niet de inhoud ervan.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateRoomStatePayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  return { ok: true };
}

/** @type {ReadonlySet<'join' | 'leave' | 'rename' | 'kick'>} */
const VALID_PLAYER_CHANGED_DELTA_TYPES = new Set(['join', 'leave', 'rename', 'kick']);

/**
 * Valideert de payload van `room:player-changed`. Voorgesteld (geen
 * letterlijk voorbeeld in `PROTOCOL.md`): telt als geldig wanneer
 * `playerCount` een niet-negatief geheel getal is en `delta.type` één van
 * `"join" | "leave" | "rename" | "kick"` en `delta.playerId` een niet-lege
 * string is. Voorgesteld veld → coulanter schema (Ontwerpkeuze #2): geen
 * afwijzing van onbekende extra sleutels op het toplevel of binnen `delta`.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateRoomPlayerChangedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  const { playerCount, delta } = payload;
  if (!Number.isInteger(playerCount) || playerCount < 0) {
    return { ok: false, code: null };
  }

  if (!isPlainObject(delta)) return { ok: false, code: null };
  if (!VALID_PLAYER_CHANGED_DELTA_TYPES.has(delta.type)) {
    return { ok: false, code: null };
  }
  if (typeof delta.playerId !== 'string' || delta.playerId.length === 0) {
    return { ok: false, code: null };
  }

  return { ok: true };
}

/**
 * Valideert de payload van `room:lock-changed`. Literaal: `locked` verplicht,
 * boolean — en (Ontwerpkeuze #2: literale velden wijzen onbekende sleutels
 * af) geen andere toplevel-sleutels toegestaan.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateRoomLockChangedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'locked') {
    return { ok: false, code: null };
  }
  if (typeof payload.locked !== 'boolean') {
    return { ok: false, code: null };
  }

  return { ok: true };
}

/**
 * Valideert de payload van `game:started`. Literaal: `matchId` (niet-lege
 * string), `totalRounds` (positief geheel getal), `countdownEndsAt`
 * (eindig epoch-ms getal) — alle drie verplicht, geen andere toplevel-
 * sleutels toegestaan (Ontwerpkeuze #2).
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameStartedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  const keys = Object.keys(payload);
  const expectedKeys = ['matchId', 'totalRounds', 'countdownEndsAt'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: null };
  }

  const { matchId, totalRounds, countdownEndsAt } = payload;
  if (typeof matchId !== 'string' || matchId.length === 0) {
    return { ok: false, code: null };
  }
  if (!Number.isInteger(totalRounds) || totalRounds <= 0) {
    return { ok: false, code: null };
  }
  if (typeof countdownEndsAt !== 'number' || !Number.isFinite(countdownEndsAt)) {
    return { ok: false, code: null };
  }

  return { ok: true };
}
