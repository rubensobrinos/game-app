import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSocketServer, createInMemoryActionStore } from './fake-transport.mjs';
import {
  runEnvelopeIdempotencyScenario,
  runOversizedPayloadScenario,
} from './envelope-idempotency-scenario.mjs';
import { parseClientEnvelope, buildAck, assertPayloadSize } from '../../../server/protocol/envelope.mjs';
import { resolveDuplicateAction } from '../../../server/protocol/idempotency.mjs';

const m1 = { parseClientEnvelope, buildAck, resolveDuplicateAction };

// Rijen 6-9 draaien allemaal binnen één scenario-run, want ze bouwen op
// elkaar voort (dezelfde socketverbinding, dezelfde ronde).
test('runEnvelopeIdempotencyScenario: create -> join -> round:answer -> dubbele actionId -> idempotente ack', () => {
  const socketServer = createFakeSocketServer();
  const actionStore = createInMemoryActionStore();

  const result = runEnvelopeIdempotencyScenario(socketServer, actionStore, m1);

  // Rij 6 — eerste round:answer (actionId A) -> ok:true, mutationCount === 1.
  assert.equal(result.firstAck.ok, true);
  assert.equal(result.mutationCount, 1);

  // Rij 7 — retry met dezelfde actionId A -> identieke ack, mutationCount blijft 1.
  assert.deepEqual(result.retryAck, result.firstAck);
  assert.equal(result.mutationCount, 1);

  // Rij 8 — nieuwe actionId B, zelfde antwoordinhoud, ná acceptatie -> ALREADY_ANSWERED.
  assert.equal(result.secondActionAck.ok, false);
  assert.equal(result.secondActionAck.payload.code, 'ALREADY_ANSWERED');
  assert.equal(result.mutationCount, 1);

  // Rij 9 — nieuwe actionId C, ánder antwoord, ná acceptatie -> ALREADY_ANSWERED.
  assert.equal(result.thirdActionAck.ok, false);
  assert.equal(result.thirdActionAck.payload.code, 'ALREADY_ANSWERED');
  assert.equal(result.mutationCount, 1);

  assert.equal(result.alreadyAnsweredCount, 2);
});

test('runEnvelopeIdempotencyScenario: firstAck/retryAck delen exact hetzelfde actionId', () => {
  const socketServer = createFakeSocketServer();
  const actionStore = createInMemoryActionStore();
  const result = runEnvelopeIdempotencyScenario(socketServer, actionStore, m1);
  assert.equal(result.firstAck.actionId, 'act_A');
  assert.equal(result.retryAck.actionId, 'act_A');
});

// Rij 10 — payload groter dan de afgesproken limiet, vóór envelope-parse:
// geweigerd door assertPayloadSize, parseClientEnvelope wordt niet aangeroepen.
test('runOversizedPayloadScenario: te grote rawPayload -> assertPayloadSize weigert, parseClientEnvelope niet aangeroepen', () => {
  const oversizedRawPayload = JSON.stringify({
    event: 'round:answer',
    actionId: 'act_big',
    payload: { text: 'x'.repeat(10_000) },
  });
  const maxBytes = 1024;

  const result = runOversizedPayloadScenario({ assertPayloadSize, parseClientEnvelope }, oversizedRawPayload, maxBytes);

  assert.deepEqual(result.sizeCheck, { ok: false, reason: 'payload-too-large' });
  assert.equal(result.parseWasCalled, false);
});

test('runOversizedPayloadScenario: kleine rawPayload binnen de limiet -> geaccepteerd, parseClientEnvelope wél aangeroepen', () => {
  const smallRawPayload = JSON.stringify({
    event: 'round:answer',
    actionId: 'act_small',
    payload: { optionId: 'opt_2' },
  });
  const maxBytes = 1024;

  const result = runOversizedPayloadScenario({ assertPayloadSize, parseClientEnvelope }, smallRawPayload, maxBytes);

  assert.equal(result.sizeCheck.ok, true);
  assert.equal(result.parseWasCalled, true);
});
