// views/streak-model.mjs — 11-verzoek (BOUWSPRINT doel 4). Puur, geen DOM,
// zelfde stijl als reveal-model.mjs. Houdt een lopende teller bij van
// opeenvolgende eigen `selfCorrect`-rondes (GAME-RULES.md §Reactiezinnen en
// streaks: "draaien per speler", "mogen client-side worden bepaald uit
// serverresultaten") — reset naar 0 bij een foute of geen-antwoord-ronde.
//
// Bewust GEEN onderdeel van round-model.mjs: dat model wordt bij elke
// `round:started` volledig vervangen (`{...initialRoundModel(), ...}`), dus
// heeft geen geschiedenis over rondes heen. Dit model leeft daarom op
// sessieniveau (session-shell.mjs), niet in gameplay.mjs's eigen closure —
// die wordt elke ronde opnieuw gemount zodra de tussenstand-fase ertussen zit
// (routeToView()/mountView()), en zou een lokale teller dus elke ronde
// verliezen.

/** @returns {{ current: number }} */
export function initialStreakModel() {
  return Object.freeze({ current: 0 });
}

/**
 * `round:ended` — bijwerken met het resultaat van déze speler in déze ronde.
 * @param {{ current: number }} model
 * @param {boolean} selfCorrect
 * @returns {{ current: number }}
 */
export function applyRoundResult(model, selfCorrect) {
  return Object.freeze({ current: selfCorrect === true ? model.current + 1 : 0 });
}
