// tests/integration/full-match-transport.test.mjs
//
// DE KETEN-TEST OVER ECHT NETWERKVERKEER — laatste acceptatiecriterium van
// stap 2 van het integratieplan.
//
// `full-match.test.mjs` bewijst dezelfde keten IN-PROCESS: daar worden de
// compositiefuncties rechtstreeks aangeroepen. Dit bestand doet hetzelfde
// scenario, maar elke stap gaat over de echte laag:
//
//   - room, preview, joins en snapshots via ECHT HTTP (`fetch`) tegen de
//     server uit `server/index.mjs`, gestart op poort 0;
//   - drie ECHTE WebSocket-verbindingen met de Engine.IO-v4-handshake uit
//     PROTOCOL.md §Socket-auth, via `support/socket-io-test-client.mjs` (de
//     client die uit `server/transport/socket.test.mjs` hierheen is verhuisd —
//     `socket.io-client` bestaat niet in dit project en er mag geen dependency
//     bij);
//   - `game:start`, de rondes, `round:answer` met ack en de serverevents die
//     daarop volgen, allemaal als echte frames over die verbindingen.
//
// WAT ER GEEN ECHTE SECONDEN KOST. `context.now` is een handmatig verzette klok
// en de fasetimers van de socketlaag lopen via de scheduler die
// `attachSocketServer` zelf als injectiepunt aanbiedt. Er wordt daardoor NERGENS
// op tijd gewacht: elke assertie wacht op het EVENT (`waitFor`), nooit op een
// `setTimeout`. Het netwerk blijft echt; alleen de wandklok is bestuurd.
//
// TIEN RONDES INGEKORT TOT TWEE (plus één in de rematch) — motivatie: rondes
// 3..10 doorlopen letterlijk hetzelfde codepad als ronde 2 (COUNTDOWN →
// ROUND_ACTIVE → ROUND_RESULT → SCOREBOARD → COUNTDOWN) met dezelfde
// eventvormen; herhaling voegt over de wire geen dekking toe maar wel drie
// keer zoveel frames en leesregels. Wat bewust NIET vervalt: twee volledige
// ronde-cycli in match 1 (zodat óók de terugsprong SCOREBOARD → COUNTDOWN over
// de wire bewezen is), de rematch met een derde volledige cyclus, en alle zes
// verplichte asserties. De match wordt vervroegd afgesloten met `game:finish`
// — een gedocumenteerd hostevent uit het alfabet, geen testomweg.
//
// DE LOBBY-SNAPSHOT IS ONDERDEEL VAN DE KETEN, GEEN UITZONDERING MEER.
// `GET /api/v1/games/{code}/state` geeft in de lobby 200 met `matchId` en
// `matchSequence` allebei null (INT-17) — dat contract wordt hieronder in de
// ketentest afgemeten, vóór `game:start`, naast de snapshotasserties van een
// lopende ronde.
//
// ÉÉN OPENSTAAND PUNT WORDT NOG VASTGEPIND, NIET OMZEILD:
//   - INT-5: het juiste antwoord is voor `flags_mc` afleidbaar uit de publieke
//     payload (`question.targetIso2 === correctAnswer.optionId`). Zie
//     `assertSnapshotHidesCorrectAnswer`.

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSnapshotShape } from '../../server/protocol/snapshot-shape.mjs';

import { APP_URL } from './support/composition-harness.mjs';
import { startTransportServer } from './support/transport-harness.mjs';

// ── Vaste getallen uit de quick-start-configuratie (besluit 35 + 13) ────────

const TOTAL_ROUNDS = 10;
const COUNTDOWN_MS = 3000;
const QUESTION_MS = 15_000;
const RESULT_MS = 5000;
const SCOREBOARD_MS = 4000;

const HOST_OFFSET_MS = 2000;
const P2_OFFSET_MS = 2020;
const POINTS_FAST = 187; // 100 basis + 87 afgeronde tijdbonus

/** De requestbody die `validateCreateGameRequest` eist: `config.preset` + `config.language`. */
const CREATE_BODY = Object.freeze({ preset: 'quick_start', language: 'nl' });

// ─────────────────────────────────────────────────────────────────────────────
// Assertie 1 — de recursieve lekdetector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loopt het HELE object af (alle niveaus, arrays inbegrepen) en verzamelt:
 *   - `keyHits`  — elke sleutelnaam (of tekstwaarde) die "correctanswer" bevat;
 *   - `valueHits`— elk pad waar een tekstwaarde exact gelijk is aan het juiste
 *                  antwoord van deze ronde.
 *
 * Letterlijk dezelfde detector als in `full-match.test.mjs`. Die file mag niet
 * worden aangeraakt en exporteert niets, dus hij staat hier een tweede keer;
 * de zelfcontrole onderaan dit bestand bewijst dat déze kopie werkt.
 *
 * @param {unknown} root
 * @param {string} correctOptionId
 */
function collectAnswerLeaks(root, correctOptionId) {
  const keyHits = [];
  const valueHits = [];
  const walk = (node, path) => {
    if (typeof node === 'string') {
      if (node === correctOptionId) valueHits.push(path);
      if (node.toLowerCase().includes('correctanswer')) keyHits.push(`${path} (tekstwaarde ${JSON.stringify(node)})`);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((element, index) => walk(element, `${path}[${index}]`));
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        if (key.toLowerCase().includes('correctanswer')) keyHits.push(`${path}.${key} (sleutel)`);
        walk(child, `${path}.${key}`);
      }
    }
  };
  walk(root, '$');
  return { keyHits, valueHits };
}

/**
 * ASSERTIE 1. Draait de lekdetector over één snapshot die van de wire komt.
 *
 * INT-5 WORDT HIER VASTGEPIND, NIET OMZEILD. Voor `flags_mc` is de vraagvorm
 * `{ targetIso2, optionIso2s }` met `correctAnswer = { optionId: targetIso2 }`.
 * De waarde van het juiste antwoord staat dus onvermijdelijk twee keer in de
 * publieke payload: één keer als een van de vier opties (dat hoort bij multiple
 * choice) en één keer als `targetIso2` — dat tweede IS het lek. Zodra GR de
 * vraagvorm herontwerpt moet `nonOptionHits` LEEG zijn en hoort deze assertie
 * daarop te worden aangescherpt.
 *
 * @param {object} snapshot - de snapshot zoals hij over HTTP of de socket kwam
 * @param {{ roundId: string, correctOptionId: string, where: string }} params
 */
function assertSnapshotHidesCorrectAnswer(snapshot, { roundId, correctOptionId, where }) {
  assert.equal(snapshot.room.phase, 'ROUND_ACTIVE', `snapshot hoort van een actieve ronde te zijn (${where})`);
  assert.equal(snapshot.currentRound.roundId, roundId, where);

  const { keyHits, valueHits } = collectAnswerLeaks(snapshot, correctOptionId);

  // 1. De sleutel `correctAnswer` komt op geen enkel niveau voor.
  assert.deepEqual(keyHits, [], `snapshot draagt een correctAnswer-sleutel (${where})`);

  // 2. De WAARDE van het juiste antwoord komt alleen voor op de twee plekken
  //    die INT-5 beschrijft.
  const optionPrefix = '$.currentRound.question.optionIso2s[';
  const optionHits = valueHits.filter((path) => path.startsWith(optionPrefix));
  const nonOptionHits = valueHits.filter((path) => !path.startsWith(optionPrefix));
  assert.equal(optionHits.length, 1, `juiste antwoord hoort exact één keer in de opties te staan (${where})`);
  assert.deepEqual(nonOptionHits, ['$.currentRound.question.targetIso2'], `INT-5: onverwacht pad (${where})`);

  // 3. Tweede, onafhankelijke controle: de geserialiseerde respons.
  assert.ok(
    !JSON.stringify(snapshot).toLowerCase().includes('correctanswer'),
    `JSON-serialisatie bevat "correctAnswer" (${where})`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assertie 5 — geen interne foutcode en geen stacktrace over de wire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `INVALID_PAUSE_STATE` is de enige interne code van vandaag (besluit 12,
 * `server/architecture/state-machine.js`'s `INTERNAL_ERROR_CODES`). De rest zijn
 * fragmenten die alleen in een stacktrace of een rauwe `Error.message`
 * voorkomen.
 */
const FORBIDDEN_WIRE_FRAGMENTS = Object.freeze([
  'INVALID_PAUSE_STATE',
  '\n    at ',
  ' at async ',
  '.mjs:',
  '.js:',
  'node:internal',
  'Error:',
  'stacktrace',
]);

/**
 * ASSERTIE 5. Veegt ALLES na wat deze test van de server terugkreeg: elke
 * HTTP-responsbody én elk ontvangen socketevent (inclusief de `error`-events).
 *
 * @param {object} harness
 * @param {{ secretTokens?: string[] }} [options] - sessietokens die nooit in een
 *   socketframe mogen staan (in een REST-body mag het token juist wél: dat is
 *   de create/join-respons, de enige plek waar hij de server verlaat).
 */
function assertNoInternalLeakOnTheWire(harness, { secretTokens = [] } = {}) {
  for (const exchange of harness.exchanges) {
    const serialized = typeof exchange.body === 'string' ? exchange.body : JSON.stringify(exchange.body);
    for (const fragment of FORBIDDEN_WIRE_FRAGMENTS) {
      assert.ok(
        !serialized.includes(fragment),
        `${exchange.method} ${exchange.path} (${exchange.status}) bevat "${fragment}": ${serialized.slice(0, 200)}`,
      );
    }
  }

  for (const [index, client] of harness.clients.entries()) {
    const serialized = JSON.stringify(client.received);
    for (const fragment of FORBIDDEN_WIRE_FRAGMENTS) {
      assert.ok(!serialized.includes(fragment), `socket ${index} ontving "${fragment}"`);
    }
    assert.ok(!serialized.includes('sessionToken'), `socket ${index} ontving het woord "sessionToken"`);
    for (const token of secretTokens) {
      assert.ok(!serialized.includes(token), `socket ${index} ontving een sessietoken`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assertie 6 — geen sessietoken in een URL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ASSERTIE 6. PROTOCOL.md Basisregel 3: het sessietoken gaat in de
 * `Authorization`-header respectievelijk de socket-handshake-payload, nooit in
 * een pad of querystring. Gecontroleerd op élk verzoek dat deze test heeft
 * gedaan, inclusief de WebSocket-handshake-URL.
 *
 * @param {object} harness
 * @param {string[]} secretTokens
 */
function assertNoTokenInAnyUrl(harness, secretTokens) {
  const urls = [
    ...harness.exchanges.map((exchange) => `${exchange.method} ${exchange.path}`),
    ...harness.clients.map((client) => `WS ${client.handshakeUrl}`),
  ];
  assert.ok(urls.length > 0, 'er is geen enkel verzoek geregistreerd om te controleren');

  for (const url of urls) {
    for (const token of secretTokens) {
      assert.ok(!url.includes(token), `sessietoken staat in de URL: ${url}`);
    }
    // Ook geen tokenachtige parameternaam: een `?sessionToken=`/`?token=` zou
    // in serverlogs, Referer-headers en browsergeschiedenis belanden.
    assert.ok(!/token/i.test(url), `tokenachtige parameter in de URL: ${url}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ketenhulpjes
// ─────────────────────────────────────────────────────────────────────────────

let flushSequence = 0;

/**
 * Deterministische barrière ZONDER sleep: één rondgang over de echte socket.
 * `share:opened` muteert niets ("analytics, mag falen zonder UX-effect") en
 * levert alleen een ack. Omdat frames per verbinding geordend zijn, is elk
 * serverevent dat vóór dit moment naar deze socket is geschreven ook vóór de
 * ack aangekomen. Daarmee is "dit event is NIET gestuurd" toetsbaar zonder op
 * de klok te wachten.
 * @param {object} client
 */
async function flush(client) {
  flushSequence += 1;
  const ack = await client.emitWithAck('share:opened', {
    actionId: `act_flush_${flushSequence}`,
    payload: { method: 'link' },
  });
  assert.equal(ack.ok, true, `flush moet slagen: ${JSON.stringify(ack)}`);
}

/**
 * Wacht op het `index`-de voorkomen van een event op deze socket (0-based),
 * ook als het al binnen is. Nodig omdat dezelfde eventnaam per ronde terugkomt.
 * @param {object} client
 * @param {string} event
 * @param {number} index
 */
function waitForNth(client, event, index) {
  let seen = -1;
  return client.waitFor(event, () => {
    seen += 1;
    return seen === index;
  });
}

/** Maakt een room aan over echt HTTP en keurt de create-respons. */
async function createRoomOverHttp(harness, { displayName = null, hostParticipates = true } = {}) {
  const response = await harness.post('/api/v1/games', {
    body: { config: CREATE_BODY, hostParticipates, displayName },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}

/** Joint over echt HTTP en keurt de join-respons. */
async function joinOverHttp(harness, body) {
  const response = await harness.post('/api/v1/games/join', { body });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

/**
 * `sessionId` staat bewust NIET in de join-respons (die is intern). Voor het
 * socketpad naar een snapshot (`sendSnapshot(roomId, sessionId)`) is hij toch
 * nodig; hij komt hier uit de socketlaag zelf, niet uit een tweede aanname.
 * @param {object} harness
 * @param {string} playerId
 */
async function sessionIdOfConnectedPlayer(harness, playerId) {
  const sockets = await harness.attached.io.fetchSockets();
  const match = sockets.find((socket) => socket.data.playerId === playerId);
  assert.notEqual(match, undefined, `geen verbonden socket voor speler ${playerId}`);
  return match.data.sessionId;
}

/**
 * Laat de COUNTDOWN aflopen en wacht tot élke client `round:started` van deze
 * ronde heeft. Geeft de payload terug plus het juiste antwoord uit de store —
 * de ORAKELWAARDE waar de lekcontrole tegenaan meet, precies zoals de
 * in-process ketentest hem ook uit de poort haalt.
 */
async function openRoundOverTheWire(harness, roomId, clients, { roundNumber, matchId }) {
  harness.clock.advance(COUNTDOWN_MS);
  await harness.scheduler.fireAll();

  // Op `matchId` én `roundNumber` filteren, niet alleen op het rondenummer: na
  // een rematch begint de telling opnieuw bij 1 en zou een client anders het
  // oude `round:started` van de vorige match terugvinden.
  const envelopes = await Promise.all(
    clients.map((client) => client.waitFor(
      'round:started',
      (envelope) => envelope.payload.roundNumber === roundNumber && envelope.payload.matchId === matchId,
    )),
  );
  const started = envelopes[0].payload;

  // Elke meekijkende client kreeg exact hetzelfde room-event (één eventId).
  for (const envelope of envelopes) {
    assert.deepEqual(envelope, envelopes[0], 'round:started is een room-event: identiek voor elke ontvanger');
  }

  assert.equal(started.matchId, matchId);
  assert.equal(started.roundNumber, roundNumber);
  assert.equal(started.totalRounds, TOTAL_ROUNDS);
  assert.equal(started.gameType, 'flags_mc');
  assert.equal(started.endsAt - started.startsAt, QUESTION_MS);
  // Besluit 20: `round:started` draagt nooit het juiste antwoord.
  assert.equal('correctAnswer' in started, false);
  assert.equal(started.question.optionIso2s.length, 4);

  const roundDoc = await harness.store.loadRound(roomId, started.matchId, started.roundId);
  assert.notEqual(roundDoc, null, 'de ronde hoort in de store te staan');
  return { started, roundDoc };
}

/**
 * Stuurt één antwoord over de echte socket op een gekozen servertijdstip en
 * keurt de ack-vorm. De ack draagt bewust GEEN punten of correctheid
 * (Basisregel 4: dat mag de ronde niet verlaten vóór `round:ended`).
 */
async function answerOverTheWire(harness, client, { at, roundId, optionId, actionId }) {
  harness.clock.set(at);
  const ack = await client.emitWithAck('round:answer', {
    actionId,
    payload: { roundId, answer: { optionId }, clientAnsweredAt: at - 40 },
  });
  assert.equal(ack.ok, true, JSON.stringify(ack));
  assert.equal(ack.actionId, actionId);
  assert.deepEqual(ack.payload, { roundId }, 'de ack draagt alleen de roundId, geen punten of correctheid');
  return ack;
}

/**
 * Laat de rondedeadline verlopen en wacht op `round:ended` bij elke client.
 * @returns {Promise<object[]>} per client de ontvangen envelope
 */
async function closeRoundOverTheWire(harness, clients, { endsAt, roundId }) {
  harness.clock.set(Math.max(harness.clock.now(), endsAt));
  await harness.scheduler.fireAll();
  return Promise.all(
    clients.map((client) => client.waitFor('round:ended', (envelope) => envelope.payload.roundId === roundId)),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zelfcontrole van de lekdetector
// ─────────────────────────────────────────────────────────────────────────────

// Een lekdetector die niets vindt omdat hij stuk is, bewijst niets over
// assertie 1. Deze test toont dat hij een sleutel én een waarde op elk niveau
// vindt, ook binnen arrays.
test('De recursieve lekdetector vindt zowel de sleutel als de waarde, op elk niveau en binnen arrays', () => {
  const leaky = { a: [{ b: { correctAnswer: { optionId: 'XX' } } }], c: ['XX'], d: 'CorrectAnswer: XX' };
  const { keyHits, valueHits } = collectAnswerLeaks(leaky, 'XX');
  assert.deepEqual(keyHits, ['$.a[0].b.correctAnswer (sleutel)', '$.d (tekstwaarde "CorrectAnswer: XX")']);
  assert.deepEqual(valueHits, ['$.a[0].b.correctAnswer.optionId', '$.c[0]']);
  assert.deepEqual(collectAnswerLeaks({ room: { code: '123456' } }, 'XX'), { keyHits: [], valueHits: [] });
});

// ─────────────────────────────────────────────────────────────────────────────
// DE KETEN
// ─────────────────────────────────────────────────────────────────────────────

test('Keten over echt HTTP en echte WebSockets: room -> preview -> twee joins -> drie sockets -> start -> twee rondes -> eindstand -> rematch -> nog een ronde', async (t) => {
  const harness = await startTransportServer(t);

  // ── POST /api/v1/games ───────────────────────────────────────────────────
  const host = await createRoomOverHttp(harness, { displayName: 'Hester' });
  assert.match(host.gameCode, /^[0-9]{6}$/);
  assert.deepEqual(host.roles, ['host', 'player']);
  assert.equal(host.effectiveName, 'Hester');
  assert.equal(host.joinUrl, `${APP_URL}/j/${host.inviteId}`);
  assert.equal(host.state.room.phase, 'LOBBY');
  assert.equal(host.state.room.playerCount, 1);
  // Quick-start default (besluit 35 + 13), zoals de server hem over de wire zet.
  assert.deepEqual(host.state.room.config.gameTypes, ['flags_mc']);
  assert.equal(host.state.room.config.totalRounds, TOTAL_ROUNDS);
  assert.equal(host.state.room.config.questionSeconds, QUESTION_MS / 1000);
  assert.equal(host.state.room.config.deadlineGraceMs, 250);

  // ── GET /state in de lobby: 200 met een geldige pre-match-snapshot ───────
  // Er is nog geen match, dus `matchId` en `matchSequence` zijn ALLEBEI null
  // (INT-17) en `currentRound` is leeg. Dat is het contract van de lobby, hier
  // over echt HTTP nagemeten en met dezelfde validator gekeurd die de route
  // zelf gebruikt.
  const lobbyState = await harness.get(`/api/v1/games/${host.gameCode}/state`, { token: host.sessionToken });
  assert.equal(lobbyState.status, 200, JSON.stringify(lobbyState.body));
  assert.deepEqual(
    Object.keys(lobbyState.body).sort(),
    [
      'currentRound', 'participants', 'participantsTruncated', 'protocolVersion',
      'room', 'scoreboard', 'self', 'serverTime',
    ],
  );
  // FEEDBACK-eerste-livetest punt 1: over écht HTTP draagt de lobbysnapshot de
  // namen van iedereen die er al zit. Vóór deze wijziging kende de client
  // alleen `playerCount` en bleef elke rij behalve de eigen naam leeg.
  assert.equal(lobbyState.body.participants.length, lobbyState.body.room.playerCount);
  for (const participant of lobbyState.body.participants) {
    assert.ok(participant.effectiveName.length > 0, 'deelnemer zonder naam in de lobbysnapshot');
  }
  assert.equal(lobbyState.body.participantsTruncated, false);
  assert.equal(lobbyState.body.room.code, host.gameCode);
  assert.equal(lobbyState.body.room.phase, 'LOBBY');
  assert.equal(lobbyState.body.room.matchId, null);
  assert.equal(lobbyState.body.room.matchSequence, null);
  assert.equal(lobbyState.body.room.pausedState, null);
  assert.equal(lobbyState.body.room.playerCount, 1);
  assert.deepEqual(lobbyState.body.currentRound, {});
  assert.deepEqual(lobbyState.body.scoreboard.top, []);
  assert.equal(lobbyState.body.self.playerId, host.playerId);
  assert.deepEqual(lobbyState.body.self.roles, ['host', 'player']);
  assert.equal(lobbyState.body.self.eligibleFromRound, 1);
  assert.deepEqual(validateSnapshotShape(lobbyState.body), { ok: true });

  // ── GET /api/v1/games/preview ────────────────────────────────────────────
  const preview = await harness.get(`/api/v1/games/preview?inviteId=${encodeURIComponent(host.inviteId)}`);
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal(preview.body.roomId, host.roomId);
  assert.equal(preview.body.phase, 'LOBBY');
  assert.equal(preview.body.locked, false);
  assert.equal(preview.body.playerCount, 1);
  assert.ok(preview.body.suggestedName.length > 0);
  // Preview maakt geen sessie en geen speler aan: een tweede preview telt nog
  // steeds één deelnemer, en er staat geen token in de respons.
  const previewAgain = await harness.get(`/api/v1/games/preview?inviteId=${encodeURIComponent(host.inviteId)}`);
  assert.equal(previewAgain.body.playerCount, 1, 'preview schrijft niets weg');
  assert.equal('sessionToken' in previewAgain.body, false);

  const badPreview = await harness.get('/api/v1/games/preview?inviteId=niet%20geldig');
  assert.equal(badPreview.status, 400);
  assert.deepEqual(badPreview.body, { code: 'INVITE_INVALID', meta: {} });
  const unknownPreview = await harness.get(`/api/v1/games/preview?inviteId=${'A'.repeat(22)}`);
  assert.equal(unknownPreview.status, 404);
  assert.deepEqual(unknownPreview.body, { code: 'GAME_NOT_FOUND', meta: {} });

  // ── POST /api/v1/games/join, beide locators ──────────────────────────────
  const p2 = await joinOverHttp(harness, { inviteId: host.inviteId, displayName: 'Bram', joinSource: 'qr' });
  assert.deepEqual(p2.roles, ['player']);
  assert.equal(p2.gameCode, host.gameCode);
  assert.equal(p2.effectiveName, 'Bram');
  assert.equal(p2.state.room.playerCount, 2);

  const p3 = await joinOverHttp(harness, { gameCode: host.gameCode, displayName: null, joinSource: 'code' });
  assert.deepEqual(p3.roles, ['player']);
  assert.equal(p3.roomId, host.roomId);
  assert.ok(p3.effectiveName.length > 0, 'zonder naam levert de server een gegenereerde naam');
  assert.notEqual(p3.effectiveName, p2.effectiveName);
  assert.equal(p3.state.room.playerCount, 3);

  const secretTokens = [host.sessionToken, p2.sessionToken, p3.sessionToken];
  assert.equal(new Set(secretTokens).size, 3, 'elke sessie krijgt een eigen token');

  // ── Drie echte socketverbindingen ────────────────────────────────────────
  const hostSocket = await harness.connect(host.sessionToken);
  const p2Socket = await harness.connect(p2.sessionToken);
  const p3Socket = await harness.connect(p3.sessionToken);
  const everyone = [hostSocket, p2Socket, p3Socket];

  const connected = await harness.attached.io.fetchSockets();
  assert.equal(connected.length, 3);
  assert.deepEqual([...new Set(connected.map((socket) => socket.data.roomId))], [host.roomId]);

  // Rolbewaking over de wire: alleen de host mag starten.
  const notHost = await p2Socket.emitWithAck('game:start', { actionId: 'act_p2_start', payload: {} });
  assert.equal(notHost.ok, false);
  assert.equal(notHost.payload.code, 'NOT_HOST');
  const notHostError = await p2Socket.waitFor('error');
  assert.deepEqual(notHostError.payload, { actionId: 'act_p2_start', code: 'NOT_HOST', meta: {} });

  // ── game:start ───────────────────────────────────────────────────────────
  const startAck = await hostSocket.emitWithAck('game:start', { actionId: 'act_start_1', payload: {} });
  assert.equal(startAck.ok, true, JSON.stringify(startAck));
  assert.equal(startAck.payload.phase, 'COUNTDOWN');
  const firstMatchId = startAck.payload.matchId;

  for (const client of everyone) {
    const started = await client.waitFor('game:started');
    assert.deepEqual(started.payload, {
      matchId: firstMatchId,
      totalRounds: TOTAL_ROUNDS,
      countdownEndsAt: harness.clock.now() + COUNTDOWN_MS,
    });
  }

  // ── Ronde 1 — de volledige cyclus met alle asserties ─────────────────────
  const round1 = await openRoundOverTheWire(harness, host.roomId, everyone, { roundNumber: 1, matchId: firstMatchId });
  const { started: r1 } = round1;
  assert.equal(r1.matchId, firstMatchId);
  const correct1 = round1.roundDoc.correctAnswer.optionId;
  const wrong1 = round1.roundDoc.validOptionIds.find((id) => id !== correct1);

  // ── ASSERTIE 1: snapshotlek, via HTTP én via het socketpad, per sessie ───
  const snapshotsUnderTest = [];

  for (const session of [host, p2, p3]) {
    const state = await harness.get(`/api/v1/games/${host.gameCode}/state`, { token: session.sessionToken });
    assert.equal(state.status, 200, JSON.stringify(state.body));
    assert.equal(state.body.self.playerId, session.playerId);
    snapshotsUnderTest.push({ where: `HTTP GET /state, speler ${session.playerId}`, snapshot: state.body });
  }

  for (const [session, socket] of [[host, hostSocket], [p2, p2Socket], [p3, p3Socket]]) {
    const sessionId = await sessionIdOfConnectedPlayer(harness, session.playerId);
    const sent = await harness.attached.sendSnapshot(host.roomId, sessionId);
    assert.equal(sent.ok, true, JSON.stringify(sent));
    const envelope = await socket.waitFor('room:state');
    assert.equal(envelope.payload.self.playerId, session.playerId);
    snapshotsUnderTest.push({ where: `socket room:state, speler ${session.playerId}`, snapshot: envelope.payload });
  }

  assert.equal(snapshotsUnderTest.length, 6, 'drie sessies maal twee paden');
  for (const { where, snapshot } of snapshotsUnderTest) {
    assertSnapshotHidesCorrectAnswer(snapshot, { roundId: r1.roundId, correctOptionId: correct1, where });
  }

  // `room:state` is een single_session-event: niemand ziet de snapshot van een
  // ander. (Drie snapshots verstuurd, één per socket.)
  for (const client of everyone) {
    assert.equal(client.eventsNamed('room:state').length, 1);
  }

  // ── Antwoorden over de echte socket ──────────────────────────────────────
  const hostAnswerAck = await answerOverTheWire(harness, hostSocket, {
    at: r1.startsAt + HOST_OFFSET_MS, roundId: r1.roundId, optionId: correct1, actionId: 'act_r1_host',
  });
  const accepted = await hostSocket.waitFor('round:answer-accepted');
  assert.deepEqual(accepted.payload, { roundId: r1.roundId });

  // Idempotentie over de wire: dezelfde actionId geeft exact dezelfde ack.
  const replay = await answerOverTheWire(harness, hostSocket, {
    at: r1.startsAt + HOST_OFFSET_MS, roundId: r1.roundId, optionId: correct1, actionId: 'act_r1_host',
  });
  assert.deepEqual(replay, hostAnswerAck, 'een retry levert de gecachete ack, niet een nieuwe');

  await answerOverTheWire(harness, p2Socket, {
    at: r1.startsAt + P2_OFFSET_MS, roundId: r1.roundId, optionId: correct1, actionId: 'act_r1_p2',
  });
  await answerOverTheWire(harness, p3Socket, {
    at: r1.startsAt + P2_OFFSET_MS + 20, roundId: r1.roundId, optionId: wrong1, actionId: 'act_r1_p3',
  });

  // `round:answer-accepted` is persoonlijk: elke antwoorder precies één keer.
  for (const client of everyone) {
    await client.waitFor('round:answer-accepted');
    assert.equal(client.eventsNamed('round:answer-accepted').length, 1);
  }

  // ── round:ended ──────────────────────────────────────────────────────────
  const ended1 = await closeRoundOverTheWire(harness, everyone, { endsAt: r1.endsAt, roundId: r1.roundId });
  const [hostEnded, p2Ended, p3Ended] = ended1.map((envelope) => envelope.payload);

  // Pas hier verlaat het juiste antwoord de server (besluit 20) — en het is
  // dezelfde waarde die de lekcontrole hierboven als orakel gebruikte.
  assert.deepEqual(hostEnded.correctAnswer, round1.roundDoc.correctAnswer);
  assert.equal(hostEnded.correctAnswer.optionId, correct1);
  assert.equal(hostEnded.answeredCount, 3);
  assert.equal(hostEnded.eligiblePlayerCount, 3);
  assert.deepEqual(Object.keys(hostEnded.distribution).sort(), [...round1.roundDoc.validOptionIds].sort());
  assert.equal(hostEnded.distribution[correct1], 2);
  assert.equal(hostEnded.distribution[wrong1], 1);

  // `room_with_personal_fields`: één logisch event, per ontvanger eigen velden.
  assert.equal(ended1[0].eventId, ended1[1].eventId, 'één eventId voor de hele room');
  assert.equal(ended1[0].eventId, ended1[2].eventId);
  assert.deepEqual(
    { points: hostEnded.ownPoints, correct: hostEnded.ownCorrect, responseTimeMs: hostEnded.ownResponseTimeMs },
    { points: POINTS_FAST, correct: true, responseTimeMs: HOST_OFFSET_MS },
  );
  assert.deepEqual(
    { points: p2Ended.ownPoints, correct: p2Ended.ownCorrect, responseTimeMs: p2Ended.ownResponseTimeMs },
    { points: POINTS_FAST, correct: true, responseTimeMs: P2_OFFSET_MS },
  );
  assert.equal(p3Ended.ownCorrect, false);
  assert.equal(p3Ended.ownPoints, 0);

  // ── ROUND_RESULT -> SCOREBOARD ───────────────────────────────────────────
  harness.clock.advance(RESULT_MS);
  await harness.scheduler.fireAll();
  const scoreboard1 = await waitForNth(hostSocket, 'scoreboard:updated', 0);
  assert.equal(scoreboard1.payload.top[0].score, POINTS_FAST);
  assert.equal(scoreboard1.payload.top[0].rank, 1);
  assert.equal(scoreboard1.payload.self.score, POINTS_FAST, 'de host ziet zijn eigen stand');
  const p3Scoreboard1 = await waitForNth(p3Socket, 'scoreboard:updated', 0);
  assert.equal(p3Scoreboard1.payload.self.score, 0, 'speler 3 ziet zijn eigen 0, niet die van de host');

  // ── SCOREBOARD -> COUNTDOWN, en ronde 2 (tweede volledige cyclus) ────────
  harness.clock.advance(SCOREBOARD_MS);
  await harness.scheduler.fireAll();

  const round2 = await openRoundOverTheWire(harness, host.roomId, everyone, { roundNumber: 2, matchId: firstMatchId });
  const { started: r2 } = round2;
  assert.notEqual(r2.roundId, r1.roundId);
  assert.notEqual(r2.question.targetIso2, r1.question.targetIso2, 'geen herhaalde vraag binnen een match');
  const correct2 = round2.roundDoc.correctAnswer.optionId;

  await answerOverTheWire(harness, hostSocket, {
    at: r2.startsAt + HOST_OFFSET_MS, roundId: r2.roundId, optionId: correct2, actionId: 'act_r2_host',
  });
  await answerOverTheWire(harness, p2Socket, {
    at: r2.startsAt + P2_OFFSET_MS, roundId: r2.roundId, optionId: correct2, actionId: 'act_r2_p2',
  });

  const ended2 = await closeRoundOverTheWire(harness, everyone, { endsAt: r2.endsAt, roundId: r2.roundId });
  assert.equal(ended2[0].payload.answeredCount, 2, 'speler 3 antwoordde niet');
  assert.equal(ended2[0].payload.ownPoints, POINTS_FAST);

  harness.clock.advance(RESULT_MS);
  await harness.scheduler.fireAll();
  const scoreboard2 = await waitForNth(hostSocket, 'scoreboard:updated', 1);
  assert.equal(scoreboard2.payload.self.score, POINTS_FAST * 2, 'de scores stapelen over rondes heen');

  harness.clock.advance(SCOREBOARD_MS);
  await harness.scheduler.fireAll();

  // ── game:finish: vervroegd afsluiten (zie de motivatie bovenaan) ─────────
  const finishAck = await hostSocket.emitWithAck('game:finish', { actionId: 'act_finish_1', payload: {} });
  assert.equal(finishAck.ok, true, JSON.stringify(finishAck));
  assert.equal(finishAck.payload.phase, 'FINISHED');
  assert.equal(finishAck.payload.matchId, firstMatchId);
  assert.equal(harness.scheduler.pending, 0, 'game:finish ruimt de lopende fasetimer op');

  const finishedForHost = await hostSocket.waitFor('game:finished');
  const finishedForP2 = await p2Socket.waitFor('game:finished');
  const finishedForP3 = await p3Socket.waitFor('game:finished');

  assert.equal(finishedForHost.payload.matchId, firstMatchId);
  assert.equal(finishedForHost.payload.sequence, 1);
  assert.equal(typeof finishedForHost.payload.finishedAt, 'number');

  // De tiebreak over de wire: host en speler 2 hebben dezelfde score én
  // hetzelfde aantal goede antwoorden; alleen de totale responstijd scheidt ze.
  const podium = finishedForHost.payload.podium;
  assert.deepEqual(podium.map((entry) => entry.playerId), [host.playerId, p2.playerId, p3.playerId]);
  assert.equal(podium[0].score, POINTS_FAST * 2);
  assert.equal(podium[1].score, podium[0].score, 'gelijkspel op score');
  assert.equal(podium[0].correctCount, podium[1].correctCount, 'gelijkspel op aantal goed');
  assert.equal(podium[0].correctResponseTimeMsTotal, HOST_OFFSET_MS * 2);
  assert.equal(podium[1].correctResponseTimeMsTotal, P2_OFFSET_MS * 2);
  assert.ok(podium[0].correctResponseTimeMsTotal < podium[1].correctResponseTimeMsTotal, 'de responstijd beslist');
  assert.equal(podium[2].score, 0);

  // Persoonlijke velden: iedereen krijgt zijn eigen `self`, niet die van een ander.
  assert.equal(finishedForHost.payload.self.playerId, host.playerId);
  assert.equal(finishedForP2.payload.self.playerId, p2.playerId);
  assert.equal(finishedForP3.payload.self.playerId, p3.playerId);
  assert.equal(finishedForP3.payload.self.position, 3);
  assert.equal(finishedForHost.eventId, finishedForP2.eventId, 'één logisch event voor de hele room');

  // ── game:rematch ─────────────────────────────────────────────────────────
  const rematchAck = await hostSocket.emitWithAck('game:rematch', { actionId: 'act_rematch_1', payload: {} });
  assert.equal(rematchAck.ok, true, JSON.stringify(rematchAck));
  assert.equal(rematchAck.payload.sequence, 2);
  assert.notEqual(rematchAck.payload.matchId, firstMatchId);
  const secondMatchId = rematchAck.payload.matchId;

  const rematchStarted = await p3Socket.waitFor('game:rematch-started');
  assert.equal(rematchStarted.payload.matchId, secondMatchId);
  assert.equal(rematchStarted.payload.lobbyState.phase, 'LOBBY');
  assert.equal(rematchStarted.payload.lobbyState.playerCount, 3);
  // Zelfde room, zelfde code, zelfde inviteId en dus dezelfde joinUrl
  // (GAME-FLOW.md §12) — over de wire nagemeten, niet aangenomen.
  assert.equal(rematchStarted.payload.lobbyState.code, host.gameCode);
  assert.equal(rematchStarted.payload.lobbyState.joinUrl, host.joinUrl);
  const previewAfterRematch = await harness.get(`/api/v1/games/preview?inviteId=${encodeURIComponent(host.inviteId)}`);
  assert.equal(previewAfterRematch.status, 200);
  assert.equal(previewAfterRematch.body.roomId, host.roomId);
  assert.equal(previewAfterRematch.body.phase, 'LOBBY');

  // ── Derde volledige ronde-cyclus, nu in de rematch ───────────────────────
  const restartAck = await hostSocket.emitWithAck('game:start', { actionId: 'act_start_2', payload: {} });
  assert.equal(restartAck.ok, true, JSON.stringify(restartAck));
  assert.equal(restartAck.payload.matchId, secondMatchId);

  const round3 = await openRoundOverTheWire(harness, host.roomId, everyone, { roundNumber: 1, matchId: secondMatchId });
  const { started: r3 } = round3;
  assert.equal(r3.matchId, secondMatchId);
  assert.notEqual(r3.roundId, r1.roundId);
  const correct3 = round3.roundDoc.correctAnswer.optionId;

  await answerOverTheWire(harness, hostSocket, {
    at: r3.startsAt + HOST_OFFSET_MS, roundId: r3.roundId, optionId: correct3, actionId: 'act_r3_host',
  });
  const ended3 = await closeRoundOverTheWire(harness, everyone, { endsAt: r3.endsAt, roundId: r3.roundId });
  assert.equal(ended3[0].payload.matchId, secondMatchId);
  assert.equal(ended3[0].payload.ownPoints, POINTS_FAST);

  harness.clock.advance(RESULT_MS);
  await harness.scheduler.fireAll();
  const scoreboard3 = await waitForNth(hostSocket, 'scoreboard:updated', 2);
  assert.equal(scoreboard3.payload.self.score, POINTS_FAST, 'de rematch zet de scores op nul: 187, niet 561');
  assert.equal(scoreboard3.payload.top[0].score, POINTS_FAST);

  // ── ASSERTIE 5 en 6 over de VOLLEDIGE keten ──────────────────────────────
  assertNoInternalLeakOnTheWire(harness, { secretTokens });
  assertNoTokenInAnyUrl(harness, secretTokens);
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSERTIE 2 — matrixrij 11 over de wire
// ─────────────────────────────────────────────────────────────────────────────

test('Matrixrij 11 over de wire: twee gelijktijdig actieve rooms met echte verbindingen lekken geen enkel event naar elkaar', async (t) => {
  const harness = await startTransportServer(t);

  const hostA = await createRoomOverHttp(harness, { displayName: 'Host A' });
  const hostB = await createRoomOverHttp(harness, { displayName: 'Host B' });
  assert.notEqual(hostA.roomId, hostB.roomId);
  assert.notEqual(hostA.gameCode, hostB.gameCode);

  const playerA = await joinOverHttp(harness, { gameCode: hostA.gameCode, displayName: 'A-speler', joinSource: 'code' });
  const playerB = await joinOverHttp(harness, { gameCode: hostB.gameCode, displayName: 'B-speler', joinSource: 'code' });

  const hostASocket = await harness.connect(hostA.sessionToken);
  const playerASocket = await harness.connect(playerA.sessionToken);
  const hostBSocket = await harness.connect(hostB.sessionToken);
  const playerBSocket = await harness.connect(playerB.sessionToken);
  const roomAClients = [hostASocket, playerASocket];
  const roomBClients = [hostBSocket, playerBSocket];

  // Beide rooms tegelijk actief: A speelt een ronde, B zit op slot.
  const lockAck = await hostBSocket.emitWithAck('game:lock', { actionId: 'act_b_lock', payload: { locked: true } });
  assert.equal(lockAck.ok, true, JSON.stringify(lockAck));
  const startAck = await hostASocket.emitWithAck('game:start', { actionId: 'act_a_start', payload: {} });
  assert.equal(startAck.ok, true, JSON.stringify(startAck));

  for (const client of roomAClients) await client.waitFor('game:started');
  for (const client of roomBClients) await client.waitFor('room:lock-changed');

  const roundA = await openRoundOverTheWire(harness, hostA.roomId, roomAClients, { roundNumber: 1, matchId: startAck.payload.matchId });
  const correctA = roundA.roundDoc.correctAnswer.optionId;
  await answerOverTheWire(harness, playerASocket, {
    at: roundA.started.startsAt + 1000,
    roundId: roundA.started.roundId,
    optionId: correctA,
    actionId: 'act_a_answer',
  });
  await playerASocket.waitFor('round:answer-accepted');
  await hostASocket.waitFor('round:progress');
  await closeRoundOverTheWire(harness, roomAClients, { endsAt: roundA.started.endsAt, roundId: roundA.started.roundId });

  // Deterministische barrière: één rondgang per socket. Alles wat de server
  // vóór dit moment naar deze sockets zou hebben geschreven, is nu binnen.
  for (const client of [...roomAClients, ...roomBClients]) {
    await flush(client);
  }

  // Room B heeft NIETS van room A gezien.
  for (const client of roomBClients) {
    for (const event of ['game:started', 'round:started', 'round:progress', 'round:ended', 'round:answer-accepted']) {
      assert.equal(client.eventsNamed(event).length, 0, `room B mag "${event}" van room A niet zien`);
    }
    assert.equal(client.eventsNamed('room:lock-changed').length, 1, 'room B ziet alleen zijn eigen lock-event');
  }

  // Room A heeft NIETS van room B gezien.
  for (const client of roomAClients) {
    assert.equal(client.eventsNamed('room:lock-changed').length, 0, 'room A mag room B\'s lock-event niet zien');
    assert.equal(client.eventsNamed('game:started').length, 1);
    assert.equal(client.eventsNamed('round:started').length, 1);
  }

  // En geen enkel binnengekomen frame noemt de identifiers van de andere room.
  const wireA = JSON.stringify(roomAClients.map((client) => client.received));
  const wireB = JSON.stringify(roomBClients.map((client) => client.received));
  for (const identifier of [hostB.roomId, hostB.gameCode, hostB.inviteId, playerB.playerId]) {
    assert.ok(!wireA.includes(identifier), `room A ontving een identifier van room B: ${identifier}`);
  }
  for (const identifier of [hostA.roomId, hostA.gameCode, hostA.inviteId, playerA.playerId, startAck.payload.matchId]) {
    assert.ok(!wireB.includes(identifier), `room B ontving een identifier van room A: ${identifier}`);
  }

  // De domeinstate is ook echt uit elkaar gebleven.
  assert.equal((await harness.store.loadRoom(hostA.roomId)).locked, false);
  assert.equal((await harness.store.loadRoom(hostB.roomId)).locked, true);
  assert.equal((await harness.store.loadRoom(hostB.roomId)).currentMatchId, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSERTIE 3 — matrixrij 13 over de wire
// ─────────────────────────────────────────────────────────────────────────────

test('Matrixrij 13 over de wire: een reeks antwoorden levert hoogstens twee daadwerkelijk ontvangen round:progress-broadcasts per seconde', async (t) => {
  const harness = await startTransportServer(t);

  const host = await createRoomOverHttp(harness, { displayName: 'Host' });
  /** @type {object[]} */
  const players = [];
  for (const name of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
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

  const round = await openRoundOverTheWire(harness, host.roomId, [hostSocket], { roundNumber: 1, matchId: startAck.payload.matchId });
  const { roundId, startsAt } = round.started;
  const optionId = round.started.question.optionIso2s[0];

  // Vier antwoorden op EXACT hetzelfde servertijdstip. Het rollende venster van
  // 1000 ms laat er maximaal twee door (throttle-round-progress.mjs).
  harness.clock.set(startsAt + 500);
  for (let index = 0; index < 4; index += 1) {
    const ack = await playerSockets[index].emitWithAck('round:answer', {
      actionId: `act_answer_${index}`,
      payload: { roundId, answer: { optionId }, clientAnsweredAt: harness.clock.now() },
    });
    assert.equal(ack.ok, true, `antwoord ${index} moet geaccepteerd worden: ${JSON.stringify(ack)}`);
  }
  await flush(hostSocket);

  assert.equal(
    hostSocket.eventsNamed('round:progress').length,
    2,
    'vier antwoorden binnen één seconde geven precies twee ontvangen broadcasts',
  );

  // Het venster rolt door; daarna mogen er weer twee.
  harness.clock.set(startsAt + 500 + 1200);
  for (let index = 4; index < 6; index += 1) {
    const ack = await playerSockets[index].emitWithAck('round:answer', {
      actionId: `act_answer_${index}`,
      payload: { roundId, answer: { optionId }, clientAnsweredAt: harness.clock.now() },
    });
    assert.equal(ack.ok, true, JSON.stringify(ack));
  }
  await flush(hostSocket);

  const progressEvents = hostSocket.eventsNamed('round:progress');
  assert.equal(progressEvents.length, 4, 'na het rollende venster mogen er opnieuw twee door');

  // Geen enkel venster van één seconde bevat meer dan twee broadcasts — getoetst
  // op de `serverTime` die de ontvangen envelopes zelf dragen.
  const timestamps = progressEvents.map((entry) => entry.envelope.serverTime);
  for (const timestamp of timestamps) {
    const inWindow = timestamps.filter((other) => other >= timestamp && other < timestamp + 1000);
    assert.ok(inWindow.length <= 2, `venster vanaf ${timestamp} bevat ${inWindow.length} broadcasts`);
  }

  // De payload is de letterlijke vorm uit PROTOCOL.md en telt echt mee.
  const last = progressEvents.at(-1).envelope.payload;
  assert.deepEqual(Object.keys(last).sort(), ['answeredCount', 'eligiblePlayerCount']);
  assert.equal(last.eligiblePlayerCount, 7, 'zes joiners plus de meespelende host');
  assert.equal(last.answeredCount, 6);

  // Alle zes de antwoorden zijn wél verwerkt: throttling raakt alleen de
  // broadcast, nooit de acceptatie.
  for (const socket of playerSockets) {
    await socket.waitFor('round:answer-accepted');
    assert.equal(socket.eventsNamed('round:answer-accepted').length, 1);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSERTIE 4 — authenticatie
// ─────────────────────────────────────────────────────────────────────────────

test('Authenticatie over de wire: zonder bearer token, met een vals token en met een vervalste socket-handshake', async (t) => {
  const harness = await startTransportServer(t);

  const host = await createRoomOverHttp(harness, { displayName: 'Host' });
  const other = await createRoomOverHttp(harness, { displayName: 'Andere host' });

  // Zonder Authorization-header.
  const noHeader = await harness.get(`/api/v1/games/${host.gameCode}/state`);
  assert.equal(noHeader.status, 401);
  assert.deepEqual(noHeader.body, { code: 'TOKEN_INVALID', meta: {} });

  // Wel een header, maar geen bearer-vorm.
  const wrongScheme = await harness.get(`/api/v1/games/${host.gameCode}/state`, { authorization: host.sessionToken });
  assert.equal(wrongScheme.status, 401);
  assert.deepEqual(wrongScheme.body, { code: 'TOKEN_INVALID', meta: {} });

  // Een vals token in de juiste vorm.
  const fakeToken = 'dit-token-bestaat-niet-maar-lijkt-er-wel-op';
  const forged = await harness.get(`/api/v1/games/${host.gameCode}/state`, { token: fakeToken });
  assert.equal(forged.status, 401);
  assert.deepEqual(forged.body, { code: 'TOKEN_INVALID', meta: {} });

  // Hetzelfde voor het tweede eindpunt achter authenticatie.
  const leaveWithoutToken = await harness.post(`/api/v1/games/${host.gameCode}/leave`);
  assert.equal(leaveWithoutToken.status, 401);
  assert.deepEqual(leaveWithoutToken.body, { code: 'TOKEN_INVALID', meta: {} });

  // Een GELDIG token van een ANDERE room: geen 401 maar 404 — het bestaan van
  // een room waar je niets te zoeken hebt is zelf al informatie.
  const crossRoom = await harness.get(`/api/v1/games/${host.gameCode}/state`, { token: other.sessionToken });
  assert.equal(crossRoom.status, 404);
  assert.deepEqual(crossRoom.body, { code: 'GAME_NOT_FOUND', meta: {} });

  // Socket-handshake met een vals token: geweigerd, geen verbinding.
  await assert.rejects(
    () => harness.connect(fakeToken),
    (error) => {
      assert.deepEqual(error.data, { code: 'TOKEN_INVALID', meta: {} });
      return true;
    },
  );

  // Socket-handshake zonder token, en met een niet-ondersteunde protocolversie.
  await assert.rejects(
    () => harness.connectRaw({ protocolVersion: 'v1' }),
    (error) => {
      assert.equal(error.data.code, 'TOKEN_INVALID');
      return true;
    },
  );
  await assert.rejects(
    () => harness.connect(host.sessionToken, { protocolVersion: 'v2' }),
    (error) => {
      assert.equal(error.data.code, 'PROTOCOL_VERSION_UNSUPPORTED');
      return true;
    },
  );

  assert.equal((await harness.attached.io.fetchSockets()).length, 0, 'geen enkele geweigerde handshake liet een socket achter');

  // Met het juiste token werkt het wél — anders bewijst het bovenstaande niets.
  const good = await harness.connect(host.sessionToken);
  assert.ok(good);
  assert.equal((await harness.attached.io.fetchSockets()).length, 1);

  assertNoInternalLeakOnTheWire(harness, { secretTokens: [host.sessionToken, other.sessionToken] });
  assertNoTokenInAnyUrl(harness, [host.sessionToken, other.sessionToken, fakeToken]);
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSERTIE 5 — geen interne foutcode over de wire
// ─────────────────────────────────────────────────────────────────────────────

test('Geen interne foutcode over de wire: een uitgelokte INVALID_PAUSE_STATE bereikt noch de ack, noch het error-event, noch een responsbody', async (t) => {
  const harness = await startTransportServer(t);

  const host = await createRoomOverHttp(harness, { displayName: 'Host' });
  const player = await joinOverHttp(harness, { gameCode: host.gameCode, displayName: 'Speler', joinSource: 'code' });
  const hostSocket = await harness.connect(host.sessionToken);
  const playerSocket = await harness.connect(player.sessionToken);

  // ── De REST-kant ─────────────────────────────────────────────────────────
  //
  // Tot INT-17 werd de interne code hier uitgelokt door het LOBBY-snapshotgat:
  // dat gaf een 500 waarvan de body geen detail mocht dragen. Die 500 bestaat
  // niet meer (de lobby geeft nu gewoon 200), dus wordt de fout nu bij de bron
  // uitgelokt in plaats van bij een bug: de POORT werpt. Dat is exact het pad
  // dat een echte compositie-/domeinfout ook loopt — `rest.mjs` vangt alles wat
  // binnen de plugin werpt af in één `setErrorHandler`.
  //
  // Eerst een fout MÉT `protocolCode: 'INVALID_PAUSE_STATE'`, de enige interne
  // code van vandaag (besluit 12). Hij mag niet worden doorgegeven maar moet op
  // de gepubliceerde `INVALID_PHASE` worden afgebeeld — en de interne naam mag
  // in geen enkele body opduiken (de veeg onderaan controleert dat nogmaals).
  const realLoadRoomByCode = harness.store.loadRoomByCode.bind(harness.store);
  harness.store.loadRoomByCode = async () => {
    throw Object.assign(new Error('interne pauzetoestand: INVALID_PAUSE_STATE'), {
      protocolCode: 'INVALID_PAUSE_STATE',
    });
  };
  const internalOverRest = await harness.get(`/api/v1/games/${host.gameCode}/state`, { token: host.sessionToken });
  assert.equal(internalOverRest.status, 409, JSON.stringify(internalOverRest.body));
  assert.deepEqual(internalOverRest.body, { code: 'INVALID_PHASE', meta: {} });

  // Daarna een fout ZONDER protocolCode: dat is een serverfout en levert 500
  // zonder één woord over wat er misging. De boodschap is expres
  // stacktrace-achtig; belandt hij toch in de body, dan slaat de veeg aan.
  harness.store.loadRoomByCode = async () => {
    throw new Error('kapotte-poort in server/data/in-memory-store.js:42 — mag nooit naar buiten');
  };
  const serverFault = await harness.get(`/api/v1/games/${host.gameCode}/state`, { token: host.sessionToken });
  assert.equal(serverFault.status, 500);
  assert.deepEqual(serverFault.body, { code: 'INTERNAL_ERROR', meta: {} });

  harness.store.loadRoomByCode = realLoadRoomByCode;

  // Zelfcontrole: de poort is weer heel. Zonder deze regel zou een uitlokking
  // die per ongeluk niet aankwam (of niet werd teruggedraaid) onzichtbaar
  // blijven en zouden de twee asserties hierboven niets bewijzen.
  const healthyAgain = await harness.get(`/api/v1/games/${host.gameCode}/state`, { token: host.sessionToken });
  assert.equal(healthyAgain.status, 200, JSON.stringify(healthyAgain.body));
  assert.equal(healthyAgain.body.room.phase, 'LOBBY');

  // Pauzeren tijdens COUNTDOWN: `remainingMs` is dan niet uit persistente state
  // af te leiden, waardoor de state machine intern `INVALID_PAUSE_STATE`
  // oplevert (besluit 12).
  await hostSocket.emitWithAck('game:start', { actionId: 'act_start', payload: {} });
  await hostSocket.waitFor('game:started');

  const pauseAck = await hostSocket.emitWithAck('game:pause', { actionId: 'act_pause', payload: {} });
  assert.equal(pauseAck.ok, false);
  assert.equal(pauseAck.payload.code, 'INVALID_PHASE', 'de interne code is op een gepubliceerde afgebeeld');
  assert.deepEqual(pauseAck.payload.meta, {});

  const errorEvent = await hostSocket.waitFor('error');
  assert.deepEqual(errorEvent.payload, { actionId: 'act_pause', code: 'INVALID_PHASE', meta: {} });

  // `error` is een single_session-event: de andere speler ziet niets.
  await flush(playerSocket);
  assert.equal(playerSocket.eventsNamed('error').length, 0);

  // Ook een 404 en een 400 dragen geen detail. Alle bodies gaan hieronder door
  // dezelfde veeg.
  const unknownRoute = await harness.get('/api/v1/games/000000/state', { token: host.sessionToken });
  assert.equal(unknownRoute.status, 404);
  assert.deepEqual(unknownRoute.body, { code: 'GAME_NOT_FOUND', meta: {} });
  // Een misvormde create is `INVALID_REQUEST`, niet `INVITE_INVALID`: die
  // tweede blijft voorbehouden aan invite-/joinlocatorproblemen
  // (PROTOCOL.md §Foutcodes).
  const malformed = await harness.post('/api/v1/games', { body: { hostParticipates: 'ja' } });
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.body, { code: 'INVALID_REQUEST', meta: {} });

  assertNoInternalLeakOnTheWire(harness, { secretTokens: [host.sessionToken, player.sessionToken] });
  assertNoTokenInAnyUrl(harness, [host.sessionToken, player.sessionToken]);
});
