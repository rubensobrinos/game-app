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

import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import Fastify from 'fastify';

import { createContext } from './composition/context.mjs';
import { recoverActiveRooms } from './composition/match-lifecycle.mjs';
import { NOOP_METRICS, createMetrics } from './transport/metrics.mjs';
import restRoutes, { REST_PREFIX } from './transport/rest.mjs';
import {
  createSafeLogger,
  errorLabel,
  safeFastifyOptions,
  withSafeSerializers,
} from './transport/safe-logger.mjs';
import { CONTENT_VERSION } from '../shared/content/index.mjs';
import { nameWordLists } from './data/name-word-lists.js';
import {
  readTokenPeppers,
  readConfigFromEnvironment,
  readMetricsSecret,
} from './environment.mjs';
import {
  createMemoryStoreHandle,
  createRedisStoreHandle,
  createStoreHandle,
} from './store-handle.mjs';
import { resolveWithinRoot, registerStaticRoutes } from './static-files.mjs';
import { attachSocketsIfAvailable } from './socket-handle.mjs';

export {
  readTokenPeppers,
  readConfigFromEnvironment,
  readMetricsSecret,
  createMemoryStoreHandle,
  createRedisStoreHandle,
  createStoreHandle,
  resolveWithinRoot,
  attachSocketsIfAvailable,
};

/**
 * @typedef {{
 *   kind: 'memory' | 'redis', store: object, describe: () => object,
 *   checkReady: () => Promise<{ ok: boolean, reason?: string }>,
 *   close: () => Promise<void>,
 * }} StoreHandle
 * @typedef {{
 *   close: () => Promise<void>,
 *   broadcastPlayerChanged?: (roomId: string, delta: { type: string, playerId: string }) => Promise<void>,
 *   sendSnapshot?: (roomId: string, sessionId: string) => Promise<{ ok: boolean }>,
 * }} SocketHandle
 */

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
  // Eén register per proces. Zonder geconfigureerd secret bestaat `/metrics`
  // niet en heeft meten geen afnemer — dan blijft het de NOOP-variant, zodat
  // er ook geen tellerwerk op het hete antwoordpad staat.
  const metrics = config.metricsSecret ? createMetrics() : NOOP_METRICS;
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
        // Stap 1, spelersidentiteit.md: zonder dit viel generateName() altijd
        // terug op "Speler {n}" — de woordenlijst zelf is contentbeslissing,
        // niet iets wat deze module kiest (zie name-word-lists.js/bevinding 14).
        nameWordLists: config.nameWordLists ?? nameWordLists,
      },
    });
  } catch (error) {
    // Een verbinding die we net hebben opgezet mag niet als weeskind achter
    // blijven wanneer de bouw hierna alsnog struikelt: de socket zou het proces
    // openhouden en `npm start` zou noch starten noch afsluiten.
    if (ownsStore) await handle.close().catch(() => {});
    throw error;
  }

  // FASTIFY'S EIGEN LOGGER MAG DE PRIVACYREGELS NIET OMZEILEN (INT4a deel 5).
  //
  // Dit is de gevaarlijkste logweg, want er komt geen regel code van ons aan te
  // pas: Pino serialiseert een `req` standaard mét `headers` (inclusief
  // `Authorization`) en `remoteAddress`, en een `err` mét `message` en `stack`.
  // Een veilige applicatielog is waardeloos als de automatische requestlogging
  // daar een IP of een token naast zet. Vandaar allebei:
  //   - `safeFastifyOptions()` haalt de per-verzoek-regels weg via Fastify's
  //     `logController`;
  //   - `withSafeSerializers` vervangt de `req`/`res`/`err`-serializers door
  //     versies die een NIEUW object bouwen met alleen wat veilig is, voor het
  //     geval Fastify tóch iets logt (bijvoorbeeld via zijn eigen
  //     foutafhandeling op de statische routes).
  const fastify = Fastify({ ...safeFastifyOptions(), logger: withSafeSerializers(logger) });

  /** De lifecyclelogs van dit bestand: dezelfde allowlist, `layer: 'server'`. */
  const logServer = createSafeLogger({ logger: fastify.log, layer: 'server' });
  fastify.decorate('appContext', context);
  fastify.decorate('appConfig', config);
  fastify.decorate('appStore', handle);
  // Zodat een testharnas dezelfde teller kan doorgeven aan de socketlaag die
  // hij zelf aanhaakt — in productie doet `buildServer` dat verderop zelf.
  fastify.decorate('appMetrics', metrics);

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

  // ── /metrics (stap 9, INT4b) ────────────────────────────────────────────
  //
  // Bestaat ALLEEN met een geconfigureerd secret; zonder secret is er geen
  // route en geeft het pad de gewone 404. Authenticatie met een eigen bearer,
  // constant-time vergeleken — een naïeve `===` lekt via de vergelijkingstijd
  // hoeveel tekens er kloppen.
  //
  // De reverse proxy hoort publiek verkeer naar dit pad daarnaast te blokkeren;
  // deze server vertrouwt daar niet op.
  {
    const verwacht = config.metricsSecret ? Buffer.from(`Bearer ${config.metricsSecret}`) : null;
    fastify.get('/metrics', async (request, reply) => {
      // Zonder secret bestaat dit endpoint niet. Bewust een expliciete 404 en
      // geen ontbrekende route: de statische fallback serveert onbekende paden
      // met 200, dus "niet registreren" zou hier juist géén 404 opleveren.
      if (verwacht === null) {
        return reply.code(404).send({ ok: false });
      }
      const aangeboden = Buffer.from(String(request.headers.authorization ?? ''));
      const gelijk =
        aangeboden.length === verwacht.length && timingSafeEqual(aangeboden, verwacht);
      if (!gelijk) {
        return reply.code(401).send({ ok: false });
      }
      return reply
        .code(200)
        .header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
        .send(metrics.render());
    });
  }

  await fastify.register(restRoutes, { context, prefix: REST_PREFIX, getSockets, metrics });

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

  // C-3 (5 aug 2026, ARCHITECTURE §10): rooms die midden in een potje zaten
  // toen dit proces omviel, staan nog gewoon in de store — maar hun timers en
  // verbindingen zijn weg. Zet ze op PAUSED(server_recovery) zodat de host ze
  // met een verse aftelling kan hervatten, in plaats van naar een bevroren
  // scherm te kijken.
  //
  // Vóór de socketlaag: een client die meteen na de herstart verbindt, moet de
  // pauze al in zijn snapshot zien in plaats van een fase die niemand meer
  // vooruit zet. Mislukt het herstel, dan start de server gewoon door — een
  // niet-herstelde room is hinderlijk, een server die niet opkomt is erger.
  try {
    const recovered = await recoverActiveRooms(context);
    metrics.increment('rounda_recovery_attempts_total', { outcome: recovered.ok ? 'ok' : 'failed' });
    if (!recovered.ok) {
      logServer('error', 'herstel na serverstart mislukt', { store: handle.kind });
    } else if (recovered.value.recovered > 0) {
      // Alleen loggen als er écht iets hersteld is. Een lege store bij elke
      // start een regel laten schrijven begraaft precies het signaal waar het
      // hier om gaat: dat er een potje is onderbroken.
      logServer('warn', 'herstel na serverstart', {
        scanned: recovered.value.scanned,
        recovered: recovered.value.recovered,
        store: handle.kind,
      });
    }
  } catch {
    logServer('error', 'herstel na serverstart wierp een fout', { store: handle.kind });
  }

  if (attachSockets) {
    await fastify.ready();
    // De socketlaag krijgt DEZELFDE logsink als Fastify. Zonder deze regel
    // draaide `attachSocketServer` in productie op zijn stille NOOP_LOGGER —
    // achttien `logSafe()`-aanroepen die nergens uitkwamen.
    socketsRef.current = await attachSocketsIfAvailable(fastify.server, {
      context,
      config: { ...config, logger: fastify.log, metrics },
    });
    logServer('info', 'socketlaag aangehaakt', { store: handle.kind });
  }

  return fastify;
}
/**
 * De sink voor de opstart-/afsluitregels: gestructureerde JSON naar stdout.
 *
 * Deze regels vallen buiten Fastify — ze worden geschreven vóórdat de server
 * bestaat (de env-waarschuwingen) en tijdens het afsluiten. De vorm is bewust
 * dezelfde `(fields, message)`-vorm die Pino gebruikt, zodat er precies één
 * formatter over blijft: `createSafeLogger` hieronder.
 * @type {{ info: Function, warn: Function, error: Function }}
 */
const STDOUT_LOGGER = Object.freeze({
  info: (fields, msg) => writeLine('info', msg, fields),
  warn: (fields, msg) => writeLine('warn', msg, fields),
  error: (fields, msg) => writeLine('error', msg, fields),
});

function writeLine(level, msg, fields) {
  process.stdout.write(`${JSON.stringify({ t: Date.now(), level, msg, ...fields })}\n`);
}

/**
 * De lifecyclelogs van het entrypoint. Gaat door dezelfde allowlist als REST en
 * socket: `layer: 'server'`, en velden die de vormtoets niet halen worden
 * vervangen in plaats van doorgegeven. Dat is niet theoretisch — het is precies
 * wat voorkomt dat een `error.message` uit een mislukte Redis-verbinding (die
 * de URL kan bevatten) in een logregel belandt.
 */
const log = createSafeLogger({ logger: STDOUT_LOGGER, layer: 'server' });

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
  // `describe().endpoint` van de Redis-verbinding is per constructie
  // credential-vrij (alleen protocol, host en poort — `redactEndpoint()`), dus
  // dit is veilig om te loggen; het is bovendien ONZE infrastructuur en nooit
  // het adres van een speler, waar de "geen IP in applicatielogs"-regel over
  // gaat. Samen met `store` is dit de regel waaraan je ziet of deze server op
  // de persistente store draait.
  log('info', 'game-server gestart', {
    port: config.port,
    store: fastify.appStore.kind,
    endpoint: fastify.appStore.describe().endpoint,
  });
}

// Alleen starten wanneer dit bestand direct wordt uitgevoerd — een import
// (test, tooling) mag nooit een poort binden.
const isDirectRun = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  start().catch((error) => {
    // De APPLICATIELOGREGEL draagt alleen de stabiele foutklasse: `reason` gaat
    // door dezelfde allowlist als al het andere en een `error.message` haalt die
    // vormtoets niet — een mislukte Redis-verbinding zou er anders zijn URL in
    // kunnen zetten. De onbewerkte melding gaat naar STDERR en niet naar het
    // applicatielog: dit is het opstartpad, er is nog geen enkele speler en
    // geen enkel verzoek, en een deploy die niet start moet wél te diagnosticeren
    // blijven.
    log('error', 'opstarten mislukt', { reason: errorLabel(error) });
    process.stderr.write(`${error?.message ?? String(error)}\n`);
    process.exit(1);
  });
}
