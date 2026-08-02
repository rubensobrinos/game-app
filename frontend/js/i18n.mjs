// i18n.mjs — UI0. Hergebruikt exact het patroon uit `app.js` (root van de
// repo, singleplayer-app, zie rond regel 630-650): `T[lang][key]`,
// `data-i18n`/`data-i18n-placeholder`-attributen, `applyI18n()`. Hier
// gescopet tot deze module in plaats van een globale `state`/`T`, zodat
// `frontend/` geen afhankelijkheid heeft op de singleplayer-app se globals.
//
// NL is leidend voor UI0 (`locales/nl.mjs`); EN/ES volgen in UI1b — vandaar
// dat `T` hier nog maar één taal bevat.

import { nl } from '../locales/nl.mjs';

const T = { nl };
const DEFAULT_LANG = 'nl';

let currentLang = DEFAULT_LANG;

/** @param {string} lang */
export function setLang(lang) {
  currentLang = Object.prototype.hasOwnProperty.call(T, lang) ? lang : DEFAULT_LANG;
}

/** @returns {string} */
export function getLang() {
  return currentLang;
}

/** @param {string} key @returns {string} */
export function t(key) {
  const val = T[currentLang][key];
  return typeof val === 'string' ? val : key;
}

/**
 * Zelfde tweestaps-DOM-scan als `app.js`'s `applyI18n()`: vult `textContent`
 * voor elk `[data-i18n]`-element en `placeholder` voor elk
 * `[data-i18n-placeholder]`-element. Nooit `innerHTML` — vertaalteksten zijn
 * hier weliswaar geen gebruikersinvoer, maar dit bestand zet uit voorzorg
 * dezelfde precedent als de rest van `frontend/`.
 */
export function applyI18n() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const val = T[currentLang][key];
    if (typeof val === 'string') {
      el.textContent = val;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    const val = T[currentLang][key];
    if (typeof val === 'string') {
      el.placeholder = val;
    }
  });
}
