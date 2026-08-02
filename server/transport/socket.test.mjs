// Tests voor de Socket.IO-transportlaag.
//
// ECHTE VERBINDING, GEEN FAKE: elke test start een echte `node:http`-server op
// een vrije poort (`listen(0)`), hangt de echte Socket.IO-server eraan en
// verbindt met een echte WebSocket-client die het Engine.IO-v4- en
// Socket.IO-v5-wireformaat spreekt.
//
// WAAROM GEEN `socket.io-client`: die package staat NIET in package.json en
// staat ook niet in node_modules — alleen `socket.io` (server) staat er. De
// opdracht verbood nieuwe dependencies, dus is de client met Node's ingebouwde
// `WebSocket` (Node >= 22) opgebouwd. Hij stond eerder in dit bestand en woont
// nu in `tests/integration/support/socket-io-test-client.mjs`, zodat de
// transport-ketentest daar dezelfde client gebruikt in plaats van een tweede te
// bouwen. Zie het handoff-item: zodra `socket.io-client` als devDependency is
// toegevoegd, kan `createTestClient` door één import worden vervangen.
//
// GEEN WALL-CLOCK-AFHANKELIJKHEID IN DE ASSERTIES: `context.now` is een
// handmatig verzette klok en de servertimers lopen via een geïnjecteerde
// scheduler. De throttle-test verzet dus de klok en niet de echte tijd.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { createInMemoryStore } from '../data/in-memory-store.js';
import { createContext } from '../composition/context.mjs';
import { createRoom, joinRoom } from '../composition/room-lifecycle.mjs';
import { ALL_ERROR_CODES } from '../protocol/error-codes.mjs';
import { createTestClient } from '../../tests/integration/support/socket-io-test-client.mjs';
import { attachSocketServer, roomChannel, sessionChannel, toPublicErrorCode } from './socket.mjs';

const FIXED_NOW = 1_754_136_000_000;
const PEPPER = 'test-pepper-met-ruim-genoeg-bytes';
const TOKEN_PEPPERS = Object.freeze({ version: 'v1', peppers: Object.freeze({ v1: PEPPER }) });
const APP_URL = 'https://play.aseso.nl';
const CONTENT_VERSION = 'test-content-1';
const RENDERER_VERSION = 'flag-renderer-1';

/** Deterministische PRNG (mulberry32) — geen Math.random in de tests. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeClock(start = FIXED_NOW) {
  const clock = {
    value: start,
    now: () => clock.value,
    advance(ms) {
      clock.value += ms;
      return clock.value;
    },
  };
  return clock;
}

/**
 * Scheduler die niets vanzelf laat lopen: de test bepaalt wanneer een geplande
 * fasewissel afgaat. Zonder dit zou elke test op echte seconden wachten.
 */
function makeManualScheduler() {
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
    /** Vuurt alle op dit moment geplande timers precies één keer af. */
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

// ─────────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────────

async function makeHarness(t, { config = {}, seed = 7 } = {}) {
  const clock = makeClock();
  const store = createInMemoryStore();
  const context = createContext({
    store,
    now: clock.now,
    config: {
      tokenPeppers: TOKEN_PEPPERS,
      publicAppUrl: APP_URL,
      contentVersion: CONTENT_VERSION,
      rendererVersion: RENDERER_VERSION,
      random: seededRandom(seed),
      ...config,
    },
  });

  const scheduler = makeManualScheduler();
  const httpServer = createServer();
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const port = httpServer.address().port;
  const attached = attachSocketServer(httpServer, { context, config: { scheduler } });

  /** @type {Array<{ close(): void }>} */
  const clients = [];
  const harness = {
    clock,
    store,
    context,
    scheduler,
    attached,
    port,
    async connect(auth) {
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
    httpServer.closeAllConnections();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  return harness;
}

/** Maakt een room met een meespelende host; geeft de hostsessie terug. */
async function seedRoom(harness, { roomConfig = {} } = {}) {
  const created = await createRoom(harness.context, {
    config: roomConfig,
    hostParticipates: true,
    displayName: 'Host',
  });
  assert.equal(created.ok, true, 'createRoom moet slagen');
  return created.value;
}

/** Voegt een speler toe via de echte joinflow en geeft diens sessie terug. */
async function seedPlayer(harness, room, displayName) {
  const joined = await joinRoom(harness.context, {
    gameCode: room.gameCode,
    displayName,
    joinSource: 'code',
  });
  assert.equal(joined.ok, true, `joinRoom moet slagen voor ${displayName}`);
  return joined.value;
}

const authFor = (session) => ({ sessionToken: session.sessionToken, protocolVersion: 'v1' });

/** Laat de microtask-queue leeglopen zodat `after`-emissies zijn verstuurd. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

// ─────────────────────────────────────────────────────────────────────────────
// Handshake
// ─────────────────────────────────────────────────────────────────────────────

test('handshake: een geldig sessietoken verbindt en koppelt room, sessie en speler', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);

  const client = await harness.connect(authFor(room));
  assert.ok(client, 'client moet verbonden zijn');

  const sockets = await harness.attached.io.fetchSockets();
  assert.equal(sockets.length, 1);
  assert.equal(sockets[0].data.roomId, room.roomId);
  assert.equal(sockets[0].data.sessionId, room.sessionId);
  assert.equal(sockets[0].data.playerId, room.playerId);
  assert.deepEqual(sockets[0].data.roles, ['host', 'player']);

  // De socket zit in zowel de room- als de sessiechannel: dat is de basis
  // onder matrixrij 11 en onder `single_session`-events.
  assert.ok(sockets[0].rooms.has(roomChannel(room.roomId)));
  assert.ok(sockets[0].rooms.has(sessionChannel(room.sessionId)));
});

test('handshake: een onbekend sessietoken wordt geweigerd met TOKEN_INVALID', async (t) => {
  const harness = await makeHarness(t);
  await seedRoom(harness);

  await assert.rejects(
    () => harness.connect({ sessionToken: 'dit-token-bestaat-niet', protocolVersion: 'v1' }),
    (error) => {
      assert.equal(error.data.code, 'TOKEN_INVALID');
      assert.deepEqual(error.data.meta, {});
      return true;
    },
  );
  assert.equal((await harness.attached.io.fetchSockets()).length, 0);
});

test('handshake: een ingetrokken sessie wordt geweigerd met SESSION_REVOKED', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const player = await seedPlayer(harness, room, 'Speler');

  const session = await harness.store.loadSession(room.roomId, player.sessionId);
  await harness.store.saveSession({ ...session, revoked: true });

  await assert.rejects(
    () => harness.connect(authFor(player)),
    (error) => {
      assert.equal(error.data.code, 'SESSION_REVOKED');
      return true;
    },
  );
});

test('handshake: een niet-ondersteunde protocolVersion wordt geweigerd met PROTOCOL_VERSION_UNSUPPORTED', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);

  await assert.rejects(
    () => harness.connect({ sessionToken: room.sessionToken, protocolVersion: 'v2' }),
    (error) => {
      assert.equal(error.data.code, 'PROTOCOL_VERSION_UNSUPPORTED');
      return true;
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Client → server, ack en idempotentie
// ─────────────────────────────────────────────────────────────────────────────

test('client→server: game:lock levert een ack in de PROTOCOL.md-vorm én een room:lock-changed', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const host = await harness.connect(authFor(room));

  const ack = await host.emitWithAck('game:lock', { actionId: 'act_lock_1', payload: { locked: true } });

  assert.equal(ack.actionId, 'act_lock_1');
  assert.equal(ack.ok, true);
  assert.equal(ack.serverTime, FIXED_NOW);
  assert.deepEqual(ack.payload, { locked: true });

  const broadcast = await host.waitFor('room:lock-changed');
  assert.equal(broadcast.event, 'room:lock-changed');
  assert.equal(broadcast.serverTime, FIXED_NOW);
  assert.ok(broadcast.eventId.startsWith('evt_'));
  assert.deepEqual(broadcast.payload, { locked: true });

  assert.equal((await harness.store.loadRoom(room.roomId)).locked, true);
});

test('client→server: een verkeerde rol levert NOT_HOST en muteert niets', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const player = await seedPlayer(harness, room, 'Speler');
  const client = await harness.connect(authFor(player));

  const ack = await client.emitWithAck('game:lock', { actionId: 'act_x', payload: { locked: true } });
  assert.equal(ack.ok, false);
  assert.equal(ack.payload.code, 'NOT_HOST');

  const errorEvent = await client.waitFor('error');
  assert.deepEqual(errorEvent.payload, { actionId: 'act_x', code: 'NOT_HOST', meta: {} });

  assert.equal((await harness.store.loadRoom(room.roomId)).locked, false);
});

test('client→server: een onbekend event levert UNSUPPORTED_EVENT', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const host = await harness.connect(authFor(room));

  const ack = await host.emitWithAck('game:teleport', { actionId: 'act_u', payload: {} });
  assert.equal(ack.ok, false);
  assert.equal(ack.payload.code, 'UNSUPPORTED_EVENT');
});

test('idempotentie: dezelfde actionId geeft dezelfde ack en herhaalt de mutatie niet', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const host = await harness.connect(authFor(room));

  const first = await host.emitWithAck('game:lock', { actionId: 'act_same', payload: { locked: true } });
  assert.equal(first.ok, true);
  assert.deepEqual(first.payload, { locked: true });
  await host.waitFor('room:lock-changed');

  // Zelfde actionId, ANDERE inhoud: de retry mag niets doen en moet de
  // oorspronkelijke ack teruggeven (PROTOCOL.md §Ack).
  harness.clock.advance(5_000);
  const retry = await host.emitWithAck('game:lock', { actionId: 'act_same', payload: { locked: false } });

  assert.deepEqual(retry, first, 'de retry moet exact dezelfde ack-envelope opleveren');
  assert.equal((await harness.store.loadRoom(room.roomId)).locked, true, 'de mutatie mag niet zijn herhaald');

  await settle();
  assert.equal(host.eventsNamed('room:lock-changed').length, 1, 'een replay mag geen tweede broadcast opleveren');
});

// ─────────────────────────────────────────────────────────────────────────────
// Matrixrij 11 — roomisolatie
// ─────────────────────────────────────────────────────────────────────────────

test('matrixrij 11: twee gelijktijdige rooms lekken geen state naar elkaar', async (t) => {
  const harness = await makeHarness(t);

  const roomA = await seedRoom(harness);
  const roomB = await seedRoom(harness);
  assert.notEqual(roomA.roomId, roomB.roomId);

  const playerA = await seedPlayer(harness, roomA, 'A-speler');
  const playerB = await seedPlayer(harness, roomB, 'B-speler');

  const hostA = await harness.connect(authFor(roomA));
  const clientA = await harness.connect(authFor(playerA));
  const hostB = await harness.connect(authFor(roomB));
  const clientB = await harness.connect(authFor(playerB));

  // Eén hostactie in room A, één in room B — tegelijk actief.
  await hostA.emitWithAck('game:lock', { actionId: 'act_a', payload: { locked: true } });
  await hostB.emitWithAck('game:start', { actionId: 'act_b', payload: {} });
  await settle();

  // Room A ziet uitsluitend zijn eigen lock-event.
  assert.equal(clientA.eventsNamed('room:lock-changed').length, 1);
  assert.equal(clientA.eventsNamed('game:started').length, 0, 'room A mag game:started van room B niet zien');

  // Room B ziet uitsluitend zijn eigen start-event.
  assert.equal(clientB.eventsNamed('game:started').length, 1);
  assert.equal(clientB.eventsNamed('room:lock-changed').length, 0, 'room B mag room:lock-changed van room A niet zien');

  // En de payloads verwijzen naar de eigen room, niet naar de andere.
  const startedB = clientB.eventsNamed('game:started')[0].envelope.payload;
  const matchB = (await harness.store.loadRoom(roomB.roomId)).currentMatchId;
  assert.equal(startedB.matchId, matchB);
  assert.equal((await harness.store.loadRoom(roomA.roomId)).currentMatchId, null);
  assert.equal((await harness.store.loadRoom(roomB.roomId)).locked, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Matrixrij 13 — round:progress-throttling
// ─────────────────────────────────────────────────────────────────────────────

/** Start een match en opent de eerste ronde; geeft de `round:started`-payload terug. */
async function startFirstRound(harness, host) {
  await host.emitWithAck('game:start', { actionId: 'act_start', payload: {} });
  await host.waitFor('game:started');
  // De COUNTDOWN-timer staat gepland op een absoluut tijdstip; de test laat hem
  // afgaan in plaats van drie echte seconden te wachten.
  harness.clock.advance(3_000);
  await harness.scheduler.fireAll();
  return host.waitFor('round:started');
}

test('matrixrij 13: round:progress wordt maximaal tweemaal per seconde gebroadcast, ongeacht het aantal antwoorden', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);

  const players = [];
  for (const name of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
    players.push(await seedPlayer(harness, room, name));
  }

  const host = await harness.connect(authFor(room));
  const clients = [];
  for (const player of players) {
    clients.push(await harness.connect(authFor(player)));
  }

  const started = await startFirstRound(harness, host);
  const { roundId, question } = started.payload;
  assert.equal(started.payload.gameType, 'flags_mc');
  assert.ok(!('correctAnswer' in started.payload), 'round:started draagt nooit het correcte antwoord');

  const answer = { optionId: question.optionIso2s[0] };

  // Vier antwoorden op EXACT hetzelfde tijdstip: het rollende venster van 1000
  // ms laat er maximaal twee door.
  for (let index = 0; index < 4; index += 1) {
    const ack = await clients[index].emitWithAck('round:answer', {
      actionId: `act_answer_${index}`,
      payload: { roundId, answer, clientAnsweredAt: harness.clock.now() },
    });
    assert.equal(ack.ok, true, `antwoord ${index} moet geaccepteerd worden`);
  }
  await settle();

  assert.equal(host.eventsNamed('round:progress').length, 2, 'vier antwoorden binnen één seconde geven precies twee broadcasts');

  // Het venster rolt door; daarna mogen er weer twee.
  harness.clock.advance(1_200);
  for (let index = 4; index < 6; index += 1) {
    const ack = await clients[index].emitWithAck('round:answer', {
      actionId: `act_answer_${index}`,
      payload: { roundId, answer, clientAnsweredAt: harness.clock.now() },
    });
    assert.equal(ack.ok, true);
  }
  await settle();

  assert.equal(host.eventsNamed('round:progress').length, 4, 'na het rollende venster mogen er opnieuw twee door');

  // De payload is de letterlijke vorm uit PROTOCOL.md en telt echt mee.
  const last = host.eventsNamed('round:progress').at(-1).envelope.payload;
  assert.deepEqual(Object.keys(last).sort(), ['answeredCount', 'eligiblePlayerCount']);
  assert.equal(last.eligiblePlayerCount, 7, 'zes joiners plus de meespelende host');
  assert.equal(last.answeredCount, 6);

  // Elke antwoordende speler kreeg zijn eigen `round:answer-accepted`, en
  // niemand anders die van een ander.
  for (const client of clients) {
    assert.equal(client.eventsNamed('round:answer-accepted').length, 1);
  }
  assert.equal(host.eventsNamed('round:answer-accepted').length, 0, 'de host antwoordde niet en krijgt dus niets persoonlijks');
});

test('round:answer: een retry met dezelfde actionId geeft dezelfde ack en telt niet dubbel mee', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const player = await seedPlayer(harness, room, 'P1');

  const host = await harness.connect(authFor(room));
  const client = await harness.connect(authFor(player));

  const started = await startFirstRound(harness, host);
  const { roundId, question } = started.payload;
  const answer = { optionId: question.optionIso2s[0] };

  const first = await client.emitWithAck('round:answer', {
    actionId: 'act_answer_same',
    payload: { roundId, answer, clientAnsweredAt: harness.clock.now() },
  });
  assert.equal(first.ok, true);
  await settle();

  const retry = await client.emitWithAck('round:answer', {
    actionId: 'act_answer_same',
    payload: { roundId, answer, clientAnsweredAt: harness.clock.now() },
  });
  assert.deepEqual(retry, first);
  await settle();

  assert.equal(host.eventsNamed('round:progress').length, 1, 'een replay mag geen tweede voortgangsbroadcast opleveren');
  assert.equal(client.eventsNamed('round:answer-accepted').length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Foutafhandeling — besluit 12
// ─────────────────────────────────────────────────────────────────────────────

test('toPublicErrorCode beeldt elke niet-gepubliceerde code af op een gepubliceerde', () => {
  // Besluit 12: `INVALID_PAUSE_STATE` blijft intern en mag nooit de wire halen.
  assert.equal(toPublicErrorCode('INVALID_PAUSE_STATE'), 'INVALID_PHASE');
  assert.equal(toPublicErrorCode('EEN_NOG_NIET_BEDACHTE_INTERNE_CODE'), 'INVALID_PHASE');
  assert.equal(toPublicErrorCode(undefined), 'INVALID_PHASE');
  // Gepubliceerde codes gaan ongewijzigd door.
  for (const code of ALL_ERROR_CODES) {
    assert.equal(toPublicErrorCode(code), code);
  }
});

test('een interne foutcode komt nooit bij een client aan', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const host = await harness.connect(authFor(room));

  // Pauzeren tijdens COUNTDOWN: `remainingMs` is dan niet uit persistente state
  // af te leiden, waardoor de state machine intern `INVALID_PAUSE_STATE`
  // oplevert (server/architecture/state-machine.js, besluit 12).
  await host.emitWithAck('game:start', { actionId: 'act_start', payload: {} });
  await host.waitFor('game:started');

  const ack = await host.emitWithAck('game:pause', { actionId: 'act_pause', payload: {} });

  assert.equal(ack.ok, false);
  assert.notEqual(ack.payload.code, 'INVALID_PAUSE_STATE');
  assert.ok(ALL_ERROR_CODES.has(ack.payload.code), `ack-code "${ack.payload.code}" moet een gepubliceerde code zijn`);

  const errorEvent = await host.waitFor('error');
  assert.notEqual(errorEvent.payload.code, 'INVALID_PAUSE_STATE');
  assert.ok(ALL_ERROR_CODES.has(errorEvent.payload.code));
  assert.deepEqual(errorEvent.payload.meta, {}, 'geen metadata, dus ook geen stacktrace of displaynaam');

  // Geen enkel binnengekomen event bevat ergens de interne codenaam.
  const wire = JSON.stringify(host.received);
  assert.ok(!wire.includes('INVALID_PAUSE_STATE'));
  assert.ok(!wire.includes('sessionToken'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot
// ─────────────────────────────────────────────────────────────────────────────

test('room:state gaat naar één sessie en bevat tijdens een actieve ronde geen correct antwoord', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const player = await seedPlayer(harness, room, 'P1');

  const host = await harness.connect(authFor(room));
  const client = await harness.connect(authFor(player));

  await startFirstRound(harness, host);

  const sent = await harness.attached.sendSnapshot(room.roomId, player.sessionId);
  assert.equal(sent.ok, true);

  const snapshot = await client.waitFor('room:state');
  assert.equal(snapshot.payload.room.phase, 'ROUND_ACTIVE');
  assert.equal(snapshot.payload.self.playerId, player.playerId);
  assert.ok(!('correctAnswer' in snapshot.payload.currentRound));

  await settle();
  assert.equal(host.eventsNamed('room:state').length, 0, 'room:state is een single_session-event');
});

test('game:kick meldt de gekickte sessie persoonlijk en de room het nieuwe aantal', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const target = await seedPlayer(harness, room, 'Weg');
  const bystander = await seedPlayer(harness, room, 'Blijft');

  const host = await harness.connect(authFor(room));
  const targetClient = await harness.connect(authFor(target));
  const bystanderClient = await harness.connect(authFor(bystander));

  const ack = await host.emitWithAck('game:kick', { actionId: 'act_kick', payload: { playerId: target.playerId } });
  assert.equal(ack.ok, true);

  const kicked = await targetClient.waitFor('session:kicked');
  assert.equal(kicked.payload.reason, 'host');

  const changed = await host.waitFor('room:player-changed');
  assert.deepEqual(changed.payload, { playerCount: 2, delta: { type: 'kick', playerId: target.playerId } });

  await settle();
  assert.equal(bystanderClient.eventsNamed('session:kicked').length, 0, 'session:kicked is een single_session-event');
});

test('broadcastPlayerChanged geeft de REST-laag een ingang voor room:player-changed', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const host = await harness.connect(authFor(room));

  // Joinen loopt over REST, niet over de socket — de room moet het toch horen.
  const joined = await seedPlayer(harness, room, 'Laatkomer');
  await harness.attached.broadcastPlayerChanged(room.roomId, { type: 'join', playerId: joined.playerId });

  const changed = await host.waitFor('room:player-changed');
  assert.deepEqual(changed.payload, { playerCount: 2, delta: { type: 'join', playerId: joined.playerId } });
});

// ─────────────────────────────────────────────────────────────────────────────
// Opruimen
// ─────────────────────────────────────────────────────────────────────────────

test('close() verbreekt alle verbindingen en laat geen timers achter', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const host = await harness.connect(authFor(room));

  await host.emitWithAck('game:start', { actionId: 'act_start', payload: {} });
  await host.waitFor('game:started');
  assert.equal(harness.scheduler.pending, 1, 'de countdown staat gepland');

  await harness.attached.close();

  assert.equal(harness.scheduler.pending, 0, 'close() ruimt de geplande timers op');
  assert.equal((await harness.attached.io.fetchSockets()).length, 0);

  // Tweemaal sluiten is veilig (de harness sluit hierna nog een keer).
  await harness.attached.close();
});
