import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRoomStatePayload,
  validateRoomPlayerChangedPayload,
  validateRoomLockChangedPayload,
  validateGameStartedPayload,
} from './server-events-room-lifecycle.mjs';

// Rij 4
test('validateRoomStatePayload({}) → ok:true (plaatshouder)', () => {
  assert.deepEqual(validateRoomStatePayload({}), { ok: true });
});
test('validateRoomStatePayload(null) → afgewezen', () => {
  assert.deepEqual(validateRoomStatePayload(null), { ok: false, code: null });
});

// Rij 5
test('validateRoomPlayerChangedPayload: geldige join-delta → ok:true', () => {
  assert.deepEqual(
    validateRoomPlayerChangedPayload({
      playerCount: 23,
      delta: { type: 'join', playerId: 'p_8f42d1' },
    }),
    { ok: true },
  );
});

// Rij 6 — drie losse gevallen
test('validateRoomPlayerChangedPayload: playerCount negatief → afgewezen', () => {
  const result = validateRoomPlayerChangedPayload({
    playerCount: -1,
    delta: { type: 'join', playerId: 'p_8f42d1' },
  });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateRoomPlayerChangedPayload: onbekend delta.type ("teleport") → afgewezen', () => {
  const result = validateRoomPlayerChangedPayload({
    playerCount: 23,
    delta: { type: 'teleport', playerId: 'p_8f42d1' },
  });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateRoomPlayerChangedPayload: lege delta.playerId → afgewezen', () => {
  const result = validateRoomPlayerChangedPayload({
    playerCount: 23,
    delta: { type: 'join', playerId: '' },
  });
  assert.deepEqual(result, { ok: false, code: null });
});

// Rij 7
test('validateRoomLockChangedPayload({ locked: true }) → ok:true', () => {
  assert.deepEqual(validateRoomLockChangedPayload({ locked: true }), { ok: true });
});
test('validateRoomLockChangedPayload({ locked: false }) → ok:true', () => {
  assert.deepEqual(validateRoomLockChangedPayload({ locked: false }), { ok: true });
});

// Rij 8
test('validateRoomLockChangedPayload({ locked: "true" }) → afgewezen (geen boolean)', () => {
  assert.deepEqual(validateRoomLockChangedPayload({ locked: 'true' }), { ok: false, code: null });
});
test('validateRoomLockChangedPayload({}) → afgewezen (locked ontbreekt)', () => {
  assert.deepEqual(validateRoomLockChangedPayload({}), { ok: false, code: null });
});

// Rij 9
test('validateGameStartedPayload: volledige, geldige payload → ok:true', () => {
  assert.deepEqual(
    validateGameStartedPayload({
      matchId: 'match_01J...',
      totalRounds: 10,
      countdownEndsAt: 1785623412000,
    }),
    { ok: true },
  );
});

// Rij 10 — vier losse gevallen
test('validateGameStartedPayload: ontbrekend matchId → afgewezen', () => {
  const result = validateGameStartedPayload({ totalRounds: 10, countdownEndsAt: 1785623412000 });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateGameStartedPayload: totalRounds 0 → afgewezen', () => {
  const result = validateGameStartedPayload({
    matchId: 'match_01J...',
    totalRounds: 0,
    countdownEndsAt: 1785623412000,
  });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateGameStartedPayload: totalRounds -1 → afgewezen', () => {
  const result = validateGameStartedPayload({
    matchId: 'match_01J...',
    totalRounds: -1,
    countdownEndsAt: 1785623412000,
  });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateGameStartedPayload: countdownEndsAt als string ("straks") → afgewezen', () => {
  const result = validateGameStartedPayload({
    matchId: 'match_01J...',
    totalRounds: 10,
    countdownEndsAt: 'straks',
  });
  assert.deepEqual(result, { ok: false, code: null });
});
