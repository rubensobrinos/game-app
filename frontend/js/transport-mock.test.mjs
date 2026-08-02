import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockTransport } from './transport-mock.mjs';

// Rondetiming uit transport-mock.mjs, gedupliceerd hier zodat tests exact
// weten hoeveel virtuele tijd ze via `mock.timers.tick()` moeten laten
// verlopen om een faseovergang te forceren. `startRound()` plant zijn
// endRound-timer op basis van `endsAt - Date.now()`, waarbij `endsAt` zelf
// ~250ms na het moment van plannen ligt (`startsAt = Date.now() + 250`) --
// vandaar de marge bovenop de kale constantes.
const COUNTDOWN_TICK_MS = 1300; // > COUNTDOWN_MS (1200)
const ROUND_ACTIVE_TICK_MS = 8300; // > ROUND_ACTIVE_MS (8000) + startsAt-marge
const ROUND_RESULT_TICK_MS = 2600; // > ROUND_RESULT_MS (2500)
const SCOREBOARD_TICK_MS = 2600; // > SCOREBOARD_AUTO_ADVANCE_MS (2500)

function withFakeTimers(fn) {
  return async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      await fn();
    } finally {
      mock.timers.reset();
    }
  };
}

/** Host+player room, gestart en getikt tot ronde 1 actief is. */
async function createRoomInRound1() {
  const transport = createMockTransport();
  const created = await transport.createGame({ config: {}, hostParticipates: true, displayName: 'Host' });
  const hostConn = transport.connect(created.sessionToken, { onEvent: () => {} });
  await hostConn.send('game:start', 'act_start', {});
  mock.timers.tick(COUNTDOWN_TICK_MS);
  return { transport, created, hostConn };
}

function answerPayloadFor(round) {
  return { roundId: round.roundId, answer: { optionId: round.question.optionIso2s[0] } };
}

// ---------------------------------------------------------------------------
// create -> preview -> join happy path
// ---------------------------------------------------------------------------

test('create -> previewInvite -> joinGame happy path matches PROTOCOL.md field/shape names', async () => {
  const transport = createMockTransport();

  const created = await transport.createGame({ config: { language: 'nl' }, hostParticipates: true, displayName: 'Ruben' });
  assert.equal(typeof created.roomId, 'string');
  assert.equal(typeof created.gameCode, 'string');
  assert.equal(typeof created.inviteId, 'string');
  assert.equal(typeof created.joinUrl, 'string');
  assert.equal(typeof created.sessionToken, 'string');
  assert.deepEqual(created.roles, ['host', 'player']);
  assert.equal(typeof created.playerId, 'string');
  assert.equal(created.effectiveName, 'Ruben');
  assert.equal(created.state.protocolVersion, 'v1');
  assert.equal(created.state.room.code, created.gameCode);
  assert.equal(created.state.self.playerId, created.playerId);

  const preview = await transport.previewInvite(created.inviteId);
  assert.equal(preview.roomId, created.roomId);
  assert.equal(preview.phase, 'LOBBY');
  assert.equal(preview.locked, false);
  assert.equal(preview.allowLateJoin, true);
  assert.equal(preview.playerCount, 1);
  assert.equal(preview.maxPlayers, 100);
  assert.equal(typeof preview.suggestedName, 'string');
  assert.equal('sessionToken' in preview, false);
  assert.equal('playerId' in preview, false);

  const joined = await transport.joinGame({ inviteId: created.inviteId, displayName: 'Sanne', joinSource: 'qr' });
  assert.equal(joined.roomId, created.roomId);
  assert.equal(joined.gameCode, created.gameCode);
  assert.equal(typeof joined.sessionToken, 'string');
  assert.deepEqual(joined.roles, ['player']);
  assert.equal(typeof joined.playerId, 'string');
  assert.equal(joined.effectiveName, 'Sanne');
  assert.equal(joined.state.room.playerCount, 2);
});

test('createGame with hostParticipates: false leaves playerId/effectiveName null', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ hostParticipates: false });
  assert.deepEqual(created.roles, ['host']);
  assert.equal(created.playerId, null);
  assert.equal(created.effectiveName, null);
});

// ---------------------------------------------------------------------------
// previewInvite is invite-only
// ---------------------------------------------------------------------------

test('previewInvite never accepts a gameCode as a valid lookup', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  await assert.rejects(() => transport.previewInvite(created.gameCode), (err) => err.code === 'GAME_NOT_FOUND');
});

test('previewInvite ignores any extra argument -- it never needs a gameCode', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const preview = await transport.previewInvite(created.inviteId, created.gameCode);
  assert.equal(preview.roomId, created.roomId);
});

test('previewInvite rejects a malformed inviteId with INVITE_INVALID', async () => {
  const transport = createMockTransport();
  await transport.createGame({});
  await assert.rejects(() => transport.previewInvite('not a valid invite id!'), (err) => err.code === 'INVITE_INVALID');
});

// ---------------------------------------------------------------------------
// joinGame request-shape validation (Fix 3)
// ---------------------------------------------------------------------------

test('joinGame rejects a request with both inviteId and gameCode', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  await assert.rejects(
    () => transport.joinGame({ inviteId: created.inviteId, gameCode: created.gameCode, joinSource: 'code' }),
    (err) => err.code === 'INVITE_INVALID',
  );
});

test('joinGame rejects a request with neither inviteId nor gameCode', async () => {
  const transport = createMockTransport();
  await transport.createGame({});
  await assert.rejects(() => transport.joinGame({ displayName: 'X' }), (err) => err.code === 'INVITE_INVALID');
});

test('joinGame rejects non-string inviteId/gameCode values', async () => {
  const transport = createMockTransport();
  await transport.createGame({});
  await assert.rejects(() => transport.joinGame({ inviteId: 12345 }), (err) => err.code === 'INVITE_INVALID');
  await assert.rejects(() => transport.joinGame({ gameCode: true }), (err) => err.code === 'INVITE_INVALID');
});

test('joinGame rejects an unrecognized joinSource value', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  await assert.rejects(
    () => transport.joinGame({ inviteId: created.inviteId, joinSource: 'carrier_pigeon' }),
    (err) => err.code === 'INVITE_INVALID',
  );
});

test('joinGame accepts each documented joinSource value', async () => {
  for (const joinSource of ['qr', 'shared_link', 'code', 'unknown']) {
    const transport = createMockTransport();
    const created = await transport.createGame({});
    const joined = await transport.joinGame({ inviteId: created.inviteId, joinSource });
    assert.deepEqual(joined.roles, ['player']);
  }
});

test('joinGame allows omitting joinSource entirely', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const joined = await transport.joinGame({ inviteId: created.inviteId });
  assert.deepEqual(joined.roles, ['player']);
});

// ---------------------------------------------------------------------------
// Host vs. player authorization on every game:*/player:*/round:answer action
// ---------------------------------------------------------------------------

test('host-only socket actions reject a player-only session with NOT_HOST', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ hostParticipates: false });
  const joined = await transport.joinGame({ inviteId: created.inviteId });
  const conn = transport.connect(joined.sessionToken, { onEvent: () => {} });
  const hostOnlyEvents = [
    'game:start',
    'game:pause',
    'game:resume',
    'game:next',
    'game:lock',
    'game:kick',
    'game:finish',
    'game:rematch',
  ];
  for (const event of hostOnlyEvents) {
    await assert.rejects(
      () => conn.send(event, `act_${event}`, {}),
      (err) => err.code === 'NOT_HOST',
      `${event} should reject a non-host session with NOT_HOST`,
    );
  }
});

test('player-only socket actions reject a host-only session with NOT_PLAYER', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ hostParticipates: false });
  const conn = transport.connect(created.sessionToken, { onEvent: () => {} });
  const playerOnlyEvents = ['player:rename', 'player:leave', 'round:answer'];
  for (const event of playerOnlyEvents) {
    await assert.rejects(
      () => conn.send(event, `act_${event}`, {}),
      (err) => err.code === 'NOT_PLAYER',
      `${event} should reject a non-player session with NOT_PLAYER`,
    );
  }
});

test('share:opened is allowed for host-only and player-only sessions alike', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ hostParticipates: false });
  const hostAck = await transport.connect(created.sessionToken, { onEvent: () => {} }).send('share:opened', 'act_1', { method: 'qr' });
  assert.equal(hostAck.ok, true);
  const joined = await transport.joinGame({ inviteId: created.inviteId });
  const playerAck = await transport.connect(joined.sessionToken, { onEvent: () => {} }).send('share:opened', 'act_2', { method: 'link' });
  assert.equal(playerAck.ok, true);
});

test('an unsupported event yields UNSUPPORTED_EVENT', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const conn = transport.connect(created.sessionToken, { onEvent: () => {} });
  await assert.rejects(() => conn.send('totally:unknown', 'act_1', {}), (err) => err.code === 'UNSUPPORTED_EVENT');
});

// ---------------------------------------------------------------------------
// actionId idempotency (Fix 1)
// ---------------------------------------------------------------------------

test(
  'actionId idempotency: repeating game:start returns the identical ack and does not re-run the mutation',
  withFakeTimers(async () => {
    const transport = createMockTransport();
    const created = await transport.createGame({});
    const conn = transport.connect(created.sessionToken, { onEvent: () => {} });

    const ack1 = await conn.send('game:start', 'act_start_1', {});
    const ack2 = await conn.send('game:start', 'act_start_1', {});
    assert.deepEqual(ack2, ack1);

    // A genuinely new actionId hits the handler for real -- and since the
    // room already left LOBBY (only once, thanks to the cache above), it
    // correctly fails, proving the mutation ran exactly once.
    await assert.rejects(() => conn.send('game:start', 'act_start_2', {}), (err) => err.code === 'INVALID_PHASE');
  }),
);

test(
  'actionId idempotency: repeating round:answer returns the identical ack and scores only once',
  withFakeTimers(async () => {
    const { transport, created, hostConn } = await createRoomInRound1();
    const state = await transport.fetchState(created.gameCode, created.sessionToken);
    const payload = answerPayloadFor(state.currentRound);

    const ack1 = await hostConn.send('round:answer', 'act_answer_1', payload);
    const afterFirst = await transport.fetchState(created.gameCode, created.sessionToken);

    const ack2 = await hostConn.send('round:answer', 'act_answer_1', payload);
    const afterSecond = await transport.fetchState(created.gameCode, created.sessionToken);

    assert.deepEqual(ack2, ack1);
    assert.equal(afterSecond.self.score, afterFirst.self.score);
    assert.equal(afterSecond.self.answeredCurrentRound, true);
  }),
);

test(
  'a genuinely duplicate answer (new actionId, already answered) gets ALREADY_ANSWERED',
  withFakeTimers(async () => {
    const { transport, created, hostConn } = await createRoomInRound1();
    const state = await transport.fetchState(created.gameCode, created.sessionToken);
    const payload = answerPayloadFor(state.currentRound);

    await hostConn.send('round:answer', 'act_answer_1', payload);
    await assert.rejects(
      () => hostConn.send('round:answer', 'act_answer_2', payload),
      (err) => err.code === 'ALREADY_ANSWERED',
    );
  }),
);

// ---------------------------------------------------------------------------
// Late-join eligibility (Fix 2)
// ---------------------------------------------------------------------------

test(
  'late-join eligibility: a mid-match joiner cannot answer before eligibleFromRound, and can from it onward',
  withFakeTimers(async () => {
    const { transport, created } = await createRoomInRound1();

    const joined = await transport.joinGame({ inviteId: created.inviteId, displayName: 'Laatkomer' });
    // roundIndex is 0 (round 1 active) -> eligibleFromRound = roundIndex + 2 = 2.
    assert.equal(joined.state.self.eligibleFromRound, 2);
    const lateConn = transport.connect(joined.sessionToken, { onEvent: () => {} });

    let state = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.currentRound.roundNumber, 1);
    await assert.rejects(
      () => lateConn.send('round:answer', 'act_late_1', answerPayloadFor(state.currentRound)),
      (err) => err.code === 'PLAYER_NOT_ELIGIBLE',
    );

    // Drive round 1 to completion and into round 2 (SCOREBOARD -> auto-advance, pacing: auto).
    mock.timers.tick(ROUND_ACTIVE_TICK_MS);
    mock.timers.tick(ROUND_RESULT_TICK_MS);
    mock.timers.tick(SCOREBOARD_TICK_MS);

    state = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.room.phase, 'ROUND_ACTIVE');
    assert.equal(state.currentRound.roundNumber, 2);

    const ack = await lateConn.send('round:answer', 'act_late_2', answerPayloadFor(state.currentRound));
    assert.equal(ack.ok, true);
  }),
);

// ---------------------------------------------------------------------------
// Lock / kick / leave
// ---------------------------------------------------------------------------

test('game:lock prevents subsequent joinGame with ROOM_LOCKED', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const conn = transport.connect(created.sessionToken, { onEvent: () => {} });
  const ack = await conn.send('game:lock', 'act_lock', { locked: true });
  assert.deepEqual(ack.payload, {});

  await assert.rejects(
    () => transport.joinGame({ inviteId: created.inviteId, displayName: 'TooLate' }),
    (err) => err.code === 'ROOM_LOCKED',
  );

  await conn.send('game:lock', 'act_unlock', { locked: false });
  const joined = await transport.joinGame({ inviteId: created.inviteId, displayName: 'OnTime' });
  assert.deepEqual(joined.roles, ['player']);
});

test(
  'game:kick deactivates the player and their session can no longer answer',
  withFakeTimers(async () => {
    const transport = createMockTransport();
    const created = await transport.createGame({});
    const joined = await transport.joinGame({ inviteId: created.inviteId, displayName: 'Kickme' });
    const hostConn = transport.connect(created.sessionToken, { onEvent: () => {} });
    const targetConn = transport.connect(joined.sessionToken, { onEvent: () => {} });

    const kickAck = await hostConn.send('game:kick', 'act_kick', { playerId: joined.playerId });
    assert.equal(kickAck.ok, true);

    const state = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.room.playerCount, 1);

    await hostConn.send('game:start', 'act_start', {});
    mock.timers.tick(COUNTDOWN_TICK_MS);
    const active = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(active.room.phase, 'ROUND_ACTIVE');

    await assert.rejects(
      () => targetConn.send('round:answer', 'act_answer', answerPayloadFor(active.currentRound)),
      (err) => err.code === 'PLAYER_NOT_ELIGIBLE',
    );
  }),
);

test('player:leave deactivates the player and lowers playerCount, but leaves the session usable', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const joined = await transport.joinGame({ inviteId: created.inviteId, displayName: 'Vertrekker' });
  const conn = transport.connect(joined.sessionToken, { onEvent: () => {} });

  const leaveAck = await conn.send('player:leave', 'act_leave', {});
  assert.equal(leaveAck.ok, true);

  const state = await transport.fetchState(created.gameCode, joined.sessionToken);
  assert.equal(state.room.playerCount, 1);
});

// ---------------------------------------------------------------------------
// Pause / resume
// ---------------------------------------------------------------------------

test(
  'game:pause stops the active round timer -- a paused room does not silently advance',
  withFakeTimers(async () => {
    const { transport, created, hostConn } = await createRoomInRound1();

    const pauseAck = await hostConn.send('game:pause', 'act_pause', { reason: 'host' });
    assert.equal(pauseAck.ok, true);

    let state = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.room.phase, 'PAUSED');
    assert.equal(state.room.pausedState.previousPhase, 'ROUND_ACTIVE');
    assert.equal(state.room.pausedState.reason, 'host');
    assert.equal(typeof state.room.pausedState.remainingMs, 'number');
    assert.ok(state.room.pausedState.remainingMs > 0);

    // Advance well past what would have been the round's natural end --
    // the room must still be PAUSED because pauseGame() clears pending timers.
    mock.timers.tick(ROUND_ACTIVE_TICK_MS + ROUND_RESULT_TICK_MS + SCOREBOARD_TICK_MS);
    state = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.room.phase, 'PAUSED');

    const resumeAck = await hostConn.send('game:resume', 'act_resume', {});
    assert.equal(resumeAck.ok, true);
    state = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.room.phase, 'ROUND_ACTIVE');
    assert.equal(state.room.pausedState, null);

    // Resume reschedules the remaining round time -- it should still end normally.
    mock.timers.tick(ROUND_ACTIVE_TICK_MS);
    state = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.room.phase, 'ROUND_RESULT');
  }),
);

test('game:resume outside of PAUSED is rejected with INVALID_PHASE', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const conn = transport.connect(created.sessionToken, { onEvent: () => {} });
  await assert.rejects(() => conn.send('game:resume', 'act_resume', {}), (err) => err.code === 'INVALID_PHASE');
});

// ---------------------------------------------------------------------------
// Snapshot / round:started shape
// ---------------------------------------------------------------------------

test(
  'buildSnapshot never leaks correctAnswer during an active round',
  withFakeTimers(async () => {
    const { transport, created } = await createRoomInRound1();

    const state = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.room.phase, 'ROUND_ACTIVE');
    assert.equal('correctAnswer' in state.currentRound, false);
    assert.deepEqual(Object.keys(state.currentRound).sort(), [
      'contentVersion',
      'endsAt',
      'gameType',
      'question',
      'rendererVersion',
      'roundId',
      'roundNumber',
      'startsAt',
      'totalRounds',
    ]);
    assert.equal(state.currentRound.contentVersion, '2026.08.1');
    assert.equal(state.currentRound.gameType, 'flags_mc');
  }),
);

test(
  'round:started event carries no correctAnswer; round:ended does',
  withFakeTimers(async () => {
    const transport = createMockTransport();
    const created = await transport.createGame({});
    const events = [];
    // One connection per sessionToken: connect() replaces any prior listener
    // for that token, so listening and sending must share the connection.
    const conn = transport.connect(created.sessionToken, { onEvent: (envelope) => events.push(envelope) });

    await conn.send('game:start', 'act_start', {});
    mock.timers.tick(COUNTDOWN_TICK_MS);

    const startedEvent = events.find((e) => e.event === 'round:started');
    assert.ok(startedEvent !== undefined);
    assert.equal('correctAnswer' in startedEvent.payload, false);

    mock.timers.tick(ROUND_ACTIVE_TICK_MS);
    const endedEvent = events.find((e) => e.event === 'round:ended');
    assert.ok(endedEvent !== undefined);
    assert.equal(typeof endedEvent.payload.correctAnswer.optionId, 'string');
  }),
);

// ---------------------------------------------------------------------------
// Rematch
// ---------------------------------------------------------------------------

test(
  'game:rematch creates a new matchId, increments matchSequence, and resets scores',
  withFakeTimers(async () => {
    const { transport, created, hostConn } = await createRoomInRound1();
    const beforeState = await transport.fetchState(created.gameCode, created.sessionToken);
    const originalMatchId = beforeState.room.matchId;
    const originalSequence = beforeState.room.matchSequence;

    // Answer correctly-or-not, then race the match to FINISHED (5 questions).
    for (let i = 0; i < 5; i += 1) {
      const state = await transport.fetchState(created.gameCode, created.sessionToken);
      if (state.room.phase !== 'ROUND_ACTIVE') {
        break;
      }
      await hostConn.send('round:answer', `act_r${i}`, answerPayloadFor(state.currentRound));
      mock.timers.tick(ROUND_ACTIVE_TICK_MS);
      mock.timers.tick(ROUND_RESULT_TICK_MS);
      mock.timers.tick(SCOREBOARD_TICK_MS);
    }

    const finishedState = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(finishedState.room.phase, 'FINISHED');

    const rematchAck = await hostConn.send('game:rematch', 'act_rematch', {});
    assert.equal(rematchAck.ok, true);

    const afterState = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(afterState.room.phase, 'LOBBY');
    assert.notEqual(afterState.room.matchId, originalMatchId);
    assert.equal(afterState.room.matchSequence, originalSequence + 1);
    assert.equal(afterState.self.score, 0);
  }),
);

test('game:rematch outside of FINISHED is rejected with INVALID_PHASE', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const conn = transport.connect(created.sessionToken, { onEvent: () => {} });
  await assert.rejects(() => conn.send('game:rematch', 'act_rematch', {}), (err) => err.code === 'INVALID_PHASE');
});

// ---------------------------------------------------------------------------
// Name normalization (Fix 5)
// ---------------------------------------------------------------------------

test('displayName is truncated to 20 grapheme clusters, not 20 UTF-16 code units', async () => {
  const transport = createMockTransport();
  // Family emoji (multiple codepoints, one grapheme) repeated: 25 graphemes,
  // far more than 20 UTF-16 code units' worth if sliced naively.
  const family = '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}'; // 👨‍👩‍👧‍👦
  const name = family.repeat(25);
  const created = await transport.createGame({ displayName: name });
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const graphemeCount = Array.from(segmenter.segment(created.effectiveName)).length;
  assert.equal(graphemeCount, 20);
  // A naive UTF-16 slice(0, 20) would have cut a family emoji in half,
  // producing an isolated combining/ZWJ sequence, not whole emoji.
  assert.equal(created.effectiveName, family.repeat(20));
});

test('collision suffix uses the "Naam 2" format (space + bare number), not "Naam (2)"', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ displayName: 'Sanne' });
  assert.equal(created.effectiveName, 'Sanne');

  const second = await transport.joinGame({ inviteId: created.inviteId, displayName: 'Sanne' });
  assert.equal(second.effectiveName, 'Sanne 2');

  const third = await transport.joinGame({ inviteId: created.inviteId, displayName: 'Sanne' });
  assert.equal(third.effectiveName, 'Sanne 3');
});
