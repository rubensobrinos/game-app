import test from 'node:test';
import assert from 'node:assert/strict';

import { GROUP_BATTLE_DEFAULT_GAME_TYPES } from './quick-start-preset.mjs';

test('1. GROUP_BATTLE_DEFAULT_GAME_TYPES bevat exact de vier verwachte waarden, in die volgorde', () => {
  assert.deepEqual(GROUP_BATTLE_DEFAULT_GAME_TYPES, [
    'flags_mc',
    'real_or_fake_flag',
    'higher_lower',
    'odd_one_out',
  ]);
});

test('2. GROUP_BATTLE_DEFAULT_GAME_TYPES.length is 4, niet 5 — capitals_mc zit er bewust niet in', () => {
  assert.equal(GROUP_BATTLE_DEFAULT_GAME_TYPES.length, 4);
  assert.equal(GROUP_BATTLE_DEFAULT_GAME_TYPES.includes('capitals_mc'), false);
});

test('3. GROUP_BATTLE_DEFAULT_GAME_TYPES is bevroren: een mutatiepoging verandert de constante niet', () => {
  assert.equal(Object.isFrozen(GROUP_BATTLE_DEFAULT_GAME_TYPES), true);

  assert.throws(() => {
    'use strict';
    GROUP_BATTLE_DEFAULT_GAME_TYPES.push('x');
  }, TypeError);

  assert.deepEqual(GROUP_BATTLE_DEFAULT_GAME_TYPES, [
    'flags_mc',
    'real_or_fake_flag',
    'higher_lower',
    'odd_one_out',
  ]);
});
