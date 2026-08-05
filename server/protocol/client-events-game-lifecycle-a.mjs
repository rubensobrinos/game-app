/**
 * @file PR4a — `client-events`-module, sub-batch a: payload- en
 *   rolvalidatie voor `game:start`, `game:pause`, `game:resume`, `game:next`
 *   en `game:reveal`.
 * @see docs/multiplayer/PROTOCOL.md — §Client → server events, Basisregel 3.
 * @see docs/protocol-plan/prompts/PR4-client-events.md — sub-batch PR4a.
 *
 * Structuurvalidatie alleen: of de fase `LOBBY` is, of er minimaal één
 * speler is, of de game actief is, en host-tempo/wachtfase zijn allemaal
 * roomstate-afhankelijk en dus 'Niet in scope' (zie promptbestand) — dat
 * hoort bij het latere serverproces, niet bij deze pure structuurvalidators.
 *
 * Elke validator wijst onbekende/extra sleutels af (Ontwerpkeuze #1 uit het
 * promptbestand): nodig om de PR4c/PR4d cross-cutting Bearer-token-test
 * betekenisvol te maken — een schema dat extra sleutels stilzwijgend
 * toestaat, zou een `sessionToken`-veld ook stilzwijgend doorlaten.
 *
 * `ok: false` draagt hier `code: null` (geen `PROTOCOL.md`-foutcode voor
 * "payload voldoet niet aan schema" bij deze 11 niet-`round:answer`-events —
 * zelfde gelaagde aanpak als PR1's `assertPayloadSize` en PR5's
 * server→client-validators).
 */

/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Controleert of de sessierollen de vereiste rol voor een clientevent dekken
 * (PROTOCOL.md §Authenticatie en tijdelijke sessies: `session.roles`).
 * Losstaand van en vóór payloadvalidatie (Ontwerpkeuze #2 uit het
 * promptbestand): een event met correcte payload maar verkeerde rol moet
 * altijd als rolfout worden herkenbaar, nooit als payload-fout.
 * @param {readonly unknown[]} sessionRoles
 * @param {"host" | "player" | "host_or_player"} requiredRole
 * @returns {boolean}
 */
export function hasRequiredRole(sessionRoles, requiredRole) {
  if (!Array.isArray(sessionRoles)) return false;
  if (requiredRole === 'host_or_player') {
    return sessionRoles.includes('host') || sessionRoles.includes('player');
  }
  return sessionRoles.includes(requiredRole);
}

/**
 * Valideert de payload van `game:start`. Verwacht exact een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameStartPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  if (Object.keys(payload).length !== 0) return { ok: false, code: null };
  return { ok: true };
}

/**
 * Valideert de payload van `game:pause`. `reason` is optioneel; indien
 * aanwezig moet het een string zijn. Geen andere sleutels toegestaan.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGamePausePayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  const keys = Object.keys(payload);
  if (keys.some((key) => key !== 'reason')) return { ok: false, code: null };
  if (Object.prototype.hasOwnProperty.call(payload, 'reason') && typeof payload.reason !== 'string') {
    return { ok: false, code: null };
  }
  return { ok: true };
}

/**
 * Valideert de payload van `game:resume`. Verwacht exact een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameResumePayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  if (Object.keys(payload).length !== 0) return { ok: false, code: null };
  return { ok: true };
}

/**
 * Valideert de payload van `game:next`. Verwacht exact een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameNextPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  if (Object.keys(payload).length !== 0) return { ok: false, code: null };
  return { ok: true };
}

/**
 * Valideert de payload van `game:reveal` (besluit C, 5 aug 2026): de
 * hostactie die de uitslag onthult wanneer "Antwoord automatisch tonen"
 * uitstaat. Verwacht exact een leeg object — welke ronde het betreft weet de
 * server zelf, en een meegestuurd rondenummer zou een tweede waarheid zijn.
 *
 * Of de room in de juiste fase staat en of automatisch tonen daadwerkelijk
 * uitstaat, is roomstate en dus 'Niet in scope' voor deze structuurvalidator
 * (zie de bestandskop); `match-lifecycle.mjs` is daar de poort.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameRevealPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  if (Object.keys(payload).length !== 0) return { ok: false, code: null };
  return { ok: true };
}
