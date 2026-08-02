import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecipientRule, ALL_SERVER_EVENT_NAMES } from './server-events-recipients.mjs';

// Rij 1
test('resolveRecipientRule("room:state") → "single_session"', () => {
  assert.equal(resolveRecipientRule('room:state'), 'single_session');
});

// Rij 2 — drie losse gevallen, elk "room"
const roomRecipientEvents = ['room:player-changed', 'room:lock-changed', 'game:started'];
for (const eventName of roomRecipientEvents) {
  test(`resolveRecipientRule(${JSON.stringify(eventName)}) → "room"`, () => {
    assert.equal(resolveRecipientRule(eventName), 'room');
  });
}

// Rij 3
test('resolveRecipientRule("room:teleport") (onbekend) → null', () => {
  assert.equal(resolveRecipientRule('room:teleport'), null);
});

// Cross-cutting: "ontvangersregel-tests" voor de resterende sub-batches
// (PR5b/PR5c/PR5d), zoals de fasering in ../README.md per sub-batch vraagt,
// ook al staan deze niet als aparte rijen in de "Verplichte testgevallen"-
// tabel van PR5-server-events.md (die tabel focust op de payloadvalidators).

// PR5b — "Ontvangers: round:answer-accepted → single_session; de overige
// drie → room."
test('resolveRecipientRule("round:answer-accepted") → "single_session"', () => {
  assert.equal(resolveRecipientRule('round:answer-accepted'), 'single_session');
});
for (const eventName of ['game:paused', 'game:resumed', 'round:started']) {
  test(`resolveRecipientRule(${JSON.stringify(eventName)}) → "room" (PR5b)`, () => {
    assert.equal(resolveRecipientRule(eventName), 'room');
  });
}

// PR5c — letterlijke brontabel: round:progress → room; de overige drie →
// room_with_personal_fields (zie de uitgebreide toelichting in
// server-events-recipients.mjs over de afwijkende PR5c-prozazin).
test('resolveRecipientRule("round:progress") → "room" (letterlijke brontabel)', () => {
  assert.equal(resolveRecipientRule('round:progress'), 'room');
});
for (const eventName of ['round:ended', 'scoreboard:updated', 'game:finished']) {
  test(`resolveRecipientRule(${JSON.stringify(eventName)}) → "room_with_personal_fields"`, () => {
    assert.equal(resolveRecipientRule(eventName), 'room_with_personal_fields');
  });
}

// PR5d — "game:rematch-started → room; session:kicked en session:revoked →
// single_session; error → single_session."
test('resolveRecipientRule("game:rematch-started") → "room"', () => {
  assert.equal(resolveRecipientRule('game:rematch-started'), 'room');
});
for (const eventName of ['session:kicked', 'session:revoked', 'error']) {
  test(`resolveRecipientRule(${JSON.stringify(eventName)}) → "single_session"`, () => {
    assert.equal(resolveRecipientRule(eventName), 'single_session');
  });
}

test('alle 16 bekende events hebben een niet-null ontvangersregel', () => {
  assert.equal(ALL_SERVER_EVENT_NAMES.length, 16);
  for (const eventName of ALL_SERVER_EVENT_NAMES) {
    assert.notEqual(resolveRecipientRule(eventName), null);
  }
});
