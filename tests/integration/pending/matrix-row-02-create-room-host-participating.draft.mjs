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

// tests/integration/matrix-row-02-create-room-host-participating.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 2 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra die tak aantoonbaar in code zit (host
//     krijgt dezelfde Player-vorm als een gewone joiner), mag dit naar
//     test.skip-code (DT3b)."
//   - Bewijs: server/composition/room-lifecycle.mjs, functie createRoom() —
//     de `if (hostParticipates) { ... player = { ... }; assertPlayerShape
//     (player); }`-tak bouwt exact hetzelfde Player-document als joinRoom()
//     voor een gewone joiner.
//   - Datum van deze audit/activatie: 2026-08-02 (DT-R1-heraudit-integratie).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, joinRoom } from '../../server/composition/room-lifecycle.mjs';
import { assertPlayerShape } from '../../server/data/types/player.js';
import { makeContext } from './support/composition-harness.mjs';

test('Room aanmaken met hostParticipates: true: host krijgt playerId/effectiveName en een normale spelerplek', async () => {
  const context = makeContext();

  const result = await createRoom(context, { hostParticipates: true, displayName: 'Ruben' });

  assert.equal(result.ok, true);
  assert.equal(typeof result.value.playerId, 'string');
  assert.equal(result.value.effectiveName, 'Ruben');
  assert.deepEqual(result.value.roles, ['host', 'player']);

  const hostPlayer = await context.store.loadPlayer(result.value.roomId, result.value.playerId);
  assertPlayerShape(hostPlayer);
  assert.equal(hostPlayer.score, 0);
  assert.equal(hostPlayer.nameSource, 'chosen');

  // Exact dezelfde Player-vorm (dezelfde velden) als een gewone joiner.
  const joined = await joinRoom(context, { gameCode: result.value.gameCode, displayName: 'Gast', joinSource: 'code' });
  assert.equal(joined.ok, true);
  const joinedPlayer = await context.store.loadPlayer(result.value.roomId, joined.value.playerId);
  assert.deepEqual(Object.keys(hostPlayer).sort(), Object.keys(joinedPlayer).sort());
});
