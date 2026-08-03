// sound-cues.mjs — geluidsfundament (BOUWSPRINT, 06 §5 event/warning-
// categorieën). Legt de cue-punten vast als één klein, getest oppervlak in
// plaats van los verspreide `new Audio()`-aanroepen door `views/`:
//
//   - join     (E03, categorie "event")   — nieuwe speler in de lobby
//   - urgent   (E07, categorie "warning") — laatste ~2 seconden van een ronde
//   - reveal   (E09, categorie "event")   — ronde-uitslag verschijnt
//
// Geen assets. Geluidsarchitectuur (mixer, categorieën, eerste-activatie-
// beleid) zit vast op `O-008` (zie 3-beweging-en-gevoel/PROGRESS.md,
// "Geluidsarchitectuur") — dit bestand bouwt daar niet omheen. `playCue()`
// is een stille placeholder: 'm aanroepen is altijd veilig (geen crash, geen
// geluid), zodat call-sites nu al op hun plek kunnen staan en het inpluggen
// van echte assets later geen nieuwe aanroeppunten hoeft te zoeken.
//
// Mute (M4, `preferences.mjs`'s `loadMuted`) wordt hier al gerespecteerd,
// ook al is er nog niets te dempen — zodat de mute-toggle straks meteen
// werkt voor elke cue die hierna een asset krijgt, i.p.v. per cue apart
// onthouden te worden.

import { loadMuted } from './preferences.mjs';

const CUE_NAMES = new Set(['join', 'urgent', 'reveal']);

/**
 * @param {'join'|'urgent'|'reveal'} name
 * @param {{getItem:(k:string)=>string|null}} storage
 * @returns {boolean} of de cue (in principe) had mogen klinken — puur voor
 *   tests; zegt niets over of er daadwerkelijk geluid was (dat bestaat nog
 *   niet).
 */
export function playCue(name, storage) {
  if (!CUE_NAMES.has(name)) {
    return false;
  }
  if (loadMuted(storage) === true) {
    return false;
  }
  // Stille placeholder: hier komt `new Audio(assetFor(name)).play()` zodra
  // O-008 beslist is en er assets zijn (06 §5). Bewust geen `console.log` of
  // ander bijeffect — een cue-punt moet onhoorbaar te testen zijn zonder dat
  // de afwezigheid van geluid zelf al ruis wordt.
  return true;
}

/** @returns {ReadonlyArray<string>} de bestaande cue-namen, voor tests/call-sites. */
export function cueNames() {
  return Object.freeze([...CUE_NAMES]);
}
