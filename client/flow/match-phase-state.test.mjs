import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialMatchPhaseState, applyServerEvent } from './match-phase-state.mjs';

const roundActive = () =>
  applyServerEvent(initialMatchPhaseState(), {
    event: 'room:state',
    payload: { room: { phase: 'ROUND_ACTIVE' } },
  });

test('1. initialMatchPhaseState() is UNINITIALIZED with no matchId and no pausedState', () => {
  assert.deepStrictEqual(initialMatchPhaseState(), {
    phase: 'UNINITIALIZED',
    matchId: null,
    pausedState: null,
  });
});

test("2. room:state with payload.room.phase = 'ROUND_ACTIVE' overrides phase from every starting state", () => {
  const message = { event: 'room:state', payload: { room: { phase: 'ROUND_ACTIVE' } } };

  const fromInitial = applyServerEvent(initialMatchPhaseState(), message);
  assert.strictEqual(fromInitial.phase, 'ROUND_ACTIVE');

  const fromLobby = applyServerEvent(
    applyServerEvent(initialMatchPhaseState(), {
      event: 'room:state',
      payload: { room: { phase: 'LOBBY' } },
    }),
    message,
  );
  assert.strictEqual(fromLobby.phase, 'ROUND_ACTIVE');

  const fromFinished = applyServerEvent(
    applyServerEvent(initialMatchPhaseState(), { event: 'game:finished', payload: {} }),
    message,
  );
  assert.strictEqual(fromFinished.phase, 'ROUND_ACTIVE');

  // "past" not in the linear diagram either: SCOREBOARD -> ROUND_ACTIVE directly.
  const fromScoreboard = applyServerEvent(
    applyServerEvent(initialMatchPhaseState(), { event: 'scoreboard:updated', payload: {} }),
    message,
  );
  assert.strictEqual(fromScoreboard.phase, 'ROUND_ACTIVE');
});

test('3. room:state with an unknown future phase value is taken over without throw or enum validation', () => {
  assert.doesNotThrow(() => {
    const state = applyServerEvent(initialMatchPhaseState(), {
      event: 'room:state',
      payload: { room: { phase: 'BONUS_ROUND' } },
    });
    assert.strictEqual(state.phase, 'BONUS_ROUND');
  });
});

test('4. game:started from LOBBY moves to COUNTDOWN and updates matchId', () => {
  const lobby = applyServerEvent(initialMatchPhaseState(), {
    event: 'room:state',
    payload: { room: { phase: 'LOBBY' } },
  });
  const state = applyServerEvent(lobby, { event: 'game:started', payload: { matchId: 'match-1' } });
  assert.strictEqual(state.phase, 'COUNTDOWN');
  assert.strictEqual(state.matchId, 'match-1');
});

test('5. round:started -> round:ended -> scoreboard:updated -> round:started again, no step rejected', () => {
  let state = applyServerEvent(initialMatchPhaseState(), { event: 'round:started', payload: {} });
  assert.strictEqual(state.phase, 'ROUND_ACTIVE');

  state = applyServerEvent(state, { event: 'round:ended', payload: {} });
  assert.strictEqual(state.phase, 'ROUND_RESULT');

  state = applyServerEvent(state, { event: 'scoreboard:updated', payload: {} });
  assert.strictEqual(state.phase, 'SCOREBOARD');

  state = applyServerEvent(state, { event: 'round:started', payload: {} });
  assert.strictEqual(state.phase, 'ROUND_ACTIVE');
});

test('6. round:ended directly followed by round:started (scoreboard skipped) is not an error', () => {
  const resultState = applyServerEvent(initialMatchPhaseState(), { event: 'round:ended', payload: {} });
  assert.strictEqual(resultState.phase, 'ROUND_RESULT');

  const backToActive = applyServerEvent(resultState, { event: 'round:started', payload: {} });
  assert.strictEqual(backToActive.phase, 'ROUND_ACTIVE');
});

test('7. game:paused from ROUND_ACTIVE with a full payload captures previousPhase and the other fields', () => {
  const active = roundActive();
  const state = applyServerEvent(active, {
    event: 'game:paused',
    payload: { previousPhase: 'ROUND_ACTIVE', reason: 'host_paused', remainingMs: 4500, pausedAt: 1700000000000 },
  });

  assert.strictEqual(state.phase, 'PAUSED');
  assert.deepStrictEqual(state.pausedState, {
    previousPhase: 'ROUND_ACTIVE',
    reason: 'host_paused',
    remainingMs: 4500,
    pausedAt: 1700000000000,
  });
});

test('8. game:paused with a payload missing remainingMs/pausedAt does not throw; those become null, not undefined', () => {
  const active = roundActive();
  const state = applyServerEvent(active, {
    event: 'game:paused',
    payload: { previousPhase: 'ROUND_ACTIVE', reason: 'connection_issue' },
  });

  assert.strictEqual(state.phase, 'PAUSED');
  assert.strictEqual(state.pausedState.remainingMs, null);
  assert.strictEqual(state.pausedState.pausedAt, null);
  assert.notStrictEqual(state.pausedState.remainingMs, undefined);
  assert.notStrictEqual(state.pausedState.pausedAt, undefined);
});

test('9. game:resumed after test 7 returns to ROUND_ACTIVE and clears pausedState', () => {
  const active = roundActive();
  const paused = applyServerEvent(active, {
    event: 'game:paused',
    payload: { previousPhase: 'ROUND_ACTIVE', reason: 'host_paused', remainingMs: 4500, pausedAt: 1700000000000 },
  });

  const resumed = applyServerEvent(paused, { event: 'game:resumed', payload: {} });
  assert.strictEqual(resumed.phase, 'ROUND_ACTIVE');
  assert.strictEqual(resumed.pausedState, null);
});

test('10. game:resumed without a preceding game:paused leaves state fully unchanged', () => {
  const active = roundActive();
  assert.strictEqual(active.pausedState, null);

  const state = applyServerEvent(active, { event: 'game:resumed', payload: {} });
  assert.deepStrictEqual(state, active);
});

test('11. game:finished moves to FINISHED', () => {
  const active = roundActive();
  const state = applyServerEvent(active, { event: 'game:finished', payload: {} });
  assert.strictEqual(state.phase, 'FINISHED');
});

test('12. game:rematch-started with a new matchId moves to LOBBY and updates matchId', () => {
  const finished = applyServerEvent(
    applyServerEvent(initialMatchPhaseState(), { event: 'game:started', payload: { matchId: 'match-1' } }),
    { event: 'game:finished', payload: {} },
  );

  const state = applyServerEvent(finished, {
    event: 'game:rematch-started',
    payload: { matchId: 'match-2' },
  });
  assert.strictEqual(state.phase, 'LOBBY');
  assert.strictEqual(state.matchId, 'match-2');
});

test('13. non-phase events leave state exactly unchanged (deep equality), tested individually', () => {
  const nonPhaseEvents = [
    'error',
    'session:kicked',
    'session:revoked',
    'room:player-changed',
    'room:lock-changed',
    'round:progress',
  ];

  for (const event of nonPhaseEvents) {
    const before = roundActive();
    const after = applyServerEvent(before, { event, payload: { anything: 'goes' } });
    assert.deepStrictEqual(after, before, `${event} must not change state`);
  }
});

test('14. a fully unknown/made-up event type leaves state unchanged, no throw', () => {
  const before = roundActive();
  const after = applyServerEvent(before, { event: 'foo:bar', payload: { whatever: true } });
  assert.deepStrictEqual(after, before);
});

test('15. applyServerEvent with payload: {} for every phase-changing event does not throw and yields correct phase with null subfields', () => {
  const cases = [
    { event: 'game:started', expectedPhase: 'COUNTDOWN' },
    { event: 'round:started', expectedPhase: 'ROUND_ACTIVE' },
    { event: 'round:ended', expectedPhase: 'ROUND_RESULT' },
    { event: 'scoreboard:updated', expectedPhase: 'SCOREBOARD' },
    { event: 'game:finished', expectedPhase: 'FINISHED' },
    { event: 'game:rematch-started', expectedPhase: 'LOBBY' },
  ];

  for (const { event, expectedPhase } of cases) {
    const state = applyServerEvent(initialMatchPhaseState(), { event, payload: {} });
    assert.strictEqual(state.phase, expectedPhase, `${event} should yield ${expectedPhase}`);
    assert.strictEqual(state.matchId, null, `${event} with no matchId in payload should leave matchId null`);
  }

  const paused = applyServerEvent(roundActive(), { event: 'game:paused', payload: {} });
  assert.strictEqual(paused.phase, 'PAUSED');
  assert.deepStrictEqual(paused.pausedState, {
    previousPhase: null,
    reason: null,
    remainingMs: null,
    pausedAt: null,
  });

  const roomStateResult = applyServerEvent(initialMatchPhaseState(), { event: 'room:state', payload: {} });
  assert.strictEqual(roomStateResult.phase, 'UNINITIALIZED');
});

// Beyond the required table: additional cases documenting design choices this
// spec left to the implementation, and proving no function throws for
// malformed input, matching the sibling modules' contract.

// Corrected after review: PROTOCOL.md's snapshot example does include
// room.matchId, so "volledige override" must update it too — otherwise a
// client that loads straight into a snapshot (before any game:started ever
// fires) would keep matchId stuck at null. See the matching fix + comment in
// match-phase-state.mjs's handleRoomState.
test('room:state overrides matchId from payload.room.matchId (full override, per PROTOCOL.md snapshot example)', () => {
  const started = applyServerEvent(initialMatchPhaseState(), { event: 'game:started', payload: { matchId: 'match-1' } });
  const snapshot = applyServerEvent(started, {
    event: 'room:state',
    payload: { room: { phase: 'ROUND_ACTIVE', matchId: 'match-9' } },
  });
  assert.strictEqual(snapshot.matchId, 'match-9');
});

test('room:state without a matchId field keeps the previously known matchId', () => {
  const started = applyServerEvent(initialMatchPhaseState(), { event: 'game:started', payload: { matchId: 'match-1' } });
  const snapshot = applyServerEvent(started, {
    event: 'room:state',
    payload: { room: { phase: 'ROUND_ACTIVE' } },
  });
  assert.strictEqual(snapshot.matchId, 'match-1');
});

test('an initial room:state snapshot (before any game:started ever fired) sets matchId directly', () => {
  const snapshot = applyServerEvent(initialMatchPhaseState(), {
    event: 'room:state',
    payload: { room: { phase: 'ROUND_ACTIVE', matchId: 'match-from-snapshot' } },
  });
  assert.strictEqual(snapshot.matchId, 'match-from-snapshot');
});

// Open spec-vraag (see GF3-match-phase-state.md): implemented per the spec's own
// proposal that a paused snapshot carries payload.room.pausedState in the same
// shape as game:paused's fields — unconfirmed by the PROTOCOL.md owner.
test('room:state with phase PAUSED and a room.pausedState object adopts it (the flagged open-spec assumption)', () => {
  const state = applyServerEvent(initialMatchPhaseState(), {
    event: 'room:state',
    payload: {
      room: {
        phase: 'PAUSED',
        pausedState: { previousPhase: 'ROUND_ACTIVE', reason: 'host_paused', remainingMs: 3000, pausedAt: 42 },
      },
    },
  });
  assert.strictEqual(state.phase, 'PAUSED');
  assert.deepStrictEqual(state.pausedState, {
    previousPhase: 'ROUND_ACTIVE',
    reason: 'host_paused',
    remainingMs: 3000,
    pausedAt: 42,
  });
});

test('room:state with a non-PAUSED phase and no room.pausedState clears any stale pausedState', () => {
  const paused = applyServerEvent(roundActive(), {
    event: 'game:paused',
    payload: { previousPhase: 'ROUND_ACTIVE', reason: 'host_paused', remainingMs: 1000, pausedAt: 1 },
  });
  const snapshot = applyServerEvent(paused, {
    event: 'room:state',
    payload: { room: { phase: 'ROUND_ACTIVE' } },
  });
  assert.strictEqual(snapshot.pausedState, null);
});

test('round:answer-accepted (mentioned in the mapping table catch-all) leaves state unchanged', () => {
  const before = roundActive();
  const after = applyServerEvent(before, { event: 'round:answer-accepted', payload: {} });
  assert.deepStrictEqual(after, before);
});

test('applyServerEvent with a non-object state returns it unchanged, no throw', () => {
  assert.strictEqual(applyServerEvent(null, { event: 'game:finished', payload: {} }), null);
  assert.strictEqual(applyServerEvent(undefined, { event: 'game:finished', payload: {} }), undefined);
});

test('applyServerEvent with a malformed serverMessage does not throw and returns state unchanged', () => {
  const before = roundActive();
  assert.deepStrictEqual(applyServerEvent(before, null), before);
  assert.deepStrictEqual(applyServerEvent(before, undefined), before);
  assert.deepStrictEqual(applyServerEvent(before, {}), before);
  assert.deepStrictEqual(applyServerEvent(before, 'not-an-object'), before);
  assert.deepStrictEqual(applyServerEvent(before, { event: 'game:finished' }), applyServerEvent(before, { event: 'game:finished', payload: {} }));
});

test('applyServerEvent never throws for any known event with a malformed payload, including room:state without a room key', () => {
  const events = [
    'room:state',
    'game:started',
    'round:started',
    'round:ended',
    'scoreboard:updated',
    'game:paused',
    'game:resumed',
    'game:finished',
    'game:rematch-started',
    'error',
    'session:kicked',
    'session:revoked',
    'room:player-changed',
    'room:lock-changed',
    'round:progress',
    'round:answer-accepted',
    'foo:bar',
  ];
  const malformedPayloads = [undefined, null, {}, { room: null }, { room: 'not-an-object' }, 'not-an-object', 42, []];

  for (const event of events) {
    for (const payload of malformedPayloads) {
      assert.doesNotThrow(() => {
        applyServerEvent(initialMatchPhaseState(), { event, payload });
      }, `${event} with payload ${JSON.stringify(payload)} must not throw`);
    }
  }
});
