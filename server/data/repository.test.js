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
  test('#3 DATA_STORE_METHOD_NAMES bevat 18 methoden (17 uit de prompt + loadAnswer)', () => {
    assert.strictEqual(DATA_STORE_METHOD_NAMES.length, 18);
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
    await store.saveRound(round);
    assert.deepStrictEqual(await store.loadRound('room_1', 'match_1', 'round_1'), round);
  });

  test('#10 onbekende ids geven null, geen throw', async () => {
    const store = createInMemoryStore();
    assert.strictEqual(await store.loadRoom('nope'), null);
    assert.strictEqual(await store.loadSession('room_1', 'nope'), null);
    assert.strictEqual(await store.loadPlayer('room_1', 'nope'), null);
    assert.strictEqual(await store.loadMatch('room_1', 'nope'), null);
    assert.strictEqual(await store.loadRound('room_1', 'match_1', 'nope'), null);
    assert.strictEqual(await store.loadAnswer('round_1', 'nope'), null);
  });
});

describe('loadRoomByCode/loadRoomByInviteId — rechtstreeks op het veld, geen hashing #11-12', () => {
  test('#11 loadRoomByCode vindt dezelfde room als loadRoom', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom());
    assert.deepStrictEqual(await store.loadRoomByCode('482917'), await store.loadRoom('room_1'));
  });

  test('#12 loadRoomByInviteId vindt dezelfde room als loadRoom', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom());
    assert.deepStrictEqual(await store.loadRoomByInviteId('invite_abc'), await store.loadRoom('room_1'));
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

    assert.deepStrictEqual(await store.loadAnswer('round_1', 'p_1'), write.answer);
    const player = await store.loadPlayer('room_1', 'p_1');
    assert.strictEqual(player.score, 158);
    assert.strictEqual(player.correctCount, 1);
    assert.strictEqual(player.correctResponseTimeMsTotal, 1000);
    assert.deepStrictEqual(await store.getScoreboardTop('room_1', 'match_1', 10), [{ playerId: 'p_1', score: 158 }]);
    assert.deepStrictEqual(await store.loadActionCacheEntry('act_1'), write.actionCacheEntry);
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

    assert.strictEqual(await store.loadAnswer('round_1', 'p_1'), null);
    assert.deepStrictEqual(await store.getScoreboardTop('room_1', 'match_1', 10), []);
    assert.strictEqual(await store.loadActionCacheEntry('act_1'), null);
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
    assert.strictEqual(await store.loadActionCacheEntry('nope'), null);
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
});
