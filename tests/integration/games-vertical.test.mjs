// tests/integration/games-vertical.test.mjs
//
// STAP 6 + BESLUIT C-2 uit docs/PLAN-CONVERGENTIE.md — de verticale oplevering
// van elke game na de eerste. Niet "de contentbron kan het" en niet "het spelscherm kan het", maar de
// hele keten in één doorloop:
//
//   lobbykeuze -> configuratie -> snapshot -> vraag -> antwoord -> reveal
//   -> scorebord -> rematch -> reconnect
//
// Pas als dit groen is, mag "Echt of nep" live. Dat is de les van 4 aug: toen
// stond hij in de carrousel terwijl de contentbron hem niet kon bouwen, en de
// suite bleef groen omdat niemand de keten als geheel doorliep.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoom, joinRoom, updateConfig } from '../../server/composition/room-lifecycle.mjs';
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
import { isPlayableGameType } from '../../shared/content/game-catalog.mjs';
import { CONTENT_VERSION, RENDERER_VERSION, makeClock, makeContext } from './support/composition-harness.mjs';

const GAME_TYPE = 'real_or_fake_flag';

test('Echt of nep is speelbaar volgens de gedeelde catalogus', () => {
  assert.equal(isPlayableGameType(GAME_TYPE), true);
});

test('Verticaal: lobbykeuze -> config -> snapshot -> vraag -> antwoord -> reveal -> scorebord -> rematch -> reconnect', async () => {
  const clock = makeClock();
  const context = makeContext({
    now: clock.now,
    config: { contentVersion: CONTENT_VERSION, rendererVersion: RENDERER_VERSION },
  });

  const totalRounds = 3;
  const room = (await createRoom(context, {
    hostParticipates: true,
    displayName: 'Host',
    config: { totalRounds },
  })).value;
  const speler = (await joinRoom(context, {
    gameCode: room.gameCode, joinSource: 'code', displayName: 'Speler',
  })).value;

  // ── 1. Lobbykeuze: de host draait de carrousel naar Echt of nep ──────────
  const gewijzigd = await updateConfig(context, {
    roomId: room.roomId,
    patch: { gameTypes: [GAME_TYPE] },
  });
  assert.equal(gewijzigd.ok, true, JSON.stringify(gewijzigd));
  assert.deepEqual(gewijzigd.value.config.gameTypes, [GAME_TYPE], 'de canonieke config draagt exact één waarde');

  // ── 2. Snapshot in de lobby bevestigt dezelfde keuze ────────────────────
  const lobbySnapshot = await buildSnapshot(context, { roomId: room.roomId, sessionId: room.sessionId });
  assert.equal(lobbySnapshot.ok, true, JSON.stringify(lobbySnapshot));
  assert.deepEqual(lobbySnapshot.value.room.config.gameTypes, [GAME_TYPE]);

  const gezieneSoorten = new Set();
  const gezieneVraagsleutels = new Set();

  const startAck = await startMatch(context, { roomId: room.roomId });
  assert.equal(startAck.ok, true, JSON.stringify(startAck));
  const eersteMatchId = startAck.value.matchId;

  const roomConfig = (await context.store.loadRoom(room.roomId)).config;

  for (let rondeNummer = 1; rondeNummer <= totalRounds; rondeNummer += 1) {
    clock.advance(3000);

    // ── 3. De vraag ───────────────────────────────────────────────────────
    const gestart = await startRound(context, { roomId: room.roomId });
    assert.equal(gestart.ok, true, JSON.stringify(gestart));
    assert.equal(gestart.value.gameType, GAME_TYPE);
    assert.equal('correctAnswer' in gestart.value, false, 'besluit 20: nooit het antwoord in round:started');

    const vraag = gestart.value.question;
    assert.ok(vraag.kind === 'real' || vraag.kind === 'generated', `onbekende vraagsoort: ${vraag.kind}`);
    gezieneSoorten.add(vraag.kind);
    if (vraag.kind === 'real') {
      assert.equal(typeof vraag.iso2, 'string');
    } else {
      assert.equal(typeof vraag.seed, 'string');
      assert.ok(vraag.spec !== null && typeof vraag.spec === 'object', 'de client moet de nepvlag kunnen tekenen');
      assert.equal(typeof vraag.rendererVersion, 'string');
    }

    // ── 4. Snapshot midden in de ronde: wel de vraag, nooit het antwoord ──
    const rondeSnapshot = await buildSnapshot(context, { roomId: room.roomId, sessionId: speler.sessionId });
    assert.equal(rondeSnapshot.ok, true, JSON.stringify(rondeSnapshot));
    assert.equal(rondeSnapshot.value.currentRound.gameType, GAME_TYPE);
    assert.equal(
      JSON.stringify(rondeSnapshot.value).includes('correctAnswer'),
      false,
      'een snapshot van een actieve ronde lekt nooit het antwoord',
    );

    const rondeDoc = await context.store.loadRound(room.roomId, eersteMatchId, gestart.value.roundId);
    assert.ok(!gezieneVraagsleutels.has(rondeDoc.questionKey), 'geen herhaalde vraag binnen een match');
    gezieneVraagsleutels.add(rondeDoc.questionKey);
    // Echt-of-nep kent geen optielijst; die eis geldt alleen voor meerkeuze.
    assert.equal(rondeDoc.validOptionIds, undefined);

    // ── 5. Het antwoord — { choice }, niet { optionId } ───────────────────
    clock.advance(1000);
    const fout = await submitAnswer(context, {
      roomId: room.roomId,
      playerId: speler.playerId,
      roundId: gestart.value.roundId,
      answer: { optionId: 'nl' },
      actionId: `act_vorm_${rondeNummer}`,
    });
    assert.equal(fout.ok, false, 'een meerkeuze-antwoord hoort hier vormfout te zijn');

    const goedeKeuze = rondeDoc.correctAnswer.choice;
    const ack = await submitAnswer(context, {
      roomId: room.roomId,
      playerId: speler.playerId,
      roundId: gestart.value.roundId,
      answer: { choice: goedeKeuze },
      actionId: `act_r${rondeNummer}`,
    });
    assert.equal(ack.ok, true, JSON.stringify(ack));

    // ── 6. De reveal ─────────────────────────────────────────────────────
    clock.set(gestart.value.endsAt);
    const geeindigd = await endRound(context, { roomId: room.roomId });
    assert.equal(geeindigd.ok, true, JSON.stringify(geeindigd));
    assert.deepEqual(geeindigd.value.correctAnswer, { choice: goedeKeuze });
    assert.ok(Array.isArray(geeindigd.value.distribution), 'de verdeling voedt "N van M zaten goed"');
    const eigen = geeindigd.value.results.find((entry) => entry.playerId === speler.playerId);
    assert.equal(eigen.correct, true, 'wie het goede antwoord gaf, hoort goed te zijn');
    assert.ok(eigen.points > 0);

    // ── 7. Het scorebord ─────────────────────────────────────────────────
    clock.advance(roomConfig.resultSeconds * 1000);
    const naResultaat = await advancePhase(context, { roomId: room.roomId, event: { type: 'TIMER_ELAPSED' } });
    assert.equal(naResultaat.ok, true, JSON.stringify(naResultaat));
    if (naResultaat.value.phase === 'SCOREBOARD') {
      const scorebord = await getScoreboard(context, { roomId: room.roomId });
      assert.equal(scorebord.ok, true, JSON.stringify(scorebord));
      const eigenRij = scorebord.value.top.find((entry) => entry.playerId === speler.playerId);
      assert.ok(eigenRij.score > 0);
      assert.equal(typeof eigenRij.rank, 'number');
      clock.advance(roomConfig.scoreboardSeconds * 1000);
      await advancePhase(context, { roomId: room.roomId, event: { type: 'TIMER_ELAPSED' } });
    }
  }

  assert.deepEqual(
    [...gezieneSoorten].sort(),
    ['generated', 'real'],
    'over drie rondes horen beide vraagsoorten voor te komen — anders test dit maar de helft van de game',
  );

  // ── 8. Eindstand ────────────────────────────────────────────────────────
  const eindstand = await finishMatch(context, { roomId: room.roomId });
  assert.equal(eindstand.ok, true, JSON.stringify(eindstand));
  assert.equal(eindstand.value.standings.length, 2);
  const eigenEind = eindstand.value.standings.find((entry) => entry.playerId === speler.playerId);
  assert.equal(eigenEind.position, 1, 'de speler die alles goed had staat bovenaan');

  // ── 9. Rematch: zelfde room, zelfde gameType, geen herhaalde vragen ─────
  const revanche = await rematch(context, { roomId: room.roomId });
  assert.equal(revanche.ok, true, JSON.stringify(revanche));
  const tweedeMatchId = revanche.value.matchId;

  const opnieuw = await startMatch(context, { roomId: room.roomId });
  assert.equal(opnieuw.ok, true, JSON.stringify(opnieuw));
  clock.advance(3000);
  const revancheRonde = await startRound(context, { roomId: room.roomId });
  assert.equal(revancheRonde.ok, true, JSON.stringify(revancheRonde));
  assert.equal(revancheRonde.value.gameType, GAME_TYPE, 'de gameType overleeft de rematch');
  const revancheDoc = await context.store.loadRound(room.roomId, tweedeMatchId, revancheRonde.value.roundId);
  assert.ok(
    !gezieneVraagsleutels.has(revancheDoc.questionKey),
    'de vraaguitsluiting van de vorige match geldt ook na een rematch',
  );

  // ── 10. Reconnect middenin de revanche ─────────────────────────────────
  const naReconnect = await buildSnapshot(context, { roomId: room.roomId, sessionId: speler.sessionId });
  assert.equal(naReconnect.ok, true, JSON.stringify(naReconnect));
  assert.deepEqual(naReconnect.value.room.config.gameTypes, [GAME_TYPE], 'de config staat er nog na een rematch');
  assert.equal(naReconnect.value.currentRound.gameType, GAME_TYPE);
  assert.equal(naReconnect.value.currentRound.roundId, revancheRonde.value.roundId);
  assert.equal(
    JSON.stringify(naReconnect.value).includes('correctAnswer'),
    false,
    'ook de reconnect-snapshot lekt het antwoord niet',
  );
});

test('Een lopende match houdt zijn gameType, ook als de room-config daarna wijzigt', async () => {
  const clock = makeClock();
  const context = makeContext({
    now: clock.now,
    config: { contentVersion: CONTENT_VERSION, rendererVersion: RENDERER_VERSION },
  });

  const room = (await createRoom(context, {
    hostParticipates: true, displayName: 'Host', config: { totalRounds: 2, gameTypes: [GAME_TYPE] },
  })).value;
  await joinRoom(context, { gameCode: room.gameCode, joinSource: 'code', displayName: 'Speler' });

  await startMatch(context, { roomId: room.roomId });
  clock.advance(3000);
  const gestart = await startRound(context, { roomId: room.roomId });
  assert.equal(gestart.value.gameType, GAME_TYPE);

  // Buiten LOBBY mag de config niet meer wijzigen — de gepinde gameType van
  // deze match kan dus nooit halverwege omslaan.
  const geweigerd = await updateConfig(context, { roomId: room.roomId, patch: { gameTypes: ['flags_mc'] } });
  assert.equal(geweigerd.ok, false);
  assert.equal(geweigerd.code, 'INVALID_PHASE');

  const match = await context.store.loadMatch(room.roomId, gestart.value.matchId);
  assert.equal(match.gameType, GAME_TYPE);
});

// ─────────────────────────────────────────────────────────────────────────────
// Besluit C-2 (5 aug 2026): "Welke hoort er niet bij" is de derde game uit
// doelbeeld v2. Zelfde eis als bij Echt of nep — de hele keten, niet alleen
// de vraagselectie.
// ─────────────────────────────────────────────────────────────────────────────

test('Verticaal odd_one_out: vier kaarten, één antwoord per kaartindex, uitlegregel in de reveal', async () => {
  const clock = makeClock();
  const context = makeContext({
    now: clock.now,
    config: { contentVersion: CONTENT_VERSION, rendererVersion: RENDERER_VERSION },
  });

  const room = (await createRoom(context, {
    hostParticipates: true, displayName: 'Host', config: { totalRounds: 2 },
  })).value;
  const speler = (await joinRoom(context, {
    gameCode: room.gameCode, joinSource: 'code', displayName: 'Speler',
  })).value;

  const gewijzigd = await updateConfig(context, { roomId: room.roomId, patch: { gameTypes: ['odd_one_out'] } });
  assert.equal(gewijzigd.ok, true, JSON.stringify(gewijzigd));

  await startMatch(context, { roomId: room.roomId });
  clock.advance(3000);
  const gestart = await startRound(context, { roomId: room.roomId });
  assert.equal(gestart.ok, true, JSON.stringify(gestart));
  assert.equal(gestart.value.gameType, 'odd_one_out');

  // De vraag: vier kaarten met een eigen index, geen antwoord erin.
  const kaarten = gestart.value.question.cards;
  assert.equal(kaarten.length, 4);
  assert.deepEqual(kaarten.map((kaart) => kaart.cardIndex), [0, 1, 2, 3]);
  for (const kaart of kaarten) {
    assert.equal(typeof kaart.iso2, 'string');
  }
  assert.equal('correctAnswer' in gestart.value, false);
  assert.equal(
    JSON.stringify(gestart.value).includes('majorityContinent'),
    false,
    'de afwijklogica mag niet vóór het antwoord zichtbaar zijn — dat verklapt het antwoord',
  );

  const rondeDoc = await context.store.loadRound(room.roomId, gestart.value.matchId, gestart.value.roundId);
  assert.equal(typeof rondeDoc.resultDetails.majorityContinent, 'string');
  assert.equal(typeof rondeDoc.resultDetails.minorityContinent, 'string');
  assert.notEqual(rondeDoc.resultDetails.majorityContinent, rondeDoc.resultDetails.minorityContinent);

  // Antwoorden gaat per kaartindex, niet per iso2.
  clock.advance(1000);
  const vormfout = await submitAnswer(context, {
    roomId: room.roomId, playerId: speler.playerId, roundId: gestart.value.roundId,
    answer: { optionId: kaarten[0].iso2 }, actionId: 'odd_vorm',
  });
  assert.equal(vormfout.ok, false, 'een meerkeuze-antwoord hoort hier vormfout te zijn');

  const goed = await submitAnswer(context, {
    roomId: room.roomId, playerId: speler.playerId, roundId: gestart.value.roundId,
    answer: { cardIndex: rondeDoc.correctAnswer.cardIndex }, actionId: 'odd_goed',
  });
  assert.equal(goed.ok, true, JSON.stringify(goed));

  clock.set(gestart.value.endsAt);
  const geeindigd = await endRound(context, { roomId: room.roomId });
  assert.equal(geeindigd.ok, true, JSON.stringify(geeindigd));

  // De uitlegregel van doelbeeld v2 §1 heeft deze twee velden nodig — ze gaan
  // pas nú over de lijn, samen met het juiste antwoord.
  assert.deepEqual(geeindigd.value.resultDetails, rondeDoc.resultDetails);
  assert.equal(geeindigd.value.correctAnswer.cardIndex, rondeDoc.correctAnswer.cardIndex);
  assert.equal(
    geeindigd.value.distribution.length,
    4,
    'de verdeling telt per kaart, zodat scherm 5 "N van M zaten goed" kan tonen',
  );
  const eigen = geeindigd.value.results.find((entry) => entry.playerId === speler.playerId);
  assert.equal(eigen.correct, true);
});
