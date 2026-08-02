import test from 'node:test';
import assert from 'node:assert/strict';

import { FLAGS_MC_QUICK_START_DEFAULT } from './flags-mc-quick-start-default.mjs';

// 1
test('gameTypes is exact [flags_mc]', () => {
  assert.deepEqual(FLAGS_MC_QUICK_START_DEFAULT.gameTypes, ['flags_mc']);
});

// 2
test('totalRounds is 10', () => {
  assert.equal(FLAGS_MC_QUICK_START_DEFAULT.totalRounds, 10);
});

// 3
test("difficulty is 'normal'", () => {
  assert.equal(FLAGS_MC_QUICK_START_DEFAULT.difficulty, 'normal');
});

// 4
test("mode is 'individual'", () => {
  assert.equal(FLAGS_MC_QUICK_START_DEFAULT.mode, 'individual');
});

// 5
test("pacing is 'auto'", () => {
  assert.equal(FLAGS_MC_QUICK_START_DEFAULT.pacing, 'auto');
});

// 6
test('speedBonus is true', () => {
  assert.equal(FLAGS_MC_QUICK_START_DEFAULT.speedBonus, true);
});

// 7
test('allowLateJoin is true', () => {
  assert.equal(FLAGS_MC_QUICK_START_DEFAULT.allowLateJoin, true);
});

// 8
test('has exactly 7 keys, no unspecified fields', () => {
  assert.equal(Object.keys(FLAGS_MC_QUICK_START_DEFAULT).length, 7);
});

// 9
test('is frozen at both levels: mutation attempts leave it unchanged', () => {
  assert.equal(Object.isFrozen(FLAGS_MC_QUICK_START_DEFAULT), true);
  assert.equal(Object.isFrozen(FLAGS_MC_QUICK_START_DEFAULT.gameTypes), true);

  assert.throws(() => {
    'use strict';
    FLAGS_MC_QUICK_START_DEFAULT.totalRounds = 20;
  }, TypeError);
  assert.throws(() => {
    'use strict';
    FLAGS_MC_QUICK_START_DEFAULT.gameTypes.push('capitals_mc');
  }, TypeError);

  assert.equal(FLAGS_MC_QUICK_START_DEFAULT.totalRounds, 10);
  assert.deepEqual(FLAGS_MC_QUICK_START_DEFAULT.gameTypes, ['flags_mc']);
});
