// identity-word-lists.mjs — stap 4 uit docs/openstaand/spelersidentiteit.md.
//
// In shared/content/ (niet server/data/) omdat zowel de server
// (server/index.mjs, via een dynamische import — zie daar) als de client
// (client/flow/identity-render.mjs, stap 5) dezelfde woordtekst+geslacht
// nodig hebben om een `{ country, word }`-paar te renderen: de server voor
// de servertalige afdruk (effectiveName-terugval), de client om het paar in
// zijn EIGEN apptaal te tonen (punt 8). Eén bron, geen twee lijsten die uit
// elkaar kunnen lopen — zelfde afweging als shared/content/countries.data.mjs.
//
// CONTENTGRENS (zelfde grens als country-adjectives.js/identity-render.js):
// dit bestand bevat UITSLUITEND data, geen grammatica. `identity-render.js`
// (stap 2, af) verwacht een `IdentityWord = { text: string, gender?: 'de' |
// 'het' | 'm' | 'f' }` per taal — dat geslacht ontbrak tot nu toe: de oudere
// `name-word-lists.js` (stap 1) koos zijn dieren bewust ALLEMAAL de-woorden
// en geslachtsonveranderlijke Spaanse vormen, juist om zonder geslacht te
// kunnen. Voor de landbijvoeglijke identiteit ("Bulgaarse Koe", "Bulgaars
// Konijn") is geslacht juist het punt — zonder een het-woord in de lijst zou
// de NL-verbuiging (identity-render.js §renderIdentityNl) nooit in productie
// worden geoefend, alleen in zijn eigen tests.
//
// Twaalf speelse woorden, elk met een stabiele sleutel (Engelse, kleine
// letters) — dezelfde soort sleutel als landen op iso2 leunen. Die sleutel is
// wat over de lijn gaat (`identity.word`), nooit de gerenderde tekst (zie
// identity-processing.js voor waarom: uniciteit gaat over het paar).
// Bewuste mix van NL de/het en ES m/v, zodat beide verbuigingspaden van
// identity-render.js in een echt potje voorkomen, niet alleen in de tests.

/**
 * @typedef {{
 *   nl: { text: string, gender: 'de' | 'het' },
 *   en: { text: string },
 *   es: { text: string, gender: 'm' | 'f' },
 * }} IdentityWordEntry
 */

/** @type {Record<string, IdentityWordEntry>} */
export const identityWords = {
  cow: { nl: { text: 'Koe', gender: 'de' }, en: { text: 'Cow' }, es: { text: 'vaca', gender: 'f' } },
  rabbit: { nl: { text: 'Konijn', gender: 'het' }, en: { text: 'Rabbit' }, es: { text: 'conejo', gender: 'm' } },
  penguin: { nl: { text: 'Pinguïn', gender: 'de' }, en: { text: 'Penguin' }, es: { text: 'pingüino', gender: 'm' } },
  sheep: { nl: { text: 'Schaap', gender: 'het' }, en: { text: 'Sheep' }, es: { text: 'oveja', gender: 'f' } },
  fox: { nl: { text: 'Vos', gender: 'de' }, en: { text: 'Fox' }, es: { text: 'zorro', gender: 'm' } },
  owl: { nl: { text: 'Uil', gender: 'de' }, en: { text: 'Owl' }, es: { text: 'lechuza', gender: 'f' } },
  goat: { nl: { text: 'Geit', gender: 'de' }, en: { text: 'Goat' }, es: { text: 'cabra', gender: 'f' } },
  hedgehog: { nl: { text: 'Egel', gender: 'de' }, en: { text: 'Hedgehog' }, es: { text: 'erizo', gender: 'm' } },
  duck: { nl: { text: 'Eend', gender: 'de' }, en: { text: 'Duck' }, es: { text: 'pato', gender: 'm' } },
  turtle: { nl: { text: 'Schildpad', gender: 'de' }, en: { text: 'Turtle' }, es: { text: 'tortuga', gender: 'f' } },
  llama: { nl: { text: 'Lama', gender: 'de' }, en: { text: 'Llama' }, es: { text: 'llama', gender: 'f' } },
  parrot: { nl: { text: 'Papegaai', gender: 'de' }, en: { text: 'Parrot' }, es: { text: 'perico', gender: 'm' } },
};
