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
    /**
     * De nog geplande callbacks, ZONDER ze te verwijderen. De race-test heeft
     * dit nodig: hij wil de échte `runAdvanceOnTimer` van de transportlaag
     * tweemaal gelijktijdig starten in plaats van een gemockte returnwaarde te
     * verzinnen.
     */
    pendingFns() {
      return [...timers.values()];
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

/** Vangt op wat de socketlaag werkelijk logt. */
function makeCapturingLogger() {
  /** @type {Array<{ level: string, record: object, message: string }>} */
  const lines = [];
  const push = (level) => (record, message) => lines.push({ level, record, message });
  return {
    lines,
    logger: { info: push('info'), warn: push('warn'), error: push('error') },
    /** Alle regels met deze boodschap. */
    named(message) {
      return lines.filter((line) => line.message === message);
    },
  };
}

async function makeHarness(t, { config = {}, seed = 7, wrapStore = (store) => store, store: sharedStore = null, clock: sharedClock = null } = {}) {
  // `store`/`clock` meegeven simuleert een SERVERHERSTART: een tweede
  // socketserver op dezelfde persistente state, met een volledig leeg
  // runtimegeheugen (§A2).
  const clock = sharedClock ?? makeClock();
  const rawStore = sharedStore ?? createInMemoryStore();
  const store = sharedStore ?? wrapStore(rawStore);
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
  const log = makeCapturingLogger();
  const httpServer = createServer();
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const port = httpServer.address().port;
  const attached = attachSocketServer(httpServer, { context, config: { scheduler, logger: log.logger } });

  /** @type {Array<{ close(): void }>} */
  const clients = [];
  const harness = {
    clock,
    store,
    rawStore,
    context,
    scheduler,
    log,
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

test('player:leave laat de speler zelf vertrekken: room:player-changed uit, maar geen geforceerde disconnect of sessie-intrekking', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const target = await seedPlayer(harness, room, 'Vertrekker');
  const bystander = await seedPlayer(harness, room, 'Blijft');

  const host = await harness.connect(authFor(room));
  const targetClient = await harness.connect(authFor(target));
  await harness.connect(authFor(bystander));

  const ack = await targetClient.emitWithAck('player:leave', { actionId: 'act_leave', payload: {} });
  assert.equal(ack.ok, true);

  const changed = await host.waitFor('room:player-changed');
  assert.deepEqual(changed.payload, { playerCount: 2, delta: { type: 'leave', playerId: target.playerId } });

  // In tegenstelling tot een kick: geen session:kicked, en dus geen geforceerde
  // disconnect — een tweede aanroep op dezelfde socket moet nog gewoon lukken.
  await settle();
  assert.equal(targetClient.eventsNamed('session:kicked').length, 0);
  const secondAck = await targetClient.emitWithAck('game:lock', { actionId: 'act_x', payload: { locked: true } });
  assert.equal(secondAck.ok, false, 'geen host-rol, dus afgewezen — maar de socket verwerkt de aanroep nog wél');
});

test('een tweede player:leave van dezelfde speler zendt geen tweede room:player-changed uit', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const target = await seedPlayer(harness, room, 'Vertrekker');

  const host = await harness.connect(authFor(room));
  const targetClient = await harness.connect(authFor(target));

  assert.equal((await targetClient.emitWithAck('player:leave', { actionId: 'act_leave_1', payload: {} })).ok, true);
  await host.waitFor('room:player-changed');

  assert.equal((await targetClient.emitWithAck('player:leave', { actionId: 'act_leave_2', payload: {} })).ok, true);
  await settle();
  assert.equal(host.eventsNamed('room:player-changed').length, 1);
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

// ─────────────────────────────────────────────────────────────────────────────
// INT4a — traceerbaarheid
// ─────────────────────────────────────────────────────────────────────────────

test('logregels dragen roomId en sessionId zodra de handshake ze kent', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);

  const client = await harness.connect(authFor(room));
  assert.ok(client, 'de verbinding moet echt staan');
  assert.equal((await harness.attached.io.fetchSockets()).length, 1, 'anders bewijst het log hieronder niets');

  const connected = harness.log.named('socket verbonden');
  assert.equal(connected.length, 1);
  assert.deepEqual(connected[0].record, { roomId: room.roomId, sessionId: room.sessionId, layer: 'socket' });
});

test('een uitgaand serverevent logt werkelijk zijn eventId', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const host = await harness.connect(authFor(room));

  // OPZETCONTROLE: het event moet echt de deur uit zijn gegaan, anders zegt
  // een logregel over een eventId niets.
  const ack = await host.emitWithAck('game:lock', { actionId: 'act_lock_1', payload: { locked: true } });
  assert.equal(ack.ok, true);
  const broadcast = await host.waitFor('room:lock-changed');
  assert.ok(broadcast.eventId.startsWith('evt_'), 'de client ontving een eventId');

  const published = harness.log.named('serverevent verstuurd')
    .filter((line) => line.record.event === 'room:lock-changed');
  assert.equal(published.length, 1, 'precies één logregel voor dit ene event');
  assert.equal(
    published[0].record.eventId,
    broadcast.eventId,
    'het gelogde eventId moet HETZELFDE zijn als dat op de wire — anders correleert het niets',
  );
  assert.equal(published[0].record.roomId, room.roomId);
  assert.equal(published[0].record.layer, 'socket');
});

test('een geweigerde clientactie logt haar actionId, de interne uitkomst én de publieke code', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const player = await seedPlayer(harness, room, 'Speler');
  const client = await harness.connect(authFor(player));

  const ack = await client.emitWithAck('game:lock', { actionId: 'act_rol_1', payload: { locked: true } });
  assert.equal(ack.ok, false, 'de afwijzing moet echt hebben plaatsgevonden');
  assert.equal(ack.payload.code, 'NOT_HOST');

  const rejected = harness.log.named('clientevent geweigerd');
  assert.equal(rejected.length, 1);
  assert.deepEqual(rejected[0].record, {
    layer: 'socket',
    roomId: room.roomId,
    sessionId: player.sessionId,
    event: 'game:lock',
    actionId: 'act_rol_1',
    outcome: 'rejected',
    code: 'NOT_HOST',
  });
});

test('INTERNAL_ERROR_CODES: INVALID_PAUSE_STATE is al vóór deze laag vertaald — vastgelegd gat', async (t) => {
  // INT4a vroeg `INTERNAL_ERROR_CODES` (state-machine.js, vandaag alleen
  // `INVALID_PAUSE_STATE`) na te lopen op dezelfde vermomming als
  // `PHASE_RACE_LOST`. BEVINDING: die vermomming bestaat, maar niet hier.
  // `applyTransition()` in server/composition/match-lifecycle.mjs geeft
  // `fail(toWireCode(result.code))` terug (regels 544, 799, 956, 1035), dus de
  // transportlaag KRIJGT `INVALID_PAUSE_STATE` nooit te zien — hij krijgt al
  // `INVALID_PHASE` binnen en kan het verschil niet meer maken.
  // `PHASE_RACE_LOST` ontsnapt daaraan doordat `phaseConflict()` hem buiten
  // `toWireCode` om teruggeeft; alleen dáárom kon INT4a hem hier repareren.
  //
  // Deze test legt de huidige, eerlijke stand vast in plaats van te doen alsof
  // het gat gedicht is. Repareren vraagt een wijziging in server/composition/,
  // en dat is andermans eigendom — zie het handoff-item.
  const harness = await makeHarness(t);
  const room = await seedRoom(harness);
  const host = await harness.connect(authFor(room));

  // Pauzeren tijdens COUNTDOWN levert intern `INVALID_PAUSE_STATE`
  // (besluit 12).
  await host.emitWithAck('game:start', { actionId: 'act_start', payload: {} });
  await host.waitFor('game:started');
  const ack = await host.emitWithAck('game:pause', { actionId: 'act_pause', payload: {} });
  assert.equal(ack.ok, false, 'de interne fout moet zich echt hebben voorgedaan');
  assert.equal(ack.payload.code, 'INVALID_PHASE', 'de CLIENT krijgt de publieke code — dat verandert niet');

  const rejected = harness.log.named('clientevent geweigerd')
    .filter((line) => line.record.event === 'game:pause');
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].record.code, 'INVALID_PHASE');
  assert.equal(
    rejected[0].record.outcome,
    'rejected',
    'zodra de compositielaag INVALID_PAUSE_STATE ongefilterd doorgeeft, hoort hier "invalid_pause_state" te staan',
  );
});

// ── De race-test ─────────────────────────────────────────────────────────────
//
// GEEN `Promise.all()` OP TWEE FASEWISSELS. Dat geeft een timinggevoelige test
// die soms groen wordt zonder dat er ooit een race was: als de eerste aanroep
// helemaal klaar is voordat de tweede begint, verliest de tweede op een gewone
// fasecontrole en niet op de compare-and-set. Hieronder staat bestuurde
// gelijktijdigheid: de échte compositie, de échte dubbele compare-and-set van
// `setRoomAndMatchPhaseAtomically`, en een barrière IN DE STORE die beide
// aanroepen vasthoudt op precies het punt vóór de atomaire claim.

/**
 * Wikkelt de store zodat `setRoomAndMatchPhaseAtomically` kan worden
 * vastgehouden vlak vóór de atomaire claim. Alles eromheen — lezen, de
 * boekhoud-`saveMatch`, de reducer — draait onaangeroerd door.
 */
function makeCasBarrier() {
  /** @type {Array<{ args: unknown[], release: () => void, settled: Promise<object> }>} */
  const arrivals = [];
  let armed = false;

  function wrap(store) {
    return {
      ...store,
      async setRoomAndMatchPhaseAtomically(...args) {
        if (!armed) {
          return store.setRoomAndMatchPhaseAtomically(...args);
        }
        let release;
        let settle;
        const held = new Promise((resolve) => { release = resolve; });
        const settled = new Promise((resolve) => { settle = resolve; });
        arrivals.push({ args, release, settled });
        await held;
        const result = await store.setRoomAndMatchPhaseAtomically(...args);
        settle(result);
        return result;
      },
    };
  }

  return {
    wrap,
    arrivals,
    arm() { armed = true; },
    /**
     * Wacht tot er `count` aanroepen daadwerkelijk vóór de claim staan te
     * wachten. Loopt dat mis, dan faalt de test met een verklarende melding in
     * plaats van stilzwijgend een niet-bestaande race te "bewijzen".
     */
    async waitForArrivals(count, timeoutMs = 2000) {
      const deadline = Date.now() + timeoutMs;
      while (arrivals.length < count) {
        if (Date.now() > deadline) {
          throw new Error(`barrière: slechts ${arrivals.length} van ${count} aanroepen bereikten de compare-and-set`);
        }
        await new Promise((resolve) => { setTimeout(resolve, 1); });
      }
    },
    /** Laat één wachtende aanroep door en geeft zijn compare-and-set-uitkomst. */
    release(index) {
      arrivals[index].release();
      return arrivals[index].settled;
    },
  };
}

test('een verloren fase-race wordt gelogd als phase_race_lost, niet als een generieke INVALID_PHASE', async (t) => {
  const barrier = makeCasBarrier();
  const harness = await makeHarness(t, { wrapStore: barrier.wrap });
  const room = await seedRoom(harness);
  const host = await harness.connect(authFor(room));

  // Breng de room via de ECHTE weg tot in ROUND_RESULT: start → countdown →
  // ronde → einde ronde. Daarna staat er precies één timer gepland, en die
  // voert de overgang uit die we zo laten botsen.
  const started = await startFirstRound(harness, host);
  assert.ok(started.payload.roundId, 'de ronde moet echt geopend zijn');
  harness.clock.advance(30_000);
  await harness.scheduler.fireAll();
  await host.waitFor('round:ended');

  const match = await harness.rawStore.loadMatch(room.roomId, (await harness.rawStore.loadRoom(room.roomId)).currentMatchId);
  assert.equal(match.phase, 'ROUND_RESULT', 'OPZETCONTROLE: zonder deze beginfase botst er straks niets');

  const pending = harness.scheduler.pendingFns();
  assert.equal(pending.length, 1, 'er hoort precies één timergedreven overgang gepland te staan');
  const advanceOnTimer = pending[0];

  // 1 + 2. Beide aanroepen starten en lopen door tot vlak vóór de atomaire
  //        claim; daar houdt de barrière ze vast.
  barrier.arm();
  const first = advanceOnTimer();
  const second = advanceOnTimer();
  await barrier.waitForArrivals(2);

  const [expectedFirst, expectedSecond] = barrier.arrivals.map((arrival) => arrival.args[2].expectedPhase);
  assert.equal(expectedFirst, 'ROUND_RESULT');
  assert.equal(expectedSecond, 'ROUND_RESULT', 'beide aanroepen moeten dezelfde beginfase hebben gelezen');

  // 3. Eén laten winnen.
  const winner = await barrier.release(0);
  assert.equal(winner.ok, true, 'de eerste compare-and-set hoort te slagen');
  const phaseAfterWinner = (await harness.rawStore.loadMatch(room.roomId, match.id)).phase;
  assert.notEqual(phaseAfterWinner, 'ROUND_RESULT', 'de winnaar heeft de fase echt verzet');

  // 4. De ander loslaten en aantonen dat híj verliest.
  const loser = await barrier.release(1);
  assert.equal(loser.ok, false, 'de tweede compare-and-set hoort te verliezen');
  assert.equal(loser.actualPhase, phaseAfterWinner, 'de verliezer zag de fase van de winnaar');

  await first;
  await second;

  // 5. En dan pas de logregel.
  const rejected = harness.log.named('timerovergang geweigerd');
  assert.equal(rejected.length, 1, 'precies één van de twee overgangen is geweigerd');
  const line = rejected[0];
  assert.deepEqual(line.record, {
    layer: 'socket',
    outcome: 'phase_race_lost',
    roomId: room.roomId,
    source: 'timer',
    expectedPhase: 'ROUND_RESULT',
    actualPhase: phaseAfterWinner,
  });
  // DIT is de reparatie: vóór INT4a stond hier `code: 'INVALID_PHASE'` — een
  // generieke fasefout, terwijl het in werkelijkheid verwachte gelijktijdigheid
  // was. De twee vragen operationeel om een tegenovergestelde reactie.
  assert.equal(Object.hasOwn(line.record, 'code'), false, 'een verloren race is geen foutcode');
  assert.equal(line.level, 'info', 'verwachte gelijktijdigheid is geen waarschuwing');

  // De CLIENT merkt hier nog steeds niets van: er gaat geen ack en geen
  // error-event naar aanleiding van een servergedreven overgang.
  await settle();
  assert.equal(host.eventsNamed('error').length, 0);
  const wire = JSON.stringify(host.received);
  assert.ok(!wire.includes('PHASE_RACE_LOST'), 'de interne code verlaat de server nooit');
});

// ─────────────────────────────────────────────────────────────────────────────
// §A2 (5 aug 2026) — aftellen alleen vóór de eerste ronde
//
// De eerste versie van deze regel las `runtime.round`, dat `runEndRound()`
// vlak vóór de volgende COUNTDOWN op null zet. De directe start werd daardoor
// nooit genomen: dode code, en de suite bleef groen omdat niemand dit gedrag
// testte. Deze drie tests dekken de drie paden die de fix moet halen.
// ─────────────────────────────────────────────────────────────────────────────

/** Speelt ronde `n` uit: iedereen antwoordt niet, de ronde loopt af op zijn timer. */
async function playRoundToScoreboard(harness, host) {
  const started = await host.waitFor('round:started');
  harness.clock.value = started.payload.endsAt;
  await harness.scheduler.fireAll();            // ROUND_ACTIVE -> ROUND_RESULT
  await host.waitFor('round:ended');
  harness.clock.advance(5_000);
  await harness.scheduler.fireAll();            // ROUND_RESULT -> SCOREBOARD
  return started.payload;
}

test('§A2: de opening van een match telt echt af — zonder timer geen ronde 1', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness, { roomConfig: { totalRounds: 3 } });
  const host = await harness.connect(authFor(room));

  await host.emitWithAck('game:start', { actionId: 'act_start', payload: {} });
  const started = await host.waitFor('game:started');
  assert.ok(started.payload.countdownEndsAt > harness.clock.now(), 'game:started belooft een aftelling');

  await settle();
  assert.equal(
    host.eventsNamed('round:started').length,
    0,
    'ronde 1 mag pas beginnen als de aftelling is afgelopen',
  );

  harness.clock.advance(3_000);
  await harness.scheduler.fireAll();
  const round1 = await host.waitFor('round:started');
  assert.equal(round1.payload.roundNumber, 1);
});

test('§A2: ronde 1 -> ronde 2 start direct, zonder tweede stille aftelling', async (t) => {
  const harness = await makeHarness(t);
  const room = await seedRoom(harness, { roomConfig: { totalRounds: 3 } });
  const host = await harness.connect(authFor(room));

  await host.emitWithAck('game:start', { actionId: 'act_start', payload: {} });
  await host.waitFor('game:started');
  harness.clock.advance(3_000);
  await harness.scheduler.fireAll();

  const round1 = await playRoundToScoreboard(harness, host);
  assert.equal(round1.roundNumber, 1);
  await host.waitFor('scoreboard:updated');

  // SCOREBOARD -> COUNTDOWN. Vroeger stond hier een timer klaar en bleef het
  // scherm drie seconden stil; nu opent de ronde in dezelfde beweging.
  const pendingBefore = harness.scheduler.pending;
  harness.clock.advance(5_000);
  await harness.scheduler.fireAll();

  const round2 = await host.waitFor('round:started', (e) => e.payload.roundNumber === 2);
  assert.equal(round2.payload.roundNumber, 2, 'ronde 2 komt zonder extra aftelling');
  assert.ok(pendingBefore > 0, 'de scoreboard-timer stond wel degelijk gepland');
});

test('§A2: na een serverherstart (leeg runtimegeheugen) blijft de beslissing kloppen', async (t) => {
  // Host-tempo, zodat de volgende ronde door een HOSTACTIE begint. Na een
  // herstart draait er namelijk geen enkele timer meer (dat gat is A7,
  // ARCHITECTURE §10) — maar de knop van de host komt wél binnen, en die mag
  // niet op een leeg runtimegeheugen leunen.
  const first = await makeHarness(t);
  const room = await seedRoom(first, { roomConfig: { totalRounds: 3, pacing: 'host' } });
  const host = await first.connect(authFor(room));

  await host.emitWithAck('game:start', { actionId: 'act_start', payload: {} });
  await host.waitFor('game:started');
  first.clock.advance(3_000);
  await first.scheduler.fireAll();
  const round1 = await playRoundToScoreboard(first, host);
  assert.equal(round1.roundNumber, 1);
  await host.waitFor('scoreboard:updated');

  // Tweede server op DEZELFDE store en klok: alles wat alleen in het geheugen
  // van het eerste proces stond, is weg — precies de bron waar de oude
  // `runtime.round`-lezing haar antwoord vandaan haalde.
  const restarted = await makeHarness(t, { store: first.store, clock: first.clock });
  const hostAgain = await restarted.connect(authFor(room));

  const ack = await hostAgain.emitWithAck('game:next', { actionId: 'act_next_na_herstart', payload: {} });
  assert.equal(ack.ok, true, JSON.stringify(ack));

  // De match is al onderweg (`match.roundIds` is niet leeg in de store), dus
  // ronde 2 opent direct — geen tweede aftelling, en geen ronde die blijft
  // hangen omdat het geheugen leeg was.
  const round2 = await hostAgain.waitFor('round:started', (e) => e.payload.roundNumber === 2);
  assert.equal(round2.payload.roundNumber, 2);
  assert.equal(round2.payload.matchId, (await restarted.store.loadRoom(room.roomId)).currentMatchId);
});
