'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { assertSessionShape } = require('./session');

const VALID_SESSION_HOST_AND_PLAYER = Object.freeze({
  id: 'sess_01J...',
  roomId: 'room_01J...',
  roles: ['host', 'player'],
  playerId: 'p_8f42d1',
  tokenHash: 'sha256:...',
  createdAt: 1785620000000,
  lastSeenAt: 1785623412000,
  connectedSocketIds: ['socket_...'],
  revoked: false,
});

const VALID_SESSION_HOST_ONLY = Object.freeze({
  ...VALID_SESSION_HOST_AND_PLAYER,
  roles: ['host'],
  playerId: null,
});

describe('assertSessionShape — letterlijke spec-voorbeelden #1-2', () => {
  test('#1 host+player-voorbeeld slaagt', () => {
    assert.doesNotThrow(() => assertSessionShape(VALID_SESSION_HOST_AND_PLAYER));
  });

  test('#2 host-only-voorbeeld (playerId: null) slaagt', () => {
    assert.doesNotThrow(() => assertSessionShape(VALID_SESSION_HOST_ONLY));
  });
});

describe('assertSessionShape — ontbrekend verplicht veld #3-10', () => {
  const fields = Object.keys(VALID_SESSION_HOST_AND_PLAYER);
  let n = 3;
  for (const field of fields) {
    const caseNum = n++;
    test(`#${caseNum} ontbrekend veld '${field}' -> throw`, () => {
      const { [field]: _omitted, ...rest } = VALID_SESSION_HOST_AND_PLAYER;
      assert.throws(() => assertSessionShape(rest));
    });
  }
});

describe('assertSessionShape — roles is een gesloten enum #11-12', () => {
  test('#11 roles met ongeldig element -> RangeError', () => {
    assert.throws(
      () => assertSessionShape({ ...VALID_SESSION_HOST_AND_PLAYER, roles: ['host', 'admin'] }),
      RangeError
    );
  });

  test('#12 roles als lege array -> throw', () => {
    assert.throws(() => assertSessionShape({ ...VALID_SESSION_HOST_AND_PLAYER, roles: [] }));
  });
});

describe('assertSessionShape — tokenHash heeft GEEN prefixcheck (regressietest bevinding 8) #13-14', () => {
  test('#13 tokenHash zonder "sha256:"-prefix slaagt', () => {
    assert.doesNotThrow(() => assertSessionShape({ ...VALID_SESSION_HOST_AND_PLAYER, tokenHash: 'opaque-token-value' }));
  });

  test('#14 tokenHash als lege string -> throw (nog steeds niet-leeg verplicht)', () => {
    assert.throws(() => assertSessionShape({ ...VALID_SESSION_HOST_AND_PLAYER, tokenHash: '' }));
  });
});

describe('assertSessionShape — playerId string|null #15-16', () => {
  test('#15 playerId als niet-lege string slaagt', () => {
    assert.doesNotThrow(() => assertSessionShape({ ...VALID_SESSION_HOST_AND_PLAYER, playerId: 'p_x' }));
  });

  test('#16 playerId als getal -> throw', () => {
    assert.throws(() => assertSessionShape({ ...VALID_SESSION_HOST_AND_PLAYER, playerId: 123 }));
  });
});
