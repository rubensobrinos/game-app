import { createInMemoryStore } from './data/in-memory-store.js';

// ─────────────────────────────────────────────────────────────────────────────
// De store-factory — welke opslag draait er onder deze server?
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alles wat de server van zijn opslag hoeft te weten, achter één vorm. De
 * `store` zelf is de DataStore-poort uit `server/data/repository.js`; de drie
 * andere velden zijn levenscyclus en observatie, en die horen NIET op de poort
 * (de compositielaag mag niet weten of hij tegen Redis of tegen een Map praat).
 *
 * @typedef {{
 *   kind: 'memory' | 'redis',
 *   store: object,
 *   describe: () => object,
 *   checkReady: () => Promise<{ ok: boolean, reason?: string }>,
 *   close: () => Promise<void>,
 * }} StoreHandle
 */

/** Hoe lang `/readyz` op een storeantwoord wacht voordat hij hem dood verklaart. */
const READYZ_PROBE_TIMEOUT_MS = 1000;

/**
 * De ontwikkelstore. "Bereikbaar" is hier triviaal waar: er is geen netwerk en
 * geen proces om kwijt te raken, dus een probe die iets anders dan `ok` kan
 * teruggeven zou een probe zijn die nergens naar kijkt.
 *
 * @param {object} [store]
 * @returns {StoreHandle}
 */
export function createMemoryStoreHandle(store = createInMemoryStore()) {
  return {
    kind: 'memory',
    store,
    describe: () => ({ kind: 'memory' }),
    async checkReady() {
      return { ok: true };
    },
    async close() {},
  };
}

/**
 * Wacht op een promise met een harde bovengrens.
 *
 * `/readyz` heeft dit nodig en niet als luxe: tijdens een herverbinding BUFFERT
 * node-redis commando's (zie `getClient()` in connection.mjs) en lost een
 * `PING` dus pas op als de herverbinding lukt of definitief opgeeft. Een
 * readiness-probe die daarop wacht, hangt precies wanneer hij nodig is — en dan
 * krijgt de orchestrator geen "niet gereed" maar helemaal niets.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {T} fallback
 * @returns {Promise<T>}
 */
async function withDeadline(promise, timeoutMs, fallback) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * De persistente store: INT-B's Redis-adapter, verbonden en wel.
 *
 * DRIE DINGEN GEBEUREN HIER LUID IN PLAATS VAN STIL:
 *
 *   1. STARTGATE OP VOLLEDIGHEID. `UNIMPLEMENTED_METHODS` is vandaag leeg, maar
 *      wordt toch uitgelezen. Loopt de adapter ooit weer achter op de poort,
 *      dan weigert de server te starten mét de namen van de gaten — in plaats
 *      van door te draaien tot de eerste echte speler op de ontbrekende methode
 *      stuit, midden in een handshake.
 *   2. VERBINDEN BIJ BOOT. Lukt dat niet, dan werpt deze functie en start de
 *      server niet. Er is met opzet GEEN terugval op de in-memory fake: een
 *      productieserver die vrolijk op een fake draait is erger dan een
 *      productieserver die niet start, want het eerste merkt niemand.
 *   3. GEEN URL IN DE MELDING. `RedisConnectionError` toont uitsluitend het
 *      geredigeerde endpoint; die melding wordt hier overgenomen en de ruwe
 *      `REDIS_URL` (die credentials kan bevatten) nooit.
 *
 * @param {string} redisUrl
 * @param {{
 *   onEvent?: ((event: object) => void) | null,
 *   connection?: object,
 * }} [options] - `connection` gaat ongewijzigd naar `createRedisConnection`
 *   (timeouts, herpogingen). De STANDAARD is met opzet geduldig: ~11 seconden
 *   herproberen bij het opstarten, zodat een server die tegelijk met zijn Redis
 *   opstart niet in een herstartlus belandt. Alleen tests hebben reden om dat
 *   in te korten; `url` valt hier nooit te overschrijven.
 * @returns {Promise<StoreHandle>}
 */
export async function createRedisStoreHandle(redisUrl, { onEvent = null, connection: connectionOptions = {} } = {}) {
  // Dynamisch geladen, niet bovenaan: zonder `REDIS_URL` hoeft het
  // `redis`-pakket niet eens geïmporteerd te worden. Dezelfde vorm als
  // `attachSocketsIfAvailable`, maar zónder de ENOENT-tolerantie — deze module
  // MOET bestaan, en als hij ontbreekt hoort dat te knallen.
  const [{ createRedisConnection }, { createRedisDataStore, UNIMPLEMENTED_METHODS }] = await Promise.all([
    import('./data/adapters/redis/connection.mjs'),
    import('./data/adapters/redis/data-store.mjs'),
  ]);

  const missing = Array.isArray(UNIMPLEMENTED_METHODS)
    ? [...UNIMPLEMENTED_METHODS]
    : Object.keys(UNIMPLEMENTED_METHODS ?? {});
  if (missing.length > 0) {
    throw new Error(
      'REDIS_URL is gezet, maar de Redis-adapter is nog niet volledig: '
      + `${missing.sort().join(', ')}. De server start niet — een ontbrekende poortmethode `
      + 'hoort bij het opstarten te falen, niet bij de eerste handshake van een speler.',
    );
  }

  const connection = createRedisConnection({ ...connectionOptions, url: redisUrl, onEvent });
  try {
    await connection.connect();
  } catch (error) {
    // De verbinding kan een half opgezette client vasthouden; die hoort dicht
    // voordat we de fout doorgeven, anders houdt een socket het proces open.
    await connection.close().catch(() => {});
    throw new Error(
      `Verbinden met Redis (REDIS_URL) is mislukt, dus de server start niet: ${error?.message ?? String(error)}`,
      { cause: error },
    );
  }

  const endpoint = connection.describe().endpoint;

  return {
    kind: 'redis',
    store: createRedisDataStore({ connection }),
    describe: () => connection.describe(),
    async checkReady() {
      const probe = (async () => {
        try {
          const pong = await connection.getClient().ping();
          return pong === 'PONG'
            ? { ok: true }
            : { ok: false, reason: `Redis op ${endpoint} antwoordde ${JSON.stringify(pong)} op PING` };
        } catch (error) {
          const code = /** @type {{ code?: unknown }} */ (error)?.code;
          return {
            ok: false,
            reason: `Redis op ${endpoint} is niet bereikbaar (${typeof code === 'string' ? code : connection.getState()})`,
          };
        }
      })();
      return withDeadline(probe, READYZ_PROBE_TIMEOUT_MS, {
        ok: false,
        reason: `Redis op ${endpoint} antwoordde niet binnen ${READYZ_PROBE_TIMEOUT_MS} ms op PING (toestand: ${connection.getState()})`,
      });
    },
    async close() {
      await connection.close();
    },
  };
}

/**
 * De storekeuze zelf: één regel beleid, uit de configuratie en niet uit de
 * omgeving. `readConfigFromEnvironment` heeft `REDIS_URL` al gelezen; deze
 * functie kent `process.env` niet en is daarom ook in een test te sturen.
 *
 * @param {{ redisUrl?: string | null }} config
 * @param {{ onEvent?: ((event: object) => void) | null, connection?: object }} [options]
 * @returns {Promise<StoreHandle>}
 */
export async function createStoreHandle(config, options = {}) {
  const redisUrl = config?.redisUrl;
  if (typeof redisUrl === 'string' && redisUrl.length > 0) {
    return createRedisStoreHandle(redisUrl, options);
  }
  return createMemoryStoreHandle();
}


