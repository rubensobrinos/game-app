// server/transport/socket/phase.mjs — refactor 6 (docs/openstaand/refactor/6-socket.md).
// Verplaatst LETTERLIJK uit socket.mjs. Geen gedragsverandering. Gedeeld door
// fasepomp.mjs (`onPhaseEntered`) en clientevents.mjs (`game:reveal` toetst
// `match.phase !== PHASE.ROUND_ACTIVE`) — vandaar een eigen bestand in plaats
// van dat het ene bestand het andere importeert.

/** Fasewaarden uit ARCHITECTURE.md/state-machine.js. */
export const PHASE = Object.freeze({
  LOBBY: 'LOBBY',
  COUNTDOWN: 'COUNTDOWN',
  ROUND_ACTIVE: 'ROUND_ACTIVE',
  ROUND_RESULT: 'ROUND_RESULT',
  SCOREBOARD: 'SCOREBOARD',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
});
