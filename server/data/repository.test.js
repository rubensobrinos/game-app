'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { DATA_STORE_METHOD_NAMES, assertImplementsDataStore } = require('./repository');
const { createInMemoryStore } = require('./in-memory-store');

const VALID_CONFIG = Object.freeze({
  preset: 'group_battle',
  gameTypes: ['flags_mc'],
  language: 'nl',
  difficulty: 'normal',
  totalRounds: 10,
  questionSeconds: 15,
  resultSeconds: 5,
  scoreboardSeconds: 4,
  scoreboardFrequency: 'every_round',
  pacing: 'auto',
  speedBonus: true,
  deadlineGraceMs: 150,
  mode: 'individual',
  teamNames: [],
  metricMode: 'mixed',
  maxPlayers: 100,
  allowLateJoin: true,
});

function makeRoom(overrides = {}) {
  return {
    id: 'room_1',
    code: '482917',
    inviteId: 'invite_abc',
    phase: 'LOBBY',
    createdAt: 1000,
    lastActivityAt: 1000,
    hostSessionIds: ['sess_host'],
    locked: false,
    config: VALID_CONFIG,
    currentMatchId: null,
    ...overrides,
  };
}

function makeSession(overrides = {}) {
  return {
    id: 'sess_1',
    roomId: 'room_1',
    roles: ['host', 'player'],
    playerId: 'p_1',
    tokenHash: 'opaque-hash',
    createdAt: 1000,
    lastSeenAt: 1000,
    connectedSocketIds: ['socket_1'],
    revoked: false,
    ...overrides,
  };
}

function makePlayer(overrides = {}) {
  return {
    id: 'p_1',
    roomId: 'room_1',
    sessionId: 'sess_1',
    displayName: null,
    generatedName: 'Vlugge Vos',
    effectiveName: 'Vlugge Vos',
    nameSource: 'generated',
    teamId: null,
    score: 0,
    correctCount: 0,
    correctResponseTimeMsTotal: 0,
    connected: true,
    eligibleFromRound: 1,
    joinedAt: 1000,
    left: false,
    kicked: false,
    ...overrides,
  };
}

function makeMatch(overrides = {}) {
  return {
    id: 'match_1',
    roomId: 'room_1',
    sequence: 1,
    phase: 'ROUND_ACTIVE',
    startedAt: 1000,
    finishedAt: null,
    roundIndex: 0,
    roundIds: [],
    usedQuestionKeys: [],
    previousMatchQuestionKeys: [],
    pausedState: null,
    contentVersion: '2026.08.1',
    rendererVersion: 'flag-renderer-1',
    ...overrides,
  };
}

function makeAnswer(overrides = {}) {
  return {
    roundId: 'round_1',
    playerId: 'p_1',
    actionId: 'act_1',
    answer: { choice: 'fake' },
    receivedAt: 2000,
    responseTimeMs: 1000,
    correct: true,
    points: 158,
    ...overrides,
  };
}

describe('assertImplementsDataStore — contract-sanity-check #1-3', () => {
  test('#1 een verse in-memory store implementeert alle DataStore-methoden', () => {
    assert.doesNotThrow(() => assertImplementsDataStore(createInMemoryStore()));
  });
  test('#2 een object dat een methode mist -> throw', () => {
    const incomplete = createInMemoryStore();
    delete incomplete.loadRoom;
    assert.throws(() => assertImplementsDataStore(incomplete), TypeError);
  });
  test('#3 DATA_STORE_METHOD_NAMES bevat 21 methoden (18 uit DM6 + claimRoomLocatorsAtomically/releaseRoomLocators/refreshRoomLocators uit DM10)', () => {
    assert.strictEqual(DATA_STORE_METHOD_NAMES.length, 21);
  });
});

describe('CRUD-rondje per entiteit #4-10', () => {
  test('#4 Room: save -> load geeft hetzelfde object terug, geen mutatie van het origineel', async () => {
    const store = createInMemoryStore();
    const room = makeRoom();
    await store.saveRoom(room);
    const loaded = await store.loadRoom('room_1');
    assert.deepStrictEqual(loaded, room);
    loaded.locked = true; // mutatie van het teruggegeven object mag de store niet raken
    const loadedAgain = await store.loadRoom('room_1');
    assert.strictEqual(loadedAgain.locked, false);
  });

  test('#5 Session: save -> load geeft hetzelfde object terug', async () => {
    const store = createInMemoryStore();
    const session = makeSession();
    await store.saveSession(session);
    assert.deepStrictEqual(await store.loadSession('room_1', 'sess_1'), session);
  });

  test('#6 Player: save -> load geeft hetzelfde object terug', async () => {
    const store = createInMemoryStore();
    const player = makePlayer();
    await store.savePlayer(player);
    assert.deepStrictEqual(await store.loadPlayer('room_1', 'p_1'), player);
  });

  test('#7 listPlayers geeft alle spelers van een room terug', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer({ id: 'p_1' }));
    await store.savePlayer(makePlayer({ id: 'p_2' }));
    const players = await store.listPlayers('room_1');
    assert.strictEqual(players.length, 2);
    assert.deepStrictEqual(new Set(players.map((p) => p.id)), new Set(['p_1', 'p_2']));
  });

  test('#8 Match: save -> load geeft hetzelfde object terug', async () => {
    const store = createInMemoryStore();
    const match = makeMatch();
    await store.saveMatch(match);
    assert.deepStrictEqual(await store.loadMatch('room_1', 'match_1'), match);
  });

  test('#9 Round: save -> load geeft hetzelfde object terug (na saveMatch)', async () => {
    const store = createInMemoryStore();
    await store.saveMatch(makeMatch());
    const round = { id: 'round_1', matchId: 'match_1', status: 'ACTIVE' };
    await store.saveRound('room_1', round);
    assert.deepStrictEqual(await store.loadRound('room_1', 'match_1', 'round_1'), round);
  });

  test('#10 onbekende ids geven null, geen throw', async () => {
    const store = createInMemoryStore();
    assert.strictEqual(await store.loadRoom('nope'), null);
    assert.strictEqual(await store.loadSession('room_1', 'nope'), null);
    assert.strictEqual(await store.loadPlayer('room_1', 'nope'), null);
    assert.strictEqual(await store.loadMatch('room_1', 'nope'), null);
    assert.strictEqual(await store.loadRound('room_1', 'match_1', 'nope'), null);
    assert.strictEqual(await store.loadAnswer('room_1', 'match_1', 'round_1', 'nope'), null);
  });
});

describe('loadRoomByCode/loadRoomByInviteHash — rechtstreeks op het veld resp. via een claim, geen hashing in de fake zelf #11-12', () => {
  test('#11 loadRoomByCode vindt dezelfde room als loadRoom', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom());
    assert.deepStrictEqual(await store.loadRoomByCode('482917'), await store.loadRoom('room_1'));
  });

  test('#12 loadRoomByInviteHash vindt dezelfde room als loadRoom, na een claim (saveRoom alleen vult de code-index, niet de inviteHash-index — zie DM10)', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '482917', inviteHash: 'hash_abc', ttlSeconds: 14400 });
    await store.saveRoom(makeRoom());
    assert.deepStrictEqual(await store.loadRoomByInviteHash('hash_abc'), await store.loadRoom('room_1'));
  });
});

describe('setRoomAndMatchPhaseAtomically — alles-of-niets #13-15', () => {
  test('#13 geslaagde aanroep werkt Room.phase én Match.phase bij naar dezelfde waarde', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom());
    await store.saveMatch(makeMatch());
    await store.setRoomAndMatchPhaseAtomically('room_1', 'match_1', 'SCOREBOARD');
    assert.strictEqual((await store.loadRoom('room_1')).phase, 'SCOREBOARD');
    assert.strictEqual((await store.loadMatch('room_1', 'match_1')).phase, 'SCOREBOARD');
  });

  test('#14 niet-bestaande matchId -> throw, Room.phase blijft ongewijzigd', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom({ phase: 'LOBBY' }));
    await assert.rejects(() => store.setRoomAndMatchPhaseAtomically('room_1', 'nope', 'SCOREBOARD'));
    assert.strictEqual((await store.loadRoom('room_1')).phase, 'LOBBY');
  });

  test('#15 niet-bestaande roomId -> throw', async () => {
    const store = createInMemoryStore();
    await assert.rejects(() => store.setRoomAndMatchPhaseAtomically('nope', 'match_1', 'SCOREBOARD'));
  });
});

describe('saveAcceptedAnswerAtomically — alles-of-niets, dekt Answer+Player+scoreboard+action-cache #16-19', () => {
  test('#16 geslaagde aanroep schrijft alle vier onderdelen', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer());
    const write = {
      answer: makeAnswer(),
      updatedPlayer: { id: 'p_1', score: 158, correctCount: 1, correctResponseTimeMsTotal: 1000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    };
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', write);

    assert.deepStrictEqual(await store.loadAnswer('room_1', 'match_1', 'round_1', 'p_1'), write.answer);
    const player = await store.loadPlayer('room_1', 'p_1');
    assert.strictEqual(player.score, 158);
    assert.strictEqual(player.correctCount, 1);
    assert.strictEqual(player.correctResponseTimeMsTotal, 1000);
    assert.deepStrictEqual(await store.getScoreboardTop('room_1', 'match_1', 10), [{ playerId: 'p_1', score: 158 }]);
    assert.deepStrictEqual(await store.loadActionCacheEntry('room_1', 'act_1'), write.actionCacheEntry);
  });

  test('#17 niet-bestaande playerId -> throw, geen van de vier onderdelen wordt geschreven', async () => {
    // GEEN store.savePlayer() hier: playerId 'p_1' bestaat bewust niet.
    const store = createInMemoryStore();
    const write = {
      answer: makeAnswer(),
      updatedPlayer: { id: 'p_1', score: 158, correctCount: 1, correctResponseTimeMsTotal: 1000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    };
    await assert.rejects(() => store.saveAcceptedAnswerAtomically('room_1', 'match_1', write));

    assert.strictEqual(await store.loadAnswer('room_1', 'match_1', 'round_1', 'p_1'), null);
    assert.deepStrictEqual(await store.getScoreboardTop('room_1', 'match_1', 10), []);
    assert.strictEqual(await store.loadActionCacheEntry('room_1', 'act_1'), null);
  });

  test('#18 updatedPlayer bevat absolute waarden, geen delta: score wordt overschreven, niet opgeteld', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer({ score: 4000, correctCount: 10, correctResponseTimeMsTotal: 50000 }));
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', {
      answer: makeAnswer(),
      updatedPlayer: { id: 'p_1', score: 4158, correctCount: 11, correctResponseTimeMsTotal: 51000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    });
    const player = await store.loadPlayer('room_1', 'p_1');
    assert.strictEqual(player.score, 4158); // absolute waarde, niet 4000 + 4158
  });

  // Let op wat test #16-18 bewijzen en niet bewijzen: ze bewijzen dat dít
  // (single-threaded, in-memory) pad alles-of-niets is. Ze zeggen niets over
  // twee gelijktijdige aanroepen — er is in deze fake geen concurrency om te
  // testen. Zie de disclaimer bovenaan in-memory-store.js.
  test('#19 (documentatie) geen concurrency-bewijs — zie bestandscommentaar', () => {
    assert.ok(true, 'zie de disclaimer in-memory-store.js en repository.js');
  });
});

describe('loadActionCacheEntry — onbekende actionId geeft null #20', () => {
  test('#20 onbekende actionId -> null, geen throw', async () => {
    const store = createInMemoryStore();
    assert.strictEqual(await store.loadActionCacheEntry('room_1', 'nope'), null);
  });
});

describe('getScoreboardTop — sortering en limit #21-23', () => {
  test('#21 sorteert op score aflopend', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer({ id: 'p_1' }));
    await store.savePlayer(makePlayer({ id: 'p_2' }));
    await store.savePlayer(makePlayer({ id: 'p_3' }));
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', {
      answer: makeAnswer({ playerId: 'p_1' }),
      updatedPlayer: { id: 'p_1', score: 100, correctCount: 1, correctResponseTimeMsTotal: 100 },
      actionCacheEntry: { actionId: 'act_1', ack: {} },
    });
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', {
      answer: makeAnswer({ playerId: 'p_2', roundId: 'round_2' }),
      updatedPlayer: { id: 'p_2', score: 300, correctCount: 1, correctResponseTimeMsTotal: 100 },
      actionCacheEntry: { actionId: 'act_2', ack: {} },
    });
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', {
      answer: makeAnswer({ playerId: 'p_3', roundId: 'round_3' }),
      updatedPlayer: { id: 'p_3', score: 200, correctCount: 1, correctResponseTimeMsTotal: 100 },
      actionCacheEntry: { actionId: 'act_3', ack: {} },
    });
    const top = await store.getScoreboardTop('room_1', 'match_1', 10);
    assert.deepStrictEqual(top.map((entry) => entry.playerId), ['p_2', 'p_3', 'p_1']);
  });

  test('#22 respecteert limit', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer({ id: 'p_1' }));
    await store.savePlayer(makePlayer({ id: 'p_2' }));
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', {
      answer: makeAnswer({ playerId: 'p_1' }),
      updatedPlayer: { id: 'p_1', score: 100, correctCount: 1, correctResponseTimeMsTotal: 100 },
      actionCacheEntry: { actionId: 'act_1', ack: {} },
    });
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', {
      answer: makeAnswer({ playerId: 'p_2', roundId: 'round_2' }),
      updatedPlayer: { id: 'p_2', score: 300, correctCount: 1, correctResponseTimeMsTotal: 100 },
      actionCacheEntry: { actionId: 'act_2', ack: {} },
    });
    const top = await store.getScoreboardTop('room_1', 'match_1', 1);
    assert.strictEqual(top.length, 1);
    assert.strictEqual(top[0].playerId, 'p_2');
  });

  test('#23 onbekende matchId geeft lege array', async () => {
    const store = createInMemoryStore();
    assert.deepStrictEqual(await store.getScoreboardTop('room_1', 'nope', 10), []);
  });

  test('#23b (DM12) twee rooms met eenzelfde matchId houden onafhankelijke ranglijsten — het scenario dat INTB-3 vond', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer({ id: 'p_1', roomId: 'room_a' }));
    await store.savePlayer(makePlayer({ id: 'p_2', roomId: 'room_b' }));
    await store.saveAcceptedAnswerAtomically('room_a', 'match_gedeeld', {
      answer: makeAnswer({ playerId: 'p_1' }),
      updatedPlayer: { id: 'p_1', score: 100, correctCount: 1, correctResponseTimeMsTotal: 100 },
      actionCacheEntry: { actionId: 'act_a', ack: {} },
    });
    await store.saveAcceptedAnswerAtomically('room_b', 'match_gedeeld', {
      answer: makeAnswer({ playerId: 'p_2' }),
      updatedPlayer: { id: 'p_2', score: 700, correctCount: 1, correctResponseTimeMsTotal: 100 },
      actionCacheEntry: { actionId: 'act_b', ack: {} },
    });

    assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_gedeeld', 10), [{ playerId: 'p_1', score: 100 }]);
    assert.deepStrictEqual(await store.getScoreboardTop('room_b', 'match_gedeeld', 10), [{ playerId: 'p_2', score: 700 }]);
  });
});

describe('claimRoomLocatorsAtomically/releaseRoomLocators/refreshRoomLocators — DM10 #24-33', () => {
  test('#24 vrije code + inviteHash claimen slaagt, en is onmiddellijk zichtbaar via een tweede claim-poging (claim en lookup delen dezelfde index) — óók vóór saveRoom', async () => {
    const store = createInMemoryStore();
    const result = await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    assert.deepStrictEqual(result, { ok: true });
    // De room zelf is nog niet opgeslagen; een tweede claim op dezelfde
    // code/inviteHash door een ANDERE roomId moet al conflicteren.
    const secondClaim = await store.claimRoomLocatorsAtomically({ roomId: 'room_2', code: '111111', inviteHash: 'hash_2', ttlSeconds: 14400 });
    assert.deepStrictEqual(secondClaim, { ok: false, conflict: 'code' });
  });

  test('#25 bezette code (andere roomId), vrije inviteHash -> conflict: code, inviteHash blijft vrij voor een derde roomId (geen partial claim)', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    const result = await store.claimRoomLocatorsAtomically({ roomId: 'room_2', code: '111111', inviteHash: 'hash_2', ttlSeconds: 14400 });
    assert.deepStrictEqual(result, { ok: false, conflict: 'code' });
    const thirdClaim = await store.claimRoomLocatorsAtomically({ roomId: 'room_3', code: '222222', inviteHash: 'hash_2', ttlSeconds: 14400 });
    assert.deepStrictEqual(thirdClaim, { ok: true });
  });

  test('#26 vrije code, bezette inviteHash (andere roomId) -> conflict: inviteHash, code blijft vrij (omgekeerd bewijs)', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    const result = await store.claimRoomLocatorsAtomically({ roomId: 'room_2', code: '222222', inviteHash: 'hash_1', ttlSeconds: 14400 });
    assert.deepStrictEqual(result, { ok: false, conflict: 'inviteHash' });
    const thirdClaim = await store.claimRoomLocatorsAtomically({ roomId: 'room_3', code: '222222', inviteHash: 'hash_3', ttlSeconds: 14400 });
    assert.deepStrictEqual(thirdClaim, { ok: true });
  });

  test('#27 dezelfde roomId claimt exact dezelfde code + inviteHash opnieuw -> ok:true, geen conflict (idempotentie)', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    const result = await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    assert.deepStrictEqual(result, { ok: true });
  });

  test('#28 releaseRoomLocators door de eigenaar maakt beide vrij voor een andere roomId', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    await store.releaseRoomLocators({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1' });
    const result = await store.claimRoomLocatorsAtomically({ roomId: 'room_2', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    assert.deepStrictEqual(result, { ok: true });
  });

  test('#29 releaseRoomLocators door een roomId die maar één van de twee bezit doet NIETS (alles-of-niets)', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    // room_1 bezit de code, maar niet 'hash_ander' (nooit geclaimd) -> gedeeltelijk bezit.
    await store.releaseRoomLocators({ roomId: 'room_1', code: '111111', inviteHash: 'hash_ander' });
    // De code blijft bezet door room_1 -> een ander roomId kan hem niet claimen.
    const result = await store.claimRoomLocatorsAtomically({ roomId: 'room_2', code: '111111', inviteHash: 'hash_2', ttlSeconds: 14400 });
    assert.deepStrictEqual(result, { ok: false, conflict: 'code' });
  });

  test('#30 releaseRoomLocators op een nooit-geclaimde combinatie werpt niet (no-op)', async () => {
    const store = createInMemoryStore();
    await assert.doesNotReject(() => store.releaseRoomLocators({ roomId: 'room_1', code: 'nope', inviteHash: 'nope' }));
  });

  test('#31 refreshRoomLocators op een actief eigen bezit slaagt zonder fout', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    await assert.doesNotReject(() => store.refreshRoomLocators({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 }));
  });

  test('#32 refreshRoomLocators op een niet (meer) bezeten locator werpt RangeError', async () => {
    const store = createInMemoryStore();
    await assert.rejects(
      () => store.refreshRoomLocators({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 }),
      RangeError
    );
  });

  test('#33 claimRoomLocatorsAtomically met een nieuwe inviteHash-kandidaat door de eigenaar-roomId slaagt (retry op alleen de invite-kant)', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    const result = await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_nieuw', ttlSeconds: 14400 });
    assert.deepStrictEqual(result, { ok: true });
  });
});

describe('saveRound/loadAnswer/loadActionCacheEntry — room-scoping (DM11) #34-38', () => {
  test('#34 saveRound werpt RangeError als de match niet bestaat (integriteit behouden, nu O(1) i.p.v. scan)', async () => {
    const store = createInMemoryStore();
    await assert.rejects(
      () => store.saveRound('room_1', { id: 'round_1', matchId: 'match_onbekend', status: 'ACTIVE' }),
      RangeError
    );
  });

  test('#35 saveRound werpt RangeError als de match bestaat maar bij een ANDER roomId hoort (geen wees-rondes, geen geraden roomId)', async () => {
    const store = createInMemoryStore();
    await store.saveMatch(makeMatch({ roomId: 'room_a' }));
    await assert.rejects(
      () => store.saveRound('room_b', { id: 'round_1', matchId: 'match_1', status: 'ACTIVE' }),
      RangeError
    );
  });

  test('#36 twee rooms met hetzelfde matchId houden hun rondes gescheiden (onmogelijk te arrangeren vóór DM11 — de oude scan vond alleen de eerste treffer)', async () => {
    const store = createInMemoryStore();
    await store.saveMatch(makeMatch({ roomId: 'room_a', id: 'match_gedeeld' }));
    await store.saveMatch(makeMatch({ roomId: 'room_b', id: 'match_gedeeld' }));
    await store.saveRound('room_a', { id: 'round_1', matchId: 'match_gedeeld', status: 'ACTIVE' });
    await store.saveRound('room_b', { id: 'round_1', matchId: 'match_gedeeld', status: 'ENDED' });

    assert.strictEqual((await store.loadRound('room_a', 'match_gedeeld', 'round_1')).status, 'ACTIVE');
    assert.strictEqual((await store.loadRound('room_b', 'match_gedeeld', 'round_1')).status, 'ENDED');
  });

  test('#37 twee rooms met hetzelfde actionId krijgen elk hun eigen loadActionCacheEntry-resultaat', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer({ id: 'p_1', roomId: 'room_a' }));
    await store.savePlayer(makePlayer({ id: 'p_2', roomId: 'room_b' }));
    await store.saveAcceptedAnswerAtomically('room_a', 'match_1', {
      answer: makeAnswer({ playerId: 'p_1', actionId: 'act_gedeeld' }),
      updatedPlayer: { id: 'p_1', score: 100, correctCount: 1, correctResponseTimeMsTotal: 100 },
      actionCacheEntry: { actionId: 'act_gedeeld', ack: { roundId: 'round_1', bron: 'room_a' } },
    });
    await store.saveAcceptedAnswerAtomically('room_b', 'match_1', {
      answer: makeAnswer({ playerId: 'p_2', actionId: 'act_gedeeld' }),
      updatedPlayer: { id: 'p_2', score: 200, correctCount: 1, correctResponseTimeMsTotal: 100 },
      actionCacheEntry: { actionId: 'act_gedeeld', ack: { roundId: 'round_1', bron: 'room_b' } },
    });

    assert.deepStrictEqual(await store.loadActionCacheEntry('room_a', 'act_gedeeld'), { actionId: 'act_gedeeld', ack: { roundId: 'round_1', bron: 'room_a' } });
    assert.deepStrictEqual(await store.loadActionCacheEntry('room_b', 'act_gedeeld'), { actionId: 'act_gedeeld', ack: { roundId: 'round_1', bron: 'room_b' } });
  });

  test('#38 identifiers met een spatie erin botsen niet — geneste Maps, geen samengestelde string-sleutel (zie in-memory-store.js)', async () => {
    const store = createInMemoryStore();
    // "room 1" + "1 match" zou onder een `${a} ${b}`-sleutel op dezelfde string
    // uitkomen als "room" + "1 1 match". Met geneste Maps is dat structureel
    // onmogelijk.
    await store.saveMatch(makeMatch({ roomId: 'room 1', id: '1 match' }));
    await store.saveMatch(makeMatch({ roomId: 'room', id: '1 1 match' }));

    assert.strictEqual((await store.loadMatch('room 1', '1 match')).roomId, 'room 1');
    assert.strictEqual((await store.loadMatch('room', '1 1 match')).roomId, 'room');
    assert.strictEqual(await store.loadMatch('room 1', '1 1 match'), null);
    assert.strictEqual(await store.loadMatch('room', '1 match'), null);
  });
});

describe('saveAcceptedAnswerAtomically — idempotentie en "één antwoord per ronde" ÍN de atomaire operatie (DM13, reactie op INTB-4) #39-43', () => {
  test('#39 dezelfde actionId een tweede keer resolvet zonder te muteren, ook met een hogere score in de herhaling', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer());
    const eerste = {
      answer: makeAnswer(),
      updatedPlayer: { id: 'p_1', score: 158, correctCount: 1, correctResponseTimeMsTotal: 1000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    };
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', eerste);

    // Zelfde actionId, maar met een hogere score — zoals een dubbel
    // afgeleverde socketboodschap eruitziet nadat de aanroeper op verouderde
    // spelerstand heeft gerekend.
    const herhaling = {
      answer: makeAnswer({ points: 200 }),
      updatedPlayer: { id: 'p_1', score: 358, correctCount: 2, correctResponseTimeMsTotal: 2000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    };
    await assert.doesNotReject(() => store.saveAcceptedAnswerAtomically('room_1', 'match_1', herhaling));

    const player = await store.loadPlayer('room_1', 'p_1');
    assert.strictEqual(player.score, 158, 'eindscore blijft 158 — de herhaling mag er geen 358 van maken');
    assert.strictEqual(player.correctCount, 1);
    assert.strictEqual(player.correctResponseTimeMsTotal, 1000);
    assert.deepStrictEqual(await store.loadAnswer('room_1', 'match_1', 'round_1', 'p_1'), eerste.answer);
    assert.deepStrictEqual(await store.getScoreboardTop('room_1', 'match_1', 10), [{ playerId: 'p_1', score: 158 }]);
    assert.deepStrictEqual(await store.loadActionCacheEntry('room_1', 'act_1'), eerste.actionCacheEntry);
  });

  test('#40 een tweede, ANDERE actionId voor dezelfde speler in dezelfde ronde wordt afgewezen (RangeError, code ALREADY_ANSWERED), niets van de afgewezen inzending landt', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer());
    const eerste = {
      answer: makeAnswer(),
      updatedPlayer: { id: 'p_1', score: 158, correctCount: 1, correctResponseTimeMsTotal: 1000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    };
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', eerste);

    const tweede = {
      answer: makeAnswer({ actionId: 'act_2' }),
      updatedPlayer: { id: 'p_1', score: 358, correctCount: 2, correctResponseTimeMsTotal: 2000 },
      actionCacheEntry: { actionId: 'act_2', ack: { roundId: 'round_1' } },
    };
    await assert.rejects(async () => {
      try {
        await store.saveAcceptedAnswerAtomically('room_1', 'match_1', tweede);
      } catch (err) {
        assert.strictEqual(err.code, 'ALREADY_ANSWERED');
        throw err;
      }
    }, RangeError);

    const player = await store.loadPlayer('room_1', 'p_1');
    assert.strictEqual(player.score, 158);
    assert.strictEqual(player.correctCount, 1);
    assert.strictEqual(player.correctResponseTimeMsTotal, 1000);
    assert.deepStrictEqual(await store.loadAnswer('room_1', 'match_1', 'round_1', 'p_1'), eerste.answer);
    assert.deepStrictEqual(await store.getScoreboardTop('room_1', 'match_1', 10), [{ playerId: 'p_1', score: 158 }]);
    assert.strictEqual(await store.loadActionCacheEntry('room_1', 'act_2'), null, 'de ack van de afgewezen inzending mag niet bestaan');
  });

  test('#41 dezelfde speler in twee VERSCHILLENDE rondes: allebei geaccepteerd, scores tellen op (regressiebewijs: geen overblokkering)', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer());
    const rondeEen = {
      answer: makeAnswer({ roundId: 'round_1', actionId: 'act_1' }),
      updatedPlayer: { id: 'p_1', score: 100, correctCount: 1, correctResponseTimeMsTotal: 1000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    };
    const rondeTwee = {
      answer: makeAnswer({ roundId: 'round_2', actionId: 'act_2' }),
      updatedPlayer: { id: 'p_1', score: 220, correctCount: 2, correctResponseTimeMsTotal: 2000 },
      actionCacheEntry: { actionId: 'act_2', ack: { roundId: 'round_2' } },
    };
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', rondeEen);
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', rondeTwee);

    const player = await store.loadPlayer('room_1', 'p_1');
    assert.strictEqual(player.score, 220);
    assert.deepStrictEqual(await store.loadAnswer('room_1', 'match_1', 'round_1', 'p_1'), rondeEen.answer);
    assert.deepStrictEqual(await store.loadAnswer('room_1', 'match_1', 'round_2', 'p_1'), rondeTwee.answer);
  });

  test('#42 volledig scenario: retry (replay) + afgewezen tweede inzending + geldige volgende ronde -> eindscore precies 220, niet 320/420 (rechtstreeks ontleend aan INT-B\'s eigen INTB-4-scenario)', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer());

    const rondeEen = {
      answer: makeAnswer({ roundId: 'round_1', actionId: 'act_1' }),
      updatedPlayer: { id: 'p_1', score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    };
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', rondeEen);

    // Retry van diezelfde actie: replay, geen mutatie.
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', {
      answer: makeAnswer({ roundId: 'round_1', actionId: 'act_1', points: 200 }),
      updatedPlayer: { id: 'p_1', score: 320, correctCount: 2, correctResponseTimeMsTotal: 5000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    });

    // Tweede, andere actie in DEZELFDE ronde: afgewezen.
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', {
      answer: makeAnswer({ roundId: 'round_1', actionId: 'act_2', points: 200 }),
      updatedPlayer: { id: 'p_1', score: 320, correctCount: 2, correctResponseTimeMsTotal: 6000 },
      actionCacheEntry: { actionId: 'act_2', ack: { roundId: 'round_1' } },
    }).catch(() => {
      // Al vastgelegd door #40 dat dit een RangeError met code ALREADY_ANSWERED
      // is; deze test gaat alleen over de eindstand.
    });

    // Ronde 2, geaccepteerd: 120 + 100 = 220. Dit MOET tellen.
    const rondeTwee = {
      answer: makeAnswer({ roundId: 'round_2', actionId: 'act_3', points: 100 }),
      updatedPlayer: { id: 'p_1', score: 220, correctCount: 2, correctResponseTimeMsTotal: 5000 },
      actionCacheEntry: { actionId: 'act_3', ack: { roundId: 'round_2' } },
    };
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', rondeTwee);

    const player = await store.loadPlayer('room_1', 'p_1');
    assert.strictEqual(player.score, 220, 'eindscore is 120 (ronde 1) + 100 (ronde 2) — niet 320, niet 420');
    assert.deepStrictEqual(await store.getScoreboardTop('room_1', 'match_1', 10), [{ playerId: 'p_1', score: 220 }]);
    assert.deepStrictEqual(await store.loadAnswer('room_1', 'match_1', 'round_1', 'p_1'), rondeEen.answer, 'ronde 1 draagt nog steeds het eerste antwoord');
    assert.deepStrictEqual(await store.loadAnswer('room_1', 'match_1', 'round_2', 'p_1'), rondeTwee.answer);
    assert.strictEqual(await store.loadActionCacheEntry('room_1', 'act_2'), null, 'de ack van de afgewezen tweede inzending');
  });

  test('#43 idempotentie gaat vóór de playerId-check: een replay resolvet zelfs als de write een niet-bestaande playerId noemt', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer());
    const eerste = {
      answer: makeAnswer(),
      updatedPlayer: { id: 'p_1', score: 158, correctCount: 1, correctResponseTimeMsTotal: 1000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    };
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', eerste);

    // Zelfde actionId, maar nu met een playerId die niet bestaat. Zou de
    // playerId-check vóór de idempotentiecheck komen, dan zou dit een
    // RangeError geven in plaats van een stille replay — de ordening in de
    // Beslissing van DM13 is dus geen toeval maar getest gedrag.
    const herhalingMetOnbekendeSpeler = {
      answer: makeAnswer({ playerId: 'p_spook' }),
      updatedPlayer: { id: 'p_spook', score: 999, correctCount: 9, correctResponseTimeMsTotal: 9000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    };
    await assert.doesNotReject(() => store.saveAcceptedAnswerAtomically('room_1', 'match_1', herhalingMetOnbekendeSpeler));

    assert.strictEqual(await store.loadPlayer('room_1', 'p_spook'), null, 'de onbekende speler uit de replay-write is nooit aangemaakt');
    const player = await store.loadPlayer('room_1', 'p_1');
    assert.strictEqual(player.score, 158, 'de echte staat blijft die van de eerste, geslaagde aanroep');
  });
});
