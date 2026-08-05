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
  validateGameUpdateConfigPayload,
  validatePlayerRecolorPayload,
  PLAYER_COLORS,
  SELECTABLE_GAME_TYPES,
} from './client-events-dispatch.mjs';
import { PLAYABLE_GAME_TYPES } from '../../shared/content/game-catalog.mjs';

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
test('ALL_CLIENT_EVENT_NAMES bevat exact de 15 gedocumenteerde eventnamen', () => {
  // 14 sinds besluit 40 + feedbackronde 4 aug: +player:recolor,
  // +game:update-config. 15 sinds besluit C, 5 aug: +game:reveal.
  assert.deepEqual(
    [...ALL_CLIENT_EVENT_NAMES].sort(),
    [
      'game:finish', 'game:kick', 'game:lock', 'game:next', 'game:pause',
      'game:rematch', 'game:resume', 'game:reveal', 'game:start', 'game:update-config',
      'player:leave', 'player:recolor', 'player:rename', 'round:answer',
      'share:opened',
    ].sort(),
  );
  assert.equal(ALL_CLIENT_EVENT_NAMES.length, 15);
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

// ─────────────────────────────────────────────────────────────────────────────
// §A0 — `gameTypes` in game:update-config. De speelbare verzameling komt uit
// `shared/content/game-catalog.mjs`; deze laag heeft er bewust geen eigen
// kopie meer van (die liep uiteen met de carrousel en de contentbron).
// ─────────────────────────────────────────────────────────────────────────────

test('§A0: SELECTABLE_GAME_TYPES is letterlijk de gedeelde catalogus, geen eigen transcriptie', () => {
  assert.equal(SELECTABLE_GAME_TYPES, PLAYABLE_GAME_TYPES);
});

// Besluit C — `autoReveal` is bijstelbaar en strikt boolean.
test('validateGameUpdateConfigPayload: autoReveal true/false -> ok', () => {
  assert.deepEqual(validateGameUpdateConfigPayload({ autoReveal: false }), { ok: true });
  assert.deepEqual(validateGameUpdateConfigPayload({ autoReveal: true }), { ok: true });
});

test('validateGameUpdateConfigPayload: autoReveal met een niet-boolean -> afgewezen', () => {
  for (const value of ['false', 0, 1, null, {}]) {
    assert.deepEqual(
      validateGameUpdateConfigPayload({ autoReveal: value }),
      { ok: false, code: null },
      `${JSON.stringify(value)} hoort geweigerd te worden`,
    );
  }
});

test('§A0: een speelbare gameType wordt geaccepteerd', () => {
  for (const gameType of PLAYABLE_GAME_TYPES) {
    assert.deepEqual(validateGameUpdateConfigPayload({ gameTypes: [gameType] }), { ok: true });
  }
});

test('§A0: een gameType die de contentbron niet kan bouwen wordt geweigerd', () => {
  // Bestaande Golf-1-typen, maar (nog) niet speelbaar: de client mag ze niet
  // kunnen kiezen zolang de keten niet af is.
  for (const gameType of ['capitals_mc', 'odd_one_out', 'higher_lower', 'real_or_fake_flag']) {
    if (PLAYABLE_GAME_TYPES.includes(gameType)) continue;
    assert.deepEqual(
      validateGameUpdateConfigPayload({ gameTypes: [gameType] }),
      { ok: false, code: null },
      `${gameType} is niet speelbaar en hoort geweigerd te worden`,
    );
  }
});

test('§A0: onzin in gameTypes wordt geweigerd (geen array, leeg, verkeerd type)', () => {
  for (const value of [[], 'flags_mc', null, 42, [null], [['flags_mc']], ['flags_mc', 'onzin']]) {
    assert.deepEqual(
      validateGameUpdateConfigPayload({ gameTypes: value }),
      { ok: false, code: null },
      `${JSON.stringify(value)} hoort geweigerd te worden`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// §A1 — exact één gameType. De compositie gebruikt alleen `gameTypes[0]`; een
// langere lijst zou stilzwijgend gehalveerd worden en als mixed games lezen.
// ─────────────────────────────────────────────────────────────────────────────

test('§A1: twee gameTypes worden geweigerd, ook als beide op zichzelf geldig zouden zijn', () => {
  const playable = PLAYABLE_GAME_TYPES[0];
  assert.deepEqual(
    validateGameUpdateConfigPayload({ gameTypes: [playable, 'capitals_mc'] }),
    { ok: false, code: null },
  );
});

test('§A1: een duplicaat is óók meer dan één waarde en wordt geweigerd', () => {
  const playable = PLAYABLE_GAME_TYPES[0];
  assert.deepEqual(
    validateGameUpdateConfigPayload({ gameTypes: [playable, playable] }),
    { ok: false, code: null },
  );
});

test('§A1: precies één speelbare waarde blijft de enige geaccepteerde vorm', () => {
  assert.deepEqual(validateGameUpdateConfigPayload({ gameTypes: [PLAYABLE_GAME_TYPES[0]] }), { ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// besluit 42 — het palet gaat van acht naar zestien. Gesloten blijft gesloten.
// ─────────────────────────────────────────────────────────────────────────────

test('besluit 42: het palet telt zestien kleuren', () => {
  assert.equal(PLAYER_COLORS.length, 16);
  assert.equal(new Set(PLAYER_COLORS).size, 16, 'geen dubbele namen');
});

test('besluit 42: de bestaande acht staan onveranderd vooraan, in dezelfde volgorde', () => {
  // Er kunnen rooms in Redis leven met een speler die `purple` heeft, en de
  // round-robin bij join loopt over deze volgorde: aanvullen mag, herschikken
  // niet.
  assert.deepEqual(
    PLAYER_COLORS.slice(0, 8),
    ['orange', 'magenta', 'cyan', 'green', 'yellow', 'purple', 'lime', 'red'],
  );
});

test('besluit 42: elk van de zestien wordt geaccepteerd door player:recolor', () => {
  for (const color of PLAYER_COLORS) {
    assert.deepEqual(validatePlayerRecolorPayload({ color }), { ok: true }, color);
  }
});

test('besluit 42: een zeventiende waarde blijft een vormfout (INVALID_ANSWER_FORMAT op de wire)', () => {
  // `code: null` is precies wat de transportlaag als INVALID_ANSWER_FORMAT
  // doorgeeft — er is bewust geen aparte kleurfoutcode.
  for (const color of ['turquoise', 'blue2', 'ORANGE', '#ff8a3e', '', null, 9]) {
    assert.deepEqual(validatePlayerRecolorPayload({ color }), { ok: false, code: null }, String(color));
  }
});

test('besluit 42: het uitgebreide palet maakt de vorm van de payload niet losser', () => {
  assert.deepEqual(validatePlayerRecolorPayload({ color: 'teal', extra: 1 }), { ok: false, code: null });
  assert.deepEqual(validatePlayerRecolorPayload({}), { ok: false, code: null });
  assert.deepEqual(validatePlayerRecolorPayload('teal'), { ok: false, code: null });
});
