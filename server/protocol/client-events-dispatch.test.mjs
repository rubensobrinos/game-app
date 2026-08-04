import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePlayerRenamePayload,
  validatePlayerLeavePayload,
  validateRoundAnswerEnvelope,
  validateShareOpenedPayload,
  resolveEventValidator,
  ALL_CLIENT_EVENT_NAMES,
  hasRequiredRole,
} from './client-events-dispatch.mjs';

// Rij 16 — player:rename, { displayName: "Ruben" } als player: ok.
test('validatePlayerRenamePayload: geldige displayName -> ok', () => {
  assert.deepEqual(validatePlayerRenamePayload({ displayName: 'Ruben' }), { ok: true });
});

// Rij 17 — player:rename, {} en { displayName: 42 }: beide afgewezen.
test('validatePlayerRenamePayload: {} -> afgewezen (displayName ontbreekt)', () => {
  assert.deepEqual(validatePlayerRenamePayload({}), { ok: false, code: null });
});

test('validatePlayerRenamePayload: { displayName: 42 } -> afgewezen (verkeerd type)', () => {
  assert.deepEqual(validatePlayerRenamePayload({ displayName: 42 }), { ok: false, code: null });
});

// Rij 18 — player:leave, {} als player: ok.
test('validatePlayerLeavePayload: leeg object -> ok', () => {
  assert.deepEqual(validatePlayerLeavePayload({}), { ok: true });
});

test('validatePlayerLeavePayload: extra sleutel -> afgewezen', () => {
  assert.deepEqual(validatePlayerLeavePayload({ extra: 1 }), { ok: false, code: null });
});

// Rij 19 — round:answer-envelope, geldige optionId-vorm: ok (envelopeniveau;
// answer-inhoud zelf niet verder getoetst, zie PR4d).
test('validateRoundAnswerEnvelope: geldige envelope -> ok', () => {
  assert.deepEqual(
    validateRoundAnswerEnvelope({
      roundId: 'round_07',
      answer: { optionId: 'opt_2' },
      clientAnsweredAt: 1785623418451,
    }),
    { ok: true },
  );
});

// Rij 20 — envelope zonder roundId, met answer: null, met answer: [], met
// clientAnsweredAt: "gisteren": stuk voor stuk afgewezen.
test('validateRoundAnswerEnvelope: roundId ontbreekt -> afgewezen', () => {
  assert.deepEqual(
    validateRoundAnswerEnvelope({ answer: { optionId: 'opt_2' }, clientAnsweredAt: 1 }),
    { ok: false, code: null },
  );
});

test('validateRoundAnswerEnvelope: answer: null -> afgewezen', () => {
  assert.deepEqual(
    validateRoundAnswerEnvelope({ roundId: 'round_07', answer: null, clientAnsweredAt: 1 }),
    { ok: false, code: null },
  );
});

test('validateRoundAnswerEnvelope: answer: [] -> afgewezen (array, geen object)', () => {
  assert.deepEqual(
    validateRoundAnswerEnvelope({ roundId: 'round_07', answer: [], clientAnsweredAt: 1 }),
    { ok: false, code: null },
  );
});

test('validateRoundAnswerEnvelope: clientAnsweredAt: "gisteren" -> afgewezen', () => {
  assert.deepEqual(
    validateRoundAnswerEnvelope({
      roundId: 'round_07',
      answer: { optionId: 'opt_2' },
      clientAnsweredAt: 'gisteren',
    }),
    { ok: false, code: null },
  );
});

// Rij 21 — share:opened, alle vier toegestane method-waarden (PR11 §3,
// DECISIONS.md punt 18 breidt de drie gedocumenteerde waarden uit met
// "code"), voor host en player: alle ok.
for (const method of ['qr', 'link', 'native', 'code']) {
  test(`validateShareOpenedPayload: method "${method}" -> ok`, () => {
    assert.deepEqual(validateShareOpenedPayload({ method }), { ok: true });
  });
}

test('share:opened vereist rol host_or_player: zowel host als player voldoen', () => {
  const result = resolveEventValidator('share:opened');
  assert.equal(result.ok, true);
  assert.equal(result.entry.requiredRole, 'host_or_player');
  assert.equal(hasRequiredRole(['host'], result.entry.requiredRole), true);
  assert.equal(hasRequiredRole(['player'], result.entry.requiredRole), true);
});

// Rij 22 (herzien door PR11 §3) — share:opened, { method: "qrcode" }: een
// vijfde, niet-gedocumenteerde waarde blijft afgewezen.
test('validateShareOpenedPayload: method "qrcode" (onbekende vijfde waarde) -> afgewezen', () => {
  assert.deepEqual(validateShareOpenedPayload({ method: 'qrcode' }), { ok: false, code: null });
});

// Rij 23 — resolveEventValidator("game:start") ... ("share:opened"): elk van
// de 12 levert { ok: true, entry }.
test('ALL_CLIENT_EVENT_NAMES bevat exact de 14 gedocumenteerde eventnamen', () => {
  // 14 sinds besluit 40 + feedbackronde 4 aug: +player:recolor,
  // +game:update-config.
  assert.deepEqual(
    [...ALL_CLIENT_EVENT_NAMES].sort(),
    [
      'game:finish', 'game:kick', 'game:lock', 'game:next', 'game:pause',
      'game:rematch', 'game:resume', 'game:start', 'game:update-config',
      'player:leave', 'player:recolor', 'player:rename', 'round:answer',
      'share:opened',
    ].sort(),
  );
  assert.equal(ALL_CLIENT_EVENT_NAMES.length, 14);
});

for (const eventName of ALL_CLIENT_EVENT_NAMES) {
  test(`resolveEventValidator("${eventName}") -> { ok: true, entry }`, () => {
    const result = resolveEventValidator(eventName);
    assert.equal(result.ok, true);
    assert.equal(typeof result.entry.validate, 'function');
    assert.ok(['host', 'player', 'host_or_player'].includes(result.entry.requiredRole));
  });
}

// Rij 24 — resolveEventValidator("room:teleport") (willekeurige onbekende
// string): { ok: false, code: "UNSUPPORTED_EVENT" }.
test('resolveEventValidator: onbekende eventnaam -> UNSUPPORTED_EVENT', () => {
  assert.deepEqual(resolveEventValidator('room:teleport'), {
    ok: false,
    code: 'UNSUPPORTED_EVENT',
  });
});

test('resolveEventValidator: lege string en willekeurige andere onbekende namen -> UNSUPPORTED_EVENT, geen throw', () => {
  for (const unknownName of ['', 'game:START', 'round:progress', 'admin:shutdown']) {
    assert.doesNotThrow(() => resolveEventValidator(unknownName));
    assert.deepEqual(resolveEventValidator(unknownName), { ok: false, code: 'UNSUPPORTED_EVENT' });
  }
});
