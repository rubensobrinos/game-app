// server/index.mjs — het entrypoint van de game-server (AR5/AR6).
//
// Vervangt de dependency-vrije fase 1-placeholder. Wat dit bestand doet:
//   - env lezen (en ALLEEN hier: de compositielaag leest bewust geen env,
//     zie server/composition/context.mjs's tweede harde regel);
//   - de compositiecontext bouwen (store + echte klok + config);
//   - de REST-laag registreren (server/transport/rest.mjs);
//   - /healthz en /readyz bedienen, met hetzelfde contract als de placeholder;
//   - client/, shared/ en frontend/ statisch serveren (antwoord op UI-3 in
//     docs/integration-plan/transport-contract-response.md);
//   - de socketlaag aanhaken zodra server/transport/socket.mjs bestaat, en die
//     via een LAAT GEVULDE referentie beschikbaar maken voor de REST-laag —
//     `POST /games/join` moet room-breed een `room:player-changed` uitsturen en
//     dat kan alleen over de socket;
//   - die socketlaag in `preClose` weer afbreken, dus VOORDAT Fastify de
//     HTTP-server sluit: één open WebSocket zou anders `fastify.close()` (en
//     daarmee de SIGTERM-afhandeling) laten hangen.
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

  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    publicAppUrl,
    tokenPeppers: readTokenPeppers(env, warn),
    // Besluit 21: canoniek en onveranderlijk op Match. Komt uit de gedeelde
    // contentmodule (besluit 29), niet uit env — een verkeerde versie in env
    // zou een verzonnen waarde in echte Match-documenten pinnen.
    contentVersion: CONTENT_VERSION,
  };
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
 * @param {{
 *   config?: object,
 *   store?: object,
 *   now?: () => number,
 *   logger?: boolean | object,
 *   attachSockets?: boolean,
 * }} [options]
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
export async function buildServer(options = {}) {
  const {
    config = readConfigFromEnvironment(),
    store = createInMemoryStore(),
    now = () => Date.now(),
    logger = false,
    attachSockets = false,
  } = options;

  const context = createContext({
    store,
    now,
    config: {
      tokenPeppers: config.tokenPeppers,
      publicAppUrl: config.publicAppUrl,
      contentVersion: config.contentVersion ?? CONTENT_VERSION,
    },
  });

  const fastify = Fastify({ logger });
  fastify.decorate('appContext', context);
  fastify.decorate('appConfig', config);

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

  // /readyz — blijft 503 met reden. Er hangt nog geen Redis onder; dat komt in
  // stap 3 (INT-B). Bewust nog niet groen laten worden: een readiness-check die
  // liegt is erger dan geen readiness-check.
  fastify.get('/readyz', async (request, reply) => reply.code(503).send({
    ok: false,
    reason: 'geen Redis-verbinding: de persistente store komt in stap 3 (INT-B)',
  }));

  await fastify.register(restRoutes, { context, prefix: REST_PREFIX, getSockets });

  registerStaticRoutes(fastify);

  if (attachSockets) {
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
    // nieuwe hooks), en op dat moment bestaat het handle nog niet. Vandaar de
    // holder: de hook leest hem pas bij het afsluiten.
    fastify.addHook('preClose', async () => {
      if (socketsRef.current !== null) {
        await socketsRef.current.close();
      }
    });
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
  log('info', 'game-server gestart', { port: config.port });
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
