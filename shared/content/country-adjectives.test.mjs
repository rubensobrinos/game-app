// Tests voor de ESM-mirror van server/data/country-adjectives.js (stap 3),
// gegenereerd door build-country-adjectives.mjs. Bewijst twee dingen: dat de
// mirror niet uit de pas is gaan lopen met zijn bron, en dat hij bruikbaar is
// voor de client (stap 4/5) — dezelfde koppeling die identity-word-lists.test.mjs
// al bewijst voor de woordenlijst.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { countryAdjectives } from './country-adjectives.mjs';
import { renderIdentityNl, renderIdentityEs } from '../../server/data/identity-render.js';

const require = createRequire(import.meta.url);

test('de ESM-mirror is byte-voor-byte gelijk aan server/data/country-adjectives.js — geen drift', () => {
  const { countryAdjectives: serverSource } = require('../../server/data/country-adjectives.js');
  assert.deepEqual(countryAdjectives, serverSource);
});

test('60 landen, elk met nl/en/es', () => {
  const keys = Object.keys(countryAdjectives);
  assert.equal(keys.length, 60);
  for (const iso2 of keys) {
    assert.match(iso2, /^[a-z]{2}$/, `"${iso2}" is geen 2 lowercase letters`);
    const entry = countryAdjectives[iso2];
    assert.ok('nl' in entry && 'en' in entry && 'es' in entry, `${iso2} mist een taal`);
  }
});

test('werkt samen met identity-render.js: een echte entry (bg) rendert correct in nl en es', () => {
  const bg = countryAdjectives.bg;
  assert.equal(
    renderIdentityNl({ countryName: 'Bulgarije', adjective: bg.nl, word: { text: 'Koe', gender: 'de' } }),
    'Bulgaarse Koe',
  );
  assert.equal(
    renderIdentityEs({ countryName: 'Bulgaria', adjective: bg.es, word: { text: 'vaca', gender: 'f' } }),
    'vaca búlgara',
  );
});
