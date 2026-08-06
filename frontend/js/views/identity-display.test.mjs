// Tests voor identity-display.mjs — de dispatcher die een identiteitspaar
// omzet naar tekst (eigen apptaal) en een vlagpad. Geen DOM nodig: pure
// functies over echte content (shared/content/).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { identityText, identityFlagUrl } from './identity-display.mjs';

test('null/undefined identity geeft overal null terug — de aanroeper valt terug op effectiveName', () => {
  assert.equal(identityText(null, 'nl'), null);
  assert.equal(identityText(undefined, 'nl'), null);
  assert.equal(identityFlagUrl(null), null);
  assert.equal(identityFlagUrl(undefined), null);
});

// Bulgarije + "cow" is precies het voorbeeld uit
// docs/openstaand/spelersidentiteit.md: "Bulgaarse Koe" / "Bulgarian Cow" /
// "vaca búlgara" — dezelfde drie renders die het bouwplan noemt.
test('hetzelfde paar rendert per taal anders — dit is waar punt 8 op leunt', () => {
  const identity = { country: 'bg', word: 'cow' };
  assert.equal(identityText(identity, 'nl'), 'Bulgaarse Koe');
  assert.equal(identityText(identity, 'en'), 'Bulgarian Cow');
  assert.equal(identityText(identity, 'es'), 'vaca búlgara');
});

test('een het-woord (nl) en een mannelijk woord (es) renderen ook correct via de echte content', () => {
  const identity = { country: 'pe', word: 'rabbit' };
  assert.equal(identityText(identity, 'nl'), 'Peruaans Konijn');
  assert.equal(identityText(identity, 'es'), 'conejo peruano');
});

test('een land zonder bijvoeglijke vorm valt terug op de "uit"-vorm, geen crash', () => {
  // 've' (Venezuela) zit niet in de 60-landenset van country-adjectives.mjs.
  const identity = { country: 've', word: 'cow' };
  const text = identityText(identity, 'nl');
  assert.equal(text, 'Koe uit Venezuela');
});

test('een onbekende woord-sleutel geeft null (geen halve/kapotte identiteit tonen)', () => {
  assert.equal(identityText({ country: 'bg', word: 'niet-bestaand' }, 'nl'), null);
});

test('identityFlagUrl gebruikt dezelfde vlag-assetconventie als de rest van de app', () => {
  assert.equal(identityFlagUrl({ country: 'bg', word: 'cow' }), 'flags/bg.png');
  assert.equal(identityFlagUrl({ country: 'BG', word: 'cow' }), 'flags/bg.png');
});
