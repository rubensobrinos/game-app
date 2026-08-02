import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDuplicateAction } from './idempotency.mjs';

/** @returns {import('./idempotency.mjs').ActionStore} Map-gebaseerde fake store. */
function createFakeStore() {
  const map = new Map();
  return {
    get: (actionId) => map.get(actionId),
    set: (actionId, ack) => map.set(actionId, ack),
    _map: map,
  };
}

test('nieuwe actionId, eerste aanroep: geen replay, functie zet zelf niets weg', () => {
  const store = createFakeStore();
  const result = resolveDuplicateAction(store, 'act_001', 'round:answer');
  assert.deepEqual(result, { ok: true, replay: false });
  assert.equal(store._map.size, 0);
});

test('herhaalde actionId met opgeslagen ack: replay met exact dezelfde ack', () => {
  const store = createFakeStore();
  const ack = { actionId: 'act_002', ok: true, serverTime: 123, payload: { roundId: 'round_07' } };
  store.set('act_002', ack);

  const result = resolveDuplicateAction(store, 'act_002', 'round:answer');
  assert.deepEqual(result, { ok: true, replay: true, ack });
  assert.equal(result.ack, ack);
});

test('nieuwe actionId, round:answer, alreadyAnswered: true → ALREADY_ANSWERED', () => {
  const store = createFakeStore();
  const result = resolveDuplicateAction(store, 'act_003', 'round:answer', {
    alreadyAnswered: true,
  });
  assert.deepEqual(result, { ok: false, replay: false, reason: 'ALREADY_ANSWERED' });
});

test('nieuwe actionId, round:answer, alreadyAnswered als functie die true geeft → ALREADY_ANSWERED', () => {
  const store = createFakeStore();
  const result = resolveDuplicateAction(store, 'act_004', 'round:answer', {
    alreadyAnswered: () => true,
  });
  assert.deepEqual(result, { ok: false, replay: false, reason: 'ALREADY_ANSWERED' });
});

test('andere event dan round:answer met alreadyAnswered: true levert geen ALREADY_ANSWERED op', () => {
  const store = createFakeStore();
  const result = resolveDuplicateAction(store, 'act_005', 'player:rename', {
    alreadyAnswered: true,
  });
  assert.deepEqual(result, { ok: true, replay: false });
});
