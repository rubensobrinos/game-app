// Tests voor het entrypoint (`server/index.mjs`) — specifiek de twee dingen die
// alléén hier fout kunnen gaan en die geen enkele laag-eigen test ziet:
//
//   1. DE BRUG REST → SOCKET. `socket.mjs` exporteert `broadcastPlayerChanged`
//      speciaal omdat joins over `POST /api/v1/games/join` lopen en niet over de
//      socket. `rest.mjs` kan die functie alleen aanroepen als dit bestand het
//      handle daadwerkelijk doorgeeft, en dat handle bestaat pas ná `ready()`.
//      Een bedrading die stil niets doet is niet te onderscheiden van géén
//      bedrading — vandaar een test met een ECHTE socketverbinding die het
//      event ook echt moet ontvangen.
//
//   2. GRACEFUL SHUTDOWN. Fastify sluit de HTTP-server tussen `preClose` en
//      `onClose` in. Staat de socketteardown in `onClose`, dan blijft
//      `fastify.close()` hangen op precies de WebSocket die die teardown had
//      moeten verbreken — hetzelfde pad als de SIGTERM-handler. De test
//      hieronder opent een echte verbinding en sluit dan af MET TIJDSLIMIET, in
//      plaats van de testrun te laten hangen.
//
// ECHTE SERVER, ECHTE POORT, ECHTE WEBSOCKET. `inject()` bindt geen poort en kan
// dus geen van beide bewijzen.

import assert from 'node:assert/strict';
import test from 'node:test';

import { buildServer } from './index.mjs';
import { createTestClient } from '../tests/integration/support/socket-io-test-client.mjs';

const PEPPER = 'test-pepper-met-ruim-genoeg-bytes';
const CONFIG = Object.freeze({
  port: 0,
  host: '127.0.0.1',
  publicAppUrl: 'https://play.aseso.nl',
  tokenPeppers: Object.freeze({ version: 'v1', peppers: Object.freeze({ v1: PEPPER }) }),
});

const CREATE_REQUEST = Object.freeze({
  config: Object.freeze({ preset: 'quick_start', language: 'nl' }),
  hostParticipates: true,
  displayName: 'Host',
});

/**
 * Start de echte server met sockets op een vrije poort.
 *
 * De harness houdt de geopende clients bij. Dat is niet alleen netheid: het
 * VANGNET hieronder heeft ze nodig. Zonder een vangnet laat een regressie in de
 * afsluitvolgorde niet één test rood worden maar het hele testproces hangen —
 * de HTTP-server sluit dan nooit, dus Node's event loop loopt nooit leeg en
 * `npm test` komt niet meer terug. Precies wat deze test moet vóórkomen.
 *
 * @param {import('node:test').TestContext} t
 * @param {{ autoClose?: boolean }} [options]
 */
async function startServer(t, { autoClose = true } = {}) {
  const fastify = await buildServer({ config: { ...CONFIG }, attachSockets: true });
  await fastify.listen({ port: 0, host: '127.0.0.1' });
  const { port } = fastify.server.address();

  /** @type {Array<{ close(): void }>} */
  const clients = [];

  /** Verbindt een echte Socket.IO-client en laat de harness hem opruimen. */
  async function connect(sessionToken) {
    const client = await createTestClient(port, { sessionToken, protocolVersion: 'v1' });
    clients.push(client);
    return client;
  }

  /**
   * Sluit de server met een tijdslimiet en breekt bij overschrijding alles hard
   * af, zodat het testproces daarna alsnog kan aflopen.
   * @param {string} label
   */
  async function closeWithinLimit(label) {
    const closing = fastify.close();
    try {
      await withTimeout(closing, 5000, label);
    } catch (error) {
      for (const client of clients) {
        client.close();
      }
      fastify.server.closeAllConnections?.();
      await withTimeout(closing, 5000, `${label} (na hard afbreken)`).catch(() => {});
      throw error;
    }
  }

  // Eén opruimhook, in deze volgorde: eerst afsluiten (mét de sockets nog open,
  // want dat is nu juist het geval dat moet werken), daarna de clients dicht.
  t.after(async () => {
    try {
      if (autoClose) {
        await closeWithinLimit('fastify.close()');
      }
    } finally {
      for (const client of clients) {
        client.close();
      }
    }
  });

  return { fastify, port, baseUrl: `http://127.0.0.1:${port}`, connect, closeWithinLimit };
}

/**
 * Wacht op een promise met een harde bovengrens. Zonder dit zou een regressie in
 * de afsluitvolgorde de hele testrun laten hangen in plaats van één test rood te
 * maken — en dat is precies het gedrag dat we hier bewaken.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {string} label
 */
function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} kwam niet binnen ${timeoutMs}ms terug`));
    }, timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** @param {string} baseUrl */
async function createGame(baseUrl) {
  const response = await fetch(`${baseUrl}/api/v1/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(CREATE_REQUEST),
  });
  assert.equal(response.status, 201);
  return response.json();
}

/** @param {string} baseUrl @param {string} gameCode */
async function joinGame(baseUrl, gameCode, displayName) {
  const response = await fetch(`${baseUrl}/api/v1/games/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gameCode, displayName, joinSource: 'code' }),
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);
  return JSON.parse(body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. De brug REST → socket
// ─────────────────────────────────────────────────────────────────────────────

test('een REST-join levert de lobby een room:player-changed op', async (t) => {
  const { baseUrl, connect } = await startServer(t);
  const created = await createGame(baseUrl);

  // De host kijkt over de socket mee — dat is de lobby.
  const host = await connect(created.sessionToken);

  const joined = await joinGame(baseUrl, created.gameCode, 'Speler');

  const envelope = await withTimeout(
    host.waitFor('room:player-changed'),
    5000,
    'room:player-changed na POST /games/join',
  );
  assert.equal(envelope.event, 'room:player-changed');
  assert.deepEqual(envelope.payload.delta, { type: 'join', playerId: joined.playerId });
  // Host + joiner. De telling komt uit de socketlaag (de snapshot), niet uit
  // rest.mjs — deze assertie bewaakt dat er geen tweede telregel is ontstaan.
  assert.equal(envelope.payload.playerCount, 2);
});

test('een REST-leave levert de lobby een room:player-changed op, en alleen bij de eerste keer', async (t) => {
  const { baseUrl, connect } = await startServer(t);
  const created = await createGame(baseUrl);
  const host = await connect(created.sessionToken);

  const joined = await joinGame(baseUrl, created.gameCode, 'Speler');
  await withTimeout(host.waitFor('room:player-changed'), 5000, 'join-delta');

  const leave = () => fetch(`${baseUrl}/api/v1/games/${created.gameCode}/leave`, {
    method: 'POST',
    headers: { authorization: `Bearer ${joined.sessionToken}` },
  });

  assert.equal((await leave()).status, 200);
  const envelope = await withTimeout(
    host.waitFor('room:player-changed', (candidate) => candidate.payload.delta.type === 'leave'),
    5000,
    'leave-delta',
  );
  assert.deepEqual(envelope.payload.delta, { type: 'leave', playerId: joined.playerId });

  // Nog een keer verlaten verandert niets aan de room en hoort dus ook niets te
  // melden: `left` stond al op true.
  assert.equal((await leave()).status, 200);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    host.eventsNamed('room:player-changed').filter((entry) => entry.envelope.payload.delta.type === 'leave').length,
    1,
  );
});

test('zonder socketlaag blijven join en leave gewoon werken', async (t) => {
  // `attachSockets: false` is wat vrijwel elke andere test gebruikt. De
  // getter levert dan `null` op en rest.mjs slaat de broadcast over — zonder
  // dat het eindpunt zelf verandert.
  const fastify = await buildServer({ config: { ...CONFIG } });
  t.after(() => withTimeout(fastify.close(), 5000, 'fastify.close()'));
  await fastify.ready();

  const created = await fastify.inject({ method: 'POST', url: '/api/v1/games', payload: CREATE_REQUEST });
  assert.equal(created.statusCode, 201);
  const { gameCode } = created.json();

  const joined = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode, displayName: 'Speler', joinSource: 'code' },
  });
  assert.equal(joined.statusCode, 200);

  const left = await fastify.inject({
    method: 'POST',
    url: `/api/v1/games/${gameCode}/leave`,
    headers: { authorization: `Bearer ${joined.json().sessionToken}` },
  });
  assert.equal(left.statusCode, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

test('fastify.close() rondt af terwijl er een WebSocket openstaat (preClose, niet onClose)', async (t) => {
  const { baseUrl, connect, closeWithinLimit } = await startServer(t, { autoClose: false });
  const created = await createGame(baseUrl);

  await connect(created.sessionToken);

  // DIT is de regressietest. Stond de socketteardown weer in `onClose`, dan
  // wacht Fastify hier op een WebSocket die pas ná het sluiten van de
  // HTTP-server wordt verbroken, en komt deze promise nooit terug — hetzelfde
  // pad als de SIGTERM-handler in `start()`.
  await closeWithinLimit('fastify.close() met een open WebSocket');
});

test('fastify.close() is idempotent en blijft binnen de tijdslimiet', async (t) => {
  const { baseUrl, connect, closeWithinLimit } = await startServer(t, { autoClose: false });
  const created = await createGame(baseUrl);
  await connect(created.sessionToken);

  await closeWithinLimit('eerste close');
  await closeWithinLimit('tweede close');
});
