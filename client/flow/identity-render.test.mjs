// Tests voor client/flow/identity-render.mjs — dezelfde gevallen als
// server/data/identity-render.test.js, want dit IS dezelfde grammatica, nu
// als ESM-poort voor de browser (docs/openstaand/spelersidentiteit.md,
// stap 5). Bewijst dat de poort zich identiek gedraagt aan de servervariant,
// niet een nieuwe test-suite verzint.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { renderIdentityNl, renderIdentityEn, renderIdentityEs } from './identity-render.mjs';

const BULGARIA_NL = { countryName: 'Bulgarije', adjective: { de: 'Bulgaarse', het: 'Bulgaars' } };
const BULGARIA_ES = { countryName: 'Bulgaria', adjective: { m: 'búlgaro', f: 'búlgara' } };
const BULGARIA_EN = { countryName: 'Bulgaria', adjective: 'Bulgarian' };
const PERU_ES = { countryName: 'Perú', adjective: { m: 'peruano', f: 'peruana' } };

describe('renderIdentityNl — het-woord vs. de-woord, en de "uit"-terugval', () => {
  test('de-woord: adjectief krijgt de -e vorm ("Bulgaarse Koe")', () => {
    assert.equal(renderIdentityNl({ ...BULGARIA_NL, word: { text: 'Koe', gender: 'de' } }), 'Bulgaarse Koe');
  });
  test('het-woord: adjectief blijft onverbogen ("Bulgaars Konijn")', () => {
    assert.equal(renderIdentityNl({ ...BULGARIA_NL, word: { text: 'Konijn', gender: 'het' } }), 'Bulgaars Konijn');
  });
  test('ontbrekende vorm voor dit geslacht valt terug op de "uit"-vorm', () => {
    const onlyDeVorm = { countryName: 'Bulgarije', adjective: { de: 'Bulgaarse' } };
    assert.equal(renderIdentityNl({ ...onlyDeVorm, word: { text: 'Konijn', gender: 'het' } }), 'Konijn uit Bulgarije');
  });
  test('adjective volledig afwezig valt terug op de "uit"-vorm', () => {
    assert.equal(
      renderIdentityNl({ countryName: 'Bulgarije', word: { text: 'Koe', gender: 'de' } }),
      'Koe uit Bulgarije',
    );
  });
  test('een kale string als adjective geldt voor elk woordgeslacht', () => {
    const invariant = { countryName: 'X-land', adjective: 'Xse' };
    assert.equal(renderIdentityNl({ ...invariant, word: { text: 'Das', gender: 'de' } }), 'Xse Das');
    assert.equal(renderIdentityNl({ ...invariant, word: { text: 'Schaap', gender: 'het' } }), 'Xse Schaap');
  });
});

describe('renderIdentityEs — mannelijk/vrouwelijk, omgekeerde woordvolgorde', () => {
  test('vrouwelijk: "vaca búlgara" (woord vóór bijvoeglijk naamwoord)', () => {
    assert.equal(renderIdentityEs({ ...BULGARIA_ES, word: { text: 'vaca', gender: 'f' } }), 'vaca búlgara');
  });
  test('mannelijk: "pingüino peruano"', () => {
    assert.equal(renderIdentityEs({ ...PERU_ES, word: { text: 'pingüino', gender: 'm' } }), 'pingüino peruano');
  });
  test('ontbrekende vorm valt terug op de "uit"-vorm ("vaca de Bulgaria")', () => {
    const onlyMasculine = { countryName: 'Bulgaria', adjective: { m: 'búlgaro' } };
    assert.equal(renderIdentityEs({ ...onlyMasculine, word: { text: 'vaca', gender: 'f' } }), 'vaca de Bulgaria');
  });
});

describe('renderIdentityEn — geen verbuiging', () => {
  test('altijd dezelfde vorm, ongeacht woordgeslacht', () => {
    assert.equal(renderIdentityEn({ ...BULGARIA_EN, word: { text: 'Cow', gender: 'de' } }), 'Bulgarian Cow');
    assert.equal(renderIdentityEn({ ...BULGARIA_EN, word: { text: 'Rabbit', gender: 'het' } }), 'Bulgarian Rabbit');
  });
  test('ontbrekende vorm valt terug op de "uit"-vorm ("Cow from Bulgaria")', () => {
    assert.equal(renderIdentityEn({ countryName: 'Bulgaria', word: { text: 'Cow' } }), 'Cow from Bulgaria');
  });
});
