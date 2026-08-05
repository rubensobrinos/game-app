'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { renderIdentityNl, renderIdentityEn, renderIdentityEs } = require('./identity-render');

// PLACEHOLDER-testfixtures, zelfde contentgrens als name-processing.test.js:
// deze landnamen/vormen zijn UITSLUITEND testdata om de rendermodules te
// oefenen, geen productcontent (die komt in stap 3, redactiewerk).
const BULGARIA_NL = { countryName: 'Bulgarije', adjective: { de: 'Bulgaarse', het: 'Bulgaars' } };
const BULGARIA_ES = { countryName: 'Bulgaria', adjective: { m: 'búlgaro', f: 'búlgara' } };
const BULGARIA_EN = { countryName: 'Bulgaria', adjective: 'Bulgarian' };
const PERU_ES = { countryName: 'Perú', adjective: { m: 'peruano', f: 'peruana' } };
const CANADA_ES_INVARIANT = { countryName: 'Canadá', adjective: 'canadiense' };

describe('renderIdentityNl — het-woord vs. de-woord, en de "uit"-terugval #1-6', () => {
  test('#1. de-woord: adjectief krijgt de -e vorm ("Bulgaarse Koe")', () => {
    const result = renderIdentityNl({ ...BULGARIA_NL, word: { text: 'Koe', gender: 'de' } });
    assert.equal(result, 'Bulgaarse Koe');
  });

  test('#2. het-woord: adjectief blijft onverbogen ("Bulgaars Konijn"), niet "Bulgaarse Konijn"', () => {
    const result = renderIdentityNl({ ...BULGARIA_NL, word: { text: 'Konijn', gender: 'het' } });
    assert.equal(result, 'Bulgaars Konijn');
  });

  test('#3. ontbrekende vorm voor dit geslacht (alleen "de" aanwezig, woord is "het") valt terug op de "uit"-vorm', () => {
    const onlyDeVorm = { countryName: 'Bulgarije', adjective: { de: 'Bulgaarse' } };
    const result = renderIdentityNl({ ...onlyDeVorm, word: { text: 'Konijn', gender: 'het' } });
    assert.equal(result, 'Konijn uit Bulgarije');
  });

  test('#4. adjective volledig afwezig valt terug op de "uit"-vorm, nooit een lege naam', () => {
    const result = renderIdentityNl({ countryName: 'Bulgarije', word: { text: 'Koe', gender: 'de' } });
    assert.equal(result, 'Koe uit Bulgarije');
  });

  test('#5. een lege string als vorm telt als ontbrekend (geen " Koe" met een spatie ervoor)', () => {
    const result = renderIdentityNl({
      countryName: 'Bulgarije',
      adjective: { de: '' },
      word: { text: 'Koe', gender: 'de' },
    });
    assert.equal(result, 'Koe uit Bulgarije');
  });

  test('#6. een kale string als adjective (geslachtsonveranderlijk) geldt voor elk woordgeslacht', () => {
    const invariant = { countryName: 'X-land', adjective: 'Xse' };
    assert.equal(renderIdentityNl({ ...invariant, word: { text: 'Das', gender: 'de' } }), 'Xse Das');
    assert.equal(renderIdentityNl({ ...invariant, word: { text: 'Schaap', gender: 'het' } }), 'Xse Schaap');
  });
});

describe('renderIdentityEs — mannelijk/vrouwelijk, omgekeerde woordvolgorde, terugval #7-11', () => {
  test('#7. vrouwelijk: "vaca búlgara" (woord vóór bijvoeglijk naamwoord)', () => {
    const result = renderIdentityEs({ ...BULGARIA_ES, word: { text: 'vaca', gender: 'f' } });
    assert.equal(result, 'vaca búlgara');
  });

  test('#8. mannelijk: "pingüino peruano"', () => {
    const result = renderIdentityEs({ ...PERU_ES, word: { text: 'pingüino', gender: 'm' } });
    assert.equal(result, 'pingüino peruano');
  });

  test('#9. hetzelfde land, ander woordgeslacht, geeft de andere vorm ("vaca búlgara" vs. "pingüino búlgaro")', () => {
    const female = renderIdentityEs({ ...BULGARIA_ES, word: { text: 'vaca', gender: 'f' } });
    const male = renderIdentityEs({ ...BULGARIA_ES, word: { text: 'pingüino', gender: 'm' } });
    assert.equal(female, 'vaca búlgara');
    assert.equal(male, 'pingüino búlgaro');
  });

  test('#10. ontbrekende vorm voor dit geslacht valt terug op de "uit"-vorm ("vaca de Bulgaria")', () => {
    const onlyMasculine = { countryName: 'Bulgaria', adjective: { m: 'búlgaro' } };
    const result = renderIdentityEs({ ...onlyMasculine, word: { text: 'vaca', gender: 'f' } });
    assert.equal(result, 'vaca de Bulgaria');
  });

  test('#11. geslachtsonveranderlijk adjectief (kale string) geldt voor beide geslachten: "jaguar canadiense" en "vaca canadiense"', () => {
    assert.equal(
      renderIdentityEs({ ...CANADA_ES_INVARIANT, word: { text: 'jaguar', gender: 'm' } }),
      'jaguar canadiense',
    );
    assert.equal(
      renderIdentityEs({ ...CANADA_ES_INVARIANT, word: { text: 'vaca', gender: 'f' } }),
      'vaca canadiense',
    );
  });
});

describe('renderIdentityEn — geen verbuiging, wél de terugval #12-14', () => {
  test('#12. bijvoeglijk naamwoord vóór het woord, gender wordt genegeerd', () => {
    const result = renderIdentityEn({ ...BULGARIA_EN, word: { text: 'Cow', gender: 'f' } });
    assert.equal(result, 'Bulgarian Cow');
  });

  test('#13. zonder gender op het woord werkt het net zo goed', () => {
    const result = renderIdentityEn({ ...BULGARIA_EN, word: { text: 'Cow' } });
    assert.equal(result, 'Bulgarian Cow');
  });

  test('#14. ontbrekend adjective valt terug op de "uit"-vorm: "Cow from Bulgaria"', () => {
    const result = renderIdentityEn({ countryName: 'Bulgaria', word: { text: 'Cow' } });
    assert.equal(result, 'Cow from Bulgaria');
  });
});

describe('invoervalidatie — TypeError bij ongeldige typen, voor alle drie de rendermodules #15-17', () => {
  const renderers = { renderIdentityNl, renderIdentityEn, renderIdentityEs };

  for (const [name, render] of Object.entries(renderers)) {
    test(`#15 (${name}). ontbrekende/lege countryName gooit TypeError`, () => {
      assert.throws(() => render({ countryName: '', word: { text: 'Koe' } }), TypeError);
      assert.throws(() => render({ word: { text: 'Koe' } }), TypeError);
    });

    test(`#16 (${name}). word zonder text (of helemaal geen word) gooit TypeError`, () => {
      assert.throws(() => render({ countryName: 'X', word: {} }), TypeError);
      assert.throws(() => render({ countryName: 'X' }), TypeError);
    });

    test(`#17 (${name}). word.text als lege string gooit TypeError`, () => {
      assert.throws(() => render({ countryName: 'X', word: { text: '' } }), TypeError);
    });
  }
});
