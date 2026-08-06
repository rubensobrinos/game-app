// server/composition/match/verloop.mjs
//
// De levensloop van een match als geheel: starten, afsluiten, en opnieuw.
//
// Deze drie horen bij elkaar omdat ze alle drie een MATCH-document aanmaken of
// afsluiten — de rondes ertussenin staan in `rondes.mjs`, de fasewissels in
// `fases.mjs`. `rematch()` is de enige van de drie die bewust BUITEN de state
// machine om gaat; de reden staat bij die functie.

import { EVENT_TYPES, PHASES } from '../../architecture/state-machine.js';
import { assertMatchShape } from '../../data/types/match.js';
import { assertPlayerShape } from '../../data/types/player.js';
import { rankPlayers } from '../../../shared/rules/ranking.mjs';
import { createId } from '../context.mjs';
import { touchRoom } from '../room-lifecycle.mjs';
import { COUNTDOWN_SECONDS } from './fases.mjs';
import {
  activePlayers,
  applyTransition,
  CODES,
  contentSourceFor,
  fail,
  loadRoomAndMatch,
  matchGameType,
  phaseConflict,
  rankablePlayers,
  succeed,
} from './gedeeld.mjs';

/**
 * Start de match vanuit LOBBY (`game:start`).
 *
 * Maakt een Match met een GEPINDE `contentVersion`/`rendererVersion`
 * (besluit 21) en één `gameType` (besluit 32), en zet daarna de fase via de
 * state machine + `setRoomAndMatchPhaseAtomically` (besluit 30).
 *
 * Staat er al een match in fase LOBBY (het normale gevolg van `rematch()`,
 * GAME-FLOW.md §12 "aanwezige spelers blijven in de lobby"), dan wordt DIE
 * gestart in plaats van een tweede match aan te maken.
 *
 * KEUZE — PROTOCOL.md eist "minimaal één speler" maar kent daar geen foutcode
 * voor. `INVALID_PHASE` is de dichtstbijzijnde gepubliceerde code: de game kan
 * in deze toestand niet starten. Zie het handoff-item.
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function startMatch(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId, { requireMatch: false });
  if (!loaded.ok) {
    return loaded;
  }
  let { room } = loaded.value;
  let match = loaded.value.match;

  if (match !== null && match.phase !== PHASES.LOBBY) {
    return fail(CODES.GAME_ALREADY_STARTED);
  }
  if (room.phase !== PHASES.LOBBY) {
    return fail(CODES.GAME_ALREADY_STARTED);
  }

  const players = activePlayers(await context.store.listPlayers(roomId));
  if (players.length === 0) {
    return fail(CODES.INVALID_PHASE);
  }

  const now = context.now();
  if (match === null) {
    const source = contentSourceFor(context, room);
    match = {
      id: createId(context, 'match'),
      roomId,
      sequence: 1,
      phase: PHASES.LOBBY,
      startedAt: now,
      finishedAt: null,
      roundIndex: 0,
      roundIds: [],
      usedQuestionKeys: [],
      previousMatchQuestionKeys: [],
      pausedState: null,
      // Besluit 21: canoniek en onveranderlijk op Match.
      contentVersion: source.contentVersion,
      rendererVersion: source.rendererVersion,
      // ADDITIEF t.o.v. DATA-MODEL.md's Match-voorbeeld en assertMatchShape:
      // besluit 32 ("één gameType per match") heeft anders geen vaste plek en
      // zou elke ronde opnieuw uit room.config moeten worden afgeleid — dan is
      // hij niet gepind. Zie het handoff-item.
      gameType: room.config.gameTypes[0],
    };
    assertMatchShape(match);
    await context.store.saveMatch(match);
    // `room` hierna bijwerken: `applyTransition` hieronder doet zelf ook een
    // `touchRoom`-aanroep (fase 3) en zou anders, met de nog-oude `room` in
    // scope, het net gezette `currentMatchId` weer overschrijven.
    room = await touchRoom(context, room, now, { currentMatchId: match.id });
  } else {
    room = await touchRoom(context, room, now);
  }

  const started = await applyTransition(context, {
    room,
    match,
    event: { type: EVENT_TYPES.HOST_START, nextPhase: PHASES.COUNTDOWN },
  });
  if (!started.ok) {
    return started;
  }

  return succeed({
    matchId: started.value.match.id,
    sequence: started.value.match.sequence,
    phase: started.value.match.phase,
    gameType: matchGameType(room, started.value.match),
    totalRounds: room.config.totalRounds,
    contentVersion: started.value.match.contentVersion,
    rendererVersion: started.value.match.rendererVersion,
    countdownEndsAt: now + COUNTDOWN_SECONDS * 1000,
    playerCount: players.length,
  });
}

/**
 * De eindstand (`game:finished`), met de tiebreak-volgorde uit
 * server/rules/standings.js (score → correctCount → laagste totale
 * responstijd → gedeelde positie).
 *
 * Is de match nog niet FINISHED, dan zet deze functie hem er via HOST_FINISH
 * heen. Is hij dat al (auto-tempo loopt vanzelf naar FINISHED), dan levert hij
 * alleen de eindstand — HOST_FINISH vanuit FINISHED is per state machine
 * ongeldig en dat is hier geen fout.
 *
 * Gekickte spelers vallen af; vrijwillig vertrokken spelers blijven in de
 * eindstand staan met hun behaalde punten (GAME-FLOW.md §11).
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function finishMatch(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;

  let current = match;
  if (match.phase !== PHASES.FINISHED) {
    const applied = await applyTransition(context, {
      room,
      match,
      event: { type: EVENT_TYPES.HOST_FINISH },
    });
    if (!applied.ok) {
      return applied;
    }
    current = applied.value.match;
  }

  const players = rankablePlayers(await context.store.listPlayers(roomId));
  const byId = new Map(players.map((player) => [player.id, player]));
  const ranked = rankPlayers(players.map((player) => ({
    id: player.id,
    score: player.score,
    correctCount: player.correctCount,
    correctResponseTimeMsTotal: player.correctResponseTimeMsTotal,
  })));

  const standings = ranked.map((entry) => {
    const player = byId.get(entry.id);
    return {
      playerId: entry.id,
      effectiveName: player.effectiveName,
      // docs/openstaand/spelersidentiteit.md, stap 4/5: dit landt via
      // `podium` (hieronder, `standings.filter(...)`) en `personal.self`
      // (fasepomp.mjs) daadwerkelijk over de lijn — het podium is een van de
      // vier plekken die het bouwplan expliciet noemt. `?? null` dekt stap 6.
      identity: player.identity ?? null,
      score: entry.score,
      correctCount: entry.correctCount,
      correctResponseTimeMsTotal: entry.correctResponseTimeMsTotal,
      position: entry.position,
      // GAME-RULES.md §Late join: "in de eindstand desgewenst gemarkeerd met
      // vanaf ronde {n}".
      eligibleFromRound: player.eligibleFromRound,
      left: player.left === true,
    };
  });

  return succeed({
    matchId: current.id,
    sequence: current.sequence,
    phase: current.phase,
    finishedAt: current.finishedAt,
    standings,
    podium: standings.filter((entry) => entry.position <= 3),
  });
}

/**
 * Rematch (`game:rematch`): zelfde room, code en inviteId; nieuwe `matchId`;
 * scores en streaks naar nul; instellingen blijven; vragen uit de direct
 * vorige match worden vermeden (GAME-FLOW.md §12).
 *
 * De nieuwe match begint in LOBBY — "aanwezige spelers blijven in de lobby" —
 * en wordt daarna met `startMatch()` gestart. Dat is bewust GEEN
 * `transition()`-aanroep: de state machine modelleert de levensloop van ÉÉN
 * match en kent geen uitgang uit FINISHED. Een rematch is een nieuwe machine
 * in zijn begintoestand; `Room.phase` volgt als projectie de nieuwe
 * autoritaire `Match.phase` en gaat in dezelfde atomaire operatie mee
 * (besluit 30).
 *
 * Besluit 5: een speler met `left: true` telt niet automatisch mee en wordt
 * hier dus niet gereset of gereactiveerd.
 *
 * SCHRIJFVOLGORDE (DM19/INT-7). Het nieuwe Match-document wordt opgeslagen in
 * de fase die de room op dit moment DRAAGT (FINISHED), niet alvast in LOBBY:
 * regel 2 van de mapkop (`gedeeld.mjs`) geldt ook voor een vers document, en de
 * dubbele compare-and-set eist dat `Room.phase` én `Match.phase` allebei
 * `expectedPhase` dragen. De atomaire operatie zet daarna beide in één stap op
 * LOBBY — dat is meteen de enige plek waar de fase van de nieuwe match ooit
 * wordt geschreven.
 *
 * Die operatie gaat daarom ook VÓÓR de spelerreset en vóór het verzetten van
 * `Room.currentMatchId`. Verliest hij de race — twee hosttabs die tegelijk op
 * "opnieuw" drukken — dan blijft er niets anders achter dan een Match-document
 * waar niemand naar wijst: de winnende rematch houdt zijn room, zijn
 * `currentMatchId` en zijn spelers. Andersom (eerst resetten en `currentMatchId`
 * verzetten, dan pas de CAS) zou de verliezer de room naar zijn eigen dode
 * match laten wijzen terwijl de winnaar `Room.phase` al op LOBBY heeft gezet —
 * een room die daarna nergens meer uit komt.
 *
 * `touchRoom` schrijft het hele Room-document en zou de zojuist gezette fase
 * overschrijven met de fase uit de al ingelezen kopie; het herlaadt de room
 * daarom eerst (zie ook de waarschuwing bij `touchRoom` zelf, in
 * room/levensduur.mjs).
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function rematch(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;

  if (match.phase !== PHASES.FINISHED) {
    return fail(CODES.INVALID_PHASE);
  }

  const now = context.now();
  const expectedPhase = match.phase;
  const source = contentSourceFor(context, room);
  const next = {
    id: createId(context, 'match'),
    roomId,
    sequence: match.sequence + 1,
    // De fase die de room NU draagt; de atomaire operatie hieronder maakt er
    // LOBBY van, samen met `Room.phase`.
    phase: expectedPhase,
    startedAt: now,
    finishedAt: null,
    roundIndex: 0,
    roundIds: [],
    usedQuestionKeys: [],
    previousMatchQuestionKeys: [...match.usedQuestionKeys],
    pausedState: null,
    contentVersion: source.contentVersion,
    rendererVersion: source.rendererVersion,
    gameType: matchGameType(room, match),
  };
  assertMatchShape({ ...next, phase: PHASES.LOBBY });
  await context.store.saveMatch(next);

  const applied = await context.store.setRoomAndMatchPhaseAtomically(roomId, next.id, {
    expectedPhase,
    newPhase: PHASES.LOBBY,
    pausedState: null,
  });
  if (!applied.ok) {
    // `game:rematch` is een hostactie: de host krijgt een gepubliceerde code
    // terug en zijn client haalt een verse snapshot op. `next` blijft als
    // ongerefereerd document achter; de room zelf is onaangeroerd.
    return phaseConflict('HOST_REMATCH', expectedPhase, applied.actualPhase);
  }

  // Herladen: de room in `loaded` draagt nog de fase van vóór de atomaire
  // operatie, en `touchRoom` schrijft het hele document.
  const flipped = await context.store.loadRoom(roomId);
  await touchRoom(context, flipped, now, { currentMatchId: next.id });

  const players = await context.store.listPlayers(roomId);
  const reset = [];
  for (const player of players) {
    if (player.kicked === true || player.left === true) {
      continue;
    }
    const fresh = {
      ...player,
      score: 0,
      correctCount: 0,
      correctResponseTimeMsTotal: 0,
      // Een late joiner uit de vorige match speelt de nieuwe volledig mee.
      eligibleFromRound: 1,
    };
    assertPlayerShape(fresh);
    await context.store.savePlayer(fresh);
    reset.push(fresh.id);
  }

  return succeed({
    matchId: next.id,
    previousMatchId: match.id,
    sequence: next.sequence,
    phase: PHASES.LOBBY,
    gameType: next.gameType,
    totalRounds: room.config.totalRounds,
    contentVersion: next.contentVersion,
    rendererVersion: next.rendererVersion,
    previousMatchQuestionKeys: [...next.previousMatchQuestionKeys],
    resetPlayerIds: reset,
  });
}
