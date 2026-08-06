// Tests voor de REST-laag. Echte HTTP-verzoeken via Fastify's `inject`: geen
// poort, geen extra testdependency.
//
// Per eindpunt gedekt: het happy path, een validatiefout, en — waar het
// eindpunt authenticatie vereist — een authenticatiefout. Daarnaast expliciet:
// een interne foutcode (besluit 12) belandt NOOIT in een respons, en een
// responsvalidatie die faalt wordt een 500 in plaats van stilzwijgende
// doorgifte.
//
// Geen enkele test hangt van de echte klok af: `now` is een vaste functie.

import test from 'node:test';
import assert from 'node:assert/strict';

import Fastify from 'fastify';

import { buildServer } from '../index.mjs';
import restRoutes, { REST_PREFIX, httpStatusForErrorCode, toPublishedErrorCode } from './rest.mjs';
import { createContext } from '../composition/context.mjs';
import { createRoom } from '../composition/room-lifecycle.mjs';
import { startMatch } from '../composition/match-lifecycle.mjs';
import { createInMemoryStore } from '../data/in-memory-store.js';
import { ALL_ERROR_CODES } from '../protocol/error-codes.mjs';
import { validateSnapshotShape } from '../protocol/snapshot-shape.mjs';
import { CONTENT_VERSION } from '../../shared/content/index.mjs';

const FIXED_NOW = 1_785_000_000_000;
const PEPPER = 'test-pepper-met-ruim-genoeg-bytes';
const CONFIG = Object.freeze({
  tokenPeppers: { version: 'v1', peppers: { v1: PEPPER } },
  publicAppUrl: 'https://play.aseso.nl',
  contentVersion: CONTENT_VERSION,
});

/** Een volledige server (REST + healthz/readyz + statisch), zonder poort. */
async function makeServer({ store = createInMemoryStore(), now = () => FIXED_NOW } = {}) {
  const fastify = await buildServer({ config: { ...CONFIG }, store, now });
  await fastify.ready();
  return fastify;
}

/**
 * Een server die ALLE loggeroutput opvangt — die van onze eigen veilige logger
 * én die van Fastify/Pino zelf. Dat tweede is het punt: Pino's standaard
 * `req`-serializer schrijft `url`, `remoteAddress` en `remotePort`, dus een
 * test die alleen naar onze eigen regels kijkt zou het gevaarlijkste lek missen.
 */
async function makeLoggingServer({ store = createInMemoryStore(), now = () => FIXED_NOW } = {}) {
  /** @type {string[]} */
  const lines = [];
  const fastify = await buildServer({
    config: { ...CONFIG },
    store,
    now,
    logger: {
      level: 'trace',
      stream: { write: (line) => { lines.push(line); } },
    },
  });
  await fastify.ready();
  return {
    fastify,
    lines,
    /** Alle opgevangen regels als JSON-objecten. */
    records: () => lines.map((line) => JSON.parse(line)),
    /** De ruwe tekst van alles wat er gelogd is — hierin zoeken we naar WAARDEN. */
    raw: () => lines.join('\n'),
  };
}

/** Alleen de REST-plugin, met een handmatig samengestelde context. */
async function makeRestOnlyServer(context, { getSockets } = {}) {
  const fastify = Fastify();
  await fastify.register(restRoutes, { context, prefix: REST_PREFIX, ...(getSockets ? { getSockets } : {}) });
  await fastify.ready();
  return fastify;
}

/**
 * Een socketlaag-dubbel dat alleen registreert wat er wordt uitgezonden.
 *
 * Bewust GEEN Socket.IO: hier wordt het CONTRACT getest dat `rest.mjs` met de
 * socketlaag heeft (wordt er uitgezonden, wanneer, met welke delta), niet of
 * Socket.IO die boodschap over de draad krijgt. Dat laatste bewijst
 * `server/index.test.mjs` met een echte verbinding.
 */
function makeSocketsDouble({ throws = false } = {}) {
  /** @type {Array<{ roomId: string, delta: object }>} */
  const broadcasts = [];
  return {
    broadcasts,
    handle: {
      async broadcastPlayerChanged(roomId, delta) {
        broadcasts.push({ roomId, delta });
        if (throws) {
          throw new Error('socketlaag onbereikbaar');
        }
      },
    },
  };
}

function makeContext({ store = createInMemoryStore(), now = () => FIXED_NOW } = {}) {
  return createContext({ store, now, config: { ...CONFIG } });
}

const createRequest = Object.freeze({
  config: { preset: 'quick_start', language: 'nl' },
  hostParticipates: true,
  displayName: 'Host',
});

/** Maakt via HTTP een room aan en geeft de responsbody terug. */
async function createGameOverHttp(fastify, body = createRequest) {
  const response = await fastify.inject({ method: 'POST', url: '/api/v1/games', payload: body });
  assert.equal(response.statusCode, 201, response.body);
  return response.json();
}

function bearer(token) {
  return { authorization: `Bearer ${token}` };
}

// ─── POST /api/v1/games ──────────────────────────────────────────────────────

test('POST /api/v1/games — happy path levert 201 en exact de PROTOCOL.md-responsvorm', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const response = await fastify.inject({ method: 'POST', url: '/api/v1/games', payload: createRequest });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.deepEqual(
    Object.keys(body).sort(),
    ['effectiveName', 'gameCode', 'identity', 'inviteId', 'joinUrl', 'playerId', 'roles', 'roomId', 'sessionToken', 'state'],
  );
  assert.match(body.gameCode, /^[0-9]{6}$/);
  assert.equal(body.joinUrl, `https://play.aseso.nl/j/${body.inviteId}`);
  assert.deepEqual(body.roles, ['host', 'player']);
  assert.equal(body.effectiveName, 'Host');
  // Zelfgekozen naam (displayName: 'Host' in createRequest hierboven) —
  // identiteit vervangt alleen een gegenereerde naam (spelersidentiteit.md).
  assert.equal(body.identity, null);
  assert.equal(body.state.room.code, body.gameCode);
  assert.equal(body.state.serverTime, FIXED_NOW);
});

test('POST /api/v1/games — geen interne velden op de wire (sessionId, inviteHash)', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const body = await createGameOverHttp(fastify);

  assert.equal(Object.hasOwn(body, 'sessionId'), false);
  assert.equal(Object.hasOwn(body, 'inviteHash'), false);
  assert.equal(bodyContainsKey(body, 'inviteHash'), false);
});

test('POST /api/v1/games — hostParticipates=false geeft playerId/effectiveName null (invariant)', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const body = await createGameOverHttp(fastify, { ...createRequest, hostParticipates: false, displayName: null });

  assert.equal(body.playerId, null);
  assert.equal(body.effectiveName, null);
  assert.deepEqual(body.roles, ['host']);
});

test('POST /api/v1/games — validatiefout: hostParticipates ontbreekt → 400 INVALID_REQUEST', async (t) => {
  // Een misvormde create heeft niets met een uitnodiging te maken; PROTOCOL.md
  // §Foutcodes kent daarvoor `INVALID_REQUEST`. `INVITE_INVALID` blijft
  // gereserveerd voor locatorproblemen bij join/preview — zie de test
  // hieronder over twee locators tegelijk.
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games',
    payload: { config: { preset: 'quick_start', language: 'nl' }, displayName: null },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { code: 'INVALID_REQUEST', meta: {} });
});

test('POST /api/v1/games — een te lange displayName krijgt de eigen inputcode, niet INVITE_INVALID', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games',
    payload: { ...createRequest, displayName: 'x'.repeat(50) },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'NAME_TOO_LONG');
});

test('POST /api/v1/games — onparseerbare JSON wordt onze foutvorm, niet die van Fastify', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games',
    headers: { 'content-type': 'application/json' },
    payload: '{ dit is geen json',
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { code: 'INVITE_INVALID', meta: {} });
});

// ─── POST /api/v1/games/join ─────────────────────────────────────────────────

test('POST /api/v1/games/join — happy path via gameCode levert 200 en een spelerssessie', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode: created.gameCode, displayName: 'Ruben', joinSource: 'code' },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(
    Object.keys(body).sort(),
    ['effectiveName', 'gameCode', 'identity', 'playerId', 'roles', 'roomId', 'sessionToken', 'state'],
  );
  assert.deepEqual(body.roles, ['player']);
  assert.equal(body.effectiveName, 'Ruben');
  // Zelfgekozen naam ('Ruben' hierboven) — geen identiteit.
  assert.equal(body.identity, null);
  assert.notEqual(body.sessionToken, created.sessionToken);
  assert.equal(body.state.self.playerId, body.playerId);
});

test('POST /api/v1/games/join — happy path via inviteId', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { inviteId: created.inviteId, displayName: null, joinSource: 'qr' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().roomId, created.roomId);
});

test('POST /api/v1/games/join — validatiefout: twee locators tegelijk → 400 INVITE_INVALID', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode: created.gameCode, inviteId: created.inviteId, displayName: null, joinSource: 'code' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'INVITE_INVALID');
});

// ─── De brug naar de socketlaag (room:player-changed) ────────────────────────
//
// `POST /games/join` en `POST /{code}/leave` lopen niet over de socket, terwijl
// de rest van de room daar wél op meekijkt. Zonder deze aanroepen ziet een lobby
// nooit een nieuwe speler binnenkomen. Hieronder het CONTRACT met de socketlaag;
// `server/index.test.mjs` bewijst met een echte verbinding dat het handle ook
// daadwerkelijk wordt doorgegeven.

test('POST /api/v1/games/join — meldt de room de nieuwe speler via de socketlaag', async (t) => {
  const sockets = makeSocketsDouble();
  const context = makeContext();
  const fastify = await makeRestOnlyServer(context, { getSockets: () => sockets.handle });
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode: created.gameCode, displayName: 'Ruben', joinSource: 'code' },
  });

  assert.equal(response.statusCode, 200);
  // Feedbackronde 4 aug: de delta draagt naam + kleur mee — zonder die twee
  // verscheen een nieuwe speler met lege naam in andermans lobbylijst.
  assert.deepEqual(sockets.broadcasts, [{
    roomId: response.json().roomId,
    delta: {
      type: 'join',
      playerId: response.json().playerId,
      effectiveName: 'Ruben',
      // Zelfgekozen naam ('Ruben') — geen identiteit.
      identity: null,
      color: sockets.broadcasts[0]?.delta?.color,
    },
  }]);
  assert.equal(typeof sockets.broadcasts[0]?.delta?.color, 'string');
});

test('POST /api/v1/games/{code}/leave — meldt de room het vertrek, en alleen bij de eerste keer', async (t) => {
  const sockets = makeSocketsDouble();
  const context = makeContext();
  const fastify = await makeRestOnlyServer(context, { getSockets: () => sockets.handle });
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);
  const joined = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode: created.gameCode, displayName: 'Ruben', joinSource: 'code' },
  }).then((response) => response.json());

  const leave = () => fastify.inject({
    method: 'POST',
    url: `/api/v1/games/${created.gameCode}/leave`,
    headers: bearer(joined.sessionToken),
  });

  assert.equal((await leave()).statusCode, 200);
  assert.equal((await leave()).statusCode, 200);

  // Tweemaal verlaten, maar `left` ging maar één keer van false naar true.
  assert.deepEqual(sockets.broadcasts.map((entry) => entry.delta.type), ['join', 'leave']);
  assert.deepEqual(sockets.broadcasts.at(-1), {
    roomId: joined.roomId,
    delta: { type: 'leave', playerId: joined.playerId },
  });
});

test('het handle wordt PER REQUEST opgevraagd, niet bij registratie', async (t) => {
  // Dit is de kern van de volgordekwestie in `buildServer`: de socketlaag wordt
  // pas ná `ready()` aangehaakt, dus op registratiemoment is er nog geen handle.
  // Werd de waarde toen vastgelegd, dan bleef hij voor altijd `null` en deed de
  // bedrading stil niets.
  const sockets = makeSocketsDouble();
  /** @type {object | null} */
  let current = null;
  let calls = 0;
  const context = makeContext();
  const fastify = await makeRestOnlyServer(context, {
    getSockets: () => { calls += 1; return current; },
  });
  t.after(() => fastify.close());

  const created = await createGameOverHttp(fastify);
  const before = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode: created.gameCode, displayName: 'Vroeg', joinSource: 'code' },
  });
  assert.equal(before.statusCode, 200);
  assert.equal(sockets.broadcasts.length, 0, 'nog geen socketlaag: niets uitgezonden');

  // Nu pas komt de socketlaag beschikbaar — precies zoals in `buildServer`.
  current = sockets.handle;
  const after = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode: created.gameCode, displayName: 'Laat', joinSource: 'code' },
  });
  assert.equal(after.statusCode, 200);
  assert.equal(sockets.broadcasts.length, 1);
  assert.ok(calls >= 2, `de getter moet per request worden aangeroepen, kreeg ${calls}`);
});

test('een socketlaag die werpt maakt van een geslaagde join geen fout', async (t) => {
  // De join is dan al doorgevoerd; een 500 zou de client laten denken dat hij
  // niet in de room zit.
  const sockets = makeSocketsDouble({ throws: true });
  const context = makeContext();
  const fastify = await makeRestOnlyServer(context, { getSockets: () => sockets.handle });
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode: created.gameCode, displayName: 'Ruben', joinSource: 'code' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(sockets.broadcasts.length, 1);
});

test('zonder socketlaag verandert er niets aan de eindpunten', async (t) => {
  // De standaardsituatie in vrijwel elke andere test: `getSockets` ontbreekt.
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const joined = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode: created.gameCode, displayName: 'Ruben', joinSource: 'code' },
  });
  assert.equal(joined.statusCode, 200);

  const left = await fastify.inject({
    method: 'POST',
    url: `/api/v1/games/${created.gameCode}/leave`,
    headers: bearer(joined.json().sessionToken),
  });
  assert.equal(left.statusCode, 200);
});

test('POST /api/v1/games/join — onbekende maar welgevormde code → 404 GAME_NOT_FOUND', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode: '000000', displayName: null, joinSource: 'code' },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { code: 'GAME_NOT_FOUND', meta: {} });
});

// ─── GET /api/v1/games/preview ───────────────────────────────────────────────

test('GET /api/v1/games/preview — happy path levert exact de zeven previewvelden', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'GET',
    url: `/api/v1/games/preview?inviteId=${created.inviteId}`,
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(
    Object.keys(body).sort(),
    ['allowLateJoin', 'locked', 'maxPlayers', 'phase', 'playerCount', 'roomId', 'suggestedName'],
  );
  assert.equal(body.phase, 'LOBBY');
  assert.equal(body.playerCount, 1);
  // Besluit 7 / PROTOCOL.md: preview maakt geen sessie of speler aan.
  assert.equal(Object.hasOwn(body, 'sessionToken'), false);
  assert.equal(Object.hasOwn(body, 'playerId'), false);
});

test('GET /api/v1/games/preview — validatiefout: misvormde inviteId → 400 INVITE_INVALID', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const response = await fastify.inject({ method: 'GET', url: '/api/v1/games/preview?inviteId=kort' });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'INVITE_INVALID');
});

test('GET /api/v1/games/preview — welgevormde maar onbekende inviteId → 404 GAME_NOT_FOUND', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);
  // Zelfde lengte/alfabet, andere waarde: syntactisch geldig, bestaat niet.
  const unknown = `${created.inviteId.slice(0, -1)}${created.inviteId.at(-1) === 'A' ? 'B' : 'A'}`;

  const response = await fastify.inject({ method: 'GET', url: `/api/v1/games/preview?inviteId=${unknown}` });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { code: 'GAME_NOT_FOUND', meta: {} });
});

// ─── GET /api/v1/games/:code/state ───────────────────────────────────────────

test('GET /api/v1/games/{code}/state — happy path levert de snapshot', async (t) => {
  const store = createInMemoryStore();
  const fastify = await makeServer({ store });
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);
  // De match starten: pas dán draagt de snapshot een échte matchId en
  // `matchSequence: 1`. De lobbyvariant (allebei null) staat in de eigen test
  // hieronder; deze test dekt de kant mét match.
  const started = await startMatch(makeContext({ store }), { roomId: created.roomId });
  assert.equal(started.ok, true);

  const response = await fastify.inject({
    method: 'GET',
    url: `/api/v1/games/${created.gameCode}/state`,
    headers: bearer(created.sessionToken),
  });

  assert.equal(response.statusCode, 200, response.body);
  const body = response.json();
  assert.equal(body.protocolVersion, 'v1');
  assert.equal(body.serverTime, FIXED_NOW);
  assert.equal(body.room.code, created.gameCode);
  assert.equal(body.room.matchSequence, 1);
  assert.deepEqual(body.self.roles, ['host', 'player']);
});

test('GET /api/v1/games/{code}/state — authenticatiefout: geen Authorization-header → 401', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({ method: 'GET', url: `/api/v1/games/${created.gameCode}/state` });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { code: 'TOKEN_INVALID', meta: {} });
});

test('GET /api/v1/games/{code}/state — authenticatiefout: onbekend token → 401 TOKEN_INVALID', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'GET',
    url: `/api/v1/games/${created.gameCode}/state`,
    headers: bearer('dit-token-bestaat-niet'),
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, 'TOKEN_INVALID');
});

test('GET /api/v1/games/{code}/state — een ingetrokken sessie krijgt 401 SESSION_REVOKED', async (t) => {
  const store = createInMemoryStore();
  const fastify = await makeServer({ store });
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const sessions = await store.listPlayers(created.roomId);
  const player = sessions[0];
  const session = await store.loadSession(created.roomId, player.sessionId);
  await store.saveSession({ ...session, revoked: true });

  const response = await fastify.inject({
    method: 'GET',
    url: `/api/v1/games/${created.gameCode}/state`,
    headers: bearer(created.sessionToken),
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, 'SESSION_REVOKED');
});

test('GET /api/v1/games/{code}/state — validatiefout: code is geen zes cijfers → 404 GAME_NOT_FOUND', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'GET',
    url: '/api/v1/games/abc/state',
    headers: bearer(created.sessionToken),
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, 'GAME_NOT_FOUND');
});

test('GET /api/v1/games/{code}/state — een sessie van een ándere room krijgt 404, geen 403', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const first = await createGameOverHttp(fastify);
  const second = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'GET',
    url: `/api/v1/games/${second.gameCode}/state`,
    headers: bearer(first.sessionToken),
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, 'GAME_NOT_FOUND');
});

test('GET /api/v1/games/{code}/state — in de lobby: 200 met matchId en matchSequence allebei null (INT-17)', async (t) => {
  // Het contract van de pre-match-lobby, over het eindpunt heen nagemeten.
  // Er is nog geen match (`Room.currentMatchId` is null), dus verzint de
  // snapshot geen matchId: `matchId` en `matchSequence` zijn ALLEBEI null en
  // `snapshot-shape.mjs` laat precies die combinatie door. De route keurt zijn
  // eigen respons nog steeds vóór verzending — hij bouwt niet om de validator
  // heen, de validator kent de lobby nu gewoon.
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'GET',
    url: `/api/v1/games/${created.gameCode}/state`,
    headers: bearer(created.sessionToken),
  });

  assert.equal(response.statusCode, 200, response.body);
  const body = response.json();
  assert.deepEqual(
    Object.keys(body).sort(),
    [
      'currentRound', 'participants', 'participantsTruncated', 'protocolVersion',
      'room', 'scoreboard', 'self', 'serverTime',
    ],
  );
  // De host is hier zelf de enige deelnemer, dus de lijst legt in één keer vast
  // dat een meespelende host beide rollen draagt en dat de lijst even lang is
  // als `playerCount`.
  assert.deepEqual(body.participants, [
    {
      playerId: created.playerId,
      effectiveName: body.self.effectiveName,
      // docs/openstaand/spelersidentiteit.md, stap 4 — meegemeten i.p.v.
      // hardgecodeerd: welk paar de host krijgt is willekeur, self draagt 'm
      // al (zelfde bron, zie snapshot.mjs).
      identity: body.self.identity,
      roles: ['host', 'player'],
    },
  ]);
  assert.equal(body.participantsTruncated, false);
  assert.equal(body.protocolVersion, 'v1');
  assert.equal(body.serverTime, FIXED_NOW);
  assert.equal(body.room.code, created.gameCode);
  assert.equal(body.room.phase, 'LOBBY');
  assert.equal(body.room.matchId, null);
  assert.equal(body.room.matchSequence, null);
  assert.equal(body.room.pausedState, null);
  assert.equal(body.room.playerCount, 1);
  assert.equal(body.room.locked, false);
  assert.deepEqual(body.currentRound, {});
  assert.deepEqual(body.scoreboard.top, []);
  assert.equal(body.self.playerId, created.playerId);
  assert.deepEqual(body.self.roles, ['host', 'player']);
  assert.equal(body.self.eligibleFromRound, 1);

  // Dezelfde keuring die de route zelf toepast, hier onafhankelijk herhaald op
  // de body die daadwerkelijk over de wire kwam.
  assert.deepEqual(validateSnapshotShape(body), { ok: true });
});

// ─── POST /api/v1/games/:code/leave ──────────────────────────────────────────

test('POST /api/v1/games/{code}/leave — happy path zet left=true en trekt het token NIET in', async (t) => {
  const store = createInMemoryStore();
  const fastify = await makeServer({ store });
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);
  const joined = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode: created.gameCode, displayName: 'Ruben', joinSource: 'code' },
  }).then((response) => response.json());

  const response = await fastify.inject({
    method: 'POST',
    url: `/api/v1/games/${created.gameCode}/leave`,
    headers: bearer(joined.sessionToken),
    payload: {},
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { left: true });

  const player = await store.loadPlayer(joined.roomId, joined.playerId);
  assert.equal(player.left, true);

  // Besluit 4: vrijwillig verlaten trekt het sessietoken niet in. Bewijs: een
  // volgend geauthenticeerd verzoek loopt niet op 401 stuk.
  const again = await fastify.inject({
    method: 'POST',
    url: `/api/v1/games/${created.gameCode}/leave`,
    headers: bearer(joined.sessionToken),
    payload: {},
  });
  assert.equal(again.statusCode, 200);
});

test('POST /api/v1/games/{code}/leave — werkt ook zonder body (PROTOCOL.md documenteert er geen)', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'POST',
    url: `/api/v1/games/${created.gameCode}/leave`,
    headers: { ...bearer(created.sessionToken), 'content-type': 'application/json' },
  });

  assert.equal(response.statusCode, 200);
});

test('POST /api/v1/games/{code}/leave — authenticatiefout: geen header → 401 TOKEN_INVALID', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'POST',
    url: `/api/v1/games/${created.gameCode}/leave`,
    payload: {},
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, 'TOKEN_INVALID');
});

test('POST /api/v1/games/{code}/leave — een host zonder spelerrol krijgt 403 NOT_PLAYER', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify, { ...createRequest, hostParticipates: false, displayName: null });

  const response = await fastify.inject({
    method: 'POST',
    url: `/api/v1/games/${created.gameCode}/leave`,
    headers: bearer(created.sessionToken),
    payload: {},
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), { code: 'NOT_PLAYER', meta: {} });
});

test('POST /api/v1/games/{code}/leave — validatiefout: misvormde code → 404 GAME_NOT_FOUND', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games/12/leave',
    headers: bearer(created.sessionToken),
    payload: {},
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, 'GAME_NOT_FOUND');
});

// ─── GET /api/v1/time ────────────────────────────────────────────────────────

test('GET /api/v1/time — levert serverTime in epoch-ms uit de geïnjecteerde klok', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const response = await fastify.inject({ method: 'GET', url: '/api/v1/time' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { serverTime: FIXED_NOW });
});

test('GET /api/v1/time — een misvormde serverTime wordt 500, geen doorgifte', async (t) => {
  // `validateTimeResponse` eist een geheel getal; 1.5 is dat niet.
  const context = makeContext({ now: () => FIXED_NOW });
  const fastify = await makeRestOnlyServer({ ...context, now: () => FIXED_NOW + 0.5 });
  t.after(() => fastify.close());

  const response = await fastify.inject({ method: 'GET', url: '/api/v1/time' });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), { code: 'INTERNAL_ERROR', meta: {} });
});

// ─── Interne foutcodes en serverfouten ───────────────────────────────────────

test('een interne foutcode (besluit 12) wordt afgebeeld op een gepubliceerde code', () => {
  assert.equal(ALL_ERROR_CODES.has('INVALID_PAUSE_STATE'), false);
  assert.equal(toPublishedErrorCode('INVALID_PAUSE_STATE'), 'INVALID_PHASE');
  assert.equal(toPublishedErrorCode('IETS_VOLSTREKT_ONBEKENDS'), 'INVALID_PHASE');
  assert.equal(toPublishedErrorCode(undefined), 'INVALID_PHASE');
  assert.equal(httpStatusForErrorCode('INVALID_PHASE'), 409);
});

test('een interne foutcode belandt nooit in een HTTP-respons', async (t) => {
  // Een compositie-/domeinfout die INVALID_PAUSE_STATE draagt, gesimuleerd op
  // het enige punt dat elk eindpunt raakt: de klok.
  const context = makeContext();
  const throwing = {
    ...context,
    now: () => {
      throw Object.assign(new Error('interne pauzetoestand'), { protocolCode: 'INVALID_PAUSE_STATE' });
    },
  };
  const fastify = await makeRestOnlyServer(throwing);
  t.after(() => fastify.close());

  const response = await fastify.inject({ method: 'GET', url: '/api/v1/time' });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, 'INVALID_PHASE');
  assert.equal(response.body.includes('INVALID_PAUSE_STATE'), false);
  assert.equal(response.body.includes('interne pauzetoestand'), false);
});

test('een onverwachte fout wordt 500 zonder stacktrace of foutmelding', async (t) => {
  const store = createInMemoryStore();
  const context = makeContext({ store });
  const brokenStore = {
    ...store,
    async loadRoomByCode() {
      throw new Error('kapotte-store-details-die-nooit-naar-buiten-mogen');
    },
  };
  const fastify = await makeRestOnlyServer({ ...context, store: brokenStore });
  t.after(() => fastify.close());

  const created = await createRoom(context, { hostParticipates: true, displayName: 'Host' });
  const response = await fastify.inject({
    method: 'GET',
    url: `/api/v1/games/${created.value.gameCode}/state`,
    headers: bearer(created.value.sessionToken),
  });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), { code: 'INTERNAL_ERROR', meta: {} });
  assert.equal(response.body.includes('kapotte-store'), false);
  assert.equal(response.body.includes('at '), false);
});

test('elke foutrespons draagt een code die de client kent', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);
  const known = new Set([...ALL_ERROR_CODES, 'INTERNAL_ERROR']);

  const failures = [
    { method: 'POST', url: '/api/v1/games', payload: {} },
    { method: 'POST', url: '/api/v1/games/join', payload: {} },
    { method: 'GET', url: '/api/v1/games/preview?inviteId=x' },
    { method: 'GET', url: `/api/v1/games/${created.gameCode}/state` },
    { method: 'POST', url: `/api/v1/games/${created.gameCode}/leave`, payload: {} },
    { method: 'GET', url: '/api/v1/games/999999/state', headers: bearer(created.sessionToken) },
    { method: 'GET', url: '/api/v1/dit-bestaat-niet' },
  ];

  for (const request of failures) {
    const response = await fastify.inject(request);
    assert.ok(response.statusCode >= 400, `${request.url} gaf ${response.statusCode}`);
    assert.equal(known.has(response.json().code), true, `${request.url} → ${response.body}`);
  }
});

// ─── Sessie-lookup via de poort ──────────────────────────────────────────────

test('sessie-lookup gaat uitsluitend via loadSessionByTokenHash uit de poort', async (t) => {
  const store = createInMemoryStore();
  const calls = [];
  const spyingStore = {
    ...store,
    async loadSessionByTokenHash(tokenHash) {
      calls.push(tokenHash);
      return store.loadSessionByTokenHash(tokenHash);
    },
  };
  const fastify = await makeServer({ store: spyingStore });
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  await fastify.inject({
    method: 'POST',
    url: `/api/v1/games/${created.gameCode}/leave`,
    headers: bearer(created.sessionToken),
    payload: {},
  });

  assert.equal(calls.length, 1);
  // De poort krijgt de versie-geprefixte hash, nooit het kale token.
  assert.match(calls[0], /^v1:[0-9a-f]{64}$/);
  assert.equal(calls[0].includes(created.sessionToken), false);
});

test('sessie-lookup overleeft een pepperrotatie: een oude hash blijft vindbaar', async (t) => {
  const store = createInMemoryStore();
  const oldPeppers = { version: 'v1', peppers: { v1: PEPPER } };
  const rotated = { version: 'v2', peppers: { v1: PEPPER, v2: 'tweede-test-pepper-met-genoeg-bytes' } };

  // Sessie aangemaakt onder v1 …
  const before = await buildServer({ config: { ...CONFIG, tokenPeppers: oldPeppers }, store, now: () => FIXED_NOW });
  await before.ready();
  const created = await createGameOverHttp(before);
  await before.close();

  // … en bevraagd nadat v2 de actieve versie is geworden.
  const after = await buildServer({ config: { ...CONFIG, tokenPeppers: rotated }, store, now: () => FIXED_NOW });
  t.after(() => after.close());
  const response = await after.inject({
    method: 'POST',
    url: `/api/v1/games/${created.gameCode}/leave`,
    headers: bearer(created.sessionToken),
    payload: {},
  });

  assert.equal(response.statusCode, 200, response.body);
});

test('sessie-lookup vertrouwt de tokenindex niet blind (INTB-10 punt 4)', async (t) => {
  const store = createInMemoryStore();
  const context = makeContext({ store });
  const created = await createRoom(context, { hostParticipates: true, displayName: 'Host' });

  // Een index die ALTIJD een sessie teruggeeft, ook voor een token dat er niet
  // bij hoort — precies het rotatiegat uit INTB-10. De constant-time
  // verificatie tegen `session.tokenHash` moet dat alsnog afwijzen.
  const lyingStore = {
    ...store,
    async loadSessionByTokenHash() {
      return store.loadSession(created.value.roomId, created.value.sessionId);
    },
  };
  const fastify = await makeRestOnlyServer({ ...context, store: lyingStore });
  t.after(() => fastify.close());

  const response = await fastify.inject({
    method: 'GET',
    url: `/api/v1/games/${created.value.gameCode}/state`,
    headers: bearer('een-token-dat-nergens-bij-hoort'),
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, 'TOKEN_INVALID');
});

// ─── Entrypoint: healthz, readyz, statisch ───────────────────────────────────

test('/healthz blijft 200 zolang het proces leeft', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const response = await fastify.inject({ method: 'GET', url: '/healthz' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
});

test('/readyz rapporteert de gekozen store en geeft 200 zodra die bereikbaar is', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  // Deze test pinde eerder vast dat /readyz ONVOORWAARDELIJK 503 gaf, omdat er
  // nog geen store-keuze bestond. Sinds de store-factory rapporteert hij echt:
  // 200 met de gekozen store zodra die bereikbaar is, 503 met een reden als dat
  // niet zo is. Zonder REDIS_URL is dat de in-memory store, en die is per
  // definitie bereikbaar — een 503 zou hier dus een defect zijn en geen
  // "nog niet af".
  const response = await fastify.inject({ method: 'GET', url: '/readyz' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().ok, true);
  assert.equal(response.json().store, 'memory');
});

test('statische mappings: /client/* en /shared/* serveren de echte mappen (UI-3)', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const client = await fastify.inject({ method: 'GET', url: '/client/flow/leave-state.mjs' });
  assert.equal(client.statusCode, 200);
  assert.match(client.headers['content-type'], /text\/javascript/);
  assert.match(client.body, /initialLeaveState/);

  const shared = await fastify.inject({ method: 'GET', url: '/shared/content/index.mjs' });
  assert.equal(shared.statusCode, 200);
  assert.match(shared.body, /CONTENT_VERSION/);
});

test('frontend/ is de root en deep links vallen terug op index.html', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const root = await fastify.inject({ method: 'GET', url: '/' });
  assert.equal(root.statusCode, 200);
  assert.match(root.headers['content-type'], /text\/html/);

  const deepLink = await fastify.inject({ method: 'GET', url: '/j/N4x7pQm2K8tW' });
  assert.equal(deepLink.statusCode, 200);
  assert.match(deepLink.headers['content-type'], /text\/html/);

  // Een ontbrekend bestand mét extensie blijft een eerlijke 404.
  const missing = await fastify.inject({ method: 'GET', url: '/bestaat-niet.js' });
  assert.equal(missing.statusCode, 404);
});

test('statische paden ontsnappen niet aan hun map', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  for (const url of ['/client/../../package.json', '/shared/..%2f..%2fpackage.json', '/client/%2e%2e/%2e%2e/package.json']) {
    const response = await fastify.inject({ method: 'GET', url });
    assert.notEqual(response.statusCode, 200, `${url} mocht niet slagen`);
    assert.equal(response.body.includes('aseso-game-app'), false);
  }
});

/** Zoekt een sleutelnaam ergens in een geserialiseerde body. */
function bodyContainsKey(body, key) {
  return JSON.stringify(body).includes(`"${key}"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// INT4a — traceerbaarheid van de REST-laag
// ─────────────────────────────────────────────────────────────────────────────

test('een afgewezen verzoek logt zijn requestId, methode en foutcode', async (t) => {
  const server = await makeLoggingServer();
  t.after(() => server.fastify.close());

  // OPZETCONTROLE: de afwijzing moet echt gebeurd zijn.
  const response = await server.fastify.inject({
    method: 'POST',
    url: '/api/v1/games',
    payload: { config: { preset: 'quick_start', language: 'nl' }, displayName: null },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'INVALID_REQUEST');

  const rejected = server.records().filter((record) => record.msg === 'verzoek afgewezen');
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].layer, 'rest');
  assert.equal(rejected[0].code, 'INVALID_REQUEST');
  assert.equal(rejected[0].outcome, 'rejected');
  assert.equal(rejected[0].method, 'POST');
  assert.match(rejected[0].requestId, /^req-\d+$/);
});

test('een authenticatiefout logt outcome auth_failed en nooit het aangeboden token', async (t) => {
  const server = await makeLoggingServer();
  t.after(() => server.fastify.close());

  const created = await createGameOverHttp(server.fastify);
  const response = await server.fastify.inject({
    method: 'GET',
    url: `/api/v1/games/${created.gameCode}/state`,
    headers: bearer('tok_dit_token_bestaat_niet'),
  });
  assert.equal(response.statusCode, 401, 'de authenticatiefout moet echt hebben plaatsgevonden');
  assert.equal(response.json().code, 'TOKEN_INVALID');

  const failures = server.records().filter((record) => record.outcome === 'auth_failed');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].code, 'TOKEN_INVALID');
  assert.equal(failures[0].layer, 'rest');
  assert.ok(!server.raw().includes('tok_dit_token_bestaat_niet'), 'het aangeboden token mag nergens in het log staan');
});

test('een onverwachte exception logt een stabiele foutklasse, geen message en geen stack', async (t) => {
  // De poort werpt — precies het geval dat INTB-10 beschrijft (de Redis-adapter
  // blokkeert `loadSessionByTokenHash` nog). De melding is met opzet vol
  // gevoelige waarden: die moeten nergens in het log terechtkomen.
  const store = createInMemoryStore();
  const throwing = {
    ...store,
    async loadSessionByTokenHash() {
      throw new RangeError('Jan Jansen kreeg token tok_geheim op 203.0.113.9');
    },
  };
  const server = await makeLoggingServer({ store: throwing });
  t.after(() => server.fastify.close());

  const response = await server.fastify.inject({
    method: 'GET',
    url: '/api/v1/games/123456/state',
    headers: bearer('tok_wat_dan_ook'),
  });
  // OPZETCONTROLE: zonder een echte 500 bewijst de rest van deze test niets.
  assert.equal(response.statusCode, 500, response.body);
  assert.deepEqual(response.json(), { code: 'INTERNAL_ERROR', meta: {} });

  const serverErrors = server.records().filter((record) => record.msg === 'serverfout');
  assert.equal(serverErrors.length, 1);
  assert.equal(serverErrors[0].reason, 'RangeError', 'alleen de stabiele foutklasse');
  assert.equal(serverErrors[0].outcome, 'server_error');
  assert.equal(serverErrors[0].code, 'INTERNAL_ERROR');
  assert.equal(serverErrors[0].layer, 'rest');

  const raw = server.raw();
  for (const secret of ['Jan Jansen', 'tok_geheim', '203.0.113.9', 'tok_wat_dan_ook', 'at Object']) {
    assert.ok(!raw.includes(secret), `"${secret}" hoort niet in het log`);
  }
  assert.ok(!raw.includes('stack'), 'geen stacktrace, ook niet onder een andere sleutel');
});

test('een routine-verzoek (state ophalen) levert GEEN logregel op — dat zou de echte signalen begraven', async (t) => {
  const server = await makeLoggingServer();
  t.after(() => server.fastify.close());

  const created = await createGameOverHttp(server.fastify);
  const state = await server.fastify.inject({
    method: 'GET',
    url: `/api/v1/games/${created.gameCode}/state`,
    headers: bearer(created.sessionToken),
  });
  // OPZETCONTROLE: dit verzoek moet echt geslaagd zijn, anders bewijst "geen
  // logregel" alleen dat er niets gebeurde.
  assert.equal(state.statusCode, 200, state.body);

  const fromStateFetch = server.records().filter((record) => record.msg !== 'room aangemaakt');
  assert.deepEqual(fromStateFetch, [], 'een geslaagde state-fetch (hoogfrequent, routine) logt niets');
});

// Fase 3 (agent 1, F1/F2 — INT4a wordt hiermee ingelopen): "geslaagd" was
// vóór deze fase gelijk aan "geen logregel", punt. Dat maakte de twee
// milestone-gebeurtenissen die een incident daadwerkelijk na te trekken maken
// — een room ontstaat, een speler komt binnen — even onzichtbaar als een
// routine state-poll. Onderscheid: MIJLPALEN (create/join, laag-frequent,
// één per room-/spelerleven) loggen wél op info; ROUTINEVERZOEKEN
// (state-fetch, hoogfrequent, kan tientallen keren per sessie) niet — dat is
// precies het onderscheid dat de test hierboven nu bewaakt.
test('room aanmaken en joinen loggen elk precies één info-regel met hun roomId', async (t) => {
  const server = await makeLoggingServer();
  t.after(() => server.fastify.close());

  const created = await createGameOverHttp(server.fastify);
  const joinResponse = await server.fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { gameCode: created.gameCode, displayName: null, joinSource: 'code' },
  });
  assert.equal(joinResponse.statusCode, 200, joinResponse.body);

  const createdLines = server.records().filter((record) => record.msg === 'room aangemaakt');
  assert.equal(createdLines.length, 1);
  assert.equal(createdLines[0].roomId, created.roomId);
  assert.equal(createdLines[0].layer, 'rest');
  assert.match(createdLines[0].requestId, /^req-\d+$/);

  const joinedLines = server.records().filter((record) => record.msg === 'speler joint');
  assert.equal(joinedLines.length, 1);
  assert.equal(joinedLines[0].roomId, created.roomId);
  assert.equal(joinedLines[0].layer, 'rest');
});
