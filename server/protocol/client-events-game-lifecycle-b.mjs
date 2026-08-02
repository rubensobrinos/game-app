/**
 * @file PR4b — `client-events`-module, sub-batch b: payloadvalidatie voor
 *   `game:lock`, `game:kick`, `game:finish`, `game:rematch`.
 * @see docs/multiplayer/PROTOCOL.md — §Client → server events.
 * @see docs/protocol-plan/prompts/PR4-client-events.md — sub-batch PR4b.
 *
 * Zelfde conventies als PR4a (`./client-events-game-lifecycle-a.mjs`): pure
 * structuurvalidatie, strikte schema's (onbekende sleutels afgewezen),
 * `code: null` bij afwijzing. Of een speler bestaat, of die niet zichzelf als
 * enige host verwijdert (`game:kick`), of de game al `FINISHED` is
 * (`game:finish`/`game:rematch`) — allemaal roomstate-afhankelijk en dus
 * 'Niet in scope', net als bij PR4a.
 */

/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valideert de payload van `game:lock`. `locked` verplicht, boolean, geen
 * andere sleutels.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameLockPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'locked') return { ok: false, code: null };
  if (typeof payload.locked !== 'boolean') return { ok: false, code: null };
  return { ok: true };
}

/**
 * Valideert de payload van `game:kick`. `playerId` verplicht, niet-lege
 * string, geen andere sleutels. Of de speler bestaat en niet zichzelf als
 * enige host verwijdert, valt buiten deze structuurvalidator (roomstate).
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameKickPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'playerId') return { ok: false, code: null };
  if (typeof payload.playerId !== 'string' || payload.playerId.length === 0) {
    return { ok: false, code: null };
  }
  return { ok: true };
}

/**
 * Valideert de payload van `game:finish`. Verwacht exact een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameFinishPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  if (Object.keys(payload).length !== 0) return { ok: false, code: null };
  return { ok: true };
}

/**
 * Valideert de payload van `game:rematch`. Verwacht exact een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameRematchPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  if (Object.keys(payload).length !== 0) return { ok: false, code: null };
  return { ok: true };
}
