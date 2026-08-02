'use strict';

// Naamverwerking uit docs/multiplayer/DATA-MODEL.md, sectie "Naamverwerking" (de
// zeven stappen + generator-eisen), uitgewerkt volgens
// docs/data-model-plan/prompts/DM4-name-processing.md. Pure functies: geen I/O,
// geen Redis, geen dependency (Intl.Segmenter en Unicode-property-regexes zijn
// Node-native).
//
// Elke functie hieronder is in commentaar gemarkeerd als (a) VAST — letterlijk uit
// de brondocumentatie — of (c) OPEN DEFAULT — een gedocumenteerde, laag-risico
// keuze die met één regel te wijzigen is, geen ADR nodig (zie DM4-name-
// processing.md, "Wat vast ligt" resp. "Wat open blijft"). De twee categorieën
// worden nergens stilzwijgend vermengd.
//
// CONTENTGRENS (bevinding 14, REVIEW-DM2-DM9.md): profanitylijsten en
// adjectief/dier-woordenlijsten per taal zijn redactionele productcontent, geen
// technisch besluit van deze module. isProfane() en generateName() nemen die
// content daarom als parameter (dependency injection) aan. Dit bestand bevat zelf
// GEEN woord uit enige taal — met uitzondering van het letterlijke `Speler {n}`-
// fallbackformaat, dat geen contentlijst is maar een vast, in GAME-FLOW.md
// Randgeval 5 letterlijk voorgeschreven stringformaat (zie generateName()
// hieronder).
//
// Stap 7 ("uitsluitend als tekst renderen") is een contractvereiste voor de
// renderlaag, geen transformatie hier — deze module doet bewust GEEN HTML-
// escaping. Namen komen als kale, ongeëscapete strings terug; de garantie dat ze
// nooit als markup worden geïnterpreteerd hoort bij clientcode (tekstnodes, geen
// innerHTML), niet bij dit bestand.

/** (c) OPEN DEFAULT: max. zichtbare tekens uit stap 4 — de waarde zelf ("20") ligt
 *  vast, de definitie van "zichtbaar teken" (grafeem-cluster, zie
 *  truncateToVisibleLength) is de open keuze. */
const MAX_VISIBLE_NAME_LENGTH = 20;

/** (c) OPEN DEFAULT: control/format-tekenset voor stap 3 — Unicode-categorieën Cc
 *  (control) en Cf (format, o.a. zero-width-tekens en RTL/LTR-override-tekens).
 *  Dit is de standaardinterpretatie van "control characters" in tekstverwerking en
 *  dekt ook de onzichtbare-misbruiktekens die PROTOCOL.md §Inputveiligheid noemt. */
const CONTROL_AND_FORMAT_CHARS = /[\p{Cc}\p{Cf}]/gu;

/** (c) OPEN DEFAULT: diacritics-tekenset voor normalizeForComparison — Unicode-
 *  categorie M (Mark: Mn/Mc/Me). Na NFKD-normalisatie vallen accenttekens uiteen
 *  in een basisletter + los "Mark"-teken; dit verwijdert dat losse teken zodat
 *  bv. "café" en "cafe" als dezelfde naam tellen (zie stap 6, case-/
 *  accentgevoeligheid). */
const DIACRITIC_MARKS = /\p{M}/gu;

/**
 * Werpt TypeError als value geen string is.
 * @param {string} name - parameternaam, voor de foutmelding
 * @param {unknown} value
 * @returns {string}
 */
function assertString(name, value) {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string, got: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Werpt TypeError als value geen array is (van strings).
 * @param {string} name - parameternaam, voor de foutmelding
 * @param {unknown} value
 * @returns {string[]}
 */
function assertStringArray(name, value) {
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    throw new TypeError(`${name} must be an array of strings, got: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * (a) VAST — stappen 1-2 uit DATA-MODEL.md §Naamverwerking. Letterlijk uit
 * DM4-name-processing.md overgenomen.
 * @param {string} input - ruwe, door de speler ingevoerde naam
 * @returns {string}
 */
function normalizeWhitespaceAndForm(input) {
  assertString('input', input);
  return input.trim().normalize('NFKC');
}

/**
 * (c) OPEN DEFAULT — stap 3. Verwijdert Unicode-categorieën Cc en Cf (zie
 * CONTROL_AND_FORMAT_CHARS hierboven voor de motivatie).
 * @param {string} text
 * @returns {string}
 */
function stripControlAndFormatChars(text) {
  assertString('text', text);
  return text.replace(CONTROL_AND_FORMAT_CHARS, '');
}

/**
 * (a) VAST structuur / (c) OPEN DEFAULT invulling — stap 4 (deels), primitief.
 * Knipt af op maxVisible grafeem-clusters, niet Unicode-codepoints: gebruikt
 * `Intl.Segmenter` (Node-native, geen dependency) zodat een samengesteld teken
 * (bv. een accentteken opgebouwd uit basisletter + combining mark, of een
 * ZWJ-emojisequentie) als één zichtbaar teken telt, ook als het uit meerdere
 * codepoints bestaat. Doet geen validatie op maxVisible, alleen transformatie
 * (zie DM4-name-processing.md: "Doet geen validatie, alleen transformatie").
 * @param {string} text
 * @param {number} maxVisible
 * @returns {string}
 */
function truncateToVisibleLength(text, maxVisible) {
  assertString('text', text);
  const segmenter = new Intl.Segmenter();
  const clusters = Array.from(segmenter.segment(text), (s) => s.segment);
  return clusters.slice(0, maxVisible).join('');
}

/**
 * (c) OPEN DEFAULT — helper voor stap 6 (uniciteit) en stap 5 (profanity):
 * case- en accent-ongevoelige vergelijkingssleutel (NFKD + diacritics strippen +
 * lowercase), zodat bv. "Sanne"/"sanne" en "café"/"cafe" als hetzelfde tellen.
 * Niet geëxporteerd — puur intern hulpmiddel.
 * @param {string} text
 * @returns {string}
 */
function normalizeForComparison(text) {
  return text
    .normalize('NFKD')
    .replace(DIACRITIC_MARKS, '')
    .toLowerCase();
}

/**
 * (a) VAST — stap 6, suffixformaat bevestigd door GAME-FLOW.md Randgeval 4:
 * "Sanne" + bestaande ["Sanne"] -> "Sanne 2"; een derde botsing -> "Sanne 3".
 * Spatie + oplopend getal, beginnend bij 2 voor de tweede botsing.
 * (c) OPEN DEFAULT: de botsingsvergelijking zelf is case-/accent-ongevoelig, zie
 * normalizeForComparison hierboven.
 * @param {string} candidateName
 * @param {string[]} existingEffectiveNames - reeds actieve namen in de room
 * @returns {string}
 */
function makeUniqueInRoom(candidateName, existingEffectiveNames) {
  assertString('candidateName', candidateName);
  assertStringArray('existingEffectiveNames', existingEffectiveNames);

  const takenKeys = new Set(existingEffectiveNames.map(normalizeForComparison));
  if (!takenKeys.has(normalizeForComparison(candidateName))) {
    return candidateName;
  }

  let suffix = 2;
  let attempt;
  do {
    attempt = `${candidateName} ${suffix}`;
    suffix += 1;
  } while (takenKeys.has(normalizeForComparison(attempt)));

  return attempt;
}

/**
 * (a) VAST structuur (apart aanroepbaar, niet verweven in processChosenName) /
 * (c) OPEN DEFAULT matching-algoritme — stap 5. Eenvoudige, case-/accent-
 * ongevoelige substring-match ("eenvoudige profanitycheck" uit DATA-MODEL.md),
 * geen tokenisatie/woordgrenzen. `profanityWordsByLanguage` is contentbeslissing,
 * niet gedefinieerd in deze module (bevinding 14, zie module-top-commentaar) — een
 * ontbrekende of lege lijst voor een taal geeft altijd `false`, zonder te
 * crashen: de module kent, kiest of verzint zelf geen woorden.
 *
 * Bewust NIET verweven in processChosenName: een profane genormaliseerde naam
 * moet tot een nieuwe generatie leiden, niet tot een throw midden in de
 * pijplijn. De aanroeper (buiten deze module, in de join-flow) beslist wat er
 * gebeurt bij een profane treffer.
 *
 * @param {string} text - reeds genormaliseerde naam (stappen 1-4 toegepast)
 * @param {string} language - taalcode, bijv. 'nl', 'en', 'es'
 * @param {Record<string, string[]>} profanityWordsByLanguage - contentbeslissing,
 *   zie module-top-commentaar; bijv. { nl: [...], en: [...], es: [...] }
 * @returns {boolean}
 */
function isProfane(text, language, profanityWordsByLanguage) {
  assertString('text', text);
  assertString('language', language);

  const words = profanityWordsByLanguage == null ? undefined : profanityWordsByLanguage[language];
  if (!Array.isArray(words) || words.length === 0) {
    return false;
  }

  const normalizedText = normalizeForComparison(text);
  return words.some((word) => normalizedText.includes(normalizeForComparison(word)));
}

/**
 * Samenstellende functie: combineert stappen 1-4 en 6 uit DATA-MODEL.md
 * §Naamverwerking (trim + NFKC, control/format-tekens strippen, truncatie op
 * MAX_VISIBLE_NAME_LENGTH zichtbare tekens, uniek maken binnen de room). Stap 5
 * (profanity) zit hier bewust NIET in — zie isProfane hierboven voor waarom
 * (apart aanroepbaar, geen throw midden in de pijplijn).
 *
 * @param {string} rawInput - ruwe, door de speler ingevoerde naam
 * @param {string} language - taalcode; momenteel ongebruikt in deze functie
 *   omdat stap 5 (profanity, de enige taalafhankelijke stap) hier bewust niet in
 *   zit — wel onderdeel van de in DM4-name-processing.md vastgelegde signatuur,
 *   voor symmetrie met isProfane()/generateName().
 * @param {string[]} existingEffectiveNames - reeds actieve namen in de room
 * @returns {string}
 */
function processChosenName(rawInput, language, existingEffectiveNames) {
  assertString('language', language);

  const normalized = normalizeWhitespaceAndForm(rawInput);
  const stripped = stripControlAndFormatChars(normalized);
  const truncated = truncateToVisibleLength(stripped, MAX_VISIBLE_NAME_LENGTH);
  return makeUniqueInRoom(truncated, existingEffectiveNames);
}

/**
 * (c) OPEN DEFAULT: "n" in het Speler {n}-fallbackformaat = aantal reeds actieve
 * namen + 1. Niet letterlijk vastgelegd in DATA-MODEL.md/GAME-FLOW.md welk getal
 * "n" precies is — laag-risico default, met één regel te wijzigen.
 * makeUniqueInRoom() in generateName() vangt een eventuele botsing alsnog op.
 * @param {string[]} existingEffectiveNames
 * @returns {string}
 */
function fallbackPlayerLabel(existingEffectiveNames) {
  return `Speler ${existingEffectiveNames.length + 1}`;
}

/**
 * Generator voor automatisch gegenereerde namen. Kiest adjectief+dier uit de
 * meegegeven `wordListsByLanguage[language]`; valt terug op het letterlijke
 * `Speler {n}`-formaat (GAME-FLOW.md Randgeval 5 — een vast stringformaat, geen
 * per-taal contentlijst, zie module-top-commentaar) wanneer die taal geen lijst
 * heeft (ontbrekende of lege `adjectives`/`animals`-entry in
 * `wordListsByLanguage`). Past daarna altijd `makeUniqueInRoom` toe. De module
 * kiest of kent zelf geen woorden — welk adjectief/dier gekozen wordt komt
 * uitsluitend uit de meegegeven lijst (bevinding 14).
 *
 * @param {string} language - taalcode
 * @param {Record<string, { adjectives: string[], animals: string[] }>} wordListsByLanguage
 *   contentbeslissing, niet gedefinieerd in deze module (zie module-top-commentaar)
 * @param {string[]} existingEffectiveNames - reeds actieve namen in de room
 * @returns {string}
 */
function generateName(language, wordListsByLanguage, existingEffectiveNames) {
  assertString('language', language);
  assertStringArray('existingEffectiveNames', existingEffectiveNames);

  const list = wordListsByLanguage == null ? undefined : wordListsByLanguage[language];
  const hasUsableList =
    list != null &&
    Array.isArray(list.adjectives) &&
    list.adjectives.length > 0 &&
    Array.isArray(list.animals) &&
    list.animals.length > 0;

  const candidate = hasUsableList
    ? `${list.adjectives[Math.floor(Math.random() * list.adjectives.length)]} ${
        list.animals[Math.floor(Math.random() * list.animals.length)]
      }`
    : fallbackPlayerLabel(existingEffectiveNames);

  return makeUniqueInRoom(candidate, existingEffectiveNames);
}

module.exports = {
  normalizeWhitespaceAndForm,
  stripControlAndFormatChars,
  truncateToVisibleLength,
  isProfane,
  makeUniqueInRoom,
  processChosenName,
  generateName,
};
