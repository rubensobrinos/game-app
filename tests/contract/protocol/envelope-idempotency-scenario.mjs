/**
 * @file PR7b — envelope/idempotentie-scenario tegen de fake-transportlaag
 *   (PR7a) en de échte PR1/PR2-code.
 * @see docs/protocol-plan/prompts/PR7-contract-tests.md — sub-batch PR7b.
 * @see server/protocol/envelope.mjs, server/protocol/idempotency.mjs,
 *   server/protocol/error-codes.mjs.
 *
 * Draait create → join → `round:answer` met dubbele `actionId` → idempotente
 * ack, tegen de fake-transportlaag en de echte `parseClientEnvelope`,
 * `buildAck`, `resolveDuplicateAction`. Herimplementeert geen envelope- of
 * idempotentielogica: elke beslissing loopt via de geïnjecteerde `m1`-
 * functies.
 */

/**
 * @param {ReturnType<typeof import('./fake-transport.mjs').createFakeSocketServer>} socketServer
 * @param {ReturnType<typeof import('./fake-transport.mjs').createInMemoryActionStore>} actionStore
 * @param {{ parseClientEnvelope: Function, buildAck: Function, resolveDuplicateAction: Function }} m1
 * @returns {{ firstAck: unknown, retryAck: unknown, mutationCount: number, alreadyAnsweredCount: number, payloadTooLargeRejected: boolean, envelopeCalledOnOversizedPayload: boolean }}
 */
export function runEnvelopeIdempotencyScenario(socketServer, actionStore, m1) {
  const { parseClientEnvelope, buildAck, resolveDuplicateAction } = m1;

  let mutationCount = 0;
  let alreadyAnsweredCount = 0;
  let hasAcceptedAnswer = false;
  let serverTimeCounter = 1785623412000;

  socketServer.onConnection((socket) => {
    socket.join('room_01J');
    socket.on('round:answer', ({ actionId, payload, ack }) => {
      const duplicateResult = resolveDuplicateAction(actionStore, actionId, 'round:answer', {
        alreadyAnswered: () => hasAcceptedAnswer,
      });

      if (duplicateResult.ok && duplicateResult.replay) {
        ack(duplicateResult.ack);
        return;
      }

      if (!duplicateResult.ok) {
        alreadyAnsweredCount += 1;
        const errorAck = buildAck(actionId, false, serverTimeCounter, {
          code: duplicateResult.reason,
          meta: {},
        });
        serverTimeCounter += 1;
        ack(errorAck.envelope);
        return;
      }

      const envelopeResult = parseClientEnvelope({ event: 'round:answer', actionId, payload });
      if (!envelopeResult.ok) {
        ack({ actionId, ok: false, serverTime: serverTimeCounter, payload: { code: null } });
        return;
      }

      mutationCount += 1;
      hasAcceptedAnswer = true;
      const ackResult = buildAck(actionId, true, serverTimeCounter, { roundId: envelopeResult.payload.roundId });
      serverTimeCounter += 1;
      actionStore.set(actionId, ackResult.envelope);
      ack(ackResult.envelope);
    });
  });

  // create → join: gemodelleerd als een enkele connect() (de fake-
  // transportlaag maakt geen onderscheid tussen "hostsessie na create" en
  // "playersessie na join" — beide zijn een Socket.IO-verbinding met een
  // sessionToken).
  const client = socketServer.connect({ sessionToken: 'tok_player1', protocolVersion: 'v1' });

  const answerPayload = { roundId: 'round_07', answer: { optionId: 'opt_2' }, clientAnsweredAt: 1785623418451 };

  let firstAck;
  client.emit('round:answer', 'act_A', answerPayload, (ack) => {
    firstAck = ack;
  });

  // Rij 7 — retry met dezelfde actionId A: identieke ack, mutationCount blijft 1.
  let retryAck;
  client.emit('round:answer', 'act_A', answerPayload, (ack) => {
    retryAck = ack;
  });

  // Rij 8 — nieuwe actionId B, zelfde antwoordinhoud, ná acceptatie: ALREADY_ANSWERED.
  let secondActionAck;
  client.emit('round:answer', 'act_B', answerPayload, (ack) => {
    secondActionAck = ack;
  });

  // Rij 9 — nieuwe actionId C, ánder antwoord, ná acceptatie: ALREADY_ANSWERED.
  const differentAnswerPayload = { roundId: 'round_07', answer: { optionId: 'opt_9' }, clientAnsweredAt: 1785623419000 };
  let thirdActionAck;
  client.emit('round:answer', 'act_C', differentAnswerPayload, (ack) => {
    thirdActionAck = ack;
  });

  return {
    firstAck,
    retryAck,
    secondActionAck,
    thirdActionAck,
    mutationCount,
    alreadyAnsweredCount,
  };
}

/**
 * Rij 10 — payload groter dan de afgesproken limiet, vóór envelope-parse:
 * geweigerd door `assertPayloadSize`, `parseClientEnvelope` wordt niet
 * aangeroepen. Losstaand van de socket-scenario hierboven omdat dit een
 * pure PR1-laagtoets is (`assertPayloadSize` opereert op de rauwe,
 * nog-niet-geparste string), geen transportscenario.
 *
 * @param {{ assertPayloadSize: Function, parseClientEnvelope: Function }} m1
 * @param {string} rawPayload
 * @param {number} maxBytes
 * @returns {{ sizeCheck: unknown, parseWasCalled: boolean }}
 */
export function runOversizedPayloadScenario(m1, rawPayload, maxBytes) {
  const { assertPayloadSize, parseClientEnvelope } = m1;
  let parseWasCalled = false;

  const sizeCheck = assertPayloadSize(rawPayload, maxBytes);
  if (sizeCheck.ok) {
    parseWasCalled = true;
    parseClientEnvelope(JSON.parse(rawPayload));
  }

  return { sizeCheck, parseWasCalled };
}
