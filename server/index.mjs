// server/index.mjs — het entrypoint van de game-server (AR5/AR6).
//
// Vervangt de dependency-vrije fase 1-placeholder. Wat dit bestand doet:
//   - env lezen (en ALLEEN hier: de compositielaag leest bewust geen env,
//     zie server/composition/context.mjs's tweede harde regel);
//   - de STORE KIEZEN op omgeving (`REDIS_URL` gezet → de Redis-adapter uit
//     server/data/adapters/redis/, anders de in-memory fake) en hem bij het
//     opstarten verbinden;
//   - de compositiecontext bouwen (store + echte klok + config);
//   - de REST-laag registreren (server/transport/rest.mjs);
//   - /healthz en /readyz bedienen; /readyz rapporteert sinds de storekeuze
//     ECHT: 200 zodra de gekozen store bereikbaar is, 503 met reden zo niet;
//   - client/, shared/, flags/ en frontend/ statisch serveren (antwoord op UI-3
//     in docs/integration-plan/transport-contract-response.md);
//   - de socketlaag aanhaken zodra server/transport/socket.mjs bestaat, en die
//     via een LAAT GEVULDE referentie beschikbaar maken voor de REST-laag —
//     `POST /games/join` moet room-breed een `room:player-changed` uitsturen en
//     dat kan alleen over de socket;
//   - die socketlaag in `preClose` weer afbreken, dus VOORDAT Fastify de
//     HTTP-server sluit: één open WebSocket zou anders `fastify.close()` (en
//     daarmee de SIGTERM-afhandeling) laten hangen — en daarná, in diezelfde
//     hook, de store sluiten.
//
// `buildServer(options)` bouwt de server ZONDER een poort te binden, zodat
// tests hem via Fastify's `inject` kunnen bevragen. Er wordt alleen echt
// geluisterd wanneer dit bestand direct wordt uitgevoerd.

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

import Fastify from 'fastify';

import { createContext } from './composition/context.mjs';
import restRoutes, { REST_PREFIX } from './transport/rest.mjs';
import { CONTENT_VERSION } from '../shared/content/index.mjs';
// CommonJS-interop: `module.exports = { createInMemoryStore }` wordt door
// Node's cjs-module-lexer herkend, dus een named import werkt (besluit 28).
import { createInMemoryStore } from './data/in-memory-store.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

/**
 * De statische mappings uit `transport-contract-response.md` §UI-3, plus
 * `frontend/` als root. Volgorde is betekenisvol: de twee expliciete prefixen
 * gaan vóór de root-catch-all.
 * @type {ReadonlyArray<{ urlPrefix: string, directory: string }>}
 */
const STATIC_MOUNTS = Object.freeze([
  { urlPrefix: '/client/', directory: path.join(REPO_ROOT, 'client') },
  { urlPrefix: '/shared/', directory: path.join(REPO_ROOT, 'shared') },
  // `flags/` staat in de repo-root, náást client/ en shared/ — niet eronder.
  // Zonder deze mapping geeft elke vlagafbeelding lokaal een 404 en is een
  // `flags_mc`-vraag onspeelbaar via `npm start`. Achter Caddy valt dat niet op
  // omdat de proxy die map zelf bedient; dat maakt het juist een stille bug.
  { urlPrefix: '/flags/', directory: path.join(REPO_ROOT, 'flags') },
]);

/** De root waaruit de app zelf wordt geserveerd (`/`, `/css/...`, deep links). */
const FRONTEND_ROOT = path.join(REPO_ROOT, 'frontend');

/**
 * Content-types voor de bestandssoorten die deze repo daadwerkelijk serveert.
 * Bewust een kleine, expliciete tabel in plaats van een mime-dependency —
 * "geen nieuwe dependencies" is een harde grens van deze stap.
 * @type {Readonly<Record<string, string>>}
 */
const CONTENT_TYPE_BY_EXTENSION = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
});

// ─────────────────────────────────────────────────────────────────────────────
// Configuratie uit de omgeving — de ENIGE plek in de server die env leest
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Leest de peppers voor sessietokens en de invite-index (besluit 26).
 *
 * Twee vormen, in volgorde van voorrang:
 *   1. `TOKEN_PEPPERS` — JSON `{"v1": "...", "v2": "..."}`, alle nog geldige
 *      versies tegelijk. Nodig voor een rotatie: `verifyToken` leest de versie
 *      uit de opgeslagen hash en zoekt hem hierin op.
 *   2. `TOKEN_PEPPER` — de enkele pepper die vandaag in `.env.example` en
 *      `docker-compose.yml` staat. Krijgt versie `TOKEN_PEPPER_VERSION`
 *      (default `v1`).
 *
 * Ontbreekt allebei, dan hangt het van `NODE_ENV` af: in productie is dat een
 * harde fout, daarbuiten wordt een vluchtige pepper gegenereerd zodat
 * `npm start` lokaal werkt. Die vluchtige pepper maakt bij elke herstart alle
 * bestaande sessietokens ongeldig — vandaar de waarschuwing.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {(line: string) => void} warn
 * @returns {{ version: string, peppers: Record<string, string> }}
 */
export function readTokenPeppers(env, warn) {
  const activeVersion = env.TOKEN_PEPPER_VERSION ?? 'v1';

  if (typeof env.TOKEN_PEPPERS === 'string' && env.TOKEN_PEPPERS.trim().length > 0) {
    let parsed;
    try {
      parsed = JSON.parse(env.TOKEN_PEPPERS);
    } catch {
      throw new Error('TOKEN_PEPPERS moet geldige JSON zijn: {"v1": "<pepper>", ...}');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('TOKEN_PEPPERS moet een JSON-object {versie: pepper} zijn.');
    }
    // Verdere keuring (lege map, ontbrekende actieve versie, te korte pepper)
    // doet createContext; niet hier dupliceren.
    return { version: activeVersion, peppers: parsed };
  }

  if (typeof env.TOKEN_PEPPER === 'string' && env.TOKEN_PEPPER.length > 0) {
    return { version: activeVersion, peppers: { [activeVersion]: env.TOKEN_PEPPER } };
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('TOKEN_PEPPER (of TOKEN_PEPPERS) is verplicht in productie — besluit 26.');
  }
  warn('TOKEN_PEPPER ontbreekt; er is een vluchtige ontwikkelpepper gegenereerd. Sessietokens overleven een herstart niet.');
  return { version: activeVersion, peppers: { [activeVersion]: randomBytes(32).toString('base64url') } };
}

/**
 * Bouwt de volledige serverconfiguratie uit de omgeving.
 *
 * `PUBLIC_APP_URL` is besluit 6: één configuratiewaarde waaruit `joinUrl`
 * wordt afgeleid. Hij staat nog niet in `.env.example`/`docker-compose.yml` —
 * zie het handoff-item. Lokaal valt hij terug op `http://localhost:${PORT}`
 * zodat `npm start` zonder env werkt; in productie is hij verplicht, want een
 * verkeerde `joinUrl` in een QR-code is niet achteraf te repareren.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {(line: string) => void} [warn]
 */
export function readConfigFromEnvironment(env = process.env, warn = () => {}) {
  const port = Number.parseInt(env.PORT ?? '3000', 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT moet een geldig poortnummer zijn, kreeg: ${JSON.stringify(env.PORT)}`);
  }

  let publicAppUrl = env.PUBLIC_APP_URL;
  if (typeof publicAppUrl !== 'string' || publicAppUrl.length === 0) {
    if (env.NODE_ENV === 'production') {
      throw new Error('PUBLIC_APP_URL is verplicht in productie — besluit 6 (joinUrl).');
    }
    publicAppUrl = `http://localhost:${port}`;
    warn(`PUBLIC_APP_URL ontbreekt; teruggevallen op ${publicAppUrl} (besluit 6).`);
  }

  // ── De storekeuze, als CONFIGURATIEWAARDE ────────────────────────────────
  //
  // `REDIS_URL` gezet → de persistente Redis-adapter; niet gezet → de
  // in-memory fake voor ontwikkeling. De KEUZE valt hier, want dit is de enige
  // plek die de omgeving leest; het BOUWEN gebeurt in `createStoreHandle()`
  // hieronder, omdat verbinden asynchroon is en deze functie dat niet is.
  //
  // Een lege of witruimte-string telt als "niet gezet". Dat is geen
  // toegeeflijkheid maar juist het tegenovergestelde: `REDIS_URL=` in een
  // .env-bestand is de vorm die iemand schrijft als hij hem uit wil zetten, en
  // een lege string zou anders verderop als onparsebare URL knallen met een
  // melding die niet uitlegt wat er aan de hand is.
  const rawRedisUrl = typeof env.REDIS_URL === 'string' ? env.REDIS_URL.trim() : '';
  const redisUrl = rawRedisUrl.length > 0 ? rawRedisUrl : null;
  if (redisUrl === null) {
    if (env.NODE_ENV === 'production') {
      // Stil terugvallen op de fake is hier de ergst denkbare uitkomst: de
      // server draait dan, lijkt gezond, en verliest elke room bij een
      // herstart zonder dat iemand het merkt.
      throw new Error('REDIS_URL is verplicht in productie — zonder persistente store overleeft geen enkele room een herstart.');
    }
    warn('REDIS_URL ontbreekt; de server gebruikt de in-memory store. Rooms, matches en scores overleven een herstart niet.');
  }

  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    publicAppUrl,
    redisUrl,
    tokenPeppers: readTokenPeppers(env, warn),
    // Besluit 21: canoniek en onveranderlijk op Match. Komt uit de gedeelde
    // contentmodule (besluit 29), niet uit env — een verkeerde versie in env
    // zou een verzonnen waarde in echte Match-documenten pinnen.
    contentVersion: CONTENT_VERSION,
  };
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Statische bestanden
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zet een URL-pad om naar een absoluut bestandspad binnen `rootDirectory`, of
 * `null` wanneer het pad daarbuiten zou uitkomen (path traversal, `%2e%2e`,
 * absolute paden, een NUL-byte).
 * @param {string} rootDirectory
 * @param {string} relativeUrlPath
 * @returns {string | null}
 */
export function resolveWithinRoot(rootDirectory, relativeUrlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(relativeUrlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) {
    return null;
  }
  const resolved = path.resolve(rootDirectory, `.${path.posix.sep}${decoded}`);
  const rootWithSeparator = rootDirectory.endsWith(path.sep) ? rootDirectory : rootDirectory + path.sep;
  if (resolved !== rootDirectory && !resolved.startsWith(rootWithSeparator)) {
    return null;
  }
  return resolved;
}

/**
 * Stuurt een bestand, of `false` wanneer het niet bestaat (dan mag de
 * aanroeper zijn eigen fallback kiezen).
 * @param {import('fastify').FastifyReply} reply
 * @param {string} absolutePath
 * @returns {Promise<boolean>}
 */
async function sendFile(reply, absolutePath) {
  let stats;
  try {
    stats = await stat(absolutePath);
  } catch {
    return false;
  }
  if (!stats.isFile()) {
    return false;
  }
  const contentType = CONTENT_TYPE_BY_EXTENSION[path.extname(absolutePath).toLowerCase()]
    ?? 'application/octet-stream';
  reply
    .header('content-type', contentType)
    .header('content-length', String(stats.size))
    .header('x-content-type-options', 'nosniff')
    .send(createReadStream(absolutePath));
  return true;
}

/**
 * Registreert `/client/*`, `/shared/*` en de `frontend/`-root.
 *
 * De root-catch-all valt terug op `frontend/index.html` voor paden zónder
 * bestandsextensie, zodat deep links als `/j/{inviteId}` en `/game/{code}`
 * werken (`transport-contract-response.md` §UI-3, tweede deel van de vraag:
 * `<base href="/">` + absolute paden).
 * @param {import('fastify').FastifyInstance} fastify
 */
function registerStaticRoutes(fastify) {
  for (const mount of STATIC_MOUNTS) {
    fastify.get(`${mount.urlPrefix}*`, async (request, reply) => {
      const absolutePath = resolveWithinRoot(mount.directory, request.params['*'] ?? '');
      if (absolutePath === null || !(await sendFile(reply, absolutePath))) {
        return reply.code(404).send({ code: 'GAME_NOT_FOUND', meta: {} });
      }
      return reply;
    });
  }

  fastify.get('/*', async (request, reply) => {
    const requestPath = request.params['*'] ?? '';

    // Een onbekend API- of socketpad is nooit een statisch bestand en mag ook
    // niet stilletjes de SPA-shell krijgen: dan zou een client HTML als JSON
    // proberen te lezen. De REST-plugin heeft zijn eigen 404 voor /api/v1/**;
    // dit dekt de rest.
    if (requestPath.startsWith('api/') || requestPath.startsWith('socket.io/')) {
      return reply.code(404).send({ code: 'GAME_NOT_FOUND', meta: {} });
    }

    const absolutePath = resolveWithinRoot(FRONTEND_ROOT, requestPath);
    if (absolutePath !== null && await sendFile(reply, absolutePath)) {
      return reply;
    }
    // SPA-fallback: alleen voor extensieloze paden. Een ontbrekende `.js` of
    // `.png` hoort een eerlijke 404 te zijn, geen HTML-pagina.
    if (path.extname(requestPath) === '' && await sendFile(reply, path.join(FRONTEND_ROOT, 'index.html'))) {
      return reply;
    }
    return reply.code(404).send({ code: 'GAME_NOT_FOUND', meta: {} });
  });

  fastify.get('/', async (request, reply) => {
    if (await sendFile(reply, path.join(FRONTEND_ROOT, 'index.html'))) {
      return reply;
    }
    return reply.code(404).send({ code: 'GAME_NOT_FOUND', meta: {} });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Socketlaag — gebouwd door een andere agent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   close: () => Promise<void>,
 *   broadcastPlayerChanged?: (roomId: string, delta: { type: string, playerId: string }) => Promise<void>,
 *   sendSnapshot?: (roomId: string, sessionId: string) => Promise<{ ok: boolean }>,
 * }} SocketHandle
 */

/**
 * Haakt `server/transport/socket.mjs` aan wanneer dat bestand bestaat.
 *
 * Gereserveerde vorm (afgesproken met de socket-agent):
 *
 *   attachSocketServer(httpServer, { context, config }) → { close(): Promise<void> }
 *
 * Bestaat het bestand nog niet, dan gebeurt er niets — de REST-laag draait
 * zelfstandig. Alleen een ontbrekende module wordt geslikt; een module die
 * bestaat maar bij het laden stukgaat moet zichtbaar falen.
 *
 * @param {import('node:http').Server} httpServer
 * @param {{ context: object, config: object }} params
 * @returns {Promise<SocketHandle | null>}
 */
export async function attachSocketsIfAvailable(httpServer, { context, config }) {
  let module;
  try {
    module = await import('./transport/socket.mjs');
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      return null;
    }
    throw error;
  }
  if (typeof module.attachSocketServer !== 'function') {
    throw new TypeError('server/transport/socket.mjs bestaat maar exporteert geen attachSocketServer(httpServer, { context, config }).');
  }
  return module.attachSocketServer(httpServer, { context, config });
}

// ─────────────────────────────────────────────────────────────────────────────
// De server
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bouwt de Fastify-server. Bindt GEEN poort — dat doet `start()`.
 *
 * EIGENAARSCHAP VAN DE STORE. Geeft de aanroeper een `store` (of een compleet
 * `storeHandle`) mee, dan blijft die van hem: `preClose` sluit hem niet. Bouwt
 * deze functie hem zelf uit `config.redisUrl`, dan is hij van de server en gaat
 * hij in `preClose` mee dicht. Een store die twee eigenaren heeft, wordt
 * gegarandeerd één keer te vaak of één keer te weinig gesloten.
 *
 * @param {{
 *   config?: object,
 *   store?: object,
 *   storeHandle?: StoreHandle,
 *   storeOptions?: object,
 *   now?: () => number,
 *   logger?: boolean | object,
 *   attachSockets?: boolean,
 * }} [options]
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
export async function buildServer(options = {}) {
  const {
    config = readConfigFromEnvironment(),
    store,
    storeHandle,
    storeOptions = {},
    now = () => Date.now(),
    logger = false,
    attachSockets = false,
  } = options;

  /** Alleen een door ONS gebouwd handle wordt door ons gesloten. */
  const ownsStore = storeHandle === undefined && store === undefined;
  const handle = storeHandle
    ?? (store === undefined ? await createStoreHandle(config, storeOptions) : createMemoryStoreHandle(store));

  let context;
  try {
    context = createContext({
      store: handle.store,
      now,
      config: {
        tokenPeppers: config.tokenPeppers,
        publicAppUrl: config.publicAppUrl,
        contentVersion: config.contentVersion ?? CONTENT_VERSION,
      },
    });
  } catch (error) {
    // Een verbinding die we net hebben opgezet mag niet als weeskind achter
    // blijven wanneer de bouw hierna alsnog struikelt: de socket zou het proces
    // openhouden en `npm start` zou noch starten noch afsluiten.
    if (ownsStore) await handle.close().catch(() => {});
    throw error;
  }

  const fastify = Fastify({ logger });
  fastify.decorate('appContext', context);
  fastify.decorate('appConfig', config);
  fastify.decorate('appStore', handle);

  // ── De brug tussen REST en de socketlaag ───────────────────────────────────
  //
  // `POST /games/join` en `POST /{code}/leave` lopen over HTTP, maar
  // `room:player-changed` moet room-breed over de SOCKET. Zonder deze brug ziet
  // een lobby een nieuwe speler nooit binnenkomen — `socket.mjs` exporteert
  // `broadcastPlayerChanged` juist daarvoor.
  //
  // VOLGORDEPROBLEEM: de socketlaag kan pas worden aangehaakt als
  // `fastify.server` bestaat, en dat is ná `ready()` — dus ná de registratie van
  // de REST-plugin. Het handle bestaat op registratiemoment dus nog niet.
  // Daarom een LAAT GEVULDE referentie plus een getter: de REST-laag vraagt het
  // handle pas op op het moment dat hij het gebruikt (per request), niet bij
  // registratie. Een kopie van de waarde meegeven zou hier voor altijd `null`
  // vastleggen — bedrading die stil niets doet.
  /** @type {{ current: SocketHandle | null }} */
  const socketsRef = { current: null };
  const getSockets = () => socketsRef.current;

  // /healthz — ongewijzigd t.o.v. de placeholder: 200 zolang het proces leeft.
  fastify.get('/healthz', async () => ({ ok: true }));

  // /readyz — rapporteert nu ECHT. 200 zodra de gekozen store bereikbaar is,
  // 503 met een bruikbare reden als dat niet zo is. Bij de in-memory store is
  // dat triviaal waar; bij Redis wordt het per verzoek vastgesteld met een
  // PING, mét deadline (zie `withDeadline`).
  //
  // Het antwoord noemt `store` zodat één blik op /readyz laat zien of deze
  // server op de persistente store of op de ontwikkelfake draait — dat is
  // precies de verwarring die een stille terugval zou veroorzaken.
  fastify.get('/readyz', async (request, reply) => {
    const readiness = await handle.checkReady();
    if (readiness.ok) {
      return reply.code(200).send({ ok: true, store: handle.kind });
    }
    return reply.code(503).send({
      ok: false,
      store: handle.kind,
      reason: readiness.reason ?? 'de store is niet bereikbaar',
    });
  });

  await fastify.register(restRoutes, { context, prefix: REST_PREFIX, getSockets });

  registerStaticRoutes(fastify);

  // `preClose`, NIET `onClose`. Fastify's afsluitvolgorde is:
  //   preClose-hooks → HTTP-server sluiten → onClose-hooks.
  // Een open WebSocket houdt de HTTP-server open, dus als de socketteardown
  // pas in `onClose` draait, blijft `fastify.close()` hangen op precies de
  // verbindingen die die teardown had moeten verbreken. Dat is hetzelfde pad
  // als de SIGTERM-handler in `start()`, dus dan werkt graceful shutdown niet
  // — `docker compose down` wacht tot zijn timeout en elke herstart hangt.
  // In `preClose` zijn de sockets al weg voordat de HTTP-server dichtgaat.
  //
  // De hook moet vóór `ready()` geregistreerd zijn (daarna weigert Fastify
  // nieuwe hooks), en op dat moment bestaat het sockethandle nog niet. Vandaar
  // de holder: de hook leest hem pas bij het afsluiten.
  //
  // DE VOLGORDE BINNEN DE HOOK IS SOCKETS EERST, DAN DE STORE. Andersom sluit
  // de store terwijl er nog verbindingen open zijn die er een commando naartoe
  // kunnen sturen; dat commando faalt dan op een gesloten verbinding en de hook
  // blijft eraan hangen — precies de graceful shutdown die hierboven net is
  // gerepareerd. Beide stappen zijn hun eigen `try`: een sockethandle dat
  // struikelt mag de store niet open laten staan.
  fastify.addHook('preClose', async () => {
    try {
      if (socketsRef.current !== null) {
        await socketsRef.current.close();
      }
    } finally {
      if (ownsStore) {
        await handle.close();
      }
    }
  });

  if (attachSockets) {
    await fastify.ready();
    socketsRef.current = await attachSocketsIfAvailable(fastify.server, { context, config });
  }

  return fastify;
}

/** Gestructureerde JSON-logregel zonder persoonsgegevens (zoals de placeholder). */
function log(level, msg, extra = {}) {
  process.stdout.write(`${JSON.stringify({ t: Date.now(), level, msg, ...extra })}\n`);
}

/** Start de server echt: env lezen, bouwen, luisteren, signalen afvangen. */
async function start() {
  const config = readConfigFromEnvironment(process.env, (line) => log('warn', line));
  const fastify = await buildServer({ config, attachSockets: true });

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      log('info', 'afsluiten', { signal });
      fastify.close().then(() => process.exit(0), () => process.exit(1));
    });
  }

  await fastify.listen({ port: config.port, host: config.host });
  // `describe()` van de Redis-verbinding is per constructie credential-vrij
  // (alleen protocol, host en poort), dus dit is veilig om te loggen — en het
  // is de regel waaraan je ziet of deze server op de persistente store draait.
  log('info', 'game-server gestart', { port: config.port, store: fastify.appStore.describe() });
}

// Alleen starten wanneer dit bestand direct wordt uitgevoerd — een import
// (test, tooling) mag nooit een poort binden.
const isDirectRun = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  start().catch((error) => {
    log('error', 'opstarten mislukt', { reason: error?.message ?? 'onbekend' });
    process.exit(1);
  });
}
