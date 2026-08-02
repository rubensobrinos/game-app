// Asynchrone, gebufferde analytics-writer (INTB3a).
//
// ==========================================================================
// DE BELANGRIJKSTE EIS IS EEN NEGATIEVE
// ==========================================================================
// ARCHITECTURE.md principe 9: "Geen databasewrite in het kritieke antwoordpad.
// Events worden in-memory of via Redis gebufferd en in batches geaggregeerd."
//
// Daarom is `record()` SYNCHROON, geeft hij geen Promise terug, raakt hij de
// database niet aan, en WERPT HIJ NOOIT. Alles wat mis kan gaan — een
// onbekend eventtype, een volle buffer, een onbereikbare database — wordt
// geteld en via `onEvent` gemeld, nooit doorgegeven aan de aanroeper. Een
// speler die een antwoord instuurt mag niet merken dat Postgres weg is, en al
// helemaal niet wachten tot hij terug is.
//
// Wie hier ooit een `await` in `record()` zet, of `record()` `async` maakt,
// haalt principe 9 onderuit. De test "record() raakt de sink nooit aan" en de
// test "een volledige match loopt door terwijl Postgres onbereikbaar is"
// bewaken dat.
//
// ==========================================================================
// WAT ER IN DE DATABASE KOMT — EN VOORAL WAT NIET
// ==========================================================================
// DATA-MODEL.md "Wat niet persistent wordt opgeslagen": geen namen, geen
// sessietokens of tokenhashes, geen individuele scores of antwoordhistorie,
// geen IP's, geen user-agents, geen permanente speler-ID's, geen koppelingen
// tussen rooms van dezelfde persoon.
//
// Drie lagen houden dat vast, met opzet los van elkaar:
//   1. `EVENT_SCHEMAS` hieronder is een ALLOWLIST per eventtype. Een event met
//      een onbekende sleutel (`playerId`, `displayName`, `scores`, …) komt de
//      buffer niet eens in en wordt geteld als `rejected`.
//   2. De rijbouwers (`buildSessionRow`, `buildRoundRow`) kopiëren VELD VOOR
//      VELD. Er wordt nergens een event gespreid; een extra sleutel kan dus
//      ook per ongeluk niet meeliften.
//   3. `assertAllowedAnalyticsRecord()` uit `server/data/privacy-guard.js`
//      controleert vlak vóór het schrijven nog eens tegen de kolom-allowlist
//      per tabel.
//
// `round_stats` telt en middelt; er gaat één rij per RONDE in, nooit één per
// speler. De aanroeper levert de ronde al geaggregeerd aan (`answerCount`,
// `correctCount`, `averageAnswerMs`, `noAnswerCount`) — een lijst met
// individuele antwoorden wordt door laag 1 geweigerd.
//
// ==========================================================================
// DECISIONS #26 — EEN APARTE PEPPER, GEEN UITZONDERINGEN
// ==========================================================================
// "Analytics-identifiers gebruiken een aparte HMAC-pepper" — niet die van de
// sessietokens. De constructor EIST de sessiepepper(s) erbij en weigert te
// starten als de analytics-pepper daar ook maar één van gelijk is. Dat is
// bewust een harde fout bij het opstarten en geen waarschuwing: met dezelfde
// pepper wordt `room_id_hash` een orakel waarmee iemand met de analyticstabel
// én een tokenhash die twee aan elkaar kan knopen.
//
// ==========================================================================
// LEVERINGSGARANTIE — EERLIJK OPGESCHREVEN
// ==========================================================================
//   * `game_sessions` en `round_stats`: EXACTLY-ONCE bij herpogingen. De
//     uuid's worden bij het VERZEGELEN gegenereerd, niet bij het schrijven,
//     en beide inserts zijn `ON CONFLICT (id) DO NOTHING`.
//   * `daily_metrics`-tellers: AT-LEAST-ONCE. Het zijn optellingen; als een
//     COMMIT slaagt maar de bevestiging onderweg verdwijnt, telt de herpoging
//     die batch dubbel. Dat venster is klein en het alternatief (een
//     dedupliceer-tabel) staat niet in `migrations/001-analytics.sql` en die
//     mag niet worden uitgebreid. Bewust geaccepteerd, hier vastgelegd.
//   * Overloop: geteld, nooit stil. Zie `BUFFERBELEID` hieronder.

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { isValidGameCode } from '../../../architecture/room-codes.js';
import { assertAllowedAnalyticsRecord } from '../../privacy-guard.js';

// --------------------------------------------------------------------------
// BUFFERBELEID
// --------------------------------------------------------------------------
// De buffer is BEGRENSD en gooit bij overloop de OUDSTE verzegelde match weg,
// niet de nieuwste. Twee redenen:
//
//   * De nieuwste data is de bruikbaarste. Loopt Postgres een uur weg, dan is
//     een dashboard met het laatste uur nuttiger dan een dashboard dat op het
//     eerste uur is blijven staan en daarna niets meer laat zien.
//   * Nieuwste-weggooien maakt de buffer een graf: hij zit permanent vol met
//     data die nooit meer weg kan, en elke nieuwe match verdwijnt meteen. Bij
//     oudste-weggooien loopt de buffer altijd door zodra de database terugkomt.
//
// Weggooien is NOOIT stil: `stats().dropped.capacity` telt elke weggegooide
// match, `stats().dropped.rounds` de bijbehorende ronderijen, en er gaat een
// `{ type: 'dropped' }`-event naar `onEvent`. "Stilzwijgend verliezen" is
// precies wat de opdracht verbiedt.
// --------------------------------------------------------------------------

/** Bovengrens op het aantal verzegelde matches in de buffer. */
const DEFAULT_CAPACITY = 500;

/** Bovengrens op het aantal matches dat tegelijk OPEN staat (nog niet afgelopen). */
const DEFAULT_MAX_OPEN_SESSIONS = 200;

/** Hoeveel verzegelde matches er per flush weggaan. */
const DEFAULT_BATCH_SIZE = 50;

/** Hoe vaak de achtergrondflush loopt. */
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;

/** Harde bovengrens op één flush. Zonder deze afkap houdt een hangende socket de lock vast. */
const DEFAULT_FLUSH_TIMEOUT_MS = 10_000;

/** Een match die zó lang geen enkel event meer kreeg, is verlaten en wordt verzegeld. */
const DEFAULT_SESSION_IDLE_MS = 30 * 60 * 1000;

/** Backoff na een mislukte flush: `base * 2^(streak-1)`, afgetopt. */
const DEFAULT_BACKOFF_BASE_MS = 1_000;
const DEFAULT_BACKOFF_MAX_MS = 60_000;

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

const SESSION_COLUMNS = Object.freeze([
  'id',
  'room_id_hash',
  'match_sequence',
  'created_at',
  'started_at',
  'finished_at',
  'language',
  'difficulty',
  'pacing',
  'mode',
  'game_types',
  'total_rounds',
  'max_player_count',
  'late_join_count',
  'joins_via_qr',
  'joins_via_link',
  'joins_via_code',
  'share_qr_open_count',
  'share_link_open_count',
  'finished_normally',
  'rematch_of',
]);

const ROUND_COLUMNS = Object.freeze([
  'id',
  'game_session_id',
  'round_number',
  'game_type',
  'question_key',
  'answer_count',
  'correct_count',
  'average_answer_ms',
  'no_answer_count',
]);

const DAY_COUNTERS = Object.freeze([
  'rooms_created',
  'games_started',
  'games_finished',
  'players_joined',
  'rematches',
]);

// --------------------------------------------------------------------------
// Pepper
// --------------------------------------------------------------------------

/**
 * Bytelengte van een HMAC-sleutel, ongeacht of het een string of bytes zijn.
 * @param {unknown} pepper
 * @returns {number}
 */
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
function validateEvent(type, event) {
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

// --------------------------------------------------------------------------
// SQL
// --------------------------------------------------------------------------

/**
 * Valideert een schemanaam en levert hem als identifier. Er wordt NOOIT iets
 * anders dan deze gecontroleerde string in SQL geïnterpoleerd; alle waarden
 * gaan via parameters.
 * @param {string} schema
 * @returns {string}
 */
function assertSchemaName(schema) {
  if (typeof schema !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(schema) || schema.length > 63) {
    throw new TypeError(
      `schema moet een eenvoudige lowercase identifier zijn ([a-z_][a-z0-9_]*, max 63), kreeg: ${JSON.stringify(schema)}`
    );
  }
  return schema;
}

/**
 * `($1,$2,...),($n,...)` voor een meerrijige INSERT.
 * @param {number} rowCount
 * @param {number} columnCount
 * @returns {string}
 */
function placeholders(rowCount, columnCount) {
  const groups = [];
  let index = 1;
  for (let row = 0; row < rowCount; row += 1) {
    const group = [];
    for (let column = 0; column < columnCount; column += 1) {
      group.push(`$${index}`);
      index += 1;
    }
    groups.push(`(${group.join(', ')})`);
  }
  return groups.join(', ');
}

// --------------------------------------------------------------------------
// De writer
// --------------------------------------------------------------------------

/**
 * @typedef {object} AnalyticsSink
 * @property {<T>(fn: (executor: { query: (text: string, values?: unknown[]) => Promise<any> }) => Promise<T>) => Promise<T>} withTransaction
 */

/**
 * Maakt de analytics-writer.
 *
 * @param {object} config
 * @param {AnalyticsSink|null} [config.sink] - iets met `withTransaction`, in
 *   productie `createPostgresConnection(...)`. `null` betekent: alleen
 *   bufferen. Ook dan gaat er niets stil verloren — de tellers lopen door.
 * @param {string|NodeJS.ArrayBufferView} config.analyticsPepper - DECISIONS #26.
 * @param {unknown} config.sessionPeppers - de sessietoken-pepper(s), UITSLUITEND
 *   om te controleren dat de analytics-pepper een andere is. Wordt nooit
 *   bewaard, gebruikt of gelogd.
 * @param {string} [config.schema='public']
 * @param {number} [config.capacity=500] - verzegelde matches in de buffer.
 * @param {number} [config.maxOpenSessions=200]
 * @param {number} [config.batchSize=50]
 * @param {number} [config.flushIntervalMs=5000]
 * @param {number} [config.flushTimeoutMs=10000]
 * @param {number} [config.sessionIdleMs=1800000]
 * @param {number} [config.backoffBaseMs=1000]
 * @param {number} [config.backoffMaxMs=60000]
 * @param {number} [config.epochMs=86400000] - tijdvak voor `room_id_hash`.
 * @param {() => number} [config.now=Date.now] - injecteerbare klok.
 * @param {((event: object) => void)|null} [config.onEvent]
 */
export function createAnalyticsWriter(config = {}) {
  const {
    sink = null,
    analyticsPepper,
    sessionPeppers,
    schema = 'public',
    capacity = DEFAULT_CAPACITY,
    maxOpenSessions = DEFAULT_MAX_OPEN_SESSIONS,
    batchSize = DEFAULT_BATCH_SIZE,
    flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
    flushTimeoutMs = DEFAULT_FLUSH_TIMEOUT_MS,
    sessionIdleMs = DEFAULT_SESSION_IDLE_MS,
    backoffBaseMs = DEFAULT_BACKOFF_BASE_MS,
    backoffMaxMs = DEFAULT_BACKOFF_MAX_MS,
    epochMs = 86_400_000,
    now = Date.now,
    onEvent = null,
  } = config;

  // Configuratiefouten werpen HIER, bij het opstarten — niet later, in het
  // antwoordpad. Dit is de enige plek in deze module die werpt bij normaal
  // gebruik.
  assertAnalyticsPepper(analyticsPepper, sessionPeppers);
  const schemaName = assertSchemaName(schema);
  /** @param {string} table */
  const qualified = (table) => `${schemaName}.${table}`;
  for (const [name, value] of Object.entries({
    capacity,
    maxOpenSessions,
    batchSize,
    flushIntervalMs,
    flushTimeoutMs,
    sessionIdleMs,
    backoffBaseMs,
    backoffMaxMs,
  })) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new TypeError(`${name} moet een geheel getal >= 1 zijn, kreeg: ${JSON.stringify(value)}`);
    }
  }
  if (sink !== null && typeof sink?.withTransaction !== 'function') {
    throw new TypeError('sink moet null zijn of een object met withTransaction(fn).');
  }
  if (typeof now !== 'function') throw new TypeError('now moet een functie zijn.');
  if (onEvent !== null && typeof onEvent !== 'function') throw new TypeError('onEvent moet een functie zijn of null.');

  /** Open matches: matchKey -> aggregaat. */
  const open = new Map();
  /** Verzegelde matches, wachtend op de database. Oudste vooraan. */
  const outbox = [];
  /** Dagtellers: 'YYYY-MM-DD' -> { rooms_created, ... }. */
  const days = new Map();
  /** Laatste analytics-uuid per room, voor `rematch_of`. */
  const lastSessionIdByRoom = new Map();

  let closed = false;
  let flushing = false;
  let failureStreak = 0;
  let nextAttemptAt = 0;
  /** @type {ReturnType<typeof setInterval>|null} */
  let timer = null;

  const stats = {
    accepted: 0,
    rejected: 0,
    sealed: 0,
    sealedByIdle: 0,
    dropped: { capacity: 0, rounds: 0, openSessions: 0, closed: 0 },
    flushes: 0,
    flushFailures: 0,
    written: { sessions: 0, rounds: 0, days: 0 },
    lastErrorCode: null,
    lastErrorMessage: null,
  };

  /** @param {object} event */
  function emit(event) {
    if (!onEvent) return;
    try {
      onEvent(event);
    } catch {
      // Een kapotte observatiehaak mag de writer nooit omtrekken — en al
      // helemaal niet vanuit `record()`.
    }
  }

  /** @param {number} at */
  function dayKey(at) {
    return new Date(at).toISOString().slice(0, 10);
  }

  /** @param {number} at */
  function dayCounters(at) {
    const key = dayKey(at);
    let entry = days.get(key);
    if (!entry) {
      entry = { rooms_created: 0, games_started: 0, games_finished: 0, players_joined: 0, rematches: 0 };
      days.set(key, entry);
    }
    return entry;
  }

  /**
   * @param {string} roomId
   * @param {number} matchSequence
   */
  function matchKey(roomId, matchSequence) {
    return `${roomId} ${matchSequence}`;
  }

  /**
   * Haalt of opent het aggregaat van één match. Het aggregaat bevat GEEN
   * spelergegevens: alleen tellers, en de roomId die uitsluitend gebruikt
   * wordt om bij het verzegelen `room_id_hash` te berekenen. Hij verlaat het
   * proces nooit.
   *
   * `createdAt` is het VROEGSTE `at` dat deze match ooit zag, niet "nu". Het
   * eerste event van een match is in de praktijk een deel-open of een join in
   * de lobby, dus `created_at - started_at` is precies de lobbytijd die
   * `daily_metrics.median_join_to_start_seconds` bedoelt. Events komen niet
   * gegarandeerd op volgorde binnen, vandaar het minimum en niet "de eerste
   * die toevallig aankwam".
   * @param {string} roomId
   * @param {number} matchSequence
   * @param {number} at
   */
  function openSession(roomId, matchSequence, at) {
    const key = matchKey(roomId, matchSequence);
    let session = open.get(key);
    if (session) {
      session.touchedAt = at;
      if (at < session.createdAt) session.createdAt = at;
      return session;
    }

    if (open.size >= maxOpenSessions) {
      // Verlaten matches (host sluit de tab, room verloopt) blijven anders
      // eeuwig staan. Verzegel de oudste in plaats van de nieuwe te weigeren:
      // een oude open match is per definitie de minst waarschijnlijke om nog
      // af te lopen.
      const oldest = [...open.entries()].reduce((a, b) => (a[1].touchedAt <= b[1].touchedAt ? a : b));
      seal(oldest[0], { finishedNormally: false, finishedAt: null, reason: 'open-sessions' });
      stats.dropped.openSessions += 1;
      emit({ type: 'open-session-evicted', reason: DROP_REASONS.OPEN_SESSIONS, openSessions: open.size });
    }

    session = {
      roomId,
      matchSequence,
      createdAt: at,
      touchedAt: at,
      startedAt: null,
      language: null,
      difficulty: null,
      pacing: null,
      mode: null,
      gameTypes: null,
      totalRounds: null,
      maxPlayerCount: 0,
      lateJoinCount: 0,
      joinsViaQr: 0,
      joinsViaLink: 0,
      joinsViaCode: 0,
      shareQrOpenCount: 0,
      shareLinkOpenCount: 0,
      rematchOfSequence: null,
      rounds: [],
    };
    open.set(key, session);
    return session;
  }

  /**
   * Bouwt de `game_sessions`-rij VELD VOOR VELD. Er wordt hier nooit een
   * event of aggregaat gespreid — dat is laag 2 van de privacybescherming.
   * @param {object} session
   * @param {{ finishedAt: number|null, finishedNormally: boolean }} outcome
   */
  function buildSessionRow(session, outcome) {
    const id = randomUUID();
    const rematchOf =
      session.rematchOfSequence === null
        ? null
        : (lastSessionIdByRoom.get(matchKey(session.roomId, session.rematchOfSequence)) ?? null);

    return {
      id,
      room_id_hash: computeRoomIdHash(session.roomId, {
        pepper: analyticsPepper,
        at: session.createdAt,
        epochMs,
      }),
      match_sequence: session.matchSequence,
      created_at: new Date(session.createdAt).toISOString(),
      started_at: session.startedAt === null ? null : new Date(session.startedAt).toISOString(),
      finished_at: outcome.finishedAt === null ? null : new Date(outcome.finishedAt).toISOString(),
      language: session.language ?? 'unknown',
      difficulty: session.difficulty ?? 'unknown',
      pacing: session.pacing ?? 'unknown',
      mode: session.mode ?? 'unknown',
      game_types: session.gameTypes ?? [],
      total_rounds: session.totalRounds ?? session.rounds.length,
      max_player_count: session.maxPlayerCount,
      late_join_count: session.lateJoinCount,
      joins_via_qr: session.joinsViaQr,
      joins_via_link: session.joinsViaLink,
      joins_via_code: session.joinsViaCode,
      share_qr_open_count: session.shareQrOpenCount,
      share_link_open_count: session.shareLinkOpenCount,
      finished_normally: outcome.finishedNormally,
      rematch_of: rematchOf,
    };
  }

  /**
   * Bouwt één `round_stats`-rij, veld voor veld. Eén rij per RONDE, nooit per
   * speler: `answer_count`/`correct_count` zijn tellingen en
   * `average_answer_ms` is een gemiddelde. Er is geen kolom waarin een
   * individueel antwoord of een individuele score zou passen, en er wordt er
   * ook geen aangeleverd — `EVENT_SCHEMAS` laat zo'n veld niet toe.
   * @param {string} sessionId
   * @param {object} round
   */
  function buildRoundRow(sessionId, round) {
    return {
      id: round.id,
      game_session_id: sessionId,
      round_number: round.roundNumber,
      game_type: round.gameType,
      question_key: round.questionKey,
      answer_count: round.answerCount,
      correct_count: round.correctCount,
      average_answer_ms: round.averageAnswerMs,
      no_answer_count: round.noAnswerCount,
    };
  }

  /** Zet een verzegelde eenheid in de buffer; gooit bij overloop de OUDSTE weg. */
  function enqueue(unit) {
    while (outbox.length >= capacity) {
      const evicted = outbox.shift();
      stats.dropped.capacity += 1;
      stats.dropped.rounds += evicted.rounds.length;
      emit({
        type: 'dropped',
        reason: DROP_REASONS.CAPACITY,
        droppedSessions: stats.dropped.capacity,
        droppedRounds: stats.dropped.rounds,
        buffered: outbox.length,
      });
    }
    outbox.push(unit);
  }

  /**
   * Verzegelt een open match: uuid's vast, rijen gebouwd, buffer in. Vanaf hier
   * verandert er niets meer aan de rijen — dat is wat een herpoging
   * idempotent maakt.
   * @param {string} key
   * @param {{ finishedNormally: boolean, finishedAt: number|null, reason: string }} outcome
   */
  function seal(key, outcome) {
    const session = open.get(key);
    if (!session) return;
    open.delete(key);

    let sessionRow;
    let roundRows;
    // Laag 3: de kolom-allowlist van `privacy-guard.js`, vlak vóór de buffer.
    // Faalt die (of de hashberekening), dan is dat een programmeerfout in de
    // rijbouwers hierboven — maar ook die mag het antwoordpad niet raken en
    // mag `flush()` niet laten werpen: geteld, gemeld, en de rij verdwijnt in
    // plaats van dat hij het proces meeneemt.
    try {
      sessionRow = buildSessionRow(session, outcome);
      roundRows = session.rounds.map((round) => buildRoundRow(sessionRow.id, round));
      assertAllowedAnalyticsRecord('game_sessions', sessionRow);
      for (const row of roundRows) assertAllowedAnalyticsRecord('round_stats', row);
    } catch (error) {
      stats.rejected += 1;
      stats.lastErrorMessage = String(/** @type {Error} */ (error)?.message ?? error);
      emit({ type: 'privacy-guard-rejected', reason: stats.lastErrorMessage });
      return;
    }

    lastSessionIdByRoom.set(key, sessionRow.id);
    enqueue({ session: sessionRow, rounds: roundRows });
    stats.sealed += 1;
    if (outcome.reason === 'idle' || outcome.reason === 'open-sessions') stats.sealedByIdle += 1;
    emit({ type: 'sealed', reason: outcome.reason, buffered: outbox.length });
  }

  /** Verzegelt matches die te lang stil zijn. Alleen zo lekt de map niet. */
  function sealIdleSessions(atMs) {
    for (const [key, session] of [...open.entries()]) {
      if (atMs - session.touchedAt >= sessionIdleMs) {
        seal(key, { finishedNormally: false, finishedAt: null, reason: 'idle' });
      }
    }
  }

  /** Neemt de dagtellers uit de map en maakt hem leeg. */
  function drainDays() {
    const drained = [...days.entries()].map(([date, counters]) => ({ date, ...counters }));
    days.clear();
    return drained;
  }

  /** Zet niet-geschreven dagtellers terug, opgeteld bij wat er inmiddels bij kwam. */
  function restoreDays(drained) {
    for (const entry of drained) {
      let current = days.get(entry.date);
      if (!current) {
        current = { rooms_created: 0, games_started: 0, games_finished: 0, players_joined: 0, rematches: 0 };
        days.set(entry.date, current);
      }
      for (const counter of DAY_COUNTERS) current[counter] += entry[counter];
    }
  }

  /**
   * Zet niet-geschreven matches terug vooraan in de buffer. Loopt de buffer
   * daardoor over, dan geldt hetzelfde beleid: oudste weg, geteld.
   */
  function requeue(units) {
    outbox.unshift(...units);
    while (outbox.length > capacity) {
      const evicted = outbox.shift();
      stats.dropped.capacity += 1;
      stats.dropped.rounds += evicted.rounds.length;
      emit({
        type: 'dropped',
        reason: DROP_REASONS.CAPACITY,
        droppedSessions: stats.dropped.capacity,
        droppedRounds: stats.dropped.rounds,
        buffered: outbox.length,
      });
    }
  }

  /**
   * Race met een deadline. De onderliggende belofte loopt door — dat mag, hij
   * heeft zijn eigen `statement_timeout` — maar de flush-lock komt vrij.
   * @template T
   * @param {Promise<T>} promise
   * @param {number} ms
   */
  function withDeadline(promise, ms) {
    let timeoutHandle;
    const deadline = new Promise((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        const error = new Error(`analytics-flush overschreed ${ms} ms`);
        /** @type {any} */ (error).code = 'ANALYTICS_FLUSH_TIMEOUT';
        reject(error);
      }, ms);
      timeoutHandle.unref?.();
    });
    return Promise.race([promise, deadline]).finally(() => {
      clearTimeout(timeoutHandle);
      Promise.resolve(promise).catch(() => {});
    });
  }

  /**
   * Schrijft één batch in ÉÉN transactie: sessies, ronderijen, dagtellers en
   * de herberekende medianen. Alles of niets.
   * @param {{ query: (text: string, values?: unknown[]) => Promise<any> }} executor
   */
  async function writeBatch(executor, units, drainedDays) {
    const sessionRows = units.map((unit) => unit.session);
    const roundRows = units.flatMap((unit) => unit.rounds);

    if (sessionRows.length > 0) {
      const values = sessionRows.flatMap((row) => SESSION_COLUMNS.map((column) => row[column]));
      await executor.query(
        `INSERT INTO ${qualified('game_sessions')} (${SESSION_COLUMNS.join(', ')}) ` +
          `VALUES ${placeholders(sessionRows.length, SESSION_COLUMNS.length)} ` +
          'ON CONFLICT (id) DO NOTHING',
        values
      );
    }

    if (roundRows.length > 0) {
      const values = roundRows.flatMap((row) => ROUND_COLUMNS.map((column) => row[column]));
      await executor.query(
        `INSERT INTO ${qualified('round_stats')} (${ROUND_COLUMNS.join(', ')}) ` +
          `VALUES ${placeholders(roundRows.length, ROUND_COLUMNS.length)} ` +
          'ON CONFLICT (id) DO NOTHING',
        values
      );
    }

    if (drainedDays.length > 0) {
      const columns = ['date', ...DAY_COUNTERS];
      const values = drainedDays.flatMap((entry) => columns.map((column) => entry[column]));
      await executor.query(
        `INSERT INTO ${qualified('daily_metrics')} (${columns.join(', ')}, median_players_per_game, median_join_to_start_seconds) ` +
          `VALUES ${drainedDays
            .map((_entry, index) => {
              const base = index * columns.length;
              return `(${columns.map((_c, offset) => `$${base + offset + 1}`).join(', ')}, NULL, NULL)`;
            })
            .join(', ')} ` +
          'ON CONFLICT (date) DO UPDATE SET ' +
          DAY_COUNTERS.map((counter) => `${counter} = ${qualified('daily_metrics')}.${counter} + EXCLUDED.${counter}`).join(', '),
        values
      );
    }

    // Medianen zijn niet incrementeel bij te houden — een lopende mediaan
    // bestaat niet. Ze worden daarom in dezelfde transactie HERBEREKEND uit
    // `game_sessions`, dat per match één rij heeft. Dat blijft een aggregaat:
    // er wordt geen enkele rij per speler voor gelezen of geschreven.
    const affectedDates = [
      ...new Set([
        ...drainedDays.map((entry) => entry.date),
        ...sessionRows.map((row) => String(row.created_at).slice(0, 10)),
      ]),
    ];
    if (affectedDates.length > 0) {
      await executor.query(
        `UPDATE ${qualified('daily_metrics')} AS d SET ` +
          'median_players_per_game = m.median_players, ' +
          'median_join_to_start_seconds = m.median_join_to_start ' +
          'FROM (SELECT (s.created_at AT TIME ZONE \'UTC\')::date AS day, ' +
          'percentile_cont(0.5) WITHIN GROUP (ORDER BY s.max_player_count) AS median_players, ' +
          'percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (s.started_at - s.created_at))) ' +
          '  FILTER (WHERE s.started_at IS NOT NULL) AS median_join_to_start ' +
          `FROM ${qualified('game_sessions')} AS s ` +
          "WHERE (s.created_at AT TIME ZONE 'UTC')::date = ANY($1::date[]) " +
          'GROUP BY 1) AS m ' +
          'WHERE d.date = m.day',
        [affectedDates]
      );
    }

    return { sessions: sessionRows.length, rounds: roundRows.length, days: drainedDays.length };
  }

  return {
    /**
     * Neemt één event op. SYNCHROON, GOEDKOOP, WERPT NOOIT, RAAKT DE DATABASE
     * NIET AAN. Dit is de enige methode die op het antwoordpad mag staan.
     *
     * Alles wat mis is aan een event wordt geteld (`stats().rejected`) en
     * gemeld via `onEvent` — nooit geworpen. Zie de modulekop.
     *
     * @param {string} type - een van `ANALYTICS_EVENTS`
     * @param {Record<string, unknown>} event
     * @returns {{ accepted: boolean, reason?: string }}
     */
    record(type, event) {
      if (closed) {
        stats.dropped.closed += 1;
        emit({ type: 'rejected', eventType: type, reason: DROP_REASONS.CLOSED });
        return { accepted: false, reason: DROP_REASONS.CLOSED };
      }

      const problem = validateEvent(type, event);
      if (problem) {
        stats.rejected += 1;
        stats.lastErrorMessage = problem.detail;
        emit({ type: 'rejected', eventType: type, reason: problem.reason, detail: problem.detail });
        return { accepted: false, reason: problem.reason };
      }

      const at = /** @type {number} */ (event.at);
      const roomId = /** @type {string} */ (event.roomId);

      try {
        switch (type) {
          case ANALYTICS_EVENTS.ROOM_CREATED: {
            dayCounters(at).rooms_created += 1;
            break;
          }
          case ANALYTICS_EVENTS.MATCH_STARTED: {
            const session = openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            session.startedAt = at;
            session.language = /** @type {string} */ (event.language);
            session.difficulty = /** @type {string} */ (event.difficulty);
            session.pacing = /** @type {string} */ (event.pacing);
            session.mode = /** @type {string} */ (event.mode);
            session.gameTypes = [.../** @type {string[]} */ (event.gameTypes)];
            session.totalRounds = /** @type {number} */ (event.totalRounds);
            dayCounters(at).games_started += 1;
            break;
          }
          case ANALYTICS_EVENTS.PLAYER_JOINED: {
            const session = openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            const playerCount = /** @type {number} */ (event.playerCount);
            if (playerCount > session.maxPlayerCount) session.maxPlayerCount = playerCount;
            if (event.late === true) session.lateJoinCount += 1;
            if (event.via === 'qr') session.joinsViaQr += 1;
            else if (event.via === 'link') session.joinsViaLink += 1;
            else session.joinsViaCode += 1;
            dayCounters(at).players_joined += 1;
            break;
          }
          case ANALYTICS_EVENTS.SHARE_OPENED: {
            const session = openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            if (event.channel === 'qr') session.shareQrOpenCount += 1;
            else session.shareLinkOpenCount += 1;
            break;
          }
          case ANALYTICS_EVENTS.ROUND_FINISHED: {
            const session = openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            // uuid NU vastleggen, niet bij het schrijven: dat maakt een
            // herpoging na een mislukte flush idempotent.
            session.rounds.push({
              id: randomUUID(),
              roundNumber: /** @type {number} */ (event.roundNumber),
              gameType: /** @type {string} */ (event.gameType),
              questionKey: /** @type {string} */ (event.questionKey),
              answerCount: /** @type {number} */ (event.answerCount),
              correctCount: /** @type {number} */ (event.correctCount),
              averageAnswerMs: event.averageAnswerMs === undefined ? null : /** @type {number|null} */ (event.averageAnswerMs),
              noAnswerCount: /** @type {number} */ (event.noAnswerCount),
            });
            break;
          }
          case ANALYTICS_EVENTS.MATCH_FINISHED: {
            const key = matchKey(roomId, /** @type {number} */ (event.matchSequence));
            openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            seal(key, {
              finishedNormally: /** @type {boolean} */ (event.finishedNormally),
              finishedAt: at,
              reason: 'match-finished',
            });
            dayCounters(at).games_finished += 1;
            break;
          }
          case ANALYTICS_EVENTS.REMATCH_CREATED: {
            const session = openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            session.rematchOfSequence = /** @type {number} */ (event.previousMatchSequence);
            dayCounters(at).rematches += 1;
            break;
          }
          default:
            break;
        }
      } catch (error) {
        // Onbereikbaar bij een gevalideerd event, maar principe 9 staat geen
        // "onbereikbaar" toe op het antwoordpad: tel en ga door.
        stats.rejected += 1;
        stats.lastErrorMessage = String(/** @type {Error} */ (error)?.message ?? error);
        emit({ type: 'record-failed', eventType: type, reason: stats.lastErrorMessage });
        return { accepted: false, reason: DROP_REASONS.INVALID_FIELD };
      }

      stats.accepted += 1;
      return { accepted: true };
    },

    /**
     * Schrijft maximaal één batch weg. WERPT NOOIT — een mislukte flush is
     * een resultaat, geen uitzondering; er staat immers geen aanroeper te
     * wachten die er iets mee kan.
     *
     * Bij een fout gaat de batch ONGEWIJZIGD terug in de buffer en loopt de
     * backoff op. Zodra de database terug is, komt alles alsnog binnen. Wat er
     * ondertussen door overloop uitvalt, staat in `stats().dropped`.
     *
     * @param {{ force?: boolean }} [options] - `force` negeert de backoff.
     * @returns {Promise<{ written: {sessions:number,rounds:number,days:number}|null, requeued: number, skipped: string|null, error: string|null }>}
     */
    async flush({ force = false } = {}) {
      const idle = { written: null, requeued: 0, error: null };
      if (closed) return { ...idle, skipped: 'closed' };
      if (flushing) return { ...idle, skipped: 'in-flight' };
      const atMs = now();
      if (!force && atMs < nextAttemptAt) return { ...idle, skipped: 'backoff' };

      flushing = true;
      try {
        sealIdleSessions(atMs);
        const units = outbox.splice(0, batchSize);
        const drainedDays = drainDays();
        if (units.length === 0 && drainedDays.length === 0) {
          return { ...idle, skipped: 'empty' };
        }

        if (!sink) {
          requeue(units);
          restoreDays(drainedDays);
          return { ...idle, requeued: units.length, skipped: 'no-sink' };
        }

        try {
          const written = await withDeadline(
            sink.withTransaction((executor) => writeBatch(executor, units, drainedDays)),
            flushTimeoutMs
          );
          stats.flushes += 1;
          stats.written.sessions += written.sessions;
          stats.written.rounds += written.rounds;
          stats.written.days += written.days;
          failureStreak = 0;
          nextAttemptAt = 0;
          emit({ type: 'flushed', ...written, buffered: outbox.length });
          return { written, requeued: 0, skipped: null, error: null };
        } catch (error) {
          requeue(units);
          restoreDays(drainedDays);
          stats.flushFailures += 1;
          failureStreak += 1;
          const code = /** @type {{ code?: unknown }} */ (error)?.code;
          stats.lastErrorCode = typeof code === 'string' ? code : null;
          stats.lastErrorMessage = String(/** @type {Error} */ (error)?.message ?? error);
          const backoff = Math.min(backoffMaxMs, backoffBaseMs * 2 ** (failureStreak - 1));
          nextAttemptAt = now() + backoff;
          emit({
            type: 'flush-failed',
            reason: stats.lastErrorCode ?? stats.lastErrorMessage,
            requeued: units.length,
            buffered: outbox.length,
            retryInMs: backoff,
          });
          return { written: null, requeued: units.length, skipped: null, error: stats.lastErrorMessage };
        }
      } finally {
        flushing = false;
      }
    },

    /**
     * Leegt de buffer in meerdere batches. Voor tests en voor een nette
     * afsluiting; niet voor het antwoordpad.
     * @param {{ maxBatches?: number }} [options]
     */
    async drain({ maxBatches = 100 } = {}) {
      const results = [];
      for (let batch = 0; batch < maxBatches; batch += 1) {
        const result = await this.flush({ force: true });
        results.push(result);
        if (result.skipped === 'empty' || result.error !== null || result.skipped === 'no-sink') break;
      }
      return results;
    },

    /** Start de achtergrondflush. `unref`: dit timertje houdt geen proces open. */
    start() {
      if (timer || closed) return;
      timer = setInterval(() => {
        // Bewust geen await: `flush()` werpt nooit, en de interval mag niet op
        // hem wachten.
        this.flush().catch(() => {});
      }, flushIntervalMs);
      timer.unref?.();
    },

    /** Stopt de achtergrondflush. De buffer blijft staan. */
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },

    /**
     * Verzegelt alles wat openstaat, probeert de buffer nog leeg te schrijven
     * en sluit daarna definitief. Na `close()` weigert `record()` (geteld).
     * @param {{ flushOnClose?: boolean }} [options]
     */
    async close({ flushOnClose = true } = {}) {
      this.stop();
      if (closed) return { buffered: outbox.length };
      for (const key of [...open.keys()]) {
        seal(key, { finishedNormally: false, finishedAt: null, reason: 'close' });
      }
      if (flushOnClose && sink) await this.drain();
      closed = true;
      return { buffered: outbox.length, droppedOnClose: outbox.length };
    },

    /**
     * Alles wat er te tellen valt, inclusief wat er verloren ging. Een kopie:
     * de aanroeper kan de interne tellers niet aanpassen.
     */
    stats() {
      return {
        buffered: outbox.length,
        openSessions: open.size,
        pendingDays: days.size,
        accepted: stats.accepted,
        rejected: stats.rejected,
        sealed: stats.sealed,
        sealedByIdle: stats.sealedByIdle,
        dropped: { ...stats.dropped },
        flushes: stats.flushes,
        flushFailures: stats.flushFailures,
        written: { ...stats.written },
        failureStreak,
        nextAttemptAt,
        closed,
        lastErrorCode: stats.lastErrorCode,
        lastErrorMessage: stats.lastErrorMessage,
      };
    },

    /** Alleen voor tests: de rijen zoals ze de database in zouden gaan. */
    peekBuffer() {
      return outbox.map((unit) => ({ session: { ...unit.session }, rounds: unit.rounds.map((row) => ({ ...row })) }));
    },
  };
}
