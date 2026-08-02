'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeWhitespaceAndForm,
  stripControlAndFormatChars,
  truncateToVisibleLength,
  isProfane,
  makeUniqueInRoom,
  processChosenName,
  generateName,
} = require('./name-processing');

// PLACEHOLDER-testfixtures — zie docs/data-model-plan/prompts/DM4-name-processing.md
// "Contentgrens" (bevinding 14, REVIEW-DM2-DM9.md): welke woorden/talen op een
// woordenlijst staan is redactionele productcontent, geen technisch besluit van
// deze coderingsprompt. Deze objecten zijn UITSLUITEND testdata om de
// geïnjecteerde parameters van isProfane()/generateName() te kunnen testen —
// kleine, onschuldige woorden, geen productcontent, en NIET aanwezig in
// name-processing.js zelf.
const PLACEHOLDER_WORD_LISTS_FOR_TESTS_ONLY = {
  nl: { adjectives: ['Vrolijke', 'Snelle', 'Dappere'], animals: ['Otter', 'Vos', 'Uil'] },
  en: { adjectives: ['Happy', 'Swift', 'Brave'], animals: ['Otter', 'Fox', 'Owl'] },
  es: { adjectives: ['Feliz', 'Veloz', 'Valiente'], animals: ['Nutria', 'Zorro', 'Buho'] },
};

const PLACEHOLDER_PROFANITY_WORDS_FOR_TESTS_ONLY = {
  nl: ['flauwekul'],
  en: ['darn'],
  es: ['tonto'],
};

describe('normalizeWhitespaceAndForm — stap 1-2 (trim + NFKC), vast #1-2', () => {
  test('#1 trimt lead/trail whitespace', () => {
    assert.strictEqual(normalizeWhitespaceAndForm('   Sanne   '), 'Sanne');
  });

  test('#2 NFKC-normaliseert een decomposed accentteken naar composed vorm', () => {
    const decomposedE = 'e\u{0301}'; // 'e' (U+0065) + combining acute accent (U+0301)
    const composedE = '\u{00E9}'; // dezelfde letter als één codepoint (U+00E9)
    assert.strictEqual(normalizeWhitespaceAndForm(`caf${decomposedE}`), `caf${composedE}`);
  });
});

describe('stripControlAndFormatChars — stap 3, open default (Cc + Cf) #3-6', () => {
  test('#3 verwijdert een Cc control character (null byte)', () => {
    assert.strictEqual(stripControlAndFormatChars('Sa\u{0000}nne'), 'Sanne');
  });

  test('#4 verwijdert een Cf format character (zero-width space)', () => {
    assert.strictEqual(stripControlAndFormatChars('Sa\u{200B}nne'), 'Sanne');
  });

  test('#5 verwijdert een Cf format character (RTL-override)', () => {
    assert.strictEqual(stripControlAndFormatChars('Sanne\u{202E}'), 'Sanne');
  });

  test('#6 laat gewone zichtbare tekst ongemoeid', () => {
    assert.strictEqual(stripControlAndFormatChars('Sanne 2'), 'Sanne 2');
  });
});

describe('truncateToVisibleLength — stap 4 primitief, open default (grafeem-cluster) #7-9', () => {
  test('#7 knipt gewone ASCII-tekst af op maxVisible', () => {
    assert.strictEqual(truncateToVisibleLength('abcdefgh', 4), 'abcd');
  });

  test('#8 telt een combining-accentteken als één grafeem-cluster, niet als 2 codepoints', () => {
    const accentedE = 'e\u{0301}'; // 'e' + combining acute accent = 1 grafeem-cluster
    const decomposedAccentedText = `caf${accentedE}!`; // 6 codepoints, 5 grafeem-clusters: c,a,f,(e+accent),!
    // maxVisible=4 moet de accentletter volledig meenemen (niet middenin een
    // grafeem-cluster knippen — een naïeve codepoint-slice(0,4) zou hier "cafe"
    // opleveren, zonder het accent), en het uitroepteken weglaten. De functie
    // normaliseert niet, dus de verwachte uitkomst blijft in dezelfde
    // (decomposed) vorm als de invoer.
    assert.strictEqual(truncateToVisibleLength(decomposedAccentedText, 4), `caf${accentedE}`);
  });

  test('#9 telt een ZWJ-emojisequentie (familie-emoji) als één grafeem-cluster', () => {
    const zwj = '\u{200D}';
    const family = `\u{1F468}${zwj}\u{1F469}${zwj}\u{1F467}${zwj}\u{1F466}`; // man+ZWJ+vrouw+ZWJ+meisje+ZWJ+jongen
    const text = `${family}${family}${family}`; // 3 grafeem-clusters, veel meer codepoints
    assert.strictEqual(truncateToVisibleLength(text, 2), `${family}${family}`);
  });
});

describe('makeUniqueInRoom — stap 6, vast suffixformaat + open case-/accentvergelijking #10-14', () => {
  test('#10 geen botsing -> naam ongewijzigd', () => {
    assert.strictEqual(makeUniqueInRoom('Sanne', []), 'Sanne');
  });

  test('#11 "Sanne" + bestaande ["Sanne"] -> "Sanne 2" (letterlijk GAME-FLOW.md-voorbeeld)', () => {
    assert.strictEqual(makeUniqueInRoom('Sanne', ['Sanne']), 'Sanne 2');
  });

  test('#12 derde botsing -> "Sanne 3"', () => {
    assert.strictEqual(makeUniqueInRoom('Sanne', ['Sanne', 'Sanne 2']), 'Sanne 3');
  });

  test('#13 case-ongevoelige botsing: bestaande ["sanne"] botst met "Sanne"', () => {
    assert.strictEqual(makeUniqueInRoom('Sanne', ['sanne']), 'Sanne 2');
  });

  test('#14 accent-ongevoelige botsing: bestaande naam met accent botst met dezelfde naam zonder accent', () => {
    const composedNameWithAccent = `caf\u{00E9}`; // één samengestelde letter (U+00E9)
    assert.strictEqual(makeUniqueInRoom('cafe', [composedNameWithAccent]), 'cafe 2');
  });
});

describe('processChosenName — samenstelling van stap 1-4 en 6 (stap 5 bewust apart) #15-18', () => {
  test('#15 combineert trim, NFKC, strip en uniek-maken in één aanroep', () => {
    assert.strictEqual(processChosenName('  Sanne  ', 'nl', ['Sanne']), 'Sanne 2');
  });

  test('#16 <script>-achtige naam komt als inerte tekenreeks door de pijplijn (niet verwijderd of uitgevoerd)', () => {
    assert.strictEqual(processChosenName('<script>', 'nl', []), '<script>');
  });

  test('#17 zero-width-space wordt gestript als inert misbruikteken (stap 3), niet als "uitgevoerd"', () => {
    assert.strictEqual(processChosenName('Sa\u{200B}nne', 'nl', []), 'Sanne');
  });

  test('#18 RTL-override-teken wordt gestript als inert misbruikteken (stap 3)', () => {
    assert.strictEqual(processChosenName('Sanne\u{202E}', 'nl', []), 'Sanne');
  });
});

describe('isProfane — stap 5, apart aanroepbaar, contentgeïnjecteerd (bevinding 14) #19-22', () => {
  test('#19 woord uit de fixture-lijst voor de taal geeft true', () => {
    assert.strictEqual(isProfane('flauwekul', 'nl', PLACEHOLDER_PROFANITY_WORDS_FOR_TESTS_ONLY), true);
  });

  test('#20 niet-profaan woord geeft false', () => {
    assert.strictEqual(isProfane('onschuldig', 'nl', PLACEHOLDER_PROFANITY_WORDS_FOR_TESTS_ONLY), false);
  });

  test('#21 taal zonder fixture-entry geeft false, zonder te crashen', () => {
    assert.strictEqual(isProfane('flauwekul', 'de', PLACEHOLDER_PROFANITY_WORDS_FOR_TESTS_ONLY), false);
  });

  test('#22 lege/ontbrekende profanityWordsByLanguage geeft false, zonder te crashen', () => {
    assert.strictEqual(isProfane('flauwekul', 'nl', {}), false);
  });
});

describe('generateName — generator, contentgeïnjecteerd (bevinding 14) #23-29', () => {
  test('#23 kiest adjectief+dier uit de meegegeven wordListsByLanguage[language]', () => {
    const result = generateName('nl', PLACEHOLDER_WORD_LISTS_FOR_TESTS_ONLY, []);
    const [adjective, animal] = result.split(' ');
    assert.ok(PLACEHOLDER_WORD_LISTS_FOR_TESTS_ONLY.nl.adjectives.includes(adjective));
    assert.ok(PLACEHOLDER_WORD_LISTS_FOR_TESTS_ONLY.nl.animals.includes(animal));
  });

  test('#24 adjectief+dier-alias wordt uniek gemaakt bij botsing', () => {
    const singleWordList = { nl: { adjectives: ['Vrolijke'], animals: ['Otter'] } };
    const result = generateName('nl', singleWordList, ['Vrolijke Otter']);
    assert.strictEqual(result, 'Vrolijke Otter 2');
  });

  test('#25 ontbrekende taal-entry valt terug op "Speler {n}"', () => {
    assert.strictEqual(generateName('de', PLACEHOLDER_WORD_LISTS_FOR_TESTS_ONLY, []), 'Speler 1');
  });

  test('#26 lege adjectives/animals-lijst voor de taal valt terug op "Speler {n}"', () => {
    const emptyList = { nl: { adjectives: [], animals: [] } };
    assert.strictEqual(generateName('nl', emptyList, ['a', 'b']), 'Speler 3');
  });

  test('#27 onvolledige lijst (alleen adjectives, geen animals) valt terug op "Speler {n}"', () => {
    const incompleteList = { nl: { adjectives: ['Vrolijke'], animals: [] } };
    assert.strictEqual(generateName('nl', incompleteList, []), 'Speler 1');
  });

  test('#28 ontbrekende wordListsByLanguage ({}) valt terug op "Speler {n}"', () => {
    assert.strictEqual(generateName('nl', {}, []), 'Speler 1');
  });

  test('#29 "Speler {n}"-fallback wordt eveneens uniek gemaakt bij botsing', () => {
    // n = existingEffectiveNames.length + 1 = 2, wat toevallig al bestaat ->
    // makeUniqueInRoom voegt de suffix toe.
    assert.strictEqual(generateName('de', {}, ['Speler 2']), 'Speler 2 2');
  });
});

describe('invoervalidatie — TypeError bij ongeldige typen #30-34', () => {
  test('#30 normalizeWhitespaceAndForm(niet-string) -> TypeError', () => {
    assert.throws(() => normalizeWhitespaceAndForm(123), TypeError);
  });

  test('#31 truncateToVisibleLength(niet-string, n) -> TypeError', () => {
    assert.throws(() => truncateToVisibleLength(null, 4), TypeError);
  });

  test('#32 makeUniqueInRoom(naam, niet-array) -> TypeError', () => {
    assert.throws(() => makeUniqueInRoom('Sanne', 'niet-een-array'), TypeError);
  });

  test('#33 isProfane(niet-string tekst, ...) -> TypeError', () => {
    assert.throws(() => isProfane(123, 'nl', {}), TypeError);
  });

  test('#34 generateName(niet-string taal, ...) -> TypeError', () => {
    assert.throws(() => generateName(123, {}, []), TypeError);
  });
});
