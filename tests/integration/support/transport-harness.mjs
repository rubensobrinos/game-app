// tests/integration/support/transport-harness.mjs
//
// Start de ECHTE server uit `server/index.mjs` op een echte, vrije poort
// (`listen(0)`) en levert de twee ingangen die de transport-ketentest nodig
// heeft: `request()` over echt HTTP (`fetch`) en `connect()` over een echte
// WebSocket (`socket-io-test-client.mjs`).
//
// GEEN PRODUCTIECODE-WIJZIGING, GEEN TWEEDE SERVEROPBOUW. De bedrading
// hieronder is letterlijk die van `start()` in `server/index.mjs`:
// `readConfigFromEnvironment` → `buildServer` → `listen` →
// `attachSocketsIfAvailable`. Twee verschillen, beide bewust:
//
//   1. `buildServer({ attachSockets: false })` + een eigen aanroep van
//      `attachSocketsIfAvailable`. Dat is nodig omdat `buildServer` het
//      socket-handle in een lokale variabele houdt en niet teruggeeft; zonder
//      deze omweg is `sendSnapshot()` (het socketpad naar een snapshot) van
//      buiten niet bereikbaar. Zie het gat in de opleverbrief: in productie
//      roept niets `sendSnapshot`/`broadcastPlayerChanged` aan.
//   2. Een geïnjecteerde klok (`now`) en een handmatige scheduler
//      (`config.scheduler`, de injectiepunten die `attachSocketServer` zelf al
//      aanbiedt). Zonder die twee zou elke ronde 15 echte seconden duren en
//      zou elke assertie een wall-clock-race zijn. Het NETWERK blijft echt: de
//      klok bepaalt alleen wanneer een servertimer afgaat, niet hoe bytes over
//      de lijn gaan.
//
// ─────────────────────────────────────────────────────────────────────────────
// DEZELFDE KETEN, MAAR DAN OP REDIS
// ─────────────────────────────────────────────────────────────────────────────
//
// Staat `REDIS_URL` in de omgeving van de testrun, dan geeft deze harness hem
// door aan `readConfigFromEnvironment` en bouwt `buildServer` de ECHTE
// Redis-store — precies het pad dat productie loopt. Zonder `REDIS_URL` blijft
// alles bij de in-memory fake, dus `npm test` verandert niet en heeft geen
// draaiende Redis nodig.
//
// DRIE VOORZORGEN, alle drie omdat een test die de verkeerde Redis raakt geen
// testfout is maar een incident:
//
//   1. `assertTestInstance()` uit `server/data/adapters/redis/test-redis.mjs`
//      keurt de URL: alleen `redis://127.0.0.1:6380`, zonder credentials. Op
//      6379 draait de PRODUCTIE-instantie en die is verboden terrein. Een
//      verkeerd gezette `REDIS_URL` laat de test dus falen, niet slagen op de
//      verkeerde database.
//   2. Een EIGEN DATABASE-INDEX, 1..7 uit de PID. `test-redis.mjs` deelt 8..15
//      uit aan de adaptertests; die twee bereiken kunnen daardoor niet
//      overlappen, hoe de testrunner de bestanden ook parallelliseert.
//   3. Een `FLUSHDB` van díé index bij het afsluiten, plus het advisory slot
//      (`acquireRedisTestLock`) zolang de harness draait. Zonder het slot kan
//      een ander Redis-schrijvend testbestand midden in deze run zijn eigen
//      database wegflushen of — erger, zie `aof-restart.test.mjs` — de server
//      herstarten.

import assert from 'node:assert/strict';

import {
  attachSocketsIfAvailable,
  buildServer,
  readConfigFromEnvironment,
} from '../../../server/index.mjs';
import { createInMemoryStore } from '../../../server/data/in-memory-store.js';
import { createRedisConnection } from '../../../server/data/adapters/redis/connection.mjs';
import { acquireRedisTestLock, assertTestInstance } from '../../../server/data/adapters/redis/test-redis.mjs';

import { APP_URL, PEPPER, makeClock } from './composition-harness.mjs';
import { createTestClient } from './socket-io-test-client.mjs';

/**
 * De database-index van DEZE testrun: 1..7 uit de PID, bewust disjunct van de
 * 8..15 die `test-redis.mjs` aan de adaptertests uitdeelt, en nooit 0 (daar kan
 * iemand handmatig in rommelen en die wordt hier geflusht).
 */
export const HARNESS_REDIS_DATABASE = 1 + (process.pid % 7);

/**
 * Plakt de database-index aan de URL wanneer die er nog geen heeft. node-redis
 * leest het pad van een `redis://`-URL als database-index; dat is de enige weg,
 * want `readConfigFromEnvironment` leest bewust maar één omgevingsvariabele
 * voor de store.
 * @param {string} rawUrl
 * @param {number} database
 * @returns {string}
 */
export function withTestDatabase(rawUrl, database = HARNESS_REDIS_DATABASE) {
  const parsed = new URL(assertTestInstance(rawUrl));
  if (parsed.pathname === '' || parsed.pathname === '/') {
    parsed.pathname = `/${database}`;
  }
  if (parsed.pathname === '/0') {
    throw new Error('WEIGERING: de transport-harness flusht zijn database en mag daarom nooit op db 0 draaien.');
  }
  return parsed.toString();
}

/**
 * Leegt de database uit `url` — en alleen die. `FLUSHDB` werkt per geselecteerde
 * index, en `withTestDatabase()` heeft er hierboven al voor gezorgd dat die
 * index niet 0 is en dat de host de wegwerpinstantie is.
 * @param {string} url
 */
async function flushTestDatabase(url) {
  const connection = createRedisConnection({
    url,
    connectTimeoutMs: 1000,
    maxReconnectAttempts: 0,
    closeGracePeriodMs: 500,
  });
  try {
    await connection.connect();
    await connection.getClient().flushDb();
  } finally {
    await connection.close();
  }
}

/**
 * Scheduler die niets vanzelf laat lopen: de test bepaalt wanneer een geplande
 * fasewissel afgaat. Zelfde vorm als in `server/transport/socket.test.mjs`.
 */
export function makeManualScheduler() {
  const timers = new Map();
  let sequence = 0;
  return {
    setTimer(delayMs, fn) {
      const id = ++sequence;
      timers.set(id, fn);
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    /**
     * Vuurt alle op dit moment geplande timers precies één keer af en WACHT op
     * de afhandeling — `scheduleAt()` in socket.mjs geeft de promise van de
     * fasewissel terug juist zodat een testscheduler dat kan.
     */
    async fireAll() {
      const pending = [...timers.values()];
      timers.clear();
      for (const fn of pending) {
        await fn();
      }
    },
    get pending() {
      return timers.size;
    },
  };
}

/**
 * Start server + socketlaag en ruimt alles op in `t.after`.
 *
 * @param {import('node:test').TestContext} t
 * @param {{
 *   startAt?: number,
 *   redisUrl?: string | null,
 *   acquireLock?: boolean,
 *   cleanupRedis?: boolean,
 * }} [options] - `redisUrl` overschrijft `process.env.REDIS_URL`; `null`
 *   dwingt de in-memory store af. `acquireLock: false` is voor een aanroeper
 *   die het testredis-slot al vasthoudt (bijvoorbeeld omdat hij twee servers
 *   ná elkaar op dezelfde database zet). `cleanupRedis: false` laat de
 *   database staan — nodig voor precies dat herstartscenario, waar de tweede
 *   server de gegevens van de eerste moet terugvinden.
 */
export async function startTransportServer(t, {
  startAt,
  redisUrl = process.env.REDIS_URL ?? null,
  acquireLock = true,
  cleanupRedis = true,
  metricsSecret = null,
} = {}) {
  const clock = makeClock(startAt);
  const scheduler = makeManualScheduler();

  const storeUrl = typeof redisUrl === 'string' && redisUrl.trim().length > 0
    ? withTestDatabase(redisUrl.trim())
    : null;

  // Het slot vóór de eerste verbinding, precies zoals `test-redis.mjs` het
  // voorschrijft — en alleen wanneer er ook echt naar Redis geschreven wordt.
  const releaseLock = storeUrl !== null && acquireLock
    ? await acquireRedisTestLock({ label: 'transport-harness' })
    : null;

  // De echte env-lezer, met een expliciete omgeving in plaats van process.env:
  // dit is de configuratieweg die productie ook loopt (peppers, publicAppUrl,
  // contentVersion uit shared/content, en sinds stap 3 de storekeuze).
  const config = readConfigFromEnvironment({
    PORT: '0',
    HOST: '127.0.0.1',
    PUBLIC_APP_URL: APP_URL,
    TOKEN_PEPPER: PEPPER,
    NODE_ENV: 'test',
    ...(storeUrl === null ? {} : { REDIS_URL: storeUrl }),
    // Stap 9: zonder secret bestaat `/metrics` niet — precies wat de
    // afschermingstest moet kunnen aantonen.
    ...(metricsSecret === null ? {} : { METRICS_SECRET: metricsSecret }),
  });

  // Bij Redis wordt er GEEN store meegegeven: `buildServer` bouwt hem dan zelf
  // uit `config.redisUrl` en sluit hem in zijn eigen `preClose`. Dat is het
  // productiepad; een hier gebouwde store zou juist die bedrading overslaan.
  const fastify = await buildServer({
    config,
    ...(storeUrl === null ? { store: createInMemoryStore() } : {}),
    now: clock.now,
    attachSockets: false,
  }).catch(async (error) => {
    await releaseLock?.();
    throw error;
  });
  const store = fastify.appStore.store;
  await fastify.listen({ port: 0, host: '127.0.0.1' });
  const { port } = fastify.server.address();

  const attached = await attachSocketsIfAvailable(fastify.server, {
    context: fastify.appContext,
    config: { ...config, scheduler, metrics: fastify.appMetrics },
  });
  assert.notEqual(attached, null, 'server/transport/socket.mjs hoort aangehaakt te worden');

  const baseUrl = `http://127.0.0.1:${port}`;

  /**
   * Elke HTTP-uitwisseling die deze test doet, in volgorde. Voedt twee
   * verplichte asserties: "geen interne foutcode over de wire" (de bodies) en
   * "geen token in een URL" (de paden).
   * @type {Array<{ method: string, path: string, status: number, body: unknown }>}
   */
  const exchanges = [];

  /** @type {Array<{ close(): void, handshakeUrl: string, received: unknown[] }>} */
  const clients = [];

  /**
   * Doet één echt HTTP-verzoek. Het sessietoken gaat UITSLUITEND in de
   * `Authorization`-header mee; deze functie kent geen weg om het in een pad of
   * querystring te zetten (PROTOCOL.md Basisregel 3).
   *
   * @param {string} method
   * @param {string} path - pad inclusief eventuele querystring
   * @param {{ token?: string | null, body?: unknown, authorization?: string }} [options]
   * @returns {Promise<{ status: number, body: unknown, headers: Headers }>}
   */
  async function request(method, path, { token = null, body, authorization } = {}) {
    /** @type {Record<string, string>} */
    const headers = {};
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (authorization !== undefined) {
      headers.authorization = authorization;
    } else if (token !== null) {
      headers.authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let parsed = text;
    try {
      parsed = text.length === 0 ? null : JSON.parse(text);
    } catch {
      // Geen JSON: de rauwe tekst blijft staan, zodat een HTML-foutpagina of
      // stacktrace ook door de lekcontrole heen gaat.
    }
    exchanges.push({ method, path, status: response.status, body: parsed });
    return { status: response.status, body: parsed, headers: response.headers };
  }

  let closed = false;

  /**
   * Sluit alles af in de enige volgorde die werkt: clients, dan de socketlaag,
   * dan de HTTP-server (die in zijn `preClose` de store meeneemt), en pas als
   * álles los is de database leeg en het slot terug. Idempotent, zodat een
   * expliciete `close()` en de `t.after` elkaar niet in de weg zitten.
   */
  async function close() {
    if (closed) return;
    closed = true;
    try {
      for (const client of clients) {
        client.close();
      }
      await attached.close();
      // `fetch` houdt keep-alive-verbindingen open; zonder dit blijft de server
      // hangen op `close()`.
      fastify.server.closeAllConnections();
      await fastify.close();
      if (storeUrl !== null && cleanupRedis) {
        await flushTestDatabase(storeUrl);
      }
    } finally {
      await releaseLock?.();
    }
  }

  const harness = {
    clock,
    scheduler,
    store,
    fastify,
    attached,
    port,
    baseUrl,
    storeUrl,
    storeKind: fastify.appStore.kind,
    close,
    exchanges,
    clients,
    context: fastify.appContext,
    request,
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options),
    /** Verbindt een echte WebSocket met de handshake uit PROTOCOL.md §Socket-auth. */
    async connect(sessionToken, { protocolVersion = 'v1' } = {}) {
      const client = await createTestClient(port, { sessionToken, protocolVersion });
      clients.push(client);
      return client;
    },
    /** Verbindt met een rauwe auth-payload (voor de weigeringsgevallen). */
    async connectRaw(auth) {
      const client = await createTestClient(port, auth);
      clients.push(client);
      return client;
    },
  };

  // Altijd, ook als de test `close()` al zelf heeft aangeroepen: de functie is
  // idempotent, en een vangnet dat je moet aanzetten is geen vangnet.
  t.after(close);

  return harness;
}
