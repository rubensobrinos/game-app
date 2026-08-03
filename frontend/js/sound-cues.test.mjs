import test from 'node:test';
import assert from 'node:assert/strict';
import { playCue, cueNames } from './sound-cues.mjs';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (key) => (map.has(key) ? map.get(key) : null) };
}

test('cueNames: join, urgent en reveal, niets anders', () => {
  assert.deepEqual([...cueNames()].sort(), ['join', 'reveal', 'urgent']);
});

test('playCue: geeft true terug voor een bestaande cue, niet gemute', () => {
  assert.equal(playCue('join', fakeStorage()), true);
  assert.equal(playCue('urgent', fakeStorage()), true);
  assert.equal(playCue('reveal', fakeStorage()), true);
});

test('playCue: false bij een onbekende cue-naam', () => {
  assert.equal(playCue('unknown', fakeStorage()), false);
});

test('playCue: false zodra loadMuted true is', () => {
  assert.equal(playCue('join', fakeStorage({ 'mp:muted': 'true' })), false);
});

test('playCue: true als muted expliciet false of onbekend is', () => {
  assert.equal(playCue('join', fakeStorage({ 'mp:muted': 'false' })), true);
  assert.equal(playCue('join', fakeStorage()), true);
});

test('playCue: een gooiende storage faalt niet (loadMuted se eigen safeGet)', () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
  };
  assert.doesNotThrow(() => playCue('join', storage));
});
