// session/passport-tracker.mjs — besluit 53 (docs/openstaand/paspoort.md).
// De brug tussen de eventstroom (session/events.mjs, `round:ended`) en het
// per-apparaat paspoort (client/flow/passport-store.mjs).
//
// BEWUST GEEN prop die door session-shell.mjs heen moet: dit is modulestate,
// geschreven door events.mjs (round:ended, game:started/-rematch-started) en
// gelezen door podium.mjs — geen van beide hoeft van de ander te weten. Zelfde
// soort keuze als `state.roundModel` in events.mjs, alleen dan buiten die
// ene grote `state`-zak, want het paspoort overleeft bewust een hele
// paginalaad (via localStorage) en niet alleen deze sessie.
//
// "Elk land dat je zag telt" (besluit 53, "De besluiten"): dat is dus niet
// per se hetzelfde als `correctAnswer` — bij hoger/lager en "welke hoort er
// niet bij" zijn er meerdere ECHTE landen in beeld, niet één target.
// `iso2sSeenInRound` hieronder is de ene plek die per gameType weet wélke
// iso2's een speler daadwerkelijk te zien kreeg.

import { recordCountrySeen, loadPassport } from '../../../client/flow/passport-store.mjs';

let seenThisMatch = [];
let passportBeforeMatch = new Set();

/**
 * Bepaalt welke landen een speler in déze ronde daadwerkelijk te zien kreeg,
 * uit de vorm die `round:started`'s `question` per gameType heeft
 * (PROTOCOL.md) en de `correctAnswer` uit `round:ended`.
 *
 * - flags_mc/capitals_mc/country_shape_mc: één target (`correctAnswer.optionId`).
 * - real_or_fake_flag: één echt land, alleen als de vraag ook echt was —
 *   een gegenereerde (nep)vlag hoort bij geen enkel land.
 * - higher_lower: BEIDE kanten van het duel, dat waren twee echte vlaggen.
 * - odd_one_out: elke kaart met een `iso2` (een gegenereerde kaart heeft
 *   `spec` i.p.v. `iso2` en telt niet mee — geen bestaand land).
 *
 * @param {string | null} gameType
 * @param {object | null} question - `round-model.mjs`'s `model.question`
 *   (dus vóórdat `round:ended` het overschrijft — zie `passport-tracker`'s
 *   aanroeper in events.mjs)
 * @param {object | null | undefined} correctAnswer - `round:ended`'s `payload.correctAnswer`
 * @returns {string[]} iso2's, kleine letters, kan leeg zijn
 */
export function iso2sSeenInRound(gameType, question, correctAnswer) {
  if (gameType === 'flags_mc' || gameType === 'capitals_mc' || gameType === 'country_shape_mc') {
    return typeof correctAnswer?.optionId === 'string' ? [correctAnswer.optionId.toLowerCase()] : [];
  }
  if (gameType === 'real_or_fake_flag') {
    return correctAnswer?.choice === 'real' && typeof question?.iso2 === 'string'
      ? [question.iso2.toLowerCase()]
      : [];
  }
  if (gameType === 'higher_lower') {
    const sides = Array.isArray(question?.sides) ? question.sides : [];
    return sides.map((kant) => kant?.iso2).filter((iso2) => typeof iso2 === 'string').map((iso2) => iso2.toLowerCase());
  }
  if (gameType === 'odd_one_out') {
    const cards = Array.isArray(question?.cards) ? question.cards : [];
    return cards.map((kaart) => kaart?.iso2).filter((iso2) => typeof iso2 === 'string').map((iso2) => iso2.toLowerCase());
  }
  return [];
}

/**
 * Bij het begin van een match (`game:started`/`game:rematch-started`):
 * "vanavond" begint opnieuw te tellen, en het paspoort van vóór deze match
 * wordt bevroren als vergelijkingsbasis voor "nieuw" op het podium.
 * @param {{getItem:(k:string)=>string|null}} storage
 */
export function resetPassportForNewMatch(storage) {
  seenThisMatch = [];
  passportBeforeMatch = new Set(Object.keys(loadPassport(storage)));
}

/**
 * Bij elke `round:ended`: tekent de geziene landen in het per-apparaat
 * paspoort in en telt ze mee voor "vanavond".
 * @param {{getItem:(k:string)=>string|null, setItem:(k:string,v:string)=>void}} storage
 * @param {string | null} gameType
 * @param {object | null} question
 * @param {object | null | undefined} correctAnswer
 */
export function recordRoundEndedForPassport(storage, gameType, question, correctAnswer) {
  for (const iso2 of iso2sSeenInRound(gameType, question, correctAnswer)) {
    recordCountrySeen(storage, iso2, Date.now());
    if (!seenThisMatch.includes(iso2)) {
      seenThisMatch.push(iso2);
    }
  }
}

/**
 * Voor het podium: de regel "Je hebt er nu 47 van de 230 gezien", de
 * vlaggenrij van vanavond, en welke daarvan voor het eerst ooit gezien zijn.
 * @param {{getItem:(k:string)=>string|null}} storage
 * @returns {{ totalSeen: number, seenThisMatch: string[], newThisMatch: string[] }}
 */
export function passportSummaryForPodium(storage) {
  const passport = loadPassport(storage);
  return {
    totalSeen: Object.keys(passport).length,
    seenThisMatch: [...seenThisMatch],
    newThisMatch: seenThisMatch.filter((iso2) => !passportBeforeMatch.has(iso2)),
    // Punt 1.16: de kaart toont álles wat je ooit zag, niet alleen vanavond —
    // dat is wat een paspoort tot een paspoort maakt.
    allSeen: Object.keys(passport),
  };
}
