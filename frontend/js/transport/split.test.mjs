// transport/split.test.mjs — refactor 9 (docs/openstaand/refactor/9-transport-client.md).
//
// transport.mjs (978 regels) is langs zijn eigen kopjes opgesplitst in vier
// submodules, met transport.mjs zelf als re-exporterende facade. Het echte
// gedrag (REST, socket, herverbinden, de precedentiepoort) staat al volledig
// getoetst in `transport.test.mjs` (tegen een échte server) — dat bestand is
// bewust ongewijzigd gebleven, want dat IS het bewijs dat de opsplitsing geen
// gedrag heeft veranderd. Dit bestand bewaakt iets anders, wat een
// gedragstest niet vangt: dat de facade ECHT re-exporteert (dezelfde
// bindingen, geen kopie die morgen uit de pas kan gaan lopen) en dat elke
// submodule ook op zichzelf, direct geïmporteerd, bruikbaar is.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as facade from '../transport.mjs';
import * as protocolModule from './protocol.mjs';
import * as verbindingModule from './verbinding.mjs';
import * as precedentieModule from './precedentie.mjs';

test('transport.mjs re-exporteert protocol.mjs — zelfde bindingen, geen kopie', () => {
  assert.equal(facade.PROTOCOL_VERSION, protocolModule.PROTOCOL_VERSION);
  assert.equal(facade.TRANSPORT_ERROR_CODES, protocolModule.TRANSPORT_ERROR_CODES);
  assert.equal(facade.ProtocolError, protocolModule.ProtocolError);
});

test('transport.mjs re-exporteert createTransport uit verbinding.mjs — zelfde functie', () => {
  assert.equal(facade.createTransport, verbindingModule.createTransport);
});

test('transport.mjs re-exporteert createSnapshotPrecedenceGate uit precedentie.mjs — zelfde functie', () => {
  assert.equal(facade.createSnapshotPrecedenceGate, precedentieModule.createSnapshotPrecedenceGate);
});

test('protocol.mjs is zelfstandig importeerbaar en compleet: PROTOCOL_VERSION, TRANSPORT_ERROR_CODES, ProtocolError', () => {
  assert.equal(protocolModule.PROTOCOL_VERSION, 'v1');
  assert.deepEqual(protocolModule.TRANSPORT_ERROR_CODES, { NETWORK: 'NETWORK_ERROR', NOT_CONNECTED: 'NOT_CONNECTED' });
  assert.ok(Object.isFrozen(protocolModule.TRANSPORT_ERROR_CODES));
  const err = new protocolModule.ProtocolError('SOME_CODE', 'iets ging mis', { x: 1 });
  assert.equal(err.name, 'ProtocolError');
  assert.equal(err.code, 'SOME_CODE');
  assert.equal(err.message, 'iets ging mis');
  assert.deepEqual(err.meta, { x: 1 });
  assert.ok(err instanceof Error);
});

test('precedentie.mjs is zelfstandig importeerbaar: createSnapshotPrecedenceGate levert de drie functies', () => {
  const gate = precedentieModule.createSnapshotPrecedenceGate();
  assert.equal(typeof gate.registerSnapshot, 'function');
  assert.equal(typeof gate.registerEvent, 'function');
  assert.equal(typeof gate.inspect, 'function');
  // Zonder ooit een snapshot gezien te hebben: precies de startstaat die
  // `createTransport`'s default-gate ook verwacht (transport.test.mjs bewijst
  // het gedrag hierop verder; dit bewijst alleen dat de vorm klopt).
  const state = gate.inspect();
  assert.equal(state.roomCode, null);
  assert.equal(state.matchId, null);
  assert.equal(state.matchSequence, null);
  assert.equal(state.protocolVersion, protocolModule.PROTOCOL_VERSION);
});

test('verbinding.mjs is zelfstandig importeerbaar: createTransport levert de zeven contractfuncties', () => {
  const transport = verbindingModule.createTransport({ baseUrl: 'http://localhost:1' });
  for (const naam of ['createGame', 'previewInvite', 'joinGame', 'fetchState', 'leaveGame', 'fetchServerTime', 'connect']) {
    assert.equal(typeof transport[naam], 'function', `mist ${naam}`);
  }
});

test('verbinding.mjs gebruikt precedentie.mjs\'s createSnapshotPrecedenceGate als default gate, geen eigen kopie', () => {
  // Een meegegeven precedenceGate moet degene zijn die daadwerkelijk gebruikt
  // wordt — het enige manier om van buitenaf te bewijzen dat createTransport
  // niet stiekem zijn eigen poort bouwt i.p.v. de geïmporteerde.
  let registerSnapshotCalls = 0;
  const spyGate = {
    registerSnapshot: (snapshot) => {
      registerSnapshotCalls += 1;
      return precedentieModule.createSnapshotPrecedenceGate().registerSnapshot(snapshot);
    },
    registerEvent: () => ({ apply: true }),
    inspect: () => ({}),
  };
  const fakeFetch = async () =>
    new Response(JSON.stringify({ state: { room: { code: 'X' }, serverTime: 1 } }), { status: 200 });
  const transport = verbindingModule.createTransport({
    baseUrl: 'http://localhost:1',
    fetchImpl: fakeFetch,
    precedenceGate: spyGate,
  });
  return transport.createGame({ config: {}, hostParticipates: true, displayName: null }).then(() => {
    assert.equal(registerSnapshotCalls, 1, 'createGame moet de meegegeven precedenceGate gebruiken, niet een eigen');
  });
});
