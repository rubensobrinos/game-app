import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soloStateKeyFor, saveSoloState, loadSoloState, clearSoloState } from './solo-store.mjs';

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

test('1. soloStateKeyFor(482917) is exactly mp:solo:482917', () => {
  assert.strictEqual(soloStateKeyFor('482917'), 'mp:solo:482917');
});

test('2. saveSoloState followed by loadSoloState with the same roomCode round-trips exactly', () => {
  const storage = createFakeStorage();
  const state = { gameCode: '482917', phase: 'LOBBY', players: [['p1', { score: 0 }]], sessions: [] };
  saveSoloState(storage, '482917', state);
  assert.deepStrictEqual(loadSoloState(storage, '482917'), state);
});

test('3. loadSoloState for a roomCode with nothing stored is null', () => {
  const storage = createFakeStorage();
  assert.strictEqual(loadSoloState(storage, '000000'), null);
});

test('4. loadSoloState when the stored value is invalid JSON is null, no throw', () => {
  const storage = createFakeStorage();
  storage.setItem(soloStateKeyFor('482917'), 'not valid json{{{');
  assert.strictEqual(loadSoloState(storage, '482917'), null);
});

test('5. loadSoloState when JSON is valid but the shape is not a plausible room state is null', () => {
  const storage = createFakeStorage();
  storage.setItem(soloStateKeyFor('482917'), JSON.stringify({ gameCode: '482917' })); // mist phase/players/sessions
  assert.strictEqual(loadSoloState(storage, '482917'), null);

  storage.setItem(
    soloStateKeyFor('482917'),
    JSON.stringify({ gameCode: '482917', phase: 'LOBBY', players: 'niet-een-array', sessions: [] }),
  );
  assert.strictEqual(loadSoloState(storage, '482917'), null);
});

test('6. loadSoloState when the stored gameCode does not match the requested roomCode is null', () => {
  const storage = createFakeStorage();
  storage.setItem(
    soloStateKeyFor('482917'),
    JSON.stringify({ gameCode: '999999', phase: 'LOBBY', players: [], sessions: [] }),
  );
  assert.strictEqual(loadSoloState(storage, '482917'), null);
});

test('7. clearSoloState removes exactly the entry for that roomCode, nothing else', () => {
  const storage = createFakeStorage();
  saveSoloState(storage, '482917', { gameCode: '482917', phase: 'LOBBY', players: [], sessions: [] });
  saveSoloState(storage, '111111', { gameCode: '111111', phase: 'LOBBY', players: [], sessions: [] });
  clearSoloState(storage, '482917');
  assert.strictEqual(loadSoloState(storage, '482917'), null);
  assert.notStrictEqual(loadSoloState(storage, '111111'), null);
});

test('8. saveSoloState/clearSoloState with a non-string or empty roomCode are no-ops, never throw', () => {
  const storage = createFakeStorage();
  assert.doesNotThrow(() => saveSoloState(storage, '', { gameCode: '', phase: 'LOBBY', players: [], sessions: [] }));
  assert.doesNotThrow(() => saveSoloState(storage, undefined, {}));
  assert.doesNotThrow(() => clearSoloState(storage, ''));
  assert.doesNotThrow(() => clearSoloState(storage, undefined));
});

test('9. a storage that throws on setItem/getItem/removeItem (privémodus, vol quotum) never propagates', () => {
  const throwingStorage = {
    getItem: () => {
      throw new Error('boom');
    },
    setItem: () => {
      throw new Error('boom');
    },
    removeItem: () => {
      throw new Error('boom');
    },
  };
  assert.doesNotThrow(() => saveSoloState(throwingStorage, '482917', { gameCode: '482917' }));
  assert.strictEqual(loadSoloState(throwingStorage, '482917'), null);
  assert.doesNotThrow(() => clearSoloState(throwingStorage, '482917'));
});
