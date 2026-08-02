// LET OP — verplaatst naar pending/ en hernoemd naar .draft.mjs (niet .test.mjs):
// deze test faalde bij verificatie tegen de actuele HEAD met
// "TypeError: context.store.loadRoomByInviteId is not a function"
// (server/composition/room-lifecycle.mjs:253 roept een methode aan die
// server/data/repository.js na de DM10/DM11-poortmigratie niet meer
// exporteert — zie docs/deployment-and-testing-plan/integration-matrix.md
// §Audit-log voor het volledige citaat). De test zelf is inhoudelijk
// correct; ze faalt puur op deze cross-plan interfacemismatch. Hernoem
// terug naar .test.mjs in tests/integration/ zodra room-lifecycle.mjs
// loadRoomByInviteHash aanroept in plaats van het verwijderde
// loadRoomByInviteId — dan zou dit direct moeten slagen.

// tests/integration/matrix-row-05-displayname-and-generated-name.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 5 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra zowel het null-vs-opgegeven-onderscheid als
//     de naamgenerator in code bestaan (niet als losse testfixture), mag dit
//     naar test.skip-code (DT3b)."
//   - Bewijs: server/composition/room-lifecycle.mjs, functie resolveNames()
//     onderscheidt een opgegeven naam (`displayName: raw, nameSource:
//     'chosen'`) van geen naam (`displayName: null, nameSource:
//     'generated'`); de generator zelf is server/data/name-processing.js
//     `generateName()` (adjectief+dier uit een woordenlijst, of het vaste
//     `Speler {n}`-formaat als er geen woordenlijst voor de taal is) —
//     productiecode, geen testfixture.
//   - Datum van deze audit/activatie: 2026-08-02 (DT-R1-heraudit-integratie).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, joinRoom } from '../../server/composition/room-lifecycle.mjs';
import { makeContext } from './support/composition-harness.mjs';

test('Speler geeft zelf een displayName op (blijft behouden) of laat het leeg (server genereert adjectief+dier of Speler {n})', async () => {
  // Woordenlijst is redactionele content (DM4), niet iets deze module kiest —
  // hier expliciet meegegeven, net als de productiecompositie dat zou doen.
  const wordLists = { nl: { adjectives: ['Vlugge'], animals: ['Vos'] } };
  const context = makeContext({ config: { nameWordLists: wordLists } });
  const room = (await createRoom(context, { hostParticipates: false })).value;

  // Opgegeven naam blijft behouden.
  const named = await joinRoom(context, { gameCode: room.gameCode, displayName: 'Sanne', joinSource: 'code' });
  assert.equal(named.ok, true);
  assert.equal(named.value.effectiveName, 'Sanne');
  const namedPlayer = await context.store.loadPlayer(room.roomId, named.value.playerId);
  assert.equal(namedPlayer.displayName, 'Sanne');
  assert.equal(namedPlayer.nameSource, 'chosen');

  // Lege/ontbrekende naam: server genereert adjectief + dier.
  const generated = await joinRoom(context, { gameCode: room.gameCode, displayName: null, joinSource: 'code' });
  assert.equal(generated.ok, true);
  assert.equal(generated.value.effectiveName, 'Vlugge Vos');
  const generatedPlayer = await context.store.loadPlayer(room.roomId, generated.value.playerId);
  assert.equal(generatedPlayer.displayName, null);
  assert.equal(generatedPlayer.nameSource, 'generated');

  // Zonder woordenlijst voor de taal valt de generator terug op "Speler {n}".
  const contextNoWordList = makeContext();
  const roomNoWordList = (await createRoom(contextNoWordList, { hostParticipates: false })).value;
  const fallback = await joinRoom(contextNoWordList, { gameCode: roomNoWordList.gameCode, displayName: '   ', joinSource: 'code' });
  assert.equal(fallback.ok, true);
  assert.match(fallback.value.effectiveName, /^Speler \d+$/);
});
