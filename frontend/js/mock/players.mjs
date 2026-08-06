// mock/players.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK uit transport-mock.mjs's "Spelers / scorebord"-kopje.
// Geen gedragsverandering — inclusief `findRankIndex`, die in het bronbestand
// ook al nergens werd aangeroepen (dode code, met rust gelaten: dit is een
// verhuizing, geen opruiming — zie de opdracht se "Niet doen"). Gedeeld door
// mock/room.mjs (recolorPlayer/kickPlayer), mock/match.mjs (startGame/
// showScoreboard/finishGame) én transport-mock.mjs zelf (createGame/joinGame/
// buildSnapshot, en de publieke re-export van MOCK_PLAYER_COLORS) — vandaar
// een eigen, afhankelijkheidsloos bestand in plaats van dat de een van de
// ander importeert.

import { rankPlayers as rankByRules } from '../../../shared/rules/ranking.mjs';

// Zelfde gesloten palet + volgorde als de server (client-events-dispatch.mjs).
// Zestien sinds besluit 42; de eerste acht staan onveranderd op hun plek, want de
// round-robin bij join loopt over deze volgorde. `transport-mock.test.mjs`
// bewaakt de pariteit met de serverlijst — anders bewijst een mockdoorloop
// het verkeerde.
export const MOCK_PLAYER_COLORS = Object.freeze([
  'orange', 'magenta', 'cyan', 'green', 'yellow', 'purple', 'lime', 'red',
  'blue', 'teal', 'indigo', 'violet', 'rose', 'moss', 'rust', 'slate',
]);

export function addPlayer(room, playerId, effectiveName, identity = null) {
  room.players.set(playerId, {
    playerId,
    effectiveName,
    // spelersidentiteit.md, stap 4/5: `null` bij een zelfgekozen naam, of een
    // paar zonder gerenderde tekst — elke client rendert het zelf in zijn
    // eigen apptaal (frontend/js/views/identity-display.mjs).
    identity,
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

export function countActivePlayers(room) {
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
export function rankPlayers(room) {
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

export function findRanked(ranked, playerId) {
  return ranked.find((player) => player.playerId === playerId);
}

export function toScoreboardEntry(player) {
  if (player === undefined) {
    return {};
  }
  // `rank` hoort in de payload: de client mag geen positie meer afleiden uit
  // de rijvolgorde (§A3).
  return {
    playerId: player.playerId,
    effectiveName: player.effectiveName,
    identity: player.identity ?? null,
    score: player.score,
    rank: player.rank,
  };
}
