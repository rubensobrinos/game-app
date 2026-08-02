// tests/integration/matrix-row-03-join-via-inviteid-hash-lookup.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 3 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra join-endpoint échte inviteId-lookup gebruikt
//     en een sessie/token retourneert, mag dit naar test.skip-code (DT3b)."
//   - Bewijs: server/composition/room-lifecycle.mjs
//       - `claimLocators()` (regels 247-276) berekent `inviteHash =
//         hashInviteId(inviteId, activePepper(context))` en claimt hem
//         atomisch via `store.claimRoomLocatorsAtomically`.
//       - `findRoomByInviteId()` (regels 330-340) zoekt de room op via
//         `context.store.loadRoomByInviteHash(hashInviteId(inviteId, pepper))`
//         — een échte hashindex-lookup op de poort (server/data/
//         in-memory-store.js#loadRoomByInviteHash), geen fixture-lijst.
//       - `locateRoom()` (regels 523-548) roept dat pad aan zodra `inviteId`
//         is meegegeven, ongeacht `joinSource` ("qr" of "shared_link").
//       - `joinRoom()` (regels 569- ) retourneert bij succes `sessionToken`
//         + `sessionId` (een échte sessie/token, PROTOCOL.md §143-167).
//     Dit was bij de vorige heraudit nog geblokkeerd ("Room heeft geen
//     inviteHash-veld, dus de hash heeft nu nog geen opslagplaats" — inmiddels
//     opgelost: `createRoom()` slaat `inviteHash` op het Room-document op en
//     de DM10-poortmigratie is voltooid; `room-lifecycle.mjs` roept nergens
//     meer de verwijderde `loadRoomByInviteId` aan).
//   - Datum van deze audit/activatie: 2026-08-02 (tweede heraudit,
//     DT-R1-heraudit-integratie).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, joinRoom } from '../../server/composition/room-lifecycle.mjs';
import { makeContext } from './support/composition-harness.mjs';

test('Join via inviteId (QR/deel-link), joinSource "qr" of "shared_link", levert geldige sessie op', async () => {
  const context = makeContext();
  const room = (await createRoom(context, { hostParticipates: true, displayName: 'Host' })).value;

  const viaQr = await joinRoom(context, {
    inviteId: room.inviteId,
    joinSource: 'qr',
    displayName: 'ViaQr',
  });
  assert.equal(viaQr.ok, true, JSON.stringify(viaQr));
  assert.equal(viaQr.value.roomId, room.roomId);
  assert.equal(typeof viaQr.value.sessionToken, 'string');
  assert.ok(viaQr.value.sessionToken.length > 0);
  assert.equal(typeof viaQr.value.sessionId, 'string');
  assert.equal(typeof viaQr.value.playerId, 'string');
  assert.equal(viaQr.value.effectiveName, 'ViaQr');

  const viaSharedLink = await joinRoom(context, {
    inviteId: room.inviteId,
    joinSource: 'shared_link',
    displayName: 'ViaLink',
  });
  assert.equal(viaSharedLink.ok, true, JSON.stringify(viaSharedLink));
  assert.notEqual(viaSharedLink.value.sessionId, viaQr.value.sessionId);

  // Geen fixture-lijst: een gestructureerd geldige, maar nooit geclaimde
  // inviteId hoort een échte lookup-miss te zijn, geen toevalstreffer.
  const unknownInviteId = 'x'.repeat(room.inviteId.length);
  const notFound = await joinRoom(context, { inviteId: unknownInviteId, joinSource: 'qr' });
  assert.equal(notFound.ok, false);
  assert.equal(notFound.code, 'GAME_NOT_FOUND');
});
