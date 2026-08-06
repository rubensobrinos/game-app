import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPassport, recordCountrySeen } from './passport-store.mjs';

function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

test('1. loadPassport zonder iets opgeslagen levert een leeg object', () => {
  const storage = createFakeStorage();
  assert.deepStrictEqual(loadPassport(storage), {});
});

test('2. recordCountrySeen tekent een nieuw land in en meldt isNew: true', () => {
  const storage = createFakeStorage();
  const { passport, isNew } = recordCountrySeen(storage, 'fr', 1000);
  assert.strictEqual(isNew, true);
  assert.deepStrictEqual(passport, { fr: 1000 });
  assert.deepStrictEqual(loadPassport(storage), { fr: 1000 });
});

test('3. recordCountrySeen is hoofdletterongevoelig — altijd kleine letters opgeslagen', () => {
  const storage = createFakeStorage();
  recordCountrySeen(storage, 'FR', 1000);
  assert.deepStrictEqual(loadPassport(storage), { fr: 1000 });
});

test('4. een land dat al in het paspoort stond: isNew wordt false, seenAtMs verandert niet', () => {
  const storage = createFakeStorage();
  recordCountrySeen(storage, 'fr', 1000);
  const { passport, isNew } = recordCountrySeen(storage, 'fr', 5000);
  assert.strictEqual(isNew, false);
  assert.deepStrictEqual(passport, { fr: 1000 }, 'het eerste-gezien-moment blijft het eerste, niet het laatste');
});

test('5. meerdere landen stapelen op in hetzelfde paspoort', () => {
  const storage = createFakeStorage();
  recordCountrySeen(storage, 'fr', 1000);
  recordCountrySeen(storage, 'de', 2000);
  recordCountrySeen(storage, 'es', 3000);
  assert.deepStrictEqual(loadPassport(storage), { fr: 1000, de: 2000, es: 3000 });
});

test('6. een lege of niet-string iso2 doet niets en meldt isNew: false', () => {
  const storage = createFakeStorage();
  assert.deepStrictEqual(recordCountrySeen(storage, '', 1000), { passport: {}, isNew: false });
  assert.deepStrictEqual(recordCountrySeen(storage, undefined, 1000), { passport: {}, isNew: false });
  assert.deepStrictEqual(loadPassport(storage), {});
});

test('7. loadPassport bij corrupte JSON is een leeg object, geen throw', () => {
  const storage = createFakeStorage();
  storage.setItem('mp:passport', 'niet-geldige-json{{{');
  assert.deepStrictEqual(loadPassport(storage), {});
});

test('8. loadPassport bij een geldig JSON-object dat geen paspoort is (bv. een array) is leeg', () => {
  const storage = createFakeStorage();
  storage.setItem('mp:passport', JSON.stringify(['fr', 'de']));
  assert.deepStrictEqual(loadPassport(storage), {});
  storage.setItem('mp:passport', JSON.stringify({ fr: 'niet-een-getal' }));
  assert.deepStrictEqual(loadPassport(storage), {});
});

test('9. een storage die gooit (privémodus, vol quotum) crasht recordCountrySeen/loadPassport niet', () => {
  const throwingStorage = {
    getItem: () => {
      throw new Error('boom');
    },
    setItem: () => {
      throw new Error('boom');
    },
  };
  assert.doesNotThrow(() => recordCountrySeen(throwingStorage, 'fr', 1000));
  assert.doesNotThrow(() => loadPassport(throwingStorage));
});
