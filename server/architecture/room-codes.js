'use strict';

// Join-code, inviteId en de invite-hashindex van één room. Zie
// docs/multiplayer/ARCHITECTURE.md ("Join-code en inviteId", subsecties "Code" en
// "inviteId") als bronspec, en docs/multiplayer/DATA-MODEL.md ("Room" voor de
// velden `code`/`inviteId`, "Redis-sleutels" voor `room:code:{code}` en
// `room:invite:{inviteHash}`).
//
// Pure module: geen Redis, sockets, HTTP, filesystem, timers, klok of
// env-variabelen. De enige afhankelijkheid is `node:crypto`. Alles wat deze
// module niet zelf kan weten komt als expliciet argument binnen:
//
//   - uniciteit onder actieve rooms → callback `isTaken` (de aanroeper kent
//     `room:code:{code}` in Redis, deze module niet);
//   - de pepper voor de hashindex → argument `pepper` (in productie uit
//     `TOKEN_PEPPER`). Deze module LEEST GEEN env en heeft bewust GEEN
//     default-pepper: een ingebakken default zou stilzwijgend een zwakke,
//     gedeelde index opleveren zodra de aanroeper de pepper vergeet.
//
// Iedere gegenereerde waarde komt uit een verse `crypto.randomBytes`-aanroep.
// Er is geen teller, geen seed, geen gedeelde state tussen aanroepen — een
// eerdere waarde geeft dus geen enkele informatie over een volgende
// ("nooit oplopend", ARCHITECTURE.md).
//
// FOUTCONTRACT — bewust anders dan state-machine.js in deze map. Die reducer
// verwerkt protocolinvoer en levert daarom altijd { ok: false, code }. Hier
// gaat het om generatie, en een generator heeft geen zinnige "lege" waarde:
//
//   - generateGameCode() geeft bij succes de code als PLATTE STRING terug en
//     WERPT bij uitputting een GameCodeExhaustedError (name
//     'GameCodeExhaustedError', code 'CODE_SPACE_EXHAUSTED', veld `attempts`).
//     De aanroeper moet dat vertalen naar een protocolfout; stil doorgaan met
//     een mogelijk bezette code mag nooit.
//   - generateInviteId() kan niet falen.
//   - hashInviteId() werpt TypeError op ongeldige argumenten: dat is een
//     programmeerfout van de aanroeper, geen spelerinvoer. Spelerinvoer hoort
//     ERVOOR door isValidInviteId() te gaan.
//   - isValidGameCode()/isValidInviteId()/isValidInviteHash() werpen NOOIT en
//     geven altijd een boolean, ook op vijandige input.
//
// SYNCHROON CONTRACT — `isTaken` is en blijft SYNCHROON en moet een echte
// boolean teruggeven. Een `async` callback levert een Promise op, en een Promise
// is nooit `=== true`; die zou de uniciteitscontrole stilzwijgend uitschakelen.
// Daarom werpt deze module een TypeError zodra `isTaken` iets anders dan een
// boolean teruggeeft (thenables krijgen een eigen boodschap). Er komt hier
// bewust GEEN async variant bij: die hoort in de compositielaag (AR5a), waar de
// vorm van de store bekend is.
//
// OPEN PUNT (AR5a) — het `isTaken`-contract is check-then-act en houdt dus een
// TOCTOU-venster: tussen de controle en het daadwerkelijke `SET room:code:{code}`
// kan een andere schrijver dezelfde code claimen. Waterdicht wordt dat pas met
// een atomaire claim (`SET NX` / `tryClaim`) in de compositielaag die de store
// kent. Deze module verandert daar de signatuur niet voor; ze levert een
// kandidaat die volgens de aanroeper vrij is, en de aanroeper moet de claim zelf
// atomair maken.
//
// AFWIJKING VAN DE BRON — DATA-MODEL.md toont als voorbeeld
// `"inviteId": "N4x7pQm2K8tW"` (12 base64url-tekens ≈ 72 bits), terwijl
// ARCHITECTURE.md "minimaal 96 bits entropie" eist. De harde eis wint: deze
// module genereert 16 bytes (128 bits, 22 tekens) en accepteert bij validatie
// niets onder de 96 bits. Het voorbeeld in DATA-MODEL.md is dus illustratief en
// zou daar bijgewerkt moeten worden.

const crypto = require('node:crypto');

/** Zes cijfers, exact zoals ARCHITECTURE.md ("zes cijfers") voorschrijft. */
const GAME_CODE_LENGTH = 6;

/** Coderuimte 000000–999999, inclusief leidende nullen ("004821" is geldig). */
const GAME_CODE_SPACE = 1000000;

/** Eindig maximum aantal botsingspogingen; zie generateGameCode(). */
const DEFAULT_MAX_CODE_ATTEMPTS = 10;

// Bovengrens op `maxAttempts`. Elke poging is een synchrone randomBytes plus een
// synchrone `isTaken`, dus het budget is rechtstreeks blokkeertijd op de event
// loop: 2.000.000 pogingen kost ~1,5 s waarin geen enkele andere socket wordt
// bediend. Bij een realistische bezetting is zelfs 1000 al absurd ruim (bij 30%
// bezette codes is de kans op 1000 botsingen 0,3^1000), dus een hogere waarde is
// altijd een vergissing van de aanroeper en geen legitieme configuratie.
const MAX_CODE_ATTEMPTS = 1000;

// Ondergrens op de pepper. De pepper bestaat om offline brute-force van de
// hashindex onmogelijk te maken; met één byte (256 mogelijkheden) is dat doel
// niet gehaald en is de index feitelijk ongepepperd. 16 bytes = 128 bits is de
// gebruikelijke minimale sleutelsterkte voor een HMAC-sleutel.
const MIN_PEPPER_BYTES = 16;

/** 16 bytes = 128 bits, ruim boven de geëiste 96 bits. */
const INVITE_ID_BYTES = 16;

/** Ondergrens bij validatie: 16 base64url-tekens = 96 bits. */
const INVITE_ID_MIN_LENGTH = 16;

/** Bovengrens bij validatie: 43 base64url-tekens = 256 bits. */
const INVITE_ID_MAX_LENGTH = 43;

/** SHA-256 in hex. */
const INVITE_HASH_LENGTH = 64;

// Geen `g`/`y`-vlag: die zouden lastIndex meedragen tussen aanroepen. Zonder
// `m`-vlag matcht `$` in JS alleen het echte stringeinde, dus "123456\n" wordt
// afgewezen. `[0-9]` sluit Unicode-cijfers (٠١٢…) expliciet uit.
const GAME_CODE_PATTERN = /^[0-9]{6}$/;

/** base64url-alfabet: geen `+`, `/` of `=`. */
const INVITE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Lowercase hex, exact één SHA-256-digest. */
const INVITE_HASH_PATTERN = /^[0-9a-f]{64}$/;

// --- Rejection sampling ------------------------------------------------------
//
// Modulo-bias ontstaat als je een uniforme 32-bits trekking (0 … 2^32-1) direct
// `% 1000000` neemt: 2^32 is geen veelvoud van 10^6, dus de laagste 967.296
// codes zouden 4295 kansen krijgen en de rest 4294. Daarom wordt elke trekking
// boven de grootste veelvoud-grens VERWORPEN en opnieuw gedaan:
//
//   2^32                = 4.294.967.296
//   2^32 - (2^32 % 10^6) = 4.294.000.000  ← acceptatiegrens
//
// Binnen [0, 4.294.000.000) heeft elke rest modulo 10^6 exact 4294 preimages,
// dus de uitkomst is exact uniform over 000000–999999. De kans dat één trekking
// wordt verworpen is (2^32 - 4.294.000.000) / 2^32 ≈ 0,0225%.
const UINT32_CEILING = 2 ** 32;
const CODE_ACCEPT_LIMIT = UINT32_CEILING - (UINT32_CEILING % GAME_CODE_SPACE);

// Rejection sampling is in theorie onbegrensd. Praktisch is de kans op 64
// achtereenvolgende verwerpingen ≈ (2,25e-4)^64, oftewel nul; komt dat tóch
// voor, dan is de RNG kapot en is doorgaan gevaarlijker dan werpen.
const MAX_SAMPLING_DRAWS = 64;

/**
 * Fout bij uitputting van het maximale aantal botsingspogingen.
 * Bewust een eigen klasse zodat de aanroeper hem kan onderscheiden van een
 * TypeError (programmeerfout) of een fout uit de eigen `isTaken`-callback.
 */
class GameCodeExhaustedError extends Error {
  /**
   * @param {number} attempts - aantal gedane pogingen
   */
  constructor(attempts) {
    super(
      `Geen vrije join-code gevonden na ${attempts} ${
        attempts === 1 ? 'poging' : 'pogingen'
      }.`,
    );
    this.name = 'GameCodeExhaustedError';
    this.code = 'CODE_SPACE_EXHAUSTED';
    this.attempts = attempts;
  }
}

/**
 * Eén uniforme trekking uit 0 … 999999 via rejection sampling.
 * @returns {number}
 */
function randomCodeNumber() {
  for (let draw = 0; draw < MAX_SAMPLING_DRAWS; draw += 1) {
    const value = crypto.randomBytes(4).readUInt32BE(0);
    if (value < CODE_ACCEPT_LIMIT) {
      return value % GAME_CODE_SPACE;
    }
  }
  throw new Error(
    `Rejection sampling gaf ${MAX_SAMPLING_DRAWS} keer geen bruikbare trekking; controleer de RNG.`,
  );
}

/**
 * Leest één optie, maar alleen als het een EIGEN property is.
 *
 * Zonder de `hasOwn`-test pikt destructuring overerfde properties op. Een
 * `Object.prototype.isTaken = () => true` — via prototype-pollution, of gewoon
 * een slordige polyfill — zou dan de parameterloze `generateGameCode()` op elke
 * kandidaat laten botsen: permanente DoS op roomcreatie. `Object.prototype
 * .maxAttempts = 0` zou elke aanroep laten werpen.
 *
 * De try/catch houdt het foutcontract heel: een werpende getter of proxy-trap op
 * `options` is een ongeldige `options` en moet dus een TypeError geven, niet de
 * willekeurige fout van de aanroeper.
 *
 * @param {object} settings
 * @param {string} name
 * @returns {unknown} de waarde, of undefined als de property niet eigen is
 */
function readOwnOption(settings, name) {
  try {
    return Object.hasOwn(settings, name) ? settings[name] : undefined;
  } catch (cause) {
    throw new TypeError(
      `generateGameCode kon options.${name} niet lezen: een getter of proxy-trap wierp.`,
      { cause },
    );
  }
}

/**
 * Is `value` een thenable (Promise of Promise-achtige)?
 * Werpt niet: een werpende `then`-getter telt als "niet thenable" en loopt
 * daarna alsnog tegen de boolean-controle aan.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isThenable(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return false;
  }
  try {
    return typeof value.then === 'function';
  } catch {
    return false;
  }
}

/**
 * Genereert een join-code die (volgens `isTaken`) nog vrij is.
 *
 * Eigenschappen, conform ARCHITECTURE.md → "Code":
 *  - exact zes cijfers als string, leidende nullen blijven behouden;
 *  - cryptografisch random via `node:crypto` (nooit `Math.random()`);
 *  - uniform over 000000–999999 dankzij rejection sampling (geen modulo-bias);
 *  - nooit oplopend of afleidbaar uit een eerdere code.
 *
 * `isTaken` is OPTIONEEL. Ontbreekt hij, dan doet deze module geen
 * uniciteitscontrole — ze kent Redis niet en kan er geen verzinnen. Een
 * aanroeper die `room:code:{code}` bijhoudt MOET hem meegeven; anders is
 * uniciteit onder actieve rooms niet gegarandeerd.
 *
 * `isTaken` moet SYNCHROON zijn en een echte boolean teruggeven — zie de
 * modulekop. Een async callback of een truthy niet-boolean (`1`, `'yes'`, `{}`)
 * werpt een TypeError in plaats van de controle stil over te slaan.
 *
 * Opties worden alleen gelezen als ze een EIGEN property van `options` zijn, en
 * de default is een prototypeloos object: `Object.prototype`-vervuiling kan de
 * uniciteitscontrole dus niet van buitenaf omzetten.
 *
 * @param {{ isTaken?: (code: string) => boolean, maxAttempts?: number }} [options]
 * @returns {string} zescijferige code
 * @throws {TypeError} bij een ongeldige `options`, `isTaken` of `maxAttempts`,
 *   of als `isTaken` iets anders dan een boolean teruggeeft
 * @throws {GameCodeExhaustedError} als alle pogingen op een botsing stuiten
 */
function generateGameCode(options) {
  const settings =
    options === undefined || options === null ? Object.create(null) : options;
  if (typeof settings !== 'object' || Array.isArray(settings)) {
    throw new TypeError('generateGameCode verwacht een options-object.');
  }

  const isTaken = readOwnOption(settings, 'isTaken');
  const maxAttempts = readOwnOption(settings, 'maxAttempts');
  if (isTaken !== undefined && typeof isTaken !== 'function') {
    throw new TypeError('isTaken moet een functie (code) => boolean zijn.');
  }
  const attemptBudget = maxAttempts === undefined ? DEFAULT_MAX_CODE_ATTEMPTS : maxAttempts;
  if (
    !Number.isSafeInteger(attemptBudget) ||
    attemptBudget < 1 ||
    attemptBudget > MAX_CODE_ATTEMPTS
  ) {
    throw new TypeError(
      `maxAttempts moet een geheel getal van 1 t/m ${MAX_CODE_ATTEMPTS} zijn.`,
    );
  }

  for (let attempt = 1; attempt <= attemptBudget; attempt += 1) {
    const candidate = String(randomCodeNumber()).padStart(GAME_CODE_LENGTH, '0');
    if (isTaken === undefined) {
      return candidate;
    }
    // Een werpende `isTaken` is een fout van de aanroeper (bijv. Redis down) en
    // propageert bewust onveranderd: hem opslokken zou een code opleveren
    // waarvan de uniciteit niet is gecontroleerd.
    const taken = isTaken(candidate);
    // Fail loud, nooit stil accepteren: `Promise !== true` en `1 !== true` zijn
    // allebei "niet bezet" als je alleen op `!== true` test, waarmee elke
    // kandidaat bij poging 1 wordt goedgekeurd en de uniciteitscontrole in feite
    // is uitgeschakeld. Dat is precies de fout die je nooit ziet gebeuren.
    if (isThenable(taken)) {
      throw new TypeError(
        'isTaken gaf een Promise terug: een async isTaken wordt niet ondersteund, ' +
          'omdat de uniciteitscontrole dan stilzwijgend wordt overgeslagen. Los de ' +
          'lookup (bijv. Redis) op vóór de aanroep en geef een synchrone ' +
          '(code) => boolean mee.',
      );
    }
    if (typeof taken !== 'boolean') {
      throw new TypeError(
        `isTaken moet een boolean teruggeven, kreeg ${typeof taken}. Truthy ` +
          'niet-boolean waarden worden bewust niet als "bezet" geteld.',
      );
    }
    if (taken === false) {
      return candidate;
    }
  }

  throw new GameCodeExhaustedError(attemptBudget);
}

/**
 * Genereert een inviteId voor de QR en de deel-link `/j/{inviteId}`.
 *
 * 16 bytes uit `crypto.randomBytes` = 128 bits, ruim boven de 96 bits uit
 * ARCHITECTURE.md. De base64url-codering van Node levert geen padding op, dus
 * de string bevat gegarandeerd geen `+`, `/` of `=` en is zonder escaping in
 * een pad te gebruiken.
 *
 * @returns {string} 22 tekens base64url
 */
function generateInviteId() {
  return crypto.randomBytes(INVITE_ID_BYTES).toString('base64url');
}

/**
 * Controleert dat de pepper bruikbaar is als HMAC-sleutel, en werpt anders.
 *
 * Geaccepteerd — precies wat `crypto.createHmac` native als sleutel aankan:
 *  - `string` (zie de LET OP hieronder);
 *  - elke `ArrayBuffer`-view: `Buffer`, `Uint8Array`, andere TypedArrays,
 *    `DataView`. Alleen `Buffer.isBuffer` toestaan zou een `Uint8Array`-pepper
 *    naar de string-route duwen, wat een stille verzwakking is;
 *  - een secret `KeyObject` uit `crypto.createSecretKey(...)`.
 *
 * LET OP — een string wordt door `createHmac` als UTF-8 gelezen, niet als
 * encoding. Een hex-geëncodeerde `TOKEN_PEPPER` van 64 tekens levert als string
 * dus 64 tekens van 4 bits informatie op in plaats van 32 volle bytes. Geef
 * bytes als bytes door: `Buffer.from(process.env.TOKEN_PEPPER, 'hex')`.
 *
 * @param {unknown} pepper
 * @returns {void}
 * @throws {TypeError} bij een ontbrekende, verkeerd getypeerde of te korte pepper
 */
function assertUsablePepper(pepper) {
  let byteLength;
  if (typeof pepper === 'string') {
    // Bytelengte, niet tekenlengte: vier emoji zijn vier tekens maar 16 bytes.
    byteLength = Buffer.byteLength(pepper, 'utf8');
  } else if (ArrayBuffer.isView(pepper)) {
    // byteLength, niet length: een Uint32Array van 4 elementen is 16 bytes.
    byteLength = pepper.byteLength;
  } else if (pepper instanceof crypto.KeyObject && pepper.type === 'secret') {
    byteLength = pepper.symmetricKeySize;
  } else {
    throw new TypeError(
      'hashInviteId vereist een pepper van de aanroeper (string, Buffer/TypedArray of ' +
        'secret KeyObject); deze module kent geen default.',
    );
  }

  if (byteLength < MIN_PEPPER_BYTES) {
    throw new TypeError(
      `De pepper is ${byteLength} byte(s); minimaal ${MIN_PEPPER_BYTES} bytes vereist. ` +
        'Een kortere pepper maakt offline brute-force van de hashindex haalbaar.',
    );
  }
}

/**
 * Berekent de lookupindex voor `room:invite:{inviteHash}`.
 *
 * DATA-MODEL.md eist een hash zodat Redis-keynamen de capability niet
 * rechtstreeks tonen: wie de keyspace ziet (SCAN, monitoring, backup) mag daar
 * geen bruikbare join-link uit kunnen afleiden.
 *
 * Constructie: HMAC-SHA256 met de pepper als sleutel. Dat is SHA-256 zoals de
 * spec vraagt, maar met de pepper als KEY in plaats van als concatenatie —
 * daarmee vervalt zowel length-extension als de dubbelzinnigheid tussen
 * pepper- en bericht-grenzen. Zonder de pepper is de index niet reproduceerbaar
 * en dus niet offline te brute-forcen.
 *
 * De pepper mag een string, een `ArrayBuffer`-view (`Buffer`, `Uint8Array`, …)
 * of een secret `KeyObject` zijn, en moet minimaal 16 bytes tellen. Een STRING
 * WORDT ALS UTF-8 GELEZEN: geef een hex- of base64-geëncodeerde `TOKEN_PEPPER`
 * dus als `Buffer.from(value, 'hex')` door, anders levert hij per teken maar
 * 4 respectievelijk 6 bits in plaats van 8. Zie assertUsablePepper().
 *
 * @param {string} inviteId - moet aan isValidInviteId() voldoen
 * @param {string | NodeJS.ArrayBufferView | crypto.KeyObject} pepper - geheim van
 *   de aanroeper (prod: TOKEN_PEPPER)
 * @returns {string} 64 tekens lowercase hex
 * @throws {TypeError} bij een ongeldige inviteId, of bij een ontbrekende,
 *   verkeerd getypeerde of te korte pepper
 */
function hashInviteId(inviteId, pepper) {
  if (!isValidInviteId(inviteId)) {
    throw new TypeError('hashInviteId kreeg een ongeldige inviteId.');
  }
  assertUsablePepper(pepper);

  return crypto.createHmac('sha256', pepper).update(inviteId, 'utf8').digest('hex');
}

/**
 * Vergelijkt twee invite-hashes in constante tijd.
 *
 * Een hashindex wordt normaal via een Redis-lookup geraadpleegd, maar zodra er
 * in applicatiecode twee hashes naast elkaar worden gelegd (rotatie, herstel na
 * restart, dubbele index) mag dat niet met `===`: dat lekt via de looptijd het
 * aantal overeenkomende voorloop-bytes. Werpt nooit.
 *
 * @param {unknown} hashA
 * @param {unknown} hashB
 * @returns {boolean}
 */
function inviteHashEquals(hashA, hashB) {
  if (!isValidInviteHash(hashA) || !isValidInviteHash(hashB)) {
    return false;
  }
  // Beide zijn hier gegarandeerd 64 hex-tekens, dus de buffers zijn even lang
  // en timingSafeEqual kan niet op een lengteverschil werpen.
  return crypto.timingSafeEqual(Buffer.from(hashA, 'hex'), Buffer.from(hashB, 'hex'));
}

/**
 * Controleert of een inviteId bij een bekende hash hoort, in constante tijd.
 * Ongeldige of onbekende SPELERINVOER levert `false` op in plaats van een fout,
 * zodat dit direct op spelerinvoer gebruikt kan worden.
 *
 * Een ongeldige pepper is géén spelerinvoer maar een misconfiguratie van de
 * aanroeper, en wordt daarom ALS EERSTE gecontroleerd — vóór `inviteId` en
 * `expectedHash`. Andersom zou het gedrag van de aanvallersinvoer afhangen
 * (welgevormd id → exception, misvormd id → nette `false`), en dat verschil is
 * een orakel waarmee een aanvaller de validatiedrempel kan aftasten.
 *
 * @param {unknown} inviteId
 * @param {string | NodeJS.ArrayBufferView | crypto.KeyObject} pepper
 * @param {unknown} expectedHash
 * @returns {boolean}
 * @throws {TypeError} bij een ontbrekende, verkeerd getypeerde of te korte
 *   pepper — altijd, ongeacht `inviteId` en `expectedHash`
 */
function matchesInviteId(inviteId, pepper, expectedHash) {
  assertUsablePepper(pepper);
  if (!isValidInviteId(inviteId) || !isValidInviteHash(expectedHash)) {
    return false;
  }
  return inviteHashEquals(hashInviteId(inviteId, pepper), expectedHash);
}

/**
 * Strikte validatie van een binnenkomende join-code.
 *
 * Accepteert uitsluitend een primitieve string van exact zes ASCII-cijfers.
 * Afgewezen: andere lengtes, niet-cijfers, Unicode-cijfers, spaties of
 * newlines rondom, `null`, `undefined`, getallen, objecten, arrays, Symbols en
 * String-objecten (die zijn geen primitieve string). Werpt nooit: de typeof-test
 * gaat voor, dus er wordt nooit een getter of `toString` van de invoer
 * aangeroepen.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidGameCode(value) {
  return typeof value === 'string' && GAME_CODE_PATTERN.test(value);
}

/**
 * Strikte validatie van een binnenkomende inviteId (uit `/j/{inviteId}`).
 *
 * Accepteert uitsluitend een primitieve base64url-string van 16 t/m 43 tekens
 * (96–256 bits). De ondergrens is de entropie-eis uit ARCHITECTURE.md; de
 * bovengrens houdt Redis-keynamen begrensd en voorkomt dat een enorme string
 * onnodig gehasht wordt. Afgewezen: `+`, `/`, `=`, padding, spaties, lege
 * string, niet-strings, `null`, objecten. Werpt nooit.
 *
 * Het bereik is bewust ruimer dan wat generateInviteId() maakt (altijd exact 22
 * tekens): oudere of extern uitgegeven inviteIds moeten geldig blijven. Versmal
 * dit pas als er een reden is; het is geen ongelukje.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidInviteId(value) {
  return (
    typeof value === 'string' &&
    value.length >= INVITE_ID_MIN_LENGTH &&
    value.length <= INVITE_ID_MAX_LENGTH &&
    INVITE_ID_PATTERN.test(value)
  );
}

/**
 * Strikte validatie van een invite-hash (het `{inviteHash}`-deel van de
 * Redis-key). Werpt nooit.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidInviteHash(value) {
  return (
    typeof value === 'string' &&
    value.length === INVITE_HASH_LENGTH &&
    INVITE_HASH_PATTERN.test(value)
  );
}

module.exports = {
  generateGameCode,
  generateInviteId,
  hashInviteId,
  isValidGameCode,
  isValidInviteId,
  isValidInviteHash,
  inviteHashEquals,
  matchesInviteId,
  GameCodeExhaustedError,
  GAME_CODE_LENGTH,
  GAME_CODE_SPACE,
  DEFAULT_MAX_CODE_ATTEMPTS,
  MAX_CODE_ATTEMPTS,
  MIN_PEPPER_BYTES,
  INVITE_ID_BYTES,
  INVITE_ID_MIN_LENGTH,
  INVITE_ID_MAX_LENGTH,
  INVITE_HASH_LENGTH,
};
