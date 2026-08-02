// server/composition/context.mjs
//
// De gedeelde naad van de compositielaag: één klein, expliciet object dat elke
// compositiefunctie als eerste argument krijgt. Bewust minimaal — dit bestand
// is het raakvlak tussen room-lifecycle.mjs en match-lifecycle.mjs en moet
// daarom traag veranderen.
//
// LIJM, GEEN DOMEINLOGICA. Alles hieronder knoopt bestaande, al geteste
// modules aan elkaar:
//   - de DataStore-poort            → server/data/repository.js
//   - sessietokens (besluit 26)     → server/protocol/auth-session.mjs
//   - constant-time hashvergelijk   → server/architecture/room-codes.js
// Er wordt hier GEEN tweede hash- of tokenmechanisme verzonnen.
//
// TWEE HARDE REGELS
//
// 1. `now` is verplicht en wordt geïnjecteerd. Geen enkele module in
//    server/composition/ roept `Date.now()` aan. Zonder die regel is de
//    keten-test niet deterministisch en is elke timing-assertie een gok.
// 2. Deze module leest GEEN env-variabelen. `tokenPepper` en `publicAppUrl`
//    komen van de aanroeper (in productie uit TOKEN_PEPPER/PUBLIC_APP_URL,
//    besluit 6) — precies zoals room-codes.js dat voor zijn pepper eist.

import { randomBytes as nodeRandomBytes } from 'node:crypto';

// Named imports uit CommonJS: vooraf geverifieerd (docs/integration-plan/
// HANDOFF.md §"Zelf opgelost"), Node's cjs-module-lexer herkent het
// `module.exports = { … }`-patroon van deze modules. Geen interop-shim nodig.
import { assertImplementsDataStore } from '../data/repository.js';
import { inviteHashEquals, MIN_PEPPER_BYTES } from '../architecture/room-codes.js';
import { generateSessionToken, hashToken } from '../protocol/auth-session.mjs';

/**
 * @typedef {{
 *   store: import('../data/repository.js').DataStore,
 *   now: () => number,
 *   config: Readonly<{ tokenPepper: string|NodeJS.ArrayBufferView, publicAppUrl: string }>,
 *   cryptoSource: { randomBytes: (size: number) => Buffer },
 * }} Context
 */

/** Default randomness-bron; overschrijfbaar zodat tests niet hoeven te monkeypatchen. */
const DEFAULT_CRYPTO_SOURCE = { randomBytes: nodeRandomBytes };

/**
 * Bytelengte van een pepper-waarde. Dezelfde twee vormen die room-codes.js's
 * (niet-geëxporteerde) assertUsablePepper accepteert voor `hashInviteId`; de
 * ondergrens komt óók daarvandaan (MIN_PEPPER_BYTES), zodat er niet twee
 * verschillende sterkte-eisen in de codebase staan.
 * @param {unknown} pepper
 * @returns {number|null} bytelengte, of null als het type onbruikbaar is
 */
function pepperByteLength(pepper) {
  if (typeof pepper === 'string') {
    return Buffer.byteLength(pepper, 'utf8');
  }
  if (ArrayBuffer.isView(pepper)) {
    return pepper.byteLength;
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {boolean} of `value` een absolute, parseerbare http(s)-URL is
 */
function isAbsoluteUrl(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Bouwt de compositiecontext en valideert alle drie de ingangen hard, bij
 * opstarten in plaats van bij het eerste gebruik.
 *
 * `config` mag meer velden bevatten dan de twee verplichte (bijv.
 * `nameWordLists`, `profanityWords` voor server/data/name-processing.js); die
 * worden ongewijzigd doorgegeven. De context bevriest een ondiepe kopie zodat
 * een aanroeper hem na constructie niet meer stilletjes kan omzetten.
 *
 * @param {{
 *   store: object,
 *   now: () => number,
 *   config: { tokenPepper: string|NodeJS.ArrayBufferView, publicAppUrl: string, [k: string]: unknown },
 *   cryptoSource?: { randomBytes: (size: number) => Buffer },
 * }} params
 * @returns {Context}
 * @throws {TypeError} bij een store die de poort niet implementeert, een
 *   ontbrekende/ongeldige `now`, of een onbruikbare `config`
 */
export function createContext({ store, now, config, cryptoSource = DEFAULT_CRYPTO_SOURCE } = {}) {
  // Poortcontract: 18 methoden. Dit is het vangnet, geen eigen validatie.
  assertImplementsDataStore(store);

  if (typeof now !== 'function') {
    throw new TypeError('createContext: `now` is verplicht en moet een functie () => epoch-ms zijn.');
  }
  const probe = now();
  if (typeof probe !== 'number' || !Number.isFinite(probe) || probe < 0) {
    throw new TypeError(`createContext: \`now()\` moet een eindig, niet-negatief getal (epoch-ms) teruggeven, kreeg: ${JSON.stringify(probe)}`);
  }

  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new TypeError('createContext: `config` moet een object zijn.');
  }

  const pepperBytes = pepperByteLength(config.tokenPepper);
  if (pepperBytes === null) {
    throw new TypeError('createContext: `config.tokenPepper` moet een string of een Buffer/TypedArray zijn; deze module kent geen default.');
  }
  if (pepperBytes < MIN_PEPPER_BYTES) {
    throw new TypeError(`createContext: \`config.tokenPepper\` is ${pepperBytes} byte(s); minimaal ${MIN_PEPPER_BYTES} bytes vereist (room-codes.js MIN_PEPPER_BYTES).`);
  }

  if (!isAbsoluteUrl(config.publicAppUrl)) {
    throw new TypeError(`createContext: \`config.publicAppUrl\` moet een absolute http(s)-URL zijn (besluit 6, PUBLIC_APP_URL), kreeg: ${JSON.stringify(config.publicAppUrl)}`);
  }

  if (typeof cryptoSource !== 'object' || cryptoSource === null || typeof cryptoSource.randomBytes !== 'function') {
    throw new TypeError('createContext: `cryptoSource` moet { randomBytes(size) } zijn.');
  }

  return Object.freeze({
    store,
    now,
    config: Object.freeze({ ...config }),
    cryptoSource,
  });
}

/**
 * Genereert een identifier met een leesbaar prefix, zoals DATA-MODEL.md die
 * toont (`room_01J…`, `sess_01J…`, `p_a1b2c3`).
 *
 * KEUZE — de bron schrijft geen ID-formaat voor en er bestaat geen
 * ID-generatormodule in server/data of server/architecture. Gekozen:
 * `{prefix}_{base64url(9 bytes)}` = 12 tekens entropie-deel. base64url bevat
 * geen `:` of glob-tekens, dus elke ID is direct bruikbaar als segment in
 * server/data/redis-keys.js (assertSegment). Ondergebracht in deze gedeelde
 * naad zodat room- en match-lifecycle dezelfde generator gebruiken.
 *
 * @param {Context} context
 * @param {string} prefix - bijv. 'room', 'sess', 'p', 'match', 'round'
 * @returns {string}
 */
export function createId(context, prefix) {
  if (typeof prefix !== 'string' || prefix.length === 0) {
    throw new TypeError(`createId: prefix moet een niet-lege string zijn, kreeg: ${JSON.stringify(prefix)}`);
  }
  return `${prefix}_${context.cryptoSource.randomBytes(9).toString('base64url')}`;
}

/**
 * Sessietoken conform besluit 26: 32 random bytes → base64url (43 tekens),
 * opslag als HMAC-SHA256 met de pepper. Beide stappen komen ongewijzigd uit
 * server/protocol/auth-session.mjs — deze functie is puur de bedrading die de
 * pepper uit de context haalt en het paar teruggeeft.
 *
 * Het KLARE token verlaat de server precies één keer, in de create/join-
 * response. Alleen `tokenHash` gaat naar de store (Session.tokenHash).
 *
 * @param {Context} context
 * @returns {{ token: string, tokenHash: string }}
 */
export function createSessionToken(context) {
  const token = generateSessionToken(context.cryptoSource);
  return { token, tokenHash: hashSessionToken(context, token) };
}

/**
 * Hasht een bestaand token met dezelfde constructie als createSessionToken.
 * Nodig om een binnenkomend token tegen een opgeslagen `Session.tokenHash` te
 * leggen zonder het token ooit op te slaan.
 *
 * @param {Context} context
 * @param {string} token
 * @returns {string} 64 tekens lowercase hex
 */
export function hashSessionToken(context, token) {
  return hashToken(token, context.config.tokenPepper);
}

/**
 * Constant-time verificatie van een aangeboden token tegen een opgeslagen
 * hash (besluit 26). Gebruikt `inviteHashEquals` uit room-codes.js — dat is
 * exact een timingSafeEqual over 64 hex-tekens, en de tokenhash heeft
 * dezelfde vorm. Geen tweede vergelijkingsmechanisme dus.
 *
 * Werpt NOOIT: vijandige invoer (niet-string, lege string, misvormde hash)
 * levert `false`. Dat is bewust — dit draait op spelerinvoer.
 *
 * @param {Context} context
 * @param {unknown} token
 * @param {unknown} expectedHash
 * @returns {boolean}
 */
export function verifySessionToken(context, token, expectedHash) {
  if (typeof token !== 'string' || token.length === 0) {
    return false;
  }
  let actualHash;
  try {
    actualHash = hashSessionToken(context, token);
  } catch {
    return false;
  }
  return inviteHashEquals(actualHash, expectedHash);
}
