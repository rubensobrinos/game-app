import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadLang,
  saveLang,
  loadTheme,
  saveTheme,
  loadMuted,
  saveMuted,
  loadReactionsEnabled,
  saveReactionsEnabled,
} from './preferences.mjs';

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

test('loadMuted: null zonder opgeslagen waarde', () => {
  assert.equal(loadMuted(fakeStorage()), null);
});

test('loadMuted: geeft true terug bij opgeslagen "true"', () => {
  assert.equal(loadMuted(fakeStorage({ 'mp:muted': 'true' })), true);
});

test('loadMuted: geeft false terug bij opgeslagen "false"', () => {
  assert.equal(loadMuted(fakeStorage({ 'mp:muted': 'false' })), false);
});

test('loadMuted: negeert een ongeldige opgeslagen waarde', () => {
  assert.equal(loadMuted(fakeStorage({ 'mp:muted': 'yes' })), null);
});

test('saveMuted: schrijft true weg', () => {
  const storage = fakeStorage();
  saveMuted(storage, true);
  assert.equal(storage._map.get('mp:muted'), 'true');
});

test('saveMuted: schrijft false weg', () => {
  const storage = fakeStorage();
  saveMuted(storage, false);
  assert.equal(storage._map.get('mp:muted'), 'false');
});

test('saveMuted: negeert een niet-boolean stilzwijgend', () => {
  const storage = fakeStorage();
  saveMuted(storage, 'true');
  assert.equal(storage._map.has('mp:muted'), false);
});

test('saveLang: een gooiende storage faalt stil, geen exception', () => {
  const storage = {
    setItem() {
      throw new Error('quota exceeded');
    },
  };
  assert.doesNotThrow(() => saveLang(storage, 'en'));
});

test('saveTheme: een gooiende storage faalt stil, geen exception', () => {
  const storage = {
    setItem() {
      throw new Error('quota exceeded');
    },
  };
  assert.doesNotThrow(() => saveTheme(storage, 'dark'));
});

test('saveMuted: een gooiende storage faalt stil, geen exception', () => {
  const storage = {
    setItem() {
      throw new Error('quota exceeded');
    },
  };
  assert.doesNotThrow(() => saveMuted(storage, true));
});

// 11-verzoek (BOUWSPRINT doel 4)

test('loadReactionsEnabled: null zonder opgeslagen waarde (aanroeper valt terug op standaard-aan)', () => {
  assert.equal(loadReactionsEnabled(fakeStorage()), null);
});

test('loadReactionsEnabled: geeft true terug bij opgeslagen "true"', () => {
  assert.equal(loadReactionsEnabled(fakeStorage({ 'mp:reactionsEnabled': 'true' })), true);
});

test('loadReactionsEnabled: geeft false terug bij opgeslagen "false"', () => {
  assert.equal(loadReactionsEnabled(fakeStorage({ 'mp:reactionsEnabled': 'false' })), false);
});

test('loadReactionsEnabled: negeert een ongeldige opgeslagen waarde', () => {
  assert.equal(loadReactionsEnabled(fakeStorage({ 'mp:reactionsEnabled': 'nope' })), null);
});

test('saveReactionsEnabled: schrijft true/false weg, negeert een niet-boolean', () => {
  const storage = fakeStorage();
  saveReactionsEnabled(storage, false);
  assert.equal(storage._map.get('mp:reactionsEnabled'), 'false');
  saveReactionsEnabled(storage, true);
  assert.equal(storage._map.get('mp:reactionsEnabled'), 'true');
  saveReactionsEnabled(storage, 'true');
  assert.equal(storage._map.get('mp:reactionsEnabled'), 'true'); // ongewijzigd, niet overschreven met de string
});

test('saveReactionsEnabled: een gooiende storage faalt stil, geen exception', () => {
  const storage = {
    setItem() {
      throw new Error('quota exceeded');
    },
  };
  assert.doesNotThrow(() => saveReactionsEnabled(storage, true));
});
