// tests/integration/matrix-row-09-late-join-eligibility.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 9 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra join-tijdens-actieve-match end-to-end werkt
//     tegen de échte state machine én scoring, mag dit naar test.skip-code
//     (DT3b)."
//   - Bewijs:
//       - server/composition/match-lifecycle.mjs `resolveEligibleFromRound()`
//         (regels 1080-1108): kent `Match.roundIndex`/`Match.phase` op
//         joinmoment en berekent `eligibleFromRound` via
//         `computeEligibleFromRound()` (server/rules/eligibility.js) — geen
//         eigen `+1` hier.
//       - server/composition/room-lifecycle.mjs `joinRoom()` (regels 569-659):
//         neemt `eligibleFromRound` van de aanroeper over op het Player-
//         document, en weigert een late join met `LATE_JOIN_DISABLED`
//         (regels 590-594) zodra `room.phase !== 'LOBBY'` en
//         `allowLateJoin !== true` — `room.phase` is de projectie die
//         `setRoomAndMatchPhaseAtomically` (besluit 30) live bijhoudt zodra
//         een match loopt.
//       - server/data/answer-flow.js (via `submitAnswer()`) weigert een
//         antwoord van een speler die nog niet `eligibleFromRound` bereikt
//         met `PLAYER_NOT_ELIGIBLE`.
//       - server/composition/match-lifecycle.mjs `endRound()` (regels
//         779-856): telt `eligiblePlayerCount` op basis van
//         `isEligibleForRound()`, dus de late joiner telt niet mee in de
//         noemer van de gemiste ronde, wél vanaf de eerstvolgende ronde.
//     Dit was bij de vorige heraudit geblokkeerd: "geen gekoppelde match-laag
//     die de fase op joinmoment kent of late joiners van scoring/noemer
//     uitsluit" — die koppeling bestaat nu (hierboven), ook al is er nog geen
//     protocol-/socketlaag die de twee compositiefuncties automatisch na
//     elkaar aanroept; dat is een dispatch-verantwoordelijkheid buiten deze
//     matrixrij (rij 9 vereist de state-machine-/scoringkoppeling, niet de
//     transportlaag — zie rij 11 voor die laatste).
//   - Datum van deze audit/activatie: 2026-08-02 (tweede heraudit,
//     DT-R1-heraudit-integratie).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, joinRoom } from '../../server/composition/room-lifecycle.mjs';
import {
  endRound,
  resolveEligibleFromRound,
  startMatch,
  startRound,
  submitAnswer,
} from '../../server/composition/match-lifecycle.mjs';
import { CONTENT_VERSION, RENDERER_VERSION, makeClock, makeContext } from './support/composition-harness.mjs';

test('Speler joint na ronde-start terwijl allowLateJoin:true: geen punten voor gemiste rondes, telt pas mee vanaf de eerstvolgende nieuwe ronde', async () => {
  const clock = makeClock();
  const context = makeContext({
    now: clock.now,
    config: { contentVersion: CONTENT_VERSION, rendererVersion: RENDERER_VERSION },
  });

  const room = (await createRoom(context, { hostParticipates: true, displayName: 'Host', config: { totalRounds: 3 } })).value;
  const onTime = (await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code', displayName: 'OpTijd' })).value;

  await startMatch(context, { roomId: room.roomId });
  clock.advance(3000);
  const round1 = await startRound(context, { roomId: room.roomId });
  assert.equal(round1.ok, true, JSON.stringify(round1));

  clock.advance(2000);
  const eligibility = await resolveEligibleFromRound(context, { roomId: room.roomId });
  assert.equal(eligibility.ok, true, JSON.stringify(eligibility));
  assert.equal(eligibility.value.currentRoundNumber, 1);
  assert.equal(eligibility.value.eligibleFromRound, 2);
  assert.equal(eligibility.value.isLateJoin, true);

  const late = await joinRoom(context, {
    gameCode: room.gameCode,
    joinSource: 'code',
    displayName: 'Laatkomer',
    eligibleFromRound: eligibility.value.eligibleFromRound,
  });
  assert.equal(late.ok, true, JSON.stringify(late));
  assert.equal((await context.store.loadPlayer(room.roomId, late.value.playerId)).eligibleFromRound, 2);

  // Geen punten voor de gemiste ronde: de rules-laag weigert het antwoord.
  const round1Doc = await context.store.loadRound(room.roomId, round1.value.matchId, round1.value.roundId);
  const lateAttempt = await submitAnswer(context, {
    roomId: room.roomId,
    playerId: late.value.playerId,
    roundId: round1.value.roundId,
    answer: { optionId: round1Doc.correctAnswer.optionId },
    actionId: 'act_late_r1',
  });
  assert.deepEqual(lateAttempt, { ok: false, code: 'PLAYER_NOT_ELIGIBLE' });

  await submitAnswer(context, {
    roomId: room.roomId,
    playerId: onTime.playerId,
    roundId: round1.value.roundId,
    answer: { optionId: round1Doc.correctAnswer.optionId },
    actionId: 'act_ontime_r1',
  });

  clock.set(round1.value.endsAt);
  const ended1 = await endRound(context, { roomId: room.roomId });
  assert.equal(ended1.ok, true, JSON.stringify(ended1));
  // De late joiner telt niet mee in de noemer van ronde 1 (host + onTime = 2).
  assert.equal(ended1.value.eligiblePlayerCount, 2);
  assert.equal((await context.store.loadPlayer(room.roomId, late.value.playerId)).score, 0);
});

test('Bij allowLateJoin:false geeft join tijdens een actieve match LATE_JOIN_DISABLED', async () => {
  const clock = makeClock();
  const context = makeContext({
    now: clock.now,
    config: { contentVersion: CONTENT_VERSION, rendererVersion: RENDERER_VERSION },
  });
  const room = (await createRoom(context, {
    hostParticipates: true,
    displayName: 'Host',
    config: { allowLateJoin: false },
  })).value;

  // In de lobby mag het nog wel.
  const inLobby = await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code', displayName: 'OpTijd' });
  assert.equal(inLobby.ok, true, JSON.stringify(inLobby));

  await startMatch(context, { roomId: room.roomId });

  // room.phase is als projectie meegegaan (besluit 30); joinRoom() weigert op
  // basis van de échte, live fase.
  const tooLate = await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code', displayName: 'TeLaat' });
  assert.deepEqual(tooLate, { ok: false, code: 'LATE_JOIN_DISABLED' });
});
