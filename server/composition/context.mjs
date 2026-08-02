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
// 2. Deze module leest GEEN env-variabelen. `tokenPeppers` en `publicAppUrl`
//    komen van de aanroeper (in productie uit de omgeving, besluit 6) —
//    precies zoals room-codes.js dat voor zijn pepper eist. Hoe een
//    versieerbare peppermap uit `.env` komt (nu staat er één platte
//    `TOKEN_PEPPER=` in .env.example en docker-compose.yml) is een
//    prod-/secretsbeslissing en valt uitdrukkelijk buiten deze module.

import { randomBytes as nodeRandomBytes } from 'node:crypto';

// Named imports uit CommonJS: vooraf geverifieerd (docs/integration-plan/
// HANDOFF.md §"Zelf opgelost"), Node's cjs-module-lexer herkent het
// `module.exports = { … }`-patroon van deze modules. Geen interop-shim nodig.
import { assertImplementsDataStore } from '../data/repository.js';
import { MIN_PEPPER_BYTES } from '../architecture/room-codes.js';
import { generateSessionToken, hashToken, verifyToken } from '../protocol/auth-session.mjs';

/**
 * De pepperbundel van de compositielaag (besluit 26, tweede helft: versieerbare
 * HMAC-SHA256 met pepper).
 *
 * VORMKEUZE — `{ version, peppers }` in plaats van een platte `tokenPepper`:
 *   - `peppers` IS het `peppersByVersion`-argument van
 *     `auth-session.mjs#verifyToken`. Het gaat er ongewijzigd in; er wordt
 *     nergens ter plekke een map omgebouwd, dus er kan ook nergens een
 *     versie stilletjes uit die map vallen.
 *   - `version` is de ACTIEVE versie: waarmee nieuwe tokens gehasht worden.
 *     Oude versies blijven gewoon in `peppers` staan en blijven daardoor
 *     verifieerbaar — dat is precies wat een rotatie nodig heeft.
 *   - Eén samenhangend veld in plaats van twee losse configsleutels, zodat
 *     "actieve versie" en "geldige peppers" niet uit elkaar kunnen lopen.
 *
 * Peppers zijn hier ALTIJD strings. `hashToken`/`verifyToken` eisen dat
 * (`typeof pepper !== 'string'` → throw resp. `false`), dus een Buffer-pepper
 * zou pas bij het eerste token stukgaan; die faalt hier nu al bij opstarten.
 * @typedef {{ version: string, peppers: Readonly<Record<string, string>> }} TokenPeppers
 */

/**
 * @typedef {{
 *   store: import('../data/repository.js').DataStore,
 *   now: () => number,
 *   config: Readonly<{ tokenPeppers: TokenPeppers, publicAppUrl: string }>,
 *   cryptoSource: { randomBytes: (size: number) => Buffer },
 * }} Context
 */

/** Default randomness-bron; overschrijfbaar zodat tests niet hoeven te monkeypatchen. */
const DEFAULT_CRYPTO_SOURCE = { randomBytes: nodeRandomBytes };

/**
 * Keurt de pepperbundel en levert een bevroren, genormaliseerde kopie op.
 *
 * De ondergrens per pepper komt uit room-codes.js (MIN_PEPPER_BYTES), zodat er
 * niet twee verschillende sterkte-eisen in de codebase staan — ook een pepper
 * die alleen nog voor verificatie van oude sessies in de map zit moet daaraan
 * voldoen; een zwakke oude pepper is even lek als een zwakke nieuwe.
 *
 * @param {unknown} tokenPeppers
 * @returns {Readonly<{ version: string, peppers: Readonly<Record<string, string>> }>}
 * @throws {TypeError} bij een ontbrekende/onbruikbare vorm, een lege
 *   peppermap, een actieve versie die niet in de map staat, of een pepper die
 *   geen string is of onder MIN_PEPPER_BYTES blijft
 */
function normalizeTokenPeppers(tokenPeppers) {
  if (typeof tokenPeppers !== 'object' || tokenPeppers === null || Array.isArray(tokenPeppers)) {
    throw new TypeError('createContext: `config.tokenPeppers` moet een object { version, peppers } zijn; deze module kent geen default.');
  }
  const { version, peppers } = tokenPeppers;
  if (typeof version !== 'string' || version.length === 0) {
    throw new TypeError(`createContext: \`config.tokenPeppers.version\` moet een niet-lege string zijn (de actieve pepperversie), kreeg: ${JSON.stringify(version)}`);
  }
  if (typeof peppers !== 'object' || peppers === null || Array.isArray(peppers)) {
    throw new TypeError('createContext: `config.tokenPeppers.peppers` moet een object { [versie]: pepper } zijn.');
  }
  const entries = Object.entries(peppers);
  if (entries.length === 0) {
    throw new TypeError('createContext: `config.tokenPeppers.peppers` mag niet leeg zijn.');
  }
  for (const [pepperVersion, pepper] of entries) {
    // String, geen Buffer: auth-session.mjs's hashToken/verifyToken accepteren
    // uitsluitend strings. Hier falen is opstarttijd; daar falen is looptijd.
    if (typeof pepper !== 'string' || pepper.length === 0) {
      throw new TypeError(`createContext: \`config.tokenPeppers.peppers[${JSON.stringify(pepperVersion)}]\` moet een niet-lege string zijn.`);
    }
    const pepperBytes = Buffer.byteLength(pepper, 'utf8');
    if (pepperBytes < MIN_PEPPER_BYTES) {
      throw new TypeError(`createContext: \`config.tokenPeppers.peppers[${JSON.stringify(pepperVersion)}]\` is ${pepperBytes} byte(s); minimaal ${MIN_PEPPER_BYTES} bytes vereist (room-codes.js MIN_PEPPER_BYTES).`);
    }
  }
  if (!Object.hasOwn(peppers, version)) {
    throw new TypeError(`createContext: actieve pepperversie ${JSON.stringify(version)} ontbreekt in \`config.tokenPeppers.peppers\` (aanwezig: ${JSON.stringify(Object.keys(peppers))}).`);
  }
  // Twee niveaus bevriezen: `Object.freeze({ ...config })` hieronder is ondiep,
  // dus zonder dit zou een aanroeper de peppermap ná constructie alsnog kunnen
  // omzetten — precies wat die freeze wil uitsluiten.
  return Object.freeze({ version, peppers: Object.freeze({ ...peppers }) });
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
 *   config: { tokenPeppers: TokenPeppers, publicAppUrl: string, [k: string]: unknown },
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

  const tokenPeppers = normalizeTokenPeppers(config.tokenPeppers);

  if (!isAbsoluteUrl(config.publicAppUrl)) {
    throw new TypeError(`createContext: \`config.publicAppUrl\` moet een absolute http(s)-URL zijn (besluit 6, PUBLIC_APP_URL), kreeg: ${JSON.stringify(config.publicAppUrl)}`);
  }

  if (typeof cryptoSource !== 'object' || cryptoSource === null || typeof cryptoSource.randomBytes !== 'function') {
    throw new TypeError('createContext: `cryptoSource` moet { randomBytes(size) } zijn.');
  }

  return Object.freeze({
    store,
    now,
    config: Object.freeze({ ...config, tokenPeppers }),
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
 * opslag als `${versie}:${HMAC-SHA256-hex}` met de ACTIEVE pepper. Beide
 * stappen komen ongewijzigd uit server/protocol/auth-session.mjs — deze
 * functie is puur de bedrading die de pepper uit de context haalt en het paar
 * teruggeeft.
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
 * Hasht een bestaand token met dezelfde constructie als createSessionToken:
 * altijd met de ACTIEVE pepperversie. Nodig om een nieuw token te kunnen
 * opslaan; om een BESTAANDE hash te controleren is `verifySessionToken` de
 * juiste ingang — die kan ook nog met een oudere versie gehashte tokens aan.
 *
 * @param {Context} context
 * @param {string} token
 * @returns {string} `${versie}:${64 tekens lowercase hex}`
 */
export function hashSessionToken(context, token) {
  const { version, peppers } = context.config.tokenPeppers;
  return hashToken(token, { version, pepper: peppers[version] });
}

/**
 * Constant-time verificatie van een aangeboden token tegen een opgeslagen
 * hash (besluit 26). Delegeert volledig aan `verifyToken` uit
 * auth-session.mjs: die leest de pepperversie uit `expectedHash`, zoekt de
 * bijbehorende pepper op in de peppermap en vergelijkt met `timingSafeEqual`.
 * Geen tweede vergelijkingsmechanisme naast dat van de protocollaag — en een
 * kale hashvergelijking zou sowieso niet meer kloppen nu de opgeslagen hash
 * een versieprefix draagt.
 *
 * Hierdoor verifieert een token dat met een ÓUDE pepperversie is gehasht nog
 * steeds, zolang die versie in `config.tokenPeppers.peppers` blijft staan —
 * dat is de rotatie waarvoor besluit 26 de versionering vraagt.
 *
 * Werpt NOOIT: vijandige invoer (niet-string, lege string, misvormde hash,
 * onbekende pepperversie) levert `false`. Dat is bewust — dit draait op
 * spelerinvoer.
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
  // Optional chaining zodat ook een handmatig samengestelde context (buiten
  // createContext om) `false` oplevert in plaats van te werpen; verifyToken
  // verdraagt een ontbrekende peppermap zelf al.
  return verifyToken(token, expectedHash, context.config.tokenPeppers?.peppers);
}
