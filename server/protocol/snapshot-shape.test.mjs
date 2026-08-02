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
      matchSequence: 2,
      pausedState: null,
    },
    self: {
      roles: ['player'],
      playerId: 'p_8f42d1',
      effectiveName: 'Ruben',
      score: 600,
      position: 7,
      answeredCurrentRound: false,
      eligibleFromRound: 1,
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
    rendererVersion: 'flag-renderer-1',
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

// self.eligibleFromRound — DECISIONS.md punt 3: Number.isInteger(x) && x >= 1
// (PR11 §1). Testtabel: geldig (1, 7), 0, negatief, niet-geheel, string,
// ontbrekend — elk apart.
test('validateSnapshotShape: self.eligibleFromRound = 1 (grenswaarde) → ok:true', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.self.eligibleFromRound = 1;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: true });
});
test('validateSnapshotShape: self.eligibleFromRound = 7 (late joiner) → ok:true', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.self.eligibleFromRound = 7;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: true });
});
test('validateSnapshotShape: self.eligibleFromRound = 0 → afgewezen (moet ≥ 1 zijn)', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.self.eligibleFromRound = 0;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});
test('validateSnapshotShape: self.eligibleFromRound negatief (-1) → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.self.eligibleFromRound = -1;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});
test('validateSnapshotShape: self.eligibleFromRound niet-geheel getal (1.5) → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.self.eligibleFromRound = 1.5;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});
test('validateSnapshotShape: self.eligibleFromRound als string ("1") → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.self.eligibleFromRound = '1';
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});
test('validateSnapshotShape: self.eligibleFromRound ontbreekt → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  delete snapshot.self.eligibleFromRound;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});

// INT-2: room.matchSequence (DATA-MODEL.md Match.sequence, integer >= 1)
test('validateSnapshotShape: room.matchSequence = 1 (eerste match) → ok:true', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.room.matchSequence = 1;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: true });
});
test('validateSnapshotShape: room.matchSequence = 0 → afgewezen (moet ≥ 1 zijn)', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.room.matchSequence = 0;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});
test('validateSnapshotShape: room.matchSequence niet-geheel getal (2.5) → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.room.matchSequence = 2.5;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});
test('validateSnapshotShape: room.matchSequence ontbreekt → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  delete snapshot.room.matchSequence;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});

// INT-17: pre-match-lobby — vóór de eerste match zijn matchId én matchSequence
// expliciet null (DATA-MODEL.md §Room: `currentMatchId: null`). Eén van beide
// null is inconsistent en blijft afgewezen.
test('validateSnapshotShape: pre-match-lobby (matchId=null én matchSequence=null) → ok:true', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.room.matchId = null;
  snapshot.room.matchSequence = null;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: true });
});
test('validateSnapshotShape: alleen matchId=null → afgewezen (inconsistent)', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.room.matchId = null;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});
test('validateSnapshotShape: alleen matchSequence=null → afgewezen (inconsistent)', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.room.matchSequence = null;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});

// DECISIONS.md punt 10: room.pausedState, volledige vorm of null
test('validateSnapshotShape: room.pausedState = null (niet gepauzeerd) → ok:true', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.room.pausedState = null;
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: true });
});
test('validateSnapshotShape: room.pausedState volledige vorm → ok:true', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.room.pausedState = {
    previousPhase: 'ROUND_ACTIVE',
    remainingMs: 7200,
    reason: 'host',
    pausedAt: 1785623412000,
  };
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: true });
});
test('validateSnapshotShape: room.pausedState met onbekende reason-waarde → ok:true (clientfallback, geen strikte enum hier)', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.room.pausedState = {
    previousPhase: 'ROUND_ACTIVE',
    remainingMs: 7200,
    reason: 'nog_niet_bedachte_reden',
    pausedAt: 1785623412000,
  };
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: true });
});
test('validateSnapshotShape: room.pausedState mist remainingMs → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.room.pausedState = { previousPhase: 'ROUND_ACTIVE', reason: 'host', pausedAt: 1 };
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});
test('validateSnapshotShape: room.pausedState als lege object → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  snapshot.room.pausedState = {};
  assert.deepEqual(validateSnapshotShape(snapshot), { ok: false, code: null });
});
test('validateSnapshotShape: room.pausedState ontbreekt volledig (geen sleutel) → afgewezen', () => {
  const snapshot = buildLiteralSnapshot();
  delete snapshot.room.pausedState;
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

// PR11 §2 — rendererVersion is nu een toegestane SAFE_ACTIVE_ROUND_KEYS-sleutel
// (algemeen roundveld naast contentVersion, DECISIONS.md punt 21); dit merkt
// `assertNoActiveRoundAnswerLeak` niet per ongeluk als lek aan.
test('assertNoActiveRoundAnswerLeak: currentRound.rendererVersion aanwezig → ok:true (geen lek)', () => {
  const snapshot = {
    room: { phase: 'ROUND_ACTIVE' },
    currentRound: buildSafeActiveRoundFixture(),
  };
  assert.equal(snapshot.currentRound.rendererVersion, 'flag-renderer-1');
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
