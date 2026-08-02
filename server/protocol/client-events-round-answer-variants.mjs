/**
 * @file PR4d — de 5 `round:answer.answer`-variant-validators (`optionId`,
 *   `choice`, `side`, `cardIndex`, `text`).
 * @see docs/multiplayer/PROTOCOL.md — §`round:answer`.
 * @see docs/protocol-plan/prompts/PR4-client-events.md — sub-batch PR4d.
 *
 * Elke functie valideert alleen structuur, niet correctheid (dat is
 * `GAME-RULES.md`'s validator-module, niet deze) en niet welke variant bij
 * een gegeven `gameType` hoort (dat is een dispatch op roomstate/rondecontext
 * — zie 'Niet in scope' in het promptbestand). Losstaand van
 * `validateRoundAnswerEnvelope` (`./client-events-dispatch.mjs`), dat alleen
 * de envelopevelden (`roundId`, `answer`, `clientAnsweredAt`) toetst, niet de
 * inhoud van `answer` zelf.
 *
 * Strikte schema's (geen extra sleutels toegestaan) — zelfde Ontwerpkeuze #1
 * als PR4a/b/c, nodig voor de cross-cutting Bearer-token-test hieronder in
 * het testbestand.
 */

/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valideert de "optionId"-vorm van `round:answer.answer` (meerkeuze).
 * `optionId` verplicht, niet-lege string, geen andere sleutels.
 * @param {unknown} answer
 * @returns {ValidationResult}
 */
export function validateOptionIdAnswer(answer) {
  if (!isPlainObject(answer)) return { ok: false, code: null };
  const keys = Object.keys(answer);
  if (keys.length !== 1 || keys[0] !== 'optionId') return { ok: false, code: null };
  if (typeof answer.optionId !== 'string' || answer.optionId.length === 0) {
    return { ok: false, code: null };
  }
  return { ok: true };
}

/**
 * Valideert de "choice"-vorm van `round:answer.answer` (binair). `choice`
 * verplicht, niet-lege string. Geen vaste enum: `PROTOCOL.md` geeft alleen
 * het voorbeeld `"real"`, geen volledige waardenset — vaste waarden zijn
 * (indien nodig) een latere `GAME-RULES.md`-verantwoordelijkheid.
 * @param {unknown} answer
 * @returns {ValidationResult}
 */
export function validateChoiceAnswer(answer) {
  if (!isPlainObject(answer)) return { ok: false, code: null };
  const keys = Object.keys(answer);
  if (keys.length !== 1 || keys[0] !== 'choice') return { ok: false, code: null };
  if (typeof answer.choice !== 'string' || answer.choice.length === 0) {
    return { ok: false, code: null };
  }
  return { ok: true };
}

/**
 * Valideert de "side"-vorm van `round:answer.answer` (hoger/lager). `side`
 * verplicht, geheel getal. Beperking tot `0 | 1` is een afleiding uit de
 * binaire aard van "hoger/lager" (twee kaarten), geen letterlijke
 * `PROTOCOL.md`-waarde.
 * @param {unknown} answer
 * @returns {ValidationResult}
 */
export function validateSideAnswer(answer) {
  if (!isPlainObject(answer)) return { ok: false, code: null };
  const keys = Object.keys(answer);
  if (keys.length !== 1 || keys[0] !== 'side') return { ok: false, code: null };
  if (answer.side !== 0 && answer.side !== 1) return { ok: false, code: null };
  return { ok: true };
}

/**
 * Valideert de "cardIndex"-vorm van `round:answer.answer` (buitenbeentje).
 * `cardIndex` verplicht, geheel getal >= 0. Geen bovengrens: het aantal
 * kaarten is spelinhoud, niet protocolvorm.
 * @param {unknown} answer
 * @returns {ValidationResult}
 */
export function validateCardIndexAnswer(answer) {
  if (!isPlainObject(answer)) return { ok: false, code: null };
  const keys = Object.keys(answer);
  if (keys.length !== 1 || keys[0] !== 'cardIndex') return { ok: false, code: null };
  if (!Number.isInteger(answer.cardIndex) || answer.cardIndex < 0) return { ok: false, code: null };
  return { ok: true };
}

/**
 * Valideert de "text"-vorm van `round:answer.answer` (typen). `text`
 * verplicht, string, na `.trim()` niet-leeg. Geen maximale lengte hier: dat
 * is generieke payloadgrootte (PR1's `assertPayloadSize`), niet een
 * veldspecifieke regel uit `PROTOCOL.md`.
 * @param {unknown} answer
 * @returns {ValidationResult}
 */
export function validateTextAnswer(answer) {
  if (!isPlainObject(answer)) return { ok: false, code: null };
  const keys = Object.keys(answer);
  if (keys.length !== 1 || keys[0] !== 'text') return { ok: false, code: null };
  if (typeof answer.text !== 'string' || answer.text.trim().length === 0) {
    return { ok: false, code: null };
  }
  return { ok: true };
}
