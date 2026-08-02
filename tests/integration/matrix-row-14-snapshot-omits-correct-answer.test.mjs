// tests/integration/matrix-row-14-snapshot-omits-correct-answer.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 14 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra de snapshotproducer bestaat en tegen een
//     actieve ronde (status ACTIVE) draait, mag dit naar test.skip-code
//     (DT3b) — de test moet de volledige serverresponse diepgaand doorzoeken
//     op de string correctAnswer, niet alleen de topleveltoetsen
//     controleren."
//   - Bewijs: server/composition/match-lifecycle.mjs `buildSnapshot()`
//     (regels 1136-1241) is de échte snapshotproducer: hij laadt de lopende
//     Round (met `correctAnswer` er middenin, server/data/types/round.js) uit
//     de poort en zet hem via `toActiveRoundSnapshot()` (het vangnet van de
//     Round-eigenaar, dat werpt zodra de ronde niet ACTIVE is) om naar de
//     publieke `currentRound`-vorm — een expliciete allowlist
//     (`matchId, roundId, roundNumber, totalRounds, gameType,
//     contentVersion, rendererVersion, question, startsAt, endsAt`), geen
//     spread van het Round-document. `Room.phase`/`Match.phase` bereiken
//     ACTIVE via de échte `startMatch()`/`startRound()` (matrixrij 7),
//     niet via een handmatig geprepareerde fixture.
//   - Datum van deze audit/activatie: 2026-08-02 (tweede heraudit,
//     DT-R1-heraudit-integratie). Bij de vorige heraudit geblokkeerd: er
//     bestond toen geen snapshotproducer-compositie en `Room.phase` bereikte
//     in de toenmalige compositie nooit ACTIVE.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, joinRoom } from '../../server/composition/room-lifecycle.mjs';
import { buildSnapshot, startMatch, startRound } from '../../server/composition/match-lifecycle.mjs';
import { CONTENT_VERSION, RENDERER_VERSION, makeClock, makeContext } from './support/composition-harness.mjs';

/**
 * Diepe zoektocht: elke sleutelnaam op elk niveau (case-insensitief), plus de
 * string in elke tekstwaarde. Matrixrij 14 eist expliciet een diepe
 * zoektocht in de VOLLEDIGE serverresponse, geen oppervlakkige veldcheck.
 */
function findCorrectAnswerLeaks(value, path = '$') {
  const hits = [];
  if (typeof value === 'string') {
    if (value.toLowerCase().includes('correctanswer')) {
      hits.push(`${path} (stringwaarde: ${JSON.stringify(value)})`);
    }
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((element, index) => hits.push(...findCorrectAnswerLeaks(element, `${path}[${index}]`)));
    return hits;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key.toLowerCase().includes('correctanswer')) {
        hits.push(`${path}.${key} (sleutel)`);
      }
      hits.push(...findCorrectAnswerLeaks(child, `${path}.${key}`));
    }
  }
  return hits;
}

test('Een room:state-snapshot die tijdens een actieve ronde door de échte snapshotproducer wordt opgebouwd, bevat op geen enkel niveau correctAnswer', async () => {
  const clock = makeClock();
  const context = makeContext({
    now: clock.now,
    config: { contentVersion: CONTENT_VERSION, rendererVersion: RENDERER_VERSION },
  });

  const room = (await createRoom(context, { hostParticipates: true, displayName: 'Host' })).value;
  const joined = (await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code', displayName: 'Speler' })).value;

  await startMatch(context, { roomId: room.roomId });
  clock.advance(3000);
  const roundStarted = await startRound(context, { roomId: room.roomId });
  assert.equal(roundStarted.ok, true, JSON.stringify(roundStarted));

  // Onafhankelijke bevestiging dat de ronde daadwerkelijk ACTIVE is en een
  // correctAnswer draagt in de opslag — anders bewijst een lege snapshot
  // niets over rij 14.
  const roundDoc = await context.store.loadRound(room.roomId, roundStarted.value.matchId, roundStarted.value.roundId);
  assert.equal(roundDoc.status, 'ACTIVE');
  assert.equal(typeof roundDoc.correctAnswer, 'object');
  assert.notEqual(roundDoc.correctAnswer, null);

  for (const sessionId of [room.sessionId, joined.sessionId, null]) {
    const snapshot = await buildSnapshot(context, { roomId: room.roomId, sessionId });
    assert.equal(snapshot.ok, true, JSON.stringify(snapshot));
    assert.equal(snapshot.value.currentRound.roundId, roundStarted.value.roundId);

    const leaks = findCorrectAnswerLeaks(snapshot.value);
    assert.deepEqual(leaks, [], `snapshot lekt correctAnswer voor sessionId=${JSON.stringify(sessionId)}: ${JSON.stringify(leaks)}`);

    // Extra vangnet, letterlijk zoals de matrixrij het stelt: de string
    // "correctAnswer" komt nergens in de geserialiseerde respons voor.
    const serialized = JSON.stringify(snapshot.value);
    assert.ok(!serialized.toLowerCase().includes('correctanswer'), 'JSON-serialisatie bevat "correctAnswer"');
  }
});
