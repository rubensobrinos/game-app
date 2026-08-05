import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRequiredRole,
  validateGameStartPayload,
  validateGamePausePayload,
  validateGameResumePayload,
  validateGameNextPayload,
  validateGameRevealPayload,
} from './client-events-game-lifecycle-a.mjs';

// Rij 1 — game:start, {} als host: ok.
test('hasRequiredRole: host-rol dekt "host"', () => {
  assert.equal(hasRequiredRole(['host'], 'host'), true);
});

test('validateGameStartPayload: leeg object -> ok', () => {
  assert.deepEqual(validateGameStartPayload({}), { ok: true });
});

// Rij 2 — game:start, {} als player: NOT_HOST (rolcontrole, los van payload).
test('hasRequiredRole: player-rol dekt niet "host"', () => {
  assert.equal(hasRequiredRole(['player'], 'host'), false);
});

// Rij 3 — game:start, { extra: 1 } als host: afgewezen (extra sleutel).
test('validateGameStartPayload: extra sleutel -> afgewezen', () => {
  assert.deepEqual(validateGameStartPayload({ extra: 1 }), { ok: false, code: null });
});

// Rij 4 — game:pause, {} en { reason: "host offline" }: beide ok.
test('validateGamePausePayload: leeg object -> ok', () => {
  assert.deepEqual(validateGamePausePayload({}), { ok: true });
});

test('validateGamePausePayload: { reason: string } -> ok', () => {
  assert.deepEqual(validateGamePausePayload({ reason: 'host offline' }), { ok: true });
});

// Rij 5 — game:pause, { reason: 123 }: afgewezen (verkeerd type).
test('validateGamePausePayload: { reason: 123 } -> afgewezen (verkeerd type)', () => {
  assert.deepEqual(validateGamePausePayload({ reason: 123 }), { ok: false, code: null });
});

test('validateGamePausePayload: onbekende extra sleutel -> afgewezen', () => {
  assert.deepEqual(validateGamePausePayload({ reason: 'x', extra: true }), { ok: false, code: null });
});

// Rij 6 — game:resume, {}: ok.
test('validateGameResumePayload: leeg object -> ok', () => {
  assert.deepEqual(validateGameResumePayload({}), { ok: true });
});

test('validateGameResumePayload: extra sleutel -> afgewezen', () => {
  assert.deepEqual(validateGameResumePayload({ extra: 1 }), { ok: false, code: null });
});

// Rij 7 — game:next, {}: ok.
test('validateGameNextPayload: leeg object -> ok', () => {
  assert.deepEqual(validateGameNextPayload({}), { ok: true });
});

test('validateGameNextPayload: extra sleutel -> afgewezen', () => {
  assert.deepEqual(validateGameNextPayload({ extra: 1 }), { ok: false, code: null });
});

// Fase 4 (autoReveal) — game:reveal, {}: ok.
test('validateGameRevealPayload: leeg object -> ok', () => {
  assert.deepEqual(validateGameRevealPayload({}), { ok: true });
});

test('validateGameRevealPayload: extra sleutel -> afgewezen', () => {
  assert.deepEqual(validateGameRevealPayload({ extra: 1 }), { ok: false, code: null });
});

// Rij 8 — elk van de vijf PR4a-events met payload null, [], "string": stuk
// voor stuk afgewezen, geen throw.
const pr4aValidators = [
  ['game:start', validateGameStartPayload],
  ['game:pause', validateGamePausePayload],
  ['game:resume', validateGameResumePayload],
  ['game:next', validateGameNextPayload],
  ['game:reveal', validateGameRevealPayload],
];
const malformedPayloads = [
  ['null', null],
  ['array', []],
  ['string', 'string'],
];

for (const [eventName, validator] of pr4aValidators) {
  for (const [label, payload] of malformedPayloads) {
    test(`${eventName}: payload ${label} -> afgewezen, geen throw`, () => {
      assert.doesNotThrow(() => validator(payload));
      assert.deepEqual(validator(payload), { ok: false, code: null });
    });
  }
}

test('hasRequiredRole: host_or_player dekt zowel host als player, niet een lege rollenlijst', () => {
  assert.equal(hasRequiredRole(['host'], 'host_or_player'), true);
  assert.equal(hasRequiredRole(['player'], 'host_or_player'), true);
  assert.equal(hasRequiredRole([], 'host_or_player'), false);
});

test('hasRequiredRole: niet-array sessionRoles -> false, geen throw', () => {
  assert.doesNotThrow(() => hasRequiredRole(undefined, 'host'));
  assert.equal(hasRequiredRole(undefined, 'host'), false);
});
