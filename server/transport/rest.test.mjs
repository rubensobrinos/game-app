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

/** Alleen de REST-plugin, met een handmatig samengestelde context. */
async function makeRestOnlyServer(context) {
  const fastify = Fastify();
  await fastify.register(restRoutes, { context, prefix: REST_PREFIX });
  await fastify.ready();
  return fastify;
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
    ['effectiveName', 'gameCode', 'inviteId', 'joinUrl', 'playerId', 'roles', 'roomId', 'sessionToken', 'state'],
  );
  assert.match(body.gameCode, /^[0-9]{6}$/);
  assert.equal(body.joinUrl, `https://play.aseso.nl/j/${body.inviteId}`);
  assert.deepEqual(body.roles, ['host', 'player']);
  assert.equal(body.effectiveName, 'Host');
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

test('POST /api/v1/games — validatiefout: hostParticipates ontbreekt → 400 INVITE_INVALID', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/v1/games',
    payload: { config: { preset: 'quick_start', language: 'nl' }, displayName: null },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { code: 'INVITE_INVALID', meta: {} });
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
    ['effectiveName', 'gameCode', 'playerId', 'roles', 'roomId', 'sessionToken', 'state'],
  );
  assert.deepEqual(body.roles, ['player']);
  assert.equal(body.effectiveName, 'Ruben');
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
  // De match starten: pas dán heeft de snapshot een matchId/matchSequence en
  // haalt hij `validateSnapshotShape`. Zie het handoff-item over de LOBBY-vorm.
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

test('GET /api/v1/games/{code}/state — OPENSTAAND GAT: een LOBBY-snapshot haalt validateSnapshotShape niet', async (t) => {
  // Documenteert het handoff-item, geen goedkeuring ervan: `snapshot-shape.mjs`
  // eist een niet-lege `matchId` en `matchSequence >= 1`, terwijl een room in
  // LOBBY nog geen match heeft. De transportlaag bouwt daar bewust NIET omheen
  // en geeft dus een 500 in plaats van een ongekeurde snapshot. Zodra PR de
  // validator (of de compositie) repareert, moet deze test omdraaien naar 200.
  const fastify = await makeServer();
  t.after(() => fastify.close());
  const created = await createGameOverHttp(fastify);

  const response = await fastify.inject({
    method: 'GET',
    url: `/api/v1/games/${created.gameCode}/state`,
    headers: bearer(created.sessionToken),
  });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), { code: 'INTERNAL_ERROR', meta: {} });
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

test('/readyz blijft 503 met reden zolang er geen Redis onder hangt', async (t) => {
  const fastify = await makeServer();
  t.after(() => fastify.close());

  const response = await fastify.inject({ method: 'GET', url: '/readyz' });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().ok, false);
  assert.match(response.json().reason, /Redis/);
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
