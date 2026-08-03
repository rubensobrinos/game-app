import test from 'node:test';
import assert from 'node:assert/strict';
import { headlineRevealed } from './reveal-model.mjs';

test('headlineRevealed: false vlak na het resultaat', () => {
  assert.equal(headlineRevealed(0), false);
  assert.equal(headlineRevealed(500), false);
});

test('headlineRevealed: true zodra de vertraging verstreken is', () => {
  assert.equal(headlineRevealed(1400), true);
  assert.equal(headlineRevealed(5000), true);
});

test('headlineRevealed: een tik om te skippen toont het meteen', () => {
  assert.equal(headlineRevealed(0, true), true);
});

test('headlineRevealed: ongeldige/ontbrekende elapsedMs breekt niet, blijft false', () => {
  assert.equal(headlineRevealed(null), false);
  assert.equal(headlineRevealed(undefined), false);
  assert.equal(headlineRevealed(NaN), false);
});
