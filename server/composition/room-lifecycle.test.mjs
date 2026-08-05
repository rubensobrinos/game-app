// Keten-tests voor de room-/sessiecompositie.
//
// Dekking van docs/deployment-and-testing-plan/integration-matrix.md: de
// testnamen beginnen met "matrixrij N" voor de rijen 1, 2, 3, 4, 5, 6, 8, 10
// en 11. De overige tests dekken randgevallen die de rijen onderbouwen.
//
// GEEN ENKELE TEST HANGT VAN DE ECHTE KLOK AF: `now` is een vaste,
// geïnjecteerde functie en elke tijdstempel wordt daartegen gecontroleerd.

import test from 'node:test';
import assert from 'node:assert/strict';

import { hashInviteId } from '../architecture/room-codes.js';
import { createInMemoryStore } from '../data/in-memory-store.js';
import { ROOM_TTL_SECONDS } from '../data/ttl.js';
import { assertPlayerShape } from '../data/types/player.js';
import { assertSessionShape } from '../data/types/session.js';
import { createContext } from './context.mjs';
import {
  buildJoinUrl,
  claimLocators,
  createRoom,
  getShareInfo,
  joinRoom,
  kickPlayer,
  previewInvite,
  QUICK_START_CONFIG,
  resolveGameConfiguration,
  resolveSession,
  setRoomLocked,
} from './room-lifecycle.mjs';
import { PLAYABLE_GAME_TYPES } from '../../shared/content/game-catalog.mjs';

const FIXED_NOW = 1_754_136_000_000;
const PEPPER = 'test-pepper-met-ruim-genoeg-bytes';
/** De opvolger bij een rotatie — zie de pepperrotatietest onderaan. */
const PEPPER_V2 = 'tweede-test-pepper-met-ruim-genoeg-bytes';
/** Besluit 26: versieerbare peppers — één actieve versie, alle geldige in de map. */
const TOKEN_PEPPERS = { version: 'v1', peppers: { v1: PEPPER } };
const APP_URL = 'https://play.aseso.nl';

/** Telt schrijfacties op de poort, zonder het gedrag te wijzigen. */
function countingStore(inner = createInMemoryStore()) {
  const counts = { saveRoom: 0, saveSession: 0, savePlayer: 0 };
  return {
    counts,
    store: {
      ...inner,
      async saveRoom(room) {
        counts.saveRoom += 1;
        return inner.saveRoom(room);
      },
      async saveSession(session) {
        counts.saveSession += 1;
        return inner.saveSession(session);
      },
      async savePlayer(player) {
        counts.savePlayer += 1;
        return inner.savePlayer(player);
      },
    },
  };
}

function makeContext({ store = createInMemoryStore(), now = () => FIXED_NOW, config = {} } = {}) {
  return createContext({
    store,
    now,
    config: { tokenPeppers: TOKEN_PEPPERS, publicAppUrl: APP_URL, ...config },
  });
}

/** Host + room, met de quick-start default (besluit 35). */
async function makeRoom(context, overrides = {}) {
  const result = await createRoom(context, { hostParticipates: true, displayName: 'Host', ...overrides });
  assert.equal(result.ok, true);
  return result.value;
}

// ─── Matrixrij 1 & 2 — roomcreatie ──────────────────────────────────────────

test('matrixrij 1: hostParticipates=false geeft de host alleen de hostrol, geen playerId/effectiveName', async () => {
  const { store, counts } = countingStore();
  const context = makeContext({ store });

  const { value } = await createRoom(context, { hostParticipates: false, displayName: 'Genegeerd' });

  assert.equal(value.playerId, null);
  assert.equal(value.effectiveName, null);
  assert.deepEqual(value.roles, ['host']);
  // Geen Player-entiteit aangemaakt.
  assert.equal(counts.savePlayer, 0);
  assert.deepEqual(await store.listPlayers(value.roomId), []);

  const session = await store.loadSession(value.roomId, value.sessionId);
  assertSessionShape(session);
  assert.equal(session.playerId, null);
  assert.deepEqual(session.roles, ['host']);
});

test('matrixrij 2: hostParticipates=true geeft de host een normale spelerplek', async () => {
  const context = makeContext();
  const room = await makeRoom(context, { displayName: 'Ruben' });

  assert.equal(typeof room.playerId, 'string');
  assert.equal(room.effectiveName, 'Ruben');
  assert.deepEqual(room.roles, ['host', 'player']);

  const player = await context.store.loadPlayer(room.roomId, room.playerId);
  // Exact dezelfde Player-vorm als een gewone joiner — het vangnet keurt hem.
  assertPlayerShape(player);
  assert.equal(player.score, 0);
  assert.equal(player.eligibleFromRound, 1);
  assert.equal(player.joinedAt, FIXED_NOW);
  assert.equal(player.sessionId, room.sessionId);
});

test('roomcreatie schrijft een geldig Room-document met de quick-start default (besluit 35)', async () => {
  const context = makeContext();
  const room = await makeRoom(context);
  const stored = await context.store.loadRoom(room.roomId);

  assert.equal(stored.phase, 'LOBBY');
  assert.equal(stored.locked, false);
  assert.equal(stored.currentMatchId, null);
  assert.equal(stored.createdAt, FIXED_NOW);
  assert.equal(stored.lastActivityAt, FIXED_NOW);
  assert.deepEqual(stored.hostSessionIds, [room.sessionId]);
  assert.deepEqual(stored.config.gameTypes, ['flags_mc']);
  assert.equal(stored.config.totalRounds, 10);
  assert.equal(stored.config.pacing, 'auto');
  assert.equal(stored.config.speedBonus, true);
  assert.equal(stored.config.allowLateJoin, true);
  assert.equal(stored.config.mode, 'individual');
  assert.match(stored.code, /^[0-9]{6}$/);
  assert.match(stored.inviteId, /^[A-Za-z0-9_-]{22}$/);
  assert.match(room.inviteHash, /^[0-9a-f]{64}$/);
});

test('resolveGameConfiguration vult defaults aan en laat de shape-assertion keuren', () => {
  const merged = resolveGameConfiguration({ language: 'en', totalRounds: 5 });
  assert.equal(merged.language, 'en');
  assert.equal(merged.totalRounds, 5);
  assert.equal(merged.preset, QUICK_START_CONFIG.preset);
  assert.equal(merged.deadlineGraceMs, 250); // besluit 13, niet de 150 uit het DATA-MODEL-voorbeeld
  assert.throws(() => resolveGameConfiguration({ language: 'de' }), /language must be one of/);
  assert.throws(() => resolveGameConfiguration({ gameTypes: ['typing'] }), /gameTypes elements/);
});

// ─── Matrixrij 3 & 4 — joinen ───────────────────────────────────────────────

test('matrixrij 3: join via inviteId (qr en shared_link) levert een geldige sessie op', async () => {
  const context = makeContext();
  const room = await makeRoom(context);

  for (const joinSource of ['qr', 'shared_link']) {
    const joined = await joinRoom(context, { inviteId: room.inviteId, displayName: `Speler-${joinSource}`, joinSource });
    assert.equal(joined.ok, true, `joinSource ${joinSource}`);
    assert.equal(joined.value.roomId, room.roomId);
    assert.deepEqual(joined.value.roles, ['player']);
    assert.equal(joined.value.joinSource, joinSource);

    const resolved = await resolveSession(context, {
      roomId: joined.value.roomId,
      sessionId: joined.value.sessionId,
      sessionToken: joined.value.sessionToken,
    });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.value.playerId, joined.value.playerId);
  }
});

test('matrixrij 4: join via de zescijferige code levert een sessie op; onbekende code geeft GAME_NOT_FOUND', async () => {
  const context = makeContext();
  const room = await makeRoom(context);

  const joined = await joinRoom(context, { gameCode: room.gameCode, displayName: 'Sanne', joinSource: 'code' });
  assert.equal(joined.ok, true);
  assert.equal(joined.value.gameCode, room.gameCode);

  const unknownCode = room.gameCode === '000000' ? '999999' : '000000';
  assert.deepEqual(
    await joinRoom(context, { gameCode: unknownCode, joinSource: 'code' }),
    { ok: false, code: 'GAME_NOT_FOUND' },
  );

  // Syntactisch ongeldige codes zijn een vormfout, geen ontbrekende room.
  for (const bad of ['12345', '1234567', 'abcdef', '12 456', '123456\n']) {
    assert.deepEqual(
      await joinRoom(context, { gameCode: bad, joinSource: 'code' }),
      { ok: false, code: 'INVITE_INVALID' },
      `code ${JSON.stringify(bad)}`,
    );
  }
  assert.deepEqual(
    await joinRoom(context, { inviteId: 'te-kort', joinSource: 'qr' }),
    { ok: false, code: 'INVITE_INVALID' },
  );
});

test('join eist precies één locator', async () => {
  const context = makeContext();
  const room = await makeRoom(context);

  assert.deepEqual(
    await joinRoom(context, { joinSource: 'unknown' }),
    { ok: false, code: 'INVITE_INVALID' },
  );
  assert.deepEqual(
    await joinRoom(context, { inviteId: room.inviteId, gameCode: room.gameCode, joinSource: 'qr' }),
    { ok: false, code: 'INVITE_INVALID' },
  );
  assert.deepEqual(
    await joinRoom(context, { gameCode: room.gameCode, joinSource: 'telepathie' }),
    { ok: false, code: 'INVITE_INVALID' },
  );
});

// ─── Matrixrij 5 — namen ────────────────────────────────────────────────────

test('matrixrij 5: opgegeven displayName blijft behouden, lege naam wordt servergegenereerd', async () => {
  const context = makeContext();
  const room = await makeRoom(context, { hostParticipates: false });

  const chosen = await joinRoom(context, { gameCode: room.gameCode, displayName: 'Sanne', joinSource: 'code' });
  assert.equal(chosen.value.effectiveName, 'Sanne');
  const chosenPlayer = await context.store.loadPlayer(room.roomId, chosen.value.playerId);
  assert.equal(chosenPlayer.displayName, 'Sanne');
  assert.equal(chosenPlayer.nameSource, 'chosen');

  for (const empty of [null, '', '   ', undefined]) {
    const generated = await joinRoom(context, { gameCode: room.gameCode, displayName: empty, joinSource: 'code' });
    const player = await context.store.loadPlayer(room.roomId, generated.value.playerId);
    assert.equal(player.displayName, null, `displayName ${JSON.stringify(empty)}`);
    assert.equal(player.nameSource, 'generated');
    assert.match(player.effectiveName, /^Speler \d+$/); // fallbackvorm zonder woordenlijsten
    assert.equal(player.effectiveName, player.generatedName);
  }
});

test('matrixrij 5: gelijke namen krijgen het botsingssuffix uit name-processing.js', async () => {
  const context = makeContext();
  const room = await makeRoom(context, { hostParticipates: false });

  const first = await joinRoom(context, { gameCode: room.gameCode, displayName: 'Sanne', joinSource: 'code' });
  const second = await joinRoom(context, { gameCode: room.gameCode, displayName: 'sanne', joinSource: 'code' });
  assert.equal(first.value.effectiveName, 'Sanne');
  assert.equal(second.value.effectiveName, 'sanne 2');
});

test('matrixrij 5: een gegenereerde naam gebruikt de geïnjecteerde woordenlijst', async () => {
  const context = makeContext({
    config: { nameWordLists: { nl: { adjectives: ['Vlugge'], animals: ['Vos'] } } },
  });
  const room = await makeRoom(context, { hostParticipates: false });
  const joined = await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code' });
  assert.equal(joined.value.effectiveName, 'Vlugge Vos');
});

test('een profane naam valt terug op de gegenereerde naam in plaats van te werpen', async () => {
  const context = makeContext({ config: { profanityWords: { nl: ['schutting'] } } });
  const room = await makeRoom(context, { hostParticipates: false });
  const joined = await joinRoom(context, { gameCode: room.gameCode, displayName: 'Schuttingtaal', joinSource: 'code' });
  assert.equal(joined.ok, true);
  const player = await context.store.loadPlayer(room.roomId, joined.value.playerId);
  assert.equal(player.nameSource, 'generated');
  assert.equal(player.displayName, null);
});

// ─── Besluit 7 — pre-join-preview ───────────────────────────────────────────

test('previewInvite valideert de invite en levert een naamsuggestie zonder sessie aan te maken', async () => {
  const { store, counts } = countingStore();
  const context = makeContext({ store });
  const room = await makeRoom(context, { hostParticipates: false });

  const before = { ...counts };
  const preview = await previewInvite(context, { inviteId: room.inviteId });

  assert.equal(preview.ok, true);
  assert.equal(preview.value.roomId, room.roomId);
  assert.equal(typeof preview.value.suggestedName, 'string');
  assert.ok(preview.value.suggestedName.length > 0);
  assert.equal(preview.value.phase, 'LOBBY');
  assert.equal(preview.value.locked, false);
  assert.equal(preview.value.playerCount, 0);
  assert.equal(preview.value.maxPlayers, QUICK_START_CONFIG.maxPlayers);
  // Geen sessie, geen speler, geen roommutatie.
  assert.deepEqual(counts, before);
  assert.equal(preview.value.sessionToken, undefined);
});

test('previewInvite suggereert een naam die nog niet bezet is', async () => {
  const context = makeContext({
    config: { nameWordLists: { nl: { adjectives: ['Vlugge'], animals: ['Vos'] } } },
  });
  const room = await makeRoom(context, { hostParticipates: false });
  await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code' });

  const preview = await previewInvite(context, { inviteId: room.inviteId });
  assert.equal(preview.value.suggestedName, 'Vlugge Vos 2');
});

test('previewInvite onderscheidt een misvormde van een onbekende invite', async () => {
  const context = makeContext();
  assert.deepEqual(await previewInvite(context, { inviteId: 'kort' }), { ok: false, code: 'INVITE_INVALID' });
  assert.deepEqual(await previewInvite(context, { inviteId: 'A'.repeat(22) }), { ok: false, code: 'GAME_NOT_FOUND' });
});

// ─── Matrixrij 6 — invite opnieuw tonen ─────────────────────────────────────

test('matrixrij 6: iedere deelnemer — niet alleen de host — kan de invite opnieuw opvragen', async () => {
  const context = makeContext();
  const room = await makeRoom(context);
  const joined = await joinRoom(context, { inviteId: room.inviteId, displayName: 'Gast', joinSource: 'qr' });

  // Dezelfde aanroep vanuit een spelersessie, zonder hostrol.
  const guestSession = await resolveSession(context, {
    roomId: joined.value.roomId,
    sessionId: joined.value.sessionId,
    sessionToken: joined.value.sessionToken,
  });
  assert.deepEqual(guestSession.value.roles, ['player']);

  const share = await getShareInfo(context, { roomId: room.roomId });
  assert.equal(share.ok, true);
  assert.equal(share.value.gameCode, room.gameCode);
  assert.equal(share.value.inviteId, room.inviteId);
  assert.equal(share.value.joinUrl, `${APP_URL}/j/${room.inviteId}`);
  assert.deepEqual(await getShareInfo(context, { roomId: 'room_bestaatniet' }), { ok: false, code: 'GAME_NOT_FOUND' });
});

test('joinUrl komt uit één serverconfiguratiewaarde (besluit 6) en verdraagt een slash op het eind', () => {
  const context = makeContext({ config: { publicAppUrl: 'https://play.aseso.nl/' } });
  assert.equal(buildJoinUrl(context, 'N4x7pQm2K8tWabcdefghij'), 'https://play.aseso.nl/j/N4x7pQm2K8tWabcdefghij');
});

// ─── Matrixrij 8 — vergrendelen ─────────────────────────────────────────────

test('matrixrij 8: vergrendelen weigert nieuwe joins, ontgrendelen laat ze weer toe', async () => {
  const context = makeContext();
  const room = await makeRoom(context);

  assert.deepEqual((await setRoomLocked(context, { roomId: room.roomId, locked: true })).value, {
    roomId: room.roomId,
    locked: true,
  });
  assert.equal((await context.store.loadRoom(room.roomId)).locked, true);

  assert.deepEqual(
    await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code' }),
    { ok: false, code: 'ROOM_LOCKED' },
  );
  assert.deepEqual(
    await joinRoom(context, { inviteId: room.inviteId, joinSource: 'qr' }),
    { ok: false, code: 'ROOM_LOCKED' },
  );

  await setRoomLocked(context, { roomId: room.roomId, locked: false });
  assert.equal((await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code' })).ok, true);
  assert.deepEqual(await setRoomLocked(context, { roomId: 'room_x', locked: true }), { ok: false, code: 'GAME_NOT_FOUND' });
});

// ─── Matrixrij 10 — kick en sessierevocatie ─────────────────────────────────

test('matrixrij 10: kick revoceert de sessie; hernieuwd gebruik van het token geeft SESSION_REVOKED', async () => {
  const context = makeContext();
  const room = await makeRoom(context);
  const joined = await joinRoom(context, { gameCode: room.gameCode, displayName: 'Weg', joinSource: 'code' });
  const credentials = {
    roomId: joined.value.roomId,
    sessionId: joined.value.sessionId,
    sessionToken: joined.value.sessionToken,
  };

  assert.equal((await resolveSession(context, credentials)).ok, true);

  const kick = await kickPlayer(context, { roomId: room.roomId, playerId: joined.value.playerId });
  assert.equal(kick.ok, true);
  assert.equal(kick.value.revoked, true);

  assert.deepEqual(await resolveSession(context, credentials), { ok: false, code: 'SESSION_REVOKED' });
  assert.equal((await context.store.loadPlayer(room.roomId, joined.value.playerId)).kicked, true);
  assert.equal((await context.store.loadSession(room.roomId, joined.value.sessionId)).revoked, true);

  // De hostsessie blijft onaangetast.
  assert.equal(
    (await resolveSession(context, { roomId: room.roomId, sessionId: room.sessionId, sessionToken: room.sessionToken })).ok,
    true,
  );
});

test('resolveSession geeft TOKEN_INVALID vóór SESSION_REVOKED, zodat een fout token niets verklapt', async () => {
  const context = makeContext();
  const room = await makeRoom(context);
  const joined = await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code' });
  await kickPlayer(context, { roomId: room.roomId, playerId: joined.value.playerId });

  assert.deepEqual(
    await resolveSession(context, {
      roomId: room.roomId,
      sessionId: joined.value.sessionId,
      sessionToken: 'niet-het-echte-token',
    }),
    { ok: false, code: 'TOKEN_INVALID' },
  );
  assert.deepEqual(
    await resolveSession(context, { roomId: room.roomId, sessionId: 'sess_onbekend', sessionToken: room.sessionToken }),
    { ok: false, code: 'TOKEN_INVALID' },
  );
});

test('kickPlayer geeft NOT_PLAYER voor een onbekende speler en GAME_NOT_FOUND voor een onbekende room', async () => {
  const context = makeContext();
  const room = await makeRoom(context);
  assert.deepEqual(await kickPlayer(context, { roomId: room.roomId, playerId: 'p_x' }), { ok: false, code: 'NOT_PLAYER' });
  assert.deepEqual(await kickPlayer(context, { roomId: 'room_x', playerId: 'p_x' }), { ok: false, code: 'GAME_NOT_FOUND' });
});

test('een gekickte speler telt niet meer mee als actieve speler', async () => {
  const context = makeContext({ config: {} });
  const room = await makeRoom(context, { hostParticipates: false, config: { maxPlayers: 1 } });
  const first = await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code' });

  assert.deepEqual(await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code' }), { ok: false, code: 'GAME_FULL' });
  await kickPlayer(context, { roomId: room.roomId, playerId: first.value.playerId });
  assert.equal((await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code' })).ok, true);
});

// ─── Matrixrij 11 — twee gelijktijdige rooms ────────────────────────────────

test('matrixrij 11: twee gelijktijdig actieve rooms lekken geen state naar elkaar', async () => {
  const context = makeContext();
  const roomA = await makeRoom(context, { hostParticipates: false });
  const roomB = await makeRoom(context, { hostParticipates: false });

  assert.notEqual(roomA.roomId, roomB.roomId);
  assert.notEqual(roomA.gameCode, roomB.gameCode);
  assert.notEqual(roomA.inviteId, roomB.inviteId);

  const a1 = await joinRoom(context, { gameCode: roomA.gameCode, displayName: 'A1', joinSource: 'code' });
  const a2 = await joinRoom(context, { inviteId: roomA.inviteId, displayName: 'A2', joinSource: 'qr' });
  const b1 = await joinRoom(context, { gameCode: roomB.gameCode, displayName: 'B1', joinSource: 'code' });

  // Spelerlijsten zijn strikt roomgescopet.
  const namesIn = async (roomId) => (await context.store.listPlayers(roomId)).map((p) => p.effectiveName).sort();
  assert.deepEqual(await namesIn(roomA.roomId), ['A1', 'A2']);
  assert.deepEqual(await namesIn(roomB.roomId), ['B1']);

  // Een kick in A raakt B niet.
  await kickPlayer(context, { roomId: roomA.roomId, playerId: a1.value.playerId });
  assert.equal((await context.store.loadSession(roomA.roomId, a1.value.sessionId)).revoked, true);
  assert.equal((await context.store.loadSession(roomB.roomId, b1.value.sessionId)).revoked, false);
  assert.equal(
    (await resolveSession(context, {
      roomId: roomB.roomId,
      sessionId: b1.value.sessionId,
      sessionToken: b1.value.sessionToken,
    })).ok,
    true,
  );

  // Vergrendelen van A blokkeert B niet.
  await setRoomLocked(context, { roomId: roomA.roomId, locked: true });
  assert.deepEqual(await joinRoom(context, { gameCode: roomA.gameCode, joinSource: 'code' }), { ok: false, code: 'ROOM_LOCKED' });
  assert.equal((await joinRoom(context, { gameCode: roomB.gameCode, joinSource: 'code' })).ok, true);
  assert.equal((await context.store.loadRoom(roomB.roomId)).locked, false);

  // Een sessietoken uit A werkt niet in B, ook niet met een sessionId uit A.
  assert.deepEqual(
    await resolveSession(context, { roomId: roomB.roomId, sessionId: a2.value.sessionId, sessionToken: a2.value.sessionToken }),
    { ok: false, code: 'TOKEN_INVALID' },
  );
});

// ─── Toegangsregels rond late join ──────────────────────────────────────────

test('een niet-LOBBY room weigert joins zodra allowLateJoin uit staat', async () => {
  const context = makeContext();
  const room = await makeRoom(context, { hostParticipates: false, config: { allowLateJoin: false } });

  // Fase-overgangen zijn van de match-lifecycle; hier alleen het effect ervan
  // op de toegangsvraag, dus de fase wordt rechtstreeks in de store gezet.
  const stored = await context.store.loadRoom(room.roomId);
  await context.store.saveRoom({ ...stored, phase: 'ROUND_ACTIVE' });

  assert.deepEqual(
    await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code' }),
    { ok: false, code: 'LATE_JOIN_DISABLED' },
  );
});

test('een late joiner krijgt de eligibleFromRound die de match-laag aanlevert', async () => {
  const context = makeContext();
  const room = await makeRoom(context, { hostParticipates: false });
  const stored = await context.store.loadRoom(room.roomId);
  await context.store.saveRoom({ ...stored, phase: 'ROUND_ACTIVE' });

  const joined = await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code', eligibleFromRound: 4 });
  assert.equal(joined.ok, true);
  assert.equal((await context.store.loadPlayer(room.roomId, joined.value.playerId)).eligibleFromRound, 4);
});

// ─── De join-code-claim (HANDOFF INT-1, opgelost door DM10) ─────────────────

test('claimLocators probeert een nieuwe kandidaat zodra een code al bezet is', async () => {
  const inner = createInMemoryStore();
  const aangeboden = [];
  const store = {
    ...inner,
    async claimRoomLocatorsAtomically(claim) {
      aangeboden.push(claim);
      // De eerste twee kandidaten botsen op de code.
      return aangeboden.length <= 2 ? { ok: false, conflict: 'code' } : inner.claimRoomLocatorsAtomically(claim);
    },
  };
  const context = makeContext({ store });

  const claimed = await claimLocators(context, { roomId: 'room_nieuw' });
  assert.equal(aangeboden.length, 3);
  assert.match(claimed.code, /^[0-9]{6}$/);
  assert.match(claimed.inviteId, /^[A-Za-z0-9_-]{22}$/);
  assert.match(claimed.inviteHash, /^[0-9a-f]{64}$/);
  assert.notEqual(claimed.inviteHash, claimed.inviteId);

  // Elke poging biedt een VERS paar aan, en de laatste is wat er teruggegeven
  // wordt — er wordt geen afgewezen kandidaat alsnog gebruikt.
  assert.equal(new Set(aangeboden.map((claim) => claim.inviteHash)).size, 3);
  assert.equal(aangeboden.at(-1).code, claimed.code);
  assert.equal(aangeboden.at(-1).inviteHash, claimed.inviteHash);
  // De poort krijgt de hash met de room-TTL, nooit de platte capability.
  assert.deepEqual(new Set(aangeboden.map((claim) => claim.ttlSeconds)), new Set([ROOM_TTL_SECONDS]));
  assert.equal(aangeboden.some((claim) => claim.inviteHash === claimed.inviteId), false);
});

test('claimLocators werpt GameCodeExhaustedError als elke kandidaat bezet is', async () => {
  const inner = createInMemoryStore();
  const store = { ...inner, async claimRoomLocatorsAtomically() { return { ok: false, conflict: 'code' }; } };
  const context = makeContext({ store });

  await assert.rejects(
    () => claimLocators(context, { roomId: 'room_nieuw', maxAttempts: 3 }),
    (error) => error.name === 'GameCodeExhaustedError' && error.code === 'CODE_SPACE_EXHAUSTED',
  );

  // Een uitgeputte INVITE-ruimte is geen uitgeputte coderuimte en krijgt
  // daarom niet room-codes.js' foutcontract.
  const inviteBezet = { ...inner, async claimRoomLocatorsAtomically() { return { ok: false, conflict: 'inviteHash' }; } };
  await assert.rejects(
    () => claimLocators(makeContext({ store: inviteBezet }), { roomId: 'room_nieuw', maxAttempts: 3 }),
    (error) => error instanceof RangeError && /geen vrije inviteId na 3 pogingen/.test(error.message),
  );
});

test('een claimconflict levert een nieuwe kandidaat op en geen fout: createRoom loopt gewoon door', async () => {
  const inner = createInMemoryStore();
  const afgewezen = [];
  let claims = 0;
  const store = {
    ...inner,
    async claimRoomLocatorsAtomically(claim) {
      claims += 1;
      // Eén botsing per locatorkant — beide conflictwaarden uit het contract.
      if (claims <= 2) {
        afgewezen.push(claim);
        return { ok: false, conflict: claims === 1 ? 'code' : 'inviteHash' };
      }
      return inner.claimRoomLocatorsAtomically(claim);
    },
  };
  const context = makeContext({ store });

  const created = await createRoom(context, { hostParticipates: false });
  assert.equal(created.ok, true);
  assert.equal(claims, 3);

  // De room draait op de geclaimde kandidaat en is via beide locators vindbaar.
  const stored = await inner.loadRoom(created.value.roomId);
  assert.equal(stored.code, created.value.gameCode);
  assert.equal(stored.inviteHash, created.value.inviteHash);
  assert.equal((await joinRoom(context, { gameCode: created.value.gameCode, joinSource: 'code' })).ok, true);
  assert.equal((await previewInvite(context, { inviteId: created.value.inviteId })).ok, true);

  // Van de afgewezen kandidaten is niets in de index blijven hangen.
  for (const claim of afgewezen) {
    assert.equal(await inner.loadRoomByInviteHash(claim.inviteHash), null);
    assert.notEqual(claim.inviteHash, created.value.inviteHash);
  }
});

test('een creatie die ná een geslaagde claim mislukt geeft de locators weer vrij', async () => {
  const inner = createInMemoryStore();
  const geclaimd = [];
  const vrijgegeven = [];
  const store = {
    ...inner,
    async claimRoomLocatorsAtomically(claim) {
      const result = await inner.claimRoomLocatorsAtomically(claim);
      if (result.ok === true) {
        geclaimd.push(claim);
      }
      return result;
    },
    async releaseRoomLocators(pair) {
      vrijgegeven.push(pair);
      return inner.releaseRoomLocators(pair);
    },
    async saveRoom() {
      throw new Error('store weigert de room ná de claim');
    },
  };
  const context = makeContext({ store });

  await assert.rejects(
    () => createRoom(context, { hostParticipates: true, displayName: 'Host' }),
    /store weigert de room ná de claim/,
  );

  assert.equal(geclaimd.length, 1);
  const { roomId, code, inviteHash } = geclaimd[0];
  assert.deepEqual(vrijgegeven, [{ roomId, code, inviteHash }]);

  // Niet alleen "release is aangeroepen": de code is daarna écht opnieuw
  // claimbaar door een andere room, en brandt dus geen room-TTL lang op.
  assert.equal(await inner.loadRoomByCode(code), null);
  assert.equal(await inner.loadRoomByInviteHash(inviteHash), null);
  assert.deepEqual(
    await inner.claimRoomLocatorsAtomically({ roomId: 'room_volgende', code, inviteHash, ttlSeconds: ROOM_TTL_SECONDS }),
    { ok: true },
  );
});

// ─── Pepperrotatie en de invite-index ───────────────────────────────────────

test('een met v1 gehashte inviteId blijft vindbaar nadat v2 de actieve pepper is geworden', async () => {
  const store = createInMemoryStore();
  const room = await makeRoom(makeContext({ store }), { hostParticipates: false });

  // De rotatie: v2 actief, v1 blijft in de map staan — precies wat besluit 26
  // voor tokens voorschrijft, hier voor dezelfde peppers.
  const geroteerd = makeContext({
    store,
    config: { tokenPeppers: { version: 'v2', peppers: { v1: PEPPER, v2: PEPPER_V2 } } },
  });

  // Er wordt niets omgeïndexeerd: onder de nieuwe pepper heeft dezelfde
  // inviteId een andere hash, en die staat nergens.
  const hashV2 = hashInviteId(room.inviteId, PEPPER_V2);
  assert.notEqual(hashV2, room.inviteHash);
  assert.equal(await store.loadRoomByInviteHash(hashV2), null);
  assert.notEqual(await store.loadRoomByInviteHash(room.inviteHash), null);

  const preview = await previewInvite(geroteerd, { inviteId: room.inviteId });
  assert.equal(preview.ok, true);
  assert.equal(preview.value.roomId, room.roomId);

  // Ook het join-pad (dat via touchRoom de locators verlengt met de hash die
  // op het Room-document staat, niet met een opnieuw geraden hash).
  const joined = await joinRoom(geroteerd, { inviteId: room.inviteId, displayName: 'Na rotatie', joinSource: 'qr' });
  assert.equal(joined.ok, true);
  assert.equal(joined.value.roomId, room.roomId);

  // En de keerzijde: valt v1 helemaal uit de map, dan is de invite écht weg.
  // Dát is het moment waarop een versieprefix op de hash geholpen zou hebben.
  const zonderV1 = makeContext({ store, config: { tokenPeppers: { version: 'v2', peppers: { v2: PEPPER_V2 } } } });
  assert.deepEqual(
    await previewInvite(zonderV1, { inviteId: room.inviteId }),
    { ok: false, code: 'GAME_NOT_FOUND' },
  );
});

// ─── Determinisme ───────────────────────────────────────────────────────────

test('alle tijdstempels komen uit de geïnjecteerde klok, nooit uit Date.now()', async () => {
  let clock = 1_000_000_000_000;
  const context = makeContext({ now: () => clock });

  const room = await makeRoom(context);
  assert.equal((await context.store.loadRoom(room.roomId)).createdAt, 1_000_000_000_000);

  clock = 1_000_000_060_000;
  const joined = await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code' });
  assert.equal((await context.store.loadPlayer(room.roomId, joined.value.playerId)).joinedAt, 1_000_000_060_000);
  assert.equal((await context.store.loadRoom(room.roomId)).lastActivityAt, 1_000_000_060_000);

  clock = 1_000_000_120_000;
  await setRoomLocked(context, { roomId: room.roomId, locked: true });
  assert.equal((await context.store.loadRoom(room.roomId)).lastActivityAt, 1_000_000_120_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// §A1 — de trechter waar élke room-config langskomt (createRoom én
// updateConfig) laat maar één, speelbare gameType door.
// ─────────────────────────────────────────────────────────────────────────────

test('§A1: resolveGameConfiguration weigert meer dan één gameType', () => {
  assert.throws(
    () => resolveGameConfiguration({ gameTypes: ['flags_mc', 'capitals_mc'] }),
    /exact één waarde/,
  );
  assert.throws(
    () => resolveGameConfiguration({ gameTypes: ['flags_mc', 'flags_mc'] }),
    /exact één waarde/,
  );
  assert.throws(() => resolveGameConfiguration({ gameTypes: [] }), /exact één waarde/);
});

test('§A1: resolveGameConfiguration weigert een gameType waarvan de keten nog niet af is', () => {
  for (const gameType of ['capitals_mc', 'odd_one_out', 'higher_lower', 'real_or_fake_flag']) {
    if (PLAYABLE_GAME_TYPES.includes(gameType)) continue;
    assert.throws(
      () => resolveGameConfiguration({ gameTypes: [gameType] }),
      /niet speelbaar/,
      `${gameType} hoort geweigerd te worden zolang hij niet speelbaar is`,
    );
  }
});

test('§A1: de quick-start default komt er ongeschonden doorheen', () => {
  const config = resolveGameConfiguration();
  assert.equal(config.gameTypes.length, 1);
  assert.ok(PLAYABLE_GAME_TYPES.includes(config.gameTypes[0]));
});
