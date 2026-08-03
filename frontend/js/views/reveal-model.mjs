// views/reveal-model.mjs — UI3. S13's opbouwvolgorde, puur, geen DOM (zelfde
// stijl als round-model.mjs). Twee zichtbare stappen na `round:ended`:
// resultaat (correct antwoord, eigen keuze, label, punten — die vier horen
// bij hetzelfde moment, zie hieronder) en, na een korte vertraging, hooguit
// één sociale headline.
//
// 04 vraagt zes deelstappen; hier zijn het er twee, om twee redenen:
//
// 1. Zonder motion-tokens (thema 3 levert die pas) voegt een aparte timer
//    tussen "correct antwoord krijgt focus", "eigen keuze gemarkeerd" en
//    "resultaatlabel/punten" niets toe — dat zijn tekstwissels op hetzelfde
//    moment, geen drie apart waarneembare stappen.
// 2. Rankbeweging kan hier NIET als losse stap staan: `round:ended` (waarop
//    dit reageert) komt vóór `scoreboard:updated` (transport-mock.mjs:
//    ROUND_RESULT_MS ertussen) — de bijgewerkte stand voor déze ronde bestaat
//    dus nog niet op het moment dat dit scherm 'm zou moeten tonen. Wat hier
//    getoond zou worden is alleen de beweging van de VORIGE ronde, wat
//    verwarrend en onjuist is. De rankbeweging-stap landt daarom waar de data
//    wél al klopt: scoreboard.mjs, dat toch al als eerstvolgend scherm mount
//    zodra `scoreboard:updated` binnenkomt (S15, 08-leaderboard-en-podium.md)
//    — de volgorde (resultaat vóór beweging) loopt zo over twee schermen
//    i.p.v. gepropt in één, maar klopt nog steeds.
//
// Geen eigen timer hier (ARCHITECTURE.md principe 2, zelfde discipline als
// `secondsRemaining()`): de aanroeper onthoudt wanneer het resultaat van déze
// ronde voor het eerst verscheen (lokale `Date.now()` — dit is een puur
// pacing-detail voor dit ene scherm, geen servergesynchroniseerd moment zoals
// de rondetimer, dus geen `offsetMs` nodig) en geeft bij elke tick het
// verstreken aantal ms door.

// 03 §6: reveal 1,0–1,8s — zelfde orde van grootte, geen motion-tokens dus
// een vaste waarde i.p.v. een curve.
const HEADLINE_REVEAL_DELAY_MS = 1400;

/**
 * @param {number | null} elapsedMs ms sinds het resultaat van déze ronde verscheen
 * @param {boolean} [skipped] tik-om-te-skippen gaf
 * @returns {boolean} of de sociale headline (indien aanwezig) al getoond mag worden
 */
export function headlineRevealed(elapsedMs, skipped = false) {
  if (skipped === true) {
    return true;
  }
  return typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs >= HEADLINE_REVEAL_DELAY_MS;
}
