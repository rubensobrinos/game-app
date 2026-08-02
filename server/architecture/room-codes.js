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
 * @param {{ isTaken?: (code: string) => boolean, maxAttempts?: number }} [options]
 * @returns {string} zescijferige code
 * @throws {TypeError} bij een ongeldige `options`, `isTaken` of `maxAttempts`
 * @throws {GameCodeExhaustedError} als alle pogingen op een botsing stuiten
 */
function generateGameCode(options) {
  const settings = options === undefined || options === null ? {} : options;
  if (typeof settings !== 'object' || Array.isArray(settings)) {
    throw new TypeError('generateGameCode verwacht een options-object.');
  }

  const { isTaken, maxAttempts } = settings;
  if (isTaken !== undefined && typeof isTaken !== 'function') {
    throw new TypeError('isTaken moet een functie (code) => boolean zijn.');
  }
  const attemptBudget = maxAttempts === undefined ? DEFAULT_MAX_CODE_ATTEMPTS : maxAttempts;
  if (!Number.isSafeInteger(attemptBudget) || attemptBudget < 1) {
    throw new TypeError('maxAttempts moet een positief geheel getal zijn.');
  }

  for (let attempt = 1; attempt <= attemptBudget; attempt += 1) {
    const candidate = String(randomCodeNumber()).padStart(GAME_CODE_LENGTH, '0');
    // Een werpende `isTaken` is een fout van de aanroeper (bijv. Redis down) en
    // propageert bewust onveranderd: hem opslokken zou een code opleveren
    // waarvan de uniciteit niet is gecontroleerd.
    if (isTaken === undefined || isTaken(candidate) !== true) {
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
 * @param {string} inviteId - moet aan isValidInviteId() voldoen
 * @param {string | Buffer} pepper - geheim van de aanroeper (prod: TOKEN_PEPPER)
 * @returns {string} 64 tekens lowercase hex
 * @throws {TypeError} bij een ongeldige inviteId of een lege/ontbrekende pepper
 */
function hashInviteId(inviteId, pepper) {
  if (!isValidInviteId(inviteId)) {
    throw new TypeError('hashInviteId kreeg een ongeldige inviteId.');
  }
  const isStringPepper = typeof pepper === 'string' && pepper.length > 0;
  const isBufferPepper = Buffer.isBuffer(pepper) && pepper.length > 0;
  if (!isStringPepper && !isBufferPepper) {
    throw new TypeError(
      'hashInviteId vereist een niet-lege pepper van de aanroeper; deze module kent geen default.',
    );
  }

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
 * Ongeldige of onbekende invoer levert `false` op in plaats van een fout, zodat
 * dit direct op spelerinvoer gebruikt kan worden.
 *
 * @param {unknown} inviteId
 * @param {string | Buffer} pepper
 * @param {unknown} expectedHash
 * @returns {boolean}
 */
function matchesInviteId(inviteId, pepper, expectedHash) {
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
  INVITE_ID_BYTES,
  INVITE_ID_MIN_LENGTH,
  INVITE_ID_MAX_LENGTH,
  INVITE_HASH_LENGTH,
};
