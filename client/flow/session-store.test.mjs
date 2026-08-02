import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageKeyFor, saveSession, loadSession, clearSession } from './session-store.mjs';

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

test('1. storageKeyFor(482917) is exactly mp:session:482917', () => {
  assert.strictEqual(storageKeyFor('482917'), 'mp:session:482917');
});

test('2. saveSession followed by loadSession with the same roomCode round-trips exactly', () => {
  const storage = createFakeStorage();
  const session = { sessionToken: 'tok-abc', roomCode: '482917', playerId: 'p1', savedAt: 1000 };
  saveSession(storage, session);
  assert.deepStrictEqual(loadSession(storage, '482917'), session);
});

test('3. loadSession for a roomCode with nothing stored is null', () => {
  const storage = createFakeStorage();
  assert.strictEqual(loadSession(storage, '000000'), null);
});

test('4. loadSession when the stored value is invalid JSON is null, no throw', () => {
  const storage = createFakeStorage();
  storage.setItem(storageKeyFor('482917'), 'not valid json{{{');
  assert.strictEqual(loadSession(storage, '482917'), null);
});

test('5. loadSession when JSON is valid but sessionToken is missing or not a string is null', () => {
  const storage = createFakeStorage();
  storage.setItem(
    storageKeyFor('482917'),
    JSON.stringify({ roomCode: '482917', playerId: null, savedAt: 1000 }),
  );
  assert.strictEqual(loadSession(storage, '482917'), null);

  storage.setItem(
    storageKeyFor('482917'),
    JSON.stringify({ sessionToken: 12345, roomCode: '482917', playerId: null, savedAt: 1000 }),
  );
  assert.strictEqual(loadSession(storage, '482917'), null);
});

test('6. loadSession when the stored roomCode does not match the requested roomCode is null', () => {
  const storage = createFakeStorage();
  storage.setItem(
    storageKeyFor('482917'),
    JSON.stringify({ sessionToken: 'tok-abc', roomCode: '999999', playerId: null, savedAt: 1000 }),
  );
  assert.strictEqual(loadSession(storage, '482917'), null);
});

test('7. clearSession followed by loadSession is null', () => {
  const storage = createFakeStorage();
  const session = { sessionToken: 'tok-abc', roomCode: '482917', playerId: 'p1', savedAt: 1000 };
  saveSession(storage, session);
  clearSession(storage, '482917');
  assert.strictEqual(loadSession(storage, '482917'), null);
});

test('8. saveSession/loadSession with playerId: null round-trips null exactly', () => {
  const storage = createFakeStorage();
  const session = { sessionToken: 'tok-abc', roomCode: '482917', playerId: null, savedAt: 1000 };
  saveSession(storage, session);
  const loaded = loadSession(storage, '482917');
  assert.deepStrictEqual(loaded, session);
  assert.strictEqual(loaded.playerId, null);
});

test('9. saveSession lets a real storage.setItem error propagate, no silent swallow', () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {},
  };
  assert.throws(
    () => saveSession(storage, { sessionToken: 'tok', roomCode: '482917', playerId: null, savedAt: 1 }),
    /QuotaExceededError/,
  );
});

test('10. two different roomCode values in the same storage do not cross-contaminate', () => {
  const storage = createFakeStorage();
  const sessionA = { sessionToken: 'tok-a', roomCode: '111111', playerId: 'pA', savedAt: 1000 };
  const sessionB = { sessionToken: 'tok-b', roomCode: '222222', playerId: null, savedAt: 2000 };
  saveSession(storage, sessionA);
  saveSession(storage, sessionB);

  assert.deepStrictEqual(loadSession(storage, '111111'), sessionA);
  assert.deepStrictEqual(loadSession(storage, '222222'), sessionB);
});
