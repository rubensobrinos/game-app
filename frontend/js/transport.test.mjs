// Tests voor de echte transportlaag (`transport.mjs`).
//
// ECHTE SERVER, GEEN FAKE. Elke test start `buildServer()` uit
// `server/index.mjs` op poort 0 met `attachSockets: true`, dus met de echte
// `rest.mjs` én de echte `socket.mjs` eronder. Er wordt niets gemockt: geen
// fetch-stub, geen fake WebSocket, geen nagebouwde ack. Wat hier groen is, is
// groen tegen de server zoals die draait.
//
// De enige injectie is `precedenceGate` — de ECHTE poort uit `transport.mjs`,
// vooraf op een bekende positie gezet. Dat is de manier om de
// precedentieregel over een echte socketstroom te bewijzen: de server stuurt
// zijn events met een monotoon oplopende `serverTime`, dus zonder een vooraf
// gezette positie is er nooit iets ouds om af te wijzen.
//
// WAT HIER BEWUST NIET WORDT GETEST
//   - `room:state` over de socket: `socket.mjs` exporteert `sendSnapshot`,
//     maar niets in `server/index.mjs` roept het aan, dus de server stuurt dit
//     event vandaag nooit. De snapshot-tak van de poort wordt daarom
//     rechtstreeks getest (met de echte regelmodule) en niet over de wire.
//   - de backoff-vertragingen zelf: die formule is `backoffDelayMs` uit
//     `client/flow/reconnect-state.mjs` en heeft daar zijn eigen tests. Hier
//     wordt alleen bewezen dat de transportlaag hem gebruikt en dat de
//     statusovergangen kloppen.

import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

import { buildServer } from '../../server/index.mjs';
import { messageForErrorCode } from '../../client/flow/edge-case-messaging.mjs';
import { REASONS } from '../../shared/protocol/snapshot-precedence.mjs';
import {
  createSnapshotPrecedenceGate,
  createTransport,
  ProtocolError,
  TRANSPORT_ERROR_CODES,
} from './transport.mjs';

const PEPPER = 'test-pepper-met-ruim-genoeg-bytes';
const SERVER_CONFIG = Object.freeze({
  port: 0,
  host: '127.0.0.1',
  publicAppUrl: 'https://play.aseso.nl',
  tokenPeppers: Object.freeze({ version: 'v1', peppers: Object.freeze({ v1: PEPPER }) }),
});

/** Het minimale geldige `POST /games`-verzoek: `preset` en `language` zijn verplicht. */
const CREATE_REQUEST = Object.freeze({
  config: Object.freeze({ preset: 'quick_start', language: 'nl' }),
  hostParticipates: true,
  displayName: 'Host',
});

/**
 * Start de echte server op een vrije poort en ruimt hem na de test op.
 * @param {import('node:test').TestContext} t
 */
async function startServer(t) {
  const fastify = await buildServer({ config: { ...SERVER_CONFIG }, attachSockets: true });
  await fastify.listen({ port: 0, host: '127.0.0.1' });
  const { port } = fastify.server.address();

  /** @type {Array<{ close: () => void }>} */
  const connections = [];

  // VOLGORDE IS LOAD-BEARING: eerst de clientsockets sluiten, dan pas de
  // server. Andersom blijft `fastify.close()` hangen zolang er een
  // WebSocket open staat — ook ná `closeAllConnections()`. Dat is geen
  // testartefact maar hetzelfde pad dat `server/index.mjs` bij SIGTERM
  // gebruikt; zie het handoff-item over graceful shutdown.
  // `t.after`-hooks lopen in registratievolgorde, dus deze ene hook (die als
  // eerste is geregistreerd) moet allebei de stappen doen.
  t.after(async () => {
    for (const connection of connections) {
      try {
        connection.close();
      } catch {
        // Al dicht.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    fastify.server.closeAllConnections?.();
    await fastify.close();
  });

  return {
    fastify,
    baseUrl: `http://127.0.0.1:${port}`,
    /** Registreert een `connect()`-resultaat voor opruiming. */
    track(connection) {
      connections.push(connection);
      return connection;
    },
  };
}

/**
 * Een TCP-doorgeefluik vóór de server, zodat een test de VERBINDING kan
 * doorknippen zonder de server te stoppen. Dat is precies het scenario van
 * `PROTOCOL.md` §Reconnect stap 1 ("socket valt weg"): de server blijft staan,
 * dus de herverbindingspoging kan ook echt slagen.
 *
 * Waarom niet gewoon `fastify.close()`: dat blijft hangen zolang er een
 * WebSocket open staat (zie het handoff-item over graceful shutdown), en een
 * test die op een serverbug leunt meet de verkeerde dingen.
 *
 * @param {import('node:test').TestContext} t
 * @param {number} targetPort
 */
async function startProxy(t, targetPort) {
  /** @type {Set<import('node:net').Socket>} */
  const live = new Set();

  const proxy = net.createServer((downstream) => {
    const upstream = net.connect(targetPort, '127.0.0.1');
    live.add(downstream);
    live.add(upstream);
    for (const [a, b] of [[downstream, upstream], [upstream, downstream]]) {
      a.on('error', () => b.destroy());
      a.on('close', () => {
        live.delete(a);
        b.destroy();
      });
      a.pipe(b);
    }
  });

  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => {
    for (const socket of live) {
      socket.destroy();
    }
    live.clear();
    proxy.close(resolve);
  }));

  return {
    baseUrl: `http://127.0.0.1:${proxy.address().port}`,
    /** Knipt elke lopende verbinding door; de proxy blijft luisteren. */
    cut() {
      for (const socket of live) {
        socket.destroy();
      }
      live.clear();
    },
  };
}

/**
 * Maakt een transport tegen die server. Optioneel met een vooraf gezette
 * precedentiepoort.
 */
function makeTransport(baseUrl, extra = {}) {
  return createTransport({ baseUrl, ...extra });
}

/** Verzamelt alles wat een `connect()`-handlerpaar te zien krijgt. */
function makeRecorder() {
  const statuses = [];
  const events = [];
  const decisions = [];
  return {
    statuses,
    events,
    decisions,
    handlers: {
      onStatus: (status) => statuses.push(status),
      onEvent: (envelope) => events.push(envelope),
      onPrecedence: (decision) => decisions.push(decision),
    },
    eventsNamed(name) {
      return events.filter((envelope) => envelope?.event === name);
    },
  };
}

/** Wacht tot `predicate()` waar is, of faalt na `timeoutMs`. */
async function waitUntil(predicate, { timeoutMs = 5000, label = 'voorwaarde' } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timeout wachtend op ${label}`);
}

/** Een minimale, geldige snapshot: alleen de velden die de regel leest. */
function snapshotFixture({ code, serverTime, matchId = null, matchSequence = null }) {
  return {
    protocolVersion: 'v1',
    serverTime,
    room: { code, matchId, matchSequence },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Voorwaarde: de precedentieregel is geladen
// ─────────────────────────────────────────────────────────────────────────────

test('de poort haalt zijn beslissingen uit shared/protocol/snapshot-precedence.mjs, niet uit een eigen kopie', () => {
  // `transport.mjs` importeert die module sinds de verhuizing STATISCH; laadt
  // hij niet, dan laadt dit testbestand ook niet — een aparte
  // "is hij beschikbaar?"-vlag bestaat dus niet meer. Wat hier wél te bewijzen
  // valt: de motieven die de poort teruggeeft zijn letterlijk de motieven die de
  // gedeelde module publiceert. Een tweede, lokaal nagebouwde regel zou hier
  // stukgaan zodra de module een motief hernoemt.
  const gate = createSnapshotPrecedenceGate();
  assert.equal(gate.registerSnapshot(snapshotFixture({ code: '482917', serverTime: 2000 })).apply, true);

  const stale = gate.registerSnapshot(snapshotFixture({ code: '482917', serverTime: 1000 }));
  assert.equal(stale.apply, false);
  assert.equal(stale.reason, REASONS.STALE_SNAPSHOT);

  const foreign = gate.registerSnapshot(snapshotFixture({ code: '194026', serverTime: 3000 }));
  assert.equal(foreign.apply, false);
  assert.equal(foreign.reason, REASONS.ROOM_MISMATCH);
});

// ─────────────────────────────────────────────────────────────────────────────
// REST — happy path per functie
// ─────────────────────────────────────────────────────────────────────────────

test('createGame geeft de volledige POST /games-respons terug', async (t) => {
  const { baseUrl } = await startServer(t);
  const transport = makeTransport(baseUrl);

  const created = await transport.createGame(CREATE_REQUEST);

  assert.match(created.gameCode, /^[0-9]{6}$/);
  assert.equal(typeof created.roomId, 'string');
  assert.equal(typeof created.inviteId, 'string');
  assert.equal(created.joinUrl, `https://play.aseso.nl/j/${created.inviteId}`);
  assert.equal(typeof created.sessionToken, 'string');
  assert.deepEqual(created.roles, ['host', 'player']);
  assert.equal(created.effectiveName, 'Host');
  assert.equal(created.state.protocolVersion, 'v1');
  assert.equal(created.state.room.phase, 'LOBBY');
});

test('createGame stuurt het hele request door, niet alleen config (correctie 1)', async (t) => {
  const { baseUrl } = await startServer(t);
  const transport = makeTransport(baseUrl);

  const created = await transport.createGame({ ...CREATE_REQUEST, hostParticipates: false, displayName: null });

  // `hostParticipates: false` bereikt de server alleen als het request als
  // geheel wordt doorgegeven; anders zou de host hier een speler zijn.
  assert.deepEqual(created.roles, ['host']);
  assert.equal(created.playerId, null);
  assert.equal(created.effectiveName, null);
});

test('previewInvite haalt de pre-join-preview op via ?inviteId=', async (t) => {
  const { baseUrl } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);

  const preview = await transport.previewInvite(created.inviteId);

  assert.equal(preview.roomId, created.roomId);
  assert.equal(preview.phase, 'LOBBY');
  assert.equal(preview.playerCount, 1);
  assert.equal(preview.maxPlayers, 100);
  assert.equal(typeof preview.suggestedName, 'string');
  // Grens uit PROTOCOL.md: preview maakt geen sessie aan.
  assert.equal(preview.sessionToken, undefined);
  assert.equal(preview.playerId, undefined);
});

test('joinGame joint met precies één locator en levert een spelersessie', async (t) => {
  const { baseUrl } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);

  const joined = await transport.joinGame({
    inviteId: created.inviteId,
    displayName: 'Speler',
    joinSource: 'qr',
  });

  assert.equal(joined.roomId, created.roomId);
  assert.equal(joined.gameCode, created.gameCode);
  assert.deepEqual(joined.roles, ['player']);
  assert.equal(joined.effectiveName, 'Speler');
  assert.equal(joined.state.room.playerCount, 2);
});

test('fetchServerTime levert { serverTime } als epoch-ms', async (t) => {
  const { baseUrl } = await startServer(t);
  const transport = makeTransport(baseUrl);

  const before = Date.now();
  const { serverTime } = await transport.fetchServerTime();

  assert.equal(typeof serverTime, 'number');
  assert.ok(serverTime >= before - 1000 && serverTime <= Date.now() + 1000);
});

test('leaveGame verlaat de room en levert niets terug (Promise<void>)', async (t) => {
  const { baseUrl } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);
  const joined = await transport.joinGame({ gameCode: created.gameCode, displayName: 'Speler', joinSource: 'code' });

  const result = await transport.leaveGame(joined.gameCode, joined.sessionToken);

  assert.equal(result, undefined);
  const preview = await transport.previewInvite(created.inviteId);
  assert.equal(preview.playerCount, 1, 'de vertrokken speler telt niet meer mee');
});

test('fetchState levert de volledige snapshot met bearer-auth', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);
  const recorder = makeRecorder();
  const connection = track(transport.connect(created.sessionToken, recorder.handlers));
  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });
  // Er moet een match lopen: zie de canary hieronder — in de LOBBY geeft dit
  // eindpunt vandaag een 500.
  await connection.send('game:start', 'act_state_1', {});

  const snapshot = await transport.fetchState(created.gameCode, created.sessionToken);

  assert.equal(snapshot.protocolVersion, 'v1');
  assert.equal(snapshot.room.code, created.gameCode);
  assert.equal(typeof snapshot.room.matchId, 'string');
  assert.equal(snapshot.room.matchSequence, 1);
  assert.deepEqual(snapshot.self.roles, ['host', 'player']);
  assert.equal(snapshot.self.eligibleFromRound, 1);
});

test('fetchState geeft in de LOBBY een geldige snapshot (INT-17 opgelost)', async (t) => {
  const { baseUrl } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);

  // Dit was de vierde vastgepinde plek van INT-17: een lobby-snapshot haalde
  // `validateSnapshotShape` niet, omdat die een niet-lege `matchId` en een
  // `matchSequence >= 1` eiste die vóór de eerste match niet bestaan. PR heeft
  // de shape een lobby-variant gegeven; hier ligt vast wat de client dan krijgt.
  const snapshot = await transport.fetchState(created.gameCode, created.sessionToken);

  assert.equal(snapshot.room.phase, 'LOBBY');
  assert.equal(snapshot.room.matchId, null);
  assert.equal(snapshot.room.matchSequence, null);
  assert.deepEqual(snapshot.currentRound, {});
  assert.deepEqual(snapshot.scoreboard.top, []);
  assert.deepEqual(snapshot.self.roles, ['host', 'player']);
});

test('een 500 zonder PROTOCOL.md-code wordt een ProtocolError waar de UI generiek op terugvalt', async (t) => {
  const { baseUrl, fastify } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);

  // De lobby-500 lokte dit gedrag voorheen uit; dat pad is weg. Zonder een
  // vervangende uitlokking zou deze assertie over lege lucht gaan — precies de
  // vacuümverificatie uit AGENTS.md. Daarom nu bij de bron: de poort werpt een
  // fout zónder `protocolCode`, wat de serverkant een kale 500 hoort te maken.
  const store = fastify.appContext?.store ?? null;
  assert.ok(store, 'de harness moet bij de store kunnen om een serverfout uit te lokken');
  const original = store.loadRoomByCode;
  store.loadRoomByCode = async () => {
    throw new Error('interne storefout met /pad/in-memory-store.js:42 erin');
  };

  const error = await transport.fetchState(created.gameCode, created.sessionToken).then(
    () => null,
    (caught) => caught
  );
  store.loadRoomByCode = original;

  assert.ok(error instanceof ProtocolError);
  assert.equal(error.code, 'INTERNAL_ERROR');
  assert.equal(messageForErrorCode(error.code), 'UNKNOWN_ERROR');
  assert.ok(!/\.js:|Error:/.test(JSON.stringify(error.meta ?? {})), 'geen stacktracefragment naar de client');

  // Zelfcontrole: was de patch nooit aangekomen, dan had de aanroep hierboven
  // gewoon 200 gegeven en bewees de test niets. Dit moet dus weer slagen.
  const recovered = await transport.fetchState(created.gameCode, created.sessionToken);
  assert.equal(recovered.room.phase, 'LOBBY');
});

// ─────────────────────────────────────────────────────────────────────────────
// REST — foutresponses worden een Error met .code
// ─────────────────────────────────────────────────────────────────────────────

test('een foutrespons wordt een Error met .code die messageForErrorCode kent', async (t) => {
  const { baseUrl } = await startServer(t);
  const transport = makeTransport(baseUrl);

  const error = await transport.previewInvite('  ').then(() => null, (caught) => caught);

  assert.ok(error instanceof ProtocolError);
  assert.equal(error.code, 'INVITE_INVALID');
  assert.equal(messageForErrorCode(error.code), 'INVITE_INVALID');
  assert.deepEqual(error.meta, {});
});

test('een ongeldig sessietoken op fetchState levert TOKEN_INVALID', async (t) => {
  const { baseUrl } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);

  const error = await transport.fetchState(created.gameCode, 'dit-token-bestaat-niet').then(
    () => null,
    (caught) => caught
  );

  assert.ok(error instanceof ProtocolError);
  assert.equal(error.code, 'TOKEN_INVALID');
  assert.equal(messageForErrorCode(error.code), 'TOKEN_INVALID');
});

test('leaveGame zonder spelerrol levert NOT_PLAYER', async (t) => {
  const { baseUrl } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame({ ...CREATE_REQUEST, hostParticipates: false, displayName: null });

  const error = await transport.leaveGame(created.gameCode, created.sessionToken).then(
    () => null,
    (caught) => caught
  );

  assert.ok(error instanceof ProtocolError);
  assert.equal(error.code, 'NOT_PLAYER');
});

test('een onbereikbare server levert NETWORK_ERROR, geen PROTOCOL.md-code', async (t) => {
  const { baseUrl, fastify } = await startServer(t);
  const transport = makeTransport(baseUrl);
  fastify.server.closeAllConnections?.();
  await fastify.close();

  const error = await transport.fetchServerTime().then(() => null, (caught) => caught);

  assert.ok(error instanceof ProtocolError);
  assert.equal(error.code, TRANSPORT_ERROR_CODES.NETWORK);
  assert.equal(messageForErrorCode(error.code), 'UNKNOWN_ERROR');
});

// ─────────────────────────────────────────────────────────────────────────────
// Socket — verbinden, status, send
// ─────────────────────────────────────────────────────────────────────────────

test('connect meldt connecting → connected en levert send/close', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);
  const recorder = makeRecorder();

  const connection = track(transport.connect(created.sessionToken, recorder.handlers));

  assert.equal(recorder.statuses[0], 'connecting', 'connecting wordt synchroon gemeld');
  assert.equal(typeof connection.send, 'function');
  assert.equal(typeof connection.close, 'function');

  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });
  assert.deepEqual(recorder.statuses, ['connecting', 'connected']);
});

test('close() meldt disconnected en start geen nieuwe poging', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);
  const recorder = makeRecorder();
  const connection = track(transport.connect(created.sessionToken, recorder.handlers));
  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });

  connection.close();

  assert.equal(recorder.statuses.at(-1), 'disconnected');
  // Ruim langer dan de eerste backoff-stap (1 s) wachten: er mag geen
  // 'connecting' meer volgen.
  await new Promise((resolve) => setTimeout(resolve, 1400));
  assert.deepEqual(recorder.statuses, ['connecting', 'connected', 'disconnected']);
});

test('send levert de ack-envelope en de bijbehorende serverevents komen binnen', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);
  const recorder = makeRecorder();
  const connection = track(transport.connect(created.sessionToken, recorder.handlers));
  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });

  const ack = await connection.send('game:start', 'act_start_1', {});

  assert.equal(ack.actionId, 'act_start_1');
  assert.equal(ack.ok, true);
  assert.equal(typeof ack.serverTime, 'number');
  assert.equal(typeof ack.payload.matchId, 'string');

  await waitUntil(() => recorder.eventsNamed('game:started').length === 1, { label: 'game:started' });
  const started = recorder.eventsNamed('game:started')[0];
  assert.equal(started.payload.matchId, ack.payload.matchId);
  assert.equal(typeof started.payload.countdownEndsAt, 'number');
  assert.equal(typeof started.eventId, 'string');
});

test('een retry met dezelfde actionId levert dezelfde ack zonder de mutatie te herhalen', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);
  const recorder = makeRecorder();
  const connection = track(transport.connect(created.sessionToken, recorder.handlers));
  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });

  const first = await connection.send('game:lock', 'act_idem_1', { locked: true });
  const retry = await connection.send('game:lock', 'act_idem_1', { locked: true });

  // PROTOCOL.md §Event-envelope: dezelfde actionId → dezelfde logische ack.
  // Dat is precies waarom correctie 4 de actionId bij de UI laat.
  assert.deepEqual(retry, first);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(recorder.eventsNamed('room:lock-changed').length, 1, 'de mutatie wordt niet herhaald');
});

test('send verwerpt bij een ack met ok: false, met dezelfde Error+.code-vorm (correctie 3)', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);
  const recorder = makeRecorder();
  const connection = track(transport.connect(created.sessionToken, recorder.handlers));
  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });

  // `game:next` vereist fase SCOREBOARD; in de LOBBY antwoordt de server met
  // een formele ack `{ ok: false, payload: { code: 'INVALID_PHASE' } }`.
  const error = await connection.send('game:next', 'act_next_1', {}).then(() => null, (caught) => caught);

  assert.ok(error instanceof ProtocolError, 'ok:false moet verwerpen, niet resolven');
  assert.equal(error.code, 'INVALID_PHASE');
  assert.equal(messageForErrorCode(error.code), 'INVALID_PHASE');

  // De server stuurt naast de ack óók een los `error`-event met dezelfde
  // actionId. Dat wordt onderdrukt: één foutmechanisme, niet twee.
  await new Promise((resolve) => setTimeout(resolve, 100));
  const duplicates = recorder.eventsNamed('error').filter((envelope) => envelope.payload?.actionId === 'act_next_1');
  assert.equal(duplicates.length, 0, 'geen dubbel foutpad naar de UI');
});

test('een onbekend clientevent verwerpt met UNSUPPORTED_EVENT', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);
  const recorder = makeRecorder();
  const connection = track(transport.connect(created.sessionToken, recorder.handlers));
  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });

  const error = await connection.send('game:teleport', 'act_bogus_1', {}).then(() => null, (caught) => caught);

  assert.ok(error instanceof ProtocolError);
  assert.equal(error.code, 'UNSUPPORTED_EVENT');
});

test('send zonder open verbinding verwerpt met NOT_CONNECTED', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);
  const recorder = makeRecorder();
  const connection = track(transport.connect(created.sessionToken, recorder.handlers));
  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });
  connection.close();

  const error = await connection.send('game:start', 'act_late_1', {}).then(() => null, (caught) => caught);

  assert.ok(error instanceof ProtocolError);
  assert.equal(error.code, TRANSPORT_ERROR_CODES.NOT_CONNECTED);
  // De UI hoort te retryen met DEZELFDE actionId (PROTOCOL.md §Reconnect 7).
  assert.equal(messageForErrorCode(error.code), 'UNKNOWN_ERROR');
});

test('een geweigerde handshake meldt disconnected en levert een error-envelope', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const recorder = makeRecorder();

  const connection = track(transport.connect('dit-token-bestaat-niet', recorder.handlers));

  await waitUntil(() => recorder.statuses.includes('disconnected'), { label: 'disconnected' });
  assert.deepEqual(recorder.statuses, ['connecting', 'disconnected']);

  const errors = recorder.eventsNamed('error');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].payload.code, 'TOKEN_INVALID');
  assert.equal(messageForErrorCode(errors[0].payload.code), 'TOKEN_INVALID');

  // TOKEN_INVALID is terminaal: geen eindeloze backoff tegen een dode sessie.
  await new Promise((resolve) => setTimeout(resolve, 1400));
  assert.deepEqual(recorder.statuses, ['connecting', 'disconnected']);
});

test('een weggevallen verbinding meldt disconnected en herstelt zichzelf', async (t) => {
  const { baseUrl: serverUrl, track } = await startServer(t);
  const proxy = await startProxy(t, Number(new URL(serverUrl).port));
  const transport = makeTransport(proxy.baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);
  const recorder = makeRecorder();
  track(transport.connect(created.sessionToken, recorder.handlers));
  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });

  // `PROTOCOL.md` §Reconnect stap 1: de socket valt weg. De server blijft
  // staan, dus de herverbinding hoort ook echt te slagen — zonder dat de UI
  // iets doet: de backoff zit in de transportlaag (correctie 2).
  proxy.cut();

  await waitUntil(() => recorder.statuses.length >= 5, {
    timeoutMs: 10000,
    label: 'de volledige reconnectcyclus',
  });
  assert.deepEqual(
    recorder.statuses.slice(0, 5),
    ['connecting', 'connected', 'disconnected', 'connecting', 'connected']
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// De precedentieregel — de echte module, via de poort van transport.mjs
// ─────────────────────────────────────────────────────────────────────────────

test('een verouderde snapshot wordt afgewezen', () => {
  const gate = createSnapshotPrecedenceGate();
  const code = '482917';

  assert.equal(gate.registerSnapshot(snapshotFixture({ code, serverTime: 2000, matchId: 'm1', matchSequence: 1 })).apply, true);
  const stale = gate.registerSnapshot(snapshotFixture({ code, serverTime: 1000, matchId: 'm1', matchSequence: 1 }));

  assert.equal(stale.apply, false);
  assert.equal(stale.reason, 'STALE_SNAPSHOT');
  assert.equal(gate.inspect().appliedServerTime, 2000, 'de positie gaat niet terug in de tijd');
});

test('een snapshot wint van eerder ontvangen events', () => {
  const gate = createSnapshotPrecedenceGate();
  const code = '482917';

  gate.registerSnapshot(snapshotFixture({ code, serverTime: 1000, matchId: 'm1', matchSequence: 1 }));
  assert.equal(gate.registerEvent({ event: 'round:started', serverTime: 1500, payload: { matchId: 'm1' } }).apply, true);

  // Snapshot van ná dat event: wint.
  assert.equal(gate.registerSnapshot(snapshotFixture({ code, serverTime: 2000, matchId: 'm1', matchSequence: 1 })).apply, true);

  // Een event van vóór of tijdens die snapshot is er al in verwerkt.
  const superseded = gate.registerEvent({ event: 'round:progress', serverTime: 1800, payload: {} });
  assert.equal(superseded.apply, false);
  assert.equal(superseded.reason, 'SUPERSEDED_BY_SNAPSHOT');

  // Strikt nieuwer voegt wél iets toe.
  assert.equal(gate.registerEvent({ event: 'round:progress', serverTime: 2001, payload: {} }).apply, true);
});

test('matchSequence gaat vóór serverTime: een oudere match verliest ook met een hogere klok', () => {
  const gate = createSnapshotPrecedenceGate();
  const code = '482917';

  gate.registerSnapshot(snapshotFixture({ code, serverTime: 1000, matchId: 'm1', matchSequence: 1 }));
  gate.registerSnapshot(snapshotFixture({ code, serverTime: 2000, matchId: 'm2', matchSequence: 2 }));

  // Snapshot van match 1 met een HOGERE serverTime: verliest op sequence.
  const older = gate.registerSnapshot(snapshotFixture({ code, serverTime: 9000, matchId: 'm1', matchSequence: 1 }));
  assert.equal(older.apply, false);
  assert.equal(older.reason, 'STALE_MATCH_SEQUENCE');

  // Event van match 1, ook met een hogere serverTime: idem.
  const olderEvent = gate.registerEvent({ event: 'round:started', serverTime: 9000, payload: { matchId: 'm1' } });
  assert.equal(olderEvent.apply, false);
  assert.equal(olderEvent.reason, 'STALE_MATCH_SEQUENCE');

  assert.equal(gate.inspect().matchId, 'm2');
  assert.equal(gate.inspect().appliedMatchSequence, 2);
});

test('een nieuwere match wint van een hogere serverTime binnen de oude match', () => {
  const gate = createSnapshotPrecedenceGate();
  const code = '482917';

  gate.registerSnapshot(snapshotFixture({ code, serverTime: 5000, matchId: 'm1', matchSequence: 1 }));
  // Zelfde milliseconde, nieuwe match: zonder de sequence-ordening zou dit
  // DUPLICATE_SNAPSHOT worden. `snapshot-precedence.mjs` ordent daarom eerst op
  // `matchSequence` en pas daarna op `serverTime` (PROTOCOL.md §State-snapshot);
  // voor SNAPSHOTS is dat gat dus dicht. Open punt (e) in die module gaat over
  // wat er overblijft: de EVENT-envelope draagt geen `matchSequence`.
  const rematch = gate.registerSnapshot(snapshotFixture({ code, serverTime: 5000, matchId: 'm2', matchSequence: 2 }));

  assert.equal(rematch.apply, true);
  assert.equal(rematch.matchChanged, true);
  assert.equal(gate.inspect().matchId, 'm2');
});

test('een snapshot van een andere room wordt nooit toegepast', () => {
  const gate = createSnapshotPrecedenceGate();

  gate.registerSnapshot(snapshotFixture({ code: '482917', serverTime: 1000, matchId: 'm1', matchSequence: 1 }));
  const foreign = gate.registerSnapshot(snapshotFixture({ code: '111111', serverTime: 2000, matchId: 'm9', matchSequence: 9 }));

  assert.equal(foreign.apply, false);
  assert.equal(foreign.reason, 'ROOM_MISMATCH');
});

test('error, session:kicked en session:revoked worden nooit door de poort tegengehouden', () => {
  const gate = createSnapshotPrecedenceGate();
  const code = '482917';
  gate.registerSnapshot(snapshotFixture({ code, serverTime: 5000, matchId: 'm1', matchSequence: 1 }));

  for (const event of ['error', 'session:kicked', 'session:revoked']) {
    // serverTime ver in het verleden: een state-event zou hier afvallen.
    assert.equal(gate.registerEvent({ event, serverTime: 1, payload: {} }).apply, true, event);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// De precedentieregel is écht bedraad: echte serverevents worden genegeerd
// ─────────────────────────────────────────────────────────────────────────────

// Deze tests draaien over een ECHTE socketstroom van een ECHTE server; de
// poort is de echte `createSnapshotPrecedenceGate()`, alleen vooraf op een
// bekende positie gezet. Anders is er niets ouds om af te wijzen: de server
// stuurt zijn events met een monotoon oplopende `serverTime`.

test('een echt serverevent dat door een nieuwere snapshot is achterhaald bereikt onEvent niet', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const gate = createSnapshotPrecedenceGate();
  const transport = makeTransport(baseUrl, { precedenceGate: gate });
  const created = await transport.createGame(CREATE_REQUEST);

  // Zet de poort op een snapshot die een uur in de toekomst ligt. Alles wat de
  // server hierna stuurt is per definitie ouder dan de laatst toegepaste
  // snapshot en valt dus onder basisregel 6.
  gate.registerSnapshot(snapshotFixture({
    code: created.gameCode,
    serverTime: Date.now() + 3_600_000,
    matchId: 'match_uit_de_toekomst',
    matchSequence: 1,
  }));

  const recorder = makeRecorder();
  const connection = track(transport.connect(created.sessionToken, recorder.handlers));
  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });

  const ack = await connection.send('game:lock', 'act_gate_1', { locked: true });
  assert.equal(ack.ok, true, 'de actie zelf slaagt gewoon; alleen de state-stroom wordt geordend');

  await waitUntil(
    () => recorder.decisions.some((decision) => decision.event === 'room:lock-changed'),
    { label: 'precedentiebeslissing over room:lock-changed' }
  );
  const decision = recorder.decisions.find((entry) => entry.event === 'room:lock-changed');
  assert.equal(decision.apply, false);
  assert.equal(decision.reason, 'SUPERSEDED_BY_SNAPSHOT');
  assert.equal(recorder.eventsNamed('room:lock-changed').length, 0, 'het event bereikt applyServerEvent niet');
});

test('een echt serverevent van een oudere match bereikt onEvent niet', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const gate = createSnapshotPrecedenceGate();
  const transport = makeTransport(baseUrl, { precedenceGate: gate });
  const created = await transport.createGame(CREATE_REQUEST);

  const recorder = makeRecorder();
  const connection = track(transport.connect(created.sessionToken, recorder.handlers));
  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });

  // Match 1 echt starten. De poort leert `matchId → matchSequence 1` uit de
  // ECHTE snapshot van de server, niet uit een fixture.
  const ack = await connection.send('game:start', 'act_seq_1', {});
  const matchOne = ack.payload.matchId;
  const snapshot = await transport.fetchState(created.gameCode, created.sessionToken);
  assert.equal(snapshot.room.matchId, matchOne);
  assert.equal(gate.inspect().knownMatches.get(matchOne), 1);

  // De client is inmiddels bij match 2 (in het echt: een rematch waarvan de
  // snapshot al binnen was). Alles wat nog van match 1 binnenkomt is te laat —
  // ook `round:started`, dat straks een hógere serverTime draagt.
  gate.registerSnapshot(snapshotFixture({
    code: created.gameCode,
    serverTime: snapshot.serverTime + 1,
    matchId: 'match_twee',
    matchSequence: 2,
  }));

  // `round:started` komt écht van de server, ná de countdown, met `matchId`
  // van match 1 in de payload.
  await waitUntil(
    () => recorder.decisions.some((entry) => entry.event === 'round:started'),
    { timeoutMs: 15000, label: 'round:started van match 1' }
  );
  const decision = recorder.decisions.find((entry) => entry.event === 'round:started');
  assert.equal(decision.apply, false);
  assert.equal(decision.reason, 'STALE_MATCH_SEQUENCE');
  assert.equal(recorder.eventsNamed('round:started').length, 0);
  assert.equal(gate.inspect().matchId, 'match_twee', 'de positie schuift niet terug naar match 1');
});

test('zonder achterstand komt elk echt serverevent gewoon door', async (t) => {
  const { baseUrl, track } = await startServer(t);
  const transport = makeTransport(baseUrl);
  const created = await transport.createGame(CREATE_REQUEST);
  const recorder = makeRecorder();
  const connection = track(transport.connect(created.sessionToken, recorder.handlers));
  await waitUntil(() => recorder.statuses.includes('connected'), { label: 'connected' });

  await transport.joinGame({ gameCode: created.gameCode, displayName: 'Speler', joinSource: 'code' });

  // Deze wachttik is LOAD-BEARING en geen slordigheid. `joinGame` levert een
  // snapshot en die gaat door dezelfde poort; komt `game:started` daarna in
  // DEZELFDE milliseconde binnen, dan wijst `shouldApplyEvent` het event
  // terecht af als SUPERSEDED_BY_SNAPSHOT — basisregel 6 in zijn letterlijke
  // vorm. Epoch-ms is daar te grof voor (open punt (c) in
  // snapshot-precedence.mjs). Zonder deze tik is de test dus flaky op iets wat
  // de regel correct doet. Zie het handoff-item over ms-resolutie.
  await new Promise((resolve) => setTimeout(resolve, 10));
  await connection.send('game:start', 'act_flow_1', {});

  await waitUntil(() => recorder.eventsNamed('round:started').length === 1, {
    timeoutMs: 15000,
    label: 'round:started',
  });
  // `POST /games/join` loopt niet over de socket, maar de lobby hoort de joiner
  // wél te zien verschijnen: `rest.mjs` roept daarvoor `broadcastPlayerChanged`
  // van `socket.mjs` aan, via het handle dat `server/index.mjs` doorgeeft. Dit
  // is de ketenassertie van die brug — over een echte socket, met de echte
  // server eronder.
  assert.equal(recorder.eventsNamed('room:player-changed').length, 1);
  const [playerChanged] = recorder.eventsNamed('room:player-changed');
  assert.equal(playerChanged.payload.delta.type, 'join');
  assert.equal(recorder.eventsNamed('game:started').length, 1);
  assert.ok(
    recorder.decisions.every((decision) => decision.apply === true),
    `niets mag worden afgewezen, kreeg: ${JSON.stringify(recorder.decisions.filter((d) => !d.apply))}`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Canary: kan de browser de imports van dit bestand ophalen?
// ─────────────────────────────────────────────────────────────────────────────

test('CANARY — elke statische import van transport.mjs is over HTTP bereikbaar en is ESM', async (t) => {
  const { baseUrl } = await startServer(t);

  // De twee modules die `transport.mjs` statisch importeert moeten allebei door
  // een browser op te halen zijn, anders laadt het bestand daar niet. `/client/*`
  // en `/shared/*` zijn de enige twee mounts naast `frontend/` (`server/index.mjs`).
  for (const modulePath of ['/client/flow/reconnect-state.mjs', '/shared/protocol/snapshot-precedence.mjs']) {
    const response = await fetch(`${baseUrl}${modulePath}`);
    assert.equal(response.status, 200, `${modulePath} moet statisch geserveerd worden`);
    assert.match(response.headers.get('content-type') ?? '', /javascript/, modulePath);
    // Een module die nog CommonJS is, wordt door een browser niet geladen ook
    // al wordt hij netjes geserveerd. `module.exports`/`require(` mag er dus
    // niet als code in staan.
    const source = await response.text();
    const code = source.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
    assert.doesNotMatch(code, /\bmodule\.exports\b/, `${modulePath} is nog CommonJS`);
    assert.doesNotMatch(code, /\brequire\(/, `${modulePath} is nog CommonJS`);
  }

  // De oude plek blijft onbereikbaar: `server/**` is bewust niet gemount, en er
  // is met opzet geen re-export-shim achtergebleven. Één module, één plek.
  const oldLocation = await fetch(`${baseUrl}/server/architecture/snapshot-precedence.js`);
  assert.equal(oldLocation.status, 404);
});
