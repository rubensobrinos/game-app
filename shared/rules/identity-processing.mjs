// identity-processing.mjs — stap 4 uit docs/openstaand/spelersidentiteit.md.
//
// In shared/rules/ (niet server/data/) omdat zowel de server
// (server/composition/room/deelnemers.mjs) als de mock
// (frontend/js/mock/names.mjs, stap 5 — solo/mock moet hetzelfde
// uniciteitsgedrag tonen als de echte server) dezelfde paar-kiezer nodig
// hebben. Zelfde afweging als shared/rules/ranking.mjs: gedeelde PURE
// LOGICA, geen content (dat staat in shared/content/) en geen server-only
// I/O — vandaar shared/rules/, niet shared/content/.
//
// DE VALKUIL waar dit bestand voor bestaat: `makeUniqueInRoom`
// (name-processing.js) werkt op GERENDERDE tekst en plakt er een cijfer
// achter bij een botsing. Een identiteit wordt per client in zijn eigen
// apptaal gerenderd (`identity-render.js`) — twee spelers met hetzelfde
// `{ country, word }`-paar zouden op een Nederlandse telefoon allebei
// "Bulgaarse Koe" heten, en op een Spaanse allebei "vaca búlgara", zonder dat
// de tekst-uniciteitscheck er ooit iets van zou merken (elke client rendert
// zijn eigen bots-vrije tekst uit hetzelfde paar). Uniek zijn moet dus over
// het PAAR gaan, `country + word`, vóór er ook maar iets gerenderd is.
//
// CONTENTGRENS (zelfde als de andere identity-bestanden): dit bestand kent
// geen land, geen woord — alleen de SLEUTELS die de aanroeper meegeeft
// (`countryPool`: iso2-codes, `wordPool`: identity-word-sleutels zoals
// 'cow'). Puur functies, geen I/O — zelfde stijl als
// server/rules/question-selection.js: willekeur komt altijd binnen als een
// `random: () => number`-parameter ([0, 1)-contract), en kandidaten worden
// eerst berekend, pas dan gekozen.
//
// Bewust GEEN cijfer-suffix op het paar bij uitputting (zoals
// `makeUniqueInRoom` dat op tekst doet): met 60 landen × 12 woorden = 720
// paren en een roomlimiet van 100 spelers is uitputting praktisch
// onbereikbaar. Raakt de pool ooit toch op, dan geeft `pickIdentity` `null`
// terug — de aanroeper valt dan terug op de gegenereerde naam zónder
// identiteit (nooit een halve of dubbele identiteit).

const MAX_ATTEMPTS = 50;

/**
 * @typedef {{ country: string, word: string }} Identity
 */

/**
 * Vergelijkingssleutel voor een identiteitspaar — puur structureel (geen
 * taal, geen gerenderde tekst), zie de moduledoc hierboven.
 * @param {Identity} identity
 * @returns {string}
 */
export function identityKey(identity) {
  return `${identity.country}:${identity.word}`;
}

/**
 * Kiest een willekeurig, binnen `existingIdentities` nog ongebruikt
 * `{ country, word }`-paar. `null` als er geen bruikbare pool is of als de
 * pool binnen `MAX_ATTEMPTS` pogingen uitgeput blijkt (zie moduledoc) — de
 * aanroeper beslist zelf wat er dan gebeurt, deze functie verzint nooit een
 * paar buiten de opgegeven pools.
 *
 * @param {string[]} countryPool - iso2-codes met een landbijvoeglijke vorm
 *   (bv. `Object.keys(countryAdjectives)`)
 * @param {string[]} wordPool - identity-word-sleutels
 *   (bv. `Object.keys(identityWords)`)
 * @param {Identity[]} existingIdentities - reeds toegekende paren in de room
 * @param {() => number} [random] - contract gelijk aan Math.random: [0, 1)
 * @returns {Identity | null}
 */
export function pickIdentity(countryPool, wordPool, existingIdentities, random = Math.random) {
  if (!Array.isArray(countryPool) || !Array.isArray(wordPool)) {
    throw new TypeError('countryPool and wordPool must be arrays');
  }
  if (!Array.isArray(existingIdentities)) {
    throw new TypeError('existingIdentities must be an array');
  }
  if (countryPool.length === 0 || wordPool.length === 0) {
    return null;
  }

  const taken = new Set(existingIdentities.map(identityKey));
  const capacity = countryPool.length * wordPool.length;
  const attempts = Math.min(MAX_ATTEMPTS, capacity);

  for (let i = 0; i < attempts; i += 1) {
    const candidate = {
      country: countryPool[Math.floor(random() * countryPool.length)],
      word: wordPool[Math.floor(random() * wordPool.length)],
    };
    if (!taken.has(identityKey(candidate))) {
      return candidate;
    }
  }
  return null;
}
