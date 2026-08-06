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
//
// REFACTOR 4 (docs/openstaand/refactor/4-transport-mock.md, 1548 regels vóór
// de splitsing): de 67 functies achter de twee exports hieronder wonen nu
// verspreid over `mock/*.mjs`, per naad (room/match/pacing/answers/events/
// sessie), plus een paar afhankelijkheidsloze "Layer 0"-bestanden
// (protocol-error/ids/names/questions/players/timers) om kringverwijzingen
// tussen die naden te vermijden — zie de kopnotities daar. Dit bestand is de
// overgebleven "dunne" orchestrator: het bouwt één `ctx` per mockinstantie
// (`{ room, onStateChange, ... }`, zie hieronder), bedraadt alle mock/*.mjs-
// functies daaraan, en blijft zelf de REST-achtige functies (createGame,
// previewInvite, ...) en de eventdispatch (`handleSend`) houden — precies
// zoals die in het bronbestand ook al nergens elders in pasten. Geen
// gedragsverandering: dezelfde volgorde, dezelfde events, dezelfde timing.

// Relatief vanaf `/js/transport-mock.mjs` komt dit bij de door INT-A
// vastgelegde `/shared/*`-mapping uit. Een relatief modulespecifier blijft
// bovendien rechtstreeks onder `node:test` bruikbaar.
import { CONTENT_VERSION } from '../../shared/content/index.mjs';
import { isPlayableGameType } from '../../shared/content/game-catalog.mjs';

import { ProtocolError } from './mock/protocol-error.mjs';
import { randomToken, randomId } from './mock/ids.mjs';
import { normalizeDisplayName, generateSuggestedName, finalizeName, finalizeIdentity } from './mock/names.mjs';
import {
  DEFAULT_GAME_TYPE,
  RENDERER_VERSION,
  buildQuestionSequence,
  withSavedOptionOrder,
  correctValueOf,
  optionValuesOf,
} from './mock/questions.mjs';
import {
  MOCK_PLAYER_COLORS,
  addPlayer,
  countActivePlayers,
  rankPlayers,
  findRanked,
  toScoreboardEntry,
} from './mock/players.mjs';
import { broadcast } from './mock/events.mjs';
import { connect as sessieConnect, requireSession, requireRole, persist } from './mock/sessie.mjs';
import {
  buildRoom,
  resolveRoomLocator,
  setLocked,
  kickPlayer,
  renamePlayer,
  recolorPlayer,
  updateRoomConfig,
} from './mock/room.mjs';
import { startGame, finishGame, rematch } from './mock/match.mjs';
import { advanceOnHostCue, advanceFromScoreboard, revealAnswer, pauseGame, resumeGame, rearmTimer } from './mock/pacing.mjs';
import { submitAnswer } from './mock/answers.mjs';

const MAX_PLAYERS = 100;

// Simuleert een niet-triviale klokafwijking, zodat `fetchServerTime()` +
// `estimateServerOffset()` ook in de mock iets zinnigs meten in plaats van
// altijd exact 0.
const SIMULATED_SERVER_SKEW_MS = 400;

// `joinSource` enum uit PROTOCOL.md, §`POST /api/v1/games/join`.
const JOIN_SOURCES = new Set(['qr', 'shared_link', 'code', 'unknown']);

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
  /**
   * Eén, door deze aanroep opgebouwd object, gedeeld door alle mock/*.mjs-
   * functies die hieronder aan bod komen — zie de moduledoc hierboven en
   * mock/events.mjs se kopnotitie voor de reden (dit vervangt de impliciete
   * gezamenlijke sluiting die het bronbestand vóór de splitsing had).
   * `room` is het enige veld dat na opbouw nog wijzigt (`createGame`
   * hieronder kent 'm opnieuw toe) — de rest ligt vast zodra deze functie
   * terugkeert.
   * @type {{
   *   room: object | null,
   *   onStateChange: ((state: object) => void) | undefined,
   *   randomId: (prefix: string) => string,
   *   serializeRoomState: (room: object) => object,
   *   buildSnapshot: typeof buildSnapshot,
   *   persist: (ctx: object) => void,
   *   handleSend: (sessionToken: string, event: string, actionId: string, payload: unknown) => Promise<object>,
   *   advanceFromScoreboard: typeof advanceFromScoreboard,
   * }}
   */
  const ctx = {
    room: restoreState != null ? deserializeRoomState(restoreState) : null,
    onStateChange,
    randomId,
    serializeRoomState,
    buildSnapshot,
    persist,
    handleSend,
    advanceFromScoreboard,
  };

  if (ctx.room !== null) {
    rearmTimer(ctx.room, ctx);
  }

  return {
    createGame,
    previewInvite,
    joinGame,
    fetchState,
    leaveGame,
    fetchServerTime,
    connect: (sessionToken, handlers) => sessieConnect(sessionToken, handlers, ctx),
  };

  // ---- REST-achtige functies -------------------------------------------

  // Correctie 1 (transport-contract-response.md): het argument is het hele
  // POST /api/v1/games-verzoek ({ config, hostParticipates, displayName }),
  // niet alleen de roomconfig -- was intern al zo geïmplementeerd, alleen de
  // parameternaam/JSDoc hieronder zijn nu in lijn gebracht met het contract.
  async function createGame(request) {
    const safeRequest = request !== null && typeof request === 'object' ? request : {};
    const hostParticipates = safeRequest.hostParticipates !== false;
    const requestedDisplayName = normalizeDisplayName(safeRequest.displayName);

    ctx.room = buildRoom(safeRequest.config);

    const sessionToken = randomToken();
    const roles = hostParticipates ? ['host', 'player'] : ['host'];
    let playerId = null;
    let effectiveName = null;
    let identity = null;

    if (hostParticipates) {
      playerId = randomId('p');
      effectiveName = finalizeName(requestedDisplayName);
      identity = finalizeIdentity(requestedDisplayName);
      addPlayer(ctx.room, playerId, effectiveName, identity);
    }

    ctx.room.sessions.set(sessionToken, { roles, playerId, actionCache: new Map() });

    return {
      roomId: ctx.room.roomId,
      gameCode: ctx.room.gameCode,
      inviteId: ctx.room.inviteId,
      joinUrl: ctx.room.joinUrl,
      sessionToken,
      roles,
      playerId,
      effectiveName,
      identity,
      state: buildSnapshot(ctx.room, sessionToken),
    };
  }

  async function previewInvite(inviteId) {
    if (typeof inviteId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(inviteId)) {
      throw new ProtocolError('INVITE_INVALID', `Malformed inviteId: ${String(inviteId)}`);
    }
    if (ctx.room === null || ctx.room.inviteId !== inviteId) {
      throw new ProtocolError('GAME_NOT_FOUND', 'No room for this inviteId.');
    }

    return {
      roomId: ctx.room.roomId,
      suggestedName: generateSuggestedName(),
      phase: ctx.room.phase,
      locked: ctx.room.locked,
      allowLateJoin: ctx.room.allowLateJoin,
      playerCount: countActivePlayers(ctx.room),
      maxPlayers: MAX_PLAYERS,
    };
  }

  async function joinGame(request) {
    const safeRequest = request !== null && typeof request === 'object' ? request : {};
    validateJoinRequest(safeRequest);
    const target = resolveRoomLocator(ctx, safeRequest);
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
    const normalizedDisplayName = normalizeDisplayName(safeRequest.displayName);
    const effectiveName = finalizeName(normalizedDisplayName, target);
    const identity = finalizeIdentity(normalizedDisplayName, target);
    addPlayer(target, playerId, effectiveName, identity);

    const sessionToken = randomToken();
    target.sessions.set(sessionToken, { roles: ['player'], playerId, actionCache: new Map() });

    broadcast(target, 'room:player-changed', {
      playerCount: countActivePlayers(target),
      delta: { type: 'join', playerId, effectiveName, identity, color: target.players.get(playerId)?.color },
    }, ctx);

    return {
      roomId: target.roomId,
      gameCode: target.gameCode,
      sessionToken,
      roles: ['player'],
      playerId,
      effectiveName,
      identity,
      state: buildSnapshot(target, sessionToken),
    };
  }

  async function fetchState(code, sessionToken) {
    const { targetRoom, session } = requireSession(code, sessionToken, ctx);
    return buildSnapshot(targetRoom, sessionToken, session);
  }

  async function leaveGame(code, sessionToken) {
    const { targetRoom, session } = requireSession(code, sessionToken, ctx);
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
    }, ctx);
  }

  async function fetchServerTime() {
    return { serverTime: Date.now() + SIMULATED_SERVER_SKEW_MS };
  }

  // ---- Fake "socket": eventdispatch -----------------------------------

  async function handleSend(sessionToken, event, actionId, payload) {
    if (ctx.room === null) {
      throw new ProtocolError('GAME_NOT_FOUND', 'No room exists.');
    }
    const session = ctx.room.sessions.get(sessionToken);
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
          return ackWith(startGame(ctx.room, ctx));

        case 'game:pause':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(pauseGame(ctx.room, safePayload, ctx));

        case 'game:resume':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(resumeGame(ctx.room, ctx));

        case 'game:next':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(advanceOnHostCue(ctx.room, ctx));

        case 'game:reveal':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(revealAnswer(ctx.room, ctx));

        case 'game:lock':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(setLocked(ctx.room, safePayload.locked === true, ctx));

        case 'game:kick':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(kickPlayer(ctx.room, safePayload.playerId, ctx));

        case 'game:finish':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(finishGame(ctx.room, ctx));

        case 'game:rematch':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(rematch(ctx.room, ctx));

        case 'player:rename':
          requireRole(isPlayer, 'NOT_PLAYER');
          return ackWith(renamePlayer(ctx.room, session.playerId, safePayload.displayName, false, ctx));

        case 'player:recolor':
          requireRole(isPlayer, 'NOT_PLAYER');
          return ackWith(recolorPlayer(ctx.room, session.playerId, safePayload.color, ctx));

        // docs/openstaand/host-wijzigt-naam-en-kleur.md: hostvariant — de
        // host mag een ándere speler hernoemen/herkleuren, ook ná diens eigen
        // eenmalige player:rename (bypassRenameLimit: true hieronder).
        case 'game:rename-player':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(renamePlayer(ctx.room, safePayload.playerId, safePayload.displayName, true, ctx));

        case 'game:recolor-player':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(recolorPlayer(ctx.room, safePayload.playerId, safePayload.color, ctx));

        case 'game:update-config':
          requireRole(isHost, 'NOT_HOST');
          return ackWith(updateRoomConfig(ctx.room, safePayload, ctx));

        case 'player:leave':
          requireRole(isPlayer, 'NOT_PLAYER');
          await leaveGame(ctx.room.gameCode, sessionToken);
          return ackWith({});

        case 'round:answer':
          requireRole(isPlayer, 'NOT_PLAYER');
          return ackWith(submitAnswer(ctx.room, session.playerId, safePayload, ctx));

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
            // spelersidentiteit.md, stap 4/5.
            identity: player?.identity ?? null,
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

// ---- Publieke re-exports (ongewijzigd contract ná de splitsing) -----------
//
// `transport-mock.test.mjs` en `frontend/js/app.mjs` importeren deze namen
// nog altijd rechtstreeks van `./transport-mock.mjs` — zie de opdracht
// ("de twee bestaande exports blijven exact gelijk"). `createMockTransport`
// staat hierboven; de overige vier woonden inhoudelijk altijd al bij de
// vraagreeks/kleuren en zijn nu in mock/questions.mjs resp. mock/players.mjs
// gedefinieerd — dezelfde functies, dezelfde waarden, alleen verplaatst.
export { buildQuestionSequence, correctValueOf, optionValuesOf, MOCK_PLAYER_COLORS };
