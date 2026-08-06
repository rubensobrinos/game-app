// server/composition/match/stand.mjs
//
// De tussenstand.
//
// `buildRankedTop` IS DE ENIGE PLEK WAAR EEN POSITIE BEPAALD WORDT — zie
// docs/openstaand/refactor/8-match-lifecycle.md, punt 4, en STATUS.md. Geen
// enkele andere module en geen enkele client mag `index + 1` gebruiken. Er zit
// een contracttest op bij een echte gelijke stand.
//
// Daarom staat hij hier en niet in `gedeeld.mjs`: `snapshot.mjs` importeert
// hem uit dít bestand, zichtbaar, in plaats van dat er een tweede plek ontstaat
// waar iemand "even snel" opnieuw nummert.

import { rankPlayers } from '../../../shared/rules/ranking.mjs';
import { loadRoomAndMatch, rankablePlayers, succeed } from './gedeeld.mjs';

/** `scoreboard:updated` levert de top 5 (PROTOCOL.md §Server → client events). */
export const SCOREBOARD_TOP_LIMIT = 5;

/**
 * DE ENIGE PLEK DIE EEN TUSSENSTAND-TOP BOUWT (§A3, 5 aug 2026).
 *
 * `getScoreboard()` en `buildSnapshot()` deden dit allebei zelf, en allebei
 * met `rank: index + 1`. Bij een gelijke stand toonde de tussenstand dus
 * 1-2-3-4 terwijl `finishMatch()` — die wél `rankPlayers()` gebruikt —
 * 1-2-2-4 zei. Binnen één snapshot spraken `scoreboard.top[].rank` en
 * `scoreboard.self.position` elkaar zelfs tegen. Één functie, één antwoord.
 *
 * `rank` blijft de veldnaam in de tussenstand-payloads (PROTOCOL.md) en
 * `position` die in de eindstand; de WAARDE komt nu uit dezelfde bron.
 *
 * @param {Array<object>} players - de volledige spelerslijst uit de store
 * @param {number} limit
 * @returns {Array<{ playerId: string, effectiveName: string | null, score: number, rank: number }>}
 */
export function buildRankedTop(players, limit) {
  const rankable = rankablePlayers(players);
  const nameById = new Map(rankable.map((player) => [player.id, player.effectiveName]));
  const ranked = rankPlayers(rankable.map((player) => ({
    id: player.id,
    score: player.score,
    correctCount: player.correctCount,
    correctResponseTimeMsTotal: player.correctResponseTimeMsTotal,
  })));
  return ranked.slice(0, limit).map((entry) => ({
    playerId: entry.id,
    effectiveName: nameById.get(entry.id) ?? null,
    score: entry.score,
    rank: entry.position,
  }));
}

/**
 * De tussenstand (`scoreboard:updated`), via `getScoreboardTop` uit de poort.
 *
 * GAT — het scoreboard van de poort wordt uitsluitend gevuld door
 * `saveAcceptedAnswerAtomically`; een speler die nog nooit heeft geantwoord
 * staat er dus niet in, ook niet met 0 punten. Zie het handoff-item; hier is
 * bewust geen tweede scoreboardbron naast de poort gebouwd.
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string, limit?: number }} params
 */
export async function getScoreboard(context, { roomId, limit = SCOREBOARD_TOP_LIMIT } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;

  // §A3: niet meer `getScoreboardTop()` + `index + 1`. Die poort sorteert op
  // score en kent geen gedeelde posities, dus een tie kreeg hier vier
  // verschillende nummers waar de eindstand er drie geeft. De spelerslijst
  // werd hier toch al geladen (voor de namen); rangschikken gebeurt nu op
  // dezelfde regels als het podium.
  const players = await context.store.listPlayers(roomId);

  return succeed({
    matchId: match.id,
    limit,
    roundNumber: match.roundIndex + 1,
    totalRounds: room.config.totalRounds,
    top: buildRankedTop(players, limit),
  });
}
