'use strict';

// name-word-lists.js — stap 1 uit docs/openstaand/spelersidentiteit.md.
//
// `generateName(language, wordListsByLanguage, existingEffectiveNames)`
// (name-processing.js) bestaat al en werkt, maar `server/index.mjs` gaf tot nu
// toe geen `nameWordLists` mee aan de context — de generator viel daardoor in
// productie altijd terug op het letterlijke "Speler {n}"-format. Dit bestand
// is de kortste weg naar echte namen: twintig adjectieven + twintig dieren per
// taal, in precies de vorm die `generateName` al verwacht
// (`{ adjectives: string[], animals: string[] }`, zie name-processing.js).
//
// DIT IS NIET de landbijvoeglijke identiteit uit besluit 41 ("Bulgaarse Koe",
// zie identity-render.js voor die grammatica) — dat is een aparte, latere
// stap die deze generieke "Vlugge Vos"-generator uiteindelijk vervangt.
// Contentgrens (zelfde als name-processing.js, bevinding 14): dit is de
// enige plek in de repo die deze specifieke woordenlijst kiest; de generator
// zelf kent of verzint geen woorden.
//
// (c) OPEN DEFAULT, geen ADR: de woordkeuze zelf. Voor het Nederlands is
// bewust gekozen voor uitsluitend de-woorden (Vos, Uil, ...) — `generateName`
// plakt adjectief + dier zonder geslachtsverbuiging (`${adjectief}
// ${dier}`), dus een het-woord (bv. "Konijn") zou met een altijd-verbogen
// adjectief een grammaticale misser geven ("Vlugge Konijn" i.p.v. "Vlug
// Konijn"). Voor het Spaans is bewust gekozen voor adjectieven die niet naar
// geslacht verbuigen (veloz/veloz, niet búlgaro/búlgara) — om dezelfde reden:
// deze generator kent geen geslacht van het dier, dus moet het adjectief
// onveranderlijk zijn om nooit fout te staan.

/** @type {string[]} */
const NL_ADJECTIVES = [
  'Vlugge', 'Slimme', 'Dappere', 'Rustige', 'Gouden', 'Wakkere', 'Vrolijke',
  'Snelle', 'Stoere', 'Stille', 'Felle', 'Trotse', 'Listige', 'Speelse',
  'Frisse', 'Gretige', 'Zonnige', 'Wijze', 'Kranige', 'Stralende',
];

/** @type {string[]} Uitsluitend de-woorden, zie de moduledoc hierboven. */
const NL_ANIMALS = [
  'Vos', 'Uil', 'Leeuw', 'Reiger', 'Das', 'Havik', 'Otter', 'Wolf', 'Beer',
  'Adelaar', 'Kraai', 'Zwaan', 'Haas', 'Egel', 'Kat', 'Hond', 'Python',
  'Octopus', 'Panter', 'Valk',
];

/** @type {string[]} */
const EN_ADJECTIVES = [
  'Swift', 'Clever', 'Brave', 'Calm', 'Golden', 'Alert', 'Cheerful', 'Quick',
  'Sturdy', 'Quiet', 'Fierce', 'Proud', 'Cunning', 'Playful', 'Fresh',
  'Eager', 'Sunny', 'Wise', 'Sharp', 'Radiant',
];

/** @type {string[]} */
const EN_ANIMALS = [
  'Fox', 'Owl', 'Lion', 'Heron', 'Badger', 'Hawk', 'Otter', 'Wolf', 'Bear',
  'Eagle', 'Crow', 'Swan', 'Hare', 'Hedgehog', 'Cat', 'Dog', 'Python',
  'Octopus', 'Panther', 'Falcon',
];

/** @type {string[]} Geslachtsonveranderlijke vormen, zie de moduledoc hierboven. */
const ES_ADJECTIVES = [
  'Veloz', 'Feliz', 'Valiente', 'Audaz', 'Fuerte', 'Alegre', 'Dulce',
  'Gentil', 'Vigilante', 'Radiante', 'Elegante', 'Inteligente', 'Amable',
  'Leal', 'Constante', 'Brillante', 'Ágil', 'Especial', 'Genial', 'Sutil',
];

/** @type {string[]} */
const ES_ANIMALS = [
  'Zorro', 'Búho', 'León', 'Nutria', 'Tejón', 'Halcón', 'Lobo', 'Oso',
  'Cuervo', 'Cisne', 'Liebre', 'Erizo', 'Gato', 'Perro', 'Pulpo', 'Pantera',
  'Águila', 'Jaguar', 'Puma', 'Colibrí',
];

/**
 * @type {Record<'nl'|'en'|'es', { adjectives: string[], animals: string[] }>}
 */
const nameWordLists = {
  nl: { adjectives: NL_ADJECTIVES, animals: NL_ANIMALS },
  en: { adjectives: EN_ADJECTIVES, animals: EN_ANIMALS },
  es: { adjectives: ES_ADJECTIVES, animals: ES_ANIMALS },
};

module.exports = { nameWordLists };
