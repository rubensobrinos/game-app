// Keten-tests voor de match-/ronde-/antwoordcompositie.
//
// Dekking van docs/deployment-and-testing-plan/integration-matrix.md: de
// testnamen beginnen met "matrixrij N" voor de rijen 7, 9, 12 en 14. De overige
// tests dekken de randgevallen die die rijen onderbouwen (deadline-grace,
// fout antwoord, host-tempo, pauze/hervat).
//
// GEEN ENKELE TEST HANGT VAN DE ECHTE KLOK AF: `now` is een geïnjecteerde,
// handmatig verzette klok en elke tijdstempel wordt daartegen gecontroleerd.
// Ook `Math.random` wordt nergens gebruikt: de contentbron krijgt een seeded
// PRNG via de context.

import test from 'node:test';
import assert from 'node:assert/strict';

import { generateGameCode, generateInviteId, hashInviteId } from '../architecture/room-codes.js';
import { createInMemoryStore } from '../data/in-memory-store.js';
import { ROOM_TTL_SECONDS } from '../data/ttl.js';
import { assertMatchShape } from '../data/types/match.js';
import { assertPlayerShape } from '../data/types/player.js';
import { assertRoomShape } from '../data/types/room.js';
import { assertRoundShape } from '../data/types/round.js';
import { assertSessionShape } from '../data/types/session.js';
import { validateRoundStartedPayload } from '../protocol/server-events-round-lifecycle.mjs';
import { validateRoundEndedPayload } from '../protocol/server-events-scoring.mjs';
import { assertNoActiveRoundAnswerLeak, validateSnapshotShape } from '../protocol/snapshot-shape.mjs';
import { ALL_ERROR_CODES } from '../protocol/error-codes.mjs';
import { createContext, createId, createSessionToken } from './context.mjs';
import { joinRoom, resolveGameConfiguration } from './room-lifecycle.mjs';
import {
  advancePhase,
  buildSnapshot,
  COUNTDOWN_SECONDS,
  endRound,
  finishMatch,
  getScoreboard,
  CONTENT_UNAVAILABLE,
  PHASE_RACE_LOST,
  rematch,
  recoverActiveRooms,
  resolveEligibleFromRound,
  resolveNextPhase,
  startMatch,
  startRound,
  submitAnswer,
} from './match-lifecycle.mjs';

const FIXED_NOW = 1_754_136_000_000;
const PEPPER = 'test-pepper-met-ruim-genoeg-bytes';
/** `context.mjs` verwacht sinds de pepperrotatie een bundel { version, peppers }. */
const TOKEN_PEPPERS = Object.freeze({ version: 'v1', peppers: Object.freeze({ v1: PEPPER }) });
const APP_URL = 'https://play.aseso.nl';
const CONTENT_VERSION = 'stub-content-1';
const RENDERER_VERSION = 'stub-renderer-7';

/** Deterministische PRNG (mulberry32) — geen Math.random in de tests. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Handmatig verzette klok; `now()` leest hem, niets anders. */
function makeClock(start = FIXED_NOW) {
  const clock = {
    value: start,
    now: () => clock.value,
    set(value) {
      clock.value = value;
      return clock.value;
    },
    advance(ms) {
      clock.value += ms;
      return clock.value;
    },
  };
  return clock;
}

function makeHarness({ config = {}, seed = 42 } = {}) {
  const clock = makeClock();
  const store = createInMemoryStore();
  const context = createContext({
    store,
    now: clock.now,
    config: {
      tokenPeppers: TOKEN_PEPPERS,
      publicAppUrl: APP_URL,
      contentVersion: CONTENT_VERSION,
      rendererVersion: RENDERER_VERSION,
      random: seededRandom(seed),
      ...config,
    },
  });
  return { clock, store, context };
}

/**
 * TIJDELIJKE FIXTURE — vervangt `room-lifecycle.createRoom()`.
 *
 * DM10/DM11 hebben de poort hernoemd (`loadRoomByInviteId` →
 * `loadRoomByInviteHash`, plus `claimRoomLocatorsAtomically`) terwijl
 * `server/composition/room-lifecycle.mjs` nog op de oude naam staat.
 * `createRoom()` werpt daardoor `TypeError: context.store.loadRoomByInviteId
 * is not a function`. Dat bestand valt buiten deze opdracht (zie het
 * handoff-item), dus de room wordt hier via de HUIDIGE poort opgebouwd — met
 * dezelfde modules die `createRoom()` gebruikt (`room-codes.js`, `context.mjs`,
 * `resolveGameConfiguration`) en met de shape-assertions van de eigenaar als
 * keuring. Zodra `createRoom()` weer werkt, vervangt één aanroep deze functie.
 *
 * De JOINERS lopen wél via de échte `room-lifecycle.joinRoom()` — dat pad
 * (`loadRoomByCode`) is ongebroken, en matrixrij 9 heeft die integratie nodig.
 */
async function seedRoom(harness, { extraPlayers = 2, roomConfig = {}, hostParticipates = true } = {}) {
  const { context, store } = harness;
  const config = resolveGameConfiguration(roomConfig);
  const roomId = createId(context, 'room');
  const sessionId = createId(context, 'sess');
  const code = generateGameCode();
  const inviteId = generateInviteId();
  const { version, peppers } = context.config.tokenPeppers;
  const inviteHash = hashInviteId(inviteId, peppers[version]);
  const createdAt = context.now();

  const claim = await store.claimRoomLocatorsAtomically({ roomId, code, inviteHash, ttlSeconds: ROOM_TTL_SECONDS });
  assert.deepEqual(claim, { ok: true });

  const room = {
    id: roomId,
    code,
    inviteId,
    phase: 'LOBBY',
    createdAt,
    lastActivityAt: createdAt,
    hostSessionIds: [sessionId],
    locked: false,
    config,
    currentMatchId: null,
  };
  assertRoomShape(room);
  await store.saveRoom(room);

  const players = [];
  let hostPlayerId = null;
  if (hostParticipates) {
    hostPlayerId = createId(context, 'p');
    const hostPlayer = {
      id: hostPlayerId,
      roomId,
      sessionId,
      displayName: 'Host',
      generatedName: 'Host',
      effectiveName: 'Host',
      nameSource: 'chosen',
      teamId: null,
      score: 0,
      correctCount: 0,
      correctResponseTimeMsTotal: 0,
      connected: false,
      eligibleFromRound: 1,
      joinedAt: createdAt,
      left: false,
      kicked: false,
    };
    assertPlayerShape(hostPlayer);
    await store.savePlayer(hostPlayer);
    players.push({ playerId: hostPlayerId, name: 'Host', sessionId });
  }

  const { tokenHash } = createSessionToken(context);
  const session = {
    id: sessionId,
    roomId,
    roles: hostParticipates ? ['host', 'player'] : ['host'],
    playerId: hostPlayerId,
    tokenHash,
    createdAt,
    lastSeenAt: createdAt,
    connectedSocketIds: [],
    revoked: false,
  };
  assertSessionShape(session);
  await store.saveSession(session);

  for (let index = 0; index < extraPlayers; index += 1) {
    const joined = await joinRoom(context, {
      gameCode: code,
      displayName: `Speler${index + 1}`,
      joinSource: 'code',
    });
    assert.equal(joined.ok, true, JSON.stringify(joined));
    players.push({ playerId: joined.value.playerId, name: joined.value.effectiveName, sessionId: joined.value.sessionId });
  }

  return { room: { roomId, gameCode: code, inviteId, sessionId }, roomId, players };
}

/** Het Round-document uit de store — inclusief `correctAnswer`. */
async function loadRoundDoc(harness, roomId, matchId, roundId) {
  const round = await harness.store.loadRound(roomId, matchId, roundId);
  assert.notEqual(round, null);
  assertRoundShape(round);
  return round;
}

/** Een fout optionId dat wél in validOptionIds zit (dus geldig van vorm). */
function wrongOptionId(round) {
  const wrong = round.validOptionIds.find((id) => id !== round.correctAnswer.optionId);
  assert.equal(typeof wrong, 'string');
  return wrong;
}

/**
 * Speelt één volledige ronde: countdown-afloop → ronde → antwoorden → uitslag
 * → (tussenstand) → volgende fase. `answerFor` bepaalt per speler wat er wordt
 * ingestuurd; `undefined` betekent "geeft geen antwoord".
 */
async function playRound(harness, { roomId, matchId, players, answerFor, answerDelayMs = 1000 }) {
  const { context, clock } = harness;

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const started = await startRound(context, { roomId });
  assert.equal(started.ok, true, JSON.stringify(started));
  const round = await loadRoundDoc(harness, roomId, matchId, started.value.roundId);

  clock.advance(answerDelayMs);
  const acks = new Map();
  for (const player of players) {
    const answer = answerFor === undefined ? undefined : answerFor(player, round);
    if (answer === undefined) {
      continue;
    }
    const result = await submitAnswer(context, {
      roomId,
      playerId: player.playerId,
      roundId: round.id,
      answer,
      actionId: `act_${round.id}_${player.playerId}`,
      clientAnsweredAt: clock.value - 5,
    });
    acks.set(player.playerId, result);
  }

  clock.set(round.endsAt);
  const ended = await endRound(context, { roomId });
  assert.equal(ended.ok, true, JSON.stringify(ended));

  return { started: started.value, round, ended: ended.value, acks };
}

/** Loopt van ROUND_RESULT via de tussenstand naar de volgende fase. */
async function leaveResultPhase(harness, roomId, roomConfig) {
  const { context, clock } = harness;
  clock.advance(roomConfig.resultSeconds * 1000);
  const afterResult = await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } });
  assert.equal(afterResult.ok, true, JSON.stringify(afterResult));
  if (afterResult.value.phase !== 'SCOREBOARD') {
    return afterResult.value;
  }
  clock.advance(roomConfig.scoreboardSeconds * 1000);
  const afterScoreboard = await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } });
  assert.equal(afterScoreboard.ok, true, JSON.stringify(afterScoreboard));
  return afterScoreboard.value;
}

/**
 * Recursieve zoektocht naar `correctAnswer`: elke sleutelnaam op elk niveau,
 * plus de string in elke tekstwaarde. Matrixrij 14 eist expliciet een diepe
 * zoektocht, geen oppervlakkige veldcheck.
 */
function findCorrectAnswerPaths(value, path = '$') {
  const hits = [];
  if (typeof value === 'string') {
    if (value.includes('correctAnswer')) {
      hits.push(`${path} (stringwaarde)`);
    }
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((element, index) => hits.push(...findCorrectAnswerPaths(element, `${path}[${index}]`)));
    return hits;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key.toLowerCase().includes('correctanswer')) {
        hits.push(`${path}.${key} (sleutel)`);
      }
      hits.push(...findCorrectAnswerPaths(child, `${path}.${key}`));
    }
  }
  return hits;
}

/** Zoekt recursief naar een knoop die deep-equal is aan `needle`. */
function findDeepEqualPaths(value, needle, path = '$') {
  const hits = [];
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    try {
      assert.deepEqual(value, needle);
      hits.push(path);
    } catch {
      // geen match op dit niveau
    }
  }
  if (Array.isArray(value)) {
    value.forEach((element, index) => hits.push(...findDeepEqualPaths(element, needle, `${path}[${index}]`)));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      hits.push(...findDeepEqualPaths(child, needle, `${path}.${key}`));
    }
  }
  return hits;
}

// ─── Matrixrij 7 — volledige matchcyclus inclusief rematch ──────────────────

test('matrixrij 7: volledige matchcyclus — start, 10 rondes flags_mc, eindstand, rematch', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 2 });

  const room = await store.loadRoom(roomId);
  const roomConfig = room.config;
  assert.deepEqual(roomConfig.gameTypes, ['flags_mc']); // besluit 35
  assert.equal(roomConfig.totalRounds, 10);

  const started = await startMatch(context, { roomId });
  assert.equal(started.ok, true, JSON.stringify(started));
  assert.equal(started.value.phase, 'COUNTDOWN');
  assert.equal(started.value.countdownEndsAt, FIXED_NOW + COUNTDOWN_SECONDS * 1000);
  assert.equal(started.value.playerCount, 3);
  const matchId = started.value.matchId;

  // Besluit 21 + 32: gepinde versies en één gameType op het Match-document.
  const matchDoc = await store.loadMatch(roomId, matchId);
  assertMatchShape(matchDoc);
  assert.equal(matchDoc.contentVersion, CONTENT_VERSION);
  assert.equal(matchDoc.rendererVersion, RENDERER_VERSION);
  assert.equal(matchDoc.gameType, 'flags_mc');
  assert.equal(matchDoc.sequence, 1);

  // Besluit 30: Room.phase is de projectie van de autoritaire Match.phase.
  assert.equal((await store.loadRoom(roomId)).phase, 'COUNTDOWN');

  const usedQuestionKeys = [];
  for (let roundNumber = 1; roundNumber <= roomConfig.totalRounds; roundNumber += 1) {
    const played = await playRound(harness, {
      roomId,
      matchId,
      players,
      // Speler 1 altijd goed, speler 2 altijd fout, speler 3 antwoordt niet.
      answerFor: (player, round) => {
        if (player.playerId === players[0].playerId) return { optionId: round.correctAnswer.optionId };
        if (player.playerId === players[1].playerId) return { optionId: wrongOptionId(round) };
        return undefined;
      },
    });

    assert.equal(played.started.roundNumber, roundNumber);
    assert.equal(played.started.totalRounds, 10);
    assert.equal(played.ended.answeredCount, 2);
    assert.equal(played.ended.eligiblePlayerCount, 3);
    assert.equal(usedQuestionKeys.includes(played.round.questionKey), false, 'geen dubbele vraag binnen één match');
    usedQuestionKeys.push(played.round.questionKey);

    const next = await leaveResultPhase(harness, roomId, roomConfig);
    if (roundNumber < roomConfig.totalRounds) {
      assert.equal(next.phase, 'COUNTDOWN');
      assert.equal(next.roundNumber, roundNumber + 1);
    } else {
      assert.equal(next.phase, 'FINISHED');
    }
  }

  assert.equal(usedQuestionKeys.length, 10);
  assert.equal(new Set(usedQuestionKeys).size, 10);

  const finished = await finishMatch(context, { roomId });
  assert.equal(finished.ok, true, JSON.stringify(finished));
  assert.equal(finished.value.phase, 'FINISHED');
  assert.equal(finished.value.standings.length, 3);
  assert.equal(finished.value.standings[0].playerId, players[0].playerId);
  assert.equal(finished.value.standings[0].position, 1);
  assert.equal(finished.value.standings[0].correctCount, 10);
  // Speler 2 en 3 hebben allebei 0 punten en 0 goed → gedeelde positie 2.
  assert.equal(finished.value.standings[1].position, 2);
  assert.equal(finished.value.standings[2].position, 2);
  assert.equal(finished.value.podium.length, 3);

  // ── Rematch ──────────────────────────────────────────────────────────────
  clock.advance(1000);
  const again = await rematch(context, { roomId });
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.notEqual(again.value.matchId, matchId);
  assert.equal(again.value.previousMatchId, matchId);
  assert.equal(again.value.sequence, 2);
  assert.equal(again.value.phase, 'LOBBY');
  assert.deepEqual([...again.value.previousMatchQuestionKeys].sort(), [...usedQuestionKeys].sort());

  // Zelfde room, code en inviteId (GAME-FLOW.md §12).
  const roomAfter = await store.loadRoom(roomId);
  assert.equal(roomAfter.id, roomId);
  assert.equal(roomAfter.code, room.code);
  assert.equal(roomAfter.inviteId, room.inviteId);
  assert.equal(roomAfter.phase, 'LOBBY');
  assert.equal(roomAfter.currentMatchId, again.value.matchId);
  assert.deepEqual(roomAfter.config, roomConfig); // instellingen blijven

  // Scores en streaks op nul.
  for (const player of players) {
    const stored = await store.loadPlayer(roomId, player.playerId);
    assert.equal(stored.score, 0);
    assert.equal(stored.correctCount, 0);
    assert.equal(stored.correctResponseTimeMsTotal, 0);
    assert.equal(stored.eligibleFromRound, 1);
  }

  // Vragen uit de direct vorige match worden vermeden.
  const restarted = await startMatch(context, { roomId });
  assert.equal(restarted.ok, true, JSON.stringify(restarted));
  assert.equal(restarted.value.matchId, again.value.matchId);
  const rematchKeys = [];
  for (let roundNumber = 1; roundNumber <= 3; roundNumber += 1) {
    const played = await playRound(harness, {
      roomId,
      matchId: again.value.matchId,
      players,
      answerFor: (player, round) => ({ optionId: round.correctAnswer.optionId }),
    });
    rematchKeys.push(played.round.questionKey);
    await leaveResultPhase(harness, roomId, roomConfig);
  }
  for (const key of rematchKeys) {
    assert.equal(usedQuestionKeys.includes(key), false, `rematch herhaalt ${key} uit de vorige match`);
  }
});

test('matrixrij 7: startMatch eist LOBBY en minimaal één speler', async () => {
  const harness = makeHarness();
  const { context } = harness;

  // Host doet niet mee en er is niemand gejoind → geen enkele Player-entiteit.
  const leeg = await seedRoom(harness, { extraPlayers: 0, hostParticipates: false });
  assert.deepEqual(
    await startMatch(context, { roomId: leeg.roomId }),
    { ok: false, code: 'INVALID_PHASE' },
  );

  const zonderSpelers = await seedRoom(harness, { extraPlayers: 0 });
  const first = await startMatch(context, { roomId: zonderSpelers.roomId });
  assert.equal(first.ok, true);
  assert.deepEqual(
    await startMatch(context, { roomId: zonderSpelers.roomId }),
    { ok: false, code: 'GAME_ALREADY_STARTED' },
  );
  assert.deepEqual(
    await startMatch(context, { roomId: 'room_bestaat_niet' }),
    { ok: false, code: 'GAME_NOT_FOUND' },
  );
});

test('matrixrij 7: rematch kan alleen vanuit FINISHED', async () => {
  const harness = makeHarness();
  const { context } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1 });

  assert.deepEqual(await rematch(context, { roomId }), { ok: false, code: 'INVALID_PHASE' });
  await startMatch(context, { roomId });
  assert.deepEqual(await rematch(context, { roomId }), { ok: false, code: 'INVALID_PHASE' });
});

// ─── Matrixrij 9 — late join ────────────────────────────────────────────────

test('matrixrij 9: late joiner krijgt geen punten voor gemiste rondes en telt pas mee vanaf de volgende ronde', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, room, players } = await seedRoom(harness, { extraPlayers: 1 });
  const roomConfig = (await store.loadRoom(roomId)).config;

  const started = await startMatch(context, { roomId });
  const matchId = started.value.matchId;

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round1 = await startRound(context, { roomId });
  assert.equal(round1.ok, true);
  const round1Doc = await loadRoundDoc(harness, roomId, matchId, round1.value.roundId);

  // Alleen deze laag kent Match.roundIndex; room-lifecycle krijgt het getal.
  clock.advance(2000);
  const eligibility = await resolveEligibleFromRound(context, { roomId });
  assert.equal(eligibility.ok, true);
  assert.equal(eligibility.value.currentRoundNumber, 1);
  assert.equal(eligibility.value.eligibleFromRound, 2);
  assert.equal(eligibility.value.isLateJoin, true);

  const late = await joinRoom(context, {
    gameCode: room.gameCode,
    displayName: 'Laatkomer',
    joinSource: 'code',
    eligibleFromRound: eligibility.value.eligibleFromRound,
  });
  assert.equal(late.ok, true, JSON.stringify(late));
  assert.equal((await store.loadPlayer(roomId, late.value.playerId)).eligibleFromRound, 2);

  // Geen punten voor de gemiste ronde: de rules-laag weigert het antwoord.
  assert.deepEqual(
    await submitAnswer(context, {
      roomId,
      playerId: late.value.playerId,
      roundId: round1Doc.id,
      answer: { optionId: round1Doc.correctAnswer.optionId },
      actionId: 'act_late_ronde1',
    }),
    { ok: false, code: 'PLAYER_NOT_ELIGIBLE' },
  );

  for (const player of players) {
    await submitAnswer(context, {
      roomId,
      playerId: player.playerId,
      roundId: round1Doc.id,
      answer: { optionId: round1Doc.correctAnswer.optionId },
      actionId: `act_r1_${player.playerId}`,
    });
  }

  clock.set(round1Doc.endsAt);
  const ended1 = await endRound(context, { roomId });
  assert.equal(ended1.ok, true);
  // Telt niet mee in de noemer van ronde 1.
  assert.equal(ended1.value.eligiblePlayerCount, 2);
  assert.equal(ended1.value.answeredCount, 2);
  assert.equal((await store.loadPlayer(roomId, late.value.playerId)).score, 0);

  await leaveResultPhase(harness, roomId, roomConfig);

  // Ronde 2: de late joiner telt mee én mag antwoorden.
  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round2 = await startRound(context, { roomId });
  const round2Doc = await loadRoundDoc(harness, roomId, matchId, round2.value.roundId);
  assert.equal(round2.value.roundNumber, 2);

  clock.advance(500);
  const lateAnswer = await submitAnswer(context, {
    roomId,
    playerId: late.value.playerId,
    roundId: round2Doc.id,
    answer: { optionId: round2Doc.correctAnswer.optionId },
    actionId: 'act_late_ronde2',
  });
  assert.equal(lateAnswer.ok, true, JSON.stringify(lateAnswer));
  assert.equal(lateAnswer.value.correct, true);

  clock.set(round2Doc.endsAt);
  const ended2 = await endRound(context, { roomId });
  assert.equal(ended2.value.eligiblePlayerCount, 3);
  assert.equal(ended2.value.answeredCount, 1);
});

test('matrixrij 9: allowLateJoin=false geeft LATE_JOIN_DISABLED zodra de match loopt', async () => {
  const harness = makeHarness();
  const { context } = harness;
  const { roomId, room } = await seedRoom(harness, { extraPlayers: 1, roomConfig: { allowLateJoin: false } });

  // In de lobby mag het nog wel.
  const inLobby = await joinRoom(context, { gameCode: room.gameCode, displayName: 'Op tijd', joinSource: 'code' });
  assert.equal(inLobby.ok, true);

  await startMatch(context, { roomId });

  // Room.phase is als projectie meegegaan (besluit 30), dus room-lifecycle
  // weigert de late join op basis van de echte fase.
  assert.deepEqual(
    await joinRoom(context, { gameCode: room.gameCode, displayName: 'Te laat', joinSource: 'code' }),
    { ok: false, code: 'LATE_JOIN_DISABLED' },
  );
});

// ─── Matrixrij 12 — idempotentie ────────────────────────────────────────────

test('matrixrij 12: dezelfde actionId geeft dezelfde ack zonder herverwerking', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  clock.advance(1000);
  const first = await submitAnswer(context, {
    roomId,
    playerId: players[0].playerId,
    roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId },
    actionId: 'act_idempotent',
  });
  assert.equal(first.ok, true);
  assert.equal(first.value.replay, false);
  const scoreAfterFirst = (await store.loadPlayer(roomId, players[0].playerId)).score;
  assert.ok(scoreAfterFirst > 100, 'correct antwoord binnen de tijd hoort een snelheidsbonus te krijgen');

  // De retry komt later binnen en heeft dus een andere responstijd; de ack
  // moet toch identiek zijn en er mag niets herverwerkt worden.
  clock.advance(2500);
  const retry = await submitAnswer(context, {
    roomId,
    playerId: players[0].playerId,
    roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId },
    actionId: 'act_idempotent',
  });
  assert.equal(retry.ok, true);
  assert.equal(retry.value.replay, true);
  assert.deepEqual(retry.value.ack, first.value.ack);

  const after = await store.loadPlayer(roomId, players[0].playerId);
  assert.equal(after.score, scoreAfterFirst, 'score wijzigt nooit tweemaal');
  assert.equal(after.correctCount, 1);
  const stored = await store.loadAnswer(roomId, started.value.matchId, doc.id, players[0].playerId);
  assert.equal(stored.actionId, 'act_idempotent');
  assert.equal(stored.points, scoreAfterFirst);
});

test('matrixrij 12: nieuwe actionId met ONgewijzigde inhoud geeft ALREADY_ANSWERED', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  clock.advance(1000);
  const first = await submitAnswer(context, {
    roomId, playerId: players[0].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 'act_a',
  });
  assert.equal(first.ok, true);
  const scoreAfterFirst = (await store.loadPlayer(roomId, players[0].playerId)).score;

  clock.advance(500);
  assert.deepEqual(
    await submitAnswer(context, {
      roomId, playerId: players[0].playerId, roundId: doc.id,
      answer: { optionId: doc.correctAnswer.optionId }, actionId: 'act_b',
    }),
    { ok: false, code: 'ALREADY_ANSWERED' },
  );
  assert.equal((await store.loadPlayer(roomId, players[0].playerId)).score, scoreAfterFirst);
});

test('matrixrij 12: nieuwe actionId met GEwijzigde inhoud geeft ALREADY_ANSWERED; score wijzigt nooit tweemaal', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  clock.advance(1000);
  const first = await submitAnswer(context, {
    roomId, playerId: players[0].playerId, roundId: doc.id,
    answer: { optionId: wrongOptionId(doc) }, actionId: 'act_fout',
  });
  assert.equal(first.ok, true);
  assert.equal(first.value.correct, false);
  assert.equal(first.value.points, 0);

  // Wijzigen is niet toegestaan (GAME-RULES.md: "antwoorden zijn definitief").
  clock.advance(500);
  assert.deepEqual(
    await submitAnswer(context, {
      roomId, playerId: players[0].playerId, roundId: doc.id,
      answer: { optionId: doc.correctAnswer.optionId }, actionId: 'act_correctie',
    }),
    { ok: false, code: 'ALREADY_ANSWERED' },
  );

  const player = await store.loadPlayer(roomId, players[0].playerId);
  assert.equal(player.score, 0);
  assert.equal(player.correctCount, 0);
  const stored = await store.loadAnswer(roomId, started.value.matchId, doc.id, players[0].playerId);
  assert.equal(stored.correct, false);
  assert.equal(stored.actionId, 'act_fout');
});

test('matrixrij 12: de ack komt ná de write uit de actioncache van de poort, niet uit een voorcontrole', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  // Instrumentatie op de poort: legt de VOLGORDE vast waarin de compositie hem
  // raadpleegt. Sinds DM13 mag de actioncache pas ná de atomaire write worden
  // gelezen — een leesactie ervóór zou een voorcontrole zijn.
  const calls = [];
  const realLoadActionCacheEntry = store.loadActionCacheEntry;
  const realSave = store.saveAcceptedAnswerAtomically;
  store.loadActionCacheEntry = async (...args) => {
    calls.push('loadActionCacheEntry');
    return realLoadActionCacheEntry(...args);
  };
  store.saveAcceptedAnswerAtomically = async (...args) => {
    calls.push('saveAcceptedAnswerAtomically');
    return realSave(...args);
  };

  clock.advance(1000);
  const first = await submitAnswer(context, {
    roomId, playerId: players[0].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 'act_cache',
  });
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.value.replay, false);
  assert.deepEqual(calls, ['saveAcceptedAnswerAtomically', 'loadActionCacheEntry']);

  // De ack die de aanroeper kreeg staat letterlijk zo in de actioncache.
  const entry = await realLoadActionCacheEntry(roomId, 'act_cache');
  assert.deepEqual(entry.ack, first.value.ack);

  calls.length = 0;
  clock.advance(2500);
  const replay = await submitAnswer(context, {
    roomId, playerId: players[0].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 'act_cache',
  });
  assert.equal(replay.ok, true, JSON.stringify(replay));
  assert.equal(replay.value.replay, true);
  assert.deepEqual(replay.value.ack, first.value.ack, 'een replay geeft exact dezelfde ack');
  assert.deepEqual(calls, ['saveAcceptedAnswerAtomically', 'loadActionCacheEntry']);
  // De poort loste stil op: de opgeslagen entry is nog steeds die van de
  // oorspronkelijke aanroep en de persoonlijke velden komen uit de store.
  assert.deepEqual(await realLoadActionCacheEntry(roomId, 'act_cache'), entry);
  assert.equal(replay.value.points, first.value.points);
  assert.equal(replay.value.responseTimeMs, first.value.responseTimeMs);
  assert.equal(replay.value.score, first.value.score);

  // Herkomstbewijs: een gemanipuleerde actioncache verandert de ack die de
  // aanroeper terugkrijgt — hij wordt dus daaruit gelezen en niet herberekend.
  store.loadActionCacheEntry = async () => ({ actionId: 'act_cache', ack: { roundId: 'uit-de-actioncache' } });
  const spoofed = await submitAnswer(context, {
    roomId, playerId: players[0].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 'act_cache',
  });
  assert.deepEqual(spoofed.value.ack, { roundId: 'uit-de-actioncache' });

  store.loadActionCacheEntry = realLoadActionCacheEntry;
  store.saveAcceptedAnswerAtomically = realSave;
});

// ─── Matrixrij 14 — snapshot lekt nooit correctAnswer ───────────────────────

test('matrixrij 14: snapshot van een actieve ronde bevat op geen enkel niveau correctAnswer', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 2 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  // Voorwaarde van de rij: het juiste antwoord staat écht in de serverstate.
  assert.equal(typeof doc.correctAnswer.optionId, 'string');
  assert.ok(findCorrectAnswerPaths(doc).length > 0, 'het Round-document hoort correctAnswer wél te bevatten');

  clock.advance(1500);
  await submitAnswer(context, {
    roomId, playerId: players[0].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 'act_snapshot',
  });

  for (const player of [...players, { sessionId: null }]) {
    const snapshot = await buildSnapshot(context, { roomId, sessionId: player.sessionId });
    assert.equal(snapshot.ok, true, JSON.stringify(snapshot));

    // Diepe zoektocht over de VOLLEDIGE response, niet alleen de toplevel.
    assert.deepEqual(
      findCorrectAnswerPaths(snapshot.value),
      [],
      'snapshot bevat een correctAnswer-sleutel of -string',
    );
    assert.deepEqual(
      findDeepEqualPaths(snapshot.value, doc.correctAnswer),
      [],
      'snapshot bevat het correctAnswer-object van de actieve ronde',
    );
    // Zelfde toets over de geserialiseerde vorm, want dat is wat de wire ziet.
    assert.equal(JSON.stringify(snapshot.value).includes('correctAnswer'), false);
  }

  const own = await buildSnapshot(context, { roomId, sessionId: players[0].sessionId });
  assert.equal(own.value.room.phase, 'ROUND_ACTIVE');
  assert.equal(own.value.currentRound.roundId, doc.id);
  assert.equal(own.value.self.answeredCurrentRound, true);
  assert.equal(own.value.self.playerId, players[0].playerId);
  assert.equal(own.value.serverTime, clock.value);

  // De snapshot voldoet aan de volledige vorm die PROTOCOL.md/PR voorschrijft,
  // inclusief `matchSequence` (INT-2) en de `pausedState`-vorm (besluit 10).
  assert.equal(own.value.room.pausedState, null);
  assert.equal(own.value.room.matchSequence, 1);
  assert.deepEqual(validateSnapshotShape(own.value), { ok: true });
  assert.deepEqual(assertNoActiveRoundAnswerLeak(own.value), { ok: true });
});

test('matrixrij 14: na round:ended is de ronde niet meer ACTIVE en blijft de snapshot leeg voor currentRound', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  clock.set(doc.endsAt);
  const ended = await endRound(context, { roomId });
  assert.equal(ended.ok, true);
  // Pas hier verlaat het juiste antwoord de server (besluit 20).
  assert.deepEqual(ended.value.correctAnswer, doc.correctAnswer);

  const snapshot = await buildSnapshot(context, { roomId, sessionId: players[0].sessionId });
  assert.deepEqual(snapshot.value.currentRound, {});
  assert.deepEqual(findCorrectAnswerPaths(snapshot.value), []);
  assert.equal((await store.loadRound(roomId, started.value.matchId, doc.id)).status, 'ENDED');
});

// ─── Besluit 20 — correctAnswer nooit in round:started ──────────────────────

test('besluit 20: de round:started-payload bevat geen correctAnswer en voldoet aan PROTOCOL.md', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  assert.equal(round.ok, true);

  assert.deepEqual(validateRoundStartedPayload(round.value), { ok: true });
  assert.deepEqual(findCorrectAnswerPaths(round.value), []);
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  assert.deepEqual(findDeepEqualPaths(round.value, doc.correctAnswer), []);
  assert.equal(round.value.contentVersion, CONTENT_VERSION);
});

test('de round:ended-payload draagt de verdeling uit de rules-laag (besluit 14)', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 2 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  const wrong = wrongOptionId(doc);

  clock.advance(1000);
  await submitAnswer(context, {
    roomId, playerId: players[0].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 'a1',
  });
  await submitAnswer(context, {
    roomId, playerId: players[1].playerId, roundId: doc.id,
    answer: { optionId: wrong }, actionId: 'a2',
  });

  clock.set(doc.endsAt);
  const ended = await endRound(context, { roomId });
  assert.equal(ended.ok, true);

  // Stap 6 (5 aug 2026): de verdeling gaat als GEORDENDE ARRAY over de lijn,
  // niet als object — de client leest `distribution.find(d => d.optionId ===
  // ...)`. PROTOCOL.md §round:ended legt die vorm nu vast.
  assert.ok(Array.isArray(ended.value.distribution));
  assert.deepEqual(
    ended.value.distribution.map((entry) => entry.optionId),
    [...doc.validOptionIds],
    'de volgorde is die van de antwoordopties, zodat de balkjes op hun plek staan',
  );
  const telling = (optionId) => ended.value.distribution.find((entry) => entry.optionId === optionId).count;
  assert.equal(telling(doc.correctAnswer.optionId), 1);
  assert.equal(telling(wrong), 1);
  assert.equal(ended.value.distribution.reduce((som, entry) => som + entry.count, 0), 2);
  assert.equal(ended.value.answeredCount, 2);
  assert.equal(ended.value.eligiblePlayerCount, 3);

  const ownPoints = ended.value.results.find((entry) => entry.playerId === players[0].playerId).points;
  assert.deepEqual(
    validateRoundEndedPayload({ roundId: ended.value.roundId, correctAnswer: ended.value.correctAnswer, ownPoints }),
    { ok: true },
  );
});

// ─── Deadline, grace en fout antwoord (besluit 13) ──────────────────────────

test('besluit 13: binnen de 250 ms grace is een antwoord correct maar krijgt het nooit tijdbonus', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  assert.equal((await store.loadRoom(roomId)).config.deadlineGraceMs, 250);

  // Exact op de rand van de grace.
  clock.set(doc.endsAt + 250);
  const inGrace = await submitAnswer(context, {
    roomId, playerId: players[0].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 'act_grace',
  });
  assert.equal(inGrace.ok, true, JSON.stringify(inGrace));
  assert.equal(inGrace.value.correct, true);
  assert.equal(inGrace.value.points, 100, 'binnen grace: basispunten, geen snelheidsbonus');
  assert.equal((await store.loadPlayer(roomId, players[0].playerId)).score, 100);
});

test('besluit 13: één milliseconde ná de grace geeft DEADLINE_PASSED en schrijft niets', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  clock.set(doc.endsAt + 251);
  assert.deepEqual(
    await submitAnswer(context, {
      roomId, playerId: players[1].playerId, roundId: doc.id,
      answer: { optionId: doc.correctAnswer.optionId }, actionId: 'act_te_laat',
    }),
    { ok: false, code: 'DEADLINE_PASSED' },
  );
  assert.equal((await store.loadPlayer(roomId, players[1].playerId)).score, 0);
  assert.equal(await store.loadAnswer(roomId, started.value.matchId, doc.id, players[1].playerId), null);
  assert.equal(await store.loadActionCacheEntry(roomId, 'act_te_laat'), null);
});

test('een fout antwoord levert 0 punten en telt niet mee in correctCount', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  clock.advance(800);
  const wrong = await submitAnswer(context, {
    roomId, playerId: players[0].playerId, roundId: doc.id,
    answer: { optionId: wrongOptionId(doc) }, actionId: 'act_fout',
  });
  assert.equal(wrong.ok, true);
  assert.equal(wrong.value.correct, false);
  assert.equal(wrong.value.points, 0);

  const player = await store.loadPlayer(roomId, players[0].playerId);
  assert.equal(player.score, 0);
  assert.equal(player.correctCount, 0);
  assert.equal(player.correctResponseTimeMsTotal, 0);

  // Een antwoord met een optionId dat niet bestaat is een vormfout.
  assert.deepEqual(
    await submitAnswer(context, {
      roomId, playerId: players[1].playerId, roundId: doc.id,
      answer: { optionId: 'zz' }, actionId: 'act_onzin',
    }),
    { ok: false, code: 'INVALID_ANSWER_FORMAT' },
  );
});

// ─── Pauze en hervat (besluit 10) ───────────────────────────────────────────

test('pauze en hervat gebruiken de bevestigde pausedState-vorm (besluit 10)', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  clock.advance(4000);
  const pausedAt = clock.value;
  const paused = await advancePhase(context, { roomId, event: { type: 'HOST_PAUSE', reason: 'host' } });
  assert.equal(paused.ok, true, JSON.stringify(paused));
  assert.equal(paused.value.phase, 'PAUSED');

  const expectedPausedState = {
    previousPhase: 'ROUND_ACTIVE',
    remainingMs: doc.endsAt - pausedAt,
    reason: 'host',
    pausedAt,
  };
  assert.deepEqual(paused.value.pausedState, expectedPausedState);
  assert.deepEqual((await store.loadMatch(roomId, started.value.matchId)).pausedState, expectedPausedState);
  assert.equal((await store.loadRoom(roomId)).phase, 'PAUSED');

  // Besluit 10: dezelfde volledige vorm in de snapshot, in `room.pausedState`.
  const snapshot = await buildSnapshot(context, { roomId, sessionId: players[0].sessionId });
  assert.deepEqual(snapshot.value.room.pausedState, expectedPausedState);
  assert.deepEqual(validateSnapshotShape(snapshot.value), { ok: true });
  // De ronde blijft ACTIVE tijdens een pauze, dus de vraag blijft zichtbaar
  // voor een client die tijdens de pauze rejoint — zonder het juiste antwoord.
  assert.equal(snapshot.value.currentRound.roundId, doc.id);
  assert.deepEqual(findCorrectAnswerPaths(snapshot.value), []);
  assert.deepEqual(findDeepEqualPaths(snapshot.value, doc.correctAnswer), []);

  clock.advance(9000);
  const resumed = await advancePhase(context, { roomId, event: { type: 'HOST_RESUME' } });
  assert.equal(resumed.ok, true, JSON.stringify(resumed));
  assert.equal(resumed.value.phase, 'ROUND_ACTIVE');
  assert.equal(resumed.value.pausedState, null);
  assert.equal((await store.loadMatch(roomId, started.value.matchId)).pausedState, null);
  assert.equal((await store.loadRoom(roomId)).phase, 'ROUND_ACTIVE');
});

test('een pauze zonder expliciete reden gebruikt de MVP-default en lekt nooit de interne code', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1 });
  await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  await startRound(context, { roomId });

  clock.advance(1000);
  const paused = await advancePhase(context, { roomId, event: { type: 'HOST_PAUSE' } });
  assert.equal(paused.ok, true, JSON.stringify(paused));
  assert.equal(paused.value.pausedState.reason, 'host');

  // Besluit 12: INVALID_PAUSE_STATE blijft intern; een onbruikbare payload
  // komt naar buiten als de gepubliceerde code INVALID_PHASE.
  const resumed = await advancePhase(context, { roomId, event: { type: 'HOST_RESUME' } });
  assert.equal(resumed.ok, true);
  clock.advance(100);
  const bad = await advancePhase(context, {
    roomId,
    event: { type: 'HOST_PAUSE', reason: '   ', remainingMs: 1000 },
  });
  assert.deepEqual(bad, { ok: false, code: 'INVALID_PHASE' });
});

// ─── Besluit 1 — host-tempo, één hostactie per ronde ────────────────────────

test('besluit 1: bij host-tempo loopt ROUND_RESULT op de timer door naar SCOREBOARD en zit de hostactie daarna', async () => {
  const harness = makeHarness({ config: {} });
  const { context, clock } = harness;
  const { roomId, players } = await seedRoom(harness, {
    extraPlayers: 1,
    roomConfig: { pacing: 'host', totalRounds: 2 },
  });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  clock.set(doc.endsAt);
  const ended = await endRound(context, { roomId });
  assert.equal(ended.value.phase, 'ROUND_RESULT');
  assert.equal(typeof ended.value.phaseEndsAt, 'number', 'de uitslag loopt óók bij host-tempo op een timer');

  // Timer, niet de host: ROUND_RESULT → SCOREBOARD.
  clock.advance(5000);
  const toScoreboard = await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } });
  assert.equal(toScoreboard.ok, true, JSON.stringify(toScoreboard));
  assert.equal(toScoreboard.value.phase, 'SCOREBOARD');
  assert.equal(toScoreboard.value.phaseEndsAt, null, 'de tussenstand wacht bij host-tempo op de host');

  // Bij host-tempo is TIMER_ELAPSED vanuit SCOREBOARD ongeldig.
  assert.deepEqual(
    await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } }),
    { ok: false, code: 'INVALID_PHASE' },
  );

  const hostNext = await advancePhase(context, { roomId, event: { type: 'HOST_NEXT' } });
  assert.equal(hostNext.ok, true, JSON.stringify(hostNext));
  assert.equal(hostNext.value.phase, 'COUNTDOWN');
  assert.equal(hostNext.value.roundNumber, 2);
});

test('besluit 1: ook met scoreboardFrequency "off" blijft de hostactie bij SCOREBOARD (INT-10)', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId } = await seedRoom(harness, {
    extraPlayers: 1,
    roomConfig: { pacing: 'host', scoreboardFrequency: 'off', totalRounds: 2 },
  });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  clock.set(doc.endsAt);
  const ended = await endRound(context, { roomId });
  assert.equal(ended.value.phase, 'ROUND_RESULT');

  // state-machine.js kent geen HOST_NEXT meer vanuit ROUND_RESULT: de fase
  // blijft timergedreven, óók zonder tussenstand.
  assert.deepEqual(
    await advancePhase(context, { roomId, event: { type: 'HOST_NEXT' } }),
    { ok: false, code: 'INVALID_PHASE' },
  );

  clock.advance(5000);
  const toScoreboard = await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } });
  assert.equal(toScoreboard.ok, true, JSON.stringify(toScoreboard));
  assert.equal(toScoreboard.value.phase, 'SCOREBOARD');
  assert.equal(toScoreboard.value.phaseEndsAt, null, 'de tussenstand wacht bij host-tempo op de host');

  const hostNext = await advancePhase(context, { roomId, event: { type: 'HOST_NEXT' } });
  assert.equal(hostNext.ok, true, JSON.stringify(hostNext));
  assert.equal(hostNext.value.phase, 'COUNTDOWN');
  assert.equal(hostNext.value.roundNumber, 2);
});

// ─── Besluit C — "Antwoord automatisch tonen" uit ───────────────────────────

/** Speelt tot en met het einde van ronde 1 en levert de uitslag terug. */
async function speelTotUitslag(harness, roomConfig) {
  const { context, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1, roomConfig });
  const started = await startMatch(context, { roomId });
  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  clock.set(doc.endsAt);
  return { roomId, ended: await endRound(context, { roomId }) };
}

test('besluit C: met autoReveal false wacht de uitslag op de host en is HOST_REVEAL de ene hostactie', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId, ended } = await speelTotUitslag(harness, { autoReveal: false, totalRounds: 2 });

  assert.equal(ended.value.phase, 'ROUND_RESULT');
  assert.equal(ended.value.phaseEndsAt, null, 'de uitslag krijgt geen timer: hij wacht op de host');

  // Geen timerovergang: het scherm blijft op de reveal staan.
  clock.advance(60_000);
  assert.deepEqual(
    await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } }),
    { ok: false, code: 'INVALID_PHASE' },
  );

  const reveal = await advancePhase(context, { roomId, event: { type: 'HOST_REVEAL' } });
  assert.equal(reveal.ok, true, JSON.stringify(reveal));
  assert.equal(reveal.value.phase, 'SCOREBOARD');
  assert.equal(typeof reveal.value.phaseEndsAt, 'number', 'daarna loopt het door, zonder tweede knop');
});

test('besluit C: autoReveal false bij host-tempo geeft de host precies één knop per ronde (besluit 1)', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId, ended } = await speelTotUitslag(harness, {
    autoReveal: false, pacing: 'host', totalRounds: 2,
  });
  assert.equal(ended.value.phaseEndsAt, null);

  const reveal = await advancePhase(context, { roomId, event: { type: 'HOST_REVEAL' } });
  assert.equal(reveal.value.phase, 'SCOREBOARD');
  assert.equal(
    typeof reveal.value.phaseEndsAt, 'number',
    'de tussenstand wacht NIET óók nog op de host — het onthullen was de hostactie',
  );

  // En de tweede knop bestaat dus niet: HOST_NEXT is hier ongeldig.
  assert.deepEqual(
    await advancePhase(context, { roomId, event: { type: 'HOST_NEXT' } }),
    { ok: false, code: 'INVALID_PHASE' },
  );

  clock.advance(60_000);
  const door = await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } });
  assert.equal(door.ok, true, JSON.stringify(door));
  assert.equal(door.value.phase, 'COUNTDOWN');
  assert.equal(door.value.roundNumber, 2);
});

test('besluit C: met autoReveal true (de standaard) bestaat de onthulknop niet', async () => {
  const harness = makeHarness();
  const { context } = harness;
  const { roomId, ended } = await speelTotUitslag(harness, { totalRounds: 2 });

  assert.equal(typeof ended.value.phaseEndsAt, 'number');
  assert.deepEqual(
    await advancePhase(context, { roomId, event: { type: 'HOST_REVEAL' } }),
    { ok: false, code: 'INVALID_PHASE' },
    'de reducer laat HOST_REVEAL vanuit ROUND_RESULT toe; de compositie is de poort die autoReveal kent',
  );
});

test('besluit C: de onthulactie sluit ook de laatste ronde af (naar FINISHED)', async () => {
  const harness = makeHarness();
  const { context } = harness;
  const { roomId } = await speelTotUitslag(harness, {
    autoReveal: false, scoreboardFrequency: 'off', totalRounds: 1,
  });

  const reveal = await advancePhase(context, { roomId, event: { type: 'HOST_REVEAL' } });
  assert.equal(reveal.ok, true, JSON.stringify(reveal));
  assert.equal(reveal.value.phase, 'FINISHED');
});

test('resolveNextPhase kiest alleen een bestemming; transition() blijft de enige poortwachter', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1, roomConfig: { totalRounds: 1 } });
  const started = await startMatch(context, { roomId });

  const room = await store.loadRoom(roomId);
  let match = await store.loadMatch(roomId, started.value.matchId);
  assert.equal(resolveNextPhase(room, match), 'ROUND_ACTIVE');

  clock.advance(COUNTDOWN_SECONDS * 1000);
  await startRound(context, { roomId });
  match = await store.loadMatch(roomId, started.value.matchId);
  assert.equal(resolveNextPhase(room, match), 'ROUND_RESULT');

  // Een bestemming die de aanroeper zelf oplegt en die de tabel niet kent,
  // wordt door de reducer afgewezen — niet door een tweede fasetabel hier.
  assert.deepEqual(
    await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED', nextPhase: 'FINISHED' } }),
    { ok: false, code: 'INVALID_PHASE' },
  );
  assert.deepEqual(
    await advancePhase(context, { roomId, event: { type: 'HOST_START' } }),
    { ok: false, code: 'INVALID_PHASE' },
  );
  assert.deepEqual(
    await advancePhase(context, { roomId, event: { type: 'GEEN_EVENT' } }),
    { ok: false, code: 'UNSUPPORTED_EVENT' },
  );
  assert.deepEqual(
    await advancePhase(context, { roomId: 'room_bestaat_niet', event: { type: 'TIMER_ELAPSED' } }),
    { ok: false, code: 'GAME_NOT_FOUND' },
  );
});

// ─── Tussenstand en eindstand ───────────────────────────────────────────────

test('§A3: getScoreboard rangschikt met rankPlayers over álle spelers, niet met index + 1 over de poort-index', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 2 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  clock.advance(1000);
  await submitAnswer(context, {
    roomId, playerId: players[1].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 's1',
  });
  clock.advance(3000);
  await submitAnswer(context, {
    roomId, playerId: players[0].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 's2',
  });

  const scoreboard = await getScoreboard(context, { roomId });
  assert.equal(scoreboard.ok, true);
  assert.equal(scoreboard.value.matchId, started.value.matchId);
  assert.equal(scoreboard.value.limit, 5);
  // Speler 1 antwoordde eerder en heeft dus een hogere snelheidsbonus.
  assert.equal(scoreboard.value.top[0].playerId, players[1].playerId);
  assert.equal(scoreboard.value.top[0].effectiveName, players[1].name);
  assert.equal(scoreboard.value.top[0].rank, 1);
  assert.ok(scoreboard.value.top[0].score > scoreboard.value.top[1].score);

  // §A3: de speler die nooit antwoordde stond vroeger NIET in de tussenstand
  // (de poort-index kent alleen scorende spelers), terwijl het podium hem wel
  // toonde. Nu rangschikt dezelfde functie als het podium over de volledige
  // spelerslijst: iedereen staat erin, ook met 0 punten, en kan dus zijn
  // eigen rij zien (scherm 5).
  assert.equal(scoreboard.value.top.length, 3);
  assert.equal(scoreboard.value.top[2].score, 0);
  assert.deepEqual(
    scoreboard.value.top.map((entry) => entry.rank),
    [1, 2, 3],
    'zonder gelijke stand is de rang gewoon oplopend',
  );
});

test('finishMatch gebruikt de tiebreak-volgorde uit standings.js', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 2, roomConfig: { speedBonus: false } });
  const started = await startMatch(context, { roomId });

  // Twee spelers eindigen met dezelfde score en hetzelfde aantal goed, maar
  // met verschillende totale responstijd → tiebreak 3 beslist.
  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  clock.advance(500);
  await submitAnswer(context, {
    roomId, playerId: players[2].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 't1',
  });
  clock.advance(4000);
  await submitAnswer(context, {
    roomId, playerId: players[1].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 't2',
  });

  clock.set(doc.endsAt);
  await endRound(context, { roomId });

  const finished = await finishMatch(context, { roomId });
  assert.equal(finished.ok, true, JSON.stringify(finished));
  assert.equal(finished.value.phase, 'FINISHED');
  assert.equal(finished.value.finishedAt, clock.value);
  assert.deepEqual(
    finished.value.standings.map((entry) => [entry.playerId, entry.score, entry.position]),
    [
      [players[2].playerId, 100, 1],
      [players[1].playerId, 100, 2],
      [players[0].playerId, 0, 3],
    ],
  );
  assert.equal((await store.loadRoom(roomId)).phase, 'FINISHED');
});

test('finishMatch levert de eindstand ook als de match al FINISHED is', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1, roomConfig: { totalRounds: 1 } });
  const started = await startMatch(context, { roomId });
  const roomConfig = (await harness.store.loadRoom(roomId)).config;

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  clock.set(doc.endsAt);
  await endRound(context, { roomId });
  const next = await leaveResultPhase(harness, roomId, roomConfig);
  assert.equal(next.phase, 'FINISHED');

  const finished = await finishMatch(context, { roomId });
  assert.equal(finished.ok, true, JSON.stringify(finished));
  assert.equal(finished.value.phase, 'FINISHED');
  assert.equal(finished.value.standings.length, 2);
});

// ─── Vraagselectie en gepinde versies ───────────────────────────────────────

test('startRound sluit de vragen van deze match én van de vorige match uit', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1, roomConfig: { totalRounds: 4 } });
  const roomConfig = (await store.loadRoom(roomId)).config;

  const started = await startMatch(context, { roomId });
  const keys = [];
  for (let roundNumber = 1; roundNumber <= 4; roundNumber += 1) {
    clock.advance(COUNTDOWN_SECONDS * 1000);
    const round = await startRound(context, { roomId });
    const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
    keys.push(doc.questionKey);
    clock.set(doc.endsAt);
    await endRound(context, { roomId });
    await leaveResultPhase(harness, roomId, roomConfig);
  }
  assert.equal(new Set(keys).size, 4);

  const match = await store.loadMatch(roomId, started.value.matchId);
  assert.deepEqual(match.usedQuestionKeys, keys);
  assert.equal(match.roundIds.length, 4);

  const again = await rematch(context, { roomId });
  const secondMatch = await store.loadMatch(roomId, again.value.matchId);
  assert.deepEqual(secondMatch.previousMatchQuestionKeys, keys);
  assert.deepEqual(secondMatch.usedQuestionKeys, []);
  assert.equal(secondMatch.roundIndex, 0);
  assert.equal(secondMatch.contentVersion, CONTENT_VERSION);
});

test('een ontbrekende contentVersion op de context is een programmeerfout, geen stille default', async () => {
  const clock = makeClock();
  const store = createInMemoryStore();
  const context = createContext({
    store,
    now: clock.now,
    config: { tokenPeppers: TOKEN_PEPPERS, publicAppUrl: APP_URL, random: seededRandom(1) },
  });
  const { roomId } = await seedRoom({ clock, store, context }, { extraPlayers: 0 });
  await assert.rejects(
    () => startMatch(context, { roomId }),
    /contentVersion/,
  );
});

test('een pre-match-lobby levert een geldige snapshot met matchId én matchSequence null (INT-17)', async () => {
  const harness = makeHarness();
  const { context } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 1 });

  const snapshot = await buildSnapshot(context, { roomId, sessionId: players[0].sessionId });
  assert.equal(snapshot.ok, true);

  // HET CONTRACT VAN DE LOBBY. Vóór de eerste match bestaat er geen match —
  // `Room.currentMatchId` is dan null (DATA-MODEL.md §Room) — en de snapshot
  // liegt daar niet overheen met een nepwaarde: `matchId` en `matchSequence`
  // zijn ALLEBEI null. `snapshot-shape.mjs` staat precies die combinatie toe;
  // een halve invulling blijft ongeldig (zie de twee asserties onderaan).
  // Voor snapshot-precedence telt een snapshot zonder match als sequence 0.
  assert.deepEqual(
    Object.keys(snapshot.value).sort(),
    [
      'currentRound', 'participants', 'participantsTruncated', 'protocolVersion',
      'room', 'scoreboard', 'self', 'serverTime',
    ],
  );
  assert.deepEqual(
    Object.keys(snapshot.value.room).sort(),
    [
      'allowLateJoin', 'code', 'config', 'joinUrl', 'locked', 'matchId',
      'matchSequence', 'phase', 'playerCount', 'pausedState',
    ].sort(),
  );
  assert.equal(snapshot.value.room.phase, 'LOBBY');
  assert.equal(snapshot.value.room.matchId, null);
  assert.equal(snapshot.value.room.matchSequence, null);
  assert.equal(snapshot.value.room.pausedState, null);
  assert.equal(snapshot.value.room.playerCount, 2);
  assert.equal(snapshot.value.room.locked, false);
  assert.deepEqual(snapshot.value.currentRound, {});
  assert.deepEqual(snapshot.value.scoreboard.top, []);
  assert.equal(snapshot.value.self.playerId, players[0].playerId);
  assert.equal(snapshot.value.self.eligibleFromRound, 1);
  assert.equal(snapshot.value.self.answeredCurrentRound, false);
  assert.deepEqual(findCorrectAnswerPaths(snapshot.value), []);

  assert.deepEqual(validateSnapshotShape(snapshot.value), { ok: true });
  assert.deepEqual(assertNoActiveRoundAnswerLeak(snapshot.value), { ok: true });

  // De validator is niet zomaar toegeeflijk geworden: alléén "allebei null"
  // mag. Eén van de twee ingevuld is een inconsistente snapshot en blijft een
  // afwijzing — anders bewees de assertie hierboven niets.
  assert.deepEqual(
    validateSnapshotShape({ ...snapshot.value, room: { ...snapshot.value.room, matchId: 'match_verzonnen' } }),
    { ok: false, code: null },
  );
  assert.deepEqual(
    validateSnapshotShape({ ...snapshot.value, room: { ...snapshot.value.room, matchSequence: 1 } }),
    { ok: false, code: null },
  );

  // En zodra de match er wél is, staan er echte waarden: dezelfde validator,
  // andere invulling. Daarmee is de lobby-null een fase en geen vrijbrief.
  const started = await startMatch(context, { roomId });
  assert.equal(started.ok, true, JSON.stringify(started));
  const afterStart = await buildSnapshot(context, { roomId, sessionId: players[0].sessionId });
  assert.equal(afterStart.value.room.matchId, started.value.matchId);
  assert.equal(afterStart.value.room.matchSequence, 1);
  assert.deepEqual(validateSnapshotShape(afterStart.value), { ok: true });
});

// ─── snapshot.participants (FEEDBACK-eerste-livetest punt 1, optie a) ────────
//
// Het gat dat deze lijst dicht: `room:state` gaf alleen `self` + `playerCount`,
// dus namen van ánderen kwamen uitsluitend via `room:player-changed`. Wie er al
// zat vóór jouw verbinding had bij jou geen naam en de lobby toonde een lege
// rij. Alle fixtures hieronder komen uit `seedRoom`/`joinRoom` — de échte
// producerende functies, conform de INT-18-les: een fixture die het echte
// formaat niet gebruikt bewijst niets over het echte pad.

test('participants geeft élke aanwezige speler een naam, ook wie er vóór jou al zat', async () => {
  const harness = makeHarness();
  const { context } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 2 });

  // De snapshot van de LAATST gejoinde speler: precies de situatie uit de
  // livetest, waarin regie als laatste binnenkwam en de twee eerdere spelers
  // naamloos zag.
  const laatste = players[players.length - 1];
  const snapshot = await buildSnapshot(context, { roomId, sessionId: laatste.sessionId });
  assert.equal(snapshot.ok, true);

  assert.equal(snapshot.value.participants.length, 3);
  assert.equal(snapshot.value.participants.length, snapshot.value.room.playerCount);

  // De kern van de bugfix: geen enkele deelnemer zonder naam.
  for (const participant of snapshot.value.participants) {
    assert.ok(
      typeof participant.effectiveName === 'string' && participant.effectiveName.length > 0,
      `deelnemer ${participant.playerId} heeft geen naam — dit is het lobbygat`,
    );
  }

  // En de namen zijn die van de échte spelers, niet een placeholder.
  assert.deepEqual(
    snapshot.value.participants.map((p) => p.effectiveName).sort(),
    players.map((p) => p.name).sort(),
  );
});

test('participants draagt rollen uit de SESSIE: een meespelende host is host én player', async () => {
  const harness = makeHarness();
  const { context } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 2 });

  const snapshot = await buildSnapshot(context, { roomId, sessionId: players[0].sessionId });
  const byId = new Map(snapshot.value.participants.map((p) => [p.playerId, p]));

  // players[0] is de host uit seedRoom.
  assert.deepEqual(byId.get(players[0].playerId).roles, ['host', 'player']);
  assert.deepEqual(byId.get(players[1].playerId).roles, ['player']);
  assert.deepEqual(byId.get(players[2].playerId).roles, ['player']);
});

test('een host die NIET meespeelt staat niet in participants — de lijst gaat over deelnemers', async () => {
  const harness = makeHarness();
  const { context } = harness;
  const { roomId, room, players } = await seedRoom(harness, { extraPlayers: 2, hostParticipates: false });

  const snapshot = await buildSnapshot(context, { roomId, sessionId: room.sessionId });
  assert.equal(snapshot.ok, true);

  // Twee spelers, geen derde regel voor de host: die heeft geen Player en dus
  // geen naam om te tonen. `self.roles` laat wél zien dat de kijker host is.
  assert.equal(snapshot.value.participants.length, 2);
  assert.equal(snapshot.value.participants.length, snapshot.value.room.playerCount);
  assert.deepEqual(snapshot.value.self.roles, ['host']);
  assert.equal(snapshot.value.self.playerId, null);
  assert.deepEqual(
    snapshot.value.participants.map((p) => p.playerId).sort(),
    players.map((p) => p.playerId).sort(),
  );
  for (const participant of snapshot.value.participants) {
    assert.deepEqual(participant.roles, ['player']);
  }
});

test('participants lekt geen sessiegegevens: exact drie velden, en geen token of sessionId in de JSON', async () => {
  const harness = makeHarness();
  const { context, store } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 2 });

  const snapshot = await buildSnapshot(context, { roomId, sessionId: players[0].sessionId });

  for (const participant of snapshot.value.participants) {
    assert.deepEqual(Object.keys(participant).sort(), ['effectiveName', 'playerId', 'roles']);
  }

  // Niet alleen de sleutels tellen, maar zoeken naar de échte geheimen in de
  // geserialiseerde lijst. Een veld dat per ongeluk meelift heet zelden
  // `tokenHash` — het is de wáárde die niet over de wire mag.
  const serialized = JSON.stringify(snapshot.value.participants);
  for (const player of players) {
    const session = await store.loadSession(roomId, player.sessionId);
    assert.equal(serialized.includes(session.tokenHash), false, 'tokenHash lekt in participants');
    assert.equal(serialized.includes(session.id), false, 'sessionId lekt in participants');
  }
});

test('participants volgt dezelfde verzameling als playerCount: gekickt en vertrokken vallen af', async () => {
  const harness = makeHarness();
  const { context, store } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 3 });

  const vertrokken = await store.loadPlayer(roomId, players[1].playerId);
  await store.savePlayer({ ...vertrokken, left: true });
  const gekickt = await store.loadPlayer(roomId, players[2].playerId);
  await store.savePlayer({ ...gekickt, kicked: true });

  const snapshot = await buildSnapshot(context, { roomId, sessionId: players[0].sessionId });

  assert.equal(snapshot.value.room.playerCount, 2);
  assert.equal(snapshot.value.participants.length, 2);
  const ids = snapshot.value.participants.map((p) => p.playerId);
  assert.equal(ids.includes(players[1].playerId), false, 'vertrokken speler staat er nog in');
  assert.equal(ids.includes(players[2].playerId), false, 'gekickte speler staat er nog in');
});

test('participants heeft een stabiele volgorde: join-tijdstip, dan playerId', async () => {
  const harness = makeHarness();
  const { context, store } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 3 });

  const eerste = await buildSnapshot(context, { roomId, sessionId: players[0].sessionId });
  const tweede = await buildSnapshot(context, { roomId, sessionId: players[0].sessionId });

  // Twee opeenvolgende snapshots geven dezelfde volgorde: zonder die garantie
  // zou de lobby kunnen herschikken en zou afkappen willekeurig zijn.
  assert.deepEqual(
    eerste.value.participants.map((p) => p.playerId),
    tweede.value.participants.map((p) => p.playerId),
  );

  // De volgorde is die uit PROTOCOL.md, berekend uit de opslag zelf. LET OP:
  // de harness heeft een vaste klok, dus alle spelers delen hier één
  // `joinedAt` en de sortering valt volledig terug op `playerId`. Juist daarom
  // is de tweede sleutel er: zonder die tiebreak zou deze test bij elke run een
  // andere volgorde kunnen zien (eerste opzet van deze test was om precies die
  // reden flaky).
  const opgeslagen = await store.listPlayers(roomId);
  const verwacht = [...opgeslagen]
    .sort((a, b) => (a.joinedAt === b.joinedAt ? a.id.localeCompare(b.id) : a.joinedAt - b.joinedAt))
    .map((player) => player.id);
  assert.deepEqual(eerste.value.participants.map((p) => p.playerId), verwacht);
});

test('boven de 100 deelnemers kapt de lijst af en zegt dat ook', async () => {
  const harness = makeHarness();
  const { context } = harness;
  // maxPlayers omhoog, anders weigert joinRoom bij 100 met GAME_FULL en is de
  // afkap-tak onbereikbaar — precies wat PROTOCOL.md beschrijft.
  const { roomId, players } = await seedRoom(harness, {
    extraPlayers: 104,
    roomConfig: { maxPlayers: 120 },
  });
  assert.equal(players.length, 105);

  const snapshot = await buildSnapshot(context, { roomId, sessionId: players[0].sessionId });

  assert.equal(snapshot.value.room.playerCount, 105);
  assert.equal(snapshot.value.participants.length, 100);
  assert.equal(snapshot.value.participantsTruncated, true);
  // Nooit stil afkappen: een client die niet weet dat hij een deel ziet, toont
  // een onvolledige lijst als volledige waarheid.
  assert.deepEqual(validateSnapshotShape(snapshot.value), { ok: true });
});

test('resolveEligibleFromRound geeft 1 zolang er geen lopende match is', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1, roomConfig: { totalRounds: 1 } });

  const inLobby = await resolveEligibleFromRound(context, { roomId });
  assert.deepEqual(inLobby.value, { eligibleFromRound: 1, currentRoundNumber: 1, phase: 'LOBBY', isLateJoin: false });

  const started = await startMatch(context, { roomId });
  // COUNTDOWN telt al als "de match loopt": wie nu joint, speelt vanaf ronde 2.
  const inCountdown = await resolveEligibleFromRound(context, { roomId });
  assert.equal(inCountdown.value.eligibleFromRound, 2);
  assert.equal(inCountdown.value.isLateJoin, true);

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  clock.set(doc.endsAt);
  await endRound(context, { roomId });
  await leaveResultPhase(harness, roomId, (await harness.store.loadRoom(roomId)).config);

  const afterFinish = await resolveEligibleFromRound(context, { roomId });
  assert.equal(afterFinish.value.phase, 'FINISHED');
  assert.equal(afterFinish.value.eligibleFromRound, 1);

  assert.deepEqual(
    await resolveEligibleFromRound(context, { roomId: 'room_bestaat_niet' }),
    { ok: false, code: 'GAME_NOT_FOUND' },
  );
});

test('bij auto-tempo mag ROUND_RESULT de tussenstand wél overslaan', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId } = await seedRoom(harness, {
    extraPlayers: 1,
    roomConfig: { pacing: 'auto', scoreboardFrequency: 'off', totalRounds: 2 },
  });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  clock.set(doc.endsAt);
  await endRound(context, { roomId });

  clock.advance(5000);
  const next = await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } });
  assert.equal(next.ok, true, JSON.stringify(next));
  assert.equal(next.value.phase, 'COUNTDOWN', 'zonder tussenstand loopt auto-tempo rechtstreeks door');
  assert.equal(next.value.roundNumber, 2);
  assert.equal(next.value.phaseEndsAt, clock.value + COUNTDOWN_SECONDS * 1000);
});

// ─── DM19 / INT-7 — dubbele compare-and-set en de verloren race ─────────────
//
// De poort `setRoomAndMatchPhaseAtomically(roomId, matchId, { expectedPhase,
// newPhase, pausedState })` doet sinds DM19 een dubbele compare-and-set en
// schrijft `pausedState` in dezelfde stap. Deze vier tests dekken de kant van
// de COMPOSITIE: geeft ze de fase mee die ze daadwerkelijk gelezen heeft, doet
// ze bij een verloren race het juiste per aanroepplek, en is de losse
// `saveMatch` voor een pauze echt verdwenen.

/**
 * Legt elke poortaanroep vast, inclusief de fase die op dát moment ÉCHT in de
 * store staat — net zoals de actioncachetest de volgorde van de poortaanroepen
 * vastlegt. Levert het echte gedrag door; instrumentatie, geen fake.
 */
function recordPhasePortCalls(store) {
  const seen = [];
  const real = store.setRoomAndMatchPhaseAtomically;
  store.setRoomAndMatchPhaseAtomically = async (roomId, matchId, arg) => {
    const roomBefore = await store.loadRoom(roomId);
    const matchBefore = await store.loadMatch(roomId, matchId);
    const result = await real(roomId, matchId, arg);
    seen.push({
      expectedPhase: arg.expectedPhase,
      newPhase: arg.newPhase,
      pausedState: arg.pausedState,
      roomPhaseInStore: roomBefore.phase,
      matchPhaseInStore: matchBefore.phase,
      ok: result.ok,
    });
    return result;
  };
  return { seen, restore: () => { store.setRoomAndMatchPhaseAtomically = real; } };
}

/**
 * Laat ÉÉN andere schrijver de race winnen: vlak vóór de eerstvolgende
 * poortaanroep van de compositie zet deze wrapper de fase al op `winnerPhase`,
 * en pas daarna gaat de aanroep van de compositie naar de echte poort. Die
 * loopt dan tegen een echte mismatch aan — geen verzonnen `{ ok: false }`.
 */
function loseNextPhaseRace(store, { winnerPhase, winnerMatchId = null }) {
  const real = store.setRoomAndMatchPhaseAtomically;
  let raced = false;
  store.setRoomAndMatchPhaseAtomically = async (roomId, matchId, arg) => {
    if (!raced) {
      raced = true;
      const winner = await real(roomId, winnerMatchId ?? matchId, {
        expectedPhase: arg.expectedPhase,
        newPhase: winnerPhase,
        pausedState: null,
      });
      assert.deepEqual(winner, { ok: true }, 'de winnaar van de race moet zelf wél slagen');
    }
    return real(roomId, matchId, arg);
  };
  return { restore: () => { store.setRoomAndMatchPhaseAtomically = real; } };
}

test('DM19: elke geslaagde overgang geeft de fase mee die de compositie ook echt gelezen heeft', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId } = await seedRoom(harness, {
    extraPlayers: 1,
    roomConfig: { pacing: 'host', totalRounds: 2 },
  });

  const { seen, restore } = recordPhasePortCalls(store);

  const started = await startMatch(context, { roomId });
  assert.equal(started.ok, true, JSON.stringify(started));
  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  assert.equal(round.ok, true, JSON.stringify(round));
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  clock.set(doc.endsAt);
  assert.equal((await endRound(context, { roomId })).ok, true);
  clock.advance(5000);
  assert.equal((await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } })).ok, true);

  assert.deepEqual(
    seen.map((call) => call.newPhase),
    ['COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD'],
  );
  for (const call of seen) {
    assert.equal(call.ok, true, JSON.stringify(call));
    // DE KERN: `expectedPhase` is de fase die op het moment van de aanroep in
    // de store stond — aan BEIDE kanten van de dubbele compare-and-set. Was het
    // een opnieuw afgeleide waarde, dan bewaakte de CAS niets.
    assert.equal(call.expectedPhase, call.matchPhaseInStore, JSON.stringify(call));
    assert.equal(call.expectedPhase, call.roomPhaseInStore, JSON.stringify(call));
    // Buiten PAUSED gaat er nooit een pausedState mee (de poort zou werpen).
    assert.equal(call.pausedState, null, JSON.stringify(call));
  }
  // En elke opeenvolgende aanroep verwacht precies wat de vorige heeft gezet.
  for (let index = 1; index < seen.length; index += 1) {
    assert.equal(seen[index].expectedPhase, seen[index - 1].newPhase);
  }

  restore();
});

test('INT-7: een timergedreven overgang die de race verliest stopt stil en levert geen foutcode op', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId } = await seedRoom(harness, {
    extraPlayers: 1,
    roomConfig: { pacing: 'host', totalRounds: 2 },
  });
  const started = await startMatch(context, { roomId });
  const matchId = started.value.matchId;

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, matchId, round.value.roundId);
  clock.set(doc.endsAt);
  assert.equal((await endRound(context, { roomId })).ok, true);

  // De host stuurt `game:finish` terwijl de fasepomp naar SCOREBOARD wil.
  const race = loseNextPhaseRace(store, { winnerPhase: 'FINISHED' });
  clock.advance(5000);
  const lost = await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } });
  race.restore();

  assert.equal(lost.ok, false, JSON.stringify(lost));
  assert.equal(lost.code, PHASE_RACE_LOST);
  // GEEN foutcode voor een client: `PHASE_RACE_LOST` is bewust niet
  // gepubliceerd, dus er is niets dat de wire kan halen.
  assert.equal(ALL_ERROR_CODES.has(lost.code), false, 'een verloren race mag geen wire-foutcode zijn');
  assert.notEqual(lost.code, 'INVALID_PHASE');
  // Wel intern zichtbaar: wie won, en wat er verwacht werd.
  assert.deepEqual(lost.conflict, {
    eventType: 'TIMER_ELAPSED',
    expectedPhase: 'ROUND_RESULT',
    actualPhase: 'FINISHED',
  });

  // De winnaar blijft staan — de verliezer heeft niets overschreven.
  assert.equal((await store.loadRoom(roomId)).phase, 'FINISHED');
  assert.equal((await store.loadMatch(roomId, matchId)).phase, 'FINISHED');
});

test('INT-7: een hostactie die de race verliest krijgt INVALID_PHASE terug', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId } = await seedRoom(harness, {
    extraPlayers: 1,
    roomConfig: { pacing: 'host', totalRounds: 4 },
  });
  const started = await startMatch(context, { roomId });
  const matchId = started.value.matchId;

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, matchId, round.value.roundId);
  clock.set(doc.endsAt);
  assert.equal((await endRound(context, { roomId })).ok, true);
  clock.advance(5000);
  const scoreboard = await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } });
  assert.equal(scoreboard.value.phase, 'SCOREBOARD');

  // De host drukt op "volgende" op een scherm dat al achterhaald is: iemand
  // anders heeft de match intussen afgesloten.
  const race = loseNextPhaseRace(store, { winnerPhase: 'FINISHED' });
  clock.advance(1000);
  const lost = await advancePhase(context, { roomId, event: { type: 'HOST_NEXT' } });
  race.restore();

  assert.equal(lost.ok, false, JSON.stringify(lost));
  assert.equal(lost.code, 'INVALID_PHASE', 'geen nieuwe foutcode: deze betekent precies dit');
  assert.equal(ALL_ERROR_CODES.has(lost.code), true, 'de host moet een gepubliceerde code krijgen');
  assert.deepEqual(lost.conflict, {
    eventType: 'HOST_NEXT',
    expectedPhase: 'SCOREBOARD',
    actualPhase: 'FINISHED',
  });
  assert.equal((await store.loadRoom(roomId)).phase, 'FINISHED');
  assert.equal((await store.loadMatch(roomId, matchId)).phase, 'FINISHED');

  // Zelfde behandeling voor `game:rematch`: ook een hostknop, ook een
  // gepubliceerde code. De tweede hosttab las FINISHED en drukt op "opnieuw"
  // terwijl de eerste tab de room al naar LOBBY heeft gebracht; de verliezer
  // laat room, spelers en de lopende match ongemoeid en laat alleen een
  // ongerefereerd Match-document achter.
  const scoresBefore = (await store.listPlayers(roomId)).map((player) => [player.id, player.score]);
  const rematchRace = loseNextPhaseRace(store, { winnerPhase: 'LOBBY', winnerMatchId: matchId });
  const lostRematch = await rematch(context, { roomId });
  rematchRace.restore();

  assert.equal(lostRematch.ok, false, JSON.stringify(lostRematch));
  assert.equal(lostRematch.code, 'INVALID_PHASE');
  assert.equal(lostRematch.conflict.eventType, 'HOST_REMATCH');
  assert.equal(lostRematch.conflict.expectedPhase, 'FINISHED');
  const roomAfter = await store.loadRoom(roomId);
  assert.equal(roomAfter.currentMatchId, matchId, 'de room wijst nog naar de match van de winnaar');
  assert.equal(roomAfter.phase, 'LOBBY', 'de fase van de winnaar staat er nog');
  assert.deepEqual(
    (await store.listPlayers(roomId)).map((player) => [player.id, player.score]),
    scoresBefore,
    'een verloren rematch heeft geen enkele speler gereset',
  );
});

test('DM19: een pauze zet fase én pausedState in ÉÉN poortaanroep — de losse saveMatch is weg', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });
  const matchId = started.value.matchId;

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, matchId, round.value.roundId);

  // Instrumentatie op de poort, net als bij de actioncachetest: legt vast WELKE
  // schrijfacties een pauze veroorzaakt. Vóór DM19 stond hier eerst een
  // `saveMatch` met de nieuwe `pausedState` en pas daarna de fasewissel — het
  // niet-atomaire dual-write-pad dat INT-16 aankaartte.
  const calls = [];
  const realSaveMatch = store.saveMatch;
  const realPort = store.setRoomAndMatchPhaseAtomically;
  store.saveMatch = async (match) => {
    calls.push({ call: 'saveMatch', phase: match.phase, pausedState: match.pausedState });
    return realSaveMatch(match);
  };
  store.setRoomAndMatchPhaseAtomically = async (rid, mid, arg) => {
    calls.push({ call: 'setRoomAndMatchPhaseAtomically', ...arg });
    return realPort(rid, mid, arg);
  };

  clock.advance(4000);
  const pausedAt = clock.value;
  const paused = await advancePhase(context, { roomId, event: { type: 'HOST_PAUSE', reason: 'host' } });
  assert.equal(paused.ok, true, JSON.stringify(paused));

  const expectedPausedState = {
    previousPhase: 'ROUND_ACTIVE',
    remainingMs: doc.endsAt - pausedAt,
    reason: 'host',
    pausedAt,
  };
  assert.deepEqual(calls, [{
    call: 'setRoomAndMatchPhaseAtomically',
    expectedPhase: 'ROUND_ACTIVE',
    newPhase: 'PAUSED',
    pausedState: expectedPausedState,
  }], 'een pauze is precies één schrijfactie: fase + pausedState samen');
  assert.deepEqual((await store.loadMatch(roomId, matchId)).pausedState, expectedPausedState);
  assert.equal((await store.loadRoom(roomId)).phase, 'PAUSED');

  // En de hervatting net zo: pausedState terug naar null in dezelfde stap.
  calls.length = 0;
  clock.advance(9000);
  const resumed = await advancePhase(context, { roomId, event: { type: 'HOST_RESUME' } });
  assert.equal(resumed.ok, true, JSON.stringify(resumed));
  assert.deepEqual(calls, [{
    call: 'setRoomAndMatchPhaseAtomically',
    expectedPhase: 'PAUSED',
    newPhase: 'ROUND_ACTIVE',
    pausedState: null,
  }]);
  assert.equal((await store.loadMatch(roomId, matchId)).pausedState, null);
  assert.equal(
    calls.filter((entry) => entry.call === 'saveMatch').length,
    0,
    'geen enkele losse saveMatch meer rond een fasewissel met pausedState',
  );

  store.saveMatch = realSaveMatch;
  store.setRoomAndMatchPhaseAtomically = realPort;
});

// ─────────────────────────────────────────────────────────────────────────────
// §A0 (5 aug 2026): een contentbron die niet kan leveren, mag geen stille hang
// worden. `startRound` draait op de fasepomp — een throw daar verdwijnt in een
// unhandled rejection en de room blijft in COUNTDOWN staan zonder foutcode.
// ─────────────────────────────────────────────────────────────────────────────

test('§A0: startRound met een gameType die de contentbron niet kan bouwen geeft CONTENT_UNAVAILABLE i.p.v. te werpen', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;

  // `capitals_mc` is een geldige Golf-1-gameType maar staat niet in
  // FILLED_GAME_TYPES — precies de situatie die op 4 aug via de carrousel voor
  // `real_or_fake_flag` ontstond. Sinds §A1 komt zo'n config niet meer door
  // `resolveGameConfiguration`, dus die trechter wordt hier bewust omzeild:
  // dit is de tweede verdedigingslinie, voor een room die er tóch staat (oude
  // Redis-state, handmatige ingreep, een toekomstige schrijver die de trechter
  // mist).
  const { roomId } = await seedRoom(harness, { extraPlayers: 1 });
  const seeded = await store.loadRoom(roomId);
  await store.saveRoom({ ...seeded, config: { ...seeded.config, gameTypes: ['capitals_mc'] } });

  const started = await startMatch(context, { roomId });
  assert.equal(started.ok, true, JSON.stringify(started));

  clock.advance(COUNTDOWN_SECONDS * 1000);
  let result;
  await assert.doesNotReject(async () => {
    result = await startRound(context, { roomId });
  }, 'startRound mag niet werpen — de fasepomp vangt niets op');

  assert.equal(result.ok, false);
  assert.equal(result.code, 'CONTENT_UNAVAILABLE');
  assert.equal(result.contentFailure.gameType, 'capitals_mc');
  assert.equal(typeof result.contentFailure.reason, 'string');
  assert.ok(result.contentFailure.reason.length > 0, 'de reden hoort in de log te belanden, niet verloren te gaan');

  // Geen half Round-document en geen fasewissel achtergelaten.
  const room = await store.loadRoom(roomId);
  assert.equal(room.phase, 'COUNTDOWN');
  const match = await store.loadMatch(roomId, started.value.matchId);
  assert.deepEqual(match.roundIds, []);
});

test('§A0: CONTENT_UNAVAILABLE is intern en mag nooit een gepubliceerde foutcode worden', () => {
  assert.equal(ALL_ERROR_CODES.has(CONTENT_UNAVAILABLE), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// §A3 (5 aug 2026) — ÉÉN ketencontract voor rang bij een gelijke stand.
//
// De tussenstand telde `index + 1`, de eindstand gebruikte `rankPlayers()` en
// de snapshot deed allebei tegelijk (`top[].rank` uit de index, `self.position`
// uit de rangschikker). Een tie zag er in elk scherm anders uit. Deze test
// vergelijkt de drie payloads bij een échte gelijke stand.
// ─────────────────────────────────────────────────────────────────────────────

test('§A3: bij een gelijke stand geven scoreboard, snapshot en eindstand exact dezelfde posities', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players, room } = await seedRoom(harness, {
    extraPlayers: 3,
    roomConfig: { speedBonus: false, totalRounds: 1 },
  });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  // Drie spelers goed op exact hetzelfde moment (zonder snelheidsbonus dus
  // volledig gelijk: score, correctCount én responstijd), één fout.
  // Competitierang hoort dan 1-1-1-4 te zijn.
  clock.advance(1000);
  for (const player of [players[0], players[1], players[2]]) {
    const answered = await submitAnswer(context, {
      roomId, playerId: player.playerId, roundId: doc.id,
      answer: { optionId: doc.correctAnswer.optionId }, actionId: `tie_${player.playerId}`,
    });
    assert.equal(answered.ok, true, JSON.stringify(answered));
  }
  const wrongOption = doc.publicQuestionPayload.optionIso2s.find((iso2) => iso2 !== doc.correctAnswer.optionId);
  await submitAnswer(context, {
    roomId, playerId: players[3].playerId, roundId: doc.id,
    answer: { optionId: wrongOption }, actionId: 'tie_wrong',
  });

  clock.set(doc.endsAt);
  await endRound(context, { roomId });

  const scoreboard = await getScoreboard(context, { roomId });
  assert.equal(scoreboard.ok, true, JSON.stringify(scoreboard));
  const scoreboardByPlayer = new Map(scoreboard.value.top.map((entry) => [entry.playerId, entry.rank]));

  const snapshot = await buildSnapshot(context, { roomId, sessionId: room.sessionId });
  assert.equal(snapshot.ok, true, JSON.stringify(snapshot));
  const snapshotByPlayer = new Map(snapshot.value.scoreboard.top.map((entry) => [entry.playerId, entry.rank]));

  const finished = await finishMatch(context, { roomId });
  assert.equal(finished.ok, true, JSON.stringify(finished));
  const finishedByPlayer = new Map(finished.value.standings.map((entry) => [entry.playerId, entry.position]));

  // 1. De regel zelf: gedeelde plaats, en daarna doortellen (1-1-1-4).
  assert.deepEqual(
    [...finishedByPlayer.values()].sort((a, b) => a - b),
    [1, 1, 1, 4],
    'competitierangschikking: drie gedeelde eersten, dan plaats 4',
  );

  // 2. Het ketencontract: drie payloads, één antwoord per speler.
  for (const player of players) {
    const id = player.playerId;
    assert.equal(
      scoreboardByPlayer.get(id),
      finishedByPlayer.get(id),
      `tussenstand en eindstand moeten dezelfde positie geven voor ${id}`,
    );
    assert.equal(
      snapshotByPlayer.get(id),
      finishedByPlayer.get(id),
      `snapshot en eindstand moeten dezelfde positie geven voor ${id}`,
    );
  }

  // 3. En binnen de snapshot spreken de toplijst en de eigen regel elkaar niet
  //    tegen — dat was vóór §A3 letterlijk mogelijk.
  const selfId = snapshot.value.self.playerId;
  assert.equal(snapshot.value.self.position, snapshotByPlayer.get(selfId));
});

// ─────────────────────────────────────────────────────────────────────────────
// C-3 (5 aug 2026) — herstel na een serverherstart (ARCHITECTURE §10).
// ─────────────────────────────────────────────────────────────────────────────

test('§C-3: recoverActiveRooms zet een lopende match op PAUSED(server_recovery) en laat de scores staan', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId, players } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  // Eén speler antwoordt goed vlak vóór de "herstart".
  clock.advance(1000);
  const ack = await submitAnswer(context, {
    roomId, playerId: players[0].playerId, roundId: doc.id,
    answer: { optionId: doc.correctAnswer.optionId }, actionId: 'voor_herstart',
  });
  assert.equal(ack.ok, true, JSON.stringify(ack));
  const scoreVoor = (await store.loadPlayer(roomId, players[0].playerId)).score;
  assert.ok(scoreVoor > 0, 'punten worden bij het antwoord toegekend, niet pas bij het sluiten van de ronde');

  // ── de herstart ──
  const hersteld = await recoverActiveRooms(context);
  assert.equal(hersteld.ok, true, JSON.stringify(hersteld));
  assert.equal(hersteld.value.scanned, 1);
  assert.equal(hersteld.value.recovered, 1);
  assert.deepEqual(hersteld.value.outcomes, [{ roomId, outcome: 'paused' }]);

  const match = await store.loadMatch(roomId, started.value.matchId);
  assert.equal(match.phase, 'PAUSED');
  assert.equal(match.pausedState.reason, 'server_recovery');
  assert.equal(match.pausedState.previousPhase, 'ROUND_ACTIVE');
  assert.equal(match.pausedState.remainingMs, 0, 'we beloven geen resttijd voor een fase die we niet hervatten');
  assert.equal((await store.loadRoom(roomId)).phase, 'PAUSED');

  // De punten van vóór de herstart staan er nog.
  assert.equal((await store.loadPlayer(roomId, players[0].playerId)).score, scoreVoor);
});

test('§C-3: hervatten na een herstelpauze gaat via een nieuwe aftelling, niet terug de oude ronde in', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  await recoverActiveRooms(context);

  // De host drukt op hervatten.
  clock.advance(30_000);
  const hervat = await advancePhase(context, { roomId, event: { type: 'HOST_RESUME' } });
  assert.equal(hervat.ok, true, JSON.stringify(hervat));
  assert.equal(hervat.value.phase, 'COUNTDOWN', 'een herstelpauze hervat NOOIT de onderbroken ronde');

  const match = await store.loadMatch(roomId, started.value.matchId);
  assert.equal(match.pausedState, null);

  // En de volgende ronde is een NIEUWE ronde, niet de onderbroken.
  clock.advance(COUNTDOWN_SECONDS * 1000);
  const volgende = await startRound(context, { roomId });
  assert.equal(volgende.ok, true, JSON.stringify(volgende));
  assert.notEqual(volgende.value.roundId, round.value.roundId);
});

test('§C-3: een gewone hostpauze hervat wél de fase waar hij vandaan kwam', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1 });
  await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  await startRound(context, { roomId });

  clock.advance(1000);
  const gepauzeerd = await advancePhase(context, { roomId, event: { type: 'HOST_PAUSE' } });
  assert.equal(gepauzeerd.ok, true, JSON.stringify(gepauzeerd));

  clock.advance(5000);
  const hervat = await advancePhase(context, { roomId, event: { type: 'HOST_RESUME' } });
  assert.equal(hervat.value.phase, 'ROUND_ACTIVE', 'alleen de herstelreden stuurt naar COUNTDOWN');
});

test('§C-3: recoverActiveRooms is idempotent en slaat over wat niet onderweg is', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;

  const lobby = await seedRoom(harness, { extraPlayers: 1 });            // nog geen match
  const lopend = await seedRoom(harness, { extraPlayers: 1 });
  await startMatch(context, { roomId: lopend.roomId });
  clock.advance(COUNTDOWN_SECONDS * 1000);
  await startRound(context, { roomId: lopend.roomId });

  const eerste = await recoverActiveRooms(context);
  const uitkomsten = new Map(eerste.value.outcomes.map((entry) => [entry.roomId, entry.outcome]));
  assert.equal(uitkomsten.get(lobby.roomId), 'no_match');
  assert.equal(uitkomsten.get(lopend.roomId), 'paused');

  // Tweede keer (herstart tijdens het herstel): niets verandert nog.
  const tweede = await recoverActiveRooms(context);
  const nogmaals = new Map(tweede.value.outcomes.map((entry) => [entry.roomId, entry.outcome]));
  assert.equal(nogmaals.get(lopend.roomId), 'already_paused');
  assert.equal(tweede.value.recovered, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// R2-7 (5 aug 2026) — pauzeren mag geen antwoordtijd opeten.
//
// `Round.endsAt` werd één keer geschreven en bij hervatten nooit opgeschoven,
// terwijl de pauze de resterende tijd wél bewaarde. Acht seconden pauze kostte
// acht seconden antwoordtijd. De mocktransport deed dit goed, dus geen enkele
// test of mockmeting zag het.
// ─────────────────────────────────────────────────────────────────────────────

test('§R2-7: hervatten schuift de rondedeadline op met de pauzeduur', async () => {
  const harness = makeHarness();
  const { context, store, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1 });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  const origineel = doc.endsAt;

  // Vier seconden gespeeld, dan pauzeren: er staat nog resterende tijd open.
  clock.advance(4000);
  const gepauzeerd = await advancePhase(context, { roomId, event: { type: 'HOST_PAUSE' } });
  assert.equal(gepauzeerd.ok, true, JSON.stringify(gepauzeerd));
  const rest = gepauzeerd.value.pausedState.remainingMs;
  assert.ok(rest > 0, 'de pauze bewaart de resterende tijd');

  // Acht seconden gepauzeerd — die mogen niet van de antwoordtijd af.
  clock.advance(8000);
  const hervat = await advancePhase(context, { roomId, event: { type: 'HOST_RESUME' } });
  assert.equal(hervat.ok, true, JSON.stringify(hervat));
  assert.equal(hervat.value.phase, 'ROUND_ACTIVE');

  const na = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  assert.equal(na.endsAt, clock.value + rest, 'de deadline begint opnieuw bij de resterende tijd');
  assert.equal(na.endsAt - origineel, 8000, 'precies de pauzeduur erbij, niet meer en niet minder');

  // En de transportlaag moet zijn timer opnieuw kunnen plannen.
  assert.equal(hervat.value.roundEndsAt, na.endsAt);
  assert.equal(hervat.value.roundId, round.value.roundId);

  // De ronde is daarna gewoon af te maken — vóór deze fix hing hij hier.
  clock.set(na.endsAt);
  const geeindigd = await endRound(context, { roomId });
  assert.equal(geeindigd.ok, true, JSON.stringify(geeindigd));
});

test('§R2-7: buiten een lopende ronde kán er niet gepauzeerd worden, dus verschuift er ook niets', async () => {
  const harness = makeHarness();
  const { context, clock } = harness;
  const { roomId } = await seedRoom(harness, { extraPlayers: 1, roomConfig: { pacing: 'host' } });
  const started = await startMatch(context, { roomId });

  clock.advance(COUNTDOWN_SECONDS * 1000);
  const round = await startRound(context, { roomId });
  const doc = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);

  clock.set(doc.endsAt);
  await endRound(context, { roomId });

  // Besluit 12: alleen tijdens ROUND_ACTIVE is de resterende tijd uit
  // persistente state af te leiden. In ROUND_RESULT levert een pauze intern
  // INVALID_PAUSE_STATE op, wat naar buiten INVALID_PHASE wordt. Dat is
  // bestaand, bekend gedrag — hier vastgelegd omdat het precies de reden is
  // dat de deadline-herberekening alleen over ROUND_ACTIVE hoeft te gaan.
  clock.advance(1000);
  const gepauzeerd = await advancePhase(context, { roomId, event: { type: 'HOST_PAUSE' } });
  assert.equal(gepauzeerd.ok, false);
  assert.equal(gepauzeerd.code, 'INVALID_PHASE');

  const na = await loadRoundDoc(harness, roomId, started.value.matchId, round.value.roundId);
  assert.equal(na.endsAt, doc.endsAt, 'de afgesloten ronde blijft ongemoeid');
});
