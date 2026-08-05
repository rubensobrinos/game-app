'use strict';

// identity-render.js — stap 2 uit docs/openstaand/spelersidentiteit.md, de
// grammatica-basis voor besluit 41 (spelersidentiteit: land + speels woord,
// in de bijvoeglijke vorm — "Bulgaarse Koe", DECISIONS.md #41).
//
// CONTENTGRENS (zelfde grens als name-processing.js, bevinding 14): dit
// bestand kent GEEN land, GEEN landbijvoeglijk naamwoord en GEEN speels
// woord. De landbijvoeglijke content (stap 3, redactiewerk) en de
// woordenlijst komen als parameter binnen. Wat hier vastligt is uitsluitend
// de GRAMMATICA: welke vorm bij welk woordgeslacht hoort, in welke volgorde
// de twee delen staan, en wat er gebeurt als een vorm ontbreekt.
//
// Drie losse functies i.p.v. één dispatcher met een `language`-parameter: de
// drie talen delen geen structuur om over te dispatchen. Nederlands kiest op
// het geslacht van het WOORD (de/het); Spaans kiest ook op geslacht (m/v) én
// draait de woordvolgorde om (woord vóór bijvoeglijk naamwoord); Engels kent
// geen geslacht. Eén dispatcher zou de illusie wekken dat er één regel is met
// taalspecifieke uitzonderingen — het zijn drie losse regels.
//
// (a) VAST — terugval uit besluit 41 ("Open bij de bouw", voorstel regie,
// bevestigd in spelersidentiteit.md): ontbreekt de bijvoeglijke vorm (of
// specifiek de vorm voor het geslacht van dit woord) voor een land in een
// taal, dan valt elke rendermodule terug op de "uit"-vorm — nooit een lege
// naam. name-word-lists.js (stap 1) is hier bewust los van: dat is de andere,
// oudere generator (geen land, geen geslacht) die dit uiteindelijk vervangt.

/**
 * Het speelse woord (dier of iets anders geks) dat met een land wordt
 * samengevoegd. `gender` bepaalt in het Nederlands ('de'/'het') en Spaans
 * ('m'/'f') welke bijvoeglijke vorm van het land hoort te worden gebruikt.
 * Engels negeert `gender` volledig (geen verbuiging) — meegeven mag, maar is
 * dan zonder effect.
 *
 * @typedef {{ text: string, gender?: 'de' | 'het' | 'm' | 'f' }} IdentityWord
 */

/**
 * De landbijvoeglijke vorm(en) voor één taal. Een kale string is een
 * geslachtsonveranderlijke vorm (bv. Spaans "canadiense", dat niet verbuigt)
 * en geldt voor elk woordgeslacht. Een object met specifieke sleutels
 * ('de'/'het' voor nl, 'm'/'f' voor es) hoort bij een taal waar de vorm wél
 * van het woordgeslacht afhangt (bv. "Bulgaarse"/"Bulgaars",
 * "búlgaro"/"búlgara") — besluit 41 noemt dit expliciet "één of twee
 * bijvoeglijke vormen" per taal. Een ontbrekende sleutel binnen zo'n object
 * is hetzelfde als volledig ontbrekend: de terugval treedt op.
 *
 * @typedef {string | Partial<Record<'de'|'het'|'m'|'f', string>>} AdjectiveForm
 */

/**
 * @typedef {{ countryName: string, adjective?: AdjectiveForm, word: IdentityWord }} RenderIdentityInput
 * `countryName` is de kale landnaam in de doeltaal (bv. "Bulgarije"), gebruikt
 * in de terugvalvorm — dus NIET dezelfde string als `adjective`.
 */

/**
 * @param {string} name - parameternaam, voor de foutmelding
 * @param {unknown} value
 * @returns {string}
 */
function assertNonEmptyString(name, value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string, got: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * @param {string} name - parameternaam, voor de foutmelding
 * @param {unknown} value
 * @returns {IdentityWord}
 */
function assertWord(name, value) {
  if (value === null || typeof value !== 'object' || typeof value.text !== 'string' || value.text.length === 0) {
    throw new TypeError(`${name} must be an { text: string } object, got: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Zoekt, gegeven een `AdjectiveForm` en het geslacht van het woord, de te
 * gebruiken bijvoeglijke vorm op. `null` betekent: geen bruikbare vorm, de
 * aanroeper valt terug op de "uit"-vorm. Een lege string telt als ontbrekend
 * (nooit " Koe" met een lege vorm ervoor).
 *
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
 * NL — (a) VAST volgorde/terugval uit besluit 41: bijvoeglijk naamwoord vóór
 * het woord ("Bulgaarse Koe", "Bulgaars Konijn"); ontbreekt de vorm voor dit
 * woordgeslacht, dan "Koe uit Bulgarije". (c) OPEN DEFAULT: het woordgeslacht
 * ('de'/'het') is letterlijk de sleutel waarmee de vorm wordt opgezocht — de
 * kortste correcte koppeling tussen woordgeslacht en bijvoeglijke vorm, geen
 * aparte mapping nodig.
 *
 * @param {RenderIdentityInput} input
 * @returns {string}
 */
function renderIdentityNl({ countryName, adjective, word }) {
  assertNonEmptyString('countryName', countryName);
  assertWord('word', word);

  const form = resolveGenderedForm(adjective, word.gender);
  if (form === null) {
    return `${word.text} uit ${countryName}`;
  }
  return `${form} ${word.text}`;
}

/**
 * EN — (a) VAST uit besluit 41: geen verbuiging nodig, bijvoeglijk naamwoord
 * vóór het woord ("Bulgarian Cow"); ontbreekt de vorm, dan "Cow from
 * Bulgaria".
 *
 * @param {RenderIdentityInput} input
 * @returns {string}
 */
function renderIdentityEn({ countryName, adjective, word }) {
  assertNonEmptyString('countryName', countryName);
  assertWord('word', word);

  const form = resolveGenderedForm(adjective, word.gender);
  if (form === null) {
    return `${word.text} from ${countryName}`;
  }
  return `${form} ${word.text}`;
}

/**
 * ES — (a) VAST uit besluit 41: mannelijk/vrouwelijk ("búlgaro"/"búlgara"),
 * bijvoeglijk naamwoord NÁ het woord ("vaca búlgara", "pingüino peruano" —
 * omgekeerde volgorde t.o.v. nl/en); ontbreekt de vorm, dan "vaca de
 * Bulgaria".
 *
 * @param {RenderIdentityInput} input
 * @returns {string}
 */
function renderIdentityEs({ countryName, adjective, word }) {
  assertNonEmptyString('countryName', countryName);
  assertWord('word', word);

  const form = resolveGenderedForm(adjective, word.gender);
  if (form === null) {
    return `${word.text} de ${countryName}`;
  }
  return `${word.text} ${form}`;
}

module.exports = {
  renderIdentityNl,
  renderIdentityEn,
  renderIdentityEs,
};
