// views/country-names.test.mjs — de opzoektabellen (land/hoofdstad per iso2)
// en de richtingsberekening voor capitals_mc (besluit 49,
// docs/openstaand/hoger-lager-en-hoofdsteden.md). Geen DOM nodig: dit
// bestand is puur data-opzoek + een pure hashfunctie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryName, capitalName, capitalsQuestionDirection, flagAssetPath } from './country-names.mjs';

test('capitalName levert de hoofdstad per taal, hoofdletterongevoelig', () => {
  assert.equal(capitalName('fr', 'nl'), 'Parijs');
  assert.equal(capitalName('FR', 'nl'), 'Parijs', 'iso2 is hoofdletterongevoelig, zelfde als countryName');
  assert.equal(capitalName('fr', 'en'), 'Paris');
  assert.equal(capitalName('fr', 'es'), 'París');
});

test('capitalName valt terug op de (genormaliseerde) iso2 bij een onbekend land', () => {
  assert.equal(capitalName('zz', 'nl'), 'zz');
  assert.equal(capitalName('ZZ', 'nl'), 'zz');
});

test('capitalName en countryName zijn verschillende opzoektabellen (nooit per ongeluk hetzelfde antwoord)', () => {
  assert.notEqual(capitalName('fr', 'nl'), countryName('fr', 'nl'));
});

test('capitalsQuestionDirection is deterministisch: zelfde input, zelfde uitkomst', () => {
  const a = capitalsQuestionDirection('fr', ['fr', 'de', 'es', 'it']);
  const b = capitalsQuestionDirection('fr', ['fr', 'de', 'es', 'it']);
  assert.equal(a, b);
  assert.ok(a === 'ask-capital' || a === 'ask-country');
});

test('capitalsQuestionDirection levert beide richtingen op, afhankelijk van de optieset', () => {
  // Zelfde land, verschillende optiesets (zoals bij twee verschillende
  // rondes met dezelfde target maar andere afleiders/volgorde) kunnen een
  // andere richting geven — de richting hangt niet uitsluitend van het land af.
  assert.equal(capitalsQuestionDirection('fr', ['fr', 'de', 'es', 'it']), 'ask-capital');
  assert.equal(capitalsQuestionDirection('pe', ['pe', 'at', 'lv', 'lb']), 'ask-country');
});

test('capitalsQuestionDirection hangt af van de volledige optieset, niet uitsluitend van targetIso2', () => {
  // Zelfde land ('fr'), twee verschillende afleiderssets (zoals twee losse
  // rondes met Frankrijk als target zouden opleveren) geven een andere
  // richting — anders zou een land bij elke herhaling altijd dezelfde
  // richting krijgen, wat de opzet juist wil voorkomen (zie de moduledoc).
  assert.equal(capitalsQuestionDirection('fr', ['fr', 'de', 'es', 'it']), 'ask-capital');
  assert.equal(capitalsQuestionDirection('fr', ['fr', 'pt', 'nl', 'be']), 'ask-country');
});

test('flagAssetPath blijft ongewijzigd werken (regressiebewaking bij het toevoegen van capitalName)', () => {
  assert.equal(flagAssetPath('FR'), 'flags/fr.png');
});
