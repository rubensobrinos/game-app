import { ANSWER_WRITE_ATTEMPTS, PHASE_SWAP_ATTEMPTS, SAVE_ANSWER_LUA, SAVE_ANSWER_LUA_SHA, SET_PHASE_LUA, isNoScriptError } from './scripts.mjs';
import { actionCacheKey, answersKey, matchKey, roomKey, roomPlayersKey, scoreboardKey } from '../../redis-keys.js';
import { assertAnswerShape } from '../../types/answer.js';
import { assertPlayerShape } from '../../types/player.js';

export function createAnswerMethods(context) {
  const { client, codec, ttlSeconds, ttl, roomScopeKeys, sessionTokenIndexKeys, refreshTtl } = context;
  // ----------------------------------------------------------------------
  // Answer / action-cache / scoreboard — leeskant
  //
  // De schrijfkant van alle drie loopt via saveAcceptedAnswerAtomically (INTB2c,
  // onderaan dit bestand). Deze drie lezers hangen niet van dat script af: ze
  // lezen de sleutels uit redis-keys.js en de envelop uit documents.mjs, en die
  // lagen al vast voordat het script er was.
  // ----------------------------------------------------------------------

  /**
   * @param {string} roomId
   * @param {string} matchId
   * @param {string} roundId
   * @param {string} playerId
   */
  async function loadAnswer(roomId, matchId, roundId, playerId) {
    return codec.decode('answer', await client().hGet(answersKey(roomId, matchId, roundId), playerId));
  }

  /**
   * @param {string} roomId
   * @param {string} actionId
   */
  async function loadActionCacheEntry(roomId, actionId) {
    return codec.decode('action-cache-entry', await client().hGet(actionCacheKey(roomId), actionId));
  }

  /**
   * @param {string} roomId
   * @param {string} matchId
   * @param {number} limit
   */
  async function getScoreboardTop(roomId, matchId, limit) {
    // `slice(0, limit)` in de fake levert bij limit <= 0 een lege lijst; ZRANGE
    // met stop = -1 zou juist ALLES teruggeven. Zonder deze afhandeling is
    // `limit: 0` het verschil tussen "niets" en "het hele scoreboard".
    if (!Number.isFinite(limit) || limit < 1) return [];
    const rows = await client().zRangeWithScores(scoreboardKey(roomId, matchId), 0, Math.floor(limit) - 1, {
      REV: true,
    });
    return rows.map((row) => ({ playerId: row.value, score: row.score }));
  }

  // ----------------------------------------------------------------------
  // Fasewissel (DECISIONS #30) — INTB2d
  // ----------------------------------------------------------------------

  /**
   * Zet `Room.phase` en `Match.phase` samen op `newPhase`, of geen van beide.
   *
   * DECISIONS #30: `Match.phase` is autoritair, `Room.phase` is een AFGELEIDE
   * PROJECTIE die in DEZELFDE atomaire operatie meegaat. Twee documenten onder
   * twee sleutels in twee opdrachten bijwerken is het dual-write-pad dat #30
   * verbiedt: valt de verbinding ertussen weg, dan leest de rest van het
   * systeem een projectie die een andere fase noemt dan de autoriteit.
   *
   * WAT ER GEBEURT ALS DE UITVOERING WORDT ONDERBROKEN — lees dit voordat je
   * hier een rollback-verwachting aan toevoegt:
   *
   *   beide documenten zijn oud óf beide documenten zijn nieuw,
   *   nooit één oud en één nieuw.
   *
   * Dat is de garantie, en het is NIET "bij een netwerkfout blijft alles oud".
   * Een Lua-script draait server-side tot het einde door; valt de clientsocket
   * weg terwijl het loopt, dan landt de wissel gewoon en verdwijnt alleen het
   * antwoord. De aanroeper krijgt dan een verbindingsfout en weet niet welke
   * van de twee uitkomsten het werd. De enige manier om dat te weten is na een
   * reconnect de autoritatieve state opnieuw lezen (`loadMatch`). Redis kan
   * een geland script niet terugdraaien — een `assert` dat na een
   * netwerkonderbreking de oude fase eist, test iets dat geen enkele
   * Redis-implementatie kan waarmaken.
   *
   * IDEMPOTENT: dezelfde fase nog een keer zetten is geen fout, mits
   * `expectedPhase` die fase óók noemt. Het schrijft wél opnieuw, want een
   * fasewissel is activiteit en de TTL-refresh eromheen (`ttl.js`,
   * refreshmatrix bovenaan dit bestand) hoort dan ook te gebeuren.
   *
   * BEWUST NIET GEBOUWD: zelfherstel voor een projectie die uit de pas is
   * geraakt. Deze methode meldt een scheefstand (de dubbele compare-and-set
   * hieronder ziet hem en geeft `{ ok: false, actualPhase }`), maar repareert
   * hem niet stilzwijgend. Wil iemand `Match.phase` als bron gebruiken om een
   * afgedwaalde `Room.phase` terug te zetten, dan is dat een eigen poortmethode
   * met een eigen naam, geen verborgen bijwerking hier.
   *
   * DM19 (reactie op INT-16) heeft de signatuur verbreed; de drie uitbreidingen
   * staan in `repository.js` bij `PhaseTransition` en hier in dezelfde volgorde:
   *
   *   1. DUBBELE COMPARE-AND-SET op `expectedPhase`. Zowel `Room.phase` als
   *      `Match.phase` moeten hem dragen; dit vertrouwt niet stilzwijgend dat
   *      de twee al gelijk lopen. Een mismatch is een NORMALE uitkomst
   *      (`{ ok: false, actualPhase }`), net als een bezette locatorclaim —
   *      geen exception. `actualPhase` is altijd `Match.phase`, ook als de room
   *      de mismatch veroorzaakte: besluit 30 wijst dat veld als autoritair aan.
   *   2. `pausedState` gaat in DEZELFDE atomaire stap mee. Was vóór DM19 een
   *      losse `saveMatch` van de aanroeper — een dual-write-pad voor precies
   *      het veld dat besluit 30 in de geest meeneemt.
   *   3. De `pausedState`/`PAUSED`-invariant in BEIDE richtingen, als throw:
   *      een intern inconsistente aanvraag is nooit geldig, ongeacht wat er in
   *      de opslag staat. Daarom `RangeError` en geen `{ ok: false }`, en
   *      daarom vóór de eerste lees — er gaat geen enkele netwerkbeurt de deur
   *      uit voordat de aanvraag zichzelf tegenspreekt.
   *
   * @param {string} roomId
   * @param {string} matchId
   * @param {import('../../repository').PhaseTransition} transition - `newPhase`
   *   komt uit `server/architecture/state-machine.js`; de fasenamen worden hier
   *   niet opnieuw gevalideerd, de store slaat op wat hij krijgt.
   * @returns {Promise<{ ok: true } | { ok: false, actualPhase: string }>}
   */
  async function setRoomAndMatchPhaseAtomically(roomId, matchId, transition) {
    if (typeof transition !== 'object' || transition === null) {
      throw new TypeError(
        `setRoomAndMatchPhaseAtomically verwacht een PhaseTransition-object, kreeg: ${typeof transition}`
      );
    }
    const { expectedPhase, newPhase, pausedState } = transition;
    if (newPhase === 'PAUSED' && pausedState === null) {
      throw new RangeError('setRoomAndMatchPhaseAtomically: newPhase "PAUSED" vereist een niet-lege pausedState');
    }
    if (newPhase !== 'PAUSED' && pausedState !== null) {
      throw new RangeError(
        `setRoomAndMatchPhaseAtomically: pausedState moet null zijn buiten de fase "PAUSED" (newPhase was ${JSON.stringify(newPhase)})`
      );
    }

    const room = roomKey(roomId);
    const match = matchKey(roomId, matchId);

    for (let attempt = 1; attempt <= PHASE_SWAP_ATTEMPTS; attempt += 1) {
      // Lezen gebeurt buiten het script (zie SET_PHASE_LUA voor waarom), dus
      // deze twee GETs zijn de basis van een compare-and-set en geen
      // "kijken-en-dan-blind-schrijven". De onbewerkte strings gaan mee terug
      // naar Redis als verwachtingswaarde.
      const storedRoom = await client().get(room);
      if (storedRoom === null) {
        throw new RangeError(`setRoomAndMatchPhaseAtomically: unknown roomId ${JSON.stringify(roomId)}`);
      }
      const storedMatch = await client().get(match);
      if (storedMatch === null) {
        throw new RangeError(
          `setRoomAndMatchPhaseAtomically: unknown matchId ${JSON.stringify(matchId)} for roomId ${JSON.stringify(roomId)}`
        );
      }

      const decodedRoom = /** @type {{phase: string}} */ (codec.decode('room', storedRoom));
      const decodedMatch = /** @type {{phase: string}} */ (codec.decode('match', storedMatch));
      // De inhoudelijke compare-and-set (DM19). Hij staat hier en niet in Lua om
      // dezelfde reden als de rest van het JSON-werk: het script ziet enveloppen,
      // geen fasen. Het RAAK-venster tussen deze controle en de schrijf wordt
      // hieronder gedekt door de tekstuele vergelijking ín het script — die is
      // strenger dan een fasevergelijking en vangt dus ook een tussentijdse
      // wijziging aan een heel ander veld.
      if (decodedRoom.phase !== expectedPhase || decodedMatch.phase !== expectedPhase) {
        return { ok: false, actualPhase: decodedMatch.phase };
      }

      const outcome = await client().eval(SET_PHASE_LUA, {
        keys: [
          room,
          match,
          ...roomScopeKeys(roomId),
          scoreboardKey(roomId, matchId),
          ...(await sessionTokenIndexKeys(roomId)),
        ],
        arguments: [
          storedRoom,
          storedMatch,
          codec.encode('room', { ...decodedRoom, phase: newPhase }),
          codec.encode('match', { ...decodedMatch, phase: newPhase, pausedState }),
          ttl,
        ],
      });

      if (outcome === 'ok') return { ok: true };
      // De twee bestaanscontroles zitten óók in het script: tussen de GET
      // hierboven en de EVAL past het verlopen of verwijderen van een sleutel,
      // en dan is "hij bestond net nog" geen grond om te schrijven.
      if (outcome === 'no-room') {
        throw new RangeError(`setRoomAndMatchPhaseAtomically: unknown roomId ${JSON.stringify(roomId)}`);
      }
      if (outcome === 'no-match') {
        throw new RangeError(
          `setRoomAndMatchPhaseAtomically: unknown matchId ${JSON.stringify(matchId)} for roomId ${JSON.stringify(roomId)}`
        );
      }
      if (outcome !== 'stale') {
        throw new Error(`setRoomAndMatchPhaseAtomically: onverwacht scriptresultaat ${JSON.stringify(outcome)}`);
      }
      // 'stale': iemand anders schreef Room of Match tussen de lees en het
      // script. Er is niets geschreven; opnieuw lezen en opnieuw proberen — en
      // dan kan de uitkomst alsnog `{ ok: false, actualPhase }` worden, want de
      // fase kan intussen echt verzet zijn.
    }

    throw new Error(
      `setRoomAndMatchPhaseAtomically: room ${JSON.stringify(roomId)} of match ${JSON.stringify(matchId)} werd ` +
        `${PHASE_SWAP_ATTEMPTS} pogingen achter elkaar onder de operatie vandaan geschreven; er is niets gewijzigd.`
    );
  }

  // ----------------------------------------------------------------------
  // Atomaire antwoordverwerking (DECISIONS #23) — INTB2c
  // ----------------------------------------------------------------------

  /**
   * Weet Redis het script nog? Start op `false`: de eerste aanroep gebruikt
   * `EVAL` (dat laadt het script meteen) in plaats van een `EVALSHA` die
   * gegarandeerd `NOSCRIPT` oplevert. Daarna gaat het via de hash.
   */
  let scriptKnownToRedis = false;

  /**
   * Voert `SAVE_ANSWER_LUA` uit VIA ZIJN HASH, met terugval op volledig laden.
   *
   * Waarom via de hash: het script gaat bij elke inzending over de lijn, en dat
   * zijn er in een potje van twintig spelers en tien rondes tweehonderd. Een
   * `EVALSHA` stuurt veertig bytes in plaats van het hele script.
   *
   * WAT ER NA EEN REDIS-HERSTART GEBEURT — dit is de reden dat de terugval
   * bestaat en niet een `SCRIPT LOAD` bij het opstarten van de adapter: de
   * scriptcache van Redis is niet persistent en overleeft geen herstart, geen
   * `SCRIPT FLUSH` en geen failover naar een replica. Eén keer laden bij het
   * opstarten zou dus werken tot de eerste herstart en daarna elke inzending
   * laten falen. In plaats daarvan: `EVALSHA`, en zodra Redis `NOSCRIPT`
   * antwoordt (precies dan, niet bij elke fout) gaat dezelfde aanroep alsnog via
   * `EVAL`, wat het script opnieuw in de cache zet. De aanroeper merkt niets;
   * het kost één extra netwerkbeurt, één keer per herstart.
   *
   * `EVAL` is bovendien niet minder atomair dan `EVALSHA` — het is dezelfde
   * server-side uitvoering — dus de terugval verzwakt geen enkele garantie.
   * @param {{ keys: string[], arguments: string[] }} options
   */
  async function evalSaveAnswer(options) {
    if (scriptKnownToRedis) {
      try {
        return await client().evalSha(SAVE_ANSWER_LUA_SHA, options);
      } catch (error) {
        if (!isNoScriptError(error)) throw error;
        scriptKnownToRedis = false;
      }
    }
    const outcome = await client().eval(SAVE_ANSWER_LUA, options);
    scriptKnownToRedis = true;
    return outcome;
  }

  /**
   * Schrijft een geaccepteerd antwoord, de bijgewerkte speler, het scoreboard en
   * de ack in ÉÉN ondeelbare stap — of niets van dat alles.
   *
   * HET FOUTCONTRACT STAAT IN `repository.js` (§FOUTCONTRACT bij
   * `AcceptedAnswerWrite`) en wordt hier niet opnieuw uitgevonden:
   *   * `actionId` staat al in de action-cache van deze room -> `{ replay: true }`,
   *     GEEN mutatie en geen ack in de returnwaarde (de aanroeper haalt die
   *     desgewenst met `loadActionCacheEntry`);
   *   * anders, en er bestaat al een `Answer` voor deze `roundId` + `playerId`
   *     -> `RangeError` met `.code === 'ALREADY_ANSWERED'`;
   *   * anders, geslaagde nieuwe write -> `{ replay: false }`;
   *   * onbekende `updatedPlayer.id` -> `RangeError`.
   *
   * TWEE KANALEN, BEWUST: een replay komt terug als RETURNWAARDE, een afgewezen
   * duplicaat als THROW. Ze plat slaan tot één uitkomst zou de protocol-adapter
   * dwingen te raden of hij een ack mag versturen — en een replay ná de deadline
   * is juist het geval waarvoor INT-14 dit contract heeft vastgelegd.
   *
   * WAT ER GEBEURT ALS DE UITVOERING WORDT ONDERBROKEN: hetzelfde als bij
   * `setRoomAndMatchPhaseAtomically`, en het is geen rollback. Een Lua-script
   * draait server-side tot het einde door; valt de clientsocket weg terwijl het
   * loopt, dan landen alle vier de writes gewoon en verdwijnt alleen het
   * antwoord. De garantie is "alle vier of geen van vier", niet "bij een
   * netwerkfout is er niets gebeurd". De aanroeper die een verbindingsfout krijgt
   * weet niet welke van die twee het werd — en hoeft dat ook niet te weten: hij
   * probeert het opnieuw met DEZELFDE `actionId`, en dan is het antwoord een
   * replay als de eerste poging geland was, en een gewone write als dat niet zo
   * was. Dat is precies waar de idempotentiecontrole voor bestaat.
   *
   * DE VORMCONTROLES STAAN VOORAAN, vóór de atomaire operatie, net als bij
   * `saveRoom` en familie: een `Answer` of `Player` die `server/data/types/`
   * afkeurt hoort niet als half document in Redis te belanden. Gevolg, expliciet
   * genoemd omdat het een verschil met de fake is: een REPLAY met een
   * onhoudbare payload werpt hier `TypeError`/`RangeError` waar de fake
   * `{ replay: true }` zou teruggeven. Beide zijn een programmeerfout van de
   * aanroeper, en de vormcontrole vroeg laten afgaan is de nuttigere melding.
   *
   * @param {string} roomId
   * @param {string} matchId
   * @param {import('../../repository').AcceptedAnswerWrite} write
   * @returns {Promise<{ replay: boolean }>}
   */
  async function saveAcceptedAnswerAtomically(roomId, matchId, write) {
    if (typeof write !== 'object' || write === null) {
      throw new TypeError(`saveAcceptedAnswerAtomically verwacht een AcceptedAnswerWrite, kreeg: ${typeof write}`);
    }
    const { answer, updatedPlayer, actionCacheEntry } = write;
    assertAnswerShape(answer);
    if (typeof actionCacheEntry?.actionId !== 'string' || actionCacheEntry.actionId.length === 0) {
      throw new TypeError(
        `saveAcceptedAnswerAtomically: actionCacheEntry.actionId moet een niet-lege string zijn, kreeg: ${JSON.stringify(actionCacheEntry?.actionId)}`
      );
    }
    if (typeof updatedPlayer?.id !== 'string' || updatedPlayer.id.length === 0) {
      throw new TypeError(
        `saveAcceptedAnswerAtomically: updatedPlayer.id moet een niet-lege string zijn, kreeg: ${JSON.stringify(updatedPlayer?.id)}`
      );
    }

    const players = roomPlayersKey(roomId);
    const answers = answersKey(roomId, matchId, answer.roundId);
    const scoreboard = scoreboardKey(roomId, matchId);
    const actionCache = actionCacheKey(roomId);
    const encodedAnswer = codec.encode('answer', answer);
    const encodedAck = codec.encode('action-cache-entry', actionCacheEntry);
    // Eén keer, vóór de retry-lus: de sessies van een room veranderen niet door
    // een inzending, en dit is het heetste pad van de adapter.
    const tokenKeys = await sessionTokenIndexKeys(roomId);

    for (let attempt = 1; attempt <= ANSWER_WRITE_ATTEMPTS; attempt += 1) {
      // De lees die het compare-and-set-venster opent (zie SAVE_ANSWER_LUA voor
      // waarom het lezen niet in het script kan). De ONBEWERKTE string gaat mee
      // terug naar Redis als verwachtingswaarde — vergelijken op de gedecodeerde
      // vorm zou een herserialisatie vergen en dan vergelijk je de codec met
      // zichzelf in plaats van de opslag met wat je gelezen hebt.
      const storedPlayer = (await client().hGet(players, updatedPlayer.id)) ?? null;
      // Bestaat de speler niet, dan gaan we tóch het script in met een lege
      // verwachting: de idempotentiecontrole staat vóór de spelercontrole, dus
      // een replay hoort óók een replay te zijn als de speler intussen weg is.
      // Een leesuitslag vooraf omzetten in een RangeError zou dat geval
      // stilzwijgend tot een fout maken.
      let newPlayer = '';
      if (storedPlayer !== null) {
        // ABSOLUTE waarden, geen delta: de aanroeper heeft `player.score +
        // points` al uitgerekend (repository.js §AcceptedAnswerWrite). Alleen
        // deze drie velden gaan mee; naam, team, verbindingsstatus en
        // eligibleFromRound van het opgeslagen document blijven staan.
        const merged = {
          .../** @type {object} */ (codec.decode('player', storedPlayer)),
          score: updatedPlayer.score,
          correctCount: updatedPlayer.correctCount,
          correctResponseTimeMsTotal: updatedPlayer.correctResponseTimeMsTotal,
        };
        assertPlayerShape(merged);
        newPlayer = codec.encode('player', merged);
      }

      const outcome = await evalSaveAnswer({
        keys: [
          actionCache,
          players,
          answers,
          scoreboard,
          // Vanaf hier: de TTL-refresh. De room-scope (elke schrijfactie is
          // activiteit) plus de match-gescopeerde sleutels die deze operatie
          // zelf aanraakt. `players` en `actionCache` zitten al in de room-scope.
          ...roomScopeKeys(roomId),
          matchKey(roomId, matchId),
          scoreboard,
          answers,
          ...tokenKeys,
        ],
        arguments: [
          actionCacheEntry.actionId,
          encodedAck,
          updatedPlayer.id,
          storedPlayer ?? '',
          newPlayer,
          answer.playerId,
          encodedAnswer,
          String(updatedPlayer.score),
          ttl,
          // Besluit 54: '1' laat het script het vorige antwoord overschrijven.
          // De compositielaag zet `correctie` alleen wanneer ze zélf een
          // bestaand antwoord heeft gelezen en de boekhouding heeft
          // teruggedraaid — zonder die vlag blijft de oude bewaking staan.
          write.correctie === true ? '1' : '0',
        ],
      });

      if (outcome === 'ok') return { replay: false };
      if (outcome === 'replay') return { replay: true };
      if (outcome === 'no-player') {
        throw new RangeError(
          `saveAcceptedAnswerAtomically: unknown playerId ${JSON.stringify(updatedPlayer.id)} for roomId ${JSON.stringify(roomId)}`
        );
      }
      if (outcome === 'already-answered') {
        throw Object.assign(
          new RangeError(
            `saveAcceptedAnswerAtomically: player ${JSON.stringify(answer.playerId)} already has an answer for round ${JSON.stringify(answer.roundId)}`
          ),
          { code: 'ALREADY_ANSWERED' }
        );
      }
      if (outcome !== 'stale') {
        throw new Error(`saveAcceptedAnswerAtomically: onverwacht scriptresultaat ${JSON.stringify(outcome)}`);
      }
      // 'stale': het spelerdocument is tussen de lees en het script veranderd.
      // Er is NIETS geschreven — opnieuw lezen en opnieuw proberen, zodat de
      // absolute waarden van deze inzending bovenop de nieuwste versie landen in
      // plaats van die versie weg te schrijven.
    }

    throw new Error(
      `saveAcceptedAnswerAtomically: speler ${JSON.stringify(updatedPlayer.id)} in room ${JSON.stringify(roomId)} werd ` +
        `${ANSWER_WRITE_ATTEMPTS} pogingen achter elkaar onder de operatie vandaan geschreven; er is niets gewijzigd.`
    );
  }


  return { loadAnswer, loadActionCacheEntry, getScoreboardTop, setRoomAndMatchPhaseAtomically, saveAcceptedAnswerAtomically, };
}

