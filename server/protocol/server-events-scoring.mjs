/**
 * @file PR5c — server→client payloadvalidators voor `round:progress`,
 *   `round:ended`, `scoreboard:updated` en `game:finished`.
 * @see docs/multiplayer/PROTOCOL.md — §Server → client events,
 *   §State-snapshot (voor de `scoreboard`-vorm die hier hergebruikt wordt).
 * @see docs/protocol-plan/prompts/PR5-server-events.md — sub-batch PR5c.
 *
 * Pure vorm-validatie, geen I/O, geen inhoud (Uitgangspunt 5) — geen
 * correctheid/scoring-inhoud, dat is `GAME-RULES.md` ('Niet in scope').
 * Elke `ok: false` hieronder draagt `code: null`, zie de toelichting bovenaan
 * `./server-events-room-lifecycle.mjs`.
 */

/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valideert de payload van `round:progress`. Literaal: `answeredCount` en
 * `eligiblePlayerCount` verplicht, beide niet-negatieve gehele getallen, met
 * `answeredCount <= eligiblePlayerCount`. Geen andere toplevel-sleutels
 * toegestaan (literaal, Ontwerpkeuze #2).
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateRoundProgressPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  const keys = Object.keys(payload);
  const expectedKeys = ['answeredCount', 'eligiblePlayerCount'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: null };
  }

  const { answeredCount, eligiblePlayerCount } = payload;
  if (!Number.isInteger(answeredCount) || answeredCount < 0) return { ok: false, code: null };
  if (!Number.isInteger(eligiblePlayerCount) || eligiblePlayerCount < 0) {
    return { ok: false, code: null };
  }
  if (answeredCount > eligiblePlayerCount) return { ok: false, code: null };

  return { ok: true };
}

/**
 * Valideert de payload van `round:ended`. Voorgesteld voor het gedeelte dat
 * niet ter discussie staat: `roundId` (niet-lege string, verplicht),
 * `correctAnswer` (niet-leeg object, ondoorzichtig — vorm hoort bij
 * `GAME-RULES.md`) en `ownPoints` (niet-negatief getal). Een eventueel
 * `distribution`-veld ("verdeling") wordt hier bewust NIET gevalideerd (Open
 * vraag §11, hier niet opgelost) — aanwezigheid ervan mag de validator niet
 * laten falen, en de vorm ervan wordt ook niet getoetst. Coulanter schema
 * (Ontwerpkeuze #2): andere onbekende toplevel-sleutels worden evenmin
 * afgewezen.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateRoundEndedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  const { roundId, correctAnswer, ownPoints } = payload;
  if (typeof roundId !== 'string' || roundId.length === 0) return { ok: false, code: null };
  if (!isPlainObject(correctAnswer) || Object.keys(correctAnswer).length === 0) {
    return { ok: false, code: null };
  }
  if (typeof ownPoints !== 'number' || !Number.isFinite(ownPoints) || ownPoints < 0) {
    return { ok: false, code: null };
  }

  return { ok: true };
}

/**
 * Valideert de payload van `scoreboard:updated`. Hergebruikt de letterlijke
 * `scoreboard`-vorm uit §State-snapshot (`{ top: [], self: {} }`): `top`
 * moet een array zijn, `self` een object. Voorgesteld veld (geen letterlijk
 * `scoreboard:updated`-voorbeeld) → coulanter schema (Ontwerpkeuze #2): geen
 * afwijzing van onbekende extra toplevel-sleutels of van de inhoud van
 * `top`/`self`.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateScoreboardUpdatedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  if (!Array.isArray(payload.top)) return { ok: false, code: null };
  if (!isPlainObject(payload.self)) return { ok: false, code: null };

  return { ok: true };
}

/**
 * Valideert de payload van `game:finished`. Voorgesteld (proza "podium,
 * eigen samenvatting"): `podium` als array, `self` als niet-leeg object —
 * geen diepere toets op de inhoud van beide (spelinhoud/scoring, niet vorm).
 * Coulanter schema (Ontwerpkeuze #2): onbekende extra toplevel-sleutels
 * worden niet afgewezen.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameFinishedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  if (!Array.isArray(payload.podium)) return { ok: false, code: null };
  if (!isPlainObject(payload.self) || Object.keys(payload.self).length === 0) {
    return { ok: false, code: null };
  }

  return { ok: true };
}
