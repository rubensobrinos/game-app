import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildErrorPayload } from './error-payload.mjs';

test('buildErrorPayload: geldige code + expliciet lege meta', () => {
  assert.deepEqual(buildErrorPayload('ROOM_LOCKED', {}), { code: 'ROOM_LOCKED', meta: {} });
});

test('buildErrorPayload: meta-argument weglaten defaultet naar {}', () => {
  assert.deepEqual(buildErrorPayload('ROOM_LOCKED'), { code: 'ROOM_LOCKED', meta: {} });
});

test('buildErrorPayload: onbekende code gooit', () => {
  assert.throws(() => buildErrorPayload('NOT_A_REAL_CODE', {}));
});

test('buildErrorPayload: displayName in meta gooit', () => {
  assert.throws(() => buildErrorPayload('ROOM_LOCKED', { displayName: 'Ruben' }));
});

const forbiddenMetaVariants = [
  ['sessionToken', { sessionToken: 'abc' }],
  ['token', { token: 'abc' }],
  ['authorization', { authorization: 'Bearer abc' }],
  ['ip', { ip: '1.2.3.4' }],
  ['ipAddress', { ipAddress: '1.2.3.4' }],
  ['answer', { answer: { optionId: 'opt_2' } }],
  ['payload', { payload: {} }],
];

for (const [label, meta] of forbiddenMetaVariants) {
  test(`buildErrorPayload: verboden meta-sleutel "${label}" gooit`, () => {
    assert.throws(() => buildErrorPayload('ROOM_LOCKED', meta));
  });
}

test('buildErrorPayload: geneste verboden sleutel (details.token) gooit', () => {
  assert.throws(() => buildErrorPayload('ROOM_LOCKED', { details: { token: 'abc' } }));
});

test('buildErrorPayload: hoofdletterongevoelige match (DisplayName) gooit', () => {
  assert.throws(() => buildErrorPayload('ROOM_LOCKED', { DisplayName: 'Ruben' }));
});

test('buildErrorPayload: niet-verboden sleutel (reason) blijft toegestaan', () => {
  assert.deepEqual(
    buildErrorPayload('ROOM_LOCKED', { reason: 'room is locked' }),
    { code: 'ROOM_LOCKED', meta: { reason: 'room is locked' } },
  );
});

test('buildErrorPayload: geslaagde aanroepen bevatten nooit stack of message', () => {
  const cases = [
    buildErrorPayload('ROOM_LOCKED'),
    buildErrorPayload('ROOM_LOCKED', {}),
    buildErrorPayload('ROOM_LOCKED', { reason: 'room is locked' }),
  ];
  for (const result of cases) {
    assert.equal(Object.hasOwn(result, 'stack'), false);
    assert.equal(Object.hasOwn(result, 'message'), false);
    assert.deepEqual(Object.keys(result).sort(), ['code', 'meta']);
  }
});
