import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_CODES_BY_CATEGORY, ALL_ERROR_CODES } from './error-codes.mjs';

test('ALL_ERROR_CODES bevat exact 23 codes', () => {
  assert.equal(ALL_ERROR_CODES.size, 23);
});

test('ERROR_CODES_BY_CATEGORY heeft de juiste telling per categorie', () => {
  assert.equal(ERROR_CODES_BY_CATEGORY.ROOM_EN_JOIN.length, 7);
  assert.equal(ERROR_CODES_BY_CATEGORY.AUTORISATIE.length, 5);
  assert.equal(ERROR_CODES_BY_CATEGORY.GAME_EN_RONDE.length, 7);
  assert.equal(ERROR_CODES_BY_CATEGORY.INPUT.length, 4);
});

test('Open vraag §1: ALL_ERROR_CODES bevat geen aparte TTL-verval-foutcode', () => {
  for (const candidate of ['ROOM_EXPIRED', 'TTL_EXPIRED', 'ROOM_TTL_EXPIRED']) {
    assert.equal(ALL_ERROR_CODES.has(candidate), false, `${candidate} hoort nog niet in de enum`);
  }
});
