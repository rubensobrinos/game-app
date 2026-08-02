import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGetStateRequestShape,
  validateLeaveGameRequestShape,
  validateTimeResponse,
} from './rest-games-session.mjs';
import { ALL_ERROR_CODES } from './error-codes.mjs';

// Rij 20
test('validateGetStateRequestShape: geldige { code, authorizationHeader } → ok:true', () => {
  assert.deepEqual(
    validateGetStateRequestShape({ code: '482917', authorizationHeader: 'Bearer abc123' }),
    { ok: true, value: { code: '482917', token: 'abc123' } },
  );
});

// Rij 21 — twee losse gevallen
const invalidGameCodes = [
  ['5 cijfers ("12345")', '12345'],
  ['letters i.p.v. cijfers ("abcdef")', 'abcdef'],
];

for (const [label, code] of invalidGameCodes) {
  test(`validateGetStateRequestShape: code ${label} → GAME_NOT_FOUND`, () => {
    assert.deepEqual(
      validateGetStateRequestShape({ code, authorizationHeader: 'Bearer abc123' }),
      { ok: false, code: 'GAME_NOT_FOUND' },
    );
  });
}

// Rij 22 — drie losse gevallen
const invalidAuthorizationHeaders = [
  ['ontbrekende header (undefined)', undefined],
  ['verkeerd prefix ("Token abc123")', 'Token abc123'],
  ['leeg token ("Bearer ")', 'Bearer '],
];

for (const [label, authorizationHeader] of invalidAuthorizationHeaders) {
  test(`validateGetStateRequestShape: ${label} → TOKEN_INVALID`, () => {
    assert.deepEqual(
      validateGetStateRequestShape({ code: '482917', authorizationHeader }),
      { ok: false, code: 'TOKEN_INVALID' },
    );
  });
}

// Rij 23
test('validateLeaveGameRequestShape: geldige { code, authorizationHeader } → ok:true', () => {
  assert.deepEqual(
    validateLeaveGameRequestShape({ code: '482917', authorizationHeader: 'Bearer abc123' }),
    { ok: true, value: { code: '482917', token: 'abc123' } },
  );
});

// Rij 24
test('validateLeaveGameRequestShape: ontbrekende authorizationHeader → TOKEN_INVALID', () => {
  assert.deepEqual(
    validateLeaveGameRequestShape({ code: '482917', authorizationHeader: undefined }),
    { ok: false, code: 'TOKEN_INVALID' },
  );
});

// Rij 25 — exacte fixture uit Brondocument (PROTOCOL.md, `GET /api/v1/time`)
test('validateTimeResponse: exacte fixture { serverTime: 1785623412000 } → ok:true', () => {
  assert.deepEqual(
    validateTimeResponse({ serverTime: 1785623412000 }),
    { ok: true, value: { serverTime: 1785623412000 } },
  );
});

// Rij 26 — drie losse gevallen. De testtabel pint hier bewust geen specifieke
// foutcode (in tegenstelling tot rijen 21/22/24) — zie de JSDoc bij
// `INVALID_SERVER_RESPONSE` in rest-games-session.mjs voor de reden. Deze
// tests controleren daarom alleen `ok: false`.
const invalidTimeResponseBodies = [
  ['serverTime als string ("1785623412000")', { serverTime: '1785623412000' }],
  ['serverTime negatief (-5)', { serverTime: -5 }],
  ['serverTime ontbreekt', {}],
];

for (const [label, body] of invalidTimeResponseBodies) {
  test(`validateTimeResponse: ${label} → ok:false`, () => {
    const result = validateTimeResponse(body);
    assert.equal(result.ok, false);
  });
}

// PR11 §4 — DECISIONS.md punt 19: de lokale `/time`-foutafhandeling gebruikt
// een eigen `INVALID_SERVER_RESPONSE`-constante, en die wordt bewust GEEN
// nieuwe wire-foutcode (niet toegevoegd aan `error-codes.mjs`'s
// `ALL_ERROR_CODES`). Regressietest voor beide kanten van die eis.
test('validateTimeResponse: ongeldige body → code is de lokale "INVALID_SERVER_RESPONSE"', () => {
  const result = validateTimeResponse({});
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_SERVER_RESPONSE');
});
test('INVALID_SERVER_RESPONSE is geen wire-foutcode: ontbreekt in error-codes.mjs\'s ALL_ERROR_CODES', () => {
  assert.equal(ALL_ERROR_CODES.has('INVALID_SERVER_RESPONSE'), false);
});
