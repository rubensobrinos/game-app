// mock/room.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK uit transport-mock.mjs's "Room-opbouw en helpers"-
// kopje (buildRoom, resolveRoomLocator) en de spelerbeheeracties die verderop
// stonden (setLocked, kickPlayer, renamePlayer, recolorPlayer,
// updateRoomConfig). Geen gedragsverandering.
//
// Functies die broadcasten (alles behalve `buildRoom`) krijgen een `ctx` mee
// — hetzelfde, door transport-mock.mjs éénmalig opgebouwde object dat ook de
// andere mock/*.mjs-bestanden gebruiken, zie mock/events.mjs se kopnotitie.
// `resolveRoomLocator` las in het bronbestand de instantie-eigen `room` uit
// de sluiting van `createMockTransport`; dat wordt hier `ctx.room`.

import { broadcast, emitToSessionToken } from './events.mjs';
import { ProtocolError } from './protocol-error.mjs';
import { countActivePlayers, MOCK_PLAYER_COLORS } from './players.mjs';
import { normalizeDisplayName, finalizeName } from './names.mjs';
import { resolveGameType, buildQuestionSequence } from './questions.mjs';
import { randomId, randomGameCode, randomInviteId, buildJoinUrl } from './ids.mjs';
import { isPlayableGameType } from '../../../shared/content/game-catalog.mjs';

// Punt 7 / besluit 52 (docs/openstaand/continentfilter.md): zelfde zes
// waarden als CONTINENT_VALUES in server/data/types/game-configuration.js.
const MOCK_CONTINENTS = Object.freeze(['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania']);

export function buildRoom(config) {
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

export function resolveRoomLocator(ctx, request) {
  if (ctx.room === null) {
    return null;
  }
  if (typeof request.inviteId === 'string' && request.inviteId === ctx.room.inviteId) {
    return ctx.room;
  }
  if (typeof request.gameCode === 'string' && request.gameCode === ctx.room.gameCode) {
    return ctx.room;
  }
  return null;
}

export function setLocked(target, locked, ctx) {
  target.locked = locked;
  broadcast(target, 'room:lock-changed', { locked }, ctx);
  return {};
}

export function kickPlayer(target, playerId, ctx) {
  if (typeof playerId !== 'string' || !target.players.has(playerId)) {
    throw new ProtocolError('INVALID_ANSWER_FORMAT', 'Unknown playerId.');
  }
  const player = target.players.get(playerId);
  player.active = false;
  for (const [sessionToken, session] of target.sessions) {
    if (session.playerId === playerId) {
      emitToSessionToken(target, sessionToken, 'session:kicked', { reason: 'host' }, ctx);
    }
  }
  broadcast(target, 'room:player-changed', {
    playerCount: countActivePlayers(target),
    delta: { type: 'kick', playerId },
  }, ctx);
  return {};
}

export function renamePlayer(target, playerId, displayName, bypassRenameLimit = false, ctx) {
  if (target.phase !== 'LOBBY') {
    throw new ProtocolError('INVALID_PHASE', 'player:rename only allowed in LOBBY.');
  }
  const player = target.players.get(playerId);
  if (player === undefined) {
    throw new ProtocolError('NOT_PLAYER', 'Unknown player.');
  }
  if (player.hasRenamed && !bypassRenameLimit) {
    throw new ProtocolError('INVALID_PHASE', 'player:rename allowed at most once.');
  }
  player.effectiveName = finalizeName(normalizeDisplayName(displayName), target);
  player.hasRenamed = true;
  broadcast(target, 'room:player-changed', {
    playerCount: countActivePlayers(target),
    delta: { type: 'rename', playerId, effectiveName: player.effectiveName },
  }, ctx);
  return { effectiveName: player.effectiveName };
}

export function recolorPlayer(target, playerId, color, ctx) {
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
  }, ctx);
  return { color };
}

export function updateRoomConfig(target, patch, ctx) {
  if (target.phase !== 'LOBBY') {
    throw new ProtocolError('INVALID_PHASE', 'game:update-config only allowed in LOBBY.');
  }
  // `continents` staat op de ECHTE server nog niet in UPDATABLE_CONFIG_KEYS
  // (server/protocol/client-events-dispatch.mjs) — besluit 52 markeert het
  // create-only totdat die protocolkant meekomt. Hier wél toegestaan, zodat
  // de lobbytoggle in solo (de enige manier om 'm nu in een browser te
  // beproeven) iets doet in plaats van in de void te schrijven.
  const allowed = ['totalRounds', 'difficulty', 'language', 'pacing', 'autoReveal', 'speedBonus', 'allowLateJoin', 'gameTypes', 'continents'];
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
  // Pariteit met assertGameConfigurationShape (game-configuration.js):
  // niet-lege lijst uit de zes bekende continenten.
  if ('continents' in safe) {
    const list = safe.continents;
    if (!Array.isArray(list) || list.length === 0 || !list.every((c) => MOCK_CONTINENTS.includes(c))) {
      throw new ProtocolError('INVALID_REQUEST', 'continents must be a non-empty array of known continents.');
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
  broadcast(target, 'room:config-changed', { config: { ...target.config } }, ctx);
  return { config: { ...target.config } };
}
