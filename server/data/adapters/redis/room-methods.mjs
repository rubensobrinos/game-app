import { CLAIM_LOCATORS_LUA, REFRESH_LOCATORS_LUA, RELEASE_LOCATORS_LUA, ROTATE_LOCATORS_LUA, assertPositiveInteger } from './scripts.mjs';
import { roomCodeLookupKey, roomCodeSeenKey, roomInviteLookupKey, roomKey, roomsActiveKey } from '../../redis-keys.js';

/**
 * Besluit 48: hoe lang de grafsteen leeft. Zeven dagen — lang genoeg dat "ik
 * speelde gisteren nog" klopt, kort genoeg dat het niets kost (één sleutel van
 * één byte per room). Losstaand van de room-TTL van vier uur; hij hoort de
 * room juist te overleven.
 */
const SEEN_TTL_SECONDS = 7 * 24 * 60 * 60;
import { assertRoomShape } from '../../types/room.js';

export function createRoomMethods(context) {
  const { client, codec, ttlSeconds, ttl, roomScopeKeys, sessionTokenIndexKeys, refreshTtl } = context;
  // ----------------------------------------------------------------------
  // Room
  // ----------------------------------------------------------------------

  /** @param {string} roomId */
  async function loadRoom(roomId) {
    return codec.decode('room', await client().get(roomKey(roomId)));
  }

  /** @param {import('../../types/room').Room} room */
  async function saveRoom(room) {
    // Vormcontrole op de SCHRIJFkant, zoals documents.mjs aankondigt: de codec
    // valideert bewust niet, "die controle hoort bij de poortmethode in
    // INTB2b". Alleen bij het schrijven, want een leescontrole zou een document
    // dat er al staat onleesbaar maken in plaats van het probleem bij de bron
    // te leggen.
    assertRoomShape(room);
    // GEEN LOOKUP-INDEXEN. `saveRoom` schrijft het roomdocument en `rooms:active`
    // en verder niets (BESLUIT-INTB-locators-en-sessieindex.md, deel A, akkoord).
    //
    // Vóór dat besluit zette deze methode `room:code:{code}` op `room.id`, en dat
    // was een tweede, ONGECONTROLEERDE weg naar dezelfde index als
    // `claimRoomLocatorsAtomically` — hij ging langs elke claimcontrole heen. Het
    // waarneembare gevolg: de lookup-index wijst naar B terwijl het claimregister
    // A als eigenaar kent, dus een speler die de code intypt komt in de verkeerde
    // room en een derde room krijgt een conflict op een code die van niemand meer
    // is. Voor de invite-kant bestond dat gat nooit, want een `Room` draagt het
    // platte `inviteId` en de index draait op de hash; nu geldt hetzelfde voor de
    // code-kant.
    //
    // Roomcreatie is daarmee expliciet TWEEFASIG: eerst claimen, dan opslaan. Een
    // `saveRoom` zonder voorafgaande geslaagde claim levert een room op die via
    // `loadRoomByCode` en `loadRoomByInviteHash` onvindbaar is. Dat is de
    // bedoeling; de compositielaag hoort die volgorde expliciet te maken.
    const tokenKeys = await sessionTokenIndexKeys(room.id);
    const chain = client().multi();
    chain.set(roomKey(room.id), codec.encode('room', room), { EX: ttlSeconds });
    chain.sAdd(roomsActiveKey(), room.id);
    refreshTtl(chain, room.id, tokenKeys);
    await chain.exec();
  }

  /** @param {string} code */
  async function loadRoomByCode(code) {
    const roomId = await client().get(roomCodeLookupKey(code));
    return roomId === null ? null : loadRoom(roomId);
  }

  /**
   * Besluit 48: leg vast dát deze code gebruikt is. Aparte sleutel met een
   * eigen, veel langere TTL — hij hoort de room te overleven, dat is het hele
   * punt. Niet in `claimRoomLocatorsAtomically` gezet: die is atomair via een
   * script, en een grafsteen die een milliseconde later komt is onschadelijk
   * terwijl een aanpassing aan dat script dat niet is.
   * @param {string} code
   */
  async function markCodeSeen(code) {
    await client().set(roomCodeSeenKey(code), '1', { EX: SEEN_TTL_SECONDS });
  }

  /** @param {string} code @returns {Promise<boolean>} */
  async function hasCodeBeenSeen(code) {
    return (await client().exists(roomCodeSeenKey(code))) === 1;
  }

  /** @param {string} inviteHash */
  async function loadRoomByInviteHash(inviteHash) {
    const roomId = await client().get(roomInviteLookupKey(inviteHash));
    return roomId === null ? null : loadRoom(roomId);
  }

  // ----------------------------------------------------------------------
  // Room-locators (DM10)
  // ----------------------------------------------------------------------

  /** @param {import('../../repository').RoomLocatorClaim} claim */
  async function claimRoomLocatorsAtomically({ roomId, code, inviteHash, ttlSeconds: claimTtl }) {
    assertPositiveInteger(claimTtl, 'RoomLocatorClaim.ttlSeconds');
    const outcome = await client().eval(CLAIM_LOCATORS_LUA, {
      keys: [roomCodeLookupKey(code), roomInviteLookupKey(inviteHash)],
      arguments: [roomId, String(claimTtl)],
    });
    if (outcome === 'ok') return { ok: true };
    if (outcome === 'code' || outcome === 'inviteHash') return { ok: false, conflict: outcome };
    throw new Error(`claimRoomLocatorsAtomically: onverwacht scriptresultaat ${JSON.stringify(outcome)}`);
  }

  /** @param {import('../../repository').RoomLocatorPair} pair */
  async function releaseRoomLocators({ roomId, code, inviteHash }) {
    await client().eval(RELEASE_LOCATORS_LUA, {
      keys: [roomCodeLookupKey(code), roomInviteLookupKey(inviteHash)],
      arguments: [roomId],
    });
  }

  /** @param {import('../../repository').RoomLocatorClaim} claim */
  async function refreshRoomLocators({ roomId, code, inviteHash, ttlSeconds: claimTtl }) {
    assertPositiveInteger(claimTtl, 'RoomLocatorClaim.ttlSeconds');
    const owned = await client().eval(REFRESH_LOCATORS_LUA, {
      keys: [
        roomCodeLookupKey(code),
        roomInviteLookupKey(inviteHash),
        ...roomScopeKeys(roomId),
        ...(await sessionTokenIndexKeys(roomId)),
      ],
      arguments: [roomId, String(claimTtl), ttl],
    });
    if (owned !== 1) {
      throw new RangeError(
        `refreshRoomLocators: roomId ${JSON.stringify(roomId)} bezit niet (meer) beide locators — ` +
          'een refresh op een claim die je niet bezit is een programmeerfout of een teken dat de claim al gestolen is.'
      );
    }
  }

  /** @param {import('../../repository').RoomLocatorRotation} rotation */
  async function rotateRoomLocators({ roomId, oldCode, oldInviteHash, newCode, newInviteHash, ttlSeconds: rotationTtl }) {
    assertPositiveInteger(rotationTtl, 'RoomLocatorRotation.ttlSeconds');
    const outcome = await client().eval(ROTATE_LOCATORS_LUA, {
      keys: [
        roomCodeLookupKey(oldCode),
        roomInviteLookupKey(oldInviteHash),
        roomCodeLookupKey(newCode),
        roomInviteLookupKey(newInviteHash),
      ],
      arguments: [roomId, String(rotationTtl)],
    });
    if (outcome === 'ok') return { ok: true };
    if (outcome === 'code' || outcome === 'inviteHash') return { ok: false, conflict: outcome };
    if (outcome === 'not-owner-code') {
      throw new RangeError(
        `rotateRoomLocators: roomId ${JSON.stringify(roomId)} bezit oldCode ${JSON.stringify(oldCode)} niet (meer)`
      );
    }
    if (outcome === 'not-owner-inviteHash') {
      throw new RangeError(
        `rotateRoomLocators: roomId ${JSON.stringify(roomId)} bezit oldInviteHash ${JSON.stringify(oldInviteHash)} niet (meer)`
      );
    }
    throw new Error(`rotateRoomLocators: onverwacht scriptresultaat ${JSON.stringify(outcome)}`);
  }


  return { loadRoom, saveRoom, loadRoomByCode, loadRoomByInviteHash, claimRoomLocatorsAtomically, releaseRoomLocators, refreshRoomLocators, rotateRoomLocators, markCodeSeen, hasCodeBeenSeen, };
}

