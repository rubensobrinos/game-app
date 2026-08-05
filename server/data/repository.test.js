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
  test('#3 DATA_STORE_METHOD_NAMES bevat 24 methoden (21 t/m DM10 + loadSessionByTokenHash uit DM14/§10 + rotateRoomLocators uit DM16/§9 + listActiveRoomIds uit C-3)', () => {
    // `listActiveRoomIds` erbij op 5 aug 2026: het herstelpad na een
    // serverherstart (ARCHITECTURE §10) moet weten wélke rooms het moet
    // oppakken. De index (`rooms:active`) bestond al; alleen het lezen ervan
    // ontbrak in de poort.
    assert.strictEqual(DATA_STORE_METHOD_NAMES.length, 24);
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

describe('loadRoomByCode/loadRoomByInviteHash — via een voorafgaande claim, geen hashing in de fake zelf #11-12', () => {
  test('#11 loadRoomByCode vindt dezelfde room als loadRoom, na een claim (DM17/INTB-9: saveRoom vult geen enkele lookup-index meer)', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '482917', inviteHash: 'hash_abc', ttlSeconds: 14400 });
    await store.saveRoom(makeRoom());
    assert.deepStrictEqual(await store.loadRoomByCode('482917'), await store.loadRoom('room_1'));
  });

  test('#12 loadRoomByInviteHash vindt dezelfde room als loadRoom, na een claim (DM17/INTB-9: saveRoom vult geen enkele lookup-index meer)', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '482917', inviteHash: 'hash_abc', ttlSeconds: 14400 });
    await store.saveRoom(makeRoom());
    assert.deepStrictEqual(await store.loadRoomByInviteHash('hash_abc'), await store.loadRoom('room_1'));
  });
});

describe('saveRoom — raakt de lookup-indexen nooit aan (DM17, reactie op INTB-9) #59-60', () => {
  test('#59 saveRoom zonder voorafgaande claim maakt de room via geen enkele code/inviteHash vindbaar (bedoeld gedrag, geen bug)', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom());
    assert.strictEqual(await store.loadRoomByCode('482917'), null);
    assert.strictEqual(await store.loadRoomByInviteHash('nope'), null);
    // Het roomdocument zelf bestaat wel — alleen de twee lookup-ingangen niet.
    assert.notStrictEqual(await store.loadRoom('room_1'), null);
  });

  test('#60 het letterlijke INTB-9-scenario is niet meer mogelijk: saveRoom kan een code niet stelen van de room die hem geclaimd heeft', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_a', code: '482917', inviteHash: 'hash_a', ttlSeconds: 14400 });
    // room_b probeert dezelfde code te "stelen" met alleen saveRoom, zonder
    // claim — dat mag nooit de lookup-index overschrijven.
    await store.saveRoom(makeRoom({ id: 'room_b', code: '482917', inviteId: 'invite_b' }));

    assert.deepStrictEqual(await store.loadRoomByCode('482917'), await store.loadRoom('room_a'), 'de code hoort nog steeds naar de eigenaar van de claim te wijzen, niet naar room_b');
    const stillOwnedByA = await store.claimRoomLocatorsAtomically({ roomId: 'room_c', code: '482917', inviteHash: 'hash_c', ttlSeconds: 14400 });
    assert.deepStrictEqual(stillOwnedByA, { ok: false, conflict: 'code' }, 'het claimregister is en blijft de bron van waarheid');
  });
});

describe('setRoomAndMatchPhaseAtomically — dubbele CAS + pausedState in dezelfde stap (DM19, reactie op INT-16) #13-15, #66-73', () => {
  test('#13 geslaagde aanroep werkt Room.phase én Match.phase bij naar dezelfde waarde', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom({ phase: 'ROUND_ACTIVE' }));
    await store.saveMatch(makeMatch());
    const result = await store.setRoomAndMatchPhaseAtomically('room_1', 'match_1', {
      expectedPhase: 'ROUND_ACTIVE', newPhase: 'SCOREBOARD', pausedState: null,
    });
    assert.deepStrictEqual(result, { ok: true });
    assert.strictEqual((await store.loadRoom('room_1')).phase, 'SCOREBOARD');
    assert.strictEqual((await store.loadMatch('room_1', 'match_1')).phase, 'SCOREBOARD');
  });

  test('#14 niet-bestaande matchId -> throw, Room.phase blijft ongewijzigd', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom({ phase: 'LOBBY' }));
    await assert.rejects(() => store.setRoomAndMatchPhaseAtomically('room_1', 'nope', {
      expectedPhase: 'LOBBY', newPhase: 'SCOREBOARD', pausedState: null,
    }));
    assert.strictEqual((await store.loadRoom('room_1')).phase, 'LOBBY');
  });

  test('#15 niet-bestaande roomId -> throw', async () => {
    const store = createInMemoryStore();
    await assert.rejects(() => store.setRoomAndMatchPhaseAtomically('nope', 'match_1', {
      expectedPhase: 'LOBBY', newPhase: 'SCOREBOARD', pausedState: null,
    }));
  });

  test('#66 dubbele CAS: Match.phase wijkt af van expectedPhase -> { ok: false, actualPhase }, niets geschreven', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom({ phase: 'ROUND_ACTIVE' }));
    await store.saveMatch(makeMatch({ phase: 'ROUND_ACTIVE' }));
    const result = await store.setRoomAndMatchPhaseAtomically('room_1', 'match_1', {
      expectedPhase: 'SCOREBOARD', newPhase: 'FINISHED', pausedState: null,
    });
    assert.deepStrictEqual(result, { ok: false, actualPhase: 'ROUND_ACTIVE' });
    assert.strictEqual((await store.loadRoom('room_1')).phase, 'ROUND_ACTIVE');
    assert.strictEqual((await store.loadMatch('room_1', 'match_1')).phase, 'ROUND_ACTIVE');
  });

  test('#67 dubbele CAS: Room.phase wijkt af terwijl Match.phase wél overeenkomt -> ook dan { ok: false }, want de check geldt voor BEIDE (niet alleen Match.phase)', async () => {
    const store = createInMemoryStore();
    // Bewust geconstrueerde drift tussen Room.phase en Match.phase — kan in een
    // correcte flow niet ontstaan (deze operatie is de enige schrijver), maar de
    // dubbele CAS moet hem zelf ook vangen, niet enkel op Match.phase vertrouwen.
    await store.saveRoom(makeRoom({ phase: 'LOBBY' }));
    await store.saveMatch(makeMatch({ phase: 'ROUND_ACTIVE' }));
    const result = await store.setRoomAndMatchPhaseAtomically('room_1', 'match_1', {
      expectedPhase: 'ROUND_ACTIVE', newPhase: 'SCOREBOARD', pausedState: null,
    });
    assert.deepStrictEqual(result, { ok: false, actualPhase: 'ROUND_ACTIVE' }, 'actualPhase is altijd Match.phase (besluit 30: autoritair)');
    assert.strictEqual((await store.loadRoom('room_1')).phase, 'LOBBY', 'niets geschreven bij een conflict');
  });

  test('#68 newPhase "PAUSED" met pausedState: null -> throw, geen mutatie', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom({ phase: 'ROUND_ACTIVE' }));
    await store.saveMatch(makeMatch({ phase: 'ROUND_ACTIVE' }));
    await assert.rejects(() => store.setRoomAndMatchPhaseAtomically('room_1', 'match_1', {
      expectedPhase: 'ROUND_ACTIVE', newPhase: 'PAUSED', pausedState: null,
    }), RangeError);
    assert.strictEqual((await store.loadMatch('room_1', 'match_1')).phase, 'ROUND_ACTIVE');
  });

  test('#69 newPhase anders dan "PAUSED" mét een pausedState -> throw, geen mutatie (de andere richting van de invariant)', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom({ phase: 'ROUND_ACTIVE' }));
    await store.saveMatch(makeMatch({ phase: 'ROUND_ACTIVE' }));
    await assert.rejects(() => store.setRoomAndMatchPhaseAtomically('room_1', 'match_1', {
      expectedPhase: 'ROUND_ACTIVE',
      newPhase: 'SCOREBOARD',
      pausedState: { previousPhase: 'ROUND_ACTIVE', remainingMs: 5000, reason: 'host_pause', pausedAt: 2000 },
    }), RangeError);
    assert.strictEqual((await store.loadMatch('room_1', 'match_1')).phase, 'ROUND_ACTIVE');
  });

  test('#70 de invariant-check gaat vóór de dubbele CAS: een ongeldige combinatie werpt ook als expectedPhase toch al niet klopt', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom({ phase: 'LOBBY' }));
    await store.saveMatch(makeMatch({ phase: 'LOBBY' }));
    // expectedPhase klopt hier ook al niet (echte fase is LOBBY) — de test
    // bewijst dat de throw voorrang heeft op het conflict-resultaatobject.
    await assert.rejects(() => store.setRoomAndMatchPhaseAtomically('room_1', 'match_1', {
      expectedPhase: 'ROUND_ACTIVE', newPhase: 'PAUSED', pausedState: null,
    }), RangeError);
  });

  test('#71 geslaagde overgang NAAR PAUSED zet pausedState mee in dezelfde atomaire stap', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom({ phase: 'ROUND_ACTIVE' }));
    await store.saveMatch(makeMatch({ phase: 'ROUND_ACTIVE' }));
    const pausedState = { previousPhase: 'ROUND_ACTIVE', remainingMs: 7000, reason: 'host_pause', pausedAt: 3000 };
    const result = await store.setRoomAndMatchPhaseAtomically('room_1', 'match_1', {
      expectedPhase: 'ROUND_ACTIVE', newPhase: 'PAUSED', pausedState,
    });
    assert.deepStrictEqual(result, { ok: true });
    assert.strictEqual((await store.loadRoom('room_1')).phase, 'PAUSED');
    const match = await store.loadMatch('room_1', 'match_1');
    assert.strictEqual(match.phase, 'PAUSED');
    assert.deepStrictEqual(match.pausedState, pausedState);
  });

  test('#72 geslaagde overgang UIT PAUSED zet pausedState terug naar null', async () => {
    const store = createInMemoryStore();
    const pausedState = { previousPhase: 'ROUND_ACTIVE', remainingMs: 7000, reason: 'host_pause', pausedAt: 3000 };
    await store.saveRoom(makeRoom({ phase: 'PAUSED' }));
    await store.saveMatch(makeMatch({ phase: 'PAUSED', pausedState }));
    const result = await store.setRoomAndMatchPhaseAtomically('room_1', 'match_1', {
      expectedPhase: 'PAUSED', newPhase: 'ROUND_ACTIVE', pausedState: null,
    });
    assert.deepStrictEqual(result, { ok: true });
    assert.strictEqual((await store.loadMatch('room_1', 'match_1')).pausedState, null);
  });

  test('#73 vóór DM19 vereiste een pauze twee schrijfacties (saveMatch + de fasewissel) — dat niet-atomaire pad bestaat nu niet meer: een conflict tijdens het pauzeren laat geen half pausedState achter', async () => {
    const store = createInMemoryStore();
    await store.saveRoom(makeRoom({ phase: 'ROUND_ACTIVE' }));
    await store.saveMatch(makeMatch({ phase: 'ROUND_ACTIVE' }));
    // Iemand anders heeft de fase ondertussen al gewijzigd — de pauzepoging
    // met een verouderde expectedPhase mag geen spoor achterlaten.
    await store.setRoomAndMatchPhaseAtomically('room_1', 'match_1', {
      expectedPhase: 'ROUND_ACTIVE', newPhase: 'ROUND_RESULT', pausedState: null,
    });
    const result = await store.setRoomAndMatchPhaseAtomically('room_1', 'match_1', {
      expectedPhase: 'ROUND_ACTIVE',
      newPhase: 'PAUSED',
      pausedState: { previousPhase: 'ROUND_ACTIVE', remainingMs: 1000, reason: 'host_pause', pausedAt: 4000 },
    });
    assert.deepStrictEqual(result, { ok: false, actualPhase: 'ROUND_RESULT' });
    assert.strictEqual((await store.loadMatch('room_1', 'match_1')).pausedState, null, 'geen half pausedState na een afgewezen pauzepoging');
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

describe('sessionsByKey/playersByKey — geneste Maps in plaats van samengestelde string-sleutels (DM18, §7-opvolging) #64-65', () => {
  test('#64 sessie-identifiers met een spatie erin botsen niet', async () => {
    const store = createInMemoryStore();
    await store.saveSession(makeSession({ id: '1 sess', roomId: 'room 1', tokenHash: 'hash_a' }));
    await store.saveSession(makeSession({ id: '1 1 sess', roomId: 'room', tokenHash: 'hash_b' }));

    assert.strictEqual((await store.loadSession('room 1', '1 sess')).roomId, 'room 1');
    assert.strictEqual((await store.loadSession('room', '1 1 sess')).roomId, 'room');
    assert.strictEqual(await store.loadSession('room 1', '1 1 sess'), null);
    assert.strictEqual(await store.loadSession('room', '1 sess'), null);
  });

  test('#65 speler-identifiers met een spatie erin botsen niet, ook niet via listPlayers', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer({ id: '1 p', roomId: 'room 1' }));
    await store.savePlayer(makePlayer({ id: '1 1 p', roomId: 'room' }));

    assert.strictEqual((await store.loadPlayer('room 1', '1 p')).roomId, 'room 1');
    assert.strictEqual(await store.loadPlayer('room 1', '1 1 p'), null);
    assert.strictEqual(await store.loadPlayer('room', '1 p'), null);

    const inRoom1 = await store.listPlayers('room 1');
    assert.strictEqual(inRoom1.length, 1);
    assert.strictEqual(inRoom1[0].id, '1 p');
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

describe('loadSessionByTokenHash — DM14, §10, reactie op INT-3 #44-47', () => {
  test('#44 vindt dezelfde sessie als loadSession, rechtstreeks na saveSession (geen aparte claim nodig, in tegenstelling tot inviteHash)', async () => {
    const store = createInMemoryStore();
    const session = makeSession({ tokenHash: 'hash_tok_1' });
    await store.saveSession(session);
    assert.deepStrictEqual(await store.loadSessionByTokenHash('hash_tok_1'), session);
  });

  test('#45 een onbekende tokenHash geeft null, geen throw', async () => {
    const store = createInMemoryStore();
    assert.strictEqual(await store.loadSessionByTokenHash('nope'), null);
  });

  test('#46 een herroepen sessie blijft vindbaar via de tokenHash (de aanroeper moet TOKEN_INVALID en SESSION_REVOKED uit elkaar kunnen houden)', async () => {
    const store = createInMemoryStore();
    const session = makeSession({ tokenHash: 'hash_tok_1', revoked: true });
    await store.saveSession(session);
    const found = await store.loadSessionByTokenHash('hash_tok_1');
    assert.notStrictEqual(found, null);
    assert.strictEqual(found.revoked, true);
  });

  test('#47 twee sessies in verschillende rooms met een eigen tokenHash lekken niet naar elkaar', async () => {
    const store = createInMemoryStore();
    const inA = makeSession({ id: 'sess_a', roomId: 'room_a', tokenHash: 'hash_a' });
    const inB = makeSession({ id: 'sess_b', roomId: 'room_b', tokenHash: 'hash_b' });
    await store.saveSession(inA);
    await store.saveSession(inB);
    assert.deepStrictEqual(await store.loadSessionByTokenHash('hash_a'), inA);
    assert.deepStrictEqual(await store.loadSessionByTokenHash('hash_b'), inB);
  });
});

describe('saveSession — tokenrotatie geeft de oude tokenHash-index vrij (DM17, reactie op INTB-10 Deel B) #61-63', () => {
  test('#61 een sessie die een nieuwe tokenHash krijgt: de oude tokenHash is daarna onvindbaar, de nieuwe wel', async () => {
    const store = createInMemoryStore();
    const session = makeSession({ tokenHash: 'hash_oud' });
    await store.saveSession(session);
    await store.saveSession({ ...session, tokenHash: 'hash_nieuw' });

    assert.strictEqual(await store.loadSessionByTokenHash('hash_oud'), null, 'de oude tokenHash mag geen tweede geldige capability blijven — dit is letterlijk INTB-5 voor sessies');
    const found = await store.loadSessionByTokenHash('hash_nieuw');
    assert.notStrictEqual(found, null);
    assert.strictEqual(found.tokenHash, 'hash_nieuw');
  });

  test('#62 saveSession met een ONGEWIJZIGDE tokenHash blijft gewoon vindbaar (geen onnodige vrijgave)', async () => {
    const store = createInMemoryStore();
    const session = makeSession({ tokenHash: 'hash_1' });
    await store.saveSession(session);
    await store.saveSession({ ...session, lastSeenAt: 5000 }); // zelfde tokenHash, ander veld
    assert.notStrictEqual(await store.loadSessionByTokenHash('hash_1'), null);
  });

  test('#63 de allereerste saveSession voor een sessie-id heeft geen "vorige" tokenHash om vrij te geven (geen crash op een lege store)', async () => {
    const store = createInMemoryStore();
    await assert.doesNotReject(() => store.saveSession(makeSession({ tokenHash: 'hash_1' })));
    assert.notStrictEqual(await store.loadSessionByTokenHash('hash_1'), null);
  });
});

describe('saveAcceptedAnswerAtomically — returnwaarde { replay: boolean } (DM15, reactie op INT-14) #48-50', () => {
  test('#48 een geslaagde, nieuwe write levert { replay: false } op', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer());
    const result = await store.saveAcceptedAnswerAtomically('room_1', 'match_1', {
      answer: makeAnswer(),
      updatedPlayer: { id: 'p_1', score: 158, correctCount: 1, correctResponseTimeMsTotal: 1000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    });
    assert.deepStrictEqual(result, { replay: false });
  });

  test('#49 een replay (dezelfde actionId opnieuw) levert { replay: true } op', async () => {
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer());
    const write = {
      answer: makeAnswer(),
      updatedPlayer: { id: 'p_1', score: 158, correctCount: 1, correctResponseTimeMsTotal: 1000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    };
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', write);
    const result = await store.saveAcceptedAnswerAtomically('room_1', 'match_1', write);
    assert.deepStrictEqual(result, { replay: true });
  });

  test('#50 het INT-14-scenario: een replay ná de "deadline" levert nog steeds { replay: true } op — deze operatie kent geen deadline, dus dat gat kan hier niet meer optreden', async () => {
    // Deze operatie controleert nooit op tijd — het reconnect/deadline-gat uit
    // INT-14 zat in de aanroeper (answer-flow.js's stap 4 loopt vóór deze
    // operatie ooit bereikt wordt), niet hier. Deze test bewijst alleen dat
    // saveAcceptedAnswerAtomically zelf, geïsoleerd, altijd het correcte
    // replay-signaal geeft — hoe laat de aanroep ook komt.
    const store = createInMemoryStore();
    await store.savePlayer(makePlayer());
    const write = {
      answer: makeAnswer(),
      updatedPlayer: { id: 'p_1', score: 158, correctCount: 1, correctResponseTimeMsTotal: 1000 },
      actionCacheEntry: { actionId: 'act_1', ack: { roundId: 'round_1' } },
    };
    await store.saveAcceptedAnswerAtomically('room_1', 'match_1', write);
    const muchLaterResult = await store.saveAcceptedAnswerAtomically('room_1', 'match_1', write);
    assert.deepStrictEqual(muchLaterResult, { replay: true });
  });
});

describe('rotateRoomLocators — DM16, §9, reactie op INTB-5 🔴 #51-58', () => {
  test('#51 rotatie van zowel code als inviteHash slaagt: nieuwe locators werken, oude niet meer', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    const result = await store.rotateRoomLocators({
      roomId: 'room_1', oldCode: '111111', oldInviteHash: 'hash_1',
      newCode: '222222', newInviteHash: 'hash_2', ttlSeconds: 14400,
    });
    assert.deepStrictEqual(result, { ok: true });

    // Reproductie uit INTB-5, nu met het omgekeerde verwachte resultaat.
    const viaOldCode = await store.claimRoomLocatorsAtomically({ roomId: 'room_2', code: '111111', inviteHash: 'hash_x', ttlSeconds: 14400 });
    assert.deepStrictEqual(viaOldCode, { ok: true }, 'de oude code moet na rotatie weer vrij zijn voor een andere room');
    const viaNewCode = await store.claimRoomLocatorsAtomically({ roomId: 'room_3', code: '222222', inviteHash: 'hash_y', ttlSeconds: 14400 });
    assert.deepStrictEqual(viaNewCode, { ok: false, conflict: 'code' }, 'de nieuwe code hoort nu aan room_1');
  });

  test('#52 conflict op de nieuwe code (bezet door een andere roomId): veilige no-op, oude locators blijven geldig', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    await store.claimRoomLocatorsAtomically({ roomId: 'room_2', code: '222222', inviteHash: 'hash_2', ttlSeconds: 14400 });

    const result = await store.rotateRoomLocators({
      roomId: 'room_1', oldCode: '111111', oldInviteHash: 'hash_1',
      newCode: '222222', newInviteHash: 'hash_new', ttlSeconds: 14400,
    });
    assert.deepStrictEqual(result, { ok: false, conflict: 'code' });

    // Niets veranderd: room_1 bezit de oude locators nog steeds.
    const reclaim = await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    assert.deepStrictEqual(reclaim, { ok: true }, 'idempotente herclaim bewijst dat room_1 de oude locators nog bezit');
  });

  test('#53 conflict op de nieuwe inviteHash (bezet door een andere roomId): veilige no-op, ook de code-kant blijft ongewijzigd', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    await store.claimRoomLocatorsAtomically({ roomId: 'room_2', code: '222222', inviteHash: 'hash_2', ttlSeconds: 14400 });

    const result = await store.rotateRoomLocators({
      roomId: 'room_1', oldCode: '111111', oldInviteHash: 'hash_1',
      newCode: '333333', newInviteHash: 'hash_2', ttlSeconds: 14400,
    });
    assert.deepStrictEqual(result, { ok: false, conflict: 'inviteHash' });

    const newCodeStillFree = await store.claimRoomLocatorsAtomically({ roomId: 'room_3', code: '333333', inviteHash: 'hash_3', ttlSeconds: 14400 });
    assert.deepStrictEqual(newCodeStillFree, { ok: true }, 'newCode is nooit gezet: de rotatie deed niets, ook niet gedeeltelijk');
  });

  test('#54 alleen de inviteHash roteert, de code blijft gelijk: geen conflict met de eigen, ongewijzigde code', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    const result = await store.rotateRoomLocators({
      roomId: 'room_1', oldCode: '111111', oldInviteHash: 'hash_1',
      newCode: '111111', newInviteHash: 'hash_2', ttlSeconds: 14400,
    });
    assert.deepStrictEqual(result, { ok: true });

    const viaOldInvite = await store.claimRoomLocatorsAtomically({ roomId: 'room_2', code: 'x', inviteHash: 'hash_1', ttlSeconds: 14400 });
    assert.deepStrictEqual(viaOldInvite, { ok: true }, 'de oude inviteHash moet vrij zijn');
  });

  test('#55 roomId bezit oldCode niet (meer): werpt RangeError, geen enkele write', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    await assert.rejects(
      () => store.rotateRoomLocators({
        roomId: 'room_2', oldCode: '111111', oldInviteHash: 'hash_1',
        newCode: '222222', newInviteHash: 'hash_2', ttlSeconds: 14400,
      }),
      RangeError
    );
  });

  test('#56 roomId bezit oldInviteHash niet (meer): werpt RangeError, geen enkele write', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    await assert.rejects(
      () => store.rotateRoomLocators({
        roomId: 'room_1', oldCode: '111111', oldInviteHash: 'hash_ander',
        newCode: '222222', newInviteHash: 'hash_2', ttlSeconds: 14400,
      }),
      RangeError
    );
    // De code-kant is niet aangeraakt, ondanks dat die check wel slaagde.
    const stillOwned = await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    assert.deepStrictEqual(stillOwned, { ok: true });
  });

  test('#57 na een geslaagde rotatie is de room via loadRoomByCode/loadRoomByInviteHash vindbaar op de nieuwe locators (eerst rotateRoomLocators, dan saveRoom — zelfde volgorde als bij creatie)', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'hash_1', ttlSeconds: 14400 });
    await store.saveRoom(makeRoom({ code: '111111' }));

    await store.rotateRoomLocators({
      roomId: 'room_1', oldCode: '111111', oldInviteHash: 'hash_1',
      newCode: '222222', newInviteHash: 'hash_2', ttlSeconds: 14400,
    });
    await store.saveRoom(makeRoom({ code: '222222' }));

    assert.strictEqual(await store.loadRoomByCode('111111'), null, 'de OUDE code hoort na rotatie niet meer te werken — dit is precies wat INTB-5 repareert');
    assert.deepStrictEqual(await store.loadRoomByCode('222222'), await store.loadRoom('room_1'));
    assert.deepStrictEqual(await store.loadRoomByInviteHash('hash_2'), await store.loadRoom('room_1'));
  });

  test('#58 het letterlijke INTB-5-scenario met rotateRoomLocators erbij: de oude code wijst nergens meer naartoe', async () => {
    const store = createInMemoryStore();
    await store.claimRoomLocatorsAtomically({ roomId: 'room_1', code: '111111', inviteHash: 'INV-AAA', ttlSeconds: 14400 });
    await store.saveRoom(makeRoom({ code: '111111', inviteId: 'INV-AAA' }));

    const result = await store.rotateRoomLocators({
      roomId: 'room_1', oldCode: '111111', oldInviteHash: 'INV-AAA',
      newCode: '222222', newInviteHash: 'INV-BBB', ttlSeconds: 14400,
    });
    assert.deepStrictEqual(result, { ok: true });
    await store.saveRoom(makeRoom({ code: '222222', inviteId: 'INV-BBB' }));

    assert.strictEqual(await store.loadRoomByCode('111111'), null);
    assert.strictEqual(await store.loadRoomByInviteHash('INV-AAA'), null);
  });
});
