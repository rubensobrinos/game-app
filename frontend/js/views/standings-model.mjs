// views/standings-model.mjs — UI4. Pure normalisatie van `scoreboard:updated`
// en `game:finished` naar één weergavemodel voor tussenstand én podium.
// Geen eigen ranking of optelsom — de payloadvolgorde ís de ranglijst
// (server-authoritative; UI4-scoreboard-and-podium.md §Regels).

/**
 * @param {{ top?: Array<object>, podium?: Array<object>, self?: object | null }} payload
 * @returns {{ entries: Array<{ position: number, playerId: string, effectiveName: string, score: number, isSelf: boolean }>, self: { position: number | null, effectiveName: string, score: number } | null }}
 */
export function standingsFrom(payload) {
  const source = Array.isArray(payload?.podium) ? payload.podium : payload?.top;
  const rows = Array.isArray(source) ? source : [];
  const selfId = payload?.self?.playerId ?? null;

  const entries = rows
    .filter((row) => typeof row?.playerId === 'string')
    .map((row, index) => Object.freeze({
      position: index + 1,
      playerId: row.playerId,
      effectiveName: typeof row.effectiveName === 'string' ? row.effectiveName : '',
      score: typeof row.score === 'number' ? row.score : 0,
      isSelf: row.playerId === selfId,
    }));

  const selfInTop = entries.find((e) => e.isSelf) ?? null;
  const self =
    payload?.self && typeof payload.self.playerId === 'string'
      ? Object.freeze({
          position: selfInTop !== null ? selfInTop.position : null,
          effectiveName: typeof payload.self.effectiveName === 'string' ? payload.self.effectiveName : '',
          score: typeof payload.self.score === 'number' ? payload.self.score : 0,
        })
      : null;

  return Object.freeze({ entries: Object.freeze(entries), self });
}

/** De top 3 voor het podium; minder dan 3 spelers geeft een korter podium. */
export function podiumTop3(standings) {
  return standings.entries.slice(0, 3);
}
