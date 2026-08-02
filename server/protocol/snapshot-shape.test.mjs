import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSnapshotShape, assertNoActiveRoundAnswerLeak } from './snapshot-shape.mjs';

// Letterlijke fixture uit PROTOCOL.md §State-snapshot (Brondocument in
// PR5-server-events.md).
function buildLiteralSnapshot() {
  return {
    protocolVersion: 'v1',
    serverTime: 1785623412000,
    room: {
      code: '482917',
      phase: 'ROUND_ACTIVE',
      locked: false,
      allowLateJoin: true,
      joinUrl: 'https://play.aseso.nl/j/N4x7pQm2K8tW',
      playerCount: 23,
      config: {},
      matchId: 'match_01J...',
    },
    self: {
      roles: ['player'],
      playerId: 'p_8f42d1',
      effectiveName: 'Ruben',
      score: 600,
      position: 7,
      answeredCurrentRound: false,
    },
    currentRound: {},
    scoreboard: {
      top: [],
      self: {},
    },
  };
}

// De veilige sleutels van het round:started-voorbeeld (§Voorbeeld
// `round:started`), gebruikt als "known safe" currentRound-fixture voor de
// invariant-tests hieronder.
function buildSafeActiveRoundFixture() {
  return {
    matchId: 'match_01J...',
    roundId: 'round_07',
    roundNumber: 7,
    totalRounds: 10,
    gameType: 'real_or_fake_flag',
    contentVersion: '2026.08.1',
    question: {
      promptKey: 'btnRealOrFakePrompt',
      image: { kind: 'generated_flag', seed: 'fx_91b2' },
      options: [
        { optionId: 'real', labelKey: 'btnReal' },
        { optionId: 'fake', labelKey: 'btnFake' },
      ],
    },
    startsAt: 1785623412000,
    endsAt: 1785623427000,
  };
}

// Rij 35
test('validateSnapshotShape: het volledige, letterlijke snapshot-voorbeeld → ok:true', () => {
  assert.deepEqual(validateSnapshotShape(buildLiteralSnapshot()), { ok: true });
});

// Rij 36 — drie losse gevallen
test('validateSnapshotShape: zonder room.phase → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  delete snapshot.room.phase;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});
test('validateSnapshotShape: zonder scoreboard.top → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  delete snapshot.scoreboard.top;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});
test('validateSnapshotShape: self als array → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.self = [];
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});

// Rij 37
test('assertNoActiveRoundAnswerLeak: ROUND_ACTIVE + alleen bekende sleutels → ok:true', () => {
  const snapshot = {
    room: { phase: 'ROUND_ACTIVE' },
    currentRound: buildSafeActiveRoundFixture(),
  };
  assert.deepEqual(assertNoActiveRoundAnswerLeak(snapshot), { ok: true });
});

// Rij 38
test('assertNoActiveRoundAnswerLeak: extra correctOptionId-sleutel → afgewezen (invariant geschonden)', () => {
  const snapshot = {
    room: { phase: 'ROUND_ACTIVE' },
    currentRound: { ...buildSafeActiveRoundFixture(), correctOptionId: 'opt_2' },
  };
  assert.deepEqual(assertNoActiveRoundAnswerLeak(snapshot), { ok: false, code: null });
});

// Rij 39
test('assertNoActiveRoundAnswerLeak: phase SCOREBOARD (geen actieve ronde) → ok:true', () => {
  const snapshot = { room: { phase: 'SCOREBOARD' }, currentRound: {} };
  assert.deepEqual(assertNoActiveRoundAnswerLeak(snapshot), { ok: true });
});
