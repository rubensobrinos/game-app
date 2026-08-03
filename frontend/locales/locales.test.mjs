// locales.test.mjs — bewaakt dat nl/en/es niet uit de pas lopen. Ontbrekende
// sleutels vallen in i18n.mjs's `t()` stil terug op de sleutel zelf (zie die
// module) — dat is een bewuste, veilige fallback, geen reden om drift hier
// onopgemerkt te laten. Zie reviewfeedback T4-1 punt 7.

import test from 'node:test';
import assert from 'node:assert/strict';
import { nl } from './nl.mjs';
import { en } from './en.mjs';
import { es } from './es.mjs';

const LOCALES = { nl, en, es };

test('elke taal heeft evenveel sleutels', () => {
  const counts = Object.fromEntries(Object.entries(LOCALES).map(([lang, table]) => [lang, Object.keys(table).length]));
  assert.equal(counts.en, counts.nl, `en heeft ${counts.en} sleutels, nl heeft ${counts.nl}`);
  assert.equal(counts.es, counts.nl, `es heeft ${counts.es} sleutels, nl heeft ${counts.nl}`);
});

test('elke sleutel uit nl bestaat ook in en en es', () => {
  const missing = { en: [], es: [] };
  for (const key of Object.keys(nl)) {
    if (!(key in en)) missing.en.push(key);
    if (!(key in es)) missing.es.push(key);
  }
  assert.deepEqual(missing.en, [], `en mist: ${missing.en.join(', ')}`);
  assert.deepEqual(missing.es, [], `es mist: ${missing.es.join(', ')}`);
});

test('en en es hebben geen sleutels die nl niet heeft (verweesde vertalingen)', () => {
  const orphans = { en: [], es: [] };
  for (const key of Object.keys(en)) {
    if (!(key in nl)) orphans.en.push(key);
  }
  for (const key of Object.keys(es)) {
    if (!(key in nl)) orphans.es.push(key);
  }
  assert.deepEqual(orphans.en, [], `en heeft sleutels die nl niet heeft: ${orphans.en.join(', ')}`);
  assert.deepEqual(orphans.es, [], `es heeft sleutels die nl niet heeft: ${orphans.es.join(', ')}`);
});

test('geen enkele vertaalwaarde is leeg', () => {
  for (const [lang, table] of Object.entries(LOCALES)) {
    for (const [key, value] of Object.entries(table)) {
      assert.ok(typeof value === 'string' && value.length > 0, `${lang}.${key} is leeg of geen string`);
    }
  }
});
