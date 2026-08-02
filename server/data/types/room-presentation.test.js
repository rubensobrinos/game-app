'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { assertRoomPresentationShape } = require('./room-presentation');

const VALID_ROOM_PRESENTATION = Object.freeze({
  roomId: 'room_01J...',
  groupName: 'Team Nachtdieren',
  badgeSpec: {},
  badgeAssetUrl: null,
});

describe('assertRoomPresentationShape — letterlijk spec-voorbeeld #1', () => {
  test('#1 het DATA-MODEL.md-voorbeeld slaagt', () => {
    assert.doesNotThrow(() => assertRoomPresentationShape(VALID_ROOM_PRESENTATION));
  });
});

describe('assertRoomPresentationShape — ontbrekend verplicht veld #2-5', () => {
  const fields = Object.keys(VALID_ROOM_PRESENTATION);
  let n = 2;
  for (const field of fields) {
    const caseNum = n++;
    test(`#${caseNum} ontbrekend veld '${field}' -> throw`, () => {
      const { [field]: _omitted, ...rest } = VALID_ROOM_PRESENTATION;
      assert.throws(() => assertRoomPresentationShape(rest));
    });
  }
});

describe('assertRoomPresentationShape — badgeAssetUrl string|null #6-7', () => {
  test('#6 badgeAssetUrl als niet-lege string slaagt', () => {
    assert.doesNotThrow(() => assertRoomPresentationShape({ ...VALID_ROOM_PRESENTATION, badgeAssetUrl: 'https://example.com/badge.svg' }));
  });
  test('#7 badgeAssetUrl als getal -> throw', () => {
    assert.throws(() => assertRoomPresentationShape({ ...VALID_ROOM_PRESENTATION, badgeAssetUrl: 123 }));
  });
});

describe('assertRoomPresentationShape — badgeSpec moet plain object zijn #8-9', () => {
  test('#8 badgeSpec als array -> throw', () => {
    assert.throws(() => assertRoomPresentationShape({ ...VALID_ROOM_PRESENTATION, badgeSpec: [] }));
  });
  test('#9 badgeSpec gevuld slaagt (opaak)', () => {
    assert.doesNotThrow(() => assertRoomPresentationShape({ ...VALID_ROOM_PRESENTATION, badgeSpec: { pattern: 'nordic' } }));
  });
});
