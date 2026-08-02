// tests/integration/matrix-row-13-round-progress-throttle-broadcast.test.mjs
//
// Metadata (puur ter traceerbaarheid, geen voorwaarde om te draaien):
//   - Matrixrij: 13 (docs/deployment-and-testing-plan/integration-matrix.md)
//   - Activatiecriterium: "Zodra de broadcastimplementatie bestaat, mag dit
//     naar test.skip-code (DT3b) — de test moet meerdere antwoorden binnen
//     <500 ms simuleren en het daadwerkelijke aantal emits binnen 1 seconde
//     tellen (≤2), niet alleen de eerste emit checken." Normatieve eis:
//     PROTOCOL.md:446 ("`round:progress` wordt maximaal tweemaal per seconde
//     gebroadcast.").
//   - Prerequisite: "Echte `round:progress`-broadcastlogica met
//     throttling/debounce tegen een tijdklok (niet een test die één enkele
//     emit controleert)."
//   - Bewijs: `server/transport/socket.mjs` `maybeEmitRoundProgress()`
//     (regel 598-613) roept `throttleRoundProgress()` uit
//     `server/protocol/throttle-round-progress.mjs` aan tegen een
//     room-gescopede `throttleStore` (regel 259-260) en zendt alleen
//     daadwerkelijk uit (`emitToRoom(roomId, 'round:progress', ...)`) wanneer
//     die beslissing `allow: true` teruggeeft. De aanroep zit in de échte
//     `round:answer`-verwerkingsketen: `runEvent()`'s `case 'round:answer'`
//     (regel 938-964) roept in zijn `after`-hook `maybeEmitRoundProgress()`
//     aan, ná elke geaccepteerde `submitAnswer()`. Dit is niet langer een
//     geïsoleerde module zonder aanroeper (zoals de vorige heraudit vaststelde)
//     — er is nu zowel een echte verwerkingsketen als een echt
//     broadcastmechanisme (`io.to(roomChannel(roomId)).emit(...)`, regel
//     372-374), bereikt via `server/index.mjs`'s `attachSocketsIfAvailable()`.
//   - Deze test stuurt VIER echte `round:answer`-events van vier verschillende
//     spelers op exact hetzelfde servertijdstip (binnen het rollende venster
//     van 1000 ms dat `throttle-round-progress.mjs` hanteert) over ÉÉN
//     ontvangende socket, en telt de daadwerkelijk AANGEKOMEN
//     `round:progress`-frames — niet de acceptatie van de antwoorden zelf,
//     die blijft ongethrottled. Daarna rolt het venster door (klok +1200 ms)
//     en bewijst een tweede reeks dat er daarna weer ruimte is, en dat geen
//     enkel venster van 1 seconde meer dan twee daadwerkelijk ontvangen
//     broadcasts bevat (gemeten op de `serverTime` van de ontvangen envelopes
//     zelf, niet op de volgorde van verzending).
//   - Datum van deze audit/activatie: 2026-08-02 (DT-R1-heraudit-integratie,
//     derde heraudit).

import test from 'node:test';
import assert from 'node:assert/strict';

import { startTransportServer } from './support/transport-harness.mjs';

const CREATE_BODY = Object.freeze({ preset: 'quick_start', language: 'nl' });
const COUNTDOWN_MS = 3000;

async function createRoomOverHttp(harness, displayName) {
  const response = await harness.post('/api/v1/games', {
    body: { config: CREATE_BODY, hostParticipates: true, displayName },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}

async function joinOverHttp(harness, body) {
  const response = await harness.post('/api/v1/games/join', { body });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

test('Matrixrij 13: round:progress wordt bij een reeks antwoorden hoogstens tweemaal per seconde daadwerkelijk gebroadcast', async (t) => {
  const harness = await startTransportServer(t);

  const host = await createRoomOverHttp(harness, 'Host');
  const players = [];
  for (const name of ['P1', 'P2', 'P3', 'P4']) {
    players.push(await joinOverHttp(harness, { gameCode: host.gameCode, displayName: name, joinSource: 'code' }));
  }

  const hostSocket = await harness.connect(host.sessionToken);
  const playerSockets = [];
  for (const player of players) {
    playerSockets.push(await harness.connect(player.sessionToken));
  }

  const startAck = await hostSocket.emitWithAck('game:start', { actionId: 'act_start', payload: {} });
  assert.equal(startAck.ok, true, JSON.stringify(startAck));
  await hostSocket.waitFor('game:started');

  harness.clock.advance(COUNTDOWN_MS);
  await harness.scheduler.fireAll();
  const started = (await hostSocket.waitFor('round:started')).payload;
  const roundDoc = await harness.store.loadRound(host.roomId, started.matchId, started.roundId);
  const optionId = roundDoc.correctAnswer.optionId;

  // ── Vier antwoorden op EXACT hetzelfde servertijdstip ────────────────────
  // Het rollende venster van 1000 ms in throttle-round-progress.mjs laat er
  // maximaal twee daadwerkelijk verzonden broadcasts door.
  harness.clock.set(started.startsAt + 500);
  for (let index = 0; index < 4; index += 1) {
    const ack = await playerSockets[index].emitWithAck('round:answer', {
      actionId: `act_answer_${index}`,
      payload: { roundId: started.roundId, answer: { optionId }, clientAnsweredAt: harness.clock.now() },
    });
    assert.equal(ack.ok, true, `antwoord ${index} moet geaccepteerd worden: ${JSON.stringify(ack)}`);
  }

  // Deterministische barrière: één rondgang over de socket die we tellen.
  const flushAck1 = await hostSocket.emitWithAck('share:opened', { actionId: 'act_flush_1', payload: { method: 'link' } });
  assert.equal(flushAck1.ok, true);

  assert.equal(
    hostSocket.eventsNamed('round:progress').length,
    2,
    'vier antwoorden binnen één seconde geven precies twee daadwerkelijk ontvangen broadcasts, niet vier',
  );

  // Alle vier de antwoorden zijn wél verwerkt: throttling raakt alleen de
  // broadcast, nooit de acceptatie van het antwoord zelf.
  for (const socket of playerSockets) {
    await socket.waitFor('round:answer-accepted');
    assert.equal(socket.eventsNamed('round:answer-accepted').length, 1);
  }

  // ── Het venster rolt door: daarna mag er weer een nieuwe broadcast ───────
  harness.clock.set(started.startsAt + 500 + 1200);
  const lateAnswerAck = await playerSockets[0].emitWithAck('round:answer', {
    actionId: 'act_answer_late',
    payload: { roundId: started.roundId, answer: { optionId }, clientAnsweredAt: harness.clock.now() },
  });
  // Al beantwoord door speler 0 in de eerste reeks; een nieuwe actionId voor
  // een reeds beantwoorde speler in dezelfde ronde levert ALREADY_ANSWERED en
  // triggert geen nieuwe broadcast. Gebruik in plaats daarvan de host, die nog
  // niet had geantwoord.
  assert.equal(lateAnswerAck.ok, false);
  assert.equal(lateAnswerAck.payload.code, 'ALREADY_ANSWERED');

  const hostAnswerAck = await hostSocket.emitWithAck('round:answer', {
    actionId: 'act_host_answer',
    payload: { roundId: started.roundId, answer: { optionId }, clientAnsweredAt: harness.clock.now() },
  });
  assert.equal(hostAnswerAck.ok, true, JSON.stringify(hostAnswerAck));

  const flushAck2 = await hostSocket.emitWithAck('share:opened', { actionId: 'act_flush_2', payload: { method: 'link' } });
  assert.equal(flushAck2.ok, true);

  const progressEvents = hostSocket.eventsNamed('round:progress');
  assert.equal(progressEvents.length, 3, 'ná het rollende venster mag er weer één broadcast bij (2 + 1)');

  // ── Geen enkel venster van 1 seconde bevat meer dan twee broadcasts ──────
  // Gemeten op de `serverTime` van de daadwerkelijk ontvangen envelopes, niet
  // op verzendvolgorde of een aanname.
  const timestamps = progressEvents.map((entry) => entry.envelope.serverTime);
  for (const timestamp of timestamps) {
    const inWindow = timestamps.filter((other) => other >= timestamp && other < timestamp + 1000);
    assert.ok(inWindow.length <= 2, `venster vanaf ${timestamp} bevat ${inWindow.length} broadcasts, hoort <=2 te zijn`);
  }

  // ── De payload is de letterlijke vorm uit PROTOCOL.md ────────────────────
  const last = progressEvents.at(-1).envelope.payload;
  assert.deepEqual(Object.keys(last).sort(), ['answeredCount', 'eligiblePlayerCount']);
  assert.equal(last.eligiblePlayerCount, 5, 'vier joiners plus de meespelende host');
  assert.equal(last.answeredCount, 5, 'alle vijf de spelers hebben inmiddels geantwoord');
});
