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
const PEPPER_V2 = 'tweede-pepper-met-ruim-genoeg-bytes';
/** Besluit 26: versieerbare peppers — één actieve versie, alle geldige in de map. */
const TOKEN_PEPPERS = { version: 'v1', peppers: { v1: PEPPER } };
const APP_URL = 'https://play.aseso.nl';

function makeContext(overrides = {}) {
  return createContext({
    store: createInMemoryStore(),
    now: () => FIXED_NOW,
    config: { tokenPeppers: TOKEN_PEPPERS, publicAppUrl: APP_URL },
    ...overrides,
  });
}

test('createContext accepteert een volledige DataStore en bevriest de config', () => {
  const mutablePeppers = { version: 'v1', peppers: { v1: PEPPER } };
  const context = makeContext({ config: { tokenPeppers: mutablePeppers, publicAppUrl: APP_URL } });
  assert.equal(context.now(), FIXED_NOW);
  assert.equal(context.config.publicAppUrl, APP_URL);
  assert.throws(() => {
    context.config.publicAppUrl = 'https://evil.example';
  }, TypeError);
  // De peppermap is genest, dus een ondiepe freeze volstaat daar niet.
  assert.throws(() => {
    context.config.tokenPeppers.version = 'v9';
  }, TypeError);
  assert.throws(() => {
    context.config.tokenPeppers.peppers.v1 = 'gekaapt-maar-lang-genoeg-hoor';
  }, TypeError);
  // Ook een latere mutatie van het meegegeven object raakt de context niet.
  mutablePeppers.peppers.v1 = 'gekaapt-maar-lang-genoeg-hoor';
  assert.equal(context.config.tokenPeppers.peppers.v1, PEPPER);
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
  const withPeppers = (tokenPeppers) => makeContext({ config: { tokenPeppers, publicAppUrl: APP_URL } });

  assert.throws(() => makeContext({ config: { publicAppUrl: APP_URL } }), /tokenPeppers.*\{ version, peppers \}/s);
  assert.throws(() => withPeppers(PEPPER), /tokenPeppers.*\{ version, peppers \}/s); // de oude platte vorm
  assert.throws(() => withPeppers({ peppers: { v1: PEPPER } }), /tokenPeppers\.version/);
  assert.throws(() => withPeppers({ version: '', peppers: { v1: PEPPER } }), /tokenPeppers\.version/);
  assert.throws(() => withPeppers({ version: 'v1' }), /tokenPeppers\.peppers.*object/s);
  assert.throws(() => withPeppers({ version: 'v1', peppers: {} }), /mag niet leeg zijn/);
  // Elke pepper moet aan MIN_PEPPER_BYTES voldoen, ook een die alleen nog voor
  // verificatie van oude sessies in de map staat.
  assert.throws(() => withPeppers({ version: 'v1', peppers: { v1: 'kort' } }), /minimaal 16 bytes/);
  assert.throws(() => withPeppers({ version: 'v2', peppers: { v1: PEPPER, v2: 'kort' } }), /minimaal 16 bytes/);
  assert.throws(() => withPeppers({ version: 'v1', peppers: { v1: Buffer.from(PEPPER) } }), /niet-lege string/);
  // De actieve versie moet in de peppermap voorkomen.
  assert.throws(() => withPeppers({ version: 'v9', peppers: { v1: PEPPER } }), /actieve pepperversie "v9" ontbreekt/);
});

test('createContext weigert een publicAppUrl die geen absolute http(s)-URL is', () => {
  assert.throws(
    () => makeContext({ config: { tokenPeppers: TOKEN_PEPPERS, publicAppUrl: '/j' } }),
    /publicAppUrl/,
  );
  assert.throws(
    () => makeContext({ config: { tokenPeppers: TOKEN_PEPPERS, publicAppUrl: 'ftp://x.example' } }),
    /publicAppUrl/,
  );
});

test('createSessionToken volgt besluit 26: 32 random bytes base64url + HMAC-SHA256-opslag', () => {
  const context = makeContext();
  const { token, tokenHash } = createSessionToken(context);

  // 32 bytes base64url zonder padding = 43 tekens.
  assert.equal(token.length, 43);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  // De opslagvorm draagt de pepperversie als prefix (auth-session.mjs, PR12).
  assert.match(tokenHash, /^v1:[0-9a-f]{64}$/);
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
  // Dezelfde versienaam, andere pepperwaarde: het verschil zit dus echt in de
  // pepper en niet in het versieprefix.
  const contextB = makeContext({
    config: { tokenPeppers: { version: 'v1', peppers: { v1: 'een-heel-andere-pepper-waarde' } }, publicAppUrl: APP_URL },
  });
  const { token, tokenHash } = createSessionToken(contextA);
  assert.notEqual(hashSessionToken(contextB, token), tokenHash);
  assert.equal(verifySessionToken(contextB, token, tokenHash), false);
});

test('besluit 26: een met v1 gehasht token blijft verifiëren nadat v2 de actieve pepper is', () => {
  // Vóór de rotatie: v1 is actief en hasht de sessie.
  const before = makeContext();
  const { token, tokenHash } = createSessionToken(before);
  assert.match(tokenHash, /^v1:/);

  // Na de rotatie: v2 is actief, v1 staat nog in de map (de rotatievorm uit
  // auth-session.mjs's peppersByVersion).
  const after = makeContext({
    config: {
      tokenPeppers: { version: 'v2', peppers: { v1: PEPPER, v2: PEPPER_V2 } },
      publicAppUrl: APP_URL,
    },
  });
  assert.equal(verifySessionToken(after, token, tokenHash), true);
  // Nieuwe sessies krijgen wél meteen de nieuwe versie.
  const rotated = createSessionToken(after);
  assert.match(rotated.tokenHash, /^v2:/);
  assert.equal(verifySessionToken(after, rotated.token, rotated.tokenHash), true);

  // Zodra v1 uit de map verdwijnt (rotatie afgerond) vervalt de oude sessie —
  // en werpt dat geen fout, het levert gewoon false.
  const completed = makeContext({
    config: { tokenPeppers: { version: 'v2', peppers: { v2: PEPPER_V2 } }, publicAppUrl: APP_URL },
  });
  assert.equal(verifySessionToken(completed, token, tokenHash), false);
  assert.equal(verifySessionToken(completed, rotated.token, rotated.tokenHash), true);
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
  // Vormen die pas met het versieprefix kunnen bestaan.
  assert.equal(verifySessionToken(context, token, tokenHash.slice(3)), false); // hex zonder versie
  assert.equal(verifySessionToken(context, token, `v9:${tokenHash.slice(3)}`), false); // onbekende versie
  assert.equal(verifySessionToken(context, token, 'v1:zzzz'), false); // geen geldige hex
  assert.equal(verifySessionToken(context, token, 'v1:'), false);
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
