// views/standings-model.mjs — UI4. Pure normalisatie van `scoreboard:updated`
// en `game:finished` naar één weergavemodel voor tussenstand én podium.
// Geen eigen ranking of optelsom — de server bepaalt de positie
// (server-authoritative; UI4-scoreboard-and-podium.md §Regels).
//
// §A3 (5 aug 2026): "geen eigen ranking" stond er al, maar dit bestand deed
// het tóch — het gooide de meegestuurde positie weg en telde `index + 1`. Bij
// een gelijke stand toonde de client daardoor 1-2-3-4 waar de server 1-2-2-4
// zei, en de eigen regel kreeg een vierde variant omdat ook `self.position`
// werd overschreven. De payloadvolgorde is nog steeds de leesvolgorde; het
// NUMMER komt uit `rank` (tussenstand) of `position` (eindstand).

/** De positie die de server aan deze rij gaf; `null` als hij niets meestuurde. */
function serverPosition(row) {
  if (Number.isInteger(row?.rank) && row.rank >= 1) return row.rank;
  if (Number.isInteger(row?.position) && row.position >= 1) return row.position;
  return null;
}

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
      // Terugvallen op de rijvolgorde alleen als de server niets zei — dat is
      // een oudere server of een onvolledige payload, geen normaal geval.
      position: serverPosition(row) ?? index + 1,
      playerId: row.playerId,
      effectiveName: typeof row.effectiveName === 'string' ? row.effectiveName : '',
      // spelersidentiteit.md, stap 5: het paar, niet gerenderde tekst — de
      // view rendert 'm zelf in de apptaal (identity-display.mjs) en valt
      // terug op `effectiveName` als deze `null` is.
      identity: row.identity ?? null,
      score: typeof row.score === 'number' ? row.score : 0,
      isSelf: row.playerId === selfId,
    }));

  const selfInTop = entries.find((e) => e.isSelf) ?? null;
  const self =
    payload?.self && typeof payload.self.playerId === 'string'
      ? Object.freeze({
          // De server stuurt de eigen positie mee (ook als je buiten de top
          // valt); die wint van wat er toevallig in de toplijst staat.
          position: serverPosition(payload.self) ?? (selfInTop !== null ? selfInTop.position : null),
          effectiveName: typeof payload.self.effectiveName === 'string' ? payload.self.effectiveName : '',
          identity: payload.self.identity ?? null,
          score: typeof payload.self.score === 'number' ? payload.self.score : 0,
        })
      : null;

  return Object.freeze({ entries: Object.freeze(entries), self });
}

/** De top 3 voor het podium; minder dan 3 spelers geeft een korter podium. */
export function podiumTop3(standings) {
  return standings.entries.slice(0, 3);
}

/**
 * Positieverschil per speler t.o.v. de vorige stand — gedeeld tussen S15's
 * bewegingsindicatie (`↑2`/`↓1`/`—`) en 07-reveal-en-sociale-headline.md's
 * comeback-detectie (prompt 08): één implementatie, niet twee lichtjes
 * verschillende. Puur: geen sessiestatus, geen eigen ranking, alleen het
 * verschil tussen twee al berekende `standingsFrom()`-uitkomsten.
 * @param {ReturnType<typeof standingsFrom> | null} previous null als er nog
 *   geen vorige stand is (bv. de eerste ronde).
 * @param {ReturnType<typeof standingsFrom>} current
 * @returns {Map<string, number>} playerId → positieverschil. Positief = omhoog
 *   (verbeterd), negatief = omlaag, geen entry = geen vorige positie om mee
 *   te vergelijken (nieuw binnengekomen speler, of geen vorige stand).
 */
export function rankMovementFrom(previous, current) {
  const movement = new Map();
  if (previous === null || previous === undefined || !Array.isArray(previous.entries)) {
    return movement;
  }
  const previousPositions = new Map(previous.entries.map((entry) => [entry.playerId, entry.position]));
  for (const entry of current.entries) {
    const previousPosition = previousPositions.get(entry.playerId);
    if (typeof previousPosition === 'number') {
      movement.set(entry.playerId, previousPosition - entry.position);
    }
  }
  return movement;
}
