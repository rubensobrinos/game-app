import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAndValidateDisplayName } from './input-safety.mjs';

// Rij 5 — control character / zero-width space opschoning die niet-leeg
// blijft: twee losse varianten.

test('normalizeAndValidateDisplayName: control character wordt verwijderd, blijft niet-leeg', () => {
  const withControlChar = `Ru${String.fromCharCode(0x00)}ben`;
  assert.deepEqual(
    normalizeAndValidateDisplayName(withControlChar),
    { ok: true, value: 'Ruben' },
  );
});

test('normalizeAndValidateDisplayName: zero-width space wordt verwijderd, blijft niet-leeg', () => {
  const withZeroWidthSpace = `Ru${String.fromCharCode(0x200b)}ben`;
  assert.deepEqual(
    normalizeAndValidateDisplayName(withZeroWidthSpace),
    { ok: true, value: 'Ruben' },
  );
});

// Rij 6 — string die na opschoning volledig leeg is: drie losse varianten
// (onzichtbare tekens, control characters, alleen whitespace — dit laatste
// expliciet genoemd in de Foutcodes-beschrijving als voorbeeld van "leeg").

test('normalizeAndValidateDisplayName: alleen zero-width spaces -> NAME_INVALID', () => {
  const onlyZeroWidthSpaces = String.fromCharCode(0x200b).repeat(2);
  assert.deepEqual(
    normalizeAndValidateDisplayName(onlyZeroWidthSpaces),
    { ok: false, code: 'NAME_INVALID' },
  );
});

test('normalizeAndValidateDisplayName: alleen control characters -> NAME_INVALID', () => {
  const onlyControlChars = `${String.fromCharCode(0x00)}${String.fromCharCode(0x01)}${String.fromCharCode(0x02)}`;
  assert.deepEqual(
    normalizeAndValidateDisplayName(onlyControlChars),
    { ok: false, code: 'NAME_INVALID' },
  );
});

test('normalizeAndValidateDisplayName: alleen whitespace -> NAME_INVALID', () => {
  assert.deepEqual(
    normalizeAndValidateDisplayName('   '),
    { ok: false, code: 'NAME_INVALID' },
  );
});

// Rij 7 — precies 20 vs 21 zichtbare tekens.

test('normalizeAndValidateDisplayName: precies 20 zichtbare tekens -> ok', () => {
  const twentyChars = 'a'.repeat(20);
  assert.deepEqual(
    normalizeAndValidateDisplayName(twentyChars),
    { ok: true, value: twentyChars },
  );
});

test('normalizeAndValidateDisplayName: 21 zichtbare tekens -> NAME_TOO_LONG', () => {
  const twentyOneChars = 'a'.repeat(21);
  assert.deepEqual(
    normalizeAndValidateDisplayName(twentyOneChars),
    { ok: false, code: 'NAME_TOO_LONG' },
  );
});

// Rij 8 — NFKC-ligatuur-grensgeval: 'ﬁ' (U+FB01) vouwt na normalisatie uit
// naar 'fi' (twee codepoints). Telling gebeurt ná normalisatie, dus de
// rauwe invoerlengte alleen is geen betrouwbare voorspeller van de uitkomst:
// 19 rauwe codepoints die naar 20 genormaliseerde codepoints uitvouwen is
// nog geldig; 20 rauwe codepoints die naar 21 genormaliseerde codepoints
// uitvouwen is al te lang.

test('normalizeAndValidateDisplayName: ligatuur net binnen de grens (19 raw -> 20 genormaliseerd) -> ok', () => {
  const rawNineteenCodepoints = `${'a'.repeat(18)}ﬁ`; // 18 + 1 ligatuur = 19 raw codepoints
  assert.equal(Array.from(rawNineteenCodepoints).length, 19);
  const expectedNormalized = `${'a'.repeat(18)}fi`; // 18 + 2 = 20 genormaliseerde codepoints
  assert.equal(Array.from(expectedNormalized).length, 20);
  assert.deepEqual(
    normalizeAndValidateDisplayName(rawNineteenCodepoints),
    { ok: true, value: expectedNormalized },
  );
});

test('normalizeAndValidateDisplayName: ligatuur net over de grens (20 raw -> 21 genormaliseerd) -> NAME_TOO_LONG', () => {
  const rawTwentyCodepoints = `${'a'.repeat(19)}ﬁ`; // 19 + 1 ligatuur = 20 raw codepoints
  assert.equal(Array.from(rawTwentyCodepoints).length, 20);
  // Rauwe lengte (20) is precies de limiet — zou ten onrechte als geldig
  // doorgaan als er vóór normalisatie geteld werd. Ná NFKC-normalisatie
  // vouwt de ligatuur uit naar 21 codepoints, dus dit hoort te falen.
  assert.deepEqual(
    normalizeAndValidateDisplayName(rawTwentyCodepoints),
    { ok: false, code: 'NAME_TOO_LONG' },
  );
});
