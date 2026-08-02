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

import assert from 'node:assert/strict';

import {
  attachSocketsIfAvailable,
  buildServer,
  readConfigFromEnvironment,
} from '../../../server/index.mjs';
import { createInMemoryStore } from '../../../server/data/in-memory-store.js';

import { APP_URL, PEPPER, makeClock } from './composition-harness.mjs';
import { createTestClient } from './socket-io-test-client.mjs';

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
 * @param {{ startAt?: number }} [options]
 */
export async function startTransportServer(t, { startAt } = {}) {
  const clock = makeClock(startAt);
  const scheduler = makeManualScheduler();
  const store = createInMemoryStore();

  // De echte env-lezer, met een expliciete omgeving in plaats van process.env:
  // dit is de configuratieweg die productie ook loopt (peppers, publicAppUrl,
  // contentVersion uit shared/content).
  const config = readConfigFromEnvironment({
    PORT: '0',
    HOST: '127.0.0.1',
    PUBLIC_APP_URL: APP_URL,
    TOKEN_PEPPER: PEPPER,
    NODE_ENV: 'test',
  });

  const fastify = await buildServer({ config, store, now: clock.now, attachSockets: false });
  await fastify.listen({ port: 0, host: '127.0.0.1' });
  const { port } = fastify.server.address();

  const attached = await attachSocketsIfAvailable(fastify.server, {
    context: fastify.appContext,
    config: { ...config, scheduler },
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

  const harness = {
    clock,
    scheduler,
    store,
    fastify,
    attached,
    port,
    baseUrl,
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

  t.after(async () => {
    for (const client of clients) {
      client.close();
    }
    await attached.close();
    // `fetch` houdt keep-alive-verbindingen open; zonder dit blijft de server
    // hangen op `close()`.
    fastify.server.closeAllConnections();
    await fastify.close();
  });

  return harness;
}
