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
//
// ─────────────────────────────────────────────────────────────────────────────
// WAAROM GEEN FLUSH-ACK ALS BARRIÈRE (ronde 3, de flaky Redis-race)
// ─────────────────────────────────────────────────────────────────────────────
//
// Deze test wachtte op de ack van een daarna verstuurd `share:opened` en nam
// aan dat daarmee álles binnen was wat de server eerder naar deze socket had
// geschreven. Die aanname klopt niet, en onder Redis viel hij ~1 op de 10 om
// (matrixrij 13 in STATUS.md, "keten-race onder Redis"):
//
//   1. `socket.mjs` stuurt eerst de ack van `round:answer` en draait pas dáárna
//      de `after`-hook, die `maybeEmitRoundProgress()` doet — bewust, zodat een
//      client zijn eigen ack nooit ná de bijbehorende broadcast ziet.
//   2. Die hook wacht op `listPlayers()`. In het geheugen is dat een al
//      opgeloste promise, tegen Redis een echte roundtrip.
//   3. `share:opened` raakt de store niet en wordt dus meteen beantwoord. De
//      ack en de nog lopende broadcast zijn geen keten maar een fotofinish.
//
// Gemeten (20 runs tegen `redis://127.0.0.1:6380`, direct na de ack van het
// hostantwoord): de flush-ack kwam gemiddeld 0,3 ms later terug, de broadcast
// gemiddeld 0,3 ms — in 19 runs kwam de broadcast er nog vóór of in hetzelfde
// frame, in 1 run duurde de Redis-roundtrip 1,5 ms en won de flush-ack. Het
// gedrag van de server is dus goed (er zijn altijd precies drie broadcasts, en
// nooit één vóór zijn eigen ack); de barrière van de test deugde niet.
//
// Daarom wacht deze test nu op de broadcasts zélf (`waitForCount`). Dat een
// venster er niet méér dan twee doorlaat, blijft exact getoetst: frames naar
// dezelfde room komen geordend over dezelfde verbinding binnen, dus een
// overtollige broadcast uit venster 1 is er al vóór die van venster 2 — de
// totaalcontrole (`=== 3`) vangt hem.
//
// Wat hierbij OPGEMERKT is en NIET hier gerepareerd (server/transport is deze
// ronde van een andere agent): de server serialiseert events per socket niet.
// De ack van een later event kan de broadcast van een eerder event inhalen.
// Voor de client is dat zichtbaar als "ack van B vóór broadcast van A".

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

  // Oorzakelijke barrière: wachten op de broadcasts zélf. NIET op de ack van
  // een volgend event — zie de kopnotitie "waarom geen flush-ack als barrière".
  // Dat er niet MEER dan twee komen, bewijst de totaalcontrole na het
  // rollende venster hieronder: broadcasts naar dezelfde room komen in volgorde
  // over dezelfde verbinding aan, dus een derde broadcast uit dit venster zou
  // vóór die van het volgende venster zijn binnengekomen.
  await hostSocket.waitForCount('round:progress', 2);

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

  await hostSocket.waitForCount('round:progress', 3);

  const progressEvents = hostSocket.eventsNamed('round:progress');
  assert.equal(
    progressEvents.length,
    3,
    'ná het rollende venster mag er weer één broadcast bij (2 + 1) — en geen enkele meer: '
      + 'vier antwoorden in het eerste venster geven er precies twee, niet vier',
  );

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
