import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFastify } from './fake-transport.mjs';
import { runRestEndpointScenario } from './rest-scenario.mjs';
import * as restGamesCreateJoin from '../../../server/protocol/rest-games-create-join.mjs';
import * as restGamesSession from '../../../server/protocol/rest-games-session.mjs';

const restGamesModule = { ...restGamesCreateJoin, ...restGamesSession };

test('runRestEndpointScenario: alle 5 endpointscenario\'s draaien zonder throw', () => {
  const fastify = createFakeFastify();
  assert.doesNotThrow(() => runRestEndpointScenario(fastify, restGamesModule));
});

// Rij 11 — POST /api/v1/games met een geldig voorbeeldpayload uit
// PROTOCOL.md: 2xx, responsvorm exact zoals het PROTOCOL.md-voorbeeld.
test('POST /api/v1/games: geldig PROTOCOL.md-voorbeeld -> 2xx, responsvorm geldig volgens validateCreateGameResponse', () => {
  const fastify = createFakeFastify();
  runRestEndpointScenario(fastify, restGamesModule);

  const response = fastify.inject({
    method: 'POST',
    url: '/api/v1/games',
    payload: { config: { preset: 'group_battle', language: 'nl' }, hostParticipates: true, displayName: null },
  });

  assert.ok(response.statusCode >= 200 && response.statusCode < 300);
  const body = response.json();
  const validation = restGamesCreateJoin.validateCreateGameResponse(body);
  assert.equal(validation.ok, true);
  assert.ok(restGamesCreateJoin.hostParticipatesInvariantHolds({ hostParticipates: true }, body));
});

test('POST /api/v1/games: hostParticipates false -> playerId/effectiveName null (PROTOCOL.md-invariant)', () => {
  const fastify = createFakeFastify();
  runRestEndpointScenario(fastify, restGamesModule);

  const response = fastify.inject({
    method: 'POST',
    url: '/api/v1/games',
    payload: { config: { preset: 'group_battle', language: 'nl' }, hostParticipates: false, displayName: null },
  });

  const body = response.json();
  assert.equal(body.playerId, null);
  assert.equal(body.effectiveName, null);
  assert.ok(restGamesCreateJoin.hostParticipatesInvariantHolds({ hostParticipates: false }, body));
});

// Rij 12 — POST /api/v1/games/join met zowel inviteId als gameCode tegelijk:
// validatiefout — "precies één locator" wordt geschonden.
test('POST /api/v1/games/join: zowel inviteId als gameCode -> validatiefout (precies één locator geschonden)', () => {
  const fastify = createFakeFastify();
  runRestEndpointScenario(fastify, restGamesModule);

  const response = fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { inviteId: 'N4x7pQm2K8tW', gameCode: '482917', displayName: null, joinSource: 'qr' },
  });

  assert.ok(response.statusCode >= 400 && response.statusCode < 500);
});

test('POST /api/v1/games/join: geen van beide locators -> ook validatiefout', () => {
  const fastify = createFakeFastify();
  runRestEndpointScenario(fastify, restGamesModule);

  const response = fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { displayName: null, joinSource: 'code' },
  });

  assert.ok(response.statusCode >= 400 && response.statusCode < 500);
});

// Rij 13 — GET /api/v1/games/{code}/state zonder Authorization-header:
// auth-shape-afwijzing (bv. TOKEN_INVALID), geen 5xx.
test('GET /api/v1/games/{code}/state: zonder Authorization-header -> auth-afwijzing (TOKEN_INVALID), geen 5xx', () => {
  const fastify = createFakeFastify();
  runRestEndpointScenario(fastify, restGamesModule);

  const response = fastify.inject({ method: 'GET', url: '/api/v1/games/482917/state' });

  assert.ok(response.statusCode < 500);
  assert.ok(response.statusCode >= 400);
  assert.equal(response.json().code, 'TOKEN_INVALID');
});

test('GET /api/v1/games/{code}/state: mét geldige Authorization-header -> 2xx, snapshotvorm geldig', () => {
  const fastify = createFakeFastify();
  runRestEndpointScenario(fastify, restGamesModule);

  const response = fastify.inject({
    method: 'GET',
    url: '/api/v1/games/482917/state',
    headers: { authorization: 'Bearer sess_secret_player_token' },
  });

  assert.ok(response.statusCode >= 200 && response.statusCode < 300);
  const body = response.json();
  assert.equal(body.protocolVersion, 'v1');
  assert.equal(body.room.code, '482917');
});

// Rij 14 — GET /api/v1/time: responsvorm { serverTime: number }.
test('GET /api/v1/time: responsvorm { serverTime: number }', () => {
  const fastify = createFakeFastify();
  runRestEndpointScenario(fastify, restGamesModule);

  const response = fastify.inject({ method: 'GET', url: '/api/v1/time' });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(typeof body.serverTime, 'number');
  assert.deepEqual(restGamesSession.validateTimeResponse(body), { ok: true, value: { serverTime: body.serverTime } });
});

// Rij 15 — POST /api/v1/games/{code}/leave met een hostsessie zonder
// spelerrol: NOT_PLAYER-achtige afwijzing.
test('POST /api/v1/games/{code}/leave: hostsessie zonder spelerrol -> NOT_PLAYER-achtige afwijzing', () => {
  const fastify = createFakeFastify();
  runRestEndpointScenario(fastify, restGamesModule);

  const response = fastify.inject({
    method: 'POST',
    url: '/api/v1/games/482917/leave',
    headers: { authorization: 'Bearer sess_secret_host_token', 'x-fixture-role': 'host' },
  });

  assert.ok(response.statusCode >= 400 && response.statusCode < 500);
  assert.equal(response.json().code, 'NOT_PLAYER');
});

test('POST /api/v1/games/{code}/leave: spelersessie -> geaccepteerd', () => {
  const fastify = createFakeFastify();
  runRestEndpointScenario(fastify, restGamesModule);

  const response = fastify.inject({
    method: 'POST',
    url: '/api/v1/games/482917/leave',
    headers: { authorization: 'Bearer sess_secret_player_token', 'x-fixture-role': 'player' },
  });

  assert.ok(response.statusCode >= 200 && response.statusCode < 300);
});

test('runRestEndpointScenario: geeft 5 resultaten terug, elk met endpoint/statusCode/ok', () => {
  const fastify = createFakeFastify();
  const results = runRestEndpointScenario(fastify, restGamesModule);
  assert.equal(results.length, 5);
  for (const result of results) {
    assert.equal(typeof result.endpoint, 'string');
    assert.equal(typeof result.statusCode, 'number');
    assert.equal(typeof result.ok, 'boolean');
  }
});
