// views/country-names.mjs — UI3/UI4. Eén opzoektabel iso2 → landnaam uit de
// gedeelde contentmodule. Payload-iso2's kunnen uppercase zijn ('FR'), de pool
// en de vlag-assets zijn lowercase ('fr', flags/fr.png) — dit is de ene plek
// die dat normaliseert.

import { getCountryPool } from '../../../shared/content/index.mjs';

let cache = null;

function table() {
  if (cache === null) {
    cache = new Map();
    for (const entry of getCountryPool()) {
      cache.set(entry.iso2, entry.name);
    }
  }
  return cache;
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

/** Pad naar de bestaande vlag-assets (lowercase-conventie). */
export function flagAssetPath(iso2) {
  return `flags/${String(iso2).toLowerCase()}.png`;
}
