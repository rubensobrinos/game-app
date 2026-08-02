/**
 * @file M2 — bouwt `payload` van het server->client `error`-event
 *   (PROTOCOL.md §Foutcodes: `{ actionId, code, meta }`).
 * @see docs/protocol-plan/README.md, fase M2.
 *
 * `actionId` hoort hier niet bij: die kent alleen de aanroeper die de
 * oorspronkelijke actie afhandelde en wordt door de envelope-module (M1)
 * toegevoegd, niet hier.
 */
import { ALL_ERROR_CODES } from './error-codes.mjs';

/**
 * Sleutelnamen die nooit in `meta` mogen voorkomen — op elke nestingsdiepte
 * (ook binnen arrays), hoofdletterongevoelig vergeleken. Dekt displaynaam,
 * token, IP-adres en volledige antwoordpayload (docs/protocol-plan/README.md,
 * fase M2). Dit is een denylist, geen uitputtende whitelist per foutcode.
 * @type {ReadonlyArray<string>}
 */
export const FORBIDDEN_META_KEYS = Object.freeze([
  'displayname', 'effectivename', 'sessiontoken', 'token', 'authorization',
  'bearer', 'ip', 'ipaddress', 'answer', 'payload',
]);

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Gooit zodra `value` (op enige nestingsdiepte, als objectsleutel) een naam
 * uit `FORBIDDEN_META_KEYS` bevat, hoofdletterongevoelig.
 * @param {unknown} value
 * @param {string} path - voor de foutmelding
 */
function assertNoForbiddenKeys(value, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}].`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_META_KEYS.includes(key.toLowerCase())) {
      throw new Error(`buildErrorPayload: meta bevat verboden sleutel "${path}${key}"`);
    }
    assertNoForbiddenKeys(nested, `${path}${key}.`);
  }
}

/**
 * Bouwt `payload` van het server→client `error`-event (`PROTOCOL.md`
 * §Foutcodes: `{ actionId, code, meta }`) — zonder `actionId`.
 *
 * Weigert (throw) in plaats van `meta` stilzwijgend op te schonen: een lek
 * moet zichtbaar breken bij het aanroeppunt tijdens ontwikkeling/tests, niet
 * onopgemerkt de errorenvelope in glippen richting de client.
 *
 * @param {import('./error-codes.mjs').ErrorCode} code - moet voorkomen in
 *   `ALL_ERROR_CODES`.
 * @param {Record<string, unknown>} [meta] - veilige, niet-geheime metadata;
 *   standaard een leeg object.
 * @returns {{ code: import('./error-codes.mjs').ErrorCode, meta: Record<string, unknown> }}
 * @throws {Error} als `code` niet in `ALL_ERROR_CODES` voorkomt.
 * @throws {Error} als `meta` — op enige nestingsdiepte, als sleutelnaam — een
 *   naam uit `FORBIDDEN_META_KEYS` bevat.
 */
export function buildErrorPayload(code, meta = {}) {
  if (!ALL_ERROR_CODES.has(code)) {
    throw new Error(`buildErrorPayload: onbekende foutcode "${code}"`);
  }
  assertNoForbiddenKeys(meta, '');
  return { code, meta };
}
