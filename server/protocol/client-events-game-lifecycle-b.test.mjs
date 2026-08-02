import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRequiredRole } from './client-events-game-lifecycle-a.mjs';
import {
  validateGameLockPayload,
  validateGameKickPayload,
  validateGameFinishPayload,
  validateGameRematchPayload,
} from './client-events-game-lifecycle-b.mjs';

// Rij 9 — game:lock, { locked: true } en { locked: false }: beide ok.
test('validateGameLockPayload: { locked: true } -> ok', () => {
  assert.deepEqual(validateGameLockPayload({ locked: true }), { ok: true });
});

test('validateGameLockPayload: { locked: false } -> ok', () => {
  assert.deepEqual(validateGameLockPayload({ locked: false }), { ok: true });
});

// Rij 10 — game:lock, { locked: "true" }: afgewezen (string i.p.v. boolean).
test('validateGameLockPayload: { locked: "true" } -> afgewezen (string i.p.v. boolean)', () => {
  assert.deepEqual(validateGameLockPayload({ locked: 'true' }), { ok: false, code: null });
});

test('validateGameLockPayload: extra sleutel -> afgewezen', () => {
  assert.deepEqual(validateGameLockPayload({ locked: true, extra: 1 }), { ok: false, code: null });
});

// Rij 11 — game:kick, { playerId: "p_8f42d1" }: ok.
test('validateGameKickPayload: geldige playerId -> ok', () => {
  assert.deepEqual(validateGameKickPayload({ playerId: 'p_8f42d1' }), { ok: true });
});

// Rij 12 — game:kick, {} en { playerId: "" }: beide afgewezen.
test('validateGameKickPayload: {} -> afgewezen (playerId ontbreekt)', () => {
  assert.deepEqual(validateGameKickPayload({}), { ok: false, code: null });
});

test('validateGameKickPayload: { playerId: "" } -> afgewezen (lege string)', () => {
  assert.deepEqual(validateGameKickPayload({ playerId: '' }), { ok: false, code: null });
});

// Rij 13 — game:finish, {}: ok.
test('validateGameFinishPayload: leeg object -> ok', () => {
  assert.deepEqual(validateGameFinishPayload({}), { ok: true });
});

test('validateGameFinishPayload: extra sleutel -> afgewezen', () => {
  assert.deepEqual(validateGameFinishPayload({ extra: 1 }), { ok: false, code: null });
});

// Rij 14 — game:rematch, {}: ok.
test('validateGameRematchPayload: leeg object -> ok', () => {
  assert.deepEqual(validateGameRematchPayload({}), { ok: true });
});

test('validateGameRematchPayload: extra sleutel -> afgewezen', () => {
  assert.deepEqual(validateGameRematchPayload({ extra: 1 }), { ok: false, code: null });
});

// Rij 15 — elk van de vier PR4b-events door een sessie met rol ["player"]:
// stuk voor stuk NOT_HOST (via hasRequiredRole, los van payloadvorm).
const pr4bEventNames = ['game:lock', 'game:kick', 'game:finish', 'game:rematch'];
for (const eventName of pr4bEventNames) {
  test(`${eventName}: sessie met rol ["player"] dekt niet de vereiste rol "host"`, () => {
    assert.equal(hasRequiredRole(['player'], 'host'), false);
    // Vermeldt eventName in de testnaam voor traceerbaarheid naar de
    // testtabel; de rolcheck zelf is event-onafhankelijk (zie PR4a).
    assert.equal(typeof eventName, 'string');
  });
}

// Aanvullend: malformed payloads voor PR4b, geen throw.
const pr4bValidators = [
  ['game:lock', validateGameLockPayload],
  ['game:kick', validateGameKickPayload],
  ['game:finish', validateGameFinishPayload],
  ['game:rematch', validateGameRematchPayload],
];
const malformedPayloads = [
  ['null', null],
  ['array', []],
  ['string', 'string'],
];

for (const [eventName, validator] of pr4bValidators) {
  for (const [label, payload] of malformedPayloads) {
    test(`${eventName}: payload ${label} -> afgewezen, geen throw`, () => {
      assert.doesNotThrow(() => validator(payload));
      assert.deepEqual(validator(payload), { ok: false, code: null });
    });
  }
}
