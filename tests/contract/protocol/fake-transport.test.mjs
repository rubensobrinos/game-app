import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFakeFastify,
  createFakeSocketServer,
  createInMemoryActionStore,
} from './fake-transport.mjs';
import { resolveDuplicateAction } from '../../../server/protocol/idempotency.mjs';

// Rij 1 — createFakeFastify().route(...) + .inject(...) voor een simpele GET:
// statusCode/payload komen ongewijzigd terug, geen netwerkcode aangesproken.
test('createFakeFastify: route + inject voor een simpele GET geeft statusCode/payload ongewijzigd terug', () => {
  const fastify = createFakeFastify();
  fastify.route('GET', '/api/v1/time', () => ({
    statusCode: 200,
    payload: { serverTime: 1785623412000 },
  }));

  const response = fastify.inject({ method: 'GET', url: '/api/v1/time' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { serverTime: 1785623412000 });
});

test('createFakeFastify: onbekende route -> 404, geen throw', () => {
  const fastify = createFakeFastify();
  assert.doesNotThrow(() => fastify.inject({ method: 'GET', url: '/nope' }));
  const response = fastify.inject({ method: 'GET', url: '/nope' });
  assert.equal(response.statusCode, 404);
});

test('createFakeFastify: route-parameters worden doorgegeven via req.params', () => {
  const fastify = createFakeFastify();
  fastify.route('GET', '/api/v1/games/:code/state', (req) => ({
    statusCode: 200,
    payload: { code: req.params.code },
  }));

  const response = fastify.inject({ method: 'GET', url: '/api/v1/games/482917/state' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { code: '482917' });
});

// Rij 2 — createFakeSocketServer().connect(authPayload) + onConnection-
// handler: server ontvangt exact dezelfde authPayload als de client
// verstuurde.
test('createFakeSocketServer: connect() geeft dezelfde authPayload door aan de onConnection-handler', () => {
  const socketServer = createFakeSocketServer();
  let receivedAuthPayload;
  socketServer.onConnection((_socket, authPayload) => {
    receivedAuthPayload = authPayload;
  });

  const sentAuthPayload = { sessionToken: 'tok_abc123', protocolVersion: 'v1' };
  socketServer.connect(sentAuthPayload);

  assert.deepEqual(receivedAuthPayload, sentAuthPayload);
});

// Rij 3 — toRoom(id).emit(...) met twee sockets in room A en één in room B:
// alleen de twee A-sockets ontvangen het event.
test('createFakeSocketServer: toRoom(id).emit bereikt alleen sockets in die room', () => {
  const socketServer = createFakeSocketServer();
  socketServer.onConnection((socket, authPayload) => {
    socket.join(authPayload.roomId);
  });

  const clientA1 = socketServer.connect({ roomId: 'room_A' });
  const clientA2 = socketServer.connect({ roomId: 'room_A' });
  const clientB1 = socketServer.connect({ roomId: 'room_B' });

  const receivedByA1 = [];
  const receivedByA2 = [];
  const receivedByB1 = [];
  clientA1.on('room:player-changed', (payload) => receivedByA1.push(payload));
  clientA2.on('room:player-changed', (payload) => receivedByA2.push(payload));
  clientB1.on('room:player-changed', (payload) => receivedByB1.push(payload));

  socketServer.toRoom('room_A').emit('room:player-changed', { playerCount: 3 });

  assert.deepEqual(receivedByA1, [{ playerCount: 3 }]);
  assert.deepEqual(receivedByA2, [{ playerCount: 3 }]);
  assert.deepEqual(receivedByB1, []);
});

// Rij 4 — createInMemoryActionStore() tegen PR1's echte resolveDuplicateAction:
// werkt zonder aanpassing.
test('createInMemoryActionStore: voldoet aan het ActionStore-contract van resolveDuplicateAction', () => {
  const actionStore = createInMemoryActionStore();

  const firstResult = resolveDuplicateAction(actionStore, 'act_1', 'round:answer', {
    alreadyAnswered: false,
  });
  assert.deepEqual(firstResult, { ok: true, replay: false });

  actionStore.set('act_1', { actionId: 'act_1', ok: true, serverTime: 1, payload: {} });

  const retryResult = resolveDuplicateAction(actionStore, 'act_1', 'round:answer', {
    alreadyAnswered: false,
  });
  assert.deepEqual(retryResult, {
    ok: true,
    replay: true,
    ack: { actionId: 'act_1', ok: true, serverTime: 1, payload: {} },
  });

  const newActionAlreadyAnswered = resolveDuplicateAction(actionStore, 'act_2', 'round:answer', {
    alreadyAnswered: true,
  });
  assert.deepEqual(newActionAlreadyAnswered, { ok: false, replay: false, reason: 'ALREADY_ANSWERED' });
});

// Rij 5 — socketServer.restart(): alle bestaande verbindingen/rooms zijn weg;
// een nieuwe connect() na restart werkt weer normaal.
test('createFakeSocketServer: restart() wist verbindingen/rooms, nieuwe connect() werkt weer normaal', () => {
  const socketServer = createFakeSocketServer();
  const joinedRooms = [];
  socketServer.onConnection((socket, authPayload) => {
    socket.join(authPayload.roomId);
    joinedRooms.push(authPayload.roomId);
  });

  const beforeRestart = socketServer.connect({ roomId: 'room_A' });
  const receivedBeforeRestart = [];
  beforeRestart.on('game:paused', (payload) => receivedBeforeRestart.push(payload));

  socketServer.restart();

  // De oude room-broadcast bereikt niemand meer na restart.
  socketServer.toRoom('room_A').emit('game:paused', { reason: 'restart' });
  assert.deepEqual(receivedBeforeRestart, []);

  // Een nieuwe connect() na restart roept de (nog steeds geregistreerde)
  // onConnection-handler weer normaal aan.
  const afterRestart = socketServer.connect({ roomId: 'room_A' });
  const receivedAfterRestart = [];
  afterRestart.on('game:paused', (payload) => receivedAfterRestart.push(payload));

  socketServer.toRoom('room_A').emit('game:paused', { reason: 'restart-again' });
  assert.deepEqual(receivedAfterRestart, [{ reason: 'restart-again' }]);
  assert.deepEqual(joinedRooms, ['room_A', 'room_A']);
});
