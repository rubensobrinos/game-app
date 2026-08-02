/**
 * @file PR7d — client-/server-eventscenario tegen de fake-transportlaag
 *   (PR7a) en de échte PR4/PR5-code.
 * @see docs/protocol-plan/prompts/PR7-contract-tests.md — sub-batch PR7d.
 * @see server/protocol/client-events-dispatch.mjs (PR4c, `resolveEventValidator`),
 *   server/protocol/snapshot-shape.mjs (PR5d), server/protocol/throttle-round-progress.mjs (PR5e).
 *
 * Toetst: onbekend event-type -> `UNSUPPORTED_EVENT` (via
 * `resolveEventValidator`), de snapshot-invariant ("geen correct antwoord van
 * een actieve ronde"), en de `round:progress`-throttle (max 2x/seconde).
 * Herimplementeert geen van deze logica: alle beslissingen lopen via de
 * geïnjecteerde `deps`-functies.
 */

/**
 * @param {ReturnType<typeof import('./fake-transport.mjs').createFakeSocketServer>} socketServer
 * @param {{ resolveEventValidator: Function, throttleRoundProgress: Function, snapshotHasNoActiveAnswer: Function }} deps
 * @returns {{ scenarios: Array<{ name: string, passed: boolean }> }}
 */
export function runEventAndSnapshotScenario(socketServer, deps) {
  const { resolveEventValidator, throttleRoundProgress, snapshotHasNoActiveAnswer } = deps;
  const scenarios = [];

  // Scenario 1 — onbekend event-type naar de socketserver -> UNSUPPORTED_EVENT.
  let unsupportedEventAck;
  socketServer.onConnection((socket) => {
    socket.on('room:teleport', ({ actionId, ack }) => {
      const resolveResult = resolveEventValidator('room:teleport');
      unsupportedEventAck = { actionId, ok: false, code: resolveResult.ok ? null : resolveResult.code };
      ack(unsupportedEventAck);
    });

    // Scenario voor de round:answer-envelope met een sessionToken-achtig
    // veld erin (rij 19) — dezelfde connectie, ander event.
    socket.on('round:answer', ({ actionId, payload, ack }) => {
      const resolveResult = resolveEventValidator('round:answer');
      if (!resolveResult.ok) {
        ack({ actionId, ok: false, code: resolveResult.code });
        return;
      }
      const validation = resolveResult.entry.validate(payload);
      ack({ actionId, ok: validation.ok, code: validation.ok ? null : 'INVALID_ANSWER_FORMAT' });
    });
  });

  const client = socketServer.connect({ sessionToken: 'tok_player1', protocolVersion: 'v1' });

  client.emit('room:teleport', 'act_unknown', {}, () => {});
  scenarios.push({
    name: 'onbekend event-type -> UNSUPPORTED_EVENT',
    passed: unsupportedEventAck?.ok === false && unsupportedEventAck?.code === 'UNSUPPORTED_EVENT',
  });

  // Scenario 2 — round:answer-payload met een sessionToken-achtig veld erin
  // (rij 19, Basisregel 3): geweigerd.
  let pollutedAck;
  client.emit(
    'round:answer',
    'act_polluted',
    {
      roundId: 'round_07',
      answer: { optionId: 'opt_2' },
      clientAnsweredAt: 1785623418451,
      sessionToken: 'sneaky-token-value',
    },
    (ack) => {
      pollutedAck = ack;
    },
  );
  scenarios.push({
    name: 'round:answer met sessionToken-achtig veld -> geweigerd',
    passed: pollutedAck?.ok === false,
  });

  // Scenario 3 — snapshot direct na join tijdens ROUND_ACTIVE: bevat geen
  // correct antwoord van de actieve ronde (snapshot-invariant).
  const snapshotDuringActiveRound = {
    protocolVersion: 'v1',
    serverTime: 1785623412000,
    room: {
      code: '482917', phase: 'ROUND_ACTIVE', locked: false, allowLateJoin: true,
      joinUrl: 'https://play.aseso.nl/j/N4x7pQm2K8tW', playerCount: 2, config: {}, matchId: 'match_01J',
    },
    self: { roles: ['player'], playerId: 'p_8f42d1', effectiveName: 'Ruben', score: 0, position: 1, answeredCurrentRound: false },
    currentRound: {
      matchId: 'match_01J', roundId: 'round_07', roundNumber: 1, totalRounds: 10,
      gameType: 'real_or_fake_flag', contentVersion: '2026.08.1',
      question: { promptKey: 'btnRealOrFakePrompt', image: {}, options: [] },
      startsAt: 1785623412000, endsAt: 1785623427000,
    },
    scoreboard: { top: [], self: {} },
  };
  const invariantResult = snapshotHasNoActiveAnswer(snapshotDuringActiveRound);
  scenarios.push({
    name: 'snapshot tijdens ROUND_ACTIVE bevat geen correct antwoord (invariant)',
    passed: invariantResult.ok === true,
  });

  // Scenario 4 — 5 aanroepen van de round:progress-broadcastpoging binnen 1
  // seconde, zelfde ronde: throttleRoundProgress staat maximaal 2 toe.
  const throttleRecords = new Map();
  const throttleStore = { get: (roundId) => throttleRecords.get(roundId) };
  const roundId = 'round_07';
  const baseTime = 1785623412000;
  let allowedCount = 0;
  for (let i = 0; i < 5; i += 1) {
    const attemptTime = baseTime + i * 100; // 5 pogingen binnen 500ms.
    const decision = throttleRoundProgress(throttleStore, roundId, attemptTime);
    if (decision.allow) {
      allowedCount += 1;
      throttleRecords.set(roundId, decision.record);
    }
  }
  scenarios.push({
    name: 'round:progress-throttle staat maximaal 2 van 5 pogingen binnen 1s toe',
    passed: allowedCount === 2,
  });

  return { scenarios };
}
