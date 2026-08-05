'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { nameWordLists } = require('./name-word-lists');
const { generateName } = require('./name-processing');

const LANGUAGES = ['nl', 'en', 'es'];

describe('nameWordLists — vorm, precies wat generateName verwacht #1-5', () => {
  test('#1. bevat exact nl/en/es, geen extra of ontbrekende taal', () => {
    assert.deepEqual(Object.keys(nameWordLists).sort(), [...LANGUAGES].sort());
  });

  for (const language of LANGUAGES) {
    test(`#2 (${language}). adjectives en animals zijn allebei arrays van minstens twintig niet-lege strings`, () => {
      const { adjectives, animals } = nameWordLists[language];
      for (const list of [adjectives, animals]) {
        assert.ok(Array.isArray(list));
        assert.ok(list.length >= 20, `verwacht >= 20, kreeg ${list.length}`);
        for (const word of list) {
          assert.equal(typeof word, 'string');
          assert.ok(word.length > 0, 'geen lege string in de lijst');
        }
      }
    });

    test(`#3 (${language}). geen dubbele woorden binnen adjectives, en geen binnen animals`, () => {
      const { adjectives, animals } = nameWordLists[language];
      assert.equal(new Set(adjectives).size, adjectives.length, 'dubbel adjectief');
      assert.equal(new Set(animals).size, animals.length, 'dubbel dier');
    });
  }

  test('#4. nl/en bevatten geen enkel woord met een spatie of leesteken (blijft één woord per slot)', () => {
    for (const language of ['nl', 'en']) {
      const { adjectives, animals } = nameWordLists[language];
      for (const word of [...adjectives, ...animals]) {
        assert.doesNotMatch(word, /[\s,.]/, `"${word}" (${language}) bevat een spatie/leesteken`);
      }
    }
  });

  test('#5. es-adjectieven zijn geslachtsonveranderlijk: geen enkele eindigt op -o of -a (zie moduledoc)', () => {
    for (const word of nameWordLists.es.adjectives) {
      assert.doesNotMatch(
        word,
        /[oa]$/i,
        `"${word}" eindigt op -o/-a — generateName plakt zonder geslachtsverbuiging, dit adjectief hoort onveranderlijk te zijn`,
      );
    }
  });
});

describe('generateName + nameWordLists — de "Speler {n}"-terugval is niet meer de enige uitkomst #6-7', () => {
  for (const language of LANGUAGES) {
    test(`#6 (${language}). generateName produceert honderd keer op rij een echte naam, nooit "Speler {n}"`, () => {
      for (let i = 0; i < 100; i += 1) {
        const name = generateName(language, nameWordLists, []);
        assert.doesNotMatch(name, /^Speler \d+$/, `kreeg de fallback i.p.v. een echte naam: "${name}"`);
      }
    });
  }

  test('#7. de gegenereerde naam bestaat uit precies een woord uit adjectives gevolgd door een woord uit animals', () => {
    const name = generateName('nl', nameWordLists, []);
    const [adjective, animal] = name.split(' ');
    assert.ok(nameWordLists.nl.adjectives.includes(adjective), `"${adjective}" staat niet in adjectives`);
    assert.ok(nameWordLists.nl.animals.includes(animal), `"${animal}" staat niet in animals`);
  });
});
