import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSocketServer } from './fake-transport.mjs';
import { runEventAndSnapshotScenario } from './event-and-snapshot-scenario.mjs';
import { resolveEventValidator } from '../../../server/protocol/client-events-dispatch.mjs';
import { throttleRoundProgress } from '../../../server/protocol/throttle-round-progress.mjs';
import { assertNoActiveRoundAnswerLeak } from '../../../server/protocol/snapshot-shape.mjs';

// `snapshotHasNoActiveAnswer` in de PR7-prompt-JSDoc komt overeen met PR5d's
// daadwerkelijke exportnaam `assertNoActiveRoundAnswerLeak` — geen nieuwe
// logica, alleen een alias bij de aanroep hier.
const deps = {
  resolveEventValidator,
  throttleRoundProgress,
  snapshotHasNoActiveAnswer: assertNoActiveRoundAnswerLeak,
};

test('runEventAndSnapshotScenario: alle 4 subscenario\'s slagen', () => {
  const socketServer = createFakeSocketServer();
  const { scenarios } = runEventAndSnapshotScenario(socketServer, deps);

  assert.equal(scenarios.length, 4);
  for (const scenario of scenarios) {
    assert.equal(scenario.passed, true, `scenario faalde: ${scenario.name}`);
  }
});

// Rij 16 — onbekend event-type naar de socketserver -> UNSUPPORTED_EVENT via
// resolveEventValidator.
test('resolveEventValidator("room:teleport") -> UNSUPPORTED_EVENT', () => {
  assert.deepEqual(resolveEventValidator('room:teleport'), { ok: false, code: 'UNSUPPORTED_EVENT' });
});

test('runEventAndSnapshotScenario: onbekend event-scenario is gemarkeerd als geslaagd', () => {
  const socketServer = createFakeSocketServer();
  const { scenarios } = runEventAndSnapshotScenario(socketServer, deps);
  const unsupportedScenario = scenarios.find((s) => s.name.includes('UNSUPPORTED_EVENT'));
  assert.ok(unsupportedScenario);
  assert.equal(unsupportedScenario.passed, true);
});

// Rij 17 — snapshot direct na join tijdens ROUND_ACTIVE: bevat geen correct
// antwoord van de actieve ronde (snapshot-invariant).
test('assertNoActiveRoundAnswerLeak: snapshot met alleen veilige currentRound-velden tijdens ROUND_ACTIVE -> ok', () => {
  const snapshot = {
    room: { phase: 'ROUND_ACTIVE' },
    currentRound: { roundId: 'round_07', roundNumber: 1, gameType: 'real_or_fake_flag' },
  };
  assert.deepEqual(assertNoActiveRoundAnswerLeak(snapshot), { ok: true });
});

test('assertNoActiveRoundAnswerLeak: snapshot met een correctOptionId-achtig veld tijdens ROUND_ACTIVE -> afgewezen', () => {
  const leakySnapshot = {
    room: { phase: 'ROUND_ACTIVE' },
    currentRound: { roundId: 'round_07', correctOptionId: 'opt_2' },
  };
  const result = assertNoActiveRoundAnswerLeak(leakySnapshot);
  assert.equal(result.ok, false);
});

// Rij 18 — 5 aanroepen van de round:progress-broadcastpoging binnen 1
// seconde, zelfde ronde: throttleRoundProgress staat maximaal 2 emissies toe.
test('throttleRoundProgress: 5 pogingen binnen 1s voor dezelfde ronde -> maximaal 2 toegestaan', () => {
  const records = new Map();
  const store = { get: (roundId) => records.get(roundId) };
  const roundId = 'round_progress_test';
  const baseTime = 2_000_000;
  let allowedCount = 0;

  for (let i = 0; i < 5; i += 1) {
    const decision = throttleRoundProgress(store, roundId, baseTime + i * 150);
    if (decision.allow) {
      allowedCount += 1;
      records.set(roundId, decision.record);
    }
  }

  assert.equal(allowedCount, 2);
});

// Rij 19 — round:answer-payload met een sessionToken-achtig veld erin:
// geweigerd (cross-cutting negatieve test uit PR4, Basisregel 3).
test('resolveEventValidator("round:answer").entry.validate wijst een sessionToken-veld in de payload af', () => {
  const result = resolveEventValidator('round:answer');
  assert.equal(result.ok, true);
  const validation = result.entry.validate({
    roundId: 'round_07',
    answer: { optionId: 'opt_2' },
    clientAnsweredAt: 1785623418451,
    sessionToken: 'sneaky-token-value',
  });
  assert.equal(validation.ok, false);
});

test('runEventAndSnapshotScenario: round:answer-met-sessionToken-scenario is gemarkeerd als geslaagd', () => {
  const socketServer = createFakeSocketServer();
  const { scenarios } = runEventAndSnapshotScenario(socketServer, deps);
  const pollutedScenario = scenarios.find((s) => s.name.includes('sessionToken-achtig veld'));
  assert.ok(pollutedScenario);
  assert.equal(pollutedScenario.passed, true);
});
