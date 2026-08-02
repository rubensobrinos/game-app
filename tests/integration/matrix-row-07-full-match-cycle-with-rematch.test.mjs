// tests/integration/matrix-row-07-full-match-cycle-with-rematch.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 7 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra een game-server-instantie een volledige
//     match end-to-end kan draaien tegen een testroom (start, >=1 ronde,
//     finish, rematch) zonder gemockte tussenlagen, mag dit naar
//     test.skip-code (DT3b)."
//   - Bewijs: server/composition/match-lifecycle.mjs implementeert de volledige
//     cyclus als LIJM over al bestaande, geteste modules (state-machine.js,
//     answer-flow.js, standings.js, question-selection.js via
//     content-source.mjs):
//       - `startMatch()` (regels 469-540): LOBBY -> COUNTDOWN.
//       - `startRound()` (regels 601-674): COUNTDOWN -> ROUND_ACTIVE, bouwt
//         een échte vraag via `createContentSource().buildQuestion()`.
//       - `submitAnswer()` (regels 698-763): verwerkt `round:answer` via
//         `resolveAnswer()` + `saveAcceptedAnswerAtomically`.
//       - `endRound()` (regels 779-856): ROUND_ACTIVE -> ROUND_RESULT.
//       - `advancePhase()` (regels 556-583): de overige tijdgedreven
//         overgangen (ROUND_RESULT -> SCOREBOARD -> COUNTDOWN, of -> FINISHED
//         op de laatste ronde).
//       - `finishMatch()` (regels 914-967): eindstand met tiebreak uit
//         server/rules/standings.js.
//       - `rematch()` (regels 992-1058): nieuwe match, FINISHED -> LOBBY,
//         zelfde room/code/inviteId, scores gereset.
//     Elke fase-overgang loopt door `transition()` uit
//     server/architecture/state-machine.js (de enige bron van faselegaliteit);
//     opslag loopt door server/data/in-memory-store.js, een échte
//     implementatie van het DataStore-poortcontract (server/data/
//     repository.js), niet een testfixture. Rooms/spelers komen uit de échte
//     `room-lifecycle.createRoom()`/`joinRoom()` (zelfde functies als rij
//     1/2/3/5/8/9/10/12 hieronder/hierboven).
//   - Datum van deze audit/activatie: 2026-08-02 (tweede heraudit,
//     DT-R1-heraudit-integratie). Bij de vorige heraudit nog geblokkeerd:
//     `server/composition/` bevatte toen geen Match/Round-compositie;
//     `match-lifecycle.mjs` was net verschenen, ongecommitteerd en nog niet
//     zelf geverifieerd tegen een werkende `room-lifecycle.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, joinRoom } from '../../server/composition/room-lifecycle.mjs';
import {
  advancePhase,
  endRound,
  finishMatch,
  rematch,
  startMatch,
  startRound,
  submitAnswer,
} from '../../server/composition/match-lifecycle.mjs';
import { CONTENT_VERSION, RENDERER_VERSION, makeClock, makeContext } from './support/composition-harness.mjs';

/** Loopt van ROUND_RESULT via een eventuele tussenstand naar de volgende fase. */
async function leaveResultPhase(context, clock, roomId, roomConfig) {
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

test('Volledige matchcyclus: game:start vanuit LOBBY -> opeenvolgende round:started/round:ended -> game:finished -> game:rematch start nieuwe match binnen dezelfde room', async () => {
  const clock = makeClock();
  const context = makeContext({
    now: clock.now,
    config: { contentVersion: CONTENT_VERSION, rendererVersion: RENDERER_VERSION },
  });

  const totalRounds = 2;
  const room = (await createRoom(context, {
    hostParticipates: true,
    displayName: 'Host',
    config: { totalRounds },
  })).value;
  const roomConfig = (await context.store.loadRoom(room.roomId)).config;
  const joined = (await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code', displayName: 'Speler' })).value;

  const started = await startMatch(context, { roomId: room.roomId });
  assert.equal(started.ok, true, JSON.stringify(started));
  assert.equal(started.value.phase, 'COUNTDOWN');
  assert.equal(started.value.totalRounds, totalRounds);
  const firstMatchId = started.value.matchId;

  for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber += 1) {
    clock.advance(3000); // countdown -> round_active
    const roundStarted = await startRound(context, { roomId: room.roomId });
    assert.equal(roundStarted.ok, true, JSON.stringify(roundStarted));
    assert.equal(roundStarted.value.roundNumber, roundNumber);
    // round:started draagt nooit correctAnswer (besluit 20).
    assert.equal('correctAnswer' in roundStarted.value, false);

    clock.advance(1000);
    const roundDoc = await context.store.loadRound(room.roomId, roundStarted.value.matchId, roundStarted.value.roundId);
    // Vormgeldige maar (mogelijk) foute optie: het antwoord zelf hoeft voor
    // deze cyclus-test niet correct te zijn, alleen vormgeldig.
    const someOptionId = roundDoc.validOptionIds[0];
    const ack = await submitAnswer(context, {
      roomId: room.roomId,
      playerId: joined.playerId,
      roundId: roundStarted.value.roundId,
      answer: { optionId: someOptionId },
      actionId: `act_r${roundNumber}`,
    });
    assert.equal(ack.ok, true, JSON.stringify(ack));

    clock.set(roundStarted.value.endsAt);
    const roundEnded = await endRound(context, { roomId: room.roomId });
    assert.equal(roundEnded.ok, true, JSON.stringify(roundEnded));
    assert.equal(roundEnded.value.roundNumber, roundNumber);
    assert.equal(typeof roundEnded.value.correctAnswer, 'object');

    await leaveResultPhase(context, clock, room.roomId, roomConfig);
  }

  const finished = await finishMatch(context, { roomId: room.roomId });
  assert.equal(finished.ok, true, JSON.stringify(finished));
  assert.equal(finished.value.phase, 'FINISHED');
  assert.equal(finished.value.matchId, firstMatchId);
  assert.equal(finished.value.standings.length, 2);

  const rematched = await rematch(context, { roomId: room.roomId });
  assert.equal(rematched.ok, true, JSON.stringify(rematched));
  assert.equal(rematched.value.phase, 'LOBBY');
  assert.equal(rematched.value.previousMatchId, firstMatchId);
  assert.notEqual(rematched.value.matchId, firstMatchId);

  // De nieuwe match start binnen DEZELFDE room (zelfde code/roomId).
  const startedAgain = await startMatch(context, { roomId: room.roomId });
  assert.equal(startedAgain.ok, true, JSON.stringify(startedAgain));
  assert.equal(startedAgain.value.matchId, rematched.value.matchId);
  assert.notEqual(startedAgain.value.matchId, firstMatchId);
  assert.equal((await context.store.loadRoom(room.roomId)).code, room.gameCode);
});
