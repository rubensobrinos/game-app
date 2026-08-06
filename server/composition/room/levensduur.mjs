// server/composition/room/levensduur.mjs
//
// Hoe lang een room blijft leven, en of hij nog nieuwe spelers binnenlaat.
//
// `touchRoom` is de kern van dit bestand en de reden dat het apart staat: het
// is het ENIGE TTL-verlengpad van de hele applicatie. `server/data/ttl.js`
// verwijst er met zoveel woorden naar terug. Elke handeling die "activiteit"
// betekent — joinen, vertrekken, kicken, hernoemen, van kleur wisselen,
// instellingen wijzigen, vergrendelen, én elke fase-overgang in
// `match-lifecycle.mjs` — loopt hierlangs. Wie deze functie wijzigt, wijzigt
// of een room middenin een potje verdwijnt.

import { ROOM_TTL_SECONDS } from '../../data/ttl.js';
import { assertRoomShape } from '../../data/types/room.js';
import { CODES, fail, succeed } from './gedeeld.mjs';

/**
 * Schrijft `lastActivityAt` (en desgewenst andere velden) bij. Aparte functie
 * omdat het een read-modify-write over het HELE Room-document is: de poort
 * kent geen partiële update. Zie de handoff-notitie — tegen een echte,
 * gelijktijdige store kan dit een concurrent `phase`-update overschrijven.
 *
 * Dit is óók het TTL-refreshpad, en dus de plek waar `refreshRoomLocators`
 * hoort (INT-1 §4): zonder die aanroep verlopen `room:code:{code}` en
 * `room:invite:{inviteHash}` op hun oorspronkelijke claim-TTL, terwijl de room
 * zelf door de activiteit blijft leven — een levende room die niemand meer via
 * code of invite kan vinden.
 *
 * De refresh gaat alleen op als het Room-document zijn `inviteHash` draagt.
 * Rooms van vóór dat veld (of uit een fixture die de room buiten `createRoom`
 * om opbouwt) hebben hem niet; hem hier hergokken uit `inviteId` + de actieve
 * pepper zou na een rotatie de verkeerde sleutel verlengen en de echte laten
 * verlopen. Niets verlengen is dan het veilige alternatief.
 *
 * Een refresh die de poort weigert (RangeError: de locators zijn niet meer van
 * deze room) wordt NIET weggeslikt. Dat betekent dat de code of de invite
 * inmiddels naar een andere room wijst, en dan is doorgaan met joinen erger dan
 * falen.
 *
 * GEËXPORTEERD sinds fase 3 (agent 1, F1/F2): `match-lifecycle.mjs` had geen
 * enkel TTL-verlengpad tijdens het spelen — alleen lobby-acties in DIT bestand
 * riepen hem aan. Een room die druk speelt maar geen lobby-actie meer ziet
 * (join/leave/kick/lock/hernoemen/instellingen), verloor zo zijn code- en
 * invite-locator na vier uur, ook middenin een potje. `extraFields` laat een
 * aanroeper die toch al het hele document herschrijft (bv. `currentMatchId`
 * bij `startMatch`/`rematch`) dat in dezelfde write meenemen i.p.v. tweemaal
 * te schrijven.
 *
 * @param {import('../context.mjs').Context} context
 * @param {import('../../data/types/room.js').Room} room
 * @param {number} at
 * @param {Record<string, unknown>} [extraFields]
 */
export async function touchRoom(context, room, at, extraFields = {}) {
  const updated = { ...room, ...extraFields, lastActivityAt: at };
  assertRoomShape(updated);
  await context.store.saveRoom(updated);
  if (typeof room.inviteHash === 'string' && room.inviteHash.length > 0) {
    await context.store.refreshRoomLocators({
      roomId: room.id,
      code: room.code,
      inviteHash: room.inviteHash,
      ttlSeconds: ROOM_TTL_SECONDS,
    });
  }
  return updated;
}

/**
 * Vergrendelt of ontgrendelt de room (matrixrij 8). Nieuwe joins worden
 * daarna geweigerd met `ROOM_LOCKED`, resp. weer toegelaten.
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string, locked: boolean }} params
 */
export async function setRoomLocked(context, { roomId, locked } = {}) {
  if (typeof locked !== 'boolean') {
    throw new TypeError(`setRoomLocked: locked moet een boolean zijn, kreeg: ${typeof locked}`);
  }
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  const at = context.now();
  const updated = { ...room, locked, lastActivityAt: at };
  assertRoomShape(updated);
  // Via touchRoom, niet rechtstreeks saveRoom: vergrendelen is activiteit en
  // moet dus dezelfde TTL-verlenging krijgen als joinen en kicken, inclusief de
  // locator-refresh. `lastActivityAt` staat er al op; touchRoom zet dezelfde
  // waarde nog eens, wat niets verandert.
  await touchRoom(context, updated, at);
  return succeed({ roomId: room.id, locked });
}
