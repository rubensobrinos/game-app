'use strict';

// In-memory implementatie van de DataStore-poort (repository.js) — een
// testfake, geen productieadapter. Zie
// docs/data-model-plan/prompts/DM6-repository-port.md voor de volledige spec.
//
// WAT DEZE FAKE WEL EN NIET BEWIJST: ze bewijst dat de domeinsemantiek van
// elke operatie klopt binnen één, single-threaded proces (bijv. dat
// setRoomAndMatchPhaseAtomically/saveAcceptedAnswerAtomically nooit half
// doorgevoerd in de Maps hieronder staan). Ze bewijst NIET dat een echte
// Redis-implementatie hetzelfde concurrency- of foutgedrag heeft onder
// gelijktijdige toegang, netwerkfalen, of een gedeeltelijk uitgevoerd
// Lua-script — dat komt pas met adapter-/integratietests ná de betreffende
// ADR's (checkpoints 2, 3, 5, 6, 7). Ze simuleert ook geen TTL-aftelling voor
// Room/Match/Session/de room-locators — zie `refreshRoomLocators` (DM10).
//
// Uitgebreid door DM10 (docs/data-model-plan/prompts/DM10-room-locator-claim.md,
// claimRoomLocatorsAtomically/releaseRoomLocators/refreshRoomLocators +
// loadRoomByInviteHash), DM11 (docs/data-model-plan/prompts/
// DM11-room-scoped-round-answer.md, room-gescoped saveRound/loadAnswer/
// loadActionCacheEntry via geneste Maps) en DM12 (docs/data-model-plan/
// prompts/DM12-scoreboard-room-scoping.md, scoreboard op (roomId, matchId)).
// Interne samengestelde sleutels zijn geneste Maps, geen met een scheidings-
// teken samengevoegde strings — `assertNonEmptyString` sluit spaties niet
// uit, dus een `` `${a} ${b}` ``-string kan in theorie botsen tussen twee
// verschillende paren (zelfde reden als `redis-keys.js`'s `assertSegment`
// voor echte Redis-sleutels). `sessionsByKey`/`playersByKey` zijn hier bewust
// NIET meegenomen — buiten de scope van DM10/11/12, zie `HANDOFF.md` voor die
// openstaande, kleinere opvolgnotitie.

/**
 * @param {object} value
 */
function deepCopy(value) {
  return structuredClone(value);
}

/**
 * Haalt de geneste Map onder `key` op, of maakt en registreert een lege Map
 * als die nog niet bestaat.
 * @param {Map<string, Map<any, any>>} outer
 * @param {string} key
 * @returns {Map<any, any>}
 */
function getOrCreateNestedMap(outer, key) {
  let inner = outer.get(key);
  if (inner === undefined) {
    inner = new Map();
    outer.set(key, inner);
  }
  return inner;
}

/**
 * @returns {import('./repository').DataStore}
 */
function createInMemoryStore() {
  const roomsById = new Map();
  const roomIdByCode = new Map();
  const roomIdByInviteHash = new Map(); // gevuld door claimRoomLocatorsAtomically, NIET door saveRoom (Room draagt geen inviteHash — zie DM10)
  const sessionsByKey = new Map(); // `${roomId} ${sessionId}` -> Session
  const playersByKey = new Map(); // `${roomId} ${playerId}` -> Player
  const playerIdsByRoom = new Map(); // roomId -> Set<playerId>
  const matchesByKey = new Map(); // roomId -> Map<matchId, Match>
  const roundsByKey = new Map(); // roomId -> Map<matchId, Map<roundId, Round>>
  const answersByKey = new Map(); // roomId -> Map<matchId, Map<roundId, Map<playerId, Answer>>>
  const scoreboardByRoom = new Map(); // roomId -> Map<matchId, Map<playerId, score>>
  const actionCacheByRoom = new Map(); // roomId -> Map<actionId, { actionId, ack }>

  async function loadRoom(roomId) {
    const room = roomsById.get(roomId);
    return room === undefined ? null : deepCopy(room);
  }

  async function saveRoom(room) {
    const copy = deepCopy(room);
    roomsById.set(copy.id, copy);
    roomIdByCode.set(copy.code, copy.id);
  }

  async function loadRoomByCode(code) {
    const roomId = roomIdByCode.get(code);
    return roomId === undefined ? null : loadRoom(roomId);
  }

  async function loadRoomByInviteHash(inviteHash) {
    const roomId = roomIdByInviteHash.get(inviteHash);
    return roomId === undefined ? null : loadRoom(roomId);
  }

  async function claimRoomLocatorsAtomically({ roomId, code, inviteHash }) {
    // ttlSeconds wordt bewust niet gebruikt: deze fake simuleert geen
    // TTL-aftelling (zie bestandscommentaar en refreshRoomLocators).
    const codeOwner = roomIdByCode.get(code);
    const inviteOwner = roomIdByInviteHash.get(inviteHash);

    if (codeOwner === roomId && inviteOwner === roomId) {
      return { ok: true }; // idempotente herclaim — geen writes nodig
    }
    // Beide conflicten eerst bepalen zonder enige write; code wint als allebei
    // conflicteren (vaste volgorde, DM10).
    if (codeOwner !== undefined && codeOwner !== roomId) {
      return { ok: false, conflict: 'code' };
    }
    if (inviteOwner !== undefined && inviteOwner !== roomId) {
      return { ok: false, conflict: 'inviteHash' };
    }
    // Geen conflict: beide in dezelfde synchrone stap zetten — alles-of-niets,
    // net als setRoomAndMatchPhaseAtomically hieronder.
    roomIdByCode.set(code, roomId);
    roomIdByInviteHash.set(inviteHash, roomId);
    return { ok: true };
  }

  async function releaseRoomLocators({ roomId, code, inviteHash }) {
    const ownsCode = roomIdByCode.get(code) === roomId;
    const ownsInviteHash = roomIdByInviteHash.get(inviteHash) === roomId;
    if (!ownsCode || !ownsInviteHash) {
      // Alles-of-niets (DM10): bij gedeeltelijk bezit wordt niets vrijgegeven,
      // nooit een verrassende halve opruiming.
      return;
    }
    roomIdByCode.delete(code);
    roomIdByInviteHash.delete(inviteHash);
  }

  async function refreshRoomLocators({ roomId, code, inviteHash }) {
    const ownsCode = roomIdByCode.get(code) === roomId;
    const ownsInviteHash = roomIdByInviteHash.get(inviteHash) === roomId;
    if (!ownsCode || !ownsInviteHash) {
      throw new RangeError(
        `refreshRoomLocators: roomId ${JSON.stringify(roomId)} bezit niet (meer) beide locators — ` +
          'een refresh op een claim die je niet bezit is een programmeerfout of een teken dat de claim al gestolen is.'
      );
    }
    // Contract-only (DM10): de fake heeft geen TTL-aftelling om te verlengen.
  }

  async function loadSession(roomId, sessionId) {
    const session = sessionsByKey.get(`${roomId} ${sessionId}`);
    return session === undefined ? null : deepCopy(session);
  }

  async function saveSession(session) {
    sessionsByKey.set(`${session.roomId} ${session.id}`, deepCopy(session));
  }

  async function loadPlayer(roomId, playerId) {
    const player = playersByKey.get(`${roomId} ${playerId}`);
    return player === undefined ? null : deepCopy(player);
  }

  async function savePlayer(player) {
    playersByKey.set(`${player.roomId} ${player.id}`, deepCopy(player));
    if (!playerIdsByRoom.has(player.roomId)) {
      playerIdsByRoom.set(player.roomId, new Set());
    }
    playerIdsByRoom.get(player.roomId).add(player.id);
  }

  async function listPlayers(roomId) {
    const ids = playerIdsByRoom.get(roomId);
    if (ids === undefined) {
      return [];
    }
    return Array.from(ids)
      .map((playerId) => playersByKey.get(`${roomId} ${playerId}`))
      .filter((player) => player !== undefined)
      .map(deepCopy);
  }

  async function loadMatch(roomId, matchId) {
    const match = matchesByKey.get(roomId)?.get(matchId);
    return match === undefined ? null : deepCopy(match);
  }

  async function saveMatch(match) {
    const matchesInRoom = getOrCreateNestedMap(matchesByKey, match.roomId);
    matchesInRoom.set(match.id, deepCopy(match));
  }

  async function loadRound(roomId, matchId, roundId) {
    const round = roundsByKey.get(roomId)?.get(matchId)?.get(roundId);
    return round === undefined ? null : deepCopy(round);
  }

  async function saveRound(roomId, round) {
    // Integriteitscontrole behouden (DM11): een ronde mag niet wees worden.
    // Voorheen een lineaire scan over alle matches (niet tegen Redis
    // implementeerbaar, INTB-1) — nu een directe geneste lookup.
    const match = matchesByKey.get(roomId)?.get(round.matchId);
    if (match === undefined) {
      throw new RangeError(
        `saveRound: no known match ${JSON.stringify(round.matchId)} in room ${JSON.stringify(roomId)} (save the Match first)`
      );
    }
    const roundsInRoom = getOrCreateNestedMap(roundsByKey, roomId);
    const roundsInMatch = getOrCreateNestedMap(roundsInRoom, round.matchId);
    roundsInMatch.set(round.id, deepCopy(round));
  }

  async function loadAnswer(roomId, matchId, roundId, playerId) {
    const answer = answersByKey.get(roomId)?.get(matchId)?.get(roundId)?.get(playerId);
    return answer === undefined ? null : deepCopy(answer);
  }

  async function setRoomAndMatchPhaseAtomically(roomId, matchId, newPhase) {
    // DECISIONS.md #30 (bevestigd 2 augustus 2026): Match.phase is autoritair;
    // Room.phase is een AFGELEIDE PROJECTIE, bijgewerkt in dezelfde atomaire
    // operatie. Geen niet-atomair dual-write-pad — deze functie zet daarom
    // altijd beide in één synchrone stap, nooit één zonder de ander.
    const room = roomsById.get(roomId);
    const match = matchesByKey.get(roomId)?.get(matchId);
    if (room === undefined) {
      throw new RangeError(`setRoomAndMatchPhaseAtomically: unknown roomId ${JSON.stringify(roomId)}`);
    }
    if (match === undefined) {
      throw new RangeError(`setRoomAndMatchPhaseAtomically: unknown matchId ${JSON.stringify(matchId)} for roomId ${JSON.stringify(roomId)}`);
    }
    // Beide kandidaat-updates eerst volledig voorbereiden (geen enkele write
    // hierboven), dan pas allebei committen — zodat een fout vóór dit punt
    // (bijv. hierboven een throw) gegarandeerd geen van beide raakt.
    const updatedRoom = { ...room, phase: newPhase };
    const updatedMatch = { ...match, phase: newPhase };
    roomsById.set(roomId, updatedRoom);
    matchesByKey.get(roomId).set(matchId, updatedMatch);
  }

  async function saveAcceptedAnswerAtomically(roomId, matchId, write) {
    // DM13 (docs/data-model-plan/prompts/DM13-answer-idempotency-in-atomic-write.md),
    // reactie op INTB-4: idempotentie EERST, vóór de playerId-check en vóór
    // "al beantwoord" — een replay van een eerder geslaagde actie moet
    // hetzelfde resultaat geven, ook als er ondertussen iets anders in de
    // room is veranderd (zelfde principe als answer-flow.js's stap 1). De
    // check in answer-flow.js dekt geen concurrency af (tussen het inlezen
    // van de context en deze aanroep past een tweede, gelijktijdige aanroep
    // op dezelfde, verouderde context) — deze atomaire operatie is de enige
    // plek waar check en write gegarandeerd samenvallen.
    const existingActionCacheEntry = actionCacheByRoom.get(roomId)?.get(write.actionCacheEntry.actionId);
    if (existingActionCacheEntry !== undefined) {
      return; // replay: resolve zonder te muteren, geen ack teruggeven (zie DM13)
    }

    const playerKey = `${roomId} ${write.updatedPlayer.id}`;
    const existingPlayer = playersByKey.get(playerKey);
    if (existingPlayer === undefined) {
      throw new RangeError(`saveAcceptedAnswerAtomically: unknown playerId ${JSON.stringify(write.updatedPlayer.id)} for roomId ${JSON.stringify(roomId)}`);
    }

    // Eén antwoord per speler per ronde (DATA-MODEL.md stap 5): een ANDERE
    // actionId voor een al-beantwoorde ronde wordt afgewezen, nooit stilzwijgend
    // overschreven — de idempotentiecheck hierboven ving de exact-dezelfde-
    // actionId-situatie al af.
    const existingAnswer = answersByKey.get(roomId)?.get(matchId)?.get(write.answer.roundId)?.get(write.answer.playerId);
    if (existingAnswer !== undefined) {
      throw Object.assign(
        new RangeError(
          `saveAcceptedAnswerAtomically: player ${JSON.stringify(write.answer.playerId)} already has an answer for round ${JSON.stringify(write.answer.roundId)}`
        ),
        { code: 'ALREADY_ANSWERED' }
      );
    }

    // Alle vier kandidaat-writes eerst voorbereiden, dan pas committen — zelfde
    // alles-of-niets-principe als setRoomAndMatchPhaseAtomically. Dit bewijst
    // alleen dat DEZE (single-threaded, in-memory) uitvoering atomair is; geen
    // uitspraak over een echte Redis Lua/MULTI-uitvoering onder concurrency.
    const updatedPlayer = {
      ...existingPlayer,
      score: write.updatedPlayer.score,
      correctCount: write.updatedPlayer.correctCount,
      correctResponseTimeMsTotal: write.updatedPlayer.correctResponseTimeMsTotal,
    };

    const answersInRoom = getOrCreateNestedMap(answersByKey, roomId);
    const answersInMatch = getOrCreateNestedMap(answersInRoom, matchId);
    const answersInRound = getOrCreateNestedMap(answersInMatch, write.answer.roundId);
    answersInRound.set(write.answer.playerId, deepCopy(write.answer));

    playersByKey.set(playerKey, deepCopy(updatedPlayer));

    const scoreboardInRoom = getOrCreateNestedMap(scoreboardByRoom, roomId);
    const scoreboardInMatch = getOrCreateNestedMap(scoreboardInRoom, matchId);
    scoreboardInMatch.set(write.updatedPlayer.id, write.updatedPlayer.score);

    const actionCacheInRoom = getOrCreateNestedMap(actionCacheByRoom, roomId);
    actionCacheInRoom.set(write.actionCacheEntry.actionId, deepCopy(write.actionCacheEntry));
  }

  async function loadActionCacheEntry(roomId, actionId) {
    const entry = actionCacheByRoom.get(roomId)?.get(actionId);
    return entry === undefined ? null : deepCopy(entry);
  }

  async function getScoreboardTop(roomId, matchId, limit) {
    const scores = scoreboardByRoom.get(roomId)?.get(matchId);
    if (scores === undefined) {
      return [];
    }
    return Array.from(scores.entries())
      .map(([playerId, score]) => ({ playerId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  return {
    loadRoom, saveRoom, loadRoomByCode, loadRoomByInviteHash,
    claimRoomLocatorsAtomically, releaseRoomLocators, refreshRoomLocators,
    loadSession, saveSession,
    loadPlayer, savePlayer, listPlayers,
    loadMatch, saveMatch,
    loadRound, saveRound,
    loadAnswer,
    setRoomAndMatchPhaseAtomically, saveAcceptedAnswerAtomically,
    loadActionCacheEntry, getScoreboardTop,
  };
}

module.exports = { createInMemoryStore };
