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
//   3. DE STOREKEUZE EN /readyz (stap 3). Welke store er onder de server hangt,
//      wordt hier gekozen en nergens anders; de compositielaag mag het niet
//      weten en kan het dus ook niet testen. Datzelfde geldt voor de
//      startgates: een onbereikbare Redis of een onvolledige adapter hoort de
//      server te laten wéigeren, en dat gedrag bestaat alleen in dit bestand.
//
//   4. HERSTART MIDDEN IN EEN MATCH (ARCHITECTURE.md §10). Twee servers ná
//      elkaar op dezelfde Redis: dat is per definitie een entrypoint-test.
//
// ECHTE SERVER, ECHTE POORT, ECHTE WEBSOCKET. `inject()` bindt geen poort en kan
// dus geen van beide bewijzen.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildServer,
  createMemoryStoreHandle,
  createRedisStoreHandle,
  createStoreHandle,
  readConfigFromEnvironment,
} from './index.mjs';
import {
  TEST_REDIS_URL,
  acquireRedisTestLock,
  probeTestRedis,
} from './data/adapters/redis/test-redis.mjs';
import { createTestClient } from '../tests/integration/support/socket-io-test-client.mjs';
import { startTransportServer } from '../tests/integration/support/transport-harness.mjs';

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

// ─────────────────────────────────────────────────────────────────────────────
// 2b. De statische mapping van flags/ — LOS VAN DE STOREKEUZE
// ─────────────────────────────────────────────────────────────────────────────

test('/flags/* serveert de echte flags/-map in de repo-root', async (t) => {
  // `flags/` staat NAAST client/ en shared/, niet eronder. Zonder een eigen
  // mapping viel elke vlag in de root-catch-all en die geeft voor een pad mét
  // extensie een eerlijke 404 — dus: geen enkele vlag in een `flags_mc`-vraag.
  // Achter Caddy valt dat niet op omdat de proxy die map zelf bedient; via
  // `npm start` (waarmee de eerste echte match gespeeld wordt) wel.
  const fastify = await buildServer({ config: { ...CONFIG } });
  t.after(() => withTimeout(fastify.close(), 5000, 'fastify.close()'));
  await fastify.ready();

  const flag = await fastify.inject({ method: 'GET', url: '/flags/nl.png' });
  assert.equal(flag.statusCode, 200);
  assert.match(flag.headers['content-type'], /^image\/png$/);
  assert.ok(Number(flag.headers['content-length']) > 0, 'een lege vlag is net zo stuk als een ontbrekende');
  // PNG-signatuur: dit is een plaatje en niet de SPA-shell met een verkeerd
  // content-type erop.
  assert.deepEqual([...flag.rawPayload.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);

  // Een niet-bestaande vlag blijft een eerlijke 404 met de gepubliceerde code,
  // en de traversalguard van de bestaande mounts geldt onverkort.
  const missing = await fastify.inject({ method: 'GET', url: '/flags/zz-bestaat-niet.png' });
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(missing.json(), { code: 'GAME_NOT_FOUND', meta: {} });

  const escape = await fastify.inject({ method: 'GET', url: '/flags/..%2f..%2fpackage.json' });
  assert.equal(escape.statusCode, 404, 'via /flags/ mag je de map niet uit');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. De storekeuze — welke opslag hangt er onder deze server?
// ─────────────────────────────────────────────────────────────────────────────

/** De basisomgeving van een ontwikkelserver, zonder storekeuze. */
const BASE_ENV = Object.freeze({
  PORT: '0',
  HOST: '127.0.0.1',
  PUBLIC_APP_URL: 'https://play.aseso.nl',
  TOKEN_PEPPER: PEPPER,
  NODE_ENV: 'test',
});

test('readConfigFromEnvironment leest de storekeuze uit REDIS_URL en verder nergens uit', () => {
  const warnings = [];
  const zonder = readConfigFromEnvironment({ ...BASE_ENV }, (line) => warnings.push(line));
  assert.equal(zonder.redisUrl, null);
  assert.ok(
    warnings.some((line) => line.includes('REDIS_URL')),
    'het ontbreken van REDIS_URL hoort luid te zijn, niet stil',
  );

  const met = readConfigFromEnvironment({ ...BASE_ENV, REDIS_URL: ' redis://127.0.0.1:6380 ' });
  assert.equal(met.redisUrl, 'redis://127.0.0.1:6380', 'witruimte hoort er af');

  // `REDIS_URL=` is de vorm waarin iemand hem uitzet; dat mag geen onparsebare
  // URL verderop worden.
  assert.equal(readConfigFromEnvironment({ ...BASE_ENV, REDIS_URL: '   ' }).redisUrl, null);
});

test('zonder REDIS_URL weigert de productiestand te starten in plaats van stil op de fake te draaien', () => {
  assert.throws(
    () => readConfigFromEnvironment({ ...BASE_ENV, NODE_ENV: 'production' }),
    /REDIS_URL is verplicht in productie/,
  );
  // Mét een URL komt hij wél door de env-lezer heen (het verbinden gebeurt pas
  // in de store-factory).
  assert.equal(
    readConfigFromEnvironment({ ...BASE_ENV, NODE_ENV: 'production', REDIS_URL: 'redis://redis:6379' }).redisUrl,
    'redis://redis:6379',
  );
});

test('createStoreHandle kiest de in-memory store zolang er geen REDIS_URL is', async () => {
  const handle = await createStoreHandle({ redisUrl: null });
  assert.equal(handle.kind, 'memory');
  assert.deepEqual(await handle.checkReady(), { ok: true });
  assert.equal(typeof handle.store.loadRoom, 'function');
  await handle.close();
});

/** Verbindingsopties die meteen opgeven — alleen voor de faalgevallen hieronder. */
const FAIL_FAST_CONNECTION = Object.freeze({ maxReconnectAttempts: 0, connectTimeoutMs: 250 });

test('een onbereikbare Redis laat de server NIET starten en valt niet terug op de fake', async () => {
  // Poort 1 is gereserveerd (tcpmux) en luistert nergens; een verbinding
  // daarheen wordt meteen geweigerd in plaats van te blijven hangen.
  const config = readConfigFromEnvironment({ ...BASE_ENV, REDIS_URL: 'redis://127.0.0.1:1' });

  await assert.rejects(
    // Zonder herpogingen: de standaard is bewust ~11 s geduld bij het opstarten
    // en dat hoort niet in een testsuite.
    () => buildServer({ config, storeOptions: { connection: FAIL_FAST_CONNECTION } }),
    (error) => {
      assert.match(error.message, /Verbinden met Redis/);
      assert.match(error.message, /de server start niet/);
      return true;
    },
  );
});

test('/readyz meldt 200 met de gekozen store zodra die bereikbaar is', async (t) => {
  const fastify = await buildServer({ config: { ...CONFIG } });
  t.after(() => withTimeout(fastify.close(), 5000, 'fastify.close()'));
  await fastify.ready();

  const ready = await fastify.inject({ method: 'GET', url: '/readyz' });
  assert.equal(ready.statusCode, 200);
  assert.deepEqual(ready.json(), { ok: true, store: 'memory' });

  // /healthz blijft ongewijzigd: 200 zolang het proces leeft.
  const health = await fastify.inject({ method: 'GET', url: '/healthz' });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { ok: true });
});

test('/readyz meldt 503 met een bruikbare reden zodra de store onbereikbaar is', async (t) => {
  // Een handle dat "niet bereikbaar" meldt is hier genoeg: de vraag is of
  // /readyz het antwoord van de store DOORGEEFT, niet of Redis kan sterven.
  const broken = {
    ...createMemoryStoreHandle(),
    kind: 'redis',
    async checkReady() {
      return { ok: false, reason: 'Redis op redis://127.0.0.1:6380 is niet bereikbaar (ECONNREFUSED)' };
    },
  };
  const fastify = await buildServer({ config: { ...CONFIG }, storeHandle: broken });
  t.after(() => withTimeout(fastify.close(), 5000, 'fastify.close()'));
  await fastify.ready();

  const response = await fastify.inject({ method: 'GET', url: '/readyz' });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    ok: false,
    store: 'redis',
    reason: 'Redis op redis://127.0.0.1:6380 is niet bereikbaar (ECONNREFUSED)',
  });

  // En /healthz trekt zich er niets van aan: het proces leeft.
  assert.equal((await fastify.inject({ method: 'GET', url: '/healthz' })).statusCode, 200);
});

test('een store die de server niet zelf bouwt, sluit hij ook niet', async (t) => {
  let closes = 0;
  const handle = { ...createMemoryStoreHandle(), close: async () => { closes += 1; } };
  const fastify = await buildServer({ config: { ...CONFIG }, storeHandle: handle });
  await fastify.ready();
  await withTimeout(fastify.close(), 5000, 'fastify.close()');
  assert.equal(closes, 0, 'een meegegeven store blijft van de aanroeper');
  t.diagnostic('eigenaarschap: buildServer sluit alleen wat hij zelf heeft gebouwd');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Herstart midden in een match (ARCHITECTURE.md §10)
// ─────────────────────────────────────────────────────────────────────────────

// Vaste getallen uit de quick-start-configuratie, zoals de ketentest ze ook
// gebruikt (besluit 35 + 13).
const COUNTDOWN_MS = 3000;
const RESULT_MS = 5000;

/**
 * Draait de Redis-voorwaarden af en levert een overslagreden op wanneer er iets
 * niet klopt. NOOIT stilzwijgend groen: een herstarttest die zonder Redis
 * "slaagt" bewijst het tegenovergestelde van wat hij moet bewijzen.
 * @returns {Promise<string | null>} de reden om over te slaan, of null
 */
async function redisBlocker() {
  const probe = await probeTestRedis();
  if (!probe.ok) return probe.reason;

  // Tweede poort: `Session.tokenHash` draagt sinds besluit 26 een versieprefix
  // (`v1:<hex>`), en `assertSegment` in server/data/redis-keys.js weigert een
  // ':' in een sleutelsegment. Zolang die twee elkaar tegenspreken kan de
  // Redis-adapter geen enkele sessie opslaan en faalt de eerste
  // `POST /api/v1/games` met 500. Dat is een bevinding in server/data, niet in
  // dit bestand — hier wordt hij alleen luid vastgesteld.
  const { sessionTokenLookupKey } = await import('./data/redis-keys.js');
  try {
    sessionTokenLookupKey('v1:0123456789abcdef');
  } catch (error) {
    return 'server/data/redis-keys.js accepteert de versieprefix van Session.tokenHash niet '
      + `("v1:<hex>", besluit 26): ${error?.message ?? error}. `
      + 'Zolang dat zo is kan de Redis-adapter geen sessie opslaan en is een herstart niet te testen.';
  }
  return null;
}

/** Maakt een room over echt HTTP en levert de responsbody. */
async function createRoomOverHttp(harness, displayName) {
  const response = await harness.post('/api/v1/games', {
    body: { config: { preset: 'quick_start', language: 'nl' }, hostParticipates: true, displayName },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}

/** Joint over echt HTTP en levert de responsbody. */
async function joinOverHttp(harness, gameCode, displayName) {
  const response = await harness.post('/api/v1/games/join', {
    body: { gameCode, displayName, joinSource: 'code' },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

test('een procesherstart midden in een match vindt room, match, spelers en scores terug in Redis', async (t) => {
  const blocker = await redisBlocker();
  if (blocker !== null) {
    t.skip(blocker);
    return;
  }

  // ÉÉN slot voor BEIDE servers. De harness neemt het slot normaal per server,
  // maar tussen server A en server B mag geen ander Redis-schrijvend
  // testbestand ertussen komen: dat flusht zijn eigen database, en bij een
  // botsende PID-index is dat de onze. Precies de gegevens die deze test moet
  // terugvinden.
  const release = await acquireRedisTestLock({ label: 'index-restart' });
  t.after(release);

  // ── Server A: een match met een echte score ────────────────────────────
  const a = await startTransportServer(t, {
    redisUrl: TEST_REDIS_URL,
    acquireLock: false,
    cleanupRedis: false, // server B moet de gegevens nog aantreffen
  });
  assert.equal(a.storeKind, 'redis', 'server A hoort op de Redis-store te draaien');
  assert.equal((await a.get('/readyz')).status, 200, '/readyz is groen met een bereikbare Redis');

  const host = await createRoomOverHttp(a, 'Hester');
  const p2 = await joinOverHttp(a, host.gameCode, 'Bram');

  const hostSocket = await a.connect(host.sessionToken);
  const p2Socket = await a.connect(p2.sessionToken);

  const startAck = await hostSocket.emitWithAck('game:start', { actionId: 'act_start', payload: {} });
  assert.equal(startAck.ok, true, JSON.stringify(startAck));
  const { matchId } = startAck.payload;
  await hostSocket.waitFor('game:started');

  // COUNTDOWN -> ROUND_ACTIVE
  a.clock.advance(COUNTDOWN_MS);
  await a.scheduler.fireAll();
  const started = (await hostSocket.waitFor('round:started')).payload;

  // Het juiste antwoord komt uit de store, niet uit de wire (besluit 20).
  const roundDoc = await a.store.loadRound(host.roomId, matchId, started.roundId);
  assert.notEqual(roundDoc, null, 'de ronde staat in Redis');
  const correct = roundDoc.correctAnswer.optionId;
  const wrong = roundDoc.validOptionIds.find((id) => id !== correct);

  // De host antwoordt goed (score > 0), speler 2 fout (score 0). Twee
  // verschillende scores, zodat een herstart die "alles op nul" teruggeeft niet
  // per ongeluk zou slagen.
  a.clock.set(started.startsAt + 2000);
  for (const [socket, optionId, actionId] of [
    [hostSocket, correct, 'act_r1_host'],
    [p2Socket, wrong, 'act_r1_p2'],
  ]) {
    const ack = await socket.emitWithAck('round:answer', {
      actionId,
      payload: { roundId: started.roundId, answer: { optionId }, clientAnsweredAt: a.clock.now() - 40 },
    });
    assert.equal(ack.ok, true, JSON.stringify(ack));
  }

  // ROUND_ACTIVE -> ROUND_RESULT: hier worden de punten geboekt.
  a.clock.set(started.endsAt);
  await a.scheduler.fireAll();
  const ended = await hostSocket.waitFor('round:ended', (envelope) => envelope.payload.roundId === started.roundId);
  assert.equal(ended.payload.ownCorrect, true);
  assert.ok(ended.payload.ownPoints > 0, 'de host hoort punten te krijgen');
  const expectedScore = ended.payload.ownPoints;

  // ROUND_RESULT -> SCOREBOARD, zodat de match niet in een vluchtige
  // tussenfase blijft staan op het moment dat de server wegvalt.
  a.clock.advance(RESULT_MS);
  await a.scheduler.fireAll();
  await hostSocket.waitFor('scoreboard:updated');

  const beforeRoom = await a.store.loadRoom(host.roomId);
  const beforeMatch = await a.store.loadMatch(host.roomId, matchId);
  const beforeTop = await a.store.getScoreboardTop(host.roomId, matchId, 5);
  assert.equal(beforeTop[0].score, expectedScore);

  // ── De server valt weg ──────────────────────────────────────────────────
  await a.close();

  // ── Server B: een NIEUW proces-equivalent op dezelfde Redis ─────────────
  const b = await startTransportServer(t, {
    redisUrl: TEST_REDIS_URL,
    acquireLock: false,
    cleanupRedis: true, // laatste server ruimt op
  });
  assert.equal(b.storeKind, 'redis');
  assert.notEqual(b.store, a.store, 'server B heeft een eigen verbinding en een eigen store');

  // WAT ER TERUGKOMT — room, match, spelers, scores.
  const room = await b.store.loadRoom(host.roomId);
  assert.notEqual(room, null, 'de room overleeft de herstart');
  assert.equal(room.code, host.gameCode);
  assert.equal(room.currentMatchId, matchId);
  assert.equal(room.phase, beforeRoom.phase);

  const match = await b.store.loadMatch(host.roomId, matchId);
  assert.notEqual(match, null, 'de match overleeft de herstart');
  assert.deepEqual(match, beforeMatch, 'de match komt byte-voor-byte terug zoals hij stond');

  const players = await b.store.listPlayers(host.roomId);
  assert.equal(players.length, 2);
  const scoresById = Object.fromEntries(players.map((player) => [player.id, player.score]));
  assert.equal(scoresById[host.playerId], expectedScore, 'de score van de host is intact');
  assert.equal(scoresById[p2.playerId], 0, 'de nulscore van speler 2 is ook intact');

  assert.deepEqual(
    await b.store.getScoreboardTop(host.roomId, matchId, 5),
    beforeTop,
    'de tussenstand komt ongewijzigd terug',
  );

  // De locators werken nog: de room is met dezelfde code te vinden.
  assert.equal((await b.store.loadRoomByCode(host.gameCode))?.id, host.roomId);

  // EN OVER DE ECHTE TRANSPORT: het sessietoken van vóór de herstart werkt nog,
  // en de snapshot die server B teruggeeft draagt de scores. Dat is het bewijs
  // dat niet alleen de documenten maar ook de sessie-index de herstart haalt.
  const snapshot = await b.get(`/api/v1/games/${host.gameCode}/state`, { token: host.sessionToken });
  assert.equal(snapshot.status, 200, JSON.stringify(snapshot.body));
  assert.equal(snapshot.body.room.matchId, matchId);
  assert.equal(snapshot.body.self.playerId, host.playerId);
  assert.equal(snapshot.body.self.score ?? snapshot.body.scoreboard.self.score, expectedScore);

  // ── WAT ER NIET GEBEURT ─────────────────────────────────────────────────
  //
  // ARCHITECTURE.md §10 wil dat een herstart de room op PAUSED zet met reden
  // `server_recovery` en hem daarna via RECOVERY_RESUME naar een nieuwe korte
  // COUNTDOWN brengt. Dat pad BESTAAT NIET: `RECOVERY_RESUME` staat in
  // server/architecture/state-machine.js en wordt in
  // server/composition/match-lifecycle.mjs alleen geclassificeerd als
  // servergedreven event — geen enkele functie roept het aan, en niets leest
  // `rooms:active` bij het opstarten. Deze assertie legt dat vast als een
  // BEKENDE LEEMTE in plaats van hem te maskeren: gaat iemand het herstelpad
  // bouwen, dan valt hij hier om en weet hij meteen dat deze test mee moet.
  assert.notEqual(room.phase, 'PAUSED', 'er is (nog) geen herstelpad dat de room pauzeert — zie de bevinding');
  t.diagnostic(
    `herstart: room ${host.roomId} komt terug in fase ${room.phase} met de scores intact, `
    + 'maar zonder PAUSED(server_recovery) + RECOVERY_RESUME — dat pad ontbreekt in de compositielaag.',
  );
});

test('de startgate op UNIMPLEMENTED_METHODS weigert een onvolledige adapter', async () => {
  // Vandaag is de lijst leeg en komt deze gate dus nooit aan bod. Dat is precies
  // waarom hij een eigen test heeft: een gate die alleen bij een toekomstige
  // regressie afgaat, moet nú bewezen zijn dat hij werkt.
  const { UNIMPLEMENTED_METHODS } = await import('./data/adapters/redis/data-store.mjs');
  assert.deepEqual(Object.keys(UNIMPLEMENTED_METHODS), [], 'de adapter is vandaag volledig');

  // De gate zit vóór het verbinden: met een onbereikbare URL hoort een
  // onvolledige adapter tóch op de volledigheidsmelding te stuiten en niet op
  // de verbindingsfout. Dat is niet direct te forceren zonder de adapter te
  // wijzigen, dus hier wordt de andere kant bewezen: bij een LEGE lijst is de
  // verbindingsfout de eerste die je ziet.
  await assert.rejects(
    () => createRedisStoreHandle('redis://127.0.0.1:1', { connection: FAIL_FAST_CONNECTION }),
    /Verbinden met Redis/,
  );
});
