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
// voor echte Redis-sleutels). `sessionsByKey`/`playersByKey` volgden dit
// patroon aanvankelijk niet (§7-opvolgnotitie in `HANDOFF.md`) — DM18 heeft
// ze alsnog omgezet; `playerIdsByRoom` is daarmee komen te vervallen, want
// `playersByKey.get(roomId)`'s sleutels zíjn nu de spelers-ids van die room.

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
  // Besluit 48: welke codes ooit gebruikt zijn. Geen TTL nodig — deze store
  // leeft niet langer dan het proces.
  const codesSeen = new Set();
  const roomIdByInviteHash = new Map(); // gevuld door claimRoomLocatorsAtomically, NIET door saveRoom (Room draagt geen inviteHash — zie DM10)
  const sessionsByKey = new Map(); // roomId -> Map<sessionId, Session> (DM18: was `${roomId} ${sessionId}`, zie §7)
  const roomAndSessionByTokenHash = new Map(); // tokenHash -> { roomId, sessionId } (DM14/§10)
  const playersByKey = new Map(); // roomId -> Map<playerId, Player> (DM18: was `${roomId} ${playerId}`, zie §7)
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
    // DM17 (reactie op INTB-9): saveRoom raakt de lookup-indexen niet meer
    // aan. Vóór deze fix schreef saveRoom onvoorwaardelijk naar roomIdByCode
    // — een tweede, ongecontroleerde weg naar dezelfde index als
    // claimRoomLocatorsAtomically, die de hele claim-garantie omzeilde. Voor
    // de inviteHash-kant bestond dit gat al niet (Room draagt geen hash,
    // saveRoom kon daar nooit bij) — nu geldt hetzelfde voor de code-kant.
    // Roomcreatie is dus expliciet tweefasig: eerst
    // claimRoomLocatorsAtomically, dan pas saveRoom. Een saveRoom zonder
    // voorafgaande geslaagde claim levert een room op die nergens via code of
    // inviteHash vindbaar is — dat is de bedoeling, geen bug.
    const copy = deepCopy(room);
    roomsById.set(copy.id, copy);
  }


  /**
   * Besluit 48: de grafsteen, zelfde gedrag als de Redis-adapter. Een Set
   * volstaat hier — deze store is voor ontwikkeling en tests, en leeft toch
   * niet langer dan het proces. De TTL van zeven dagen doet er dus niet toe;
   * wat telt is dat het onderscheid dat de compositielaag maakt in beide
   * adapters hetzelfde uitpakt.
   */
  async function markCodeSeen(code) {
    codesSeen.add(String(code));
  }

  /** @param {string} code @returns {Promise<boolean>} */
  async function hasCodeBeenSeen(code) {
    return codesSeen.has(String(code));
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

  async function rotateRoomLocators({ roomId, oldCode, oldInviteHash, newCode, newInviteHash }) {
    // DM16 (§9, reactie op INTB-5): atomaire wissel — oude locators vrijgeven
    // én nieuwe claimen in één stap, of geen van beide. Twee losse aanroepen
    // (release + claim) zouden een venster openen waarin de room via GEEN
    // enkele code bereikbaar is, of waarin de oude code na een mislukte
    // nieuwe claim toch nog geldig blijft — bij "direct intrekbaar"
    // (ARCHITECTURE.md §inviteId) is dat laatste zelfs de ergere uitkomst.
    if (roomIdByCode.get(oldCode) !== roomId) {
      throw new RangeError(
        `rotateRoomLocators: roomId ${JSON.stringify(roomId)} bezit oldCode ${JSON.stringify(oldCode)} niet (meer)`
      );
    }
    if (roomIdByInviteHash.get(oldInviteHash) !== roomId) {
      throw new RangeError(
        `rotateRoomLocators: roomId ${JSON.stringify(roomId)} bezit oldInviteHash ${JSON.stringify(oldInviteHash)} niet (meer)`
      );
    }

    // Conflictcontrole vóór enige write. Eigen roomId op newCode/newInviteHash
    // is geen conflict (bijv. alleen de invite roteert, de code blijft
    // gelijk) — idempotent, net als claimRoomLocatorsAtomically.
    const codeOwner = roomIdByCode.get(newCode);
    if (codeOwner !== undefined && codeOwner !== roomId) {
      // Veilige no-op: de OUDE locators blijven geldig. Een room die
      // tijdelijk via geen enkele code bereikbaar is, is erger dan een
      // rotatie die nog niet gelukt is.
      return { ok: false, conflict: 'code' };
    }
    const inviteOwner = roomIdByInviteHash.get(newInviteHash);
    if (inviteOwner !== undefined && inviteOwner !== roomId) {
      return { ok: false, conflict: 'inviteHash' };
    }

    // Geen conflict: oude vrijgeven, nieuwe zetten, in dezelfde synchrone stap.
    if (oldCode !== newCode) {
      roomIdByCode.delete(oldCode);
    }
    roomIdByCode.set(newCode, roomId);
    if (oldInviteHash !== newInviteHash) {
      roomIdByInviteHash.delete(oldInviteHash);
    }
    roomIdByInviteHash.set(newInviteHash, roomId);

    return { ok: true };
  }

  async function loadSession(roomId, sessionId) {
    const session = sessionsByKey.get(roomId)?.get(sessionId);
    return session === undefined ? null : deepCopy(session);
  }

  async function saveSession(session) {
    // DM17 (Deel B, reactie op INTB-10's rotatie-eis): als deze sessie al
    // bestond met een ANDERE tokenHash, wordt die oude index-entry vrijgegeven
    // in dezelfde synchrone stap als de nieuwe wordt gezet — anders blijft de
    // oude tokenHash een tweede geldige capability naast de nieuwe, letterlijk
    // INTB-5 nog een keer. Geen nieuwe reverse index nodig: sessionsByKey
    // draagt de vorige sessie al op dezelfde sleutel.
    const sessionsInRoom = getOrCreateNestedMap(sessionsByKey, session.roomId);
    const existing = sessionsInRoom.get(session.id);
    if (existing !== undefined && existing.tokenHash !== session.tokenHash) {
      roomAndSessionByTokenHash.delete(existing.tokenHash);
    }

    sessionsInRoom.set(session.id, deepCopy(session));
    // DM14 (§10, reactie op INT-3): tokenHash staat al op Session (DM2a) —
    // geen chicken-and-egg zoals bij inviteHash, dus deze index kan
    // rechtstreeks door saveSession gevuld worden. Niet leeggemaakt bij
    // revoked=true: de aanroeper moet "token onbekend" en "token bekend maar
    // herroepen" uit elkaar kunnen houden (zie loadSessionByTokenHash). Geen
    // touch-on-read in loadSessionByTokenHash (Deel B): TTL-koppeling loopt
    // via de room-brede refresh, niet via lookup-frequentie — anders verliest
    // een stille speler zijn reconnectrecht terwijl de room nog leeft.
    roomAndSessionByTokenHash.set(session.tokenHash, { roomId: session.roomId, sessionId: session.id });
  }

  async function loadSessionByTokenHash(tokenHash) {
    const located = roomAndSessionByTokenHash.get(tokenHash);
    return located === undefined ? null : loadSession(located.roomId, located.sessionId);
  }

  async function loadPlayer(roomId, playerId) {
    const player = playersByKey.get(roomId)?.get(playerId);
    return player === undefined ? null : deepCopy(player);
  }

  async function savePlayer(player) {
    const playersInRoom = getOrCreateNestedMap(playersByKey, player.roomId);
    playersInRoom.set(player.id, deepCopy(player));
  }

  async function listPlayers(roomId) {
    const playersInRoom = playersByKey.get(roomId);
    if (playersInRoom === undefined) {
      return [];
    }
    return Array.from(playersInRoom.values()).map(deepCopy);
  }

  /**
   * De rooms die deze store kent (A7/C-3, herstel na serverherstart). In Redis
   * is dit de `rooms:active`-set; hier zijn het simpelweg de opgeslagen rooms.
   *
   * Bewust GEEN filter op fase: wat "actief" betekent is een uitspraak van de
   * compositielaag (die kent de fasetabel), niet van de opslag.
   */
  async function listActiveRoomIds() {
    return [...roomsById.keys()];
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

  async function setRoomAndMatchPhaseAtomically(roomId, matchId, { expectedPhase, newPhase, pausedState }) {
    // DECISIONS.md #30 (bevestigd 2 augustus 2026): Match.phase is autoritair;
    // Room.phase is een AFGELEIDE PROJECTIE, bijgewerkt in dezelfde atomaire
    // operatie. Geen niet-atomair dual-write-pad — deze functie zet daarom
    // altijd beide in één synchrone stap, nooit één zonder de ander.
    //
    // DM19 (reactie op INT-16): drie uitbreidingen op het oorspronkelijke
    // DM6-ontwerp, hieronder in volgorde.
    const room = roomsById.get(roomId);
    const match = matchesByKey.get(roomId)?.get(matchId);
    if (room === undefined) {
      throw new RangeError(`setRoomAndMatchPhaseAtomically: unknown roomId ${JSON.stringify(roomId)}`);
    }
    if (match === undefined) {
      throw new RangeError(`setRoomAndMatchPhaseAtomically: unknown matchId ${JSON.stringify(matchId)} for roomId ${JSON.stringify(roomId)}`);
    }

    // 1. pausedState/PAUSED-invariant, BEIDE richtingen — een contractschending
    // van de AANROEPER (niet een normale racefout), dus een throw, geen
    // { ok: false }. Vóór de CAS-check: een intern inconsistente aanvraag is
    // nooit geldig, ongeacht wat er in de store staat.
    if (newPhase === 'PAUSED' && pausedState === null) {
      throw new RangeError('setRoomAndMatchPhaseAtomically: newPhase "PAUSED" vereist een niet-lege pausedState');
    }
    if (newPhase !== 'PAUSED' && pausedState !== null) {
      throw new RangeError(`setRoomAndMatchPhaseAtomically: pausedState moet null zijn buiten de fase "PAUSED" (newPhase was ${JSON.stringify(newPhase)})`);
    }

    // 2. Dubbele compare-and-set: zowel Room.phase als Match.phase moeten op
    // dit moment de verwachte fase dragen. Dit vertrouwt niet stilzwijgend dat
    // de twee al gelijk lopen (dat zou besluit 30 zelf oncontroleerd aannemen)
    // — een mismatch aan ÉÉN van beide kanten is een normale, geen
    // uitzonderlijke uitkomst (net als bij de locatorclaim), dus een
    // resultaatobject, geen throw. Match.phase is het gerapporteerde
    // `actualPhase`, want dat is het autoritaire veld (besluit 30).
    if (room.phase !== expectedPhase || match.phase !== expectedPhase) {
      return { ok: false, actualPhase: match.phase };
    }

    // 3. `pausedState` in dezelfde atomaire stap als de fasewissel (was vóór
    // DM19 een aparte `saveMatch`-aanroep van de compositie — een
    // niet-atomair dual-write-pad voor precies het veld dat besluit 30 niet
    // met naam noemde maar in de geest evident meeneemt).
    //
    // Alle kandidaat-updates eerst volledig voorbereiden (geen enkele write
    // hierboven), dan pas allebei committen — zodat een fout vóór dit punt
    // gegarandeerd geen van beide raakt.
    const updatedRoom = { ...room, phase: newPhase };
    const updatedMatch = { ...match, phase: newPhase, pausedState };
    roomsById.set(roomId, updatedRoom);
    matchesByKey.get(roomId).set(matchId, updatedMatch);
    return { ok: true };
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
    //
    // DM15 (INT-14): geeft { replay: boolean } terug in plaats van niets, zodat
    // de aanroeper een replay kan herkennen zonder een eigen, niet-atomaire
    // vooraf-lezing (die geen gelijktijdigheid dekt en tot een gemist geval
    // leidde: een replay ná de deadline werd afgewezen vóórdat deze operatie
    // ooit werd bereikt). Geen ack in de returnwaarde — ongewijzigd t.o.v.
    // DM13, de aanroeper gebruikt `loadActionCacheEntry` als hij die nodig
    // heeft.
    const existingActionCacheEntry = actionCacheByRoom.get(roomId)?.get(write.actionCacheEntry.actionId);
    if (existingActionCacheEntry !== undefined) {
      return { replay: true }; // resolve zonder te muteren
    }

    const playersInRoom = getOrCreateNestedMap(playersByKey, roomId);
    const existingPlayer = playersInRoom.get(write.updatedPlayer.id);
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

    playersInRoom.set(write.updatedPlayer.id, deepCopy(updatedPlayer));

    const scoreboardInRoom = getOrCreateNestedMap(scoreboardByRoom, roomId);
    const scoreboardInMatch = getOrCreateNestedMap(scoreboardInRoom, matchId);
    scoreboardInMatch.set(write.updatedPlayer.id, write.updatedPlayer.score);

    const actionCacheInRoom = getOrCreateNestedMap(actionCacheByRoom, roomId);
    actionCacheInRoom.set(write.actionCacheEntry.actionId, deepCopy(write.actionCacheEntry));

    return { replay: false };
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
    markCodeSeen, hasCodeBeenSeen,
    claimRoomLocatorsAtomically, releaseRoomLocators, refreshRoomLocators, rotateRoomLocators,
    loadSession, saveSession, loadSessionByTokenHash,
    loadPlayer, savePlayer, listPlayers, listActiveRoomIds,
    loadMatch, saveMatch,
    loadRound, saveRound,
    loadAnswer,
    setRoomAndMatchPhaseAtomically, saveAcceptedAnswerAtomically,
    loadActionCacheEntry, getScoreboardTop,
  };
}

module.exports = { createInMemoryStore };
