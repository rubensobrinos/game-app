import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes as realRandomBytes } from 'node:crypto';
import { generateSessionToken, hashToken } from './auth-session.mjs';

/**
 * Deterministische fake `randomBytes`: negeert `size` en retourneert altijd
 * dezelfde vaste 32 bytes, zodat testgeval 1 een reproduceerbare output kan
 * verwachten zonder de echte CSPRNG aan te roepen.
 * @returns {{ randomBytes: (size: number) => Buffer }}
 */
function fakeFixedCryptoSource() {
  const fixedBytes = Buffer.from(
    [
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11,
      0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
    ],
  );
  return { randomBytes: () => fixedBytes };
}

/** @returns {{ randomBytes: (size: number) => Buffer }} echte `node:crypto`-CSPRNG. */
function realCryptoSource() {
  return { randomBytes: (size) => realRandomBytes(size) };
}

// 1. generateSessionToken met een deterministische fake randomBytes ->
//    reproduceerbare output.
test('generateSessionToken: deterministische fake randomBytes geeft reproduceerbare output', () => {
  const tokenA = generateSessionToken(fakeFixedCryptoSource());
  const tokenB = generateSessionToken(fakeFixedCryptoSource());
  assert.equal(tokenA, tokenB);
  // Vaste verwachte waarde: base64url (zonder padding) van de 32 vaste bytes
  // hierboven, zodat dit ook een expliciete regressie-anker is.
  assert.equal(
    tokenA,
    Buffer.from(
      [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11,
        0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
      ],
    ).toString('base64url'),
  );
});

// 2. output-vorm: exacte base64url-lengte voor 32 bytes (43 tekens, geen
//    padding, geen +/ tekens).
test('generateSessionToken: output-vorm is exact 43 tekens base64url zonder padding of +//', () => {
  const token = generateSessionToken(fakeFixedCryptoSource());
  assert.equal(token.length, 43);
  assert.equal(/[+/=]/.test(token), false);
  assert.equal(/^[A-Za-z0-9_-]+$/.test(token), true);
});

// 3. 1000 aanroepen met echte crypto.randomBytes -> geen enkele botsing
//    (smoke test).
test('generateSessionToken: 1000 aanroepen met echte randomBytes botsen niet (smoke test)', () => {
  const source = realCryptoSource();
  const tokens = new Set();
  for (let i = 0; i < 1000; i += 1) {
    tokens.add(generateSessionToken(source));
  }
  assert.equal(tokens.size, 1000);
});

// 4. hashToken: zelfde token+pepper, twee aanroepen -> identieke hash.
test('hashToken: zelfde token en pepper geven bij twee aanroepen identieke hash', () => {
  const hashA = hashToken('token-abc', 'pepper-xyz');
  const hashB = hashToken('token-abc', 'pepper-xyz');
  assert.equal(hashA, hashB);
});

// 5. hashToken: zelfde token, verschillende pepper -> verschillende hash.
test('hashToken: zelfde token, verschillende pepper geeft verschillende hash', () => {
  const hashA = hashToken('token-abc', 'pepper-one');
  const hashB = hashToken('token-abc', 'pepper-two');
  assert.notEqual(hashA, hashB);
});

// 6. hashToken: verschillende token, zelfde pepper -> verschillende hash.
test('hashToken: verschillende token, zelfde pepper geeft verschillende hash', () => {
  const hashA = hashToken('token-one', 'pepper-abc');
  const hashB = hashToken('token-two', 'pepper-abc');
  assert.notEqual(hashA, hashB);
});

// 7. hashToken output-vorm: exact 64 hex-tekens (SHA-256 digest lengte).
test('hashToken: output-vorm is exact 64 hex-tekens', () => {
  const hash = hashToken('token-abc', 'pepper-xyz');
  assert.equal(hash.length, 64);
  assert.equal(/^[0-9a-f]{64}$/.test(hash), true);
});

// 8. hashToken met lege string als token of pepper: gedefinieerd gedrag
//    (gekozen: afwijzen met een duidelijke Error — zie JSDoc in
//    auth-session.mjs).
test('hashToken: lege token of lege pepper wordt afgewezen met een duidelijke Error', () => {
  assert.throws(() => hashToken('', 'pepper-xyz'), /token mag geen lege string zijn/);
  assert.throws(() => hashToken('token-abc', ''), /pepper mag geen lege string zijn/);
  assert.throws(() => hashToken('', ''), /token mag geen lege string zijn/);
});

// 9. integratie: hashToken(generateSessionToken(realRandomBytes), pepper)
//    slaagt zonder Buffer/string-typefouten.
test('integratie: hashToken(generateSessionToken(echte randomBytes), pepper) slaagt', () => {
  const token = generateSessionToken(realCryptoSource());
  assert.equal(typeof token, 'string');
  const hash = hashToken(token, 'een-server-side-pepper');
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);
  assert.equal(/^[0-9a-f]{64}$/.test(hash), true);
});
