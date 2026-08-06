import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_CODES_BY_CATEGORY, ALL_ERROR_CODES } from './error-codes.mjs';

test('ALL_ERROR_CODES bevat exact 25 codes', () => {
  assert.equal(ALL_ERROR_CODES.size, 25);
});

test('ERROR_CODES_BY_CATEGORY heeft de juiste telling per categorie', () => {
  assert.equal(ERROR_CODES_BY_CATEGORY.ROOM_EN_JOIN.length, 8);
  assert.equal(ERROR_CODES_BY_CATEGORY.AUTORISATIE.length, 5);
  assert.equal(ERROR_CODES_BY_CATEGORY.GAME_EN_RONDE.length, 7);
  assert.equal(ERROR_CODES_BY_CATEGORY.INPUT.length, 5);
});

// Open vraag §1 is beslist (besluit 48, 6 aug 2026): TTL-verval krijgt WEL een
// eigen code, en die heet `GAME_EXPIRED`. De drie namen hieronder zijn
// overwogen en niet gekozen; deze test houdt vast dat er precies één naam voor
// dit geval bestaat, zodat er geen tweede insluipt.
test('Besluit 48: TTL-verval heet GAME_EXPIRED en niets anders', () => {
  assert.equal(ALL_ERROR_CODES.has('GAME_EXPIRED'), true);
  for (const candidate of ['ROOM_EXPIRED', 'TTL_EXPIRED', 'ROOM_TTL_EXPIRED']) {
    assert.equal(ALL_ERROR_CODES.has(candidate), false, `${candidate} is een tweede naam voor hetzelfde`);
  }
});
