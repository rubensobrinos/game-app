// i18n.mjs — UI0/UI1. Hergebruikt exact het patroon uit `app.js` (root van de
// repo, singleplayer-app, zie rond regel 630-650): `T[lang][key]`,
// `data-i18n`/`data-i18n-placeholder`-attributen, `applyI18n()`. Hier
// gescopet tot deze module in plaats van een globale `state`/`T`, zodat
// `frontend/` geen afhankelijkheid heeft op de singleplayer-app se globals.
//
// Dit is de taal van de app-UI zelf (menu's, knoppen, foutmeldingen) — niet
// de taal waarin vragen gesteld worden, dat is `host-setup-state`'s
// `config.language`, een aparte game-instelling. NL blijft leidend (als
// eerste vertaald en het meest compleet), maar EN/ES bestaan nu ook voor elke
// sleutel die al gebruikt wordt (`locales/en.mjs`, `locales/es.mjs`) — nieuwe
// schermen (UI2/UI5) voegen hun sleutels voortaan in alle drie tegelijk toe.

import { nl } from '../locales/nl.mjs';
import { en } from '../locales/en.mjs';
import { es } from '../locales/es.mjs';

const T = { nl, en, es };
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
 * Telbare tekst: kiest tussen `<key>.one` en `<key>.other` en vult `{n}` in.
 * Nodig omdat `${count} ${t('lobby.players')}` bij één speler "1 spelers"
 * opleverde — zichtbaar in de lobby, en `09-CONTENT-AND-MICROCOPY` §14 vraagt
 * expliciet om pluralisatie.
 *
 * Bewust minimaal: NL, EN en ES hebben alle drie exact twee vormen (één /
 * meer-dan-één), en 0 valt in alle drie onder `other` ("0 spelers", "0
 * players", "0 jugadores"). Komt er ooit een taal met meer vormen bij (Pools,
 * Arabisch), dan is `Intl.PluralRules` de vervanger — niet een derde sleutel
 * erbij verzinnen.
 *
 * @param {string} key sleutelbasis, zonder `.one`/`.other`
 * @param {number} count
 * @returns {string}
 */
export function tCount(key, count) {
  const form = count === 1 ? 'one' : 'other';
  const val = T[currentLang][`${key}.${form}`];
  return typeof val === 'string' ? val.replace('{n}', String(count)) : `${count} ${key}`;
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
