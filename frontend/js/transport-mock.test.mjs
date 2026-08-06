import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockTransport,
  MOCK_PLAYER_COLORS,
  buildQuestionSequence,
  correctValueOf,
  optionValuesOf,
} from './transport-mock.mjs';
// besluit 42: de mock speelt de server na, dus hij moet exact hetzelfde gesloten
// palet in dezelfde volgorde kennen — anders bewijst een mockdoorloop het
// verkeerde.
import { PLAYER_COLORS } from '../../server/protocol/client-events-dispatch.mjs';
// ronde 3 fase 3 ("solo overleeft reload"): dezelfde bron als transport-mock.mjs
// zelf gebruikt, zodat een contentversie-mismatch in de tests precies hetzelfde
// betekent als in de echte restore.
import { CONTENT_VERSION } from '../../shared/content/index.mjs';

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
// connect() onStatus (transport-contract-response.md, correctie 2)
// ---------------------------------------------------------------------------

test('connect() reports connecting then connected, in that order, before the snapshot arrives', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ config: {}, hostParticipates: true, displayName: 'Host' });

  const statuses = [];
  const events = [];
  transport.connect(created.sessionToken, {
    onEvent: (envelope) => events.push(envelope),
    onStatus: (status) => statuses.push(status),
  });

  assert.deepEqual(statuses, ['connecting']);
  assert.deepEqual(events, []);

  await Promise.resolve(); // let the queued microtask run
  assert.deepEqual(statuses, ['connecting', 'connected']);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'room:state');
});

test('connect() with an unknown sessionToken reports disconnected and never connecting/connected', async () => {
  const transport = createMockTransport();
  await transport.createGame({ config: {}, hostParticipates: true, displayName: 'Host' });

  const statuses = [];
  const conn = transport.connect('not-a-real-token', { onStatus: (status) => statuses.push(status) });
  assert.deepEqual(statuses, ['disconnected']);
  await assert.rejects(() => conn.send('game:start', 'act_1', {}), { code: 'TOKEN_INVALID' });
});

test('close() reports disconnected', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ config: {}, hostParticipates: true, displayName: 'Host' });

  const statuses = [];
  const conn = transport.connect(created.sessionToken, { onStatus: (status) => statuses.push(status) });
  await Promise.resolve();
  conn.close();

  assert.deepEqual(statuses, ['connecting', 'connected', 'disconnected']);
});

test('connect() without onEvent/onStatus handlers does not throw (both are optional no-ops)', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ config: {}, hostParticipates: true, displayName: 'Host' });
  assert.doesNotThrow(() => transport.connect(created.sessionToken, {}));
  assert.doesNotThrow(() => transport.connect(created.sessionToken, null));
});

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
    'game:rename-player',
    'game:recolor-player',
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

// Punt 7 / besluit 52 (docs/openstaand/continentfilter.md): `continents` is
// create-only op de ECHTE server (protocol buiten scope deze sessie), maar
// hier wél via game:update-config bereikbaar — anders is de lobbytoggle in
// solo dood.
test('game:update-config met continents: slaat de nieuwe lijst op en broadcast die', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const conn = transport.connect(created.sessionToken, { onEvent: () => {} });

  const ack = await conn.send('game:update-config', 'act_continents', { continents: ['Europe', 'Asia'] });
  assert.deepEqual(ack.payload.config.continents, ['Europe', 'Asia']);
});

test('game:update-config weigert een lege continents-lijst (pariteit met assertGameConfigurationShape)', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const conn = transport.connect(created.sessionToken, { onEvent: () => {} });

  await assert.rejects(
    () => conn.send('game:update-config', 'act_leeg', { continents: [] }),
    (err) => err.code === 'INVALID_REQUEST',
  );
});

test('game:update-config weigert een onbekende continentnaam', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const conn = transport.connect(created.sessionToken, { onEvent: () => {} });

  await assert.rejects(
    () => conn.send('game:update-config', 'act_onbekend', { continents: ['Atlantis'] }),
    (err) => err.code === 'INVALID_REQUEST',
  );
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

// docs/openstaand/host-wijzigt-naam-en-kleur.md: een host kon een speler al
// verwijderen maar niet hernoemen — deze twee events dichten dat gat.
test('game:rename-player: de host hernoemt een ander, óók ná diens eigen eenmalige player:rename', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const joined = await transport.joinGame({ inviteId: created.inviteId, displayName: '' });
  const hostConn = transport.connect(created.sessionToken, { onEvent: () => {} });
  const targetConn = transport.connect(joined.sessionToken, { onEvent: () => {} });

  const selfRename = await targetConn.send('player:rename', 'act_self', { displayName: 'Zelfgekozen' });
  assert.equal(selfRename.ok, true);
  // Een tweede player:rename van de speler zelf zou nu INVALID_PHASE geven.
  await assert.rejects(
    () => targetConn.send('player:rename', 'act_self_2', { displayName: 'Nog een keer' }),
    (err) => err.code === 'INVALID_PHASE',
  );

  const hostAck = await hostConn.send('game:rename-player', 'act_host', {
    playerId: joined.playerId,
    displayName: 'Door host hernoemd',
  });
  assert.equal(hostAck.ok, true);
  assert.equal(hostAck.payload.effectiveName, 'Door host hernoemd');
});

test('game:recolor-player: de host wijzigt de kleur van een ander', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({});
  const joined = await transport.joinGame({ inviteId: created.inviteId, displayName: 'Kleurloos' });
  const hostConn = transport.connect(created.sessionToken, { onEvent: () => {} });

  const ack = await hostConn.send('game:recolor-player', 'act_recolor', { playerId: joined.playerId, color: 'teal' });
  assert.equal(ack.ok, true);
  assert.equal(ack.payload.color, 'teal');
});

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
// Fase 4 (autoReveal, besluit 51, docs/openstaand/antwoord-automatisch-tonen.md)
//
// `withFakeTimers()` faket alleen `setTimeout` (zie boven) — `Date.now()`
// blijft echte kloktijd, wat voor elke andere test hier genoeg is (die tikt
// alleen om een gepláánde overgang te forceren). `game:reveal`/`submitAnswer`
// vergelijken zelf tegen `Date.now()` (net als de echte server tegen
// `context.now()`), dus DIE twee toetsen hebben ook `Date` als fake-API
// nodig — anders "verstrijkt" de deadline in de test nooit, hoeveel er ook
// getikt wordt.
// ---------------------------------------------------------------------------

function withFakeTimersAndDate(fn) {
  return async () => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    try {
      await fn();
    } finally {
      mock.timers.reset();
    }
  };
}

/**
 * Host+player room met autoReveal:false, gestart en getikt tot ronde 1 actief
 * is. `events` verzamelt alles wat de hostsessie binnenkrijgt — moet vóór
 * `connect()` bestaan, want de mock geeft `onEvent` niet terug op de
 * connectie (alleen `send`/`close`), dus achteraf toekennen vangt niets.
 */
async function createRoomInRound1WithAutoRevealOff() {
  const transport = createMockTransport();
  const created = await transport.createGame({ config: { autoReveal: false }, hostParticipates: true, displayName: 'Host' });
  const events = [];
  const hostConn = transport.connect(created.sessionToken, { onEvent: (envelope) => events.push(envelope) });
  await hostConn.send('game:start', 'act_start', {});
  mock.timers.tick(COUNTDOWN_TICK_MS);
  const started = events.find((e) => e.event === 'round:started');
  return { transport, created, hostConn, events, roundId: started.payload.roundId };
}

test(
  'autoReveal false: round:ended blijft uit ná de normale ronde-duur, ondanks het verstrijken van de virtuele tijd',
  withFakeTimers(async () => {
    const { transport, created, events } = await createRoomInRound1WithAutoRevealOff();

    // Ver voorbij wat normaal het einde van de ronde zou zijn.
    mock.timers.tick(ROUND_ACTIVE_TICK_MS + ROUND_RESULT_TICK_MS + SCOREBOARD_TICK_MS);
    const state = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.room.phase, 'ROUND_ACTIVE', 'de ronde blijft actief tot de host onthult');
    assert.equal(events.some((e) => e.event === 'round:ended'), false, 'het antwoord mag de mock nog niet verlaten');
  }),
);

test(
  'game:reveal vóór de deadline geeft INVALID_PHASE — te vroeg tikken onthult niet vervroegd',
  withFakeTimers(async () => {
    const { hostConn } = await createRoomInRound1WithAutoRevealOff();
    // Bewust geen klok verzet: de deadline is nog niet voorbij.
    await assert.rejects(() => hostConn.send('game:reveal', 'act_te_vroeg', {}), (err) => err.code === 'INVALID_PHASE');
  }),
);

test(
  'game:reveal terwijl autoReveal aanstaat (standaard) geeft INVALID_PHASE',
  withFakeTimersAndDate(async () => {
    const { transport, created } = await createRoomInRound1();
    const hostConn = transport.connect(created.sessionToken, { onEvent: () => {} });
    mock.timers.tick(ROUND_ACTIVE_TICK_MS);
    await assert.rejects(() => hostConn.send('game:reveal', 'act_onnodig', {}), (err) => err.code === 'INVALID_PHASE');
  }),
);

test(
  'game:reveal ná de deadline onthult het antwoord, en de ronde loopt daarna gewoon door',
  withFakeTimersAndDate(async () => {
    const transport = createMockTransport();
    const created = await transport.createGame({ config: { autoReveal: false }, hostParticipates: true, displayName: 'Host' });
    const events = [];
    const hostConn = transport.connect(created.sessionToken, { onEvent: (envelope) => events.push(envelope) });
    await hostConn.send('game:start', 'act_start', {});
    mock.timers.tick(COUNTDOWN_TICK_MS);

    mock.timers.tick(ROUND_ACTIVE_TICK_MS);
    const ack = await hostConn.send('game:reveal', 'act_reveal', {});
    assert.equal(ack.ok, true);

    const ended = events.find((e) => e.event === 'round:ended');
    assert.notEqual(ended, undefined, 'pas nu mag het antwoord er staan');
    assert.ok('correctAnswer' in ended.payload);

    let state = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.room.phase, 'ROUND_RESULT');

    // En daarna gewoon getimed door, zoals altijd (besluit 51: ROUND_RESULT/
    // SCOREBOARD zijn niet aangepast door autoReveal).
    mock.timers.tick(ROUND_RESULT_TICK_MS);
    state = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.room.phase, 'SCOREBOARD');
  }),
);

test(
  'autoReveal false: een antwoord ná de deadline krijgt DEADLINE_PASSED, ook al staat de ronde nog open',
  withFakeTimersAndDate(async () => {
    const transport = createMockTransport();
    const created = await transport.createGame({ config: { autoReveal: false }, hostParticipates: true, displayName: 'Host' });
    const events = [];
    const hostConn = transport.connect(created.sessionToken, { onEvent: (envelope) => events.push(envelope) });
    await hostConn.send('game:start', 'act_start', {});
    mock.timers.tick(COUNTDOWN_TICK_MS);
    const started = events.find((e) => e.event === 'round:started');

    mock.timers.tick(ROUND_ACTIVE_TICK_MS);
    await assert.rejects(
      () => hostConn.send('round:answer', 'act_te_laat', answerPayloadFor(started.payload)),
      (err) => err.code === 'DEADLINE_PASSED',
    );
  }),
);

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

// ---------------------------------------------------------------------------
// UI-15 (HANDOFF-UI.md) — GESLOTEN op 5 aug 2026 (PLAN-CONVERGENTIE §A3).
//
// Hier stond een PIN: de mock week bewust af van de al bevestigde tie-regel
// (GAME-RULES.md §Gelijke eindscore, GR2-standings.md) door op `joinedAt` te
// sorteren en geen gedeelde positie te kennen. De pin schreef voor: "flip deze
// assertie naar het echte gedrag zodra de mock wordt aangepast" — dat is nu
// gebeurd. De mock gebruikt `shared/rules/ranking.mjs`, dezelfde functie als
// de server, en stuurt `rank` mee in de payload.
// ---------------------------------------------------------------------------
test(
  'UI-15 (gesloten): bij een volledige gelijkstand deelt de mock de plaats, net als de server',
  withFakeTimers(async () => {
    const transport = createMockTransport();
    const created = await transport.createGame({ hostParticipates: false, config: {} });
    const first = await transport.joinGame({ inviteId: created.inviteId, displayName: 'Eerste' });
    const second = await transport.joinGame({ inviteId: created.inviteId, displayName: 'Tweede' });

    let scoreboardPayload = null;
    const hostConn = transport.connect(created.sessionToken, { onEvent: () => {} });
    const firstConn = transport.connect(first.sessionToken, { onEvent: () => {} });
    const secondConn = transport.connect(second.sessionToken, {
      onEvent: (envelope) => {
        if (envelope.event === 'scoreboard:updated') {
          scoreboardPayload = envelope.payload;
        }
      },
    });

    await hostConn.send('game:start', 'act_start', {});
    mock.timers.tick(COUNTDOWN_TICK_MS);

    const state = await transport.fetchState(created.gameCode, first.sessionToken);
    const correctOptionId = state.currentRound.question.targetIso2;

    // Beide spelers antwoorden correct in dezelfde ronde, op hetzelfde
    // virtuele moment: gelijke score, gelijk aantal goed, gelijke responstijd.
    // Dat is een VOLLEDIGE gelijkstand — de enige situatie waarin de regel een
    // gedeelde plaats voorschrijft.
    await firstConn.send('round:answer', 'act_first', {
      roundId: state.currentRound.roundId,
      answer: { optionId: correctOptionId },
    });
    await secondConn.send('round:answer', 'act_second', {
      roundId: state.currentRound.roundId,
      answer: { optionId: correctOptionId },
    });

    mock.timers.tick(ROUND_ACTIVE_TICK_MS);
    mock.timers.tick(ROUND_RESULT_TICK_MS);

    assert.notEqual(scoreboardPayload, null);
    const [rank1, rank2] = scoreboardPayload.top;
    assert.equal(rank1.score, rank2.score, 'de tie zelf: écht gelijke score');
    assert.equal(rank1.rank, 1);
    assert.equal(rank2.rank, 1, 'gedeelde plaats — geen stille winnaar op joinvolgorde');
    // De onderlinge volgorde blijft deterministisch (id oplopend, presentatie
    // zonder ranginformatie), maar wijst geen winnaar aan.
    assert.notEqual(rank1.playerId, rank2.playerId);
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// §A3 (5 aug 2026) — de snapshot van de mock gebruikt dezelfde gedeelde rang.
// Hij telde daar `findRankIndex() + 1`, dus bij een gelijke stand week de
// eigen positie in de snapshot af van die in `scoreboard:updated`.
// ─────────────────────────────────────────────────────────────────────────────

test(
  '§A3: self.position in de mocksnapshot komt uit de gedeelde rangschikker, niet uit de rijindex',
  withFakeTimers(async () => {
    const transport = createMockTransport();
    const created = await transport.createGame({ hostParticipates: false, config: {} });
    const first = await transport.joinGame({ inviteId: created.inviteId, displayName: 'Eerste' });
    const second = await transport.joinGame({ inviteId: created.inviteId, displayName: 'Tweede' });

    // Nog geen enkel antwoord: beide spelers staan op 0 en delen dus plaats 1.
    const firstState = await transport.fetchState(created.gameCode, first.sessionToken);
    const secondState = await transport.fetchState(created.gameCode, second.sessionToken);

    assert.equal(firstState.self.position, 1);
    assert.equal(
      secondState.self.position,
      1,
      'de tweede speler stond met index + 1 op plaats 2 terwijl hij evenveel punten heeft',
    );
  }),
);

test('besluit 42: de mock kent exact hetzelfde gesloten kleurenpalet als de server', () => {
  assert.deepEqual([...MOCK_PLAYER_COLORS], [...PLAYER_COLORS]);
});

// ─────────────────────────────────────────────────────────────────────────────
// docs/openstaand/spelersidentiteit.md, stap 4/5: solo/mock moet hetzelfde
// identiteitsgedrag tonen als de echte server (server/composition/room/
// deelnemers.test-equivalenten) — anders bewijst een mockdoorloop het
// verkeerde, zelfde reden als besluit 42 hierboven.
// ─────────────────────────────────────────────────────────────────────────────

test('createGame zonder displayName geeft de meespelende host een identiteitspaar', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ config: {}, hostParticipates: true, displayName: null });
  assert.equal(typeof created.identity?.country, 'string');
  assert.equal(typeof created.identity?.word, 'string');
  assert.equal(created.state.self.identity?.country, created.identity.country);
});

test('createGame MET displayName geeft geen identiteit — die vervangt alleen een gegenereerde naam', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ config: {}, hostParticipates: true, displayName: 'Ruben' });
  assert.equal(created.effectiveName, 'Ruben');
  assert.equal(created.identity, null);
  assert.equal(created.state.self.identity, null);
});

test('createGame met hostParticipates: false geeft geen identiteit (geen Player, dus ook geen paar)', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ hostParticipates: false });
  assert.equal(created.playerId, null);
  assert.equal(created.identity, null);
});

test('joinGame zonder displayName krijgt een uniek paar, nooit hetzelfde als een reeds aanwezige speler', async () => {
  const transport = createMockTransport();
  const host = await transport.createGame({ config: {}, hostParticipates: true, displayName: null });
  assert.notEqual(host.identity, null);

  const joined = await transport.joinGame({ gameCode: host.gameCode, displayName: null, joinSource: 'code' });
  assert.notEqual(joined.identity, null);
  // DE VALKUIL: vergelijk het PAAR, niet de gerenderde tekst (zie
  // shared/rules/identity-processing.mjs).
  assert.notDeepEqual(joined.identity, host.identity);
});

test('joinGame MET displayName geeft geen identiteit', async () => {
  const transport = createMockTransport();
  const host = await transport.createGame({ config: {}, hostParticipates: true, displayName: null });
  const joined = await transport.joinGame({ gameCode: host.gameCode, displayName: 'Sanne', joinSource: 'code' });
  assert.equal(joined.effectiveName, 'Sanne');
  assert.equal(joined.identity, null);
});

test('player:rename wist een eerder toegekende identiteit', async () => {
  const transport = createMockTransport();
  const created = await transport.createGame({ config: {}, hostParticipates: true, displayName: null });
  assert.notEqual(created.identity, null);

  const conn = transport.connect(created.sessionToken, { onEvent: () => {} });
  await Promise.resolve();
  const ack = await conn.send('player:rename', 'act_rename', { displayName: 'Nieuwe naam' });
  assert.equal(ack.payload.effectiveName, 'Nieuwe naam');
  assert.equal(ack.payload.identity, null);

  const state = await transport.fetchState(created.gameCode, created.sessionToken);
  assert.equal(state.self.identity, null);
});

test('room:player-changed draagt identity mee bij join en rename (net als de echte server)', async () => {
  const transport = createMockTransport();
  const host = await transport.createGame({ config: {}, hostParticipates: true, displayName: null });
  const events = [];
  const hostConn = transport.connect(host.sessionToken, { onEvent: (e) => events.push(e) });
  await Promise.resolve();

  const joined = await transport.joinGame({ gameCode: host.gameCode, displayName: null, joinSource: 'code' });
  const joinEvent = events.find((e) => e.event === 'room:player-changed' && e.payload.delta.type === 'join');
  assert.deepEqual(joinEvent.payload.delta.identity, joined.identity);

  const joinedConn = transport.connect(joined.sessionToken, { onEvent: () => {} });
  await Promise.resolve();
  await joinedConn.send('player:rename', 'act_rename', { displayName: 'Nieuwe naam' });
  const renameEvent = events.find((e) => e.event === 'room:player-changed' && e.payload.delta.type === 'rename');
  assert.equal(renameEvent.payload.delta.identity, null);
  void hostConn;
});

// ─────────────────────────────────────────────────────────────────────────────
// Ronde 3, fase 3 — "solo overleeft reload": `createMockTransport` kan een
// eerder opgeslagen snapshot terugkrijgen (`restoreState`) en meldt elke
// gebeurtenis die een verbonden sessie ziet aan `onStateChange`. Deze tests
// bewijzen het contract dat `app.mjs`/`client/flow/solo-store.mjs` erop
// bouwen, niet de opslag zelf (die kent deze module niet — zie de
// doc-comment bij `createMockTransport`).
// ─────────────────────────────────────────────────────────────────────────────

/** Host-only room, gestart en getikt tot ronde 1 actief is, met elke gemelde state bewaard. */
async function createSoloRoomInRound1() {
  const states = [];
  const transport = createMockTransport({ onStateChange: (state) => states.push(state) });
  const created = await transport.createGame({ config: {}, hostParticipates: true, displayName: 'Solo' });
  const hostConn = transport.connect(created.sessionToken, { onEvent: () => {} });
  await Promise.resolve(); // laat de connect()-microtask (eerste room:state) lopen
  await hostConn.send('game:start', 'act_start', {});
  mock.timers.tick(COUNTDOWN_TICK_MS);
  return { transport, created, hostConn, states, latestState: () => states.at(-1) };
}

test(
  'onStateChange meldt elke gebeurtenis die een verbonden sessie ziet, met een puur JSON-serialiseerbare snapshot',
  withFakeTimers(async () => {
    const { states } = await createSoloRoomInRound1();
    assert.ok(states.length > 0, 'geen enkele state gemeld tijdens LOBBY -> COUNTDOWN -> ROUND_ACTIVE');
    const latest = states.at(-1);
    assert.equal(latest.phase, 'ROUND_ACTIVE');
    // Geen Maps, geen functies, geen setTimeout-handles: een round-trip door
    // JSON moet exact hetzelfde opleveren, anders zit er iets in dat
    // `sessionStorage` niet aankan.
    assert.deepEqual(JSON.parse(JSON.stringify(latest)), latest);
  }),
);

test(
  'restoreState herbouwt een LOBBY-room: spelers, config en sessietoken komen ongewijzigd terug',
  withFakeTimers(async () => {
    const states = [];
    const transport = createMockTransport({ onStateChange: (state) => states.push(state) });
    const created = await transport.createGame({
      config: { pacing: 'host' },
      hostParticipates: true,
      displayName: 'Solospeler',
    });
    transport.connect(created.sessionToken, { onEvent: () => {} });
    await Promise.resolve();
    const savedLobbyState = states.at(-1);
    assert.equal(savedLobbyState.phase, 'LOBBY');

    const restored = createMockTransport({ restoreState: savedLobbyState });
    const state = await restored.fetchState(created.gameCode, created.sessionToken);
    assert.equal(state.room.phase, 'LOBBY');
    assert.equal(state.room.config.pacing, 'host');
    assert.equal(state.self.effectiveName, created.effectiveName);
    assert.equal(state.self.playerId, created.playerId);
  }),
);

test(
  'restoreState mid-ronde plant de resterende tijd, niet een volle rondeduur opnieuw',
  withFakeTimers(async () => {
    const { created, latestState } = await createSoloRoomInRound1();
    const savedRoundState = latestState();
    assert.equal(savedRoundState.phase, 'ROUND_ACTIVE');

    // Deadline handmatig dichtbij zetten: dit bootst na wat er in het echt
    // gebeurt als de pagina een tijdje stilligt vóórdat 'm wordt herladen —
    // zonder in de test zelf op échte tijd te hoeven wachten.
    const almostDone = { ...savedRoundState, phaseDeadline: Date.now() + 40 };

    const events = [];
    const restored = createMockTransport({ restoreState: almostDone });
    restored.connect(created.sessionToken, { onEvent: (envelope) => events.push(envelope) });
    await Promise.resolve();

    mock.timers.tick(10);
    assert.ok(
      !events.some((e) => e.event === 'round:ended'),
      'de ronde eindigde te vroeg — de volle ROUND_ACTIVE_MS lijkt opnieuw gepland i.p.v. de resterende 40ms',
    );

    mock.timers.tick(50); // > de resterende 40ms
    assert.ok(
      events.some((e) => e.event === 'round:ended'),
      'de ronde eindigde niet binnen de resterende tijd na herstel',
    );
  }),
);

test(
  'restoreState met een deadline die al verstreken is, rondt de fase meteen af in plaats van voor altijd te wachten',
  withFakeTimers(async () => {
    const { created, latestState } = await createSoloRoomInRound1();
    const savedRoundState = latestState();
    const alreadyExpired = { ...savedRoundState, phaseDeadline: Date.now() - 5000 };

    const events = [];
    const restored = createMockTransport({ restoreState: alreadyExpired });
    restored.connect(created.sessionToken, { onEvent: (envelope) => events.push(envelope) });
    await Promise.resolve();

    mock.timers.tick(1); // scheduleTimer klemt een negatieve vertraging af naar 0, niet naar "nooit"
    assert.ok(events.some((e) => e.event === 'round:ended'));
  }),
);

test(
  'restoreState bouwt de vragenreeks opnieuw op zonder de juiste-antwoordlogica te veranderen (geen questions in de opslag)',
  withFakeTimers(async () => {
    const { created, latestState } = await createSoloRoomInRound1();
    const savedRoundState = latestState();
    // `questions` zit hier per ontwerp niet in — zie de doc-comment bij
    // `serializeRoomState`. Dit bevestigt dat aanname ook in de test: er is
    // geen `questions`-veld om per ongeluk ván te lekken.
    assert.equal(savedRoundState.questions, undefined);
    assert.equal(savedRoundState.currentRound.question, undefined);

    const restored = createMockTransport({ restoreState: savedRoundState });
    const state = await restored.fetchState(created.gameCode, created.sessionToken);
    const { targetIso2, optionIso2s } = state.currentRound.question;
    assert.ok(optionIso2s.includes(targetIso2), 'het juiste antwoord moet nog steeds tussen de opties staan');

    const conn = restored.connect(created.sessionToken, { onEvent: () => {} });
    await Promise.resolve();
    await conn.send('round:answer', 'act_answer', {
      roundId: state.currentRound.roundId,
      answer: { optionId: targetIso2 },
    });

    const afterAnswer = await restored.fetchState(created.gameCode, created.sessionToken);
    assert.equal(
      afterAnswer.self.score,
      100,
      'het juiste antwoord van vóór het herstel werd na herstel niet meer als juist herkend',
    );
  }),
);

test(
  'restoreState toont de meerkeuze-opties in dezelfde volgorde na een herlaadbeurt (docs/openstaand/solo-antwoordvolgorde.md, punt 1)',
  withFakeTimers(async () => {
    const { transport, created, latestState } = await createSoloRoomInRound1();
    const before = await transport.fetchState(created.gameCode, created.sessionToken);
    const savedRoundState = latestState();
    assert.ok(
      Array.isArray(savedRoundState.currentRound.optionOrder),
      'de weergavevolgorde van de huidige ronde moet in de opslag staan',
    );

    const restored = createMockTransport({ restoreState: savedRoundState });
    const after = await restored.fetchState(created.gameCode, created.sessionToken);

    assert.deepEqual(
      after.currentRound.question.optionIso2s,
      before.currentRound.question.optionIso2s,
      'dezelfde ronde moet dezelfde weergavevolgorde tonen, vóór en ná een herlaadbeurt',
    );
  }),
);

test(
  'restoreState herstelt ook het eigen gegeven antwoord (docs/openstaand/solo-antwoordvolgorde.md, punt 2)',
  withFakeTimers(async () => {
    const { transport, created, hostConn, latestState } = await createSoloRoomInRound1();
    const before = await transport.fetchState(created.gameCode, created.sessionToken);
    assert.equal(before.self.answeredValue, null, 'nog niet geantwoord: nog geen waarde');
    const chosen = before.currentRound.question.optionIso2s[1];

    await hostConn.send('round:answer', 'act_answer', {
      roundId: before.currentRound.roundId,
      answer: { optionId: chosen },
    });

    const restored = createMockTransport({ restoreState: latestState() });
    const after = await restored.fetchState(created.gameCode, created.sessionToken);

    assert.equal(after.self.answeredCurrentRound, true);
    assert.equal(
      after.self.answeredValue,
      chosen,
      'de snapshot moet na een herlaadbeurt nog weten wélke optie er gekozen was',
    );
  }),
);

test(
  'restoreState vóór enig antwoord: answeredValue is null, niet undefined of een oude waarde',
  withFakeTimers(async () => {
    const { created, latestState } = await createSoloRoomInRound1();
    const restored = createMockTransport({ restoreState: latestState() });
    const after = await restored.fetchState(created.gameCode, created.sessionToken);
    assert.equal(after.self.answeredCurrentRound, false);
    assert.equal(after.self.answeredValue, null);
  }),
);

test('restoreState met een andere contentVersion dan de huidige wordt geweigerd, niet stilzwijgend geaccepteerd', () => {
  assert.throws(() =>
    createMockTransport({
      restoreState: {
        contentVersion: `${CONTENT_VERSION}-oud`,
        gameCode: '123456',
        phase: 'LOBBY',
        players: [],
        sessions: [],
      },
    }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Besluit 49 (docs/openstaand/hoger-lager-en-hoofdsteden.md) — mockpariteit
// voor `higher_lower`/`capitals_mc` (schakel 5 van shared/content/
// game-catalog.mjs's ketenuitspraak). `createMockTransport()`'s publieke pad
// (createGame -> connect -> game:start) kan deze twee gameTypes nog niet
// kiezen — `resolveGameType` valt terug op `flags_mc` zolang
// `PLAYABLE_GAME_TYPES` ze niet bevat, en die knop hoort niet bij deze taak.
// Vandaar de rechtstreekse tests op de geëxporteerde bouwstenen: het bewijs
// dat de mock ze KAN bouwen, los van of de lobby ze al mag KIEZEN.
// ─────────────────────────────────────────────────────────────────────────────

test('buildQuestionSequence("higher_lower") levert vijf geldige duels op, vast (niet willekeurig)', () => {
  const eerste = buildQuestionSequence('higher_lower');
  const tweede = buildQuestionSequence('higher_lower');
  assert.deepEqual(eerste, tweede, 'geen willekeur — een doorloop moet herhaalbaar zijn, zoals odd_one_out/flags_mc');
  assert.equal(eerste.length, 5);

  for (const vraag of eerste) {
    assert.ok(['population', 'area', 'gdp'].includes(vraag.payload.metric));
    assert.equal(vraag.payload.sides.length, 2);
    assert.deepEqual(vraag.payload.sides.map((s) => s.side), [0, 1]);
    for (const kant of vraag.payload.sides) {
      assert.match(kant.iso2, /^[A-Z]{2}$/, 'iso2 in de payload is uppercase, zelfde conventie als flags_mc');
    }
    assert.ok([0, 1].includes(vraag.correct.side));
    // Besluit 20: het juiste antwoord blijft uit de publieke payload.
    assert.equal('side' in vraag.payload, false);
  }

  // Alle drie de metrics komen voor over vijf rondes (i % 3), niet toevallig
  // steeds dezelfde — zie de moduledoc bij de higher_lower-tak.
  assert.deepEqual([...new Set(eerste.map((v) => v.payload.metric))].sort(), ['area', 'gdp', 'population']);
});

test('buildQuestionSequence("capitals_mc") levert dezelfde payloadvorm als flags_mc op', () => {
  const vragen = buildQuestionSequence('capitals_mc');
  assert.equal(vragen.length, 5);
  for (const vraag of vragen) {
    assert.equal(typeof vraag.payload.targetIso2, 'string');
    assert.equal(vraag.payload.optionIso2s.length, 4);
    assert.ok(vraag.payload.optionIso2s.includes(vraag.payload.targetIso2));
    assert.equal(vraag.correct.optionId, vraag.payload.targetIso2);
  }
});

test('optionValuesOf/correctValueOf kennen de "side"-vorm van higher_lower', () => {
  const [vraag] = buildQuestionSequence('higher_lower');
  assert.deepEqual(optionValuesOf(vraag), ['0', '1']);
  assert.equal(correctValueOf(vraag), String(vraag.correct.side));
});
