import { createHmac, timingSafeEqual } from 'node:crypto';

import { isValidGameCode } from '../../../architecture/room-codes.js';

export const DEFAULT_CAPACITY = 500;

/** Bovengrens op het aantal matches dat tegelijk OPEN staat (nog niet afgelopen). */
export const DEFAULT_MAX_OPEN_SESSIONS = 200;

/** Hoeveel verzegelde matches er per flush weggaan. */
export const DEFAULT_BATCH_SIZE = 50;

/** Hoe vaak de achtergrondflush loopt. */
export const DEFAULT_FLUSH_INTERVAL_MS = 5_000;

/** Harde bovengrens op één flush. Zonder deze afkap houdt een hangende socket de lock vast. */
export const DEFAULT_FLUSH_TIMEOUT_MS = 10_000;

/** Een match die zó lang geen enkel event meer kreeg, is verlaten en wordt verzegeld. */
export const DEFAULT_SESSION_IDLE_MS = 30 * 60 * 1000;

/** Backoff na een mislukte flush: `base * 2^(streak-1)`, afgetopt. */
export const DEFAULT_BACKOFF_BASE_MS = 1_000;
export const DEFAULT_BACKOFF_MAX_MS = 60_000;

/** Ondergrens op de analytics-pepper, gelijk aan die van `room-codes.js`. */
export const MIN_ANALYTICS_PEPPER_BYTES = 16;

/**
 * Ondergrens op de entropie van een `roomId`. Een identifier die kort genoeg
 * is om uit te putten (een zescijferige join-code: één miljoen mogelijkheden)
 * maakt de hash terugrekenbaar voor iedereen die óók de pepper heeft — dan is
 * de pepper de enige bescherming en is "niet herleidbaar" een illusie.
 */
const MIN_ROOM_ID_LENGTH = 8;

/** Bovengrens, zodat een absurde string niet eindeloos gehasht wordt. */
const MAX_ROOM_ID_LENGTH = 128;

/** Domeinscheiding: deze pepper mag nooit twee dingen betekenen. */
const ROOM_HASH_DOMAIN = 'aseso-analytics-room-id:v1';

/** De eventtypes die `record()` accepteert. */
export const ANALYTICS_EVENTS = Object.freeze({
  ROOM_CREATED: 'room-created',
  MATCH_STARTED: 'match-started',
  PLAYER_JOINED: 'player-joined',
  SHARE_OPENED: 'share-opened',
  ROUND_FINISHED: 'round-finished',
  MATCH_FINISHED: 'match-finished',
  REMATCH_CREATED: 'rematch-created',
});

/** Redenen waarom `record()` iets weigert of weggooit. Stabiel, om op te matchen. */
export const DROP_REASONS = Object.freeze({
  UNKNOWN_EVENT: 'unknown-event-type',
  UNKNOWN_FIELD: 'unknown-field',
  MISSING_FIELD: 'missing-field',
  INVALID_FIELD: 'invalid-field',
  CAPACITY: 'capacity',
  OPEN_SESSIONS: 'open-sessions',
  CLOSED: 'closed',
});

const JOIN_CHANNELS = Object.freeze(['qr', 'link', 'code']);
const SHARE_CHANNELS = Object.freeze(['qr', 'link']);

/**
 * ALLOWLIST per eventtype — laag 1 van de privacybescherming. `required` moet
 * aanwezig zijn, `optional` mag, en verder NIETS. Een `playerId`, `name`,
 * `token`, `ip` of `scores` valt hier al af, ongeacht hoe het heet.
 */
const EVENT_SCHEMAS = Object.freeze({
  [ANALYTICS_EVENTS.ROOM_CREATED]: Object.freeze({
    required: Object.freeze(['at', 'roomId']),
    optional: Object.freeze([]),
  }),
  [ANALYTICS_EVENTS.MATCH_STARTED]: Object.freeze({
    required: Object.freeze([
      'at',
      'roomId',
      'matchSequence',
      'language',
      'difficulty',
      'pacing',
      'mode',
      'gameTypes',
      'totalRounds',
    ]),
    optional: Object.freeze([]),
  }),
  [ANALYTICS_EVENTS.PLAYER_JOINED]: Object.freeze({
    required: Object.freeze(['at', 'roomId', 'matchSequence', 'via', 'late', 'playerCount']),
    optional: Object.freeze([]),
  }),
  [ANALYTICS_EVENTS.SHARE_OPENED]: Object.freeze({
    required: Object.freeze(['at', 'roomId', 'matchSequence', 'channel']),
    optional: Object.freeze([]),
  }),
  [ANALYTICS_EVENTS.ROUND_FINISHED]: Object.freeze({
    required: Object.freeze([
      'at',
      'roomId',
      'matchSequence',
      'roundNumber',
      'gameType',
      'questionKey',
      'answerCount',
      'correctCount',
      'noAnswerCount',
    ]),
    // Nullable in het schema: een ronde waarin niemand antwoordde heeft geen
    // gemiddelde antwoordtijd.
    optional: Object.freeze(['averageAnswerMs']),
  }),
  [ANALYTICS_EVENTS.MATCH_FINISHED]: Object.freeze({
    required: Object.freeze(['at', 'roomId', 'matchSequence', 'finishedNormally']),
    optional: Object.freeze([]),
  }),
  [ANALYTICS_EVENTS.REMATCH_CREATED]: Object.freeze({
    required: Object.freeze(['at', 'roomId', 'matchSequence', 'previousMatchSequence']),
    optional: Object.freeze([]),
  }),
});

function pepperByteLength(pepper) {
  if (typeof pepper === 'string') return Buffer.byteLength(pepper, 'utf8');
  if (ArrayBuffer.isView(pepper)) return pepper.byteLength;
  return -1;
}

/**
 * Een stabiele, niet-omkeerbare vingerafdruk van een pepper. Alleen bedoeld
 * om twee peppers te VERGELIJKEN zonder ze naast elkaar te leggen — hij komt
 * nergens in een log, event of database terecht.
 * @param {string|NodeJS.ArrayBufferView} pepper
 * @returns {Buffer}
 */
function pepperFingerprint(pepper) {
  return createHmac('sha256', 'pepper-fingerprint:v1').update(toBytes(pepper)).digest();
}

/**
 * @param {string|NodeJS.ArrayBufferView} value
 * @returns {Buffer}
 */
function toBytes(value) {
  return typeof value === 'string'
    ? Buffer.from(value, 'utf8')
    : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

/**
 * Controleert de analytics-pepper en dat hij ECHT een andere is dan elke
 * sessietoken-pepper (DECISIONS #26).
 *
 * De vergelijking loopt via `timingSafeEqual` op vingerafdrukken. Niet omdat
 * er een aanvaller meekijkt — dit gebeurt bij het opstarten — maar omdat een
 * `===` op de peppers zelf twee geheimen naast elkaar legt en een
 * lengteverschil al informatie is. De vingerafdrukken zijn altijd even lang.
 *
 * @param {unknown} analyticsPepper
 * @param {unknown} sessionPeppers - één pepper, een array, of de
 *   `{ version, peppers: { v1: ... } }`-bundel uit `composition/context.mjs`.
 * @returns {void}
 * @throws {TypeError} bij een ontbrekende, te korte of gedeelde pepper
 */
export function assertAnalyticsPepper(analyticsPepper, sessionPeppers) {
  const byteLength = pepperByteLength(analyticsPepper);
  if (byteLength < 0) {
    throw new TypeError(
      'analyticsPepper is verplicht (string of Buffer/TypedArray); deze module kent geen default. ' +
        'DECISIONS #26 eist een APARTE pepper voor analytics-identifiers.'
    );
  }
  if (byteLength < MIN_ANALYTICS_PEPPER_BYTES) {
    throw new TypeError(
      `analyticsPepper is ${byteLength} byte(s); minimaal ${MIN_ANALYTICS_PEPPER_BYTES} bytes vereist. ` +
        'Korter maakt offline brute-force van room_id_hash haalbaar.'
    );
  }

  const others = collectSessionPeppers(sessionPeppers);
  if (others.length === 0) {
    throw new TypeError(
      'sessionPeppers is verplicht. Zonder de sessiepepper(s) kan deze module niet controleren dat ' +
        'de analytics-pepper daadwerkelijk een andere is (DECISIONS #26). Geef de pepper, de array of ' +
        'de { version, peppers }-bundel uit composition/context.mjs door.'
    );
  }

  const analyticsFingerprint = pepperFingerprint(/** @type {any} */ (analyticsPepper));
  for (const other of others) {
    if (pepperByteLength(other) < 0) continue;
    if (timingSafeEqual(analyticsFingerprint, pepperFingerprint(other))) {
      throw new TypeError(
        'analyticsPepper is gelijk aan een sessietoken-pepper. DECISIONS #26 eist een APARTE ' +
          'HMAC-pepper voor analytics-identifiers: met dezelfde pepper is room_id_hash aan een ' +
          'tokenhash te koppelen en is de scheiding tussen analytics en sessies weg.'
      );
    }
  }
}

/**
 * Haalt alle sessiepeppers uit wat de aanroeper ook doorgeeft.
 * @param {unknown} input
 * @returns {Array<string|NodeJS.ArrayBufferView>}
 */
function collectSessionPeppers(input) {
  if (input === null || input === undefined) return [];
  if (typeof input === 'string' || ArrayBuffer.isView(input)) return [/** @type {any} */ (input)];
  if (Array.isArray(input)) return input.flatMap((entry) => collectSessionPeppers(entry));
  if (typeof input === 'object') {
    const bundle = /** @type {{ peppers?: unknown }} */ (input);
    if (bundle.peppers && typeof bundle.peppers === 'object') {
      return Object.values(bundle.peppers).flatMap((entry) => collectSessionPeppers(entry));
    }
  }
  return [];
}

// --------------------------------------------------------------------------
// room_id_hash
// --------------------------------------------------------------------------

/**
 * Berekent `room_id_hash`: HMAC-SHA256 over `domein | tijdvak | roomId`, met
 * de ANALYTICS-pepper als sleutel.
 *
 * WAAROM DIT NIET TERUG TE REKENEN IS, in twee stukken die allebei nodig zijn:
 *
 *   1. DE SLEUTEL IS GEHEIM. HMAC met een pepper van minimaal 128 bits;
 *      zonder die sleutel is de hash niet te reproduceren en dus ook niet met
 *      een woordenboek te vergelijken. De pepper staat nooit in de database
 *      en gaat nooit in een log of event.
 *   2. DE INVOER IS NIET UITPUTBAAR. Dat is het stuk dat vaker vergeten
 *      wordt. Wie de pepper wél heeft (een beheerder, een gelekte backup mét
 *      omgeving) kan elke kandidaat gewoon hashen en vergelijken. Bij een
 *      zescijferige join-code zijn dat één miljoen kandidaten: in een seconde
 *      klaar, en dan is de hash effectief de code zelf. Daarom hasht deze
 *      functie UITSLUITEND de interne `roomId` (`room_` + 9 random bytes =
 *      72 bits) en NOOIT de join-code of de inviteId, en weigert hij een
 *      `roomId` die eruitziet als een code of korter is dan
 *      ${MIN_ROOM_ID_LENGTH} tekens. De join-code en de inviteId komen niet
 *      eens in `EVENT_SCHEMAS` voor.
 *
 * WAAROM ER EEN TIJDVAK IN ZIT. DATA-MODEL.md verbiedt "koppelingen tussen
 * rooms van dezelfde persoon". Een hash die uitsluitend van een identifier
 * afhangt, koppelt alles wat ooit diezelfde identifier had: kan een
 * identifier hergebruikt worden (een join-code kan dat — die is er maar een
 * miljoen keer en wordt vrijgegeven zodra de room verloopt), dan ontstaat er
 * een profiel over maanden en is af te lezen wie wanneer speelde. Het tijdvak
 * (standaard één UTC-dag) knipt die keten door: dezelfde identifier levert in
 * een ander tijdvak een volstrekt onverwante hash op.
 *
 * Binnen één tijdvak is de hash wél stabiel, en dat is de bedoeling: een
 * rematch in dezelfde room moet als dezelfde room herkenbaar zijn. De koppeling
 * tussen opeenvolgende matches loopt bovendien al expliciet via `rematch_of`.
 *
 * Het tijdvak komt uit `createdAt` van de match, niet uit "nu": een match die
 * over middernacht heen loopt, verandert daardoor niet halverwege van hash.
 *
 * @param {string} roomId - de INTERNE room-identifier. Nooit de join-code, nooit de inviteId.
 * @param {object} options
 * @param {string|NodeJS.ArrayBufferView} options.pepper - de analytics-pepper
 * @param {number} options.at - epoch-ms waaruit het tijdvak volgt
 * @param {number} [options.epochMs=86400000] - lengte van het tijdvak
 * @returns {string} 64 tekens lowercase hex
 * @throws {TypeError} bij een roomId die niet gehasht mag worden
 */
export function computeRoomIdHash(roomId, { pepper, at, epochMs = 86_400_000 } = {}) {
  if (typeof roomId !== 'string' || roomId.length === 0) {
    throw new TypeError('computeRoomIdHash verwacht een niet-lege roomId-string.');
  }
  if (isValidGameCode(roomId)) {
    throw new TypeError(
      'computeRoomIdHash kreeg een zescijferige JOIN-CODE als roomId. Weigering: de coderuimte is ' +
        '10^6 groot en dus uitputtelijk, waardoor de hash met de pepper in handen triviaal terug te ' +
        'rekenen is. Hash de interne roomId (DATA-MODEL.md: "room_id_hash ... mag niet terug te ' +
        'rekenen zijn naar code of inviteId").'
    );
  }
  if (roomId.length < MIN_ROOM_ID_LENGTH || roomId.length > MAX_ROOM_ID_LENGTH) {
    throw new TypeError(
      `computeRoomIdHash verwacht een roomId van ${MIN_ROOM_ID_LENGTH}–${MAX_ROOM_ID_LENGTH} tekens, ` +
        `kreeg er ${roomId.length}. Te kort betekent te weinig entropie om niet-herleidbaar te zijn.`
    );
  }
  if (pepperByteLength(pepper) < MIN_ANALYTICS_PEPPER_BYTES) {
    throw new TypeError(
      `computeRoomIdHash vereist een analytics-pepper van minimaal ${MIN_ANALYTICS_PEPPER_BYTES} bytes.`
    );
  }
  if (!Number.isFinite(at)) {
    throw new TypeError('computeRoomIdHash verwacht `at` als epoch-ms getal.');
  }
  if (!Number.isInteger(epochMs) || epochMs < 1) {
    throw new TypeError('epochMs moet een positief geheel getal zijn.');
  }

  const epoch = Math.floor(at / epochMs);
  return createHmac('sha256', /** @type {any} */ (pepper))
    .update(`${ROOM_HASH_DOMAIN}|${epoch}|${roomId}`, 'utf8')
    .digest('hex');
}

// --------------------------------------------------------------------------
// Validatie van binnenkomende events
// --------------------------------------------------------------------------

/** @param {unknown} value */
function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && /** @type {number} */ (value) >= 0;
}

/** @param {unknown} value */
function isShortString(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

/**
 * Valideert één event tegen zijn schema. Geeft `null` bij goedkeuring, anders
 * `{ reason, detail }`. Werpt NOOIT — `record()` mag niets naar boven laten.
 * @param {string} type
 * @param {Record<string, unknown>} event
 * @returns {{ reason: string, detail: string }|null}
 */
export function validateEvent(type, event) {
  const schema = EVENT_SCHEMAS[type];
  if (!schema) {
    return { reason: DROP_REASONS.UNKNOWN_EVENT, detail: `onbekend eventtype ${JSON.stringify(type)}` };
  }
  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    return { reason: DROP_REASONS.INVALID_FIELD, detail: 'event moet een gewoon object zijn' };
  }

  // Allowlist: alles wat niet in `required` of `optional` staat is verboden.
  // Dit is de laag die `playerId`, `displayName`, `sessionToken`, `ip` en
  // `perPlayerScores` tegenhoudt zonder ze te hoeven kennen.
  for (const key of Object.keys(event)) {
    if (key === 'type') continue;
    if (!schema.required.includes(key) && !schema.optional.includes(key)) {
      return {
        reason: DROP_REASONS.UNKNOWN_FIELD,
        detail: `${type}: veld ${JSON.stringify(key)} staat niet op de allowlist (${[
          ...schema.required,
          ...schema.optional,
        ].join(', ')})`,
      };
    }
  }
  for (const key of schema.required) {
    if (!(key in event) || event[key] === undefined || event[key] === null) {
      return { reason: DROP_REASONS.MISSING_FIELD, detail: `${type}: veld ${JSON.stringify(key)} ontbreekt` };
    }
  }

  /** @param {string} detail */
  const invalid = (detail) => ({ reason: DROP_REASONS.INVALID_FIELD, detail: `${type}: ${detail}` });

  if (!Number.isSafeInteger(event.at) || /** @type {number} */ (event.at) <= 0) {
    return invalid('`at` moet een positief epoch-ms geheel getal zijn');
  }
  if (!isShortString(event.roomId)) return invalid('`roomId` moet een korte niet-lege string zijn');
  if (isValidGameCode(event.roomId)) {
    return invalid(
      '`roomId` is een zescijferige join-code. Analytics hasht uitsluitend de INTERNE roomId ' +
        '(DATA-MODEL.md: room_id_hash mag niet terug te rekenen zijn naar code of inviteId)'
    );
  }
  if (/** @type {string} */ (event.roomId).length < MIN_ROOM_ID_LENGTH) {
    return invalid(`\`roomId\` moet minimaal ${MIN_ROOM_ID_LENGTH} tekens hebben (entropie-eis)`);
  }

  if (type !== ANALYTICS_EVENTS.ROOM_CREATED) {
    if (!Number.isSafeInteger(event.matchSequence) || /** @type {number} */ (event.matchSequence) < 1) {
      return invalid('`matchSequence` moet een geheel getal >= 1 zijn');
    }
  }

  switch (type) {
    case ANALYTICS_EVENTS.MATCH_STARTED: {
      for (const key of ['language', 'difficulty', 'pacing', 'mode']) {
        if (!isShortString(event[key])) return invalid(`\`${key}\` moet een korte niet-lege string zijn`);
      }
      if (!Array.isArray(event.gameTypes) || event.gameTypes.length === 0) {
        return invalid('`gameTypes` moet een niet-lege array zijn');
      }
      if (!event.gameTypes.every(isShortString)) return invalid('`gameTypes` mag alleen korte strings bevatten');
      if (!Number.isSafeInteger(event.totalRounds) || /** @type {number} */ (event.totalRounds) < 1) {
        return invalid('`totalRounds` moet een geheel getal >= 1 zijn');
      }
      break;
    }
    case ANALYTICS_EVENTS.PLAYER_JOINED: {
      if (!JOIN_CHANNELS.includes(/** @type {string} */ (event.via))) {
        return invalid(`\`via\` moet een van ${JOIN_CHANNELS.join('/')} zijn`);
      }
      if (typeof event.late !== 'boolean') return invalid('`late` moet een boolean zijn');
      if (!isNonNegativeInteger(event.playerCount)) return invalid('`playerCount` moet een geheel getal >= 0 zijn');
      break;
    }
    case ANALYTICS_EVENTS.SHARE_OPENED: {
      if (!SHARE_CHANNELS.includes(/** @type {string} */ (event.channel))) {
        return invalid(`\`channel\` moet een van ${SHARE_CHANNELS.join('/')} zijn`);
      }
      break;
    }
    case ANALYTICS_EVENTS.ROUND_FINISHED: {
      if (!Number.isSafeInteger(event.roundNumber) || /** @type {number} */ (event.roundNumber) < 1) {
        return invalid('`roundNumber` moet een geheel getal >= 1 zijn');
      }
      if (!isShortString(event.gameType)) return invalid('`gameType` moet een korte niet-lege string zijn');
      if (!isShortString(event.questionKey)) return invalid('`questionKey` moet een korte niet-lege string zijn');
      for (const key of ['answerCount', 'correctCount', 'noAnswerCount']) {
        if (!isNonNegativeInteger(event[key])) return invalid(`\`${key}\` moet een geheel getal >= 0 zijn`);
      }
      if (/** @type {number} */ (event.correctCount) > /** @type {number} */ (event.answerCount)) {
        return invalid('`correctCount` kan niet groter zijn dan `answerCount`');
      }
      if (event.averageAnswerMs !== undefined && event.averageAnswerMs !== null) {
        if (!isNonNegativeInteger(event.averageAnswerMs)) {
          return invalid('`averageAnswerMs` moet een geheel getal >= 0 of null zijn');
        }
      }
      break;
    }
    case ANALYTICS_EVENTS.MATCH_FINISHED: {
      if (typeof event.finishedNormally !== 'boolean') return invalid('`finishedNormally` moet een boolean zijn');
      break;
    }
    case ANALYTICS_EVENTS.REMATCH_CREATED: {
      if (
        !Number.isSafeInteger(event.previousMatchSequence) ||
        /** @type {number} */ (event.previousMatchSequence) < 1
      ) {
        return invalid('`previousMatchSequence` moet een geheel getal >= 1 zijn');
      }
      break;
    }
    default:
      break;
  }

  return null;
}

