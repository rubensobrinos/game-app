// client/flow/identity-render.mjs — ESM-poort van server/data/identity-render.js
// (stap 2, spelersidentiteit.md, af) voor de client — stap 5: "elke client
// rendert het paar in zijn eigen apptaal" (punt 8). De server kan die
// CommonJS-bron zelf niet aan een browser leveren (geen bundelaar, zie
// shared/content/build-shapes.mjs voor dezelfde afweging bij een ander
// bestand), dus hier staat dezelfde grammatica nogmaals — bewust NIET de
// data (die staat één keer, in shared/content/, zie
// frontend/js/views/identity-display.mjs voor de dispatcher die alles
// samenbrengt).
//
// Drie losse functies i.p.v. één dispatcher: zelfde reden als de server-
// versie — nl kiest op het geslacht van het WOORD (de/het), es kiest ook op
// geslacht (m/v) én draait de woordvolgorde om, en kent geen geslacht. Eén
// dispatcher zou de illusie wekken dat er één regel is met taalspecifieke
// uitzonderingen; het zijn drie losse regels.
//
// (a) VAST — terugval: ontbreekt de bijvoeglijke vorm (of specifiek de vorm
// voor het geslacht van dit woord), dan valt elke rendermodule terug op de
// "uit"-vorm — nooit een lege naam. Zelfde regel als de server, want de data
// (shared/content/country-adjectives.mjs) is dezelfde en kan dus dezelfde
// gaten hebben.

/**
 * @typedef {{ text: string, gender?: 'de' | 'het' | 'm' | 'f' }} IdentityWord
 * @typedef {string | Partial<Record<'de'|'het'|'m'|'f', string>>} AdjectiveForm
 * @typedef {{ countryName: string, adjective?: AdjectiveForm, word: IdentityWord }} RenderIdentityInput
 */

function assertNonEmptyString(name, value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string, got: ${JSON.stringify(value)}`);
  }
  return value;
}

function assertWord(name, value) {
  if (value === null || typeof value !== 'object' || typeof value.text !== 'string' || value.text.length === 0) {
    throw new TypeError(`${name} must be an { text: string } object, got: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * @param {AdjectiveForm | undefined} adjective
 * @param {string | undefined} gender
 * @returns {string | null}
 */
function resolveGenderedForm(adjective, gender) {
  if (typeof adjective === 'string') {
    return adjective.length > 0 ? adjective : null;
  }
  if (adjective === null || typeof adjective !== 'object' || gender === undefined) {
    return null;
  }
  const value = adjective[gender];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * NL — bijvoeglijk naamwoord vóór het woord ("Bulgaarse Koe", "Bulgaars
 * Konijn"); ontbreekt de vorm voor dit woordgeslacht, dan "Koe uit Bulgarije".
 * @param {RenderIdentityInput} input
 * @returns {string}
 */
export function renderIdentityNl({ countryName, adjective, word }) {
  assertNonEmptyString('countryName', countryName);
  assertWord('word', word);

  const form = resolveGenderedForm(adjective, word.gender);
  if (form === null) {
    return `${word.text} uit ${countryName}`;
  }
  return `${form} ${word.text}`;
}

/**
 * EN — geen verbuiging nodig, bijvoeglijk naamwoord vóór het woord
 * ("Bulgarian Cow"); ontbreekt de vorm, dan "Cow from Bulgaria".
 * @param {RenderIdentityInput} input
 * @returns {string}
 */
export function renderIdentityEn({ countryName, adjective, word }) {
  assertNonEmptyString('countryName', countryName);
  assertWord('word', word);

  const form = resolveGenderedForm(adjective, word.gender);
  if (form === null) {
    return `${word.text} from ${countryName}`;
  }
  return `${form} ${word.text}`;
}

/**
 * ES — mannelijk/vrouwelijk ("búlgaro"/"búlgara"), bijvoeglijk naamwoord NÁ
 * het woord ("vaca búlgara", "pingüino peruano"); ontbreekt de vorm, dan
 * "vaca de Bulgaria".
 * @param {RenderIdentityInput} input
 * @returns {string}
 */
export function renderIdentityEs({ countryName, adjective, word }) {
  assertNonEmptyString('countryName', countryName);
  assertWord('word', word);

  const form = resolveGenderedForm(adjective, word.gender);
  if (form === null) {
    return `${word.text} de ${countryName}`;
  }
  return `${word.text} ${form}`;
}
