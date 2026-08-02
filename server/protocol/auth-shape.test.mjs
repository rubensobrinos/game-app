import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBearerAuthHeader, parseSocketAuthPayload } from './auth-shape.mjs';

// Rij 27
test('parseBearerAuthHeader: geldige "Bearer <token>"-header', () => {
  assert.deepEqual(parseBearerAuthHeader('Bearer abc123'), { ok: true, token: 'abc123' });
});

// Rij 28 — zes losse gevallen
const invalidBearerHeaders = [
  ['undefined (header ontbreekt)', undefined],
  ['null (header ontbreekt)', null],
  ['lege string', ''],
  ['"Bearer" zonder spatie/token', 'Bearer'],
  ['"Bearer  " — alleen whitespace als token', 'Bearer  '],
  ['"bearer abc123" — kleine letter prefix', 'bearer abc123'],
];

for (const [label, headerValue] of invalidBearerHeaders) {
  test(`parseBearerAuthHeader: ${label} → TOKEN_INVALID`, () => {
    assert.deepEqual(parseBearerAuthHeader(headerValue), { ok: false, code: 'TOKEN_INVALID' });
  });
}

// Rij 29
test('parseSocketAuthPayload: geldige fixture { sessionToken, protocolVersion: "v1" }', () => {
  assert.deepEqual(
    parseSocketAuthPayload({ sessionToken: 'tok_abc123', protocolVersion: 'v1' }),
    { ok: true, sessionToken: 'tok_abc123', protocolVersion: 'v1' },
  );
});

// Rij 30 — twee losse gevallen (geldige sessionToken, ongeldige/ontbrekende protocolVersion)
test('parseSocketAuthPayload: protocolVersion "v2" → PROTOCOL_VERSION_UNSUPPORTED', () => {
  assert.deepEqual(
    parseSocketAuthPayload({ sessionToken: 'tok_abc123', protocolVersion: 'v2' }),
    { ok: false, code: 'PROTOCOL_VERSION_UNSUPPORTED' },
  );
});

test('parseSocketAuthPayload: protocolVersion ontbreekt → PROTOCOL_VERSION_UNSUPPORTED', () => {
  assert.deepEqual(
    parseSocketAuthPayload({ sessionToken: 'tok_abc123' }),
    { ok: false, code: 'PROTOCOL_VERSION_UNSUPPORTED' },
  );
});

// Rij 31 — twee losse gevallen (ontbrekend/leeg sessionToken, geldige protocolVersion)
test('parseSocketAuthPayload: sessionToken ontbreekt, protocolVersion "v1" → TOKEN_INVALID', () => {
  assert.deepEqual(
    parseSocketAuthPayload({ protocolVersion: 'v1' }),
    { ok: false, code: 'TOKEN_INVALID' },
  );
});

test('parseSocketAuthPayload: sessionToken lege string, protocolVersion "v1" → TOKEN_INVALID', () => {
  assert.deepEqual(
    parseSocketAuthPayload({ sessionToken: '', protocolVersion: 'v1' }),
    { ok: false, code: 'TOKEN_INVALID' },
  );
});

// Rij 32 — drie losse gevallen
const nonObjectAuthPayloads = [
  ['auth is een string', 'not-an-object'],
  ['auth is undefined', undefined],
  ['auth is {}', {}],
];

for (const [label, auth] of nonObjectAuthPayloads) {
  test(`parseSocketAuthPayload: ${label} → TOKEN_INVALID`, () => {
    assert.deepEqual(parseSocketAuthPayload(auth), { ok: false, code: 'TOKEN_INVALID' });
  });
}

// Rij 33 — beide velden tegelijk ongeldig; vastgelegde precedentie: TOKEN_INVALID wint
test('parseSocketAuthPayload: sessionToken én protocolVersion beide ongeldig → TOKEN_INVALID (precedentie)', () => {
  assert.deepEqual(
    parseSocketAuthPayload({ sessionToken: '', protocolVersion: 'v2' }),
    { ok: false, code: 'TOKEN_INVALID' },
  );
});
