// views/social-headline.mjs — UI3/UI4. S14: welke sociale headline (als er
// een is) hoort bij een afgesloten ronde. Puur, geen DOM, geen transport —
// zelfde stijl als round-model.mjs/standings-model.mjs.
//
// Client-side bouwbare condities uit 04's prioriteitslijst (zie
// 1-schermen-en-flow/prompts/07-reveal-en-sociale-headline.md voor de volle
// toelichting): (1) enige correct — alléén de self-variant (zie hieronder),
// (2) comeback, (4) iedereen correct, (5) iedereen fout, (6) opvallende
// misleider. Écht niet bouwbaar, blijft HANDOFF: (1) de niet-zelf-variant
// (welke ANDERE speler de enige correcte was — distribution bevat geen
// speleridentiteiten), (3) snelste speler (geen antwoordtijd zichtbaar voor
// andere clients), (7) streak (geen client heeft zicht op andermans streaks).
//
// Selectieregel (04): maximaal één headline, alleen als hij "werkelijk
// onderscheidend" is — vandaar de drempels hieronder (comeback ≥ 2 plaatsen,
// misleider minstens zo vaak gekozen als het juiste antwoord). Geen
// voorschrift in `04` voor de exacte drempelwaarde; dit is een eigen, expliciet
// benoemde keuze, geen giswerk over data die er niet is.

/**
 * @param {{
 *   distribution: Array<{optionId: string, count: number}>,
 *   correctOptionId: string,
 *   eligiblePlayerCount: number | null,
 *   movement: Map<string, number>,
 *   participants: Map<string, string>,
 *   selfCorrect: boolean | null,
 * }} input
 * @returns {
 *   | { type: 'self-sole-correct' }
 *   | { type: 'comeback', name: string, diff: number }
 *   | { type: 'everyone-correct' }
 *   | { type: 'everyone-wrong' }
 *   | { type: 'misleading-answer', optionId: string }
 *   | null
 * }
 */
export function socialHeadlineFor(input) {
  const distribution = Array.isArray(input?.distribution) ? input.distribution : [];
  const correctOptionId = typeof input?.correctOptionId === 'string' ? input.correctOptionId : null;
  const correctCount = distribution.find((row) => row?.optionId === correctOptionId)?.count ?? 0;
  const totalAnswers = distribution.reduce(
    (sum, row) => sum + (typeof row?.count === 'number' ? row.count : 0),
    0,
  );

  // (1) enige correct — alléén af te leiden als JÍJ die ene correcte speler
  // was (round:ended's eigen `ownCorrect`/`selfCorrect` is bekend, wélke
  // ANDERE speler het was — als het niet jezelf betreft — niet: distribution
  // telt alleen). Vandaar "self-sole-correct", geen naam nodig, het gaat over
  // de speler die dit scherm ziet.
  if (input?.selfCorrect === true && correctCount === 1) {
    return { type: 'self-sole-correct' };
  }

  // (2) comeback/grootste stijger — alleen als er daadwerkelijk een vorige
  // stand was om mee te vergelijken (movement niet leeg) én de stijging
  // minstens 2 plaatsen is (1 plaats is geen "werkelijk onderscheidend"
  // moment, dat gebeurt elke ronde wel ergens).
  const biggestClimb = biggestClimbFrom(input?.movement);
  if (biggestClimb !== null && biggestClimb.diff >= 2) {
    const name = input?.participants instanceof Map ? input.participants.get(biggestClimb.playerId) : undefined;
    if (typeof name === 'string' && name !== '') {
      return { type: 'comeback', name, diff: biggestClimb.diff };
    }
    // Geen naam bekend (bv. speler al vertrokken) — geen headline met een
    // lege naam, liever overslaan dan een kapotte zin tonen.
  }

  // (4) iedereen correct — vergeleken met eligiblePlayerCount, niet met het
  // totaal aantal gegeven antwoorden (dat zou ook vuren als bv. 2 van de 8
  // spelers antwoordden en beiden goed hadden).
  if (
    correctOptionId !== null &&
    typeof input?.eligiblePlayerCount === 'number' &&
    input.eligiblePlayerCount > 0 &&
    correctCount === input.eligiblePlayerCount
  ) {
    return { type: 'everyone-correct' };
  }

  // (5) iedereen fout — 0 op de correcte optie, én er is wél data (anders is
  // dit "niemand antwoordde", geen "iedereen fout").
  if (correctOptionId !== null && correctCount === 0 && totalAnswers > 0) {
    return { type: 'everyone-wrong' };
  }

  // (6) opvallende misleider — de foute optie met de hoogste telling, alleen
  // als die minstens zo vaak gekozen werd als het juiste antwoord (anders is
  // "1 speler had het mis" geen opvallende misleider, dat is normale ruis).
  const misleading = distribution
    .filter((row) => row?.optionId !== correctOptionId && typeof row?.count === 'number' && row.count > 0)
    .sort((a, b) => b.count - a.count)[0];
  if (misleading !== undefined && misleading.count >= correctCount) {
    return { type: 'misleading-answer', optionId: misleading.optionId };
  }

  return null;
}

function biggestClimbFrom(movement) {
  if (!(movement instanceof Map) || movement.size === 0) {
    return null;
  }
  let best = null;
  for (const [playerId, diff] of movement) {
    if (diff > 0 && (best === null || diff > best.diff)) {
      best = { playerId, diff };
    }
  }
  return best;
}
