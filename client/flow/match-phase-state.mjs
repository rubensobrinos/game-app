/**
 * @typedef {'UNINITIALIZED'|'LOBBY'|'COUNTDOWN'|'ROUND_ACTIVE'|'ROUND_RESULT'|'SCOREBOARD'|'FINISHED'|'PAUSED'} Phase
 *
 * @typedef {{
 *   phase: Phase,
 *   matchId: string | null,
 *   pausedState: { previousPhase: Phase, remainingMs: number | null, reason: string | null, pausedAt: number | null } | null,
 * }} MatchPhaseState
 */

/** @returns {MatchPhaseState} */
export function initialMatchPhaseState() {
  return { phase: 'UNINITIALIZED', matchId: null, pausedState: null };
}

/**
 * @param {MatchPhaseState} state
 * @param {{ event: string, payload: object }} serverMessage Exacte envelope-vorm uit PROTOCOL.md.
 * @returns {MatchPhaseState}
 */
export function applyServerEvent(state, serverMessage) {
  if (!isMatchPhaseState(state) || serverMessage === null || typeof serverMessage !== 'object') {
    return state;
  }

  const payload = isObject(serverMessage.payload) ? serverMessage.payload : {};

  switch (serverMessage.event) {
    case 'room:state':
      return handleRoomState(state, payload);

    case 'game:started':
      return { ...state, phase: 'COUNTDOWN', matchId: normalizeMatchId(payload.matchId, state.matchId) };

    case 'round:started':
      return { ...state, phase: 'ROUND_ACTIVE' };

    case 'round:ended':
      return { ...state, phase: 'ROUND_RESULT' };

    case 'scoreboard:updated':
      return { ...state, phase: 'SCOREBOARD' };

    case 'game:paused':
      return { ...state, phase: 'PAUSED', pausedState: buildPausedState(payload) };

    case 'game:resumed':
      return state.pausedState === null
        ? state
        : { ...state, phase: state.pausedState.previousPhase, pausedState: null };

    case 'game:finished':
      return { ...state, phase: 'FINISHED' };

    case 'game:rematch-started':
      return { ...state, phase: 'LOBBY', matchId: normalizeMatchId(payload.matchId, state.matchId) };

    default:
      return state;
  }
}

// No legality table on purpose: ARCHITECTURE.md's state-machine builder (AR1) is
// already the authoritative reducer for which transition is valid, server-side.
// Duplicating that here would create a second source of truth that can drift
// (e.g. scoreboardFrequency can make ROUND_RESULT -> SCOREBOARD optional). This
// module only ever mirrors whatever phase the server reports.
function handleRoomState(state, payload) {
  const room = isObject(payload.room) ? payload.room : null;
  if (room === null || !('phase' in room)) {
    return state;
  }

  // Open spec-vraag (GF3-match-phase-state.md): PROTOCOL.md's voorbeeld-snapshot
  // toont geen pausedState-veld; we volgen de aanname uit de spec dat een
  // snapshot tijdens een pauze payload.room.pausedState meestuurt in dezelfde
  // vorm als DATA-MODEL's Match.pausedState. Onbevestigd door de
  // PROTOCOL.md-eigenaar — hier bewust niet opgelost, alleen toegepast.
  //
  // matchId: PROTOCOL.md's snapshot-voorbeeld bevat wél degelijk `room.matchId`
  // (in tegenstelling tot wat de oorspronkelijke GF3-tabel suggereerde, die dit
  // veld voor room:state niet noemde) — "volledige override" moet dit dus
  // meenemen, anders blijft matchId op null hangen bij een client die start met
  // een snapshot vóór er ooit een game:started/game:rematch-started binnenkomt.
  return {
    ...state,
    phase: room.phase,
    matchId: normalizeMatchId(room.matchId, state.matchId),
    pausedState: isObject(room.pausedState) ? buildPausedState(room.pausedState) : null,
  };
}

function buildPausedState(source) {
  return {
    previousPhase: source.previousPhase ?? null,
    reason: source.reason ?? null,
    remainingMs: source.remainingMs ?? null,
    pausedAt: source.pausedAt ?? null,
  };
}

function isMatchPhaseState(state) {
  return state !== null && typeof state === 'object' && typeof state.phase === 'string';
}

function isObject(value) {
  return value !== null && typeof value === 'object';
}

// A missing/non-string matchId on an update event keeps the last known one
// instead of nulling it out — a malformed payload shouldn't erase identity
// the module already had good reason to trust.
function normalizeMatchId(matchId, previous) {
  return typeof matchId === 'string' ? matchId : previous;
}
