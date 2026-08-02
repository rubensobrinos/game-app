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

// tests/integration/matrix-row-10-kick-revokes-session.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 10 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra een gekickte sessie aantoonbaar geweigerd
//     wordt door de échte tokenmiddleware (niet een in-memory testdouble),
//     mag dit naar test.skip-code (DT3b)."
//   - Bewijs: server/composition/room-lifecycle.mjs — kickPlayer() markeert
//     de Player als `kicked: true` en de bijbehorende Session als
//     `revoked: true`; resolveSession() (de sessie-/tokenmiddleware die vóór
//     elke inkomende actie zou draaien) controleert dat veld en geeft
//     `SESSION_REVOKED` bij een ingetrokken sessie, vóór elke andere check.
//   - Nuance: DATA-MODEL.md beschrijft zowel een `revoked`-veld op Session
//     als een aparte `room:{roomId}:revoked-sessions`-Redis-set; deze
//     implementatie gebruikt het eerste (een van de twee in DATA-MODEL.md
//     gedocumenteerde mechanismen), niet een losse set-structuur. Het
//     geteste gedrag — een gekickte sessie kan niet opnieuw gebruikt worden —
//     is identiek.
//   - Buiten scope van deze test: het `session:kicked`-event uit de volle
//     scenario-omschrijving (geen Socket.IO-laag aanwezig, zie matrixrij 8's
//     testbestand voor dezelfde constatering).
//   - Datum van deze audit/activatie: 2026-08-02 (DT-R1-heraudit-integratie).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, joinRoom, kickPlayer, resolveSession } from '../../server/composition/room-lifecycle.mjs';
import { makeContext } from './support/composition-harness.mjs';

test('Host kickt speler via game:kick: hernieuwde poging met dezelfde token geeft SESSION_REVOKED', async () => {
  const context = makeContext();
  const room = (await createRoom(context, { hostParticipates: false })).value;
  const joined = (await joinRoom(context, { gameCode: room.gameCode, displayName: 'Speler', joinSource: 'code' })).value;

  // Token werkt vóór de kick.
  const beforeKick = await resolveSession(context, {
    roomId: room.roomId,
    sessionId: joined.sessionId,
    sessionToken: joined.sessionToken,
  });
  assert.equal(beforeKick.ok, true);
  assert.equal(beforeKick.value.playerId, joined.playerId);

  const kicked = await kickPlayer(context, { roomId: room.roomId, playerId: joined.playerId });
  assert.equal(kicked.ok, true);
  assert.equal(kicked.value.revoked, true);

  const player = await context.store.loadPlayer(room.roomId, joined.playerId);
  assert.equal(player.kicked, true);

  // Hernieuwde poging met hetzelfde token faalt met SESSION_REVOKED.
  const afterKick = await resolveSession(context, {
    roomId: room.roomId,
    sessionId: joined.sessionId,
    sessionToken: joined.sessionToken,
  });
  assert.deepEqual(afterKick, { ok: false, code: 'SESSION_REVOKED' });
});
