// tests/integration/matrix-row-12-answer-idempotency.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 12 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra de answer-handler tegen échte opslag
//     (Redis/DB) idempotentie afdwingt, mag dit naar test.skip-code (DT3b)."
//   - Bewijs:
//       - server/composition/match-lifecycle.mjs `submitAnswer()` (regels
//         698-763) laadt `existingActionCacheEntry` via
//         `context.store.loadActionCacheEntry()` en geeft die ongewijzigd
//         terug bij een replay (`resolved.replay === true`), zonder een
//         nieuwe write.
//       - server/data/in-memory-store.js `saveAcceptedAnswerAtomically()`
//         (regels 229-288): controleert de action-cache EERST, vóór elke
//         andere check (DM13) — "existingActionCacheEntry !== undefined =>
//         return (replay, geen mutatie)" — en werpt `ALREADY_ANSWERED` zodra
//         dezelfde speler/ronde al een antwoord heeft onder een ANDERE
//         actionId (regels 250-262). Dit is de échte DataStore-poort
//         (server/data/repository.js), dezelfde implementatie die rijen
//         1/2/3/5/7/8/9/10/14 al gebruiken — geen fixture die toevallig
//         hetzelfde teruggeeft.
//   - Datum van deze audit/activatie: 2026-08-02 (tweede heraudit,
//     DT-R1-heraudit-integratie). Bij de vorige heraudit geblokkeerd:
//     `resolveAnswer()` was toen een pure functie zonder aanroeper die hem
//     tegen échte opslag uitvoerde — die aanroeper (`submitAnswer()` hierboven)
//     bestaat nu.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom } from '../../server/composition/room-lifecycle.mjs';
import { startMatch, startRound, submitAnswer } from '../../server/composition/match-lifecycle.mjs';
import { CONTENT_VERSION, RENDERER_VERSION, makeClock, makeContext } from './support/composition-harness.mjs';

test('Retry van round:answer met identieke actionId levert dezelfde ack zonder herverwerking; nieuwe actionId na een al geaccepteerd antwoord geeft ALREADY_ANSWERED; score wijzigt nooit tweemaal', async () => {
  const clock = makeClock();
  const context = makeContext({
    now: clock.now,
    config: { contentVersion: CONTENT_VERSION, rendererVersion: RENDERER_VERSION },
  });

  const room = (await createRoom(context, { hostParticipates: true, displayName: 'Host' })).value;
  await startMatch(context, { roomId: room.roomId });
  clock.advance(3000);
  const round = await startRound(context, { roomId: room.roomId });
  assert.equal(round.ok, true, JSON.stringify(round));
  const roundDoc = await context.store.loadRound(room.roomId, round.value.matchId, round.value.roundId);
  const correctOptionId = roundDoc.correctAnswer.optionId;
  const otherOptionId = roundDoc.validOptionIds.find((id) => id !== correctOptionId);

  const first = await submitAnswer(context, {
    roomId: room.roomId,
    playerId: room.playerId,
    roundId: round.value.roundId,
    answer: { optionId: correctOptionId },
    actionId: 'act_dup_1',
  });
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.value.replay, false);
  assert.equal(first.value.correct, true);
  const scoreAfterFirst = (await context.store.loadPlayer(room.roomId, room.playerId)).score;
  assert.ok(scoreAfterFirst > 0);

  // Exact dezelfde actionId: dezelfde ack, geen herverwerking.
  const replay = await submitAnswer(context, {
    roomId: room.roomId,
    playerId: room.playerId,
    roundId: round.value.roundId,
    answer: { optionId: correctOptionId },
    actionId: 'act_dup_1',
  });
  assert.equal(replay.ok, true, JSON.stringify(replay));
  assert.equal(replay.value.replay, true);
  assert.deepEqual(replay.value.ack, first.value.ack);
  assert.equal((await context.store.loadPlayer(room.roomId, room.playerId)).score, scoreAfterFirst);

  // Nieuwe actionId, ongewijzigde inhoud, ná een al geaccepteerd antwoord.
  const newActionSameContent = await submitAnswer(context, {
    roomId: room.roomId,
    playerId: room.playerId,
    roundId: round.value.roundId,
    answer: { optionId: correctOptionId },
    actionId: 'act_dup_2',
  });
  assert.deepEqual(newActionSameContent, { ok: false, code: 'ALREADY_ANSWERED' });

  // Nieuwe actionId, GEwijzigde inhoud, ná een al geaccepteerd antwoord.
  const newActionDifferentContent = await submitAnswer(context, {
    roomId: room.roomId,
    playerId: room.playerId,
    roundId: round.value.roundId,
    answer: { optionId: otherOptionId },
    actionId: 'act_dup_3',
  });
  assert.deepEqual(newActionDifferentContent, { ok: false, code: 'ALREADY_ANSWERED' });

  // Score is nooit tweemaal gewijzigd, ondanks vier submitAnswer-aanroepen.
  assert.equal((await context.store.loadPlayer(room.roomId, room.playerId)).score, scoreAfterFirst);
});
