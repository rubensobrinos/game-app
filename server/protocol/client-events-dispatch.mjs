/**
 * @file PR4c — `client-events`-module, sub-batch c: `player:rename`,
 *   `player:leave`, `round:answer` (envelopeniveau), `share:opened`, en
 *   `resolveEventValidator` (de dispatch-lookup voor alle 12 clientevents).
 * @see docs/multiplayer/PROTOCOL.md — §Client → server events, Basisregel 7.
 * @see docs/protocol-plan/prompts/PR4-client-events.md — sub-batch PR4c.
 *
 * Hergebruikt PR4a/PR4b's validators en `hasRequiredRole` via import — geen
 * duplicatie. `resolveEventValidator` is de enige plek die de 12 bekende
 * eventnamen opsomt als geldig alfabet: alles daarbuiten levert
 * `UNSUPPORTED_EVENT` op (Basisregel 7: "onbekende clientevents leveren
 * `UNSUPPORTED_EVENT`"), nooit een throw en nooit een stille passthrough.
 */
import {
  hasRequiredRole,
  validateGameStartPayload,
  validateGamePausePayload,
  validateGameResumePayload,
  validateGameNextPayload,
} from './client-events-game-lifecycle-a.mjs';
import {
  validateGameLockPayload,
  validateGameKickPayload,
  validateGameFinishPayload,
  validateGameRematchPayload,
} from './client-events-game-lifecycle-b.mjs';

/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valideert de payload van `player:rename`. Toetst alleen aanwezigheid en
 * stringtype van `displayName` — NFKC-normalisatie, control-character-
 * verwijdering en de 20-tekenlimiet horen bij `input-safety.mjs` (PR3), niet
 * hier. Geen andere sleutels toegestaan.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validatePlayerRenamePayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'displayName') return { ok: false, code: null };
  if (typeof payload.displayName !== 'string') return { ok: false, code: null };
  return { ok: true };
}

/**
 * Valideert de payload van `player:leave`. Verwacht exact een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validatePlayerLeavePayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  if (Object.keys(payload).length !== 0) return { ok: false, code: null };
  return { ok: true };
}

/**
 * Valideert de envelopevelden van `round:answer`: `roundId` (niet-lege
 * string), `answer` (niet-lege, niet-array object — de inhoud zelf wordt hier
 * NIET verder gevalideerd, dat gebeurt in PR4d door de vijf variant-
 * validators) en `clientAnsweredAt` (eindig getal). Geen andere toplevel-
 * sleutels toegestaan (Ontwerpkeuze #1) — dit maakt de cross-cutting
 * Bearer-token-test (PR4c) betekenisvol: een extra `sessionToken`-veld wordt
 * hierdoor al afgewezen zonder dat deze functie die naam kent.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateRoundAnswerEnvelope(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  const keys = Object.keys(payload);
  const expectedKeys = ['roundId', 'answer', 'clientAnsweredAt'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: null };
  }

  const { roundId, answer, clientAnsweredAt } = payload;
  if (typeof roundId !== 'string' || roundId.length === 0) return { ok: false, code: null };
  if (!isPlainObject(answer) || Object.keys(answer).length === 0) return { ok: false, code: null };
  if (typeof clientAnsweredAt !== 'number' || !Number.isFinite(clientAnsweredAt)) {
    return { ok: false, code: null };
  }

  return { ok: true };
}

/** @type {ReadonlySet<'qr' | 'link' | 'native' | 'code'>} */
const VALID_SHARE_METHODS = new Set(['qr', 'link', 'native', 'code']);

/**
 * Valideert de payload van `share:opened`. `method` verplicht, exact één van
 * `"qr" | "link" | "native" | "code"` (`DECISIONS.md` punt 18: de vier
 * herkomsten zijn gelijkgetrokken — voorheen bespraken PROTOCOL.md §Client →
 * server events en Open vraag §6 in `../README.md` nog maar drie
 * gedocumenteerde waarden). Geen andere sleutels toegestaan.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateShareOpenedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'method') return { ok: false, code: null };
  if (!VALID_SHARE_METHODS.has(payload.method)) return { ok: false, code: null };
  return { ok: true };
}

/**
 * @typedef {{
 *   validate: (payload: unknown) => ValidationResult,
 *   requiredRole: "host" | "player" | "host_or_player",
 * }} EventValidatorEntry
 */

/**
 * De 12 bekende clientevents uit §Client → server events, met hun validator
 * en vereiste rol. Enige bron van waarheid voor "welke eventnamen bestaan" —
 * `resolveEventValidator` doet een pure lookup hierop, geen tweede lijst.
 * @type {ReadonlyMap<string, EventValidatorEntry>}
 */
const EVENT_VALIDATORS_BY_NAME = new Map([
  ['game:start', { validate: validateGameStartPayload, requiredRole: 'host' }],
  ['game:pause', { validate: validateGamePausePayload, requiredRole: 'host' }],
  ['game:resume', { validate: validateGameResumePayload, requiredRole: 'host' }],
  ['game:next', { validate: validateGameNextPayload, requiredRole: 'host' }],
  ['game:lock', { validate: validateGameLockPayload, requiredRole: 'host' }],
  ['game:kick', { validate: validateGameKickPayload, requiredRole: 'host' }],
  ['game:finish', { validate: validateGameFinishPayload, requiredRole: 'host' }],
  ['game:rematch', { validate: validateGameRematchPayload, requiredRole: 'host' }],
  ['player:rename', { validate: validatePlayerRenamePayload, requiredRole: 'player' }],
  ['player:leave', { validate: validatePlayerLeavePayload, requiredRole: 'player' }],
  ['round:answer', { validate: validateRoundAnswerEnvelope, requiredRole: 'player' }],
  ['share:opened', { validate: validateShareOpenedPayload, requiredRole: 'host_or_player' }],
]);

/**
 * Alle 12 bekende clientevent-namen, afgeleid van `EVENT_VALIDATORS_BY_NAME`
 * (geen tweede handmatige lijst), voor gebruik in exhaustiviteitstests.
 * @type {ReadonlyArray<string>}
 */
export const ALL_CLIENT_EVENT_NAMES = Object.freeze([...EVENT_VALIDATORS_BY_NAME.keys()]);

/**
 * Zoekt de validator en rolvereiste op voor een clientevent-naam. Basisregel
 * 7: "onbekende clientevents leveren `UNSUPPORTED_EVENT`" — dit is de enige
 * plek waar dat wordt beslist, nooit een throw en nooit een stille
 * passthrough voor een onbekende naam.
 * @param {string} eventName
 * @returns {{ ok: true, entry: EventValidatorEntry } | { ok: false, code: 'UNSUPPORTED_EVENT' }}
 */
export function resolveEventValidator(eventName) {
  const entry = EVENT_VALIDATORS_BY_NAME.get(eventName);
  if (entry === undefined) {
    return { ok: false, code: 'UNSUPPORTED_EVENT' };
  }
  return { ok: true, entry };
}

/**
 * Re-exporteert `hasRequiredRole` (gedefinieerd in PR4a) zodat aanroepers die
 * alleen dit dispatch-bestand importeren niet ook nog los
 * `client-events-game-lifecycle-a.mjs` hoeven te kennen.
 */
export { hasRequiredRole };
