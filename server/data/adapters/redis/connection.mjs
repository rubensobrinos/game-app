// Redis-verbinding en levenscyclus voor de opslagadapter (INTB2a).
//
// Dit bestand doet DRIE dingen en verder niets:
//   1. een client opzetten uit configuratie die de aanroeper meegeeft;
//   2. expliciet gedrag bij verbindingsverlies, heropbouw en definitieve
//      opgave;
//   3. netjes afsluiten, zodat een testproces niet blijft hangen.
//
// GEEN POORTMETHODEN. `loadRoom`, `saveRoom`, de atomaire operaties en de
// TTL-refresh horen bij INTB2b/c/d. Hier staat geen enkele Redis-sleutel en
// geen enkel domeinbegrip.
//
// DECISIONS #24 (officiële `redis`-package) en #28 (ESM, `.mjs`).
//
// --------------------------------------------------------------------------
// CONFIGURATIE KOMT ALS ARGUMENT BINNEN, NOOIT UIT `process.env`
// --------------------------------------------------------------------------
// Deze module leest de omgeving niet. De aanroeper (de servercomposition)
// leest `process.env` en geeft de URL door. Twee redenen: (a) een adapter die
// zelf de omgeving leest is niet twee keer naast elkaar te instantiëren, wat
// tests en een latere tweede instantie onmogelijk maakt; (b) een secret dat
// alleen via een parameter binnenkomt heeft precies één plek waar het kan
// lekken, en die plek is te bewaken.
//
// De URL kan gebruikersnaam en wachtwoord bevatten. Hij wordt daarom in een
// closure bewaard, nooit op het teruggegeven object gezet, en elke melding —
// foutmelding, event, `describe()`, `util.inspect` — toont uitsluitend
// `redactEndpoint()`: protocol, host en poort, met de credentials vervangen
// door `***`. `console.log(connection)` kan de URL dus niet lekken.
//
// GEEN PEPPER. Deze adapter krijgt er geen, en hoort er geen te krijgen: de
// invite-hash wordt vóór de repositorypoort berekend (`hashInviteId()` uit
// `server/architecture/room-codes.js`), zodat de opslaglaag nooit de platte
// capability én nooit de pepper ziet. Zie de `RoomLocatorClaim`-typedef in
// `server/data/repository.js`.
//
// --------------------------------------------------------------------------
// ROOM-INDEX (`rooms:active`) — WAAR DAT STRAKS GEBEURT
// --------------------------------------------------------------------------
// ARCHITECTURE.md §10 gebruikt de room-index om na een herstart de actieve
// rooms terug te vinden. Deze module schrijft hem NIET; hij legt alleen vast
// waar dat hoort te gebeuren, zodat INTB2b/2e het niet opnieuw hoeft te
// bedenken en het niet op drie plekken half gebeurt:
//
//   * TOEVOEGEN — in `saveRoom` (INTB2b), in DEZELFDE MULTI/Lua als het
//     schrijven van het Room-document. Niet in `claimRoomLocatorsAtomically`:
//     een claim mag mislukken, en dan bestaat er nog geen room. Een room die
//     in `rooms:active` staat maar geen document heeft, is precies de
//     inconsistentie die het herstelpad van §10 laat struikelen.
//   * VERWIJDEREN, expliciet — in `releaseRoomLocators` (INTB2b), samen met de
//     code- en invite-index.
//   * VERWIJDEREN, na verval — NIET hier en niet in een poortmethode. Een
//     Redis-setmember heeft geen eigen TTL, dus na het verlopen van
//     `room:{roomId}` blijft het lid achter. DATA-MODEL.md §TTL noemt hiervoor
//     "periodieke cleanup"; dat is een sweep die per lid `EXISTS room:{roomId}`
//     controleert en met `SREM` opruimt. Die sweep hoort bij INTB2e/de
//     repositorylaag, niet bij een leesoperatie op het antwoordpad
//     (ARCHITECTURE.md principe 9).
//   * LEZEN — het herstelpad na serverherstart (INTB2e).
//
// De sleutel komt altijd uit `roomsActiveKey()` in `server/data/redis-keys.js`
// en wordt nergens als string samengesteld. Deze module importeert die helper
// bewust niet: hij raakt geen enkele sleutel aan, en een ongebruikte import
// zou suggereren van wel.

import { createClient } from 'redis';

/** Levenscyclustoestanden van een verbinding. */
export const CONNECTION_STATES = Object.freeze({
  /** Nog nooit verbonden. */
  IDLE: 'idle',
  /** Eerste `connect()` loopt (inclusief zijn interne herpogingen). */
  CONNECTING: 'connecting',
  /** Verbonden en bruikbaar. */
  READY: 'ready',
  /** Verbinding verbroken, automatische herverbinding loopt. */
  RECONNECTING: 'reconnecting',
  /** Definitief opgegeven. Alleen een expliciete `connect()` bouwt opnieuw op. */
  FAILED: 'failed',
  /** `close()` aangeroepen. Terminaal. */
  CLOSED: 'closed',
});

/**
 * Foutklasse van deze module. `code` is stabiel en bedoeld om op te matchen;
 * de `message` is voor mensen en bevat nooit credentials.
 */
export class RedisConnectionError extends Error {
  /**
   * @param {string} message
   * @param {{ code: string, cause?: unknown }} details
   */
  constructor(message, { code, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'RedisConnectionError';
    /** @type {string} */
    this.code = code;
  }
}

/** Foutcodes van `RedisConnectionError`. */
export const CONNECTION_ERROR_CODES = Object.freeze({
  /** Configuratie deugt niet — geworpen door `createRedisConnection` zelf. */
  INVALID_CONFIG: 'INVALID_CONFIG',
  /** `connect()` is definitief mislukt (herpogingen inbegrepen). */
  CONNECT_FAILED: 'CONNECT_FAILED',
  /** Herverbinden is opgegeven na het maximale aantal pogingen. */
  RECONNECT_EXHAUSTED: 'RECONNECT_EXHAUSTED',
  /** `getClient()` terwijl er geen bruikbare client is. */
  CONNECTION_UNAVAILABLE: 'CONNECTION_UNAVAILABLE',
  /** Gebruik na `close()`. Terminaal — maak een nieuwe verbinding. */
  CLOSED: 'CLOSED',
});

const DEFAULTS = Object.freeze({
  connectTimeoutMs: 5_000,
  maxReconnectAttempts: 10,
  reconnectBaseDelayMs: 50,
  reconnectMaxDelayMs: 2_000,
  closeGracePeriodMs: 1_000,
});

/**
 * Protocol, host en poort — zonder gebruikersnaam en wachtwoord. Alles wat
 * deze module naar buiten brengt over de bestemming loopt hierlangs.
 * @param {string} url
 * @returns {string}
 */
function redactEndpoint(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    // Onparsebaar: nooit de ruwe string teruggeven, die kan een wachtwoord
    // bevatten.
    return '<onparsebare redis-url>';
  }
  const auth = parsed.username || parsed.password ? '***@' : '';
  return `${parsed.protocol}//${auth}${parsed.host}`;
}

/**
 * Korte, credential-vrije omschrijving van een onderliggende fout. Nooit de
 * hele stack en nooit de URL: node-redis' socketfouten bevatten host en poort,
 * maar geen credentials, en alleen `code`/`message` worden overgenomen.
 * @param {unknown} cause
 * @returns {string}
 */
function describeCause(cause) {
  if (cause === null || cause === undefined) return 'onbekende oorzaak';
  if (cause instanceof Error) {
    const code = /** @type {{ code?: unknown }} */ (cause).code;
    return typeof code === 'string' ? `${cause.name}(${code})` : cause.name;
  }
  return typeof cause;
}

/**
 * @param {unknown} value
 * @param {string} name
 * @param {number} min
 * @returns {number}
 */
function assertInteger(value, name, min) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new RedisConnectionError(
      `${name} moet een geheel getal >= ${min} zijn, kreeg: ${JSON.stringify(value)}`,
      { code: CONNECTION_ERROR_CODES.INVALID_CONFIG }
    );
  }
  return value;
}

/**
 * Valideert de configuratie luid en volledig, vóór er ook maar één socket
 * opengaat. Een verkeerde URL hoort te knallen bij het opzetten van de
 * adapter, niet bij het eerste antwoord van een speler.
 * @param {object} config
 */
function normaliseConfig(config) {
  if (config === null || typeof config !== 'object') {
    throw new RedisConnectionError('createRedisConnection verwacht een configuratie-object.', {
      code: CONNECTION_ERROR_CODES.INVALID_CONFIG,
    });
  }

  const {
    url,
    database,
    connectTimeoutMs = DEFAULTS.connectTimeoutMs,
    maxReconnectAttempts = DEFAULTS.maxReconnectAttempts,
    reconnectBaseDelayMs = DEFAULTS.reconnectBaseDelayMs,
    reconnectMaxDelayMs = DEFAULTS.reconnectMaxDelayMs,
    closeGracePeriodMs = DEFAULTS.closeGracePeriodMs,
    clientFactory = createClient,
    onEvent = null,
  } = config;

  if (typeof url !== 'string' || url.length === 0) {
    throw new RedisConnectionError(
      'url is verplicht en moet een niet-lege string zijn. De aanroeper leest de omgeving, niet deze module.',
      { code: CONNECTION_ERROR_CODES.INVALID_CONFIG }
    );
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    // Geen `url` in de melding: hij kan een wachtwoord bevatten.
    throw new RedisConnectionError('url is geen geldige URL.', {
      code: CONNECTION_ERROR_CODES.INVALID_CONFIG,
    });
  }
  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new RedisConnectionError(
      `url moet het protocol redis: of rediss: gebruiken, kreeg: ${parsed.protocol}`,
      { code: CONNECTION_ERROR_CODES.INVALID_CONFIG }
    );
  }

  if (database !== undefined) assertInteger(database, 'database', 0);
  assertInteger(connectTimeoutMs, 'connectTimeoutMs', 1);
  assertInteger(maxReconnectAttempts, 'maxReconnectAttempts', 0);
  assertInteger(reconnectBaseDelayMs, 'reconnectBaseDelayMs', 1);
  assertInteger(reconnectMaxDelayMs, 'reconnectMaxDelayMs', 1);
  assertInteger(closeGracePeriodMs, 'closeGracePeriodMs', 0);
  if (reconnectMaxDelayMs < reconnectBaseDelayMs) {
    throw new RedisConnectionError('reconnectMaxDelayMs mag niet kleiner zijn dan reconnectBaseDelayMs.', {
      code: CONNECTION_ERROR_CODES.INVALID_CONFIG,
    });
  }
  if (typeof clientFactory !== 'function') {
    throw new RedisConnectionError('clientFactory moet een functie zijn.', {
      code: CONNECTION_ERROR_CODES.INVALID_CONFIG,
    });
  }
  if (onEvent !== null && typeof onEvent !== 'function') {
    throw new RedisConnectionError('onEvent moet een functie zijn of null.', {
      code: CONNECTION_ERROR_CODES.INVALID_CONFIG,
    });
  }

  return {
    url,
    endpoint: redactEndpoint(url),
    database,
    connectTimeoutMs,
    maxReconnectAttempts,
    reconnectBaseDelayMs,
    reconnectMaxDelayMs,
    closeGracePeriodMs,
    clientFactory,
    onEvent,
  };
}

/**
 * @typedef {object} RedisConnection
 * @property {() => Promise<object>} connect
 * @property {() => object} getClient
 * @property {() => string} getState
 * @property {() => boolean} isReady
 * @property {() => Promise<void>} close
 * @property {() => object} describe
 */

/**
 * Zet een Redis-verbinding op met expliciete levenscyclus.
 *
 * VERBINDINGSVERLIES, in één alinea: node-redis herverbindt zelf, maar zwijgt
 * als je hem laat zwijgen — het standaardgedrag is oneindig herproberen, en
 * dan staat een server met een onbereikbare Redis er eeuwig "bijna" bij. Deze
 * module legt daarom een eigen `reconnectStrategy` op: exponentiële backoff
 * (`base * 2^poging`, afgetopt op `reconnectMaxDelayMs`) tot en met
 * `maxReconnectAttempts`, en daarna een `Error` teruggeven. Dat laatste is het
 * verschil tussen luid en stil: node-redis stopt dan met herproberen, de
 * toestand gaat naar `failed`, en `getClient()` werpt vanaf dat moment
 * `CONNECTION_UNAVAILABLE`. Er komt nooit een client terug waarvan de
 * aanroeper niet kan weten dat hij dood is.
 *
 * HEROPBOUW is expliciet: een `failed` verbinding herstelt zichzelf niet. Een
 * nieuwe `connect()` gooit de oude client weg en bouwt een verse op. Wie dat
 * wil (een supervisor, een healthcheck) moet het zeggen; er is geen verborgen
 * achtergrondlus die het stiekem toch probeert.
 *
 * @param {object} config
 * @param {string} config.url - `redis://host:poort` of `rediss://…`. Verplicht.
 *   Komt van de aanroeper; deze module leest `process.env` niet.
 * @param {number} [config.database] - Redis-database-index.
 * @param {number} [config.connectTimeoutMs=5000]
 * @param {number} [config.maxReconnectAttempts=10] - 0 = nooit herverbinden.
 * @param {number} [config.reconnectBaseDelayMs=50]
 * @param {number} [config.reconnectMaxDelayMs=2000]
 * @param {number} [config.closeGracePeriodMs=1000] - Hoe lang `close()` op een
 *   nette `QUIT` wacht voordat hij de socket hardhandig sloopt. Zonder deze
 *   afkap kan `close()` op een half-dode socket blijven hangen, en dan hangt
 *   het testproces.
 * @param {Function} [config.clientFactory=createClient] - Injecteerbaar voor
 *   tests. Krijgt exact de opties die anders naar `redis.createClient` gaan.
 * @param {((event: object) => void)|null} [config.onEvent] - Observatiehaak.
 *   Krijgt uitsluitend geredigeerde gegevens: geen URL met credentials, geen
 *   sleutels, geen documentinhoud.
 * @returns {RedisConnection}
 */
export function createRedisConnection(config = {}) {
  const settings = normaliseConfig(config);

  /** @type {object|null} */
  let client = null;
  let state = CONNECTION_STATES.IDLE;
  let closing = false;
  /** @type {Promise<object>|null} */
  let connectPromise = null;
  /** @type {unknown} */
  let lastError = null;
  const stats = { connects: 0, reconnectAttempts: 0, lastErrorCode: null };

  /** @param {object} event */
  function emit(event) {
    if (!settings.onEvent) return;
    try {
      settings.onEvent({ endpoint: settings.endpoint, state, ...event });
    } catch {
      // Een kapotte observatiehaak mag de verbinding nooit omtrekken.
    }
  }

  /**
   * @param {number} retries - 0-gebaseerd, aangeleverd door node-redis.
   * @returns {number}
   */
  function backoffMs(retries) {
    const raw = settings.reconnectBaseDelayMs * 2 ** retries;
    return Math.min(settings.reconnectMaxDelayMs, raw);
  }

  /**
   * Zuivere functie van (`retries`, `cause`): node-redis roept hem ook aan als
   * *probe* (met `retries === 0`) om te bepalen óf er herverbonden wordt. Een
   * eigen teller ophogen zou daardoor mistellen.
   * @param {number} retries
   * @param {Error} cause
   * @returns {number|Error}
   */
  function reconnectStrategy(retries, cause) {
    if (closing) return false;

    if (retries >= settings.maxReconnectAttempts) {
      state = CONNECTION_STATES.FAILED;
      lastError = cause;
      const error = new RedisConnectionError(
        `Redis op ${settings.endpoint} gaf het op na ${retries} herverbindingspogingen (${describeCause(cause)}).`,
        { code: CONNECTION_ERROR_CODES.RECONNECT_EXHAUSTED, cause }
      );
      emit({
        type: 'reconnect-exhausted',
        attempt: retries,
        code: CONNECTION_ERROR_CODES.RECONNECT_EXHAUSTED,
        reason: describeCause(cause),
      });
      // Een Error laat node-redis stoppen met herproberen. Dat is het punt:
      // stil doorproberen is hetzelfde als kapot zijn zonder het te melden.
      return error;
    }

    stats.reconnectAttempts = Math.max(stats.reconnectAttempts, retries + 1);
    if (state !== CONNECTION_STATES.CONNECTING) state = CONNECTION_STATES.RECONNECTING;
    const delayMs = backoffMs(retries);
    emit({ type: 'reconnect-scheduled', attempt: retries + 1, delayMs, reason: describeCause(cause) });
    return delayMs;
  }

  /** @param {unknown} error */
  function onClientError(error) {
    lastError = error;
    const code = /** @type {{ code?: unknown }} */ (error)?.code;
    stats.lastErrorCode = typeof code === 'string' ? code : null;
    if (closing) return;
    if (state === CONNECTION_STATES.READY) {
      state = CONNECTION_STATES.RECONNECTING;
      emit({ type: 'connection-lost', reason: describeCause(error) });
      return;
    }
    emit({ type: 'error', reason: describeCause(error) });
  }

  function onClientReady() {
    if (closing) return;
    stats.connects += 1;
    state = CONNECTION_STATES.READY;
    emit({ type: 'ready', connects: stats.connects });
  }

  function onClientEnd() {
    if (closing) {
      state = CONNECTION_STATES.CLOSED;
      return;
    }
    // Onverwacht einde zonder dat wij afsluiten: de client komt niet terug.
    if (state !== CONNECTION_STATES.FAILED) {
      state = CONNECTION_STATES.FAILED;
      emit({ type: 'ended-unexpectedly' });
    }
  }

  function buildClient() {
    /** @type {Record<string, unknown>} */
    const options = {
      url: settings.url,
      socket: {
        connectTimeout: settings.connectTimeoutMs,
        reconnectStrategy,
      },
    };
    if (settings.database !== undefined) options.database = settings.database;

    const created = settings.clientFactory(options);
    // De 'error'-listener is niet optioneel: zonder listener maakt een
    // EventEmitter van elke socketfout een unhandled exception die het
    // serverproces neerhaalt.
    created.on('error', onClientError);
    created.on('ready', onClientReady);
    created.on('end', onClientEnd);
    return created;
  }

  /**
   * BEWUST SYNCHROON — laat dit geen `async` functie worden.
   *
   * Er valt niets te awaiten: listeners weghalen en een socket slopen zijn
   * allebei synchroon. Maar er is een tweede reden, en die is de belangrijkste:
   * `connect()` roept hem aan in de prologue die de race met een tweede
   * gelijktijdige `connect()` moet dichthouden. Een `await` dáár geeft de beurt
   * terug vóórdat `connectPromise` bestaat, en dan bouwen twee aanroepers elk
   * hun eigen client waarvan er één een weeskind wordt — een open socket
   * zonder eigenaar, die niemand meer sluit.
   *
   * `connect()` is inmiddels zo gebouwd dat de correctheid hier niet meer van
   * afhangt (zie de invariant daar), maar synchroon houden is de eerlijkste
   * vorm: deze functie doet niets asynchroons en hoort dat ook niet te
   * suggereren.
   * @param {object|null} target
   */
  function disposeClient(target) {
    if (!target) return;
    target.removeListener?.('error', onClientError);
    target.removeListener?.('ready', onClientReady);
    target.removeListener?.('end', onClientEnd);
    // Een losgekoppelde client mag geen unhandled 'error' meer veroorzaken.
    target.on?.('error', () => {});
    try {
      if (target.isOpen) target.destroy();
    } catch {
      // Al dicht. Prima.
    }
  }

  return {
    /**
     * Verbindt, of geeft de bestaande verbinding terug. Idempotent bij
     * gelijktijdige aanroepen: één onderliggende `connect()`, één client.
     *
     * INVARIANT — LEES DIT VOOR JE HIER IETS HERSCHIKT:
     * tussen de `connectPromise`-check en de `connectPromise`-toewijzing staat
     * GEEN ENKELE `await`. Alles wat een client bouwt of toestand zet, gebeurt
     * daarom binnen de synchrone prologue van de IIFE hieronder — die loopt tot
     * aan zijn eigen eerste `await`, en pas dán krijgt de aanroeper zijn beurt
     * terug, met `connectPromise` al gezet.
     *
     * Deze methode is `async` (en werpt dus via een rejected promise), maar het
     * lichaam bevat opzettelijk geen top-level `await`. Zet er nooit een vóór
     * de toewijzing: dan geeft de eerste aanroeper zijn beurt terug terwijl
     * `connectPromise` nog `null` is, ziet de tweede aanroeper een lege sloop
     * en bouwt een tweede client. De eerste raakt zijn client dan kwijt aan de
     * variabele van de tweede: een open socket zonder eigenaar, die nooit meer
     * gesloten wordt. Deze fout is door de test "verbindt maar één keer bij
     * gelijktijdige connect()-aanroepen" gevonden en die test bewaakt hem.
     * @returns {Promise<object>} de node-redis client
     */
    async connect() {
      if (closing || state === CONNECTION_STATES.CLOSED) {
        throw new RedisConnectionError(
          `Verbinding met ${settings.endpoint} is gesloten; maak een nieuwe verbinding.`,
          { code: CONNECTION_ERROR_CODES.CLOSED }
        );
      }
      if (state === CONNECTION_STATES.READY && client) return client;
      if (connectPromise) return connectPromise;

      connectPromise = (async () => {
        // --- synchrone prologue: geen await tot aan target.connect() ---
        if (!client || state === CONNECTION_STATES.FAILED) {
          const stale = client;
          client = null;
          disposeClient(stale);
          client = buildClient();
        }
        state = CONNECTION_STATES.CONNECTING;
        emit({ type: 'connecting' });
        const target = client;
        // --- vanaf hier mag de beurt weg ---
        try {
          await target.connect();
          if (!closing) state = CONNECTION_STATES.READY;
          return target;
        } catch (error) {
          state = CONNECTION_STATES.FAILED;
          lastError = error;
          emit({ type: 'connect-failed', reason: describeCause(error) });
          throw new RedisConnectionError(
            `Verbinden met Redis op ${settings.endpoint} is mislukt (${describeCause(error)}).`,
            { code: CONNECTION_ERROR_CODES.CONNECT_FAILED, cause: error }
          );
        } finally {
          connectPromise = null;
        }
      })();

      return connectPromise;
    },

    /**
     * De client, of een luide fout. Geeft NOOIT `null` terug: een aanroeper
     * die vergeet te controleren hoort te struikelen, niet stilletjes niets te
     * doen.
     *
     * Toegestaan bij `ready` én bij `reconnecting`: node-redis buffert
     * commando's tijdens een herverbinding en verstuurt ze daarna. Mislukt de
     * herverbinding alsnog, dan worden die commando's *afgewezen* — luid dus,
     * en dat is beter dan een lopende ronde afkappen op een hik van één
     * seconde.
     * @returns {object}
     */
    getClient() {
      if ((state === CONNECTION_STATES.READY || state === CONNECTION_STATES.RECONNECTING) && client) {
        return client;
      }
      throw new RedisConnectionError(
        `Geen bruikbare Redis-verbinding met ${settings.endpoint} (toestand: ${state}` +
          `${lastError ? `, laatste fout: ${describeCause(lastError)}` : ''}).`,
        {
          code:
            state === CONNECTION_STATES.CLOSED
              ? CONNECTION_ERROR_CODES.CLOSED
              : CONNECTION_ERROR_CODES.CONNECTION_UNAVAILABLE,
          cause: lastError ?? undefined,
        }
      );
    },

    /** @returns {string} een van `CONNECTION_STATES` */
    getState() {
      return state;
    },

    /** @returns {boolean} */
    isReady() {
      return state === CONNECTION_STATES.READY && Boolean(client?.isReady);
    },

    /**
     * Sluit netjes af. Idempotent, terminaal, en hangt niet: na
     * `closeGracePeriodMs` wordt de socket alsnog gesloopt. Na `close()` werpt
     * `connect()` en `getClient()`.
     * @returns {Promise<void>}
     */
    async close() {
      closing = true;
      const target = client;
      client = null;
      connectPromise = null;
      if (!target) {
        state = CONNECTION_STATES.CLOSED;
        emit({ type: 'closed' });
        return;
      }

      try {
        if (target.isOpen) {
          let timer;
          const graceful = target.close();
          const deadline = new Promise((resolve) => {
            timer = setTimeout(resolve, settings.closeGracePeriodMs);
            timer.unref?.();
          });
          try {
            await Promise.race([graceful, deadline]);
          } finally {
            clearTimeout(timer);
          }
          // Onderdrukt een late rejection van de QUIT die we niet meer
          // afwachten; anders wordt het een unhandled rejection.
          Promise.resolve(graceful).catch(() => {});
        }
      } catch {
        // Val door naar destroy(): afsluiten mag nooit werpen.
      } finally {
        disposeClient(target);
        state = CONNECTION_STATES.CLOSED;
        emit({ type: 'closed' });
      }
    },

    /**
     * Geredigeerde beschrijving voor logs en healthchecks. Bevat per
     * constructie geen credentials.
     * @returns {{ endpoint: string, database: number|undefined, state: string, connects: number, reconnectAttempts: number, lastErrorCode: string|null }}
     */
    describe() {
      return {
        endpoint: settings.endpoint,
        database: settings.database,
        state,
        connects: stats.connects,
        reconnectAttempts: stats.reconnectAttempts,
        lastErrorCode: stats.lastErrorCode,
      };
    },

    /** Zodat `JSON.stringify(connection)` de URL niet alsnog lekt. */
    toJSON() {
      return this.describe();
    },
  };
}
