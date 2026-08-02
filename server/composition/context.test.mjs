// Tests voor de gedeelde compositienaad. Geen enkele test raakt de echte
// klok: `now` is altijd een vaste, geïnjecteerde functie.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createInMemoryStore } from '../data/in-memory-store.js';
import {
  createContext,
  createId,
  createSessionToken,
  hashSessionToken,
  verifySessionToken,
} from './context.mjs';

const FIXED_NOW = 1_754_136_000_000;
const PEPPER = 'test-pepper-met-ruim-genoeg-bytes';
const APP_URL = 'https://play.aseso.nl';

function makeContext(overrides = {}) {
  return createContext({
    store: createInMemoryStore(),
    now: () => FIXED_NOW,
    config: { tokenPepper: PEPPER, publicAppUrl: APP_URL },
    ...overrides,
  });
}

test('createContext accepteert een volledige DataStore en bevriest de config', () => {
  const context = makeContext();
  assert.equal(context.now(), FIXED_NOW);
  assert.equal(context.config.publicAppUrl, APP_URL);
  assert.throws(() => {
    context.config.publicAppUrl = 'https://evil.example';
  }, TypeError);
});

test('createContext weigert een store die de poort niet volledig implementeert', () => {
  const incomplete = createInMemoryStore();
  delete incomplete.getScoreboardTop;
  assert.throws(() => makeContext({ store: incomplete }), /missing method: getScoreboardTop/);
});

test('createContext eist een geïnjecteerde now die epoch-ms teruggeeft', () => {
  assert.throws(() => makeContext({ now: undefined }), /`now` is verplicht/);
  assert.throws(() => makeContext({ now: () => 'nu' }), /epoch-ms/);
  assert.throws(() => makeContext({ now: () => -1 }), /epoch-ms/);
});

test('createContext weigert een ontbrekende of te korte tokenPepper', () => {
  assert.throws(
    () => makeContext({ config: { publicAppUrl: APP_URL } }),
    /tokenPepper.*string of een Buffer/s,
  );
  assert.throws(
    () => makeContext({ config: { tokenPepper: 'kort', publicAppUrl: APP_URL } }),
    /minimaal 16 bytes/,
  );
});

test('createContext weigert een publicAppUrl die geen absolute http(s)-URL is', () => {
  assert.throws(
    () => makeContext({ config: { tokenPepper: PEPPER, publicAppUrl: '/j' } }),
    /publicAppUrl/,
  );
  assert.throws(
    () => makeContext({ config: { tokenPepper: PEPPER, publicAppUrl: 'ftp://x.example' } }),
    /publicAppUrl/,
  );
});

test('createSessionToken volgt besluit 26: 32 random bytes base64url + HMAC-SHA256-opslag', () => {
  const context = makeContext();
  const { token, tokenHash } = createSessionToken(context);

  // 32 bytes base64url zonder padding = 43 tekens.
  assert.equal(token.length, 43);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(tokenHash, /^[0-9a-f]{64}$/);
  assert.equal(tokenHash, hashSessionToken(context, token));
  // Het klare token staat nooit in de opslagwaarde.
  assert.ok(!tokenHash.includes(token));
});

test('createSessionToken levert elke keer een ander token op', () => {
  const context = makeContext();
  const tokens = new Set(Array.from({ length: 20 }, () => createSessionToken(context).token));
  assert.equal(tokens.size, 20);
});

test('dezelfde token onder een andere pepper geeft een andere hash', () => {
  const contextA = makeContext();
  const contextB = makeContext({
    config: { tokenPepper: 'een-heel-andere-pepper-waarde', publicAppUrl: APP_URL },
  });
  const { token, tokenHash } = createSessionToken(contextA);
  assert.notEqual(hashSessionToken(contextB, token), tokenHash);
  assert.equal(verifySessionToken(contextB, token, tokenHash), false);
});

test('verifySessionToken accepteert het juiste token en werpt nooit op vijandige invoer', () => {
  const context = makeContext();
  const { token, tokenHash } = createSessionToken(context);

  assert.equal(verifySessionToken(context, token, tokenHash), true);
  assert.equal(verifySessionToken(context, `${token.slice(0, 42)}X`, tokenHash), false);
  assert.equal(verifySessionToken(context, '', tokenHash), false);
  assert.equal(verifySessionToken(context, null, tokenHash), false);
  assert.equal(verifySessionToken(context, {}, tokenHash), false);
  assert.equal(verifySessionToken(context, token, 'geen-geldige-hash'), false);
  assert.equal(verifySessionToken(context, token, null), false);
});

test('createId levert prefix + base64url zonder Redis-key-scheidingstekens', () => {
  const context = makeContext();
  const id = createId(context, 'room');
  assert.match(id, /^room_[A-Za-z0-9_-]{12}$/);
  assert.ok(!id.includes(':'));
  assert.notEqual(createId(context, 'room'), createId(context, 'room'));
  assert.throws(() => createId(context, ''), /prefix/);
});

test('cryptoSource is injecteerbaar zodat tokengeneratie deterministisch testbaar is', () => {
  const context = makeContext({
    cryptoSource: { randomBytes: (size) => Buffer.alloc(size, 7) },
  });
  const first = createSessionToken(context);
  const second = createSessionToken(context);
  assert.equal(first.token, second.token);
  assert.equal(first.tokenHash, second.tokenHash);
});
