import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes as realRandomBytes } from 'node:crypto';
import { generateSessionToken, hashToken, verifyToken } from './auth-session.mjs';

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

// PR8b, bijgewerkt naar PR12's hashToken(token, { version, pepper })-signatuur.

// 4. hashToken: zelfde token, zelfde pepper (andere versie dan hierboven) ->
//    verschillende hash dan met een andere pepper.
test('hashToken: zelfde token, andere pepper (zelfde versie) geeft verschillende hash', () => {
  const hashA = hashToken('token-abc', { version: 'v1', pepper: 'pepper-one' });
  const hashB = hashToken('token-abc', { version: 'v1', pepper: 'pepper-two' });
  assert.notEqual(hashA, hashB);
});

// 5. hashToken: verschillende token, zelfde pepperConfig -> verschillende hash.
test('hashToken: verschillende token, zelfde pepperConfig geeft verschillende hash', () => {
  const hashA = hashToken('token-one', { version: 'v1', pepper: 'pepper-abc' });
  const hashB = hashToken('token-two', { version: 'v1', pepper: 'pepper-abc' });
  assert.notEqual(hashA, hashB);
});

// 6. hashToken met lege string als token, version of pepper: gedefinieerd
//    gedrag (gekozen: afwijzen met een duidelijke Error — zie JSDoc in
//    auth-session.mjs).
test('hashToken: lege token, lege version of lege pepper wordt afgewezen met een duidelijke Error', () => {
  assert.throws(() => hashToken('', { version: 'v1', pepper: 'pepper-xyz' }), /token mag geen lege string zijn/);
  assert.throws(
    () => hashToken('token-abc', { version: '', pepper: 'pepper-xyz' }),
    /pepperConfig\.version mag geen lege string zijn/,
  );
  assert.throws(
    () => hashToken('token-abc', { version: 'v1', pepper: '' }),
    /pepperConfig\.pepper mag geen lege string zijn/,
  );
});

// --- PR12: pepper-versionering + constant-time verifyToken ---
// Verplichte testgevallen 1-11 uit
// docs/protocol-plan/prompts/PR12-auth-session-extension.md.

// 1. hashToken: zelfde token/pepperConfig, twee aanroepen -> identieke output.
test('PR12 #1 hashToken: zelfde token en pepperConfig geven bij twee aanroepen identieke output', () => {
  const pepperConfig = { version: 'v1', pepper: 'pepper-xyz' };
  const hashA = hashToken('token-abc', pepperConfig);
  const hashB = hashToken('token-abc', pepperConfig);
  assert.equal(hashA, hashB);
});

// 2. hashToken: andere `version` in pepperConfig, zelfde token/pepper ->
//    andere output-string.
test('PR12 #2 hashToken: andere version in pepperConfig geeft andere output-string', () => {
  const hashV1 = hashToken('token-abc', { version: 'v1', pepper: 'dezelfde-pepper' });
  const hashV2 = hashToken('token-abc', { version: 'v2', pepper: 'dezelfde-pepper' });
  assert.notEqual(hashV1, hashV2);
});

// 3. hashToken: output-vorm begint met `${version}:`, gevolgd door 64
//    hex-tekens.
test('PR12 #3 hashToken: output-vorm is `${version}:` gevolgd door 64 hex-tekens', () => {
  const hash = hashToken('token-abc', { version: 'v1', pepper: 'pepper-xyz' });
  assert.match(hash, /^v1:[0-9a-f]{64}$/);
});

// 4. verifyToken: juiste token tegen de bijbehorende storedHash, juiste
//    peppersByVersion -> true.
test('PR12 #4 verifyToken: juiste token tegen de bijbehorende storedHash geeft true', () => {
  const pepperConfig = { version: 'v1', pepper: 'pepper-xyz' };
  const storedHash = hashToken('token-abc', pepperConfig);
  assert.equal(verifyToken('token-abc', storedHash, { v1: 'pepper-xyz' }), true);
});

// 5. verifyToken: onjuiste token die verschilt in het eerste byte van de
//    hash-invoer -> false, geen throw.
test('PR12 #5 verifyToken: token die verschilt in het eerste byte geeft false zonder throw', () => {
  const pepperConfig = { version: 'v1', pepper: 'pepper-xyz' };
  const storedHash = hashToken('aaaa-token', pepperConfig);
  assert.doesNotThrow(() => {
    assert.equal(verifyToken('baaa-token', storedHash, { v1: 'pepper-xyz' }), false);
  });
});

// 6. verifyToken: onjuiste token die verschilt in het laatste byte -> false,
//    geen throw.
test('PR12 #6 verifyToken: token die verschilt in het laatste byte geeft false zonder throw', () => {
  const pepperConfig = { version: 'v1', pepper: 'pepper-xyz' };
  const storedHash = hashToken('token-aaaa', pepperConfig);
  assert.doesNotThrow(() => {
    assert.equal(verifyToken('token-aaab', storedHash, { v1: 'pepper-xyz' }), false);
  });
});

// 7. verifyToken: storedHash's versie zit niet in peppersByVersion (bv.
//    ingetrokken/onbekende versie) -> false.
test('PR12 #7 verifyToken: onbekende/ingetrokken pepperversie geeft false', () => {
  const storedHash = hashToken('token-abc', { version: 'v9-ingetrokken', pepper: 'pepper-xyz' });
  assert.equal(verifyToken('token-abc', storedHash, { v1: 'andere-pepper' }), false);
});

// 8. verifyToken: storedHash zonder `version:`-scheiding, of met ongeldige
//    hex -> false, geen throw.
test('PR12 #8 verifyToken: storedHash zonder scheiding of met ongeldige hex geeft false zonder throw', () => {
  assert.doesNotThrow(() => {
    assert.equal(verifyToken('token-abc', 'geen-scheidingsteken-hier', { v1: 'pepper-xyz' }), false);
  });
  assert.doesNotThrow(() => {
    // 'zz' is geen geldig hex-teken.
    assert.equal(verifyToken('token-abc', 'v1:zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', { v1: 'pepper-xyz' }), false);
  });
  assert.doesNotThrow(() => {
    // oneven aantal hex-tekens.
    assert.equal(verifyToken('token-abc', 'v1:abc', { v1: 'pepper-xyz' }), false);
  });
});

// 9. verifyToken: storedHash en de herberekende hash hebben een verschillende
//    lengte -> false, geen throw (timingSafeEqual gooit zelf bij ongelijke
//    lengte, dus dat wordt expliciet afgevangen vóórdat het wordt
//    aangeroepen).
test('PR12 #9 verifyToken: storedHash met afwijkende (maar geldige) hex-lengte geeft false zonder throw', () => {
  // Geldige hex, maar slechts 32 tekens (16 bytes) i.p.v. de verwachte 64
  // tekens (32 bytes) van een echte SHA-256-digest.
  const shortStoredHash = 'v1:0011223344556677889900112233445566778899001122334455667788990011';
  assert.doesNotThrow(() => {
    assert.equal(verifyToken('token-abc', 'v1:aabb', { v1: 'pepper-xyz' }), false);
  });
  assert.doesNotThrow(() => {
    assert.equal(verifyToken('token-abc', shortStoredHash, { v1: 'pepper-xyz' }), false);
  });
});

// 10. verifyToken (rotatiescenario): een storedHash gemaakt met v1,
//     geverifieerd met peppersByVersion = { v1: oldPepper, v2: currentPepper }
//     (beide nog aanwezig tijdens rotatie) -> true.
test('PR12 #10 verifyToken rotatiescenario: oude pepperversie blijft verifieerbaar naast een nieuwe', () => {
  const oldPepperConfig = { version: 'v1', pepper: 'oude-pepper' };
  const storedHash = hashToken('token-abc', oldPepperConfig);
  const peppersByVersion = { v1: 'oude-pepper', v2: 'huidige-pepper' };
  assert.equal(verifyToken('token-abc', storedHash, peppersByVersion), true);
});

// 11. integratie: hashToken -> verifyToken met dezelfde pepperConfig/token
//     slaagt zonder Buffer/string-typefouten.
test('PR12 #11 integratie: hashToken -> verifyToken met dezelfde pepperConfig/token slaagt', () => {
  const token = generateSessionToken(realCryptoSource());
  const pepperConfig = { version: 'v1', pepper: 'een-server-side-pepper' };
  const storedHash = hashToken(token, pepperConfig);
  assert.equal(typeof storedHash, 'string');
  assert.doesNotThrow(() => {
    assert.equal(verifyToken(token, storedHash, { v1: pepperConfig.pepper }), true);
  });
});
