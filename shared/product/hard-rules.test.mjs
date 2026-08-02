import test from 'node:test';
import assert from 'node:assert/strict';

import { HARD_RULES } from './hard-rules.mjs';

test('HARD_RULES bevat exact 3 items', () => {
  assert.equal(HARD_RULES.length, 3);
});

test('HARD_RULES heeft de exacte ids in de juiste volgorde', () => {
  assert.deepEqual(
    HARD_RULES.map((rule) => rule.id),
    ['no-mandatory-account', 'always-visible-name', 'own-phone-only'],
  );
});

test('de text van elk item is exact gelijk aan de brontekst uit PRODUCT.md', () => {
  const expectedTexts = {
    'no-mandatory-account':
      'Iedere gebruiker kan binnen enkele seconden een game starten of joinen zonder account, e-mailadres of andere verplichte registratie.',
    'always-visible-name':
      'Iedere speler heeft tijdens het spel een zichtbare naam. Zelf invullen is optioneel; bij een leeg veld genereert de server direct een unieke naam. Een host hoeft alleen een spelersnaam te hebben wanneer die zelf meespeelt.',
    'own-phone-only':
      'Elke rol werkt volledig op een eigen telefoon. Een laptop, televisie, beamer of centraal scherm mag de ervaring verbeteren, maar is nooit vereist.',
  };

  for (const rule of HARD_RULES) {
    assert.equal(rule.text, expectedTexts[rule.id]);
  }
});
