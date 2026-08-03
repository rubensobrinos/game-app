// views/participant-presentation.mjs — T5-9. Pure functie, geen DOM: bepaalt
// welke presentatievariant `lobby.mjs`'s deelnemerslijst moet tonen bij een
// gegeven spelersaantal, volgens `07-RESPONSIVE-HOST-PLAYER-MODES.md` §9's
// tabel. Drie bouwbare varianten (de tabel noemt zes rijen, maar 9–20/21–35
// en 36–100/100+ krijgen hier bewust dezelfde behandeling — zie het contract
// in `T5-9-spelerslijst-bij-schaal.md`): 'empty', 'rows' (1–8, bestaande
// weergave), 'grid' (9–35, compact grid), 'aggregate' (36+, totaal +
// recente joins + "bekijk alle spelers").

/**
 * @param {number} count
 * @returns {'empty' | 'rows' | 'grid' | 'aggregate'}
 */
export function participantPresentationFor(count) {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
    return 'empty';
  }
  if (count <= 8) {
    return 'rows';
  }
  if (count <= 35) {
    return 'grid';
  }
  return 'aggregate';
}
