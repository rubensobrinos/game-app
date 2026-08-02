// tests/integration/matrix-row-08-room-lock-blocks-and-allows-join.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 8 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra de lock-toggle joins aantoonbaar
//     blokkeert/toelaat in de échte join-implementatie, mag dit naar
//     test.skip-code (DT3b)."
//   - Bewijs: server/composition/room-lifecycle.mjs — setRoomLocked()
//     persisteert `Room.locked`; joinRoom() leest dat veld terug
//     (`if (room.locked === true) return fail(CODES.ROOM_LOCKED)`) en
//     weigert/staat joins daadwerkelijk toe.
//   - Buiten scope van deze test: het `room:lock-changed`-event uit de volle
//     scenario-omschrijving. Er bestaat nog geen Socket.IO-laag (server/
//     index.mjs is nog het node:http-placeholderproces; geen enkel bestand
//     in server/ importeert 'socket.io') — de broadcast zelf is dus niet
//     aantoonbaar en wordt hier niet beweerd getest te zijn. De rij se
//     Prerequisite-kolom vereist alleen het persisteren + het respecteren
//     door join, niet de broadcast; dát is wat deze test bewijst.
//   - Datum van deze audit/activatie: 2026-08-02 (DT-R1-heraudit-integratie).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, joinRoom, setRoomLocked } from '../../server/composition/room-lifecycle.mjs';
import { makeContext } from './support/composition-harness.mjs';

test('Host vergrendelt/ontgrendelt room via game:lock; nieuwe joins worden geweigerd resp. weer toegelaten', async () => {
  const context = makeContext();
  const room = (await createRoom(context, { hostParticipates: true, displayName: 'Host' })).value;

  const locked = await setRoomLocked(context, { roomId: room.roomId, locked: true });
  assert.deepEqual(locked, { ok: true, value: { roomId: room.roomId, locked: true } });
  assert.equal((await context.store.loadRoom(room.roomId)).locked, true);

  const blockedJoin = await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code' });
  assert.deepEqual(blockedJoin, { ok: false, code: 'ROOM_LOCKED' });

  const unlocked = await setRoomLocked(context, { roomId: room.roomId, locked: false });
  assert.deepEqual(unlocked, { ok: true, value: { roomId: room.roomId, locked: false } });

  const allowedJoin = await joinRoom(context, { gameCode: room.gameCode, displayName: 'Speler', joinSource: 'code' });
  assert.equal(allowedJoin.ok, true);
  assert.equal(allowedJoin.value.roomId, room.roomId);
});
