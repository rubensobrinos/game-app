// Tests voor streak-model.mjs — 11-verzoek (BOUWSPRINT doel 4).

import test from 'node:test';
import assert from 'node:assert/strict';
import { initialStreakModel, applyRoundResult } from './streak-model.mjs';

test('start op 0', () => {
  assert.equal(initialStreakModel().current, 0);
});

test('telt op bij opeenvolgende juiste rondes', () => {
  let model = initialStreakModel();
  model = applyRoundResult(model, true);
  assert.equal(model.current, 1);
  model = applyRoundResult(model, true);
  assert.equal(model.current, 2);
  model = applyRoundResult(model, true);
  assert.equal(model.current, 3);
});

test('reset naar 0 bij een foute ronde', () => {
  let model = applyRoundResult(applyRoundResult(initialStreakModel(), true), true);
  assert.equal(model.current, 2);
  model = applyRoundResult(model, false);
  assert.equal(model.current, 0);
});

test('reset naar 0 bij geen antwoord (selfCorrect is dan ook false)', () => {
  const model = applyRoundResult(applyRoundResult(initialStreakModel(), true), false);
  assert.equal(model.current, 0);
});

test('een nieuwe streak kan meteen na een reset weer beginnen', () => {
  let model = applyRoundResult(initialStreakModel(), false);
  assert.equal(model.current, 0);
  model = applyRoundResult(model, true);
  assert.equal(model.current, 1);
});

test('modellen zijn bevroren', () => {
  const model = applyRoundResult(initialStreakModel(), true);
  assert.throws(() => { model.current = 99; }, TypeError);
  assert.throws(() => { initialStreakModel().current = 1; }, TypeError);
});
