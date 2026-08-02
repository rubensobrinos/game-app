import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLang, saveLang, loadTheme, saveTheme } from './preferences.mjs';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    _map: map,
  };
}

test('loadLang: null zonder opgeslagen waarde', () => {
  assert.equal(loadLang(fakeStorage()), null);
});

test('loadLang: geeft een geldige opgeslagen taal terug', () => {
  assert.equal(loadLang(fakeStorage({ 'mp:lang': 'en' })), 'en');
});

test('loadLang: negeert een ongeldige opgeslagen waarde', () => {
  assert.equal(loadLang(fakeStorage({ 'mp:lang': 'fr' })), null);
});

test('saveLang: schrijft een geldige taal weg', () => {
  const storage = fakeStorage();
  saveLang(storage, 'es');
  assert.equal(storage._map.get('mp:lang'), 'es');
});

test('saveLang: negeert een ongeldige taal stilzwijgend', () => {
  const storage = fakeStorage();
  saveLang(storage, 'fr');
  assert.equal(storage._map.has('mp:lang'), false);
});

test('loadTheme: null zonder opgeslagen waarde', () => {
  assert.equal(loadTheme(fakeStorage()), null);
});

test('loadTheme: geeft een geldig opgeslagen thema terug', () => {
  assert.equal(loadTheme(fakeStorage({ 'mp:theme': 'light' })), 'light');
});

test('loadTheme: negeert een ongeldige opgeslagen waarde', () => {
  assert.equal(loadTheme(fakeStorage({ 'mp:theme': 'blue' })), null);
});

test('saveTheme: schrijft een geldig thema weg', () => {
  const storage = fakeStorage();
  saveTheme(storage, 'dark');
  assert.equal(storage._map.get('mp:theme'), 'dark');
});

test('saveTheme: negeert een ongeldig thema stilzwijgend', () => {
  const storage = fakeStorage();
  saveTheme(storage, 'blue');
  assert.equal(storage._map.has('mp:theme'), false);
});

test('loadLang: een gooiende storage (bv. privacymodus) faalt niet, geeft null', () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(loadLang(storage), null);
});
