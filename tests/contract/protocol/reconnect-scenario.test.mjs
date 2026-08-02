import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSocketServer } from './fake-transport.mjs';
import { runReconnectScenario } from './reconnect-scenario.mjs';
import {
  backoffDelaySeconds,
  resolveReconnectResend,
  buildReconnectSocketAuth,
} from '../../../server/protocol/reconnect.mjs';
import { parseSocketAuthPayload } from '../../../server/protocol/auth-shape.mjs';

const m6 = { backoffDelaySeconds, resolveReconnectResend, buildReconnectSocketAuth };

test('runReconnectScenario: reconnectOk en pauseOnRecoveryOk zijn beide true', () => {
  const socketServer = createFakeSocketServer();
  const result = runReconnectScenario(socketServer, m6, parseSocketAuthPayload);
  assert.equal(result.reconnectOk, true);
  assert.equal(result.pauseOnRecoveryOk, true);
});

// Rij 20 — socket valt weg, client doet 6 reconnectpogingen: vertragingen
// exact [1, 2, 4, 8, 16, 30] volgens PR6's backoffDelaySeconds.
test('runReconnectScenario: backoffDelays voor 6 pogingen zijn exact [1, 2, 4, 8, 16, 30]', () => {
  const socketServer = createFakeSocketServer();
  const result = runReconnectScenario(socketServer, m6, parseSocketAuthPayload);
  assert.deepEqual(result.backoffDelays, [1, 2, 4, 8, 16, 30]);
});

// Rij 21 — reconnect terwijl het laatste antwoord al een ack had: niet
// opnieuw verzonden (resolveReconnectResend -> resend: false).
test('runReconnectScenario: reconnect met reeds ge-ackt laatste antwoord -> resend: false', () => {
  const socketServer = createFakeSocketServer();
  const result = runReconnectScenario(socketServer, m6, parseSocketAuthPayload);
  assert.deepEqual(result.resendAfterAck, { ok: true, resend: false });
});

// Rij 22 — reconnect zonder ontvangen ack op het laatste antwoord: exact
// dezelfde actionId herhaald, nooit een nieuwe.
test('runReconnectScenario: reconnect zonder ack -> exact dezelfde actionId herhaald', () => {
  const socketServer = createFakeSocketServer();
  const result = runReconnectScenario(socketServer, m6, parseSocketAuthPayload);
  assert.deepEqual(result.resendWithoutAck, { ok: true, resend: true, actionId: 'act_last' });
});

// Rij 23 — socketServer.restart() midden in ROUND_ACTIVE: room-fase wordt
// PAUSED; na reconnect + snapshot toont de client PAUSED gevolgd door
// hervatten met een nieuwe, kortere countdown — geen fase stilzwijgend
// overgeslagen.
test('runReconnectScenario: fasevolgorde na restart is [ROUND_ACTIVE, PAUSED, ROUND_ACTIVE], nooit een fase overgeslagen', () => {
  const socketServer = createFakeSocketServer();
  const result = runReconnectScenario(socketServer, m6, parseSocketAuthPayload);
  assert.deepEqual(result.phaseSequenceObservedByClient, ['ROUND_ACTIVE', 'PAUSED', 'ROUND_ACTIVE']);
});

test('runReconnectScenario: roundId blijft exact "round_07" over de hele restart-episode (geen fase-skip naar een andere ronde)', () => {
  const socketServer = createFakeSocketServer();
  const result = runReconnectScenario(socketServer, m6, parseSocketAuthPayload);
  assert.equal(result.roundIdConsistentAcrossRestart, true);
});

// Rij 24 — reconnect-handshake ná een restart: buildReconnectSocketAuth
// gebruikt exact hetzelfde { sessionToken, protocolVersion }-schema als de
// eerste handshake, geen apart schema.
test('runReconnectScenario: handshakeAfterRestart -> ok, exact { sessionToken, protocolVersion: "v1" }', () => {
  const socketServer = createFakeSocketServer();
  const result = runReconnectScenario(socketServer, m6, parseSocketAuthPayload);
  assert.equal(result.handshakeAfterRestart.ok, true);
  assert.deepEqual(result.handshakeAfterRestart.payload, {
    sessionToken: 'tok_player1',
    protocolVersion: 'v1',
  });
});

test('buildReconnectSocketAuth + parseSocketAuthPayload: ongeldig sessionToken bij reconnect -> afwijzing via hetzelfde schema, geen throw', () => {
  const validateSocketAuthPayload = (payload) => {
    const result = parseSocketAuthPayload(payload);
    return result.ok
      ? { ok: true, payload: { sessionToken: result.sessionToken, protocolVersion: result.protocolVersion } }
      : { ok: false, reason: result.code };
  };
  assert.doesNotThrow(() => buildReconnectSocketAuth('', validateSocketAuthPayload));
  const result = buildReconnectSocketAuth('', validateSocketAuthPayload);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'TOKEN_INVALID');
});
