// transport-mock.mjs — UI0.
//
// TIJDELIJKE, in-memory stand-in voor de echte `Transport` (INT-A, stap 2).
// Dit is GEEN tweede protocolimplementatie: bij twijfel over een
// responsvorm is `docs/multiplayer/PROTOCOL.md` leidend, niet wat hier het
// handigst mockt. Alles hieronder draait single-process, in het geheugen van
// één browsertab (of één Node-proces bij handmatig testen) — er is geen
// netwerk, geen persistentie, en dus ook geen ondersteuning voor het
// twee-browsertabs-scenario uit UI1a's Definition of Done (dat vereist de
// echte transportlaag, zie UI-PROGRESS.md).
//
// Wat dit wél biedt, genoeg om UI1–UI5 lokaal te kunnen doorklikken:
//   - één room in geheugen per `createMockTransport()`-instantie;
//   - een vaste, korte `flags_mc`-vraagreeks opgebouwd uit `getCountryPool()`;
//   - een fake "socket" — een interne callback-lijst per sessie, geen
//     WebSocket — die bij elke serverfase-overgang een event afvuurt
//     (LOBBY -> COUNTDOWN -> ROUND_ACTIVE -> ROUND_RESULT -> SCOREBOARD ->
//     ... -> FINISHED), op dezelfde envelope-vorm als PROTOCOL.md beschrijft.
//
// Bewuste keuzes die UI0-scaffold.md niet dicteert (zie ook het eindrapport):
//   - de vraagreeks is vast (niet willekeurig) en kort (5 rondes, niet de
//     10 van FLAGS_MC_QUICK_START_DEFAULT) zodat een handmatige doorloop
//     snel is; `config.totalRounds` van de aanroeper wordt genegeerd;
//   - rondetijden zijn kort (enkele seconden) om hetzelfde doel te dienen —
//     dit is geen uitspraak over de echte serverpacing;
//   - dit bestand importeert bewust NIET uit `client/flow/`: die modules
//     interpreteren serverevents vanuit het perspectief van de client, terwijl
//     deze mock zelf de server-kant van het protocol naspeelt (legaliteit van
//     acties, faseovergangen). Alleen `shared/content` en `shared/product`
//     worden hergebruikt, zoals het voorbeeld in de opdracht ook aangeeft.

// Relatief vanaf `/js/transport-mock.mjs` komt dit bij de door INT-A
// vastgelegde `/shared/*`-mapping uit. Een relatief modulespecifier blijft
// bovendien rechtstreeks onder `node:test` bruikbaar.
import { CONTENT_VERSION, getCountryPool } from '../../shared/content/index.mjs';
import { isPlayableGameType } from '../../shared/content/game-catalog.mjs';
import { rankPlayers as rankByRules } from '../../shared/rules/ranking.mjs';
import { generateFlagSpec } from '../../shared/content/flag-spec.mjs';

const RENDERER_VERSION = 'flag-renderer-1'; // zelfde placeholder-waarde als PROTOCOL.md's voorbeelden.
const DEFAULT_GAME_TYPE = 'flags_mc';
const MAX_PLAYERS = 100;
const QUESTION_COUNT = 5;
const NAME_MAX_GRAPHEMES = 20;

// `joinSource` enum uit PROTOCOL.md, §`POST /api/v1/games/join`.
const JOIN_SOURCES = new Set(['qr', 'shared_link', 'code', 'unknown']);

// Rondetiming — kort gehouden voor handmatig doorklikken, zie bovenstaande
// documentatie. Geen protocolvereiste.
const COUNTDOWN_MS = 1200;
const ROUND_ACTIVE_MS = 8000;
const ROUND_RESULT_MS = 2500;
const SCOREBOARD_AUTO_ADVANCE_MS = 2500;

// Simuleert een niet-triviale klokafwijking, zodat `fetchServerTime()` +
// `estimateServerOffset()` ook in de mock iets zinnigs meten in plaats van
// altijd exact 0.
const SIMULATED_SERVER_SKEW_MS = 400;

// Fase 4 (autoReveal, besluit 51): dezelfde coulance als besluit 13's
// `deadlineGraceMs` voor de host-tik op "Toon antwoord" (zie `revealAnswer`).
// De host ziet die knop verschijnen op basis van ZIJN eigen klokschatting
// (`estimateServerOffset()`, die hier per definitie ~`SIMULATED_SERVER_SKEW_MS`
// afwijkt) — zonder marge zou een tik op het exacte moment dat de knop
// verschijnt hier stelselmatig te vroeg zijn. Ruim boven de skew, niet gelijk
// eraan: `estimateServerOffset` middelt drie metingen en kan er dus nog naast
// zitten.
const REVEAL_DEADLINE_GRACE_MS = 600;

const NAME_ADJECTIVES = ['Vlugge', 'Slimme', 'Dappere', 'Rustige', 'Gouden', 'Wakkere'];
const NAME_NOUNS = ['Vos', 'Uil', 'Leeuw', 'Reiger', 'Das', 'Havik'];

// Zelfde patroon als client/flow/join-state.mjs en
// client/flow/host-setup-state.mjs: telt grapheme clusters, niet UTF-16 code
// units, zodat een emoji of combining character nooit doormidden wordt geknipt.
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

class ProtocolError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.name = 'ProtocolError';
    this.code = code;
  }
}

/**
 * Bouwt een nieuwe, onafhankelijke mock-`Transport`. Elke aanroep krijgt zijn
 * eigen room in geheugen (geen module-globale state) — precies genoeg om
 * `createGame` -> `previewInvite` -> `joinGame` -> ... binnen één pagina/
 * proces te doorlopen.
 *
 * `restoreState`/`onStateChange` (ronde 3 fase 3, "solo overleeft reload"):
 * bewust GEEN eigen opslag hier — deze module weet niets van `sessionStorage`
 * en blijft zo bruikbaar in `node:test` zonder DOM. De aanroeper (`app.mjs`)
 * bepaalt waar een snapshot heen gaat; deze functie levert alleen het
 * serialiseerbare contract (`serializeRoomState`/`deserializeRoomState`
 * hieronder) en roept `onStateChange` aan na elke gebeurtenis die een
 * verbonden sessie ook daadwerkelijk te zien krijgt (`emit`) — dezelfde
 * momenten waarop er voor een echte speler iets verandert.
 *
 * @param {{ restoreState?: object | null, onStateChange?: (state: object) => void }} [options]
 * @returns {import('./transport.mjs').Transport}
 */
export function createMockTransport({ restoreState, onStateChange } = {}) {
  /** @type {Room | null} */
  let room = restoreState != null ? deserializeRoomState(restoreState) : null;
  if (room !== null) {
    rearmTimer(room);
  }

  return {
    createGame,
    previewInvite,
    joinGame,
    fetchState,
    leaveGame,
    fetchServerTime,
    connect,
  };

  /**
   * Zet, na herstel, precies één timer weer aan: die van de fase waarin de
   * room stond toen hij werd opgeslagen. `target.phaseDeadline` ligt door het
   * verstrijken van de tijd tussen opslaan en herstellen soms al in het
   * verleden (bv. de pagina lag een minuut stil middenin een ronde) —
   * `scheduleTimer` klemt een negatieve vertraging toch al af naar 0, dus dat
   * lost de overgang meteen in plaats van nooit op. Zelfde aanpak als
   * `resumeGame` hierboven na een `game:pause`/`game:resume`, alleen dan voor
   * een hele paginalaad in plaats van een expliciete hostactie.
   */
  function rearmTimer(target) {
    if (target.phaseDeadline === null) {
      return;
    }
    const remaining = Math.max(0, target.phaseDeadline - Date.now());
    switch (target.phase) {
      case 'COUNTDOWN':
        scheduleTimer(target, remaining, () => startRound(target, 0));
        break;
      case 'ROUND_ACTIVE':
        // Fase 4 (autoReveal): zelfde voorwaarde als in `startRound` — een
        // reload mag geen timer aanzetten die de compositie zelf ook niet
        // zou hebben gepland.
        if (target.config.autoReveal !== false) {
          scheduleTimer(target, remaining, () => endRound(target, target.roundIndex));
        }
        break;
      case 'ROUND_RESULT':
        scheduleTimer(target, remaining, () => showScoreboard(target));
        break;
      case 'SCOREBOARD':
        if (target.pacing === 'auto') {
          scheduleTimer(target, remaining, () => advanceFromScoreboard(target));
        }
        break;
      default:
        break; // LOBBY/PAUSED/FINISHED plannen zelf niets.
    }
  }

  function persist() {
    if (room !== null && typeof onStateChange === 'function') {
      onStateChange(serializeRoomState(room));
    }
  }

  // ---- REST-achtige functies -------------------------------------------

  // Correctie 1 (transport-contract-response.md): het argument is het hele
  // POST /api/v1/games-verzoek ({ config, hostParticipates, displayName }),
  // niet alleen de roomconfig -- was intern al zo geïmplementeerd, alleen de
  // parameternaam/JSDoc hieronder zijn nu in lijn gebracht met het contract.
  async function createGame(request) {
    const safeRequest = request !== null && typeof request === 'object' ? request : {};
    const hostParticipates = safeRequest.hostParticipates !== false;
    const requestedDisplayName = normalizeDisplayName(safeRequest.displayName);

    room = buildRoom(safeRequest.config);

    const sessionToken = randomToken();
    const roles = hostParticipates ? ['host', 'player'] : ['host'];
    let playerId = null;
    let effectiveName = null;

    if (hostParticipates) {
      playerId = randomId('p');
      effectiveName = finalizeName(requestedDisplayName);
      addPlayer(room, playerId, effectiveName);
    }

    room.sessions.set(sessionToken, { roles, playerId, actionCache: new Map() });

    return {
      roomId: room.roomId,
      gameCode: room.gameCode,
      inviteId: room.inviteId,
      joinUrl: room.joinUrl,
      sessionToken,
      roles,
      playerId,
      effectiveName,
      state: buildSnapshot(room, sessionToken),
    };
  }

  async function previewInvite(inviteId) {
    if (typeof inviteId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(inviteId)) {
      throw new ProtocolError('INVITE_INVALID', `Malformed inviteId: ${String(inviteId)}`);
    }
    if (room === null || room.inviteId !== inviteId) {
      throw new ProtocolError('GAME_NOT_FOUND', 'No room for this inviteId.');
    }

    return {
      roomId: room.roomId,
      suggestedName: generateSuggestedName(),
      phase: room.phase,
      locked: room.locked,
      allowLateJoin: room.allowLateJoin,
      playerCount: countActivePlayers(room),
      maxPlayers: MAX_PLAYERS,
    };
  }

  async function joinGame(request) {
    const safeRequest = request !== null && typeof request === 'object' ? request : {};
    validateJoinRequest(safeRequest);
    const target = resolveRoomLocator(safeRequest);
    if (target === null) {
      throw new ProtocolError('GAME_NOT_FOUND', 'No room for this inviteId/gameCode.');
    }
    if (target.locked) {
      throw new ProtocolError('ROOM_LOCKED', 'Room is locked.');
    }
    if (countActivePlayers(target) >= MAX_PLAYERS) {
      throw new ProtocolError('GAME_FULL', 'Room is full.');
    }
    if (target.phase !== 'LOBBY' && !target.allowLateJoin) {
      throw new ProtocolError('LATE_JOIN_DISABLED', 'Game already started, late join disabled.');
    }

    const playerId = randomId('p');
    const effectiveName = finalizeName(normalizeDisplayName(safeRequest.displayName), target);
    addPlayer(target, playerId, effectiveName);

    const sessionToken = randomToken();
    target.sessions.set(sessionToken, { roles: ['player'], playerId, actionCache: new Map() });

    broadcast(target, 'room:player-changed', {
      playerCount: countActivePlayers(target),
      delta: { type: 'join', playerId, effectiveName, color: target.players.get(playerId)?.color },
    });

    return {
      roomId: target.roomId,
      gameCode: target.gameCode,
      sessionToken,
      roles: ['player'],
      playerId,
      effectiveName,
      state: buildSnapshot(target, sessionToken),
    };
  }

  async function fetchState(code, sessionToken) {
    const { targetRoom, session } = requireSession(code, sessionToken);
    return buildSnapshot(targetRoom, sessionToken, session);
  }

  async function leaveGame(code, sessionToken) {
    const { targetRoom, session } = requireSession(code, sessionToken);
    if (!session.roles.includes('player') || session.playerId === null) {
      throw new ProtocolError('NOT_PLAYER', 'Session has no player role to leave with.');
    }
    const player = targetRoom.players.get(session.playerId);
    if (player !== undefined) {
      player.active = false;
    }
    broadcast(targetRoom, 'room:player-changed', {
      playerCount: countActivePlayers(targetRoom),
      delta: { type: 'leave', playerId: session.playerId },
    });
  }

  async function fetchServerTime() {
    return { serverTime: Date.now() + SIMULATED_SERVER_SKEW_MS };
  }

  // ---- Fake "socket" ------------------------------------------------------

  // Correctie 2 (transport-contract-response.md): `connect` neemt nu een
  // `handlers`-object (`onEvent` + `onStatus`) i.p.v. kaal `onEvent`.
  // `reconnect-state.mjs` heeft `onStatus` nodig om connecting/connected/
  // disconnected te kunnen tonen. Dit is een single-process mock zonder echt
  // netwerk om te laten falen, dus er is geen backoff te simuleren — wél de
  // normale status-overgangen bij verbinden/sluiten, synchroon genoeg om
  // `reconnect-state`'s conventie (dispatch eerst, vraag dan pas iets op) te
  // kunnen testen.
  function connect(sessionToken, handlers) {
    const safeHandlers = handlers !== null && typeof handlers === 'object' ? handlers : {};
    const onEvent = typeof safeHandlers.onEvent === 'function' ? safeHandlers.onEvent : () => {};
    const onStatus = typeof safeHandlers.onStatus === 'function' ? safeHandlers.onStatus : () => {};

    if (room === null || !room.sessions.has(sessionToken)) {
      // Geen geldige sessie om aan te koppelen: lever een inert paar functies
      // terug in plaats van te gooien — `connect()` zelf is synchroon en
      // heeft in het echte contract geen foutpad; elke `send()` op deze
      // connectie faalt alsnog met TOKEN_INVALID.
      onStatus('disconnected');
      return {
        send: async () => {
          throw new ProtocolError('TOKEN_INVALID', 'connect() called with an unknown sessionToken.');
        },
        close() {},
      };
    }

    onStatus('connecting');

    const listener = { onEvent };
    room.listeners.set(sessionToken, listener);

    // Zelfde gewoonte als een reconnect (PROTOCOL.md §Reconnect, punt 5): de
    // net verbonden sessie krijgt meteen een volledige snapshot, in plaats
    // van te wachten op de eerstvolgende faseovergang.
    queueMicrotask(() => {
      if (room !== null && room.listeners.get(sessionToken) === listener) {
        onStatus('connected');
        emit(listener, 'room:state', buildSnapshot(room, sessionToken));
      }
    });

    return {
      send: (event, actionId, payload) => handleSend(sessionToken, event, actionId, payload),
      close() {
        if (room !== null) {
          room.listeners.delete(sessionToken);
        }
        onStatus('disconnected');
      },
    };
  }

  async function handleSend(sessionToken, event, actionId, payload) {
    if (room === null) {
      throw new ProtocolError('GAME_NOT_FOUND', 'No room exists.');
    }
    const session = room.sessions.get(sessionToken);
    if (session === undefined) {
      throw new ProtocolError('TOKEN_INVALID', 'Unknown sessionToken.');
    }

    // PROTOCOL.md basisregel 5 + §Event-envelope "Ack": een retry met
    // dezelfde `actionId` retourneert dezelfde logische ack (of dezelfde
    // fout) zonder de mutatie opnieuw uit te voeren. Idempotentie is
    // gekoppeld aan een matchende `actionId`, niet aan payload-gelijkheid —
    // een nieuwe `actionId` met dezelfde inhoud voert de handler gewoon
    // opnieuw uit (en kan dus terecht op bv. ALREADY_ANSWERED stuiten).
    const cacheKey = typeof actionId === 'string' && actionId.length > 0 ? actionId : null;
    if (cacheKey !== null) {
      const cached = session.actionCache.get(cacheKey);
      if (cached !== undefined) {
        if (cached.ok) {
          return cached.ack;
        }
        throw cached.error;
      }
    }

    try {
      const ack = await runAction();
      if (cacheKey !== null) {
        session.actionCache.set(cacheKey, { ok: true, ack });
      }
      return ack;
    } catch (error) {
      if (cacheKey !== null) {
        session.actionCache.set(cacheKey, { ok: false, error });
      }
      throw error;
    }

    async function runAction() {
      const safePayload = payload !== null && typeof payload === 'object' ? payload : {};
      const isHost = session.roles.includes('host');
      const isPlayer = session.roles.includes('player') && session.playerId !== null;

      switch (event) {
        case 'game:start':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(startGame(room));

        case 'game:pause':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(pauseGame(room, safePayload));

        case 'game:resume':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(resumeGame(room));

        case 'game:next':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(advanceOnHostCue(room));

        case 'game:reveal':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(revealAnswer(room));

        case 'game:lock':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(setLocked(room, safePayload.locked === true));

        case 'game:kick':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(kickPlayer(room, safePayload.playerId));

        case 'game:finish':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(finishGame(room));

        case 'game:rematch':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(rematch(room));

        case 'player:rename':
          requireRole(isPlayer, 'NOT_PLAYER');
          return ackWith(renamePlayer(room, session.playerId, safePayload.displayName));

        case 'player:recolor':
          requireRole(isPlayer, 'NOT_PLAYER');
          return ackWith(recolorPlayer(room, session.playerId, safePayload.color));

        case 'game:update-config':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(updateRoomConfig(room, safePayload));

        case 'player:leave':
          requireRole(isPlayer, 'NOT_PLAYER');
          await leaveGame(room.gameCode, sessionToken);
          return ackWith({});

        case 'round:answer':
          requireRole(isPlayer, 'NOT_PLAYER');
          return ackWith(submitAnswer(room, session.playerId, safePayload));

        case 'share:opened':
          // Analytics-only, mag falen zonder UX-effect (PROTOCOL.md) — hier
          // altijd een no-op succes.
          return ackWith({});

        default:
          throw new ProtocolError('UNSUPPORTED_EVENT', `Unknown client event: ${String(event)}`);
      }

      function ackWith(resultPayload) {
        return { actionId, ok: true, serverTime: Date.now(), payload: resultPayload ?? {} };
      }
    }
  }

  // ---- Room-opbouw en helpers ---------------------------------------------

  function buildRoom(config) {
    const safeRoomConfig = config !== null && typeof config === 'object' ? config : {};
    const gameCode = randomGameCode();
    const inviteId = randomInviteId();
    return {
      roomId: randomId('room'),
      gameCode,
      inviteId,
      joinUrl: buildJoinUrl(inviteId),
      phase: 'LOBBY',
      locked: false,
      allowLateJoin: safeRoomConfig.allowLateJoin !== false,
      pacing: safeRoomConfig.pacing === 'host' ? 'host' : 'auto',
      config: safeRoomConfig,
      matchId: randomId('match'),
      matchSequence: 1,
      pausedState: null,
      players: new Map(),
      sessions: new Map(),
      listeners: new Map(),
      gameType: resolveGameType(safeRoomConfig),
      questions: buildQuestionSequence(resolveGameType(safeRoomConfig)),
      roundIndex: -1,
      currentRound: null,
      pendingTimers: new Set(),
      // Wanneer de huidige fase vanzelf overgaat naar de volgende (zie de
      // scheduleTimer-aanroepen hieronder) — of `null` als de fase op een
      // expliciete actie wacht (LOBBY, PAUSED, SCOREBOARD met pacing 'host',
      // FINISHED). Bestaat naast de setTimeout-handle zelf omdat die laatste
      // een reload niet overleeft, maar dit getal (na herstel opnieuw tegen
      // `Date.now()` afgezet) wel — zie `deserializeRoomState`/`rearmTimer`.
      phaseDeadline: null,
    };
  }

  function resolveRoomLocator(request) {
    if (room === null) {
      return null;
    }
    if (typeof request.inviteId === 'string' && request.inviteId === room.inviteId) {
      return room;
    }
    if (typeof request.gameCode === 'string' && request.gameCode === room.gameCode) {
      return room;
    }
    return null;
  }

  function requireSession(code, sessionToken) {
    if (room === null || room.gameCode !== code) {
      throw new ProtocolError('GAME_NOT_FOUND', 'No room for this code.');
    }
    const session = room.sessions.get(sessionToken);
    if (session === undefined) {
      throw new ProtocolError('TOKEN_INVALID', 'Unknown sessionToken.');
    }
    return { targetRoom: room, session };
  }

  function requireRole(hasRole, code) {
    if (!hasRole) {
      throw new ProtocolError(code, `Action not permitted for this session (${code}).`);
    }
  }

  // ---- Rondelogica ----------------------------------------------------------

  function startGame(target) {
    if (target.phase !== 'LOBBY') {
      throw new ProtocolError('INVALID_PHASE', 'game:start requires phase LOBBY.');
    }
    if (countActivePlayers(target) < 1) {
      throw new ProtocolError('INVALID_PHASE', 'game:start requires at least one player.');
    }

    target.phase = 'COUNTDOWN';
    const countdownEndsAt = Date.now() + COUNTDOWN_MS;
    target.phaseDeadline = countdownEndsAt;
    broadcast(target, 'game:started', {
      matchId: target.matchId,
      totalRounds: target.questions.length,
      countdownEndsAt,
    });

    scheduleTimer(target, COUNTDOWN_MS, () => startRound(target, 0));
    return {};
  }

  function startRound(target, index) {
    if (target.phase === 'FINISHED') {
      return;
    }
    const question = target.questions[index];
    if (question === undefined) {
      return finishGame(target);
    }

    target.roundIndex = index;
    for (const player of target.players.values()) {
      player.answeredCurrentRound = false;
    }

    const startsAt = Date.now() + 250;
    const endsAt = startsAt + ROUND_ACTIVE_MS;
    target.currentRound = {
      roundId: `round_${String(index + 1).padStart(2, '0')}`,
      roundNumber: index + 1,
      totalRounds: target.questions.length,
      question,
      startsAt,
      endsAt,
      answers: new Map(),
    };
    target.phase = 'ROUND_ACTIVE';
    target.phaseDeadline = endsAt;

    broadcast(target, 'round:started', {
      matchId: target.matchId,
      roundId: target.currentRound.roundId,
      roundNumber: target.currentRound.roundNumber,
      totalRounds: target.currentRound.totalRounds,
      gameType: target.gameType,
      contentVersion: CONTENT_VERSION,
      rendererVersion: RENDERER_VERSION,
      question: question.payload,
      startsAt,
      endsAt,
    });

    // Fase 4 (autoReveal, besluit 51): staat autoReveal uit, dan plant de
    // mock — net als de echte server — GEEN automatisch ronde-einde. De ronde
    // blijft ROUND_ACTIVE voorbij de deadline; `submitAnswer` sluit al af op
    // `endsAt` (zie daar), en `game:reveal` roept `endRound` rechtstreeks aan.
    if (target.config.autoReveal !== false) {
      scheduleTimer(target, endsAt - Date.now(), () => endRound(target, index));
    }
  }

  function submitAnswer(target, playerId, payload) {
    if (target.phase !== 'ROUND_ACTIVE' || target.currentRound === null) {
      throw new ProtocolError('ROUND_NOT_ACTIVE', 'No active round to answer.');
    }
    // Fase 4 (autoReveal, besluit 51): zonder deze toets bleef een ronde met
    // autoReveal uit onbeperkt open voor antwoorden — vóór deze fase viel dat
    // nooit op, want de timer sloot de ronde toch al af rond `endsAt`. Zelfde
    // grens als de echte server zijn deadline+grace-toets (besluit 13); deze
    // mock kent geen aparte grace-periode, dus knipt hard op `endsAt`.
    if (Date.now() >= target.currentRound.endsAt) {
      throw new ProtocolError('DEADLINE_PASSED', 'The answer window for this round has closed.');
    }
    if (typeof payload.roundId !== 'string' || payload.roundId !== target.currentRound.roundId) {
      throw new ProtocolError('INVALID_ANSWER_FORMAT', 'roundId does not match the active round.');
    }
    const player = target.players.get(playerId);
    if (player === undefined || !player.active) {
      throw new ProtocolError('PLAYER_NOT_ELIGIBLE', 'Player is not part of this round.');
    }
    const currentRoundNumber = target.roundIndex + 1; // 1-based, zie eligibleFromRound.
    if (currentRoundNumber < player.eligibleFromRound) {
      throw new ProtocolError('PLAYER_NOT_ELIGIBLE', 'Player joined after this round started.');
    }
    if (player.answeredCurrentRound) {
      throw new ProtocolError('ALREADY_ANSWERED', 'Player already answered this round.');
    }
    // De antwoordvorm hangt van de gameType af (PROTOCOL.md §round:answer):
    // meerkeuze stuurt { optionId }, echt-of-nep stuurt { choice }.
    const antwoord = payload.answer;
    if (antwoord === null || typeof antwoord !== 'object') {
      throw new ProtocolError('INVALID_ANSWER_FORMAT', 'answer must be an object.');
    }
    let gegeven;
    if (target.gameType === 'odd_one_out') {
      if (!Number.isInteger(antwoord.cardIndex)) {
        throw new ProtocolError('INVALID_ANSWER_FORMAT', 'odd_one_out expects { cardIndex }.');
      }
      gegeven = String(antwoord.cardIndex);
    } else if (target.gameType === 'real_or_fake_flag') {
      if (antwoord.choice !== 'real' && antwoord.choice !== 'fake') {
        throw new ProtocolError('INVALID_ANSWER_FORMAT', 'real_or_fake_flag expects { choice: "real" | "fake" }.');
      }
      gegeven = antwoord.choice;
    } else {
      if (typeof antwoord.optionId !== 'string') {
        throw new ProtocolError('INVALID_ANSWER_FORMAT', 'flags_mc expects { optionId }.');
      }
      gegeven = antwoord.optionId;
    }

    player.answeredCurrentRound = true;
    target.currentRound.answers.set(playerId, gegeven);

    const isCorrect = gegeven === correctValueOf(target.currentRound.question);
    if (isCorrect) {
      player.score += 100;
      player.correctCount += 1;
      player.correctResponseTimeMsTotal += Math.max(0, Date.now() - target.currentRound.startsAt);
    }

    emitToSession(target, playerId, 'round:answer-accepted', { roundId: target.currentRound.roundId });
    broadcast(target, 'round:progress', {
      answeredCount: target.currentRound.answers.size,
      eligiblePlayerCount: countActivePlayers(target),
    });

    return { roundId: target.currentRound.roundId };
  }

  function endRound(target, index) {
    if (target.phase !== 'ROUND_ACTIVE' || target.currentRound === null) {
      return;
    }
    const { question, answers, roundId } = target.currentRound;
    const correctAnswer = question.correct;
    const distribution = buildDistribution(optionValuesOf(question), answers);

    target.phase = 'ROUND_RESULT';
    target.phaseDeadline = Date.now() + ROUND_RESULT_MS;
    broadcastPersonalized(target, 'round:ended', (playerId) => {
      const ownCorrect = playerId !== null && answers.get(playerId) === correctValueOf(question);
      return {
        roundId,
        correctAnswer,
        ...(question.resultDetails === undefined ? {} : { resultDetails: question.resultDetails }),
        distribution,
        ownCorrect,
        ownPoints: ownCorrect ? 100 : 0,
        ownResponseTimeMs: null,
      };
    });

    scheduleTimer(target, ROUND_RESULT_MS, () => showScoreboard(target));
  }

  function showScoreboard(target) {
    if (target.phase !== 'ROUND_RESULT') {
      return;
    }
    target.phase = 'SCOREBOARD';
    const ranked = rankPlayers(target);
    broadcastPersonalized(target, 'scoreboard:updated', (playerId) => ({
      top: ranked.slice(0, 5).map(toScoreboardEntry),
      self: playerId !== null ? toScoreboardEntry(findRanked(ranked, playerId)) : null,
    }));

    if (target.pacing === 'auto') {
      target.phaseDeadline = Date.now() + SCOREBOARD_AUTO_ADVANCE_MS;
      scheduleTimer(target, SCOREBOARD_AUTO_ADVANCE_MS, () => advanceFromScoreboard(target));
    } else {
      // pacing === 'host': wacht op een expliciete `game:next` (zie advanceOnHostCue).
      target.phaseDeadline = null;
    }
  }

  function advanceOnHostCue(target) {
    if (target.phase !== 'SCOREBOARD') {
      throw new ProtocolError('INVALID_PHASE', 'game:next requires phase SCOREBOARD.');
    }
    advanceFromScoreboard(target);
    return {};
  }

  /**
   * Fase 4 (autoReveal, besluit 51). Zelfde `endRound()`-aanroep die de timer
   * anders had gedaan, alleen op het moment dat de host kiest — geen aparte
   * fase-overgang, precies zoals de echte server (`socket.mjs`'s
   * `case 'game:reveal'`). Twee poorten die `endRound()` zelf niet bewaakt:
   * autoReveal moet uit staan, en de deadline moet al voorbij zijn.
   */
  function revealAnswer(target) {
    if (target.config.autoReveal !== false) {
      throw new ProtocolError('INVALID_PHASE', 'game:reveal requires autoReveal:false.');
    }
    if (
      target.phase !== 'ROUND_ACTIVE'
      || target.currentRound === null
      || Date.now() < target.currentRound.endsAt - REVEAL_DEADLINE_GRACE_MS
    ) {
      throw new ProtocolError('INVALID_PHASE', 'game:reveal requires an active round past its deadline.');
    }
    endRound(target, target.roundIndex);
    return { phase: target.phase };
  }

  function advanceFromScoreboard(target) {
    if (target.phase !== 'SCOREBOARD') {
      return;
    }
    const nextIndex = target.roundIndex + 1;
    if (nextIndex < target.questions.length) {
      startRound(target, nextIndex);
    } else {
      finishGame(target);
    }
  }

  function finishGame(target) {
    target.phase = 'FINISHED';
    target.currentRound = null;
    target.phaseDeadline = null;
    const ranked = rankPlayers(target);
    broadcastPersonalized(target, 'game:finished', (playerId) => ({
      podium: ranked.slice(0, 5).map(toScoreboardEntry),
      self: playerId !== null ? toScoreboardEntry(findRanked(ranked, playerId)) : null,
    }));
    return {};
  }

  function pauseGame(target, payload) {
    const pausableActivePhases = new Set(['COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD']);
    if (!pausableActivePhases.has(target.phase)) {
      throw new ProtocolError('INVALID_PHASE', 'game:pause requires an active game.');
    }
    const remainingMs =
      target.phase === 'ROUND_ACTIVE' && target.currentRound !== null
        ? Math.max(0, target.currentRound.endsAt - Date.now())
        : null;
    target.pausedState = {
      previousPhase: target.phase,
      remainingMs,
      reason: typeof payload.reason === 'string' ? payload.reason : 'host',
      pausedAt: Date.now(),
    };
    target.phase = 'PAUSED';
    target.phaseDeadline = null; // de klok staat stil; zie pausedState.remainingMs
    clearTimers(target);
    broadcast(target, 'game:paused', target.pausedState);
    return {};
  }

  function resumeGame(target) {
    if (target.phase !== 'PAUSED' || target.pausedState === null) {
      throw new ProtocolError('INVALID_PHASE', 'game:resume requires phase PAUSED.');
    }
    const { previousPhase, remainingMs } = target.pausedState;
    target.phase = previousPhase;
    target.pausedState = null;

    broadcast(target, 'game:resumed', {
      phase: previousPhase,
      // Pariteit met de server (R2-7): bij het hervatten van een lopende ronde
      // reist de nieuwe deadline mee.
      ...(previousPhase === 'ROUND_ACTIVE' && target.currentRound !== null
        ? { roundEndsAt: target.currentRound.endsAt }
        : {}),
    });

    if (previousPhase === 'ROUND_ACTIVE' && target.currentRound !== null) {
      const newEndsAt = Date.now() + (remainingMs ?? ROUND_ACTIVE_MS);
      target.currentRound.endsAt = newEndsAt;
      target.phaseDeadline = newEndsAt;
      scheduleTimer(target, newEndsAt - Date.now(), () => endRound(target, target.roundIndex));
    } else if (previousPhase === 'COUNTDOWN') {
      target.phaseDeadline = Date.now() + COUNTDOWN_MS;
      scheduleTimer(target, COUNTDOWN_MS, () => startRound(target, 0));
    } else if (previousPhase === 'SCOREBOARD' && target.pacing === 'auto') {
      target.phaseDeadline = Date.now() + SCOREBOARD_AUTO_ADVANCE_MS;
      scheduleTimer(target, SCOREBOARD_AUTO_ADVANCE_MS, () => advanceFromScoreboard(target));
    }
    return {};
  }

  function setLocked(target, locked) {
    target.locked = locked;
    broadcast(target, 'room:lock-changed', { locked });
    return {};
  }

  function kickPlayer(target, playerId) {
    if (typeof playerId !== 'string' || !target.players.has(playerId)) {
      throw new ProtocolError('INVALID_ANSWER_FORMAT', 'Unknown playerId.');
    }
    const player = target.players.get(playerId);
    player.active = false;
    for (const [sessionToken, session] of target.sessions) {
      if (session.playerId === playerId) {
        emitToSessionToken(target, sessionToken, 'session:kicked', { reason: 'host' });
      }
    }
    broadcast(target, 'room:player-changed', {
      playerCount: countActivePlayers(target),
      delta: { type: 'kick', playerId },
    });
    return {};
  }

  function renamePlayer(target, playerId, displayName) {
    if (target.phase !== 'LOBBY') {
      throw new ProtocolError('INVALID_PHASE', 'player:rename only allowed in LOBBY.');
    }
    const player = target.players.get(playerId);
    if (player === undefined) {
      throw new ProtocolError('NOT_PLAYER', 'Unknown player.');
    }
    if (player.hasRenamed) {
      throw new ProtocolError('INVALID_PHASE', 'player:rename allowed at most once.');
    }
    player.effectiveName = finalizeName(normalizeDisplayName(displayName), target);
    player.hasRenamed = true;
    broadcast(target, 'room:player-changed', {
      playerCount: countActivePlayers(target),
      delta: { type: 'rename', playerId, effectiveName: player.effectiveName },
    });
    return { effectiveName: player.effectiveName };
  }

  function recolorPlayer(target, playerId, color) {
    if (target.phase !== 'LOBBY') {
      throw new ProtocolError('INVALID_PHASE', 'player:recolor only allowed in LOBBY.');
    }
    const player = target.players.get(playerId);
    if (player === undefined) {
      throw new ProtocolError('NOT_PLAYER', 'Unknown player.');
    }
    if (!MOCK_PLAYER_COLORS.includes(color)) {
      throw new ProtocolError('INVALID_ANSWER_FORMAT', 'Unknown color.');
    }
    player.color = color;
    broadcast(target, 'room:player-changed', {
      playerCount: countActivePlayers(target),
      delta: { type: 'recolor', playerId, color },
    });
    return { color };
  }

  function updateRoomConfig(target, patch) {
    if (target.phase !== 'LOBBY') {
      throw new ProtocolError('INVALID_PHASE', 'game:update-config only allowed in LOBBY.');
    }
    const allowed = ['totalRounds', 'difficulty', 'language', 'pacing', 'autoReveal', 'speedBonus', 'allowLateJoin', 'gameTypes'];
    const safe = {};
    for (const key of allowed) {
      if (patch !== null && typeof patch === 'object' && key in patch) {
        safe[key] = patch[key];
      }
    }
    if (Object.keys(safe).length === 0) {
      throw new ProtocolError('INVALID_REQUEST', 'Empty config patch.');
    }
    // Pariteit met de echte server (§A0): dezelfde gedeelde catalogus beslist
    // wat speelbaar is. Zonder deze regel accepteert de mock een game die de
    // server weigert — en dan bewijst een mockdoorloop het verkeerde.
    if ('gameTypes' in safe) {
      const list = safe.gameTypes;
      if (!Array.isArray(list) || list.length !== 1 || !isPlayableGameType(list[0])) {
        throw new ProtocolError('INVALID_REQUEST', 'gameTypes must hold exactly one playable game type.');
      }
    }
    Object.assign(target.config ?? (target.config = {}), safe);
    if ('gameTypes' in safe) {
      // Alleen in LOBBY bereikbaar (zie de fasecontrole hierboven), dus de
      // reeks opnieuw opbouwen kan nooit een lopende ronde omgooien.
      target.gameType = resolveGameType(target.config);
      target.questions = buildQuestionSequence(target.gameType);
    }
    if ('totalRounds' in safe) {
      target.totalRounds = safe.totalRounds;
    }
    if ('pacing' in safe) {
      target.pacing = safe.pacing;
    }
    if ('allowLateJoin' in safe) {
      target.allowLateJoin = safe.allowLateJoin;
    }
    broadcast(target, 'room:config-changed', { config: { ...target.config } });
    return { config: { ...target.config } };
  }

  function rematch(target) {
    if (target.phase !== 'FINISHED') {
      throw new ProtocolError('INVALID_PHASE', 'game:rematch requires phase FINISHED.');
    }
    target.phase = 'LOBBY';
    target.matchId = randomId('match');
    target.matchSequence += 1;
    target.roundIndex = -1;
    target.currentRound = null;
    target.phaseDeadline = null;
    for (const player of target.players.values()) {
      player.score = 0;
      player.correctCount = 0;
      player.correctResponseTimeMsTotal = 0;
      player.answeredCurrentRound = false;
    }
    broadcast(target, 'game:rematch-started', { matchId: target.matchId });
    return {};
  }

  // ---- Broadcast / events -------------------------------------------------

  function broadcast(target, event, payload) {
    for (const listener of target.listeners.values()) {
      emit(listener, event, payload);
    }
  }

  function broadcastPersonalized(target, event, buildPayloadForPlayerId) {
    for (const [sessionToken, listener] of target.listeners) {
      const session = target.sessions.get(sessionToken);
      const playerId = session?.playerId ?? null;
      emit(listener, event, buildPayloadForPlayerId(playerId));
    }
  }

  function emitToSession(target, playerId, event, payload) {
    for (const [sessionToken, session] of target.sessions) {
      if (session.playerId === playerId) {
        emitToSessionToken(target, sessionToken, event, payload);
      }
    }
  }

  function emitToSessionToken(target, sessionToken, event, payload) {
    const listener = target.listeners.get(sessionToken);
    if (listener !== undefined) {
      emit(listener, event, payload);
    }
  }

  function emit(listener, event, payload) {
    listener.onEvent({
      event,
      eventId: randomId('evt'),
      serverTime: Date.now(),
      payload,
    });
    // Elke gebeurtenis die hier binnenkomt is een moment waarop een verbonden
    // speler ook echt iets nieuws ziet — precies de momenten waarop een
    // solopartij zijn voortgang niet mag kwijtraken bij een reload.
    persist();
  }

  function scheduleTimer(target, delayMs, callback) {
    const handle = setTimeout(() => {
      target.pendingTimers.delete(handle);
      callback();
    }, Math.max(0, delayMs));
    target.pendingTimers.add(handle);
  }

  function clearTimers(target) {
    for (const handle of target.pendingTimers) {
      clearTimeout(handle);
    }
    target.pendingTimers.clear();
  }
}

// ---- Persistentie (ronde 3 fase 3, "solo overleeft reload") ----------------
//
// `room` is geen platte data: `players`/`sessions` zijn Maps, `listeners` zijn
// callbackreferenties naar een specifieke paginalaad, `pendingTimers` zijn
// setTimeout-handles die een reload sowieso niet overleven — geen daarvan
// gaat door `JSON.stringify` heen. Deze twee functies zijn het smalle
// contract ertussen: alleen bewaren wat nodig is om dezelfde partij verder te
// spelen.
//
// `questions` zit BEWUST niet in de opgeslagen state: `buildQuestionSequence`
// hieronder is voor elke gameType deterministisch op de vaste, bevroren
// contentpool na (`getCountryPool()`) — de enige willekeur is `shuffle()` voor
// de weergavevolgorde van meerkeuze-opties, en die staat los van `correct`
// (dat is altijd een ISO2-code of vaste kaartindex, nooit een positie in de
// getoonde volgorde). Herstel bouwt de reeks dus gewoon opnieuw op i.p.v. 'm
// te bewaren — dat scheelt met name bij `real_or_fake_flag` een gegenereerde
// canvas-`spec` per vlag in de opslag, en scheelt bij élk speltype de volledige
// vragenpool-met-antwoorden die anders al vóór de eerste ronde in
// `sessionStorage` zou staan.
function serializeRoomState(room) {
  return {
    contentVersion: CONTENT_VERSION,
    roomId: room.roomId,
    gameCode: room.gameCode,
    inviteId: room.inviteId,
    joinUrl: room.joinUrl,
    phase: room.phase,
    locked: room.locked,
    allowLateJoin: room.allowLateJoin,
    pacing: room.pacing,
    config: room.config,
    matchId: room.matchId,
    matchSequence: room.matchSequence,
    pausedState: room.pausedState,
    gameType: room.gameType,
    roundIndex: room.roundIndex,
    phaseDeadline: room.phaseDeadline,
    currentRound:
      room.currentRound === null
        ? null
        : {
            roundId: room.currentRound.roundId,
            roundNumber: room.currentRound.roundNumber,
            totalRounds: room.currentRound.totalRounds,
            startsAt: room.currentRound.startsAt,
            endsAt: room.currentRound.endsAt,
            answers: [...room.currentRound.answers],
            // docs/openstaand/solo-antwoordvolgorde.md, punt 1: de enige
            // willekeur in `buildQuestionSequence` is `shuffle()` voor de
            // weergavevolgorde van meerkeuze-opties — bij herstel wordt de
            // reeks opnieuw opgebouwd (zie de doc-comment hierboven) en dus
            // ook opnieuw geschud. Alleen de volgorde van de HUIDIGE ronde
            // opslaan (een handvol optie-ID's) volstaat om die na een
            // herlaadbeurt hetzelfde te tonen.
            optionOrder: Array.isArray(room.currentRound.question?.payload?.optionIso2s)
              ? [...room.currentRound.question.payload.optionIso2s]
              : null,
          },
    players: [...room.players],
    // `actionCache` (idempotentie voor retries binnen dezelfde paginalaad,
    // zie `handleSend`) gaat bewust niet mee: na een reload heeft de client
    // toch geen enkele openstaande retry meer met een oude `actionId`, en de
    // cache zou anders bij elke actie ongebonden verder groeien in de opslag.
    sessions: [...room.sessions].map(([sessionToken, session]) => [
      sessionToken,
      { roles: session.roles, playerId: session.playerId },
    ]),
  };
}

/**
 * Het omgekeerde van `serializeRoomState`. Gooit op elke vorm die niet meer
 * bruikbaar is (verkeerde contentversie, ontbrekende verplichte velden) —
 * de aanroeper (`app.mjs`) vangt dat op met dezelfde terugval als "geen
 * opgeslagen state": terug naar het homescherm, in plaats van halverwege een
 * onherstelbare room te crashen.
 */
function deserializeRoomState(saved) {
  if (saved === null || typeof saved !== 'object') {
    throw new Error('Ongeldige opgeslagen solostate: geen object.');
  }
  if (saved.contentVersion !== CONTENT_VERSION) {
    // De contentpool kan tussen twee paginalaadbeurten wijzigen (een deploy
    // terwijl het tabblad openstond) — een oudere ronde is dan niet meer
    // betrouwbaar te herbouwen, een nette nieuwe start is beter dan gokken.
    throw new Error(`Solostate hoort bij contentversie ${String(saved.contentVersion)}, huidige is ${CONTENT_VERSION}.`);
  }
  if (typeof saved.gameCode !== 'string' || saved.gameCode.length === 0) {
    throw new Error('Ongeldige opgeslagen solostate: geen gameCode.');
  }

  const gameType = isPlayableGameType(saved.gameType) ? saved.gameType : DEFAULT_GAME_TYPE;
  const questions = buildQuestionSequence(gameType);
  const roundIndex = typeof saved.roundIndex === 'number' ? saved.roundIndex : -1;
  const question = withSavedOptionOrder(questions[roundIndex], saved.currentRound?.optionOrder);

  return {
    roomId: saved.roomId,
    gameCode: saved.gameCode,
    inviteId: saved.inviteId,
    joinUrl: saved.joinUrl,
    phase: saved.phase,
    locked: saved.locked === true,
    allowLateJoin: saved.allowLateJoin !== false,
    pacing: saved.pacing === 'host' ? 'host' : 'auto',
    config: saved.config !== null && typeof saved.config === 'object' ? saved.config : {},
    matchId: saved.matchId,
    matchSequence: typeof saved.matchSequence === 'number' ? saved.matchSequence : 1,
    pausedState: saved.pausedState ?? null,
    players: new Map(Array.isArray(saved.players) ? saved.players : []),
    sessions: new Map(
      (Array.isArray(saved.sessions) ? saved.sessions : []).map(([sessionToken, session]) => [
        sessionToken,
        { roles: session.roles, playerId: session.playerId, actionCache: new Map() },
      ]),
    ),
    listeners: new Map(), // wordt opnieuw gevuld zodra de herstelde sessie `connect()` aanroept
    gameType,
    questions,
    roundIndex,
    currentRound:
      saved.currentRound === null || saved.currentRound === undefined || question === undefined
        ? null
        : {
            roundId: saved.currentRound.roundId,
            roundNumber: saved.currentRound.roundNumber,
            totalRounds: saved.currentRound.totalRounds,
            question,
            startsAt: saved.currentRound.startsAt,
            endsAt: saved.currentRound.endsAt,
            answers: new Map(Array.isArray(saved.currentRound.answers) ? saved.currentRound.answers : []),
          },
    phaseDeadline: typeof saved.phaseDeadline === 'number' ? saved.phaseDeadline : null,
    pendingTimers: new Set(), // setTimeout-handles overleven geen reload; rearmTimer() bouwt er hooguit één opnieuw op
  };
}

// ---- Snapshot-opbouw (State-snapshot, PROTOCOL.md) -------------------------

function buildSnapshot(room, sessionToken, sessionArg) {
  const session = sessionArg ?? room.sessions.get(sessionToken);
  const player = session?.playerId != null ? room.players.get(session.playerId) : undefined;
  const ranked = rankPlayers(room);

  return {
    protocolVersion: 'v1',
    serverTime: Date.now(),
    room: {
      code: room.gameCode,
      phase: room.phase,
      locked: room.locked,
      allowLateJoin: room.allowLateJoin,
      joinUrl: room.joinUrl,
      playerCount: countActivePlayers(room),
      config: room.config,
      matchId: room.matchId,
      matchSequence: room.matchSequence,
      pausedState: room.pausedState,
    },
    self:
      session === undefined
        ? null
        : {
            roles: session.roles,
            playerId: session.playerId,
            effectiveName: player?.effectiveName ?? null,
            color: player?.color ?? null,
            score: player?.score ?? 0,
            position: player !== undefined ? (findRanked(ranked, session.playerId)?.rank ?? null) : null,
            answeredCurrentRound: player?.answeredCurrentRound ?? false,
            eligibleFromRound: player?.eligibleFromRound ?? 1,
            // docs/openstaand/solo-antwoordvolgorde.md, punt 2 — mock-only
            // uitbreiding op PROTOCOL.md's `self` (de echte server stuurt dit
            // veld niet mee, `hydrateFromSnapshot` behandelt het dus overal
            // buiten deze mock als afwezig): het gegeven antwoord van déze
            // ronde, dezelfde ruwe waarde als `round:answer`'s payload
            // (optionId/choice/kaartindex-als-tekst). Zonder dit weet de
            // client na een herlaadbeurt wél dát er geantwoord is
            // (`answeredCurrentRound`), maar niet meer waarop.
            answeredValue: room.currentRound !== null ? (room.currentRound.answers.get(session.playerId) ?? null) : null,
          },
    currentRound:
      room.currentRound === null
        ? {}
        : {
            roundId: room.currentRound.roundId,
            roundNumber: room.currentRound.roundNumber,
            totalRounds: room.currentRound.totalRounds,
            gameType: room.gameType,
            contentVersion: CONTENT_VERSION,
            rendererVersion: RENDERER_VERSION,
            question: room.currentRound.question.payload,
            startsAt: room.currentRound.startsAt,
            endsAt: room.currentRound.endsAt,
          },
    scoreboard: {
      top: ranked.slice(0, 5).map(toScoreboardEntry),
      self: player !== undefined ? toScoreboardEntry(findRanked(ranked, session.playerId)) : {},
    },
  };
}

// ---- Vraagreeks -------------------------------------------------------------

/** De gameType van deze room: uit de config, met de quick-start default. */
function resolveGameType(config) {
  const gameTypes = config?.gameTypes;
  const gekozen = Array.isArray(gameTypes) ? gameTypes[0] : null;
  return isPlayableGameType(gekozen) ? gekozen : DEFAULT_GAME_TYPE;
}

/**
 * De vaste vraagreeks van deze mock, per gameType.
 *
 * Elke vraag is `{ payload, correct }`: `payload` gaat naar de client
 * (`round:started`, snapshot), `correct` blijft binnen de mock — besluit 20,
 * het juiste antwoord verlaat de server nooit vóór het einde van de ronde.
 * De reeks is bewust vast en kort (geen willekeur behalve de optievolgorde):
 * een handmatige doorloop moet snel en herhaalbaar zijn.
 */
function buildQuestionSequence(gameType = DEFAULT_GAME_TYPE) {
  const pool = getCountryPool();
  const count = Math.min(QUESTION_COUNT, pool.length);
  const questions = [];

  for (let i = 0; i < count; i += 1) {
    const target = pool[i];

    if (gameType === 'odd_one_out') {
      // Drie uit hetzelfde continent + één buitenbeentje, zoals de server
      // (`question-selection.js`). Vast, niet willekeurig: een doorloop moet
      // herhaalbaar zijn.
      const zelfdeContinent = pool.filter((entry) => entry.continent === target.continent && entry.iso2 !== target.iso2);
      const buitenbeentje = pool.find((entry) => entry.continent !== target.continent);
      if (zelfdeContinent.length >= 2 && buitenbeentje !== undefined) {
        const kaarten = [target, zelfdeContinent[0], zelfdeContinent[1], buitenbeentje];
        const oddIndex = 3;
        questions.push({
          payload: { cards: kaarten.map((entry, index) => ({ cardIndex: index, iso2: entry.iso2.toUpperCase() })) },
          correct: { cardIndex: oddIndex },
          resultDetails: {
            logic: 'continent',
            majorityContinent: target.continent,
            minorityContinent: buitenbeentje.continent,
          },
        });
        continue;
      }
    }

    if (gameType === 'real_or_fake_flag') {
      // Om en om echt/nep, zodat een doorloop beide takken van het spelscherm
      // raakt (echte vlagafbeelding vs. gegenereerde spec op canvas).
      if (i % 2 === 0) {
        questions.push({
          payload: { kind: 'real', iso2: target.iso2.toUpperCase() },
          correct: { choice: 'real' },
        });
      } else {
        const seed = `fx_mock${String(i).padStart(2, '0')}`;
        const { rendererVersion, ...spec } = generateFlagSpec(seed);
        questions.push({
          payload: { kind: 'generated', seed, rendererVersion, spec },
          correct: { choice: 'fake' },
        });
      }
      continue;
    }

    const distractors = [];
    for (let offset = 1; distractors.length < 3 && offset < pool.length; offset += 1) {
      const candidate = pool[(i + offset) % pool.length];
      if (candidate.iso2 !== target.iso2) {
        distractors.push(candidate);
      }
    }
    const optionIso2s = shuffle([target, ...distractors].map((entry) => entry.iso2.toUpperCase()));
    questions.push({
      payload: { targetIso2: target.iso2.toUpperCase(), optionIso2s },
      correct: { optionId: target.iso2.toUpperCase() },
    });
  }

  return questions;
}

/**
 * Zet de opgeslagen weergavevolgorde terug op een net herbouwde vraag
 * (`deserializeRoomState`, docs/openstaand/solo-antwoordvolgorde.md punt 1).
 * Alleen toegepast als `optionOrder` letterlijk dezelfde optieset is — een
 * andere permutatie, geen andere inhoud. Dezelfde ronde-index bouwt altijd
 * dezelfde optieset op (`buildQuestionSequence` is deterministisch op de
 * shuffle na), dus dat mag hier nooit falen; de check is puur verdediging
 * tegen een corrupte of verouderde `sessionStorage`-waarde — dan liever de
 * vers geschudde volgorde dan een vraag met een fantoomoptie.
 */
function withSavedOptionOrder(question, optionOrder) {
  if (question === undefined || !Array.isArray(optionOrder) || !Array.isArray(question.payload?.optionIso2s)) {
    return question;
  }
  const current = question.payload.optionIso2s;
  const sameSet = optionOrder.length === current.length && current.every((iso2) => optionOrder.includes(iso2));
  if (!sameSet) {
    return question;
  }
  return { ...question, payload: { ...question.payload, optionIso2s: optionOrder } };
}

function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// PROTOCOL.md, §`POST /api/v1/games/join`: het request draagt "precies één
// locator" (inviteId óf gameCode) en een optionele `joinSource` uit een vaste
// enum. Geen van beide velden wordt vandaag door een apart wire-foutcode voor
// "malformed join request" gedekt (zie §Foutcodes) — `INVITE_INVALID` is de
// dichtstbijzijnde bestaande code binnen de join-foutcodefamilie ("Room en
// join") die al specifiek over een verkeerd gevormde locator/joinaanvraag
// gaat (`previewInvite()` gebruikt 'm al voor een verkeerd gevormde
// `inviteId`), dus die wordt hier hergebruikt in plaats van een nieuwe code
// te verzinnen.
function validateJoinRequest(request) {
  const inviteIdPresent = request.inviteId !== undefined && request.inviteId !== null;
  const gameCodePresent = request.gameCode !== undefined && request.gameCode !== null;

  if (inviteIdPresent && gameCodePresent) {
    throw new ProtocolError('INVITE_INVALID', 'Provide exactly one of inviteId or gameCode, not both.');
  }
  if (!inviteIdPresent && !gameCodePresent) {
    throw new ProtocolError('INVITE_INVALID', 'Provide exactly one of inviteId or gameCode.');
  }
  if (inviteIdPresent && typeof request.inviteId !== 'string') {
    throw new ProtocolError('INVITE_INVALID', 'inviteId must be a string.');
  }
  if (gameCodePresent && typeof request.gameCode !== 'string') {
    throw new ProtocolError('INVITE_INVALID', 'gameCode must be a string.');
  }
  if (request.joinSource !== undefined && !JOIN_SOURCES.has(request.joinSource)) {
    throw new ProtocolError('INVITE_INVALID', 'joinSource must be one of qr|shared_link|code|unknown.');
  }
}

/** De waarde die dit antwoord juist maakt, ongeacht gameType. */
function correctValueOf(question) {
  if (question.correct.cardIndex !== undefined) return String(question.correct.cardIndex);
  return question.correct.optionId ?? question.correct.choice;
}

/** De mogelijke antwoordwaarden van deze vraag, in weergavevolgorde. */
function optionValuesOf(question) {
  if (Array.isArray(question.payload.cards)) {
    return question.payload.cards.map((kaart) => String(kaart.cardIndex));
  }
  return question.payload.optionIso2s ?? ['real', 'fake'];
}

function buildDistribution(optionValues, answers) {
  const counts = new Map(optionValues.map((waarde) => [waarde, 0]));
  for (const gegeven of answers.values()) {
    counts.set(gegeven, (counts.get(gegeven) ?? 0) + 1);
  }
  return optionValues.map((optionId) => ({ optionId, count: counts.get(optionId) ?? 0 }));
}

// ---- Spelers / scorebord ------------------------------------------------

// Zelfde gesloten palet + volgorde als de server (client-events-dispatch.mjs).
// Zestien sinds besluit 42; de eerste acht staan onveranderd op hun plek, want de
// round-robin bij join loopt over deze volgorde. `transport-mock.test.mjs`
// bewaakt de pariteit met de serverlijst — anders bewijst een mockdoorloop
// het verkeerde.
export const MOCK_PLAYER_COLORS = Object.freeze([
  'orange', 'magenta', 'cyan', 'green', 'yellow', 'purple', 'lime', 'red',
  'blue', 'teal', 'indigo', 'violet', 'rose', 'moss', 'rust', 'slate',
]);

function addPlayer(room, playerId, effectiveName) {
  room.players.set(playerId, {
    playerId,
    effectiveName,
    color: MOCK_PLAYER_COLORS[room.players.size % MOCK_PLAYER_COLORS.length],
    score: 0,
    // §A3: de gedeelde rangschikker (shared/rules/ranking.mjs) heeft deze twee
    // velden nodig voor de tiebreak; zonder ze zou de mock een eigen,
    // afwijkende volgorde moeten verzinnen.
    correctCount: 0,
    correctResponseTimeMsTotal: 0,
    active: true,
    answeredCurrentRound: false,
    hasRenamed: false,
    eligibleFromRound: room.roundIndex < 0 ? 1 : room.roundIndex + 2,
    joinedAt: Date.now(),
  });
}

function countActivePlayers(room) {
  let count = 0;
  for (const player of room.players.values()) {
    if (player.active) {
      count += 1;
    }
  }
  return count;
}

/**
 * §A3 — DEZELFDE rangschikker als de server (`shared/rules/ranking.mjs`).
 *
 * De mock sorteerde hier zelf op score en joinedAt en kende helemaal geen
 * positie toe; de client vulde er daarna `index + 1` bij. Een gelijke stand
 * zag er in de mock dus anders uit dan op de echte server — en dan bewijst een
 * mockdoorloop het verkeerde. `rankPlayers` levert de competitierang (gedeelde
 * spelers delen hun nummer); die reist mee als `rank`.
 */
function rankPlayers(room) {
  const active = [...room.players.values()].filter((player) => player.active);
  const byId = new Map(active.map((player) => [player.playerId, player]));
  return rankByRules(active.map((player) => ({
    id: player.playerId,
    score: player.score,
    correctCount: player.correctCount,
    correctResponseTimeMsTotal: player.correctResponseTimeMsTotal,
  }))).map((entry) => ({ ...byId.get(entry.id), rank: entry.position }));
}

function findRankIndex(ranked, playerId) {
  return ranked.findIndex((player) => player.playerId === playerId);
}

function findRanked(ranked, playerId) {
  return ranked.find((player) => player.playerId === playerId);
}

function toScoreboardEntry(player) {
  if (player === undefined) {
    return {};
  }
  // `rank` hoort in de payload: de client mag geen positie meer afleiden uit
  // de rijvolgorde (§A3).
  return {
    playerId: player.playerId,
    effectiveName: player.effectiveName,
    score: player.score,
    rank: player.rank,
  };
}

// ---- Naam- en ID-generatie ------------------------------------------------

function normalizeDisplayName(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.normalize('NFKC').trim();
  return trimmed.length === 0 ? null : truncateToGraphemes(trimmed, NAME_MAX_GRAPHEMES);
}

// Zelfde patroon als client/flow/join-state.mjs en
// client/flow/host-setup-state.mjs's `truncateToGraphemes`: telt
// grapheme-clusters via Intl.Segmenter, niet UTF-16 code units, zodat een
// emoji of combining character nooit doormidden wordt geknipt.
function truncateToGraphemes(value, limit) {
  let result = '';
  let count = 0;
  for (const { segment } of graphemeSegmenter.segment(value)) {
    if (count >= limit) {
      break;
    }
    result += segment;
    count += 1;
  }
  return result;
}

function generateSuggestedName() {
  const adjective = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const noun = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return `${adjective} ${noun}`;
}

// Lost botsingen met een reeds gebruikte naam in dezelfde room op door een
// volgnummer toe te voegen — de server bepaalt de uiteindelijke, unieke naam
// pas bij join (PROTOCOL.md, §preview-endpoint "Grenzen").
function finalizeName(requestedName, room) {
  const base = requestedName ?? generateSuggestedName();
  if (room === undefined) {
    return base;
  }
  const used = new Set([...room.players.values()].map((player) => player.effectiveName));
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base} ${suffix}`)) {
    suffix += 1;
  }
  return `${base} ${suffix}`;
}

function randomToken() {
  return `tok_${randomHex(24)}`;
}

function randomId(prefix) {
  return `${prefix}_${randomHex(12)}`;
}

function randomInviteId() {
  return randomHex(12);
}

function randomGameCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function randomHex(length) {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, length);
  }
  let result = '';
  while (result.length < length) {
    result += Math.random().toString(16).slice(2);
  }
  return result.slice(0, length);
}

function buildJoinUrl(inviteId) {
  const origin =
    typeof window !== 'undefined' && window.location !== undefined
      ? window.location.origin
      : 'http://localhost:8000';
  return `${origin}/j/${inviteId}`;
}
