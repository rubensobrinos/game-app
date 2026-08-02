// PostgreSQL-verbinding en levenscyclus voor de analytics-adapter (INTB3a).
//
// Dit bestand doet DRIE dingen en verder niets:
//   1. een connectiepool opzetten uit configuratie die de aanroeper meegeeft;
//   2. expliciet gedrag bij een onbereikbare database — luid, begrensd, en
//      nooit hangend;
//   3. netjes afsluiten, zodat een testproces niet blijft staan.
//
// GEEN DOMEINKENNIS. Er staat hier geen tabelnaam, geen kolom en geen SQL van
// de analytics zelf; dat hoort in `analytics.mjs`. Deze module kent alleen
// `BEGIN`, `COMMIT`, `ROLLBACK` en `SELECT 1`.
//
// DECISIONS #25 (PostgreSQL, geen SQLite) en #28 (ESM, `.mjs`). Zelfde opbouw
// als `../redis/connection.mjs`, met opzet: wie die kent, kent deze.
//
// --------------------------------------------------------------------------
// CONFIGURATIE KOMT ALS ARGUMENT BINNEN, NOOIT UIT `process.env`
// --------------------------------------------------------------------------
// Deze module leest de omgeving niet. De aanroeper (de servercomposition)
// leest `process.env` en geeft de URL door. Twee redenen: (a) een adapter die
// zelf de omgeving leest is niet twee keer naast elkaar te instantiëren, wat
// tests onmogelijk maakt; (b) een secret dat alleen via een parameter
// binnenkomt heeft precies één plek waar het kan lekken.
//
// De URL bevat vrijwel altijd een wachtwoord. Hij wordt daarom in een closure
// bewaard, nooit op het teruggegeven object gezet, en elke melding —
// foutmelding, event, `describe()`, `util.inspect`, `JSON.stringify` — toont
// uitsluitend `redactEndpoint()`: protocol, host, poort en databasenaam, met
// de credentials vervangen door `***`.
//
// GEEN PEPPER. Deze module hasht niets en krijgt geen pepper. De
// analytics-pepper (DECISIONS #26) zit uitsluitend in `analytics.mjs`, waar de
// hash wordt berekend — de verbindingslaag hoort hem nooit te zien.
//
// --------------------------------------------------------------------------
// WAAROM ALLES EEN DEADLINE HEEFT
// --------------------------------------------------------------------------
// ARCHITECTURE.md principe 9 verbiedt een databasewrite in het antwoordpad.
// `analytics.mjs` houdt zich daaraan door te bufferen, maar dat helpt alleen
// als een flush ook echt eindigt. Een TCP-verbinding naar een host die niet
// antwoordt (firewall, verdwenen container) blijft anders minutenlang open
// staan en houdt de flush-lock vast, waarna de buffer volloopt en er alsnog
// data verdwijnt. Vandaar `connectionTimeoutMillis`, `statement_timeout` en
// `query_timeout`: elke laag heeft een eigen bovengrens.

import pg from 'pg';

/** Levenscyclustoestanden van een verbinding. */
export const POSTGRES_STATES = Object.freeze({
  /** Nog nooit verbonden. */
  IDLE: 'idle',
  /** Eerste `connect()` loopt. */
  CONNECTING: 'connecting',
  /** Pool staat en de laatste operatie slaagde. */
  READY: 'ready',
  /** Pool staat, maar de laatste operatie mislukte. Herstelt vanzelf. */
  DEGRADED: 'degraded',
  /** `connect()` is mislukt. Alleen een expliciete `connect()` probeert opnieuw. */
  FAILED: 'failed',
  /** `close()` aangeroepen. Terminaal. */
  CLOSED: 'closed',
});

/**
 * Foutklasse van deze module. `code` is stabiel en bedoeld om op te matchen;
 * de `message` is voor mensen en bevat nooit credentials.
 */
export class PostgresConnectionError extends Error {
  /**
   * @param {string} message
   * @param {{ code: string, cause?: unknown }} details
   */
  constructor(message, { code, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'PostgresConnectionError';
    /** @type {string} */
    this.code = code;
  }
}

/** Foutcodes van `PostgresConnectionError`. */
export const POSTGRES_ERROR_CODES = Object.freeze({
  /** Configuratie deugt niet — geworpen door `createPostgresConnection` zelf. */
  INVALID_CONFIG: 'INVALID_CONFIG',
  /** `connect()` is definitief mislukt. */
  CONNECT_FAILED: 'CONNECT_FAILED',
  /** Geen bruikbare pool op het moment van gebruik. */
  UNAVAILABLE: 'UNAVAILABLE',
  /** De operatie liep over zijn eigen deadline. */
  TIMEOUT: 'TIMEOUT',
  /** Gebruik na `close()`. Terminaal — maak een nieuwe verbinding. */
  CLOSED: 'CLOSED',
});

const DEFAULTS = Object.freeze({
  maxPoolSize: 4,
  connectTimeoutMs: 3_000,
  statementTimeoutMs: 5_000,
  idleTimeoutMs: 10_000,
  closeGracePeriodMs: 2_000,
});

/**
 * Protocol, host, poort en databasenaam — zonder gebruikersnaam en
 * wachtwoord. Alles wat deze module naar buiten brengt over de bestemming
 * loopt hierlangs.
 * @param {string} url
 * @returns {string}
 */
export function redactEndpoint(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    // Onparsebaar: nooit de ruwe string teruggeven, die bevat een wachtwoord.
    return '<onparsebare postgres-url>';
  }
  const auth = parsed.username || parsed.password ? '***@' : '';
  const database = parsed.pathname.replace(/^\//, '');
  return `${parsed.protocol}//${auth}${parsed.host}/${database}`;
}

/**
 * Korte, credential-vrije omschrijving van een onderliggende fout.
 * @param {unknown} cause
 * @returns {string}
 */
export function describeCause(cause) {
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
    throw new PostgresConnectionError(
      `${name} moet een geheel getal >= ${min} zijn, kreeg: ${JSON.stringify(value)}`,
      { code: POSTGRES_ERROR_CODES.INVALID_CONFIG }
    );
  }
  return value;
}

/**
 * Valideert de configuratie luid en volledig, vóór er ook maar één socket
 * opengaat.
 * @param {object} config
 */
function normaliseConfig(config) {
  if (config === null || typeof config !== 'object') {
    throw new PostgresConnectionError('createPostgresConnection verwacht een configuratie-object.', {
      code: POSTGRES_ERROR_CODES.INVALID_CONFIG,
    });
  }

  const {
    url,
    maxPoolSize = DEFAULTS.maxPoolSize,
    connectTimeoutMs = DEFAULTS.connectTimeoutMs,
    statementTimeoutMs = DEFAULTS.statementTimeoutMs,
    idleTimeoutMs = DEFAULTS.idleTimeoutMs,
    closeGracePeriodMs = DEFAULTS.closeGracePeriodMs,
    searchPath = null,
    poolFactory = (options) => new pg.Pool(options),
    onEvent = null,
  } = config;

  if (typeof url !== 'string' || url.length === 0) {
    throw new PostgresConnectionError(
      'url is verplicht en moet een niet-lege string zijn. De aanroeper leest de omgeving, niet deze module.',
      { code: POSTGRES_ERROR_CODES.INVALID_CONFIG }
    );
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    // Geen `url` in de melding: hij bevat een wachtwoord.
    throw new PostgresConnectionError('url is geen geldige URL.', {
      code: POSTGRES_ERROR_CODES.INVALID_CONFIG,
    });
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new PostgresConnectionError(
      `url moet het protocol postgres: of postgresql: gebruiken, kreeg: ${parsed.protocol}`,
      { code: POSTGRES_ERROR_CODES.INVALID_CONFIG }
    );
  }

  assertInteger(maxPoolSize, 'maxPoolSize', 1);
  assertInteger(connectTimeoutMs, 'connectTimeoutMs', 1);
  assertInteger(statementTimeoutMs, 'statementTimeoutMs', 1);
  assertInteger(idleTimeoutMs, 'idleTimeoutMs', 0);
  assertInteger(closeGracePeriodMs, 'closeGracePeriodMs', 0);
  if (searchPath !== null && !/^[a-z_][a-z0-9_]*$/.test(String(searchPath))) {
    throw new PostgresConnectionError(
      `searchPath moet een eenvoudige lowercase identifier zijn, kreeg: ${JSON.stringify(searchPath)}`,
      { code: POSTGRES_ERROR_CODES.INVALID_CONFIG }
    );
  }
  if (typeof poolFactory !== 'function') {
    throw new PostgresConnectionError('poolFactory moet een functie zijn.', {
      code: POSTGRES_ERROR_CODES.INVALID_CONFIG,
    });
  }
  if (onEvent !== null && typeof onEvent !== 'function') {
    throw new PostgresConnectionError('onEvent moet een functie zijn of null.', {
      code: POSTGRES_ERROR_CODES.INVALID_CONFIG,
    });
  }

  return {
    url,
    endpoint: redactEndpoint(url),
    maxPoolSize,
    connectTimeoutMs,
    statementTimeoutMs,
    idleTimeoutMs,
    closeGracePeriodMs,
    searchPath,
    poolFactory,
    onEvent,
  };
}

/**
 * @typedef {object} SqlExecutor
 * @property {(text: string, values?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} query
 */

/**
 * @typedef {object} PostgresConnection
 * @property {() => Promise<void>} connect
 * @property {() => boolean} isReady
 * @property {() => string} getState
 * @property {(text: string, values?: unknown[]) => Promise<{ rows: any[], rowCount: number }>} query
 * @property {<T>(fn: (executor: SqlExecutor) => Promise<T>) => Promise<T>} withTransaction
 * @property {() => Promise<void>} close
 * @property {() => object} describe
 */

/**
 * Zet een PostgreSQL-pool op met expliciete levenscyclus.
 *
 * ONBEREIKBARE DATABASE, in één alinea: `pg.Pool` verbindt lui — pas bij het
 * eerste `connect()` op de pool gaat er een socket open. Dat is precies wat
 * hier gewenst is: een onbereikbare database levert een AFGEWEZEN belofte op
 * met code `UNAVAILABLE` en zet de toestand op `degraded`, en herstelt vanzelf
 * zodra een volgende operatie wél slaagt. Er is geen achtergrondlus die
 * eeuwig zit te herverbinden, en er komt nooit een pool terug waarvan de
 * aanroeper niet kan weten dat hij dood is.
 *
 * @param {object} config
 * @param {string} config.url - `postgres://user:pw@host:poort/db`. Verplicht.
 * @param {number} [config.maxPoolSize=4]
 * @param {number} [config.connectTimeoutMs=3000]
 * @param {number} [config.statementTimeoutMs=5000] - server-side
 *   `statement_timeout` én client-side `query_timeout`.
 * @param {number} [config.idleTimeoutMs=10000]
 * @param {number} [config.closeGracePeriodMs=2000] - hoe lang `close()` op de
 *   pool wacht voordat hij doorgaat. Zonder afkap hangt een testproces op een
 *   half-dode socket.
 * @param {string|null} [config.searchPath=null] - schema dat elke verbinding
 *   krijgt. Alleen `[a-z_][a-z0-9_]*`; gaat als `options=-c search_path=...`
 *   mee en wordt nooit in SQL geïnterpoleerd.
 * @param {Function} [config.poolFactory] - injecteerbaar voor tests.
 * @param {((event: object) => void)|null} [config.onEvent] - observatiehaak.
 *   Krijgt uitsluitend geredigeerde gegevens.
 * @returns {PostgresConnection}
 */
export function createPostgresConnection(config = {}) {
  const settings = normaliseConfig(config);

  /** @type {object|null} */
  let pool = null;
  let state = POSTGRES_STATES.IDLE;
  let closing = false;
  /** @type {Promise<void>|null} */
  let connectPromise = null;
  /** @type {unknown} */
  let lastError = null;
  const stats = { connects: 0, queries: 0, failures: 0, lastErrorCode: null };

  /** @param {object} event */
  function emit(event) {
    if (!settings.onEvent) return;
    try {
      settings.onEvent({ endpoint: settings.endpoint, state, ...event });
    } catch {
      // Een kapotte observatiehaak mag de verbinding nooit omtrekken.
    }
  }

  /** @param {unknown} error */
  function noteFailure(error) {
    lastError = error;
    stats.failures += 1;
    const code = /** @type {{ code?: unknown }} */ (error)?.code;
    stats.lastErrorCode = typeof code === 'string' ? code : null;
    if (!closing && state !== POSTGRES_STATES.CLOSED && state !== POSTGRES_STATES.FAILED) {
      state = POSTGRES_STATES.DEGRADED;
    }
    emit({ type: 'operation-failed', reason: describeCause(error) });
  }

  function buildPool() {
    /** @type {Record<string, unknown>} */
    const options = {
      connectionString: settings.url,
      max: settings.maxPoolSize,
      connectionTimeoutMillis: settings.connectTimeoutMs,
      idleTimeoutMillis: settings.idleTimeoutMs,
      // Twee grenzen met opzet: `statement_timeout` kapt de query af aan de
      // serverkant, `query_timeout` aan de clientkant. De eerste helpt niet
      // als de server onbereikbaar is; de tweede wel.
      statement_timeout: settings.statementTimeoutMs,
      query_timeout: settings.statementTimeoutMs,
      allowExitOnIdle: true,
    };
    if (settings.searchPath) {
      // Als startup-parameter, niet als SQL. `searchPath` is bovendien al
      // gevalideerd tegen `^[a-z_][a-z0-9_]*$`.
      options.options = `-c search_path=${settings.searchPath}`;
    }

    const created = settings.poolFactory(options);
    // Niet optioneel: een fout op een IDLE client van de pool is anders een
    // unhandled exception die het serverproces neerhaalt.
    created.on?.('error', (error) => {
      noteFailure(error);
    });
    return created;
  }

  return {
    /**
     * Zet de pool op en controleert met `SELECT 1` dat er echt iets antwoordt.
     * Idempotent bij gelijktijdige aanroepen.
     *
     * INVARIANT — tussen de `connectPromise`-check en de toewijzing staat GEEN
     * `await`; zie de gelijknamige invariant in `../redis/connection.mjs`.
     * @returns {Promise<void>}
     */
    async connect() {
      if (closing || state === POSTGRES_STATES.CLOSED) {
        throw new PostgresConnectionError(
          `Verbinding met ${settings.endpoint} is gesloten; maak een nieuwe verbinding.`,
          { code: POSTGRES_ERROR_CODES.CLOSED }
        );
      }
      if (state === POSTGRES_STATES.READY && pool) return undefined;
      if (connectPromise) return connectPromise;

      connectPromise = (async () => {
        // --- synchrone prologue: geen await tot aan de eerste query ---
        if (!pool || state === POSTGRES_STATES.FAILED) {
          const stale = pool;
          pool = null;
          if (stale) Promise.resolve(stale.end?.()).catch(() => {});
          pool = buildPool();
        }
        state = POSTGRES_STATES.CONNECTING;
        emit({ type: 'connecting' });
        const target = pool;
        // --- vanaf hier mag de beurt weg ---
        try {
          await target.query('SELECT 1');
          if (!closing) {
            state = POSTGRES_STATES.READY;
            stats.connects += 1;
            emit({ type: 'ready', connects: stats.connects });
          }
        } catch (error) {
          state = POSTGRES_STATES.FAILED;
          lastError = error;
          stats.lastErrorCode =
            typeof (/** @type {{ code?: unknown }} */ (error)?.code) === 'string'
              ? /** @type {{ code?: string }} */ (error).code
              : null;
          emit({ type: 'connect-failed', reason: describeCause(error) });
          throw new PostgresConnectionError(
            `Verbinden met PostgreSQL op ${settings.endpoint} is mislukt (${describeCause(error)}).`,
            { code: POSTGRES_ERROR_CODES.CONNECT_FAILED, cause: error }
          );
        } finally {
          connectPromise = null;
        }
      })();

      return connectPromise;
    },

    /** @returns {boolean} */
    isReady() {
      return state === POSTGRES_STATES.READY && Boolean(pool);
    },

    /** @returns {string} een van `POSTGRES_STATES` */
    getState() {
      return state;
    },

    /**
     * Eén query. Werpt `PostgresConnectionError` als er geen pool is; een
     * SQL-fout van de server propageert onveranderd (die hoort de aanroeper
     * te zien).
     * @param {string} text
     * @param {unknown[]} [values]
     */
    async query(text, values) {
      if (closing || state === POSTGRES_STATES.CLOSED) {
        throw new PostgresConnectionError(`Verbinding met ${settings.endpoint} is gesloten.`, {
          code: POSTGRES_ERROR_CODES.CLOSED,
        });
      }
      if (!pool) {
        throw new PostgresConnectionError(
          `Geen pool voor ${settings.endpoint} (toestand: ${state}); roep eerst connect() aan.`,
          { code: POSTGRES_ERROR_CODES.UNAVAILABLE, cause: lastError ?? undefined }
        );
      }
      try {
        const result = await pool.query(text, values);
        stats.queries += 1;
        if (!closing && state === POSTGRES_STATES.DEGRADED) {
          state = POSTGRES_STATES.READY;
          emit({ type: 'recovered' });
        }
        return result;
      } catch (error) {
        noteFailure(error);
        throw error;
      }
    },

    /**
     * Draait `fn` in één transactie op één client uit de pool. Commit bij
     * succes, rollback bij een fout, en de client gaat er altijd weer in —
     * ook als de rollback zelf mislukt (dan wordt hij vernietigd in plaats van
     * teruggegeven, want zijn transactiestatus is dan onbekend).
     *
     * Er wordt NIET automatisch opnieuw geprobeerd. Herhalen is de keuze van
     * `analytics.mjs`, die weet of de batch nog relevant is.
     *
     * @template T
     * @param {(executor: SqlExecutor) => Promise<T>} fn
     * @returns {Promise<T>}
     */
    async withTransaction(fn) {
      if (typeof fn !== 'function') {
        throw new PostgresConnectionError('withTransaction verwacht een functie.', {
          code: POSTGRES_ERROR_CODES.INVALID_CONFIG,
        });
      }
      if (closing || state === POSTGRES_STATES.CLOSED) {
        throw new PostgresConnectionError(`Verbinding met ${settings.endpoint} is gesloten.`, {
          code: POSTGRES_ERROR_CODES.CLOSED,
        });
      }
      if (!pool) {
        throw new PostgresConnectionError(
          `Geen pool voor ${settings.endpoint} (toestand: ${state}); roep eerst connect() aan.`,
          { code: POSTGRES_ERROR_CODES.UNAVAILABLE, cause: lastError ?? undefined }
        );
      }

      let client;
      try {
        client = await pool.connect();
      } catch (error) {
        noteFailure(error);
        throw new PostgresConnectionError(
          `Geen client van ${settings.endpoint} (${describeCause(error)}).`,
          { code: POSTGRES_ERROR_CODES.UNAVAILABLE, cause: error }
        );
      }

      let poisoned = false;
      try {
        await client.query('BEGIN');
        const value = await fn({
          query: (text, values) => client.query(text, values),
        });
        await client.query('COMMIT');
        stats.queries += 1;
        if (!closing && state === POSTGRES_STATES.DEGRADED) {
          state = POSTGRES_STATES.READY;
          emit({ type: 'recovered' });
        }
        return value;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          // De client zit nu in een onbekende transactiestatus. Teruggeven aan
          // de pool zou de volgende gebruiker die status laten erven.
          poisoned = true;
          emit({ type: 'rollback-failed', reason: describeCause(rollbackError) });
        }
        noteFailure(error);
        throw error;
      } finally {
        try {
          client.release(poisoned ? new Error('transactiestatus onbekend na mislukte ROLLBACK') : undefined);
        } catch {
          // Loslaten mag nooit de oorspronkelijke fout overschrijven.
        }
      }
    },

    /**
     * Sluit netjes af. Idempotent, terminaal, en hangt niet: na
     * `closeGracePeriodMs` gaat hij door, ook als `pool.end()` blijft staan.
     * @returns {Promise<void>}
     */
    async close() {
      closing = true;
      const target = pool;
      pool = null;
      connectPromise = null;
      if (!target) {
        state = POSTGRES_STATES.CLOSED;
        emit({ type: 'closed' });
        return;
      }
      let timer;
      try {
        const graceful = Promise.resolve(target.end?.());
        const deadline = new Promise((resolve) => {
          timer = setTimeout(resolve, settings.closeGracePeriodMs);
          timer.unref?.();
        });
        await Promise.race([graceful, deadline]);
        // Onderdrukt een late rejection van de `end()` die we niet meer
        // afwachten; anders wordt het een unhandled rejection.
        graceful.catch(() => {});
      } catch {
        // Afsluiten mag nooit werpen.
      } finally {
        clearTimeout(timer);
        state = POSTGRES_STATES.CLOSED;
        emit({ type: 'closed' });
      }
    },

    /**
     * Geredigeerde beschrijving voor logs en healthchecks. Bevat per
     * constructie geen credentials.
     * @returns {{ endpoint: string, state: string, connects: number, queries: number, failures: number, lastErrorCode: string|null }}
     */
    describe() {
      return {
        endpoint: settings.endpoint,
        state,
        connects: stats.connects,
        queries: stats.queries,
        failures: stats.failures,
        lastErrorCode: stats.lastErrorCode,
      };
    },

    /** Zodat `JSON.stringify(connection)` de URL niet alsnog lekt. */
    toJSON() {
      return this.describe();
    },
  };
}
