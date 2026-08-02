// tests/integration/matrix-row-11-multi-room-socket-isolation.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 11 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra twee onafhankelijke rooms tegelijk tegen
//     dezelfde server-instantie kunnen draaien (geen single-room-only
//     prototype), mag dit naar test.skip-code (DT3b)."
//   - Prerequisite: "Werkende multi-room state-opslag (roomgescopede keys of
//     gelijkwaardig) en socket-roomstrategie zoals in ARCHITECTURE.md
//     beschreven, met minimaal twee gelijktijdig draaiende rooms in de
//     testomgeving."
//   - Bewijs: `server/transport/socket.mjs` implementeert precies de
//     "server-side roomchannels" die ARCHITECTURE.md §Socketstrategie eist:
//     `roomChannel(roomId)` (regel 68-70) geeft een Socket.IO-roomnaam per
//     game-room; elke connectie joint die room bij `connection`
//     (`socket.join(roomChannel(roomId))`, regel 666); elk `room`-serverevent
//     gaat via `emitToRoom()` (regel 372-374, `io.to(roomChannel(roomId))`),
//     nooit room-breed naar alle sockets. `server/data/in-memory-store.js`
//     scopet zijn sleutels al per `roomId` (bewezen in eerdere audits).
//     `server/index.mjs`'s `attachSocketsIfAvailable()` (regel 297-311) hangt
//     deze laag daadwerkelijk aan een echte HTTP-server; dat is niet langer de
//     `501 NOT_IMPLEMENTED`-placeholder van de vorige heraudit.
//   - Deze test draait tegen de ÉCHTE server (`server/index.mjs`, via
//     `support/transport-harness.mjs`, dezelfde bedrading als `start()`) met
//     ÉCHTE WebSocket-verbindingen (`support/socket-io-test-client.mjs`), niet
//     tegen een fixture of een handmatig samengestelde Socket.IO-instantie.
//     Twee rooms draaien gelijktijdig: room A doorloopt een volledige
//     round-cyclus (start -> antwoord -> round:progress -> round:ended) terwijl
//     room B alleen een lock-toggle doet. Elke kant wordt gecontroleerd op
//     zowel afwezigheid van de events van de ander als afwezigheid van de
//     identifiers van de ander in de ontvangen frames.
//   - Datum van deze audit/activatie: 2026-08-02 (DT-R1-heraudit-integratie,
//     derde heraudit).

import test from 'node:test';
import assert from 'node:assert/strict';

import { startTransportServer } from './support/transport-harness.mjs';

const CREATE_BODY = Object.freeze({ preset: 'quick_start', language: 'nl' });
const COUNTDOWN_MS = 3000;

async function createRoomOverHttp(harness, displayName) {
  const response = await harness.post('/api/v1/games', {
    body: { config: CREATE_BODY, hostParticipates: true, displayName },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}

async function joinOverHttp(harness, body) {
  const response = await harness.post('/api/v1/games/join', { body });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

test('Matrixrij 11: twee gelijktijdig actieve rooms over echte sockets lekken geen state en geen events naar elkaar', async (t) => {
  const harness = await startTransportServer(t);

  // ── Twee onafhankelijke rooms, tegelijk tegen dezelfde server-instantie ──
  const hostA = await createRoomOverHttp(harness, 'Host A');
  const hostB = await createRoomOverHttp(harness, 'Host B');
  assert.notEqual(hostA.roomId, hostB.roomId);
  assert.notEqual(hostA.gameCode, hostB.gameCode);

  const playerA = await joinOverHttp(harness, { gameCode: hostA.gameCode, displayName: 'A-speler', joinSource: 'code' });
  const playerB = await joinOverHttp(harness, { gameCode: hostB.gameCode, displayName: 'B-speler', joinSource: 'code' });

  const hostASocket = await harness.connect(hostA.sessionToken);
  const playerASocket = await harness.connect(playerA.sessionToken);
  const hostBSocket = await harness.connect(hostB.sessionToken);
  const playerBSocket = await harness.connect(playerB.sessionToken);

  const connected = await harness.attached.io.fetchSockets();
  assert.equal(connected.length, 4, 'alle vier de sockets zijn echt verbonden');
  // Twee verschillende Socket.IO-roomkanalen — geen enkele socket deelt er één
  // met de andere game-room.
  const roomIdsSeen = new Set(connected.map((socket) => socket.data.roomId));
  assert.deepEqual([...roomIdsSeen].sort(), [hostA.roomId, hostB.roomId].sort());

  // ── Room B: alleen een lock-toggle, geen match ──────────────────────────
  const lockAck = await hostBSocket.emitWithAck('game:lock', { actionId: 'act_b_lock', payload: { locked: true } });
  assert.equal(lockAck.ok, true, JSON.stringify(lockAck));
  await hostBSocket.waitFor('room:lock-changed');
  await playerBSocket.waitFor('room:lock-changed');

  // ── Room A: een volledige start -> ronde -> antwoord -> einde-cyclus ────
  const startAck = await hostASocket.emitWithAck('game:start', { actionId: 'act_a_start', payload: {} });
  assert.equal(startAck.ok, true, JSON.stringify(startAck));
  await hostASocket.waitFor('game:started');
  await playerASocket.waitFor('game:started');

  harness.clock.advance(COUNTDOWN_MS);
  await harness.scheduler.fireAll();
  const roundStartedA = await hostASocket.waitFor('round:started');
  await playerASocket.waitFor('round:started');

  const roundDoc = await harness.store.loadRound(hostA.roomId, roundStartedA.payload.matchId, roundStartedA.payload.roundId);
  assert.notEqual(roundDoc, null);

  const answerAck = await playerASocket.emitWithAck('round:answer', {
    actionId: 'act_a_answer',
    payload: {
      roundId: roundStartedA.payload.roundId,
      answer: { optionId: roundDoc.correctAnswer.optionId },
      clientAnsweredAt: harness.clock.now(),
    },
  });
  assert.equal(answerAck.ok, true, JSON.stringify(answerAck));
  await playerASocket.waitFor('round:answer-accepted');
  await hostASocket.waitFor('round:progress');

  harness.clock.set(roundStartedA.payload.endsAt);
  await harness.scheduler.fireAll();
  await hostASocket.waitFor('round:ended');
  await playerASocket.waitFor('round:ended');

  // ── Deterministische barrière: elke socket doet één rondgang ────────────
  for (const [index, socket] of [hostASocket, playerASocket, hostBSocket, playerBSocket].entries()) {
    const ack = await socket.emitWithAck('share:opened', {
      actionId: `act_flush_${index}`,
      payload: { method: 'link' },
    });
    assert.equal(ack.ok, true, JSON.stringify(ack));
  }

  // ── Room B zag NIETS van room A's matchcyclus ────────────────────────────
  for (const socket of [hostBSocket, playerBSocket]) {
    for (const event of ['game:started', 'round:started', 'round:progress', 'round:ended', 'round:answer-accepted']) {
      assert.equal(socket.eventsNamed(event).length, 0, `room B mag "${event}" van room A niet ontvangen`);
    }
    assert.equal(socket.eventsNamed('room:lock-changed').length, 1, 'room B ziet alleen zijn eigen lock-event');
  }

  // ── Room A zag NIETS van room B's lock-toggle ────────────────────────────
  for (const socket of [hostASocket, playerASocket]) {
    assert.equal(socket.eventsNamed('room:lock-changed').length, 0, 'room A mag room B\'s lock-event niet ontvangen');
    assert.equal(socket.eventsNamed('game:started').length, 1);
    assert.equal(socket.eventsNamed('round:started').length, 1);
    assert.equal(socket.eventsNamed('round:ended').length, 1);
  }

  // ── Geen enkel ontvangen frame noemt een identifier van de andere room ──
  const wireA = JSON.stringify([hostASocket, playerASocket].map((socket) => socket.received));
  const wireB = JSON.stringify([hostBSocket, playerBSocket].map((socket) => socket.received));
  for (const identifier of [hostB.roomId, hostB.gameCode, hostB.inviteId, playerB.playerId]) {
    assert.ok(!wireA.includes(identifier), `room A ontving een identifier van room B: ${identifier}`);
  }
  for (const identifier of [hostA.roomId, hostA.gameCode, hostA.inviteId, playerA.playerId, startAck.payload.matchId, roundStartedA.payload.roundId]) {
    assert.ok(!wireB.includes(identifier), `room B ontving een identifier van room A: ${identifier}`);
  }

  // ── De domeinstate is ook echt uit elkaar gebleven (roomgescopede opslag) ──
  const roomADoc = await harness.store.loadRoom(hostA.roomId);
  const roomBDoc = await harness.store.loadRoom(hostB.roomId);
  assert.equal(roomADoc.locked, false, 'room A is nooit vergrendeld');
  assert.equal(roomBDoc.locked, true, 'room B is vergrendeld gebleven');
  assert.notEqual(roomADoc.currentMatchId, null, 'room A heeft een lopende match');
  assert.equal(roomBDoc.currentMatchId, null, 'room B heeft nooit een match gestart');
});
