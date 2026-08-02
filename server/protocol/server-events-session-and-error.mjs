/**
 * @file PR5d — server→client payloadvalidators voor `game:rematch-started`,
 *   `session:kicked`, `session:revoked` en `error`.
 * @see docs/multiplayer/PROTOCOL.md — §Server → client events, §Foutcodes.
 * @see docs/protocol-plan/prompts/PR5-server-events.md — sub-batch PR5d.
 *
 * Pure vorm-validatie, geen I/O, geen inhoud (Uitgangspunt 5). De
 * `error`-validator toetst uitsluitend de VORM (`actionId`, `code`, `meta`);
 * hij toetst niet of `code` één van de 23 bekende waarden uit
 * `error-codes.mjs` is (dat is een PR2-contracttest,
 * `error-codes.contract.test.mjs`) en niet of `meta` verboden velden bevat
 * (dat is PR2's `buildErrorPayload`/`FORBIDDEN_META_KEYS` in
 * `error-payload.mjs`, al elders getest) — dus geen import van die twee
 * modules hier, om die verantwoordelijkheden niet te dupliceren. Voor de
 * overige drie validators geldt hetzelfde `code: null`-patroon als in
 * `./server-events-room-lifecycle.mjs`: er is geen PROTOCOL.md-foutcode die
 * "deze server-uitvoer had de verkeerde vorm" betekent.
 */

/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valideert de payload van `game:rematch-started`. `matchId` is literaal
 * (backtick-genoemd in de tabel: niet-lege string, verplicht); `lobbyState`
 * is voorgesteld (proza "lobby-state") als object, verplicht, zonder diepere
 * toets — een leeg object (`{}`) is geldig. Omdat één van de twee velden
 * voorgesteld is, is het totaalschema coulanter (Ontwerpkeuze #2): andere
 * toplevel-sleutels worden niet afgewezen.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameRematchStartedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  const { matchId, lobbyState } = payload;
  if (typeof matchId !== 'string' || matchId.length === 0) return { ok: false, code: null };
  if (!isPlainObject(lobbyState)) return { ok: false, code: null };

  return { ok: true };
}

/**
 * Gedeelde vorm-check voor `session:kicked` en `session:revoked`: beide zijn
 * voorgesteld met exact dezelfde vorm, want `PROTOCOL.md` geeft voor beide
 * alleen "reden" op. `reason` verplicht, niet-lege string. Coulanter schema
 * (Ontwerpkeuze #2): andere toplevel-sleutels worden niet afgewezen.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateReasonOnlyPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  if (typeof payload.reason !== 'string' || payload.reason.length === 0) {
    return { ok: false, code: null };
  }
  return { ok: true };
}

/**
 * Valideert de payload van `session:kicked`. Voorgesteld: `reason` verplicht,
 * niet-lege string.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateSessionKickedPayload(payload) {
  return validateReasonOnlyPayload(payload);
}

/**
 * Valideert de payload van `session:revoked`. Voorgesteld: `reason`
 * verplicht, niet-lege string — zelfde vorm als `session:kicked`.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateSessionRevokedPayload(payload) {
  return validateReasonOnlyPayload(payload);
}

/**
 * Valideert de payload van `error`, tegen het letterlijke voorbeeld uit
 * §Foutcodes. Toetst alleen de VORM (`actionId`: niet-lege string, `code`:
 * niet-lege string, `meta`: object) en staat geen andere toplevel-sleutels
 * toe (literaal, Ontwerpkeuze #2). Toetst niet of `code` een van de 23
 * bekende waarden is en niet of `meta` verboden velden bevat — zie de
 * bestandskop hierboven.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateErrorPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  const keys = Object.keys(payload);
  const expectedKeys = ['actionId', 'code', 'meta'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: null };
  }

  const { actionId, code, meta } = payload;
  if (typeof actionId !== 'string' || actionId.length === 0) return { ok: false, code: null };
  if (typeof code !== 'string' || code.length === 0) return { ok: false, code: null };
  if (!isPlainObject(meta)) return { ok: false, code: null };

  return { ok: true };
}
