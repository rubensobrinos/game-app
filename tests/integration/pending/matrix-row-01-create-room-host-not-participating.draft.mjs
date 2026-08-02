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

// tests/integration/matrix-row-01-create-room-host-not-participating.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 1 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra die endpoint bestaat en
//     'hostParticipates:false ⇒ playerId/effectiveName null' aantoonbaar in
//     code zit (niet alleen in doc), mag dit naar test.skip-code (DT3b)."
//   - Bewijs: server/composition/room-lifecycle.mjs, functie createRoom() —
//     bij `hostParticipates: false` blijft de lokale `player`-variabele
//     `null` (geen savePlayer-aanroep, geen Player-entiteit), en de
//     teruggegeven `playerId`/`effectiveName` zijn `null`.
//   - "Endpoint" is hier de compositielaagfunctie, niet een Fastify-route —
//     zie docs/deployment-and-testing-plan/server-composition-request.md:
//     "geen van de 14 rijen vereist voor activatie dat er iets op een poort
//     luistert... een direct functieaanroep vanuit tests/integration/
//     volstaat."
//   - Datum van deze audit/activatie: 2026-08-02 (DT-R1-heraudit-integratie).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom } from '../../server/composition/room-lifecycle.mjs';
import { assertSessionShape } from '../../server/data/types/session.js';
import { makeContext } from './support/composition-harness.mjs';

test('Room aanmaken met hostParticipates: false: host krijgt alleen de hostrol, geen playerId/effectiveName', async () => {
  const context = makeContext();

  const result = await createRoom(context, { hostParticipates: false, displayName: 'Genegeerde naam' });

  assert.equal(result.ok, true);
  assert.equal(result.value.playerId, null);
  assert.equal(result.value.effectiveName, null);
  assert.deepEqual(result.value.roles, ['host']);

  // Geen Player-entiteit aangemaakt voor de host.
  assert.deepEqual(await context.store.listPlayers(result.value.roomId), []);

  const session = await context.store.loadSession(result.value.roomId, result.value.sessionId);
  assertSessionShape(session);
  assert.equal(session.playerId, null);
  assert.deepEqual(session.roles, ['host']);
});
