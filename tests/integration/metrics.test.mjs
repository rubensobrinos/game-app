// tests/integration/metrics.test.mjs
//
// STAP 9 uit docs/PLAN-CONVERGENTIE.md — de operationele metrics, met de
// afscherming en de kardinaliteits-/privacy-eisen uit INT4b-metrics.md.
//
// De tellers worden hier NOOIT rechtstreeks opgehoogd: elke assertie loopt via
// een echte handeling (een echte join, een echt verzoek), want een teller die
// je zelf ophoogt bewijst niets over de bedrading.

import test from 'node:test';
import assert from 'node:assert/strict';

import { startTransportServer } from './support/transport-harness.mjs';

const SECRET = 'pilot-metrics-secret-ruim-lang-genoeg';
const CREATE_BODY = Object.freeze({ preset: 'quick_start', language: 'nl' });

/** De labelnamen die in de uitvoer mogen voorkomen (INT4b-allowlist). */
const TOEGESTANE_LABELS = new Set(['event', 'code', 'outcome', 'reason', 'method', 'le']);

/** @returns {Array<{ naam: string, labels: Record<string,string> }>} elke reeks in de uitvoer */
function parseReeksen(tekst) {
  const reeksen = [];
  for (const regel of tekst.split('\n')) {
    if (regel.startsWith('#') || regel.trim().length === 0) continue;
    const match = regel.match(/^([a-z_]+)(\{([^}]*)\})?\s/);
    if (match === null) continue;
    const labels = {};
    for (const paar of (match[3] ?? '').split(',').filter(Boolean)) {
      const [naam, waarde] = paar.split('=');
      labels[naam] = waarde.replace(/"/g, '');
    }
    reeksen.push({ naam: match[1], labels });
  }
  return reeksen;
}

test('§stap 9: zonder secret bestaat /metrics niet (404) — nooit een onbeveiligd endpoint', async (t) => {
  const server = await startTransportServer(t, { redisUrl: null });
  const respons = await server.get('/metrics');
  assert.equal(respons.status, 404, 'geen secret betekent geen route');
});

test('§stap 9: met secret geeft /metrics 401 zonder en met een verkeerde bearer, 200 met de juiste', async (t) => {
  const server = await startTransportServer(t, { redisUrl: null, metricsSecret: SECRET });

  assert.equal((await server.get('/metrics')).status, 401, 'zonder header');
  assert.equal((await server.get('/metrics', { authorization: 'Bearer fout' })).status, 401, 'verkeerd secret');
  assert.equal(
    (await server.get('/metrics', { authorization: `Bearer ${SECRET}x` })).status,
    401,
    'bijna goed is niet goed',
  );

  const ok = await server.get('/metrics', { authorization: `Bearer ${SECRET}` });
  assert.equal(ok.status, 200);
  assert.match(String(ok.body), /rounda_/, 'de uitvoer draagt onze metrics');
});

test('§stap 9: een echte join hoogt rounda_joins_total op, per methode', async (t) => {
  const server = await startTransportServer(t, { redisUrl: null, metricsSecret: SECRET });

  const gemaakt = await server.post('/api/v1/games', {
    body: { config: CREATE_BODY, hostParticipates: true, displayName: null },
  });
  assert.equal(gemaakt.status, 201, JSON.stringify(gemaakt.body));

  const join = await server.post('/api/v1/games/join', {
    body: { gameCode: gemaakt.body.gameCode, joinSource: 'qr', displayName: 'Vlugge Vos' },
  });
  assert.equal(join.status, 200, JSON.stringify(join.body));

  const metrics = String((await server.get('/metrics', { authorization: `Bearer ${SECRET}` })).body);
  assert.match(metrics, /rounda_joins_total\{method="qr"\} 1/);
});

test('§stap 9: kardinaliteit — alleen toegestane labels, en vijftig rooms geven geen vijftig reeksen', async (t) => {
  const server = await startTransportServer(t, { redisUrl: null, metricsSecret: SECRET });

  const eersteRoom = await server.post('/api/v1/games', {
    body: { config: CREATE_BODY, hostParticipates: true, displayName: null },
  });
  assert.equal(eersteRoom.status, 201, JSON.stringify(eersteRoom.body));
  await server.post('/api/v1/games/join', {
    body: { gameCode: eersteRoom.body.gameCode, joinSource: 'code', displayName: null },
  });
  const voor = parseReeksen(String((await server.get('/metrics', { authorization: `Bearer ${SECRET}` })).body)).length;

  // Vijftig rooms erbij: elke room mag GEEN eigen tijdreeks opleveren.
  for (let i = 0; i < 50; i += 1) {
    const room = await server.post('/api/v1/games', {
      body: { config: CREATE_BODY, hostParticipates: true, displayName: null },
    });
    assert.equal(room.status, 201);
    await server.post('/api/v1/games/join', {
      body: { gameCode: room.body.gameCode, joinSource: 'code', displayName: null },
    });
  }

  const uitvoer = String((await server.get('/metrics', { authorization: `Bearer ${SECRET}` })).body);
  const reeksen = parseReeksen(uitvoer);
  assert.equal(reeksen.length, voor, 'vijftig rooms erbij, geen enkele reeks erbij');

  for (const reeks of reeksen) {
    for (const naam of Object.keys(reeks.labels)) {
      assert.ok(TOEGESTANE_LABELS.has(naam), `verboden labelnaam in de uitvoer: ${naam}`);
    }
  }
  for (const verboden of ['roomId', 'sessionId', 'playerId', 'actionId', 'eventId', 'gameCode', 'inviteId']) {
    assert.equal(uitvoer.includes(verboden), false, `${verboden} hoort nooit in metrics te staan`);
  }
});

test('§stap 9: privacy — een gamecode en een displaynaam komen niet in de uitvoer terecht', async (t) => {
  const server = await startTransportServer(t, { redisUrl: null, metricsSecret: SECRET });

  const gemaakt = await server.post('/api/v1/games', {
    body: { config: CREATE_BODY, hostParticipates: true, displayName: null },
  });
  assert.equal(gemaakt.status, 201, JSON.stringify(gemaakt.body));
  const naam = 'Ruben Testnaam';
  const join = await server.post('/api/v1/games/join', {
    body: { gameCode: gemaakt.body.gameCode, joinSource: 'shared_link', displayName: naam },
  });
  assert.equal(join.status, 200, JSON.stringify(join.body));

  const uitvoer = String((await server.get('/metrics', { authorization: `Bearer ${SECRET}` })).body);
  assert.equal(uitvoer.includes(gemaakt.body.gameCode), false, 'de gamecode staat niet in de metrics');
  assert.equal(uitvoer.includes(naam), false, 'de displaynaam staat niet in de metrics');
  assert.equal(uitvoer.includes(gemaakt.body.inviteId), false, 'de inviteId ook niet');
});

test('§stap 9: het herstelpad meldt zijn poging (C-3)', async (t) => {
  const server = await startTransportServer(t, { redisUrl: null, metricsSecret: SECRET });
  const uitvoer = String((await server.get('/metrics', { authorization: `Bearer ${SECRET}` })).body);
  assert.match(uitvoer, /rounda_recovery_attempts_total\{outcome="ok"\} 1/);
});
