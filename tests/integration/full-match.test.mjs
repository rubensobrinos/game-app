// tests/integration/full-match.test.mjs
//
// DE KETEN-TEST — definition-of-done van stap 1 van het integratieplan
// (docs/integration-plan/INT-PROGRESS.md, stap 1b).
//
// Eén doorlopend scenario over de VOLLEDIGE keten, in-process, tegen
// server/data/in-memory-store.js (de echte DataStore-poortimplementatie, geen
// fixture). Geen HTTP, geen sockets: dat is stap 2 en die is geblokkeerd door
// HANDOFF INT-3.
//
//   room (hostParticipates: true) -> preview -> join via inviteId (qr, eigen
//   naam) + join via code (geen naam -> gegenereerd) -> start -> countdown ->
//   10 rondes flags_mc (quick-start, besluit 35) met goede, foute, te late,
//   binnen-grace en dubbele antwoorden -> podium met tiebreak -> rematch
//   (zelfde room/code/inviteId, nieuwe matchId, scores op nul, vragen van de
//   vorige match vermeden) -> kick midden in de rematch.
//
// DETERMINISME. Vaste klok (makeClock), geseede PRNG voor de contentselectie
// (`config.random` -> content-source.mjs) en een tellergebaseerde
// `cryptoSource` voor IDs en sessietokens. `generateGameCode`/
// `generateInviteId` hebben geen injectiepunt en blijven echt random — geen
// enkele assertie hangt van hun waarde af, alleen van hun gelijk blijven over
// een rematch heen.
//
// ECHTE CONTENT: content-source.mjs draait op `getCountryPool()` uit
// shared/content/ (CT1). Geen stub aangetroffen.
//
// TWEE OPEN HANDOFF-ITEMS WORDEN VASTGEPIND, NIET OMZEILD:
//   - INT-14 (DM, hoog): replay ná `endsAt + grace` -> `DEADLINE_PASSED` in
//     plaats van de gecachete ack. Eigen test onderaan.
//   - INT-5 (GR + PR): het juiste antwoord is voor `flags_mc` afleidbaar uit
//     de publieke payload (`question.targetIso2 === correctAnswer.optionId`).
//     Zie `assertActiveRoundHidesCorrectAnswer`.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRoom,
  getShareInfo,
  joinRoom,
  kickPlayer,
  previewInvite,
  resolveSession,
} from '../../server/composition/room-lifecycle.mjs';
import {
  advancePhase,
  buildSnapshot,
  endRound,
  finishMatch,
  getScoreboard,
  rematch,
  startMatch,
  startRound,
  submitAnswer,
} from '../../server/composition/match-lifecycle.mjs';
import { CONTENT_VERSION, RENDERER_VERSION, makeClock, makeContext } from './support/composition-harness.mjs';

// ── Vaste getallen uit de quick-start-configuratie (besluit 35 + 13) ────────

const TOTAL_ROUNDS = 10;
const COUNTDOWN_MS = 3000;
const QUESTION_MS = 15_000;
const RESULT_MS = 5000;
const SCOREBOARD_MS = 4000;
const GRACE_MS = 250;

// Twee responstijden die dezelfde AFGERONDE snelheidsbonus opleveren
// (round(100 * (15000 - t) / 15000) is 87 voor beide) maar een verschillende
// `correctResponseTimeMsTotal`. Daarmee eindigen host en speler 2 met een
// gelijke score én een gelijk aantal goede antwoorden, en beslist uitsluitend
// de derde tiebreak-sleutel uit server/rules/standings.js de eindstand.
const HOST_OFFSET_MS = 2000;
const P2_OFFSET_MS = 2020;
const POINTS_FAST = 187; // 100 basis + 87 bonus
const POINTS_NO_BONUS = 100; // besluit 13: binnen grace nooit tijdbonus

// ── Determinisme-injectie ───────────────────────────────────────────────────

/** Geseede PRNG (mulberry32) — vervangt Math.random in de contentselectie. */
function makeRandom(seed = 0x1f2e3d4c) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Tellergebaseerde `randomBytes`: reproduceerbare IDs en sessietokens. */
function makeCryptoSource(seed = 0x0bad_c0de) {
  let state = seed >>> 0;
  return {
    randomBytes(size) {
      const out = Buffer.alloc(size);
      for (let index = 0; index < size; index += 1) {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
        out[index] = state >>> 24;
      }
      return out;
    },
  };
}

/** Contextfabriek voor deze keten: vaste klok, vaste PRNG, echte poort. */
function makeChainEnvironment() {
  const clock = makeClock();
  const config = { contentVersion: CONTENT_VERSION, rendererVersion: RENDERER_VERSION, random: makeRandom() };
  // `cryptoSource` gaat niet door makeContext heen; hier erbij gezet.
  const context = makeContext({ now: clock.now, config });
  return { clock, context: { ...context, cryptoSource: makeCryptoSource() } };
}

// ── Assertie A: recursieve lekcontrole op een actieve-rondesnapshot ─────────

/**
 * Loopt het HELE object af (alle niveaus, arrays inbegrepen) en verzamelt:
 *   - `keyHits`  — elke sleutelnaam (of tekstwaarde) die "correctanswer" bevat;
 *   - `valueHits`— elk pad waar een tekstwaarde exact gelijk is aan het juiste
 *                  antwoord van deze ronde.
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
 * ASSERTIE A. Bouwt voor élke meegegeven sessie een snapshot van de LOPENDE,
 * actieve ronde en controleert op twee manieren dat het juiste antwoord er niet
 * uit te lezen is: een recursieve sleutel-/waardenzoektocht én een
 * `JSON.stringify`-controle.
 *
 * INT-5 (open, GR + PR) WORDT HIER VASTGEPIND. Voor `flags_mc` is de vraagvorm
 * `{ targetIso2, optionIso2s }` met `correctAnswer = { optionId: targetIso2 }`.
 * De waarde van het juiste antwoord staat dus onvermijdelijk in de publieke
 * payload: één keer als een van de vier opties (dat hoort bij multiple choice)
 * en één keer als `targetIso2` — dat tweede IS het lek. Deze assertie legt
 * exact die twee plekken vast. Zodra GR de vraagvorm herontwerpt moet
 * `nonOptionHits` LEEG zijn en hoort de assertie daarop te worden aangescherpt.
 * Er is bewust geen omweg omheen gebouwd.
 *
 * @param {{ context: object, roomId: string }} env
 * @param {{ sessionIds: Array<string|null>, roundId: string, correctOptionId: string }} params
 */
async function assertActiveRoundHidesCorrectAnswer(env, { sessionIds, roundId, correctOptionId }) {
  for (const sessionId of sessionIds) {
    const snapshot = await buildSnapshot(env.context, { roomId: env.roomId, sessionId });
    assert.equal(snapshot.ok, true, JSON.stringify(snapshot));
    assert.equal(snapshot.value.currentRound.roundId, roundId);

    const where = `sessionId=${JSON.stringify(sessionId)}, roundId=${roundId}`;
    const { keyHits, valueHits } = collectAnswerLeaks(snapshot.value, correctOptionId);

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
    const serialized = JSON.stringify(snapshot.value);
    assert.ok(!serialized.toLowerCase().includes('correctanswer'), `JSON-serialisatie bevat "correctAnswer" (${where})`);
  }
}

// ── Kleine ketenhelpers ─────────────────────────────────────────────────────

/**
 * Zet de klok op een absoluut tijdstip en stuurt één antwoord in namens
 * `who` ('host' | 'p2' | 'p3'). `clientAnsweredAt` is diagnostiek en mag de
 * scoring nooit raken (GAME-RULES.md); servertijd is leidend.
 */
async function answerAt(env, who, { at, roundId, optionId, actionId }) {
  env.clock.set(at);
  return submitAnswer(env.context, {
    roomId: env.roomId, playerId: env[who].playerId, roundId,
    answer: { optionId }, actionId, clientAnsweredAt: at - 40,
  });
}

/** Score zoals die in de poort staat — de enige bron voor "is er dubbel geteld?". */
async function storedScore(env, playerId) {
  return (await env.context.store.loadPlayer(env.roomId, playerId)).score;
}

/** Aantal spelers dat nog echt meedoet (niet gekickt, niet vertrokken). */
async function activePlayerCount(env) {
  const players = await env.context.store.listPlayers(env.roomId);
  return players.filter((player) => player.kicked !== true && player.left !== true).length;
}

/**
 * Speelt één volledige ronde: countdown -> vraag -> antwoorden van host en
 * speler 2 -> optioneel scenario -> assertie A -> uitslag -> tussenstand ->
 * door naar de volgende fase.
 *
 * Host en speler 2 antwoorden élke ronde correct op een vast tijdstip. Dat is
 * geen decoratie: het is de motor onder de tiebreak in de eindstand.
 *
 * @param {object} env
 * @param {number} roundNumber
 * @param {(scenario: object) => Promise<void>} [scenario] - draait terwijl de
 *   ronde nog ACTIVE is, ná de antwoorden van host en speler 2.
 */
async function playRound(env, roundNumber, scenario = null) {
  const { context, clock, roomId } = env;

  clock.advance(COUNTDOWN_MS);
  const started = await startRound(context, { roomId });
  assert.equal(started.ok, true, JSON.stringify(started));
  assert.equal(started.value.roundNumber, roundNumber);
  assert.equal(started.value.totalRounds, TOTAL_ROUNDS);
  assert.equal(started.value.gameType, 'flags_mc');
  assert.equal(started.value.contentVersion, CONTENT_VERSION);
  assert.equal(started.value.endsAt - started.value.startsAt, QUESTION_MS);
  // Besluit 20: `round:started` draagt nooit het juiste antwoord.
  assert.equal('correctAnswer' in started.value, false);
  assert.equal(typeof started.value.question.targetIso2, 'string');
  assert.equal(started.value.question.optionIso2s.length, 4);

  const { matchId, roundId, startsAt, endsAt } = started.value;
  const roundDoc = await context.store.loadRound(roomId, matchId, roundId);
  assert.equal(roundDoc.status, 'ACTIVE');
  const correctOptionId = roundDoc.correctAnswer.optionId;
  const wrongOptionId = roundDoc.validOptionIds.find((id) => id !== correctOptionId);
  env.usedQuestionKeys.push(roundDoc.questionKey);

  // Host en speler 2: allebei goed, allebei binnen dezelfde bonusstap.
  env.expected.host += POINTS_FAST;
  const hostAt = startsAt + HOST_OFFSET_MS;
  const hostAck = await answerAt(env, 'host', { at: hostAt, roundId, optionId: correctOptionId, actionId: `${matchId}-r${roundNumber}-host` });
  assert.equal(hostAck.ok, true, JSON.stringify(hostAck));
  assert.deepEqual(hostAck.value.ack, { roundId });
  assert.equal(hostAck.value.replay, false);
  assert.equal(hostAck.value.correct, true);
  assert.equal(hostAck.value.points, POINTS_FAST);
  assert.equal(hostAck.value.responseTimeMs, HOST_OFFSET_MS, 'servertijd is leidend, niet de clienttijd');
  assert.equal(hostAck.value.clientAnsweredAt, hostAt - 40, 'clienttijd komt ongewijzigd terug als diagnostiek');
  assert.equal(hostAck.value.score, env.expected.host);

  env.expected.p2 += POINTS_FAST;
  const p2ActionId = `${matchId}-r${roundNumber}-p2`;
  const p2Ack = await answerAt(env, 'p2', { at: startsAt + P2_OFFSET_MS, roundId, optionId: correctOptionId, actionId: p2ActionId });
  assert.equal(p2Ack.ok, true, JSON.stringify(p2Ack));
  assert.equal(p2Ack.value.correct, true);
  assert.equal(p2Ack.value.points, POINTS_FAST, 'zelfde afgeronde bonus als de host');
  assert.equal(p2Ack.value.responseTimeMs, P2_OFFSET_MS, 'maar een andere responstijd');
  assert.equal(p2Ack.value.score, env.expected.p2);

  if (scenario !== null) {
    await scenario({ matchId, roundId, startsAt, endsAt, correctOptionId, wrongOptionId, p2ActionId });
  }

  // ASSERTIE A — nog steeds ACTIVE, alle drie de sessies plus een sessieloze
  // waarnemer.
  const sessionIds = [env.host.sessionId, env.p2.sessionId, env.p3.sessionId, null];
  await assertActiveRoundHidesCorrectAnswer(env, { sessionIds, roundId, correctOptionId });

  // Uitslag. De klok mag door een scenario al voorbij `endsAt` staan; nooit
  // terugzetten.
  clock.set(Math.max(clock.now(), endsAt));
  const ended = await endRound(context, { roomId });
  assert.equal(ended.ok, true, JSON.stringify(ended));
  assert.equal(ended.value.roundNumber, roundNumber);
  assert.equal(ended.value.phase, 'ROUND_RESULT');
  // Pas hier verlaat het juiste antwoord de server (besluit 20).
  assert.deepEqual(ended.value.correctAnswer, roundDoc.correctAnswer);
  assert.equal(ended.value.results.length, await activePlayerCount(env));

  for (const [playerId, offsetMs] of [[env.host.playerId, HOST_OFFSET_MS], [env.p2.playerId, P2_OFFSET_MS]]) {
    const entry = ended.value.results.find((result) => result.playerId === playerId);
    // Besluit 54: een scenario mag het verwachte resultaat van p2 overschrijven
    // wanneer het bewust een correctie doet — dan telt de láátste tik, en dus
    // een andere responstijd en een andere puntentelling. Eén ronde per keer;
    // de override wordt hierna gewist zodat de volgende ronde weer de normale
    // verwachting heeft.
    const override = playerId === env.p2.playerId ? env.overrideP2Result : null;
    assert.deepEqual(
      { answered: entry.answered, correct: entry.correct, points: entry.points, responseTimeMs: entry.responseTimeMs, eligible: entry.eligible },
      override ?? { answered: true, correct: true, points: POINTS_FAST, responseTimeMs: offsetMs, eligible: true },
    );
  }
  env.overrideP2Result = null;

  // De verdeling telt precies de geaccepteerde antwoorden en kent alle vier de
  // opties (server/rules/answer-distribution.js, besluit 14).
  // Geordende array (stap 6, 5 aug 2026): één entry per optie, in optievolgorde.
  assert.deepEqual(
    ended.value.distribution.map((entry) => entry.optionId).sort(),
    [...roundDoc.validOptionIds].sort(),
  );
  const distributionTotal = ended.value.distribution.reduce((sum, entry) => sum + entry.count, 0);
  assert.equal(distributionTotal, ended.value.answeredCount);
  const correcteTelling = ended.value.distribution.find((entry) => entry.optionId === correctOptionId).count;
  assert.ok(correcteTelling >= 2, 'host en speler 2 antwoordden goed');

  // Tussenstand.
  const scoreboard = await getScoreboard(context, { roomId });
  assert.equal(scoreboard.ok, true, JSON.stringify(scoreboard));
  assert.equal(scoreboard.value.roundNumber, roundNumber);
  assert.equal(scoreboard.value.top[0].score, Math.max(env.expected.host, env.expected.p2));
  assert.equal(scoreboard.value.top[0].rank, 1);
  assert.equal(typeof scoreboard.value.top[0].effectiveName, 'string');

  // ROUND_RESULT -> SCOREBOARD (`scoreboardFrequency: 'every_round'`).
  clock.advance(RESULT_MS);
  const toScoreboard = await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } });
  assert.equal(toScoreboard.ok, true, JSON.stringify(toScoreboard));
  assert.equal(toScoreboard.value.phase, 'SCOREBOARD');

  clock.advance(SCOREBOARD_MS);
  const afterScoreboard = await advancePhase(context, { roomId, event: { type: 'TIMER_ELAPSED' } });
  assert.equal(afterScoreboard.ok, true, JSON.stringify(afterScoreboard));
  assert.equal(afterScoreboard.value.phase, roundNumber >= TOTAL_ROUNDS ? 'FINISHED' : 'COUNTDOWN');

  return { matchId, roundId, startsAt, endsAt, correctOptionId, wrongOptionId, ended: ended.value };
}

// ── De keten ────────────────────────────────────────────────────────────────

// Zelfcontrole vóór alles: een lekdetector die niets vindt omdat hij stuk is,
// bewijst niets over assertie A. Deze test toont dat hij een sleutel én een
// waarde op elk niveau vindt, ook binnen arrays.
test('De recursieve lekdetector van assertie A vindt zowel de sleutel als de waarde, op elk niveau en binnen arrays', () => {
  const leaky = { a: [{ b: { correctAnswer: { optionId: 'XX' } } }], c: ['XX'], d: 'CorrectAnswer: XX' };
  const { keyHits, valueHits } = collectAnswerLeaks(leaky, 'XX');
  assert.deepEqual(keyHits, ['$.a[0].b.correctAnswer (sleutel)', '$.d (tekstwaarde "CorrectAnswer: XX")']);
  assert.deepEqual(valueHits, ['$.a[0].b.correctAnswer.optionId', '$.c[0]']);
  assert.deepEqual(collectAnswerLeaks({ room: { code: '123456' } }, 'XX'), { keyHits: [], valueHits: [] });
});

test('Keten: room -> preview -> twee joins -> start -> 10 rondes flags_mc -> podium met tiebreak -> rematch met vraaguitsluiting -> kick', async () => {
  const { clock, context } = makeChainEnvironment();

  // ── Pijl 1: room aanmaken ────────────────────────────────────────────────
  const created = await createRoom(context, { hostParticipates: true, displayName: 'Hester' });
  assert.equal(created.ok, true, JSON.stringify(created));
  const host = created.value;
  assert.match(host.gameCode, /^[0-9]{6}$/);
  assert.deepEqual(host.roles, ['host', 'player']);
  assert.equal(host.effectiveName, 'Hester');
  assert.equal(host.joinUrl, `https://play.aseso.nl/j/${host.inviteId}`);
  assert.notEqual(host.playerId, null);

  // Quick-start default (besluit 35 + 13), niet aangenomen maar nagelezen.
  const roomConfig = (await context.store.loadRoom(host.roomId)).config;
  const QUICK_START = {
    gameTypes: ['flags_mc'], totalRounds: TOTAL_ROUNDS, difficulty: 'normal', mode: 'individual',
    pacing: 'auto', speedBonus: true, allowLateJoin: true, deadlineGraceMs: GRACE_MS,
    questionSeconds: QUESTION_MS / 1000,
  };
  for (const [field, expected] of Object.entries(QUICK_START)) {
    assert.deepEqual(roomConfig[field], expected, `quick-start default ${field}`);
  }

  // ── Pijl 3: preview vóór de join, zonder iets weg te schrijven ───────────
  const preview = await previewInvite(context, { inviteId: host.inviteId });
  assert.equal(preview.ok, true, JSON.stringify(preview));
  assert.equal(preview.value.roomId, host.roomId);
  assert.equal(preview.value.phase, 'LOBBY');
  assert.equal(preview.value.locked, false);
  assert.equal(preview.value.playerCount, 1);
  assert.ok(preview.value.suggestedName.length > 0);
  assert.equal((await context.store.listPlayers(host.roomId)).length, 1, 'preview schrijft niets weg');

  // ── Pijl 2: joins via beide locators ─────────────────────────────────────
  const joinedP2 = await joinRoom(context, { inviteId: host.inviteId, joinSource: 'qr', displayName: 'Bram' });
  assert.equal(joinedP2.ok, true, JSON.stringify(joinedP2));
  const p2 = joinedP2.value;
  assert.equal(p2.effectiveName, 'Bram');
  assert.equal(p2.joinSource, 'qr');
  assert.equal(p2.gameCode, host.gameCode);
  assert.deepEqual(p2.roles, ['player']);

  const joinedP3 = await joinRoom(context, { gameCode: host.gameCode, joinSource: 'code' });
  assert.equal(joinedP3.ok, true, JSON.stringify(joinedP3));
  const p3 = joinedP3.value;
  const p3Doc = await context.store.loadPlayer(host.roomId, p3.playerId);
  assert.equal(p3Doc.displayName, null);
  assert.equal(p3Doc.nameSource, 'generated');
  assert.equal(p3Doc.effectiveName, p3Doc.generatedName);
  assert.ok(p3Doc.effectiveName.length > 0);
  assert.notEqual(p3Doc.effectiveName, p2.effectiveName);

  // ── Pijl 4: sessies zijn resolvebaar met hun eigen token ─────────────────
  for (const who of [host, p2, p3]) {
    const resolved = await resolveSession(context, { roomId: host.roomId, sessionId: who.sessionId, sessionToken: who.sessionToken });
    assert.equal(resolved.ok, true, JSON.stringify(resolved));
    assert.equal(resolved.value.playerId, who.playerId);
    assert.equal(resolved.value.revoked, false);
  }
  const crossToken = await resolveSession(context, { roomId: host.roomId, sessionId: p2.sessionId, sessionToken: p3.sessionToken });
  assert.deepEqual(crossToken, { ok: false, code: 'TOKEN_INVALID' });

  const env = { context, clock, roomId: host.roomId, host, p2, p3, expected: { host: 0, p2: 0, p3: 0 }, usedQuestionKeys: [] };

  // ── Pijl 5: match starten ────────────────────────────────────────────────
  const started = await startMatch(context, { roomId: host.roomId });
  assert.equal(started.ok, true, JSON.stringify(started));
  assert.equal(started.value.phase, 'COUNTDOWN');
  assert.equal(started.value.sequence, 1);
  assert.equal(started.value.gameType, 'flags_mc');
  assert.equal(started.value.totalRounds, TOTAL_ROUNDS);
  assert.equal(started.value.playerCount, 3);
  assert.equal(started.value.countdownEndsAt, clock.now() + COUNTDOWN_MS);
  const firstMatchId = started.value.matchId;

  // ── Rondes 1..10 ─────────────────────────────────────────────────────────

  // Ronde 1 — speler 3 antwoordt fout.
  await playRound(env, 1, async ({ startsAt, roundId, wrongOptionId, matchId }) => {
    const wrong = await answerAt(env, 'p3', { at: startsAt + 4000, roundId, optionId: wrongOptionId, actionId: `${matchId}-r1-p3` });
    assert.equal(wrong.ok, true, JSON.stringify(wrong));
    assert.equal(wrong.value.correct, false);
    assert.equal(wrong.value.points, 0);
    assert.equal(wrong.value.score, 0);
  });

  // Ronde 2 — ASSERTIE B, dubbel antwoord.
  await playRound(env, 2, async ({ startsAt, roundId, correctOptionId, matchId, p2ActionId }) => {
    const scoreBefore = await storedScore(env, p2.playerId);
    assert.equal(scoreBefore, env.expected.p2);

    // Zelfde actionId opnieuw: identieke ack, geen tweede puntentoekenning.
    const replay = await answerAt(env, 'p2', { at: startsAt + 5000, roundId, optionId: correctOptionId, actionId: p2ActionId });
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.value.replay, true);
    assert.deepEqual(replay.value.ack, { roundId });
    assert.equal(replay.value.points, POINTS_FAST, 'de oorspronkelijke puntentoekenning, niet een nieuwe');
    assert.equal(replay.value.responseTimeMs, P2_OFFSET_MS);
    assert.equal(await storedScore(env, p2.playerId), scoreBefore);

    // Nieuwe actionId voor dezelfde ronde: sinds besluit 54 (6 aug 2026) een
    // correctie, geen afwijzing. Dezelfde optie, maar vier seconden later —
    // dus de snelheidsbonus is lager, en dát is precies de bedoeling: de
    // laatste tik telt, ook voor de tijd.
    // Bewust op DEZELFDE tel als de eerste inzending: dan zijn de punten
    // gelijk en blijft de gelijkspel-tiebreak verderop in deze keten intact.
    // Dát een latere tik minder oplevert wordt in match-lifecycle.test.mjs
    // getoetst; hier gaat het om de boekhouding.
    const second = await answerAt(env, 'p2', { at: startsAt + P2_OFFSET_MS, roundId, optionId: correctOptionId, actionId: `${matchId}-r2-p2-nieuw` });
    assert.equal(second.ok, true);
    // Dit is een doorlopende partij, dus `scoreBefore` draagt de punten van
    // eerdere rondes én die van de eerste tik in deze ronde. De correctie moet
    // precies die eerste tik terugdraaien en de nieuwe erbij zetten.
    assert.equal(
      await storedScore(env, p2.playerId),
      scoreBefore - POINTS_FAST + second.value.points,
      'de eerste tik eraf, de laatste erbij — niet opgeteld',
    );
  });

  // Ronde 3 — ASSERTIE B, te laat: ná endsAt + grace.
  await playRound(env, 3, async ({ endsAt, roundId, correctOptionId, matchId }) => {
    const scoreBefore = await storedScore(env, p3.playerId);
    const tooLate = await answerAt(env, 'p3', { at: endsAt + GRACE_MS + 1, roundId, optionId: correctOptionId, actionId: `${matchId}-r3-p3-telaat` });
    assert.deepEqual(tooLate, { ok: false, code: 'DEADLINE_PASSED' });
    assert.equal(await storedScore(env, p3.playerId), scoreBefore);
    assert.equal(await context.store.loadAnswer(host.roomId, matchId, roundId, p3.playerId), null);
  });

  // Ronde 4 — ASSERTIE C, reconnect midden in de ronde.
  await playRound(env, 4, async ({ roundId, correctOptionId, p2ActionId }) => {
    const scoreBefore = await storedScore(env, p2.playerId);

    const snapshot = await buildSnapshot(context, { roomId: host.roomId, sessionId: p2.sessionId });
    assert.equal(snapshot.ok, true, JSON.stringify(snapshot));
    assert.equal(snapshot.value.room.phase, 'ROUND_ACTIVE');
    assert.equal(snapshot.value.currentRound.roundId, roundId);
    assert.equal(snapshot.value.self.playerId, p2.playerId);
    assert.equal(snapshot.value.self.answeredCurrentRound, true, 'het geaccepteerde antwoord is zichtbaar na reconnect');
    assert.equal(snapshot.value.self.score, scoreBefore);
    assert.equal(snapshot.value.self.eligibleFromRound, 1);
    assert.equal(snapshot.value.scoreboard.self.score, scoreBefore);
    assert.equal(snapshot.value.room.matchSequence, 1);

    // De reconnect zelf telt niets dubbel, ook niet als de client zijn
    // onbevestigde inzending herhaalt (PROTOCOL.md §Reconnect stap 7).
    const retry = await answerAt(env, 'p2', { at: clock.now(), roundId, optionId: correctOptionId, actionId: p2ActionId });
    assert.equal(retry.value.replay, true);
    assert.deepEqual(retry.value.ack, { roundId });
    assert.equal(await storedScore(env, p2.playerId), scoreBefore, 'reconnect telt niets dubbel');
  });

  // Ronde 5 — ASSERTIE B, binnen de grace van 250 ms: geaccepteerd, correct,
  // maar zonder tijdbonus (besluit 13).
  await playRound(env, 5, async ({ endsAt, roundId, correctOptionId, matchId }) => {
    const inGrace = await answerAt(env, 'p3', { at: endsAt + 200, roundId, optionId: correctOptionId, actionId: `${matchId}-r5-p3-grace` });
    assert.equal(inGrace.ok, true, JSON.stringify(inGrace));
    assert.equal(inGrace.value.correct, true, 'binnen grace kan een antwoord correct zijn');
    assert.equal(inGrace.value.points, POINTS_NO_BONUS, 'maar krijgt nooit tijdbonus');
    assert.equal(inGrace.value.responseTimeMs, QUESTION_MS + 200);
    // Het puntenVERSCHIL met een even correct antwoord binnen de tijd, niet
    // alleen de acceptatie.
    assert.equal(POINTS_FAST - inGrace.value.points, 87);
    env.expected.p3 += POINTS_NO_BONUS;
    assert.equal(await storedScore(env, p3.playerId), env.expected.p3);
  });

  // Ronde 6 — ASSERTIE D, pauzeren en hervatten midden in de ronde.
  await playRound(env, 6, async ({ startsAt, endsAt, roundId, wrongOptionId, matchId }) => {
    clock.set(startsAt + 3000);
    const paused = await advancePhase(context, { roomId: host.roomId, event: { type: 'HOST_PAUSE' } });
    assert.equal(paused.ok, true, JSON.stringify(paused));
    assert.equal(paused.value.phase, 'PAUSED');
    // Besluit 10: de volledige, bevestigde pausedState-vorm.
    assert.deepEqual(paused.value.pausedState, {
      previousPhase: 'ROUND_ACTIVE', remainingMs: endsAt - (startsAt + 3000), reason: 'host', pausedAt: startsAt + 3000,
    });
    assert.deepEqual(Object.keys(paused.value.pausedState).sort(), ['pausedAt', 'previousPhase', 'reason', 'remainingMs']);

    // Snapshot en live-event delen dezelfde vorm (besluit 10).
    const pausedSnapshot = await buildSnapshot(context, { roomId: host.roomId, sessionId: host.sessionId });
    assert.deepEqual(pausedSnapshot.value.room.pausedState, paused.value.pausedState);
    assert.equal(pausedSnapshot.value.room.phase, 'PAUSED');

    const resumed = await advancePhase(context, { roomId: host.roomId, event: { type: 'HOST_RESUME' } });
    assert.equal(resumed.ok, true, JSON.stringify(resumed));
    assert.equal(resumed.value.phase, 'ROUND_ACTIVE');
    assert.equal(resumed.value.previousPhase, 'PAUSED');
    assert.equal(resumed.value.pausedState, null);
    assert.equal(resumed.value.roundNumber, 6, 'hervatten slaat geen ronde over');

    const afterResume = await answerAt(env, 'p3', { at: startsAt + 7000, roundId, optionId: wrongOptionId, actionId: `${matchId}-r6-p3` });
    assert.equal(afterResume.ok, true, JSON.stringify(afterResume));
    assert.equal(afterResume.value.correct, false);
    assert.equal(await storedScore(env, p3.playerId), env.expected.p3);
  });

  // Rondes 7..10 — alleen host en speler 2.
  for (let roundNumber = 7; roundNumber <= TOTAL_ROUNDS; roundNumber += 1) {
    await playRound(env, roundNumber);
  }

  // Geen enkele vraag is binnen de match herhaald (pijl 6).
  assert.equal(env.usedQuestionKeys.length, TOTAL_ROUNDS);
  assert.equal(new Set(env.usedQuestionKeys).size, TOTAL_ROUNDS);
  assert.ok(env.usedQuestionKeys.every((key) => key.startsWith('flags:')));
  const firstMatchQuestionKeys = [...env.usedQuestionKeys];

  // ── Pijl 9/10: eindpodium met tiebreak ───────────────────────────────────
  const finished = await finishMatch(context, { roomId: host.roomId });
  assert.equal(finished.ok, true, JSON.stringify(finished));
  assert.equal(finished.value.phase, 'FINISHED');
  assert.equal(finished.value.matchId, firstMatchId);
  assert.equal(finished.value.standings.length, 3);

  const [first, second, third] = finished.value.standings;
  assert.equal(first.playerId, host.playerId);
  assert.equal(second.playerId, p2.playerId);
  assert.equal(third.playerId, p3.playerId);
  assert.deepEqual([first.position, second.position, third.position], [1, 2, 3]);

  // De tiebreak zelf: gelijke score én gelijk aantal goede antwoorden; alleen
  // de totale responstijd van de goede antwoorden scheidt 1 van 2.
  assert.equal(first.score, POINTS_FAST * TOTAL_ROUNDS);
  assert.equal(second.score, first.score, 'gelijkspel op score');
  assert.equal(first.correctCount, TOTAL_ROUNDS);
  assert.equal(second.correctCount, first.correctCount, 'gelijkspel op aantal goed');
  assert.equal(first.correctResponseTimeMsTotal, HOST_OFFSET_MS * TOTAL_ROUNDS);
  assert.equal(second.correctResponseTimeMsTotal, P2_OFFSET_MS * TOTAL_ROUNDS);
  assert.ok(first.correctResponseTimeMsTotal < second.correctResponseTimeMsTotal, 'de responstijd beslist');
  assert.equal(third.score, POINTS_NO_BONUS);
  assert.equal(third.correctCount, 1);
  assert.deepEqual(finished.value.podium.map((entry) => entry.playerId), [host.playerId, p2.playerId, p3.playerId]);

  // ── Pijl 10: rematch ─────────────────────────────────────────────────────
  const rematched = await rematch(context, { roomId: host.roomId });
  assert.equal(rematched.ok, true, JSON.stringify(rematched));
  assert.equal(rematched.value.phase, 'LOBBY');
  assert.equal(rematched.value.sequence, 2);
  assert.equal(rematched.value.previousMatchId, firstMatchId);
  assert.notEqual(rematched.value.matchId, firstMatchId);
  assert.deepEqual([...rematched.value.previousMatchQuestionKeys].sort(), [...firstMatchQuestionKeys].sort());
  assert.deepEqual([...rematched.value.resetPlayerIds].sort(), [host.playerId, p2.playerId, p3.playerId].sort());

  // Zelfde room, zelfde code, zelfde inviteId (GAME-FLOW.md §12).
  const share = await getShareInfo(context, { roomId: host.roomId });
  assert.deepEqual(share.value, { roomId: host.roomId, gameCode: host.gameCode, inviteId: host.inviteId, joinUrl: host.joinUrl });

  // Scores op nul.
  for (const playerId of [host.playerId, p2.playerId, p3.playerId]) {
    const { score, correctCount, correctResponseTimeMsTotal } = await context.store.loadPlayer(host.roomId, playerId);
    assert.deepEqual({ score, correctCount, correctResponseTimeMsTotal }, { score: 0, correctCount: 0, correctResponseTimeMsTotal: 0 });
  }

  const startedAgain = await startMatch(context, { roomId: host.roomId });
  assert.equal(startedAgain.ok, true, JSON.stringify(startedAgain));
  assert.equal(startedAgain.value.matchId, rematched.value.matchId);
  assert.equal(startedAgain.value.sequence, 2);

  env.expected = { host: 0, p2: 0, p3: 0 };
  env.usedQuestionKeys = [];
  for (let roundNumber = 1; roundNumber <= 2; roundNumber += 1) {
    await playRound(env, roundNumber);
  }

  // ── ASSERTIE D: kick midden in de rematch ────────────────────────────────
  await playRound(env, 3, async ({ roundId, wrongOptionId, matchId }) => {
    const before = await answerAt(env, 'p3', { at: clock.now(), roundId, optionId: wrongOptionId, actionId: `${matchId}-r3-p3-voor-kick` });
    assert.equal(before.ok, true, JSON.stringify(before), 'de sessie werkt nog vóór de kick');

    const kicked = await kickPlayer(context, { roomId: host.roomId, playerId: p3.playerId });
    assert.equal(kicked.ok, true, JSON.stringify(kicked));
    assert.equal(kicked.value.revoked, true);
    assert.equal(kicked.value.sessionId, p3.sessionId);

    // De sessie is daarna geblokkeerd.
    const afterKick = await resolveSession(context, { roomId: host.roomId, sessionId: p3.sessionId, sessionToken: p3.sessionToken });
    assert.deepEqual(afterKick, { ok: false, code: 'SESSION_REVOKED' });

    const blocked = await answerAt(env, 'p3', { at: clock.now(), roundId, optionId: wrongOptionId, actionId: `${matchId}-r3-p3-na-kick` });
    assert.deepEqual(blocked, { ok: false, code: 'SESSION_REVOKED' });

    const snapshot = await buildSnapshot(context, { roomId: host.roomId, sessionId: host.sessionId });
    assert.equal(snapshot.value.room.playerCount, 2, 'de gekickte speler telt niet meer mee');
  });

  // De vragen van de tweede match vermijden die van de eerste (GAME-FLOW.md §12).
  assert.equal(env.usedQuestionKeys.length, 3);
  assert.equal(new Set([...env.usedQuestionKeys, ...firstMatchQuestionKeys]).size, TOTAL_ROUNDS + 3);

  // Een gekickte speler valt uit de eindstand (GAME-FLOW.md §11).
  const finishedAgain = await finishMatch(context, { roomId: host.roomId });
  assert.equal(finishedAgain.ok, true, JSON.stringify(finishedAgain));
  assert.equal(finishedAgain.value.phase, 'FINISHED');
  assert.equal(finishedAgain.value.matchId, rematched.value.matchId);
  assert.deepEqual(finishedAgain.value.standings.map((entry) => entry.playerId), [host.playerId, p2.playerId]);
  assert.equal(finishedAgain.value.standings[0].score, POINTS_FAST * 3);
});

// ── Assertie E: HANDOFF INT-14 vastgepind ───────────────────────────────────

// INT-14 (docs/integration-plan/HANDOFF.md, ernst hoog, open bij DM).
// `PROTOCOL.md` §Idempotentie belooft "zelfde actionId: zelfde ack" en §Reconnect
// stap 7 beschrijft het geval dat die belofte nodig maakt: een client die géén ack
// ontving herhaalt dezelfde actionId, en na een reconnect komt die herhaling
// regelmatig ná `endsAt + grace` binnen. De poort dekt die tak niet —
// `resolveAnswer()` wijst af op de deadline vóórdat `saveAcceptedAnswerAtomically`
// (de enige plek die de replay kent) bereikt wordt.
// Deze test legt het HUIDIGE gedrag vast, bewust zonder omweg. **Zodra de poort een
// replay-signaal levert (voorstel: `{ replay: boolean }`) MOET de assertie hieronder
// worden OMGEDRAAID** naar `{ ok: true, value.replay === true, ack === { roundId } }`.
test('INT-14 (open bij DM, moet worden omgedraaid): een replay met dezelfde actionId ná endsAt + grace krijgt DEADLINE_PASSED in plaats van de gecachete ack', async () => {
  const { clock, context } = makeChainEnvironment();

  const created = await createRoom(context, { hostParticipates: true, displayName: 'Hester' });
  const host = created.value;
  await startMatch(context, { roomId: host.roomId });
  clock.advance(COUNTDOWN_MS);
  const started = await startRound(context, { roomId: host.roomId });
  assert.equal(started.ok, true, JSON.stringify(started));

  const { matchId, roundId, startsAt, endsAt } = started.value;
  const roundDoc = await context.store.loadRound(host.roomId, matchId, roundId);
  const actionId = 'act_int14_replay';

  clock.set(startsAt + 1000);
  const submission = { roomId: host.roomId, playerId: host.playerId, roundId, answer: { optionId: roundDoc.correctAnswer.optionId }, actionId };
  const accepted = await submitAnswer(context, submission);
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  assert.deepEqual(accepted.value.ack, { roundId });
  assert.equal(accepted.value.correct, true);
  const scoreAfterAccept = (await context.store.loadPlayer(host.roomId, host.playerId)).score;

  // De poort heeft de ack gecachet — hij is er dus wel degelijk.
  const cached = await context.store.loadActionCacheEntry(host.roomId, actionId);
  assert.deepEqual(cached.ack, { roundId }, 'de gecachete ack die de replay hoort terug te krijgen');

  // Exact dezelfde inzending, ruim ná endsAt + grace (het reconnectgeval).
  clock.set(endsAt + GRACE_MS + 5000);
  const replayAfterDeadline = await submitAnswer(context, submission);

  // HUIDIG GEDRAG — in strijd met PROTOCOL.md §Idempotentie. Draai dit om zodra
  // INT-14 is opgelost.
  assert.deepEqual(replayAfterDeadline, { ok: false, code: 'DEADLINE_PASSED' }, 'INT-14: verwacht (nog) een afwijzing');

  // Wat wél klopt: er is niets dubbel geteld en het antwoord staat er nog.
  assert.equal((await context.store.loadPlayer(host.roomId, host.playerId)).score, scoreAfterAccept);
  assert.notEqual(await context.store.loadAnswer(host.roomId, matchId, roundId, host.playerId), null);
});
