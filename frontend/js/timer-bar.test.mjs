import { test } from 'node:test';
import assert from 'node:assert/strict';

import { moetAankondigen, fractie, URGENT_VANAF_SECONDEN } from './timer-bar.mjs';

test('de eerste tick kondigt aan, de tweede niet', () => {
  assert.equal(moetAankondigen(null, 30), true);
  assert.equal(moetAankondigen(30, 29), false);
});

test('alleen de overgang naar urgent kondigt aan, niet elke tick erbinnen', () => {
  assert.equal(moetAankondigen(4, 3), true, 'grens gepasseerd');
  assert.equal(moetAankondigen(3, 2), false, 'al urgent');
  assert.equal(moetAankondigen(2, 1), false);
  assert.equal(moetAankondigen(1, 0), false);
});

test('een sprong over de grens heen kondigt ook aan', () => {
  // Kan gebeuren na een tabwissel of een trage tick: 6 → 1 in één stap.
  assert.equal(moetAankondigen(6, 1), true);
});

test('een screenreader hoort per ronde hooguit twee keer iets', () => {
  const ticks = [30, 29, 28, 20, 10, 5, 4, 3, 2, 1, 0];
  let vorige = null;
  let aankondigingen = 0;
  for (const t of ticks) {
    if (moetAankondigen(vorige, t)) aankondigingen++;
    vorige = t;
  }
  assert.equal(aankondigingen, 2, 'start + het ingaan van de urgente fase');
});

test('de urgentiegrens is instelbaar, geen hardgecodeerde 3', () => {
  assert.equal(URGENT_VANAF_SECONDEN, 3);
  assert.equal(moetAankondigen(6, 5, 5), true);
  assert.equal(moetAankondigen(4, 3, 5), false, 'al urgent bij een grens van 5');
});

test('onbruikbare invoer kondigt niets aan in plaats van te gooien', () => {
  assert.equal(moetAankondigen(null, Number.NaN), false);
  assert.equal(moetAankondigen(10, undefined), false);
});

test('fractie loopt van 1 naar 0 en blijft binnen die grenzen', () => {
  assert.equal(fractie(30, 30), 1);
  assert.equal(fractie(15, 30), 0.5);
  assert.equal(fractie(0, 30), 0);
  assert.equal(fractie(-5, 30), 0, 'nooit negatief');
  assert.equal(fractie(40, 30), 1, 'nooit boven vol');
});

test('een onbruikbare totaalduur geeft een lege balk, geen deling door nul', () => {
  assert.equal(fractie(10, 0), 0);
  assert.equal(fractie(10, null), 0);
  assert.equal(fractie(Number.NaN, 30), 0);
});
