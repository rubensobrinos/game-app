// server/composition/match/rondes.mjs
//
// Eén ronde van begin tot eind: de vraag bouwen en het venster openen
// (`startRound`), één antwoord verwerken (`submitAnswer`), het venster sluiten
// en de uitslag opleveren (`endRound`), plus de vraag welke ronde een late
// joiner mag meespelen (`resolveEligibleFromRound`).
//
// `correctAnswer` gaat het Round-document in en verlaat deze module nooit vóór
// `endRound` (besluit 20, regel 3 uit `gedeeld.mjs`). `startRound` bouwt zijn
// publieke payload daarom via een expliciete allowlist en niet via een spread.

import { EVENT_TYPES, PHASES, transition } from '../../architecture/state-machine.js';
import { resolveAnswer } from '../../data/answer-flow.js';
import { assertRoundShape } from '../../data/types/round.js';
import { computeAnswerDistribution } from '../../rules/answer-distribution.js';
import { computeEligibleFromRound, isEligibleForRound } from '../../rules/eligibility.js';
import { createId } from '../context.mjs';
import { phaseEndsAt } from './fases.mjs';
import {
  activePlayers,
  applyTransition,
  CODES,
  CONTENT_UNAVAILABLE,
  contentSourceFor,
  fail,
  loadCurrentRound,
  loadRoomAndMatch,
  matchGameType,
  ROUND_STATUS_ACTIVE,
  ROUND_STATUS_ENDED,
  succeed,
  toWireCode,
} from './gedeeld.mjs';

/**
 * Bouwt de vraag en opent de ronde (COUNTDOWN → ROUND_ACTIVE).
 *
 * `exclude` is de vereniging van de al gebruikte questionKeys van DEZE match
 * en die van de direct vorige match bij een rematch (GAME-RULES.md
 * §Vraagselectie). `correctAnswer` gaat het Round-document in en staat nooit
 * in de teruggegeven payload (besluit 20) — die payload is exact de negen
 * velden van `round:started` uit PROTOCOL.md.
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function startRound(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;
  const now = context.now();

  // Eerst de legaliteit toetsen met dezelfde pure reducer, zodat er geen
  // Round-document ontstaat voor een overgang die toch wordt afgewezen.
  const probe = transition(
    { phase: match.phase, pausedState: match.pausedState },
    { type: EVENT_TYPES.TIMER_ELAPSED, nextPhase: PHASES.ROUND_ACTIVE },
    room.config.pacing,
    now,
  );
  if (!probe.ok) {
    return fail(toWireCode(probe.code));
  }

  const gameType = matchGameType(room, match);
  const source = contentSourceFor(context, room);

  // VANGNET, GEEN VERGOELIJKING (PLAN-CONVERGENTIE §A0). `buildQuestion`
  // werpt wanneer de contentbron deze gameType niet kan bouwen of de pool
  // uitgeput raakt. Deze functie draait op een timer-callback, dus een throw
  // hier verdwijnt in een unhandled rejection: geen `round:started`, geen
  // foutcode, room stil in COUNTDOWN. `game-catalog.mjs` + de module-load-
  // controle in `content-source.mjs` horen dit onmogelijk te maken; komt het
  // er tóch doorheen, dan faalt het zichtbaar in plaats van stil.
  let built;
  try {
    built = source.buildQuestion({
      gameType,
      exclude: [...match.usedQuestionKeys, ...match.previousMatchQuestionKeys],
    });
  } catch (error) {
    return {
      ok: false,
      code: CONTENT_UNAVAILABLE,
      contentFailure: { gameType, reason: error instanceof Error ? error.message : String(error) },
    };
  }

  const round = {
    id: createId(context, 'round'),
    matchId: match.id,
    gameType,
    questionKey: built.questionKey,
    publicQuestionPayload: built.publicQuestionPayload,
    correctAnswer: built.correctAnswer,
    ...(built.validOptionIds === undefined ? {} : { validOptionIds: built.validOptionIds }),
    ...(built.resultDetails === undefined ? {} : { resultDetails: built.resultDetails }),
    startsAt: now,
    endsAt: now + room.config.questionSeconds * 1000,
    status: ROUND_STATUS_ACTIVE,
  };
  assertRoundShape(round);
  await context.store.saveRound(roomId, round);

  const applied = await applyTransition(context, {
    room,
    match,
    event: { type: EVENT_TYPES.TIMER_ELAPSED, nextPhase: PHASES.ROUND_ACTIVE },
    extraPatch: {
      roundIds: [...match.roundIds, round.id],
      usedQuestionKeys: [...match.usedQuestionKeys, round.questionKey],
    },
  });
  if (!applied.ok) {
    return applied;
  }

  // Expliciete allowlist, exact de tien velden van `round:started`
  // (PROTOCOL.md §Voorbeeld, gevalideerd door
  // server/protocol/server-events-round-lifecycle.mjs). Geen spread —
  // besluit 20. `contentVersion`/`rendererVersion` komen van het Match-
  // document, want die twee zijn dáár canoniek (besluit 21).
  return succeed({
    matchId: match.id,
    roundId: round.id,
    roundNumber: applied.value.match.roundIndex + 1,
    totalRounds: room.config.totalRounds,
    gameType: round.gameType,
    contentVersion: match.contentVersion,
    rendererVersion: match.rendererVersion,
    question: round.publicQuestionPayload,
    startsAt: round.startsAt,
    endsAt: round.endsAt,
  });
}

/**
 * Verwerkt één antwoord (`round:answer`).
 *
 * Sessie/speler, ronde actief, speelgerechtigdheid, deadline + grace
 * (besluit 13), geldigheid en punten komen uit `resolveAnswer()` in
 * server/data/answer-flow.js, dat op zijn beurt server/rules/scoring.js en
 * server/rules/validators.js gebruikt. Er wordt hier niets herbeslist.
 *
 * IDEMPOTENTIE IS EIGENDOM VAN DE POORT (DM13). `saveAcceptedAnswerAtomically`
 * handhaaft het contract zelf, atomair met de write: bij dezelfde `actionId`
 * lost hij stil op zonder te muteren, bij een ANDERE `actionId` voor een al
 * beantwoorde ronde werpt hij een `RangeError` met `code: 'ALREADY_ANSWERED'`.
 * Deze functie doet daarom geen voorcontrole meer — `existingAnswerForRound`
 * en `existingActionCacheEntry` gaan bewust als `null` de resolutie in. Twee
 * plekken die hetzelfde bewaken maken de poort niet de enige waarheid, en een
 * controle vóór de write dekt geen gelijktijdigheid: tussen het inlezen van de
 * context en de write past een tweede, gelijktijdige aanroep.
 *
 * DAAROM LEZEN NA DE WRITE, NIET CONTROLEREN ERVOOR. De ack komt uit
 * `loadActionCacheEntry(roomId, actionId)` ná de write: bij een verse write
 * staat daar de eigen entry, bij een replay die van de oorspronkelijke
 * aanroep. In beide gevallen de juiste ack, zonder dat vooraf bekend hoeft te
 * zijn welk geval het is. Dezelfde redenering geldt voor de persoonlijke
 * velden: die komen uit het opgeslagen Answer-document en het opgeslagen
 * Player-document, niet uit de zojuist berekende (en bij een replay
 * weggegooide) `write`.
 *
 * Het `replay`-label is het enige dat niet uit de poort kán komen: zowel de
 * stille replay-tak als een verse write geven `undefined` terug en laten
 * dezelfde store-inhoud achter. Daarvoor staat er één lezing vóór de write —
 * die niets bewaakt en niets afkort, alleen benoemt. Zie het handoff-item.
 *
 * GAT — de poort dekt één geval NIET dat de oude voorcontrole wél ving: een
 * replay die pas ná de deadline + grace binnenkomt, of nadat de ronde niet
 * meer ACTIVE is. `resolveAnswer()` wijst die af met `DEADLINE_PASSED` /
 * `ROUND_NOT_ACTIVE` en de poort komt er niet meer aan te pas, terwijl
 * PROTOCOL.md §Idempotentie "zelfde actionId: zelfde ack" belooft. Zie het
 * handoff-item; hier bewust GEEN tweede vangnet omheen gebouwd.
 *
 * `clientAnsweredAt` is diagnostiek (GAME-RULES.md: "clienttijd wordt alleen
 * voor diagnostiek meegestuurd") en gaat NIET de scoring in; servertijd is
 * leidend. Het Answer-document heeft er geen veld voor, dus de waarde komt
 * alleen in het resultaat terug.
 *
 * @param {import('../context.mjs').Context} context
 * @param {{
 *   roomId: string, playerId: string, roundId: string,
 *   answer: unknown, actionId: string, clientAnsweredAt?: number|null,
 * }} params
 */
export async function submitAnswer(context, {
  roomId,
  playerId,
  roundId,
  answer,
  actionId,
  clientAnsweredAt = null,
} = {}) {
  if (typeof actionId !== 'string' || actionId.length === 0) {
    throw new TypeError(`submitAnswer: actionId moet een niet-lege string zijn, kreeg: ${JSON.stringify(actionId)}`);
  }

  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;

  const round = await context.store.loadRound(roomId, match.id, roundId);
  if (round === null) {
    return fail(CODES.ROUND_NOT_ACTIVE);
  }
  const player = await context.store.loadPlayer(roomId, playerId);
  if (player === null) {
    return fail(CODES.NOT_PLAYER);
  }
  const session = await context.store.loadSession(roomId, player.sessionId);
  if (session === null) {
    return fail(CODES.TOKEN_INVALID);
  }

  const receivedAt = context.now();
  const resolved = resolveAnswer({
    session,
    player,
    room,
    match,
    round,
    answer,
    actionId,
    receivedAt,
    deadlineGraceMs: room.config.deadlineGraceMs,
    // DM13: de poort bewaakt idempotentie, deze laag niet meer. Beide
    // snelpaden in answer-flow.js krijgen daarom niets om op te vallen.
    existingAnswerForRound: null,
    existingActionCacheEntry: null,
  });

  if (!resolved.ok) {
    return fail(toWireCode(resolved.code));
  }

  // LABEL, GEEN CONTROLE. Deze lezing beslist niets: ze gaat de resolutie niet
  // in, kort niets af en houdt geen write tegen — de poort hieronder doet dat.
  // Ze bepaalt uitsluitend hoe het resultaat HEET. Slaagt de write terwijl er
  // al een antwoord lag, dan kan dat alleen de stille replay-tak van de poort
  // zijn geweest (een ander actionId op een al beantwoorde ronde werpt), dus
  // `replay` is daarmee exact af te leiden zonder de idempotentie zelf te
  // bewaken. De poort kent geen returnwaarde die dit verklapt — zie het
  // handoff-item; hier geen tweede vangnet, alleen een naam voor het geval.
  const answerBeforeWrite = await context.store.loadAnswer(roomId, match.id, round.id, playerId);

  try {
    await context.store.saveAcceptedAnswerAtomically(roomId, match.id, resolved.write);
  } catch (error) {
    // Een andere actionId voor een al beantwoorde ronde. De poort werpt; naar
    // buiten is dat een gewone resultaatcode, geen exception.
    if (error !== null && typeof error === 'object' && error.code === CODES.ALREADY_ANSWERED) {
      return fail(CODES.ALREADY_ANSWERED);
    }
    throw error;
  }

  // Lezen ná de write: dit is de opgeslagen waarheid, of onze eigen write nu
  // is geland (vers) of stil is opgelost (replay met dezelfde actionId).
  const cached = await context.store.loadActionCacheEntry(roomId, actionId);
  const stored = await context.store.loadAnswer(roomId, match.id, round.id, playerId);
  const storedPlayer = await context.store.loadPlayer(roomId, playerId);

  return succeed({
    ack: cached.ack,
    // Lag er al een antwoord én slaagde de write toch, dan heeft de poort
    // stil opgelost: dit was een replay van dezelfde actionId.
    replay: answerBeforeWrite !== null,
    clientAnsweredAt,
    // Persoonlijke velden voor de aanroeper; NIET onderdeel van de ack, zodat
    // een replay exact dezelfde ack kan teruggeven (PROTOCOL.md §Idempotentie).
    correct: stored.correct,
    points: stored.points,
    responseTimeMs: stored.responseTimeMs,
    score: storedPlayer.score,
  });
}

/**
 * Sluit de ronde af (ROUND_ACTIVE → ROUND_RESULT) en levert de uitslag,
 * inclusief antwoordverdeling.
 *
 * De verdeling komt uit server/rules/answer-distribution.js (besluit 14: de
 * rules-laag rekent, het protocol transporteert alleen).
 *
 * GAT — de poort heeft geen `listAnswersForRound`; er is alleen
 * `loadAnswer(roundId, playerId)`. De antwoorden worden daarom per speler
 * opgehaald (N+1 leesoperaties). Zie het handoff-item.
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function endRound(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;
  const now = context.now();

  const round = await loadCurrentRound(context, room, match);
  if (round === null) {
    return fail(CODES.ROUND_NOT_ACTIVE);
  }

  const probe = transition(
    { phase: match.phase, pausedState: match.pausedState },
    { type: EVENT_TYPES.TIMER_ELAPSED, nextPhase: PHASES.ROUND_RESULT },
    room.config.pacing,
    now,
  );
  if (!probe.ok) {
    return fail(toWireCode(probe.code));
  }

  const roundNumber = match.roundIndex + 1;
  const players = activePlayers(await context.store.listPlayers(roomId));

  const results = [];
  const accepted = [];
  for (const player of players) {
    const stored = await context.store.loadAnswer(roomId, match.id, round.id, player.id);
    const eligible = isEligibleForRound(player.eligibleFromRound, roundNumber);
    if (stored !== null) {
      accepted.push(stored);
    }
    results.push({
      playerId: player.id,
      effectiveName: player.effectiveName,
      // docs/openstaand/spelersidentiteit.md, stap 4/5: "Wie had het goed"
      // rijker tonen hangt hieraan (zie het bouwplan, "Wat dit meteen
      // oplost") — zonder het paar kan de reveal niet meer laten zien dan de
      // servertalige naam. `?? null` dekt stap 6.
      identity: player.identity ?? null,
      eligible,
      answered: stored !== null,
      correct: stored === null ? false : stored.correct,
      points: stored === null ? 0 : stored.points,
      responseTimeMs: stored === null ? null : stored.responseTimeMs,
    });
  }

  // De regelslaag levert een OBJECT (`{ at: 9, pe: 5 }`); over de lijn gaat een
  // geordende ARRAY. Stap 6 (5 aug 2026) bracht dit verschil aan het licht: de
  // client (`scoreboard.mjs`, `social-headline.mjs`) leest
  // `distribution.find((d) => d.optionId === ...)` en kreeg tegen de échte
  // server altijd `undefined` — "N van M zaten goed" verscheen daardoor nooit
  // buiten de mock, zonder één foutmelding. PROTOCOL.md §round:ended legt de
  // arrayvorm nu vast (open vraag 11 gesloten).
  //
  // De volgorde is die van de antwoordopties zelf: `answer-distribution.js`
  // bouwt zijn object in optievolgorde op, en `Object.entries` behoudt die
  // (bij `higher_lower`/`odd_one_out` zijn de sleutels '0','1',… — numeriek
  // oplopend, dus ook daar de weergavevolgorde).
  const distribution = Object.entries(computeAnswerDistribution(
    round.gameType,
    accepted.map((entry) => ({ answer: entry.answer })),
    { validOptionIds: round.validOptionIds },
  )).map(([optionId, count]) => ({ optionId, count }));

  await context.store.saveRound(roomId, { ...round, status: ROUND_STATUS_ENDED });

  const applied = await applyTransition(context, {
    room,
    match,
    event: { type: EVENT_TYPES.TIMER_ELAPSED, nextPhase: PHASES.ROUND_RESULT },
  });
  if (!applied.ok) {
    return applied;
  }

  return succeed({
    matchId: match.id,
    roundId: round.id,
    roundNumber,
    totalRounds: room.config.totalRounds,
    // Pas hier verlaat het juiste antwoord de server (besluit 20 /
    // GAME-RULES.md: "nooit vóór round:ended").
    correctAnswer: round.correctAnswer,
    // De uitlegregel van "Welke hoort er niet bij" (doelbeeld v2 §1: de
    // afwijklogica wordt ná het antwoord kort getoond) heeft de continenten
    // nodig die op het Round-document staan. Ze verklappen niets vóór dit
    // moment — `round:started` draagt ze niet, en de snapshot van een actieve
    // ronde evenmin.
    ...(round.resultDetails === undefined ? {} : { resultDetails: round.resultDetails }),
    distribution,
    answeredCount: accepted.length,
    eligiblePlayerCount: results.filter((entry) => entry.eligible).length,
    results,
    phase: applied.value.match.phase,
    phaseEndsAt: phaseEndsAt(room, applied.value.match.phase, now),
  });
}

/**
 * Bepaalt de `eligibleFromRound` die aan `room-lifecycle.joinRoom()` moet
 * worden meegegeven. Alleen deze laag kent `Match.roundIndex`.
 *
 * Het getal komt uit `computeEligibleFromRound()` in
 * server/rules/eligibility.js — niet uit een eigen `+1` hier.
 *
 * KEUZE — `remainingFraction` gaat bewust als `null` de rules-laag in. GR5's
 * uitzondering "vlak na de start mag je de lopende ronde nog meespelen" heeft
 * geen bron die `nearEndThreshold` vastlegt, en matrixrij 9 eist het strengere
 * "telt pas mee vanaf de eerstvolgende volledig nieuwe ronde". Zodra een bron
 * die drempel vastlegt is dit één argument.
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function resolveEligibleFromRound(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId, { requireMatch: false });
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;

  if (match === null || match.phase === PHASES.LOBBY) {
    return succeed({ eligibleFromRound: 1, currentRoundNumber: 1, phase: room.phase, isLateJoin: false });
  }
  if (match.phase === PHASES.FINISHED) {
    // De match is klaar; een joiner speelt vanaf ronde 1 van de volgende match.
    return succeed({ eligibleFromRound: 1, currentRoundNumber: match.roundIndex + 1, phase: match.phase, isLateJoin: false });
  }

  const currentRoundNumber = match.roundIndex + 1;
  const eligibleFromRound = computeEligibleFromRound({
    currentRoundNumber,
    phase: match.phase,
    remainingFraction: null,
    nearEndThreshold: 1,
  });
  return succeed({
    eligibleFromRound,
    currentRoundNumber,
    phase: match.phase,
    isLateJoin: eligibleFromRound > 1,
  });
}
