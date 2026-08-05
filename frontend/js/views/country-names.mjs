// views/country-names.mjs — UI3/UI4. Eén opzoektabel iso2 → landnaam uit de
// gedeelde contentmodule. Payload-iso2's kunnen uppercase zijn ('FR'), de pool
// en de vlag-assets zijn lowercase ('fr', flags/fr.png) — dit is de ene plek
// die dat normaliseert.

import { getCountryPool } from '../../../shared/content/index.mjs';

let cache = null;
let capitalCache = null;

function table() {
  if (cache === null) {
    cache = new Map();
    for (const entry of getCountryPool()) {
      cache.set(entry.iso2, entry.name);
    }
  }
  return cache;
}

function capitalTable() {
  if (capitalCache === null) {
    capitalCache = new Map();
    for (const entry of getCountryPool()) {
      capitalCache.set(entry.iso2, entry.capital);
    }
  }
  return capitalCache;
}

/**
 * @param {string} iso2 - hoofdletterongevoelig
 * @param {string} lang - 'nl' | 'en' | 'es'
 * @returns {string} landnaam, of de (genormaliseerde) iso2 als onbekend
 */
export function countryName(iso2, lang = 'nl') {
  const key = typeof iso2 === 'string' ? iso2.toLowerCase() : '';
  const names = table().get(key);
  return names ? (names[lang] ?? names.nl) : key;
}

/**
 * Besluit 49 (docs/openstaand/hoger-lager-en-hoofdsteden.md) — hoofdsteden.
 * Zelfde opzoekpatroon als `countryName`, nu op `entry.capital`. `capital` mag
 * `null` zijn (CONTENT-POOL-INTERFACE.md gotcha 1: expliciet, geen
 * ontbrekende key) — dan valt dit terug op de iso2, net als `countryName` bij
 * een onbekend land.
 * @param {string} iso2 - hoofdletterongevoelig
 * @param {string} lang - 'nl' | 'en' | 'es'
 * @returns {string} hoofdstadnaam, of de (genormaliseerde) iso2 als onbekend/null
 */
export function capitalName(iso2, lang = 'nl') {
  const key = typeof iso2 === 'string' ? iso2.toLowerCase() : '';
  const capitals = capitalTable().get(key);
  return capitals ? (capitals[lang] ?? capitals.nl) : key;
}

/**
 * Welke richting een `capitals_mc`-vraag toont: "Wat is de hoofdstad van
 * {land}?" (`ask-capital`, de opties tonen hoofdsteden) of "{hoofdstad} hoort
 * bij welk land?" (`ask-country`, de opties tonen landnamen) — de omgekeerde
 * vraag die de producteigenaar expliciet vroeg naast de gewone (besluit 49).
 *
 * BEWUST client-side afgeleid uit `targetIso2`+`optionIso2s` (die de server
 * en de mock al identiek leveren, zelfde vorm als `flags_mc`) i.p.v. een
 * eigen `direction`-veld op de payload: dat zou `isValidFlagsOrCapitalsMcQuestion`
 * (server/protocol/server-events-round-lifecycle.mjs, strikt op precies
 * `{targetIso2, optionIso2s}`) breken voor `flags_mc` mee, want die validator
 * is gedeeld. Zo blijft de richting gegarandeerd gelijk voor elke speler in
 * dezelfde ronde (dezelfde payload → dezelfde uitkomst) en varieert hij per
 * ronde — ook voor hetzelfde land — omdat `optionIso2s` (afleiders +
 * volgorde) elke ronde opnieuw willekeurig is.
 * @param {string} targetIso2
 * @param {string[]} optionIso2s
 * @returns {'ask-capital' | 'ask-country'}
 */
export function capitalsQuestionDirection(targetIso2, optionIso2s) {
  const opties = Array.isArray(optionIso2s) ? optionIso2s : [];
  const key = `${String(targetIso2)}:${opties.join('')}`;
  let som = 0;
  for (let i = 0; i < key.length; i += 1) {
    som += key.charCodeAt(i);
  }
  return som % 2 === 0 ? 'ask-capital' : 'ask-country';
}

/** Pad naar de bestaande vlag-assets (lowercase-conventie). */
export function flagAssetPath(iso2) {
  return `flags/${String(iso2).toLowerCase()}.png`;
}
