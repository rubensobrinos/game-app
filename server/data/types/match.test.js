'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { assertMatchShape, MATCH_PHASE_VALUES } = require('./match');
const { ROOM_PHASE_VALUES } = require('./room');

const VALID_MATCH = Object.freeze({
  id: 'match_01J...',
  roomId: 'room_01J...',
  sequence: 2,
  phase: 'ROUND_ACTIVE',
  startedAt: 1785623000000,
  finishedAt: null,
  roundIndex: 6,
  roundIds: ['round_01', 'round_02'],
  usedQuestionKeys: ['flags:jp'],
  previousMatchQuestionKeys: ['flags:br'],
  pausedState: null,
  contentVersion: '2026.08.1',
  rendererVersion: 'flag-renderer-1',
});

const VALID_PAUSED_STATE = Object.freeze({
  previousPhase: 'ROUND_ACTIVE',
  remainingMs: 7200,
  reason: 'host',
  pausedAt: 1785623412000,
});

describe('assertMatchShape — letterlijk spec-voorbeeld #1', () => {
  test('#1 het DATA-MODEL.md-voorbeeld slaagt', () => {
    assert.doesNotThrow(() => assertMatchShape(VALID_MATCH));
  });
});

describe('assertMatchShape — ontbrekend verplicht veld #2-12', () => {
  const fields = Object.keys(VALID_MATCH);
  let n = 2;
  for (const field of fields) {
    const caseNum = n++;
    test(`#${caseNum} ontbrekend veld '${field}' -> throw`, () => {
      const { [field]: _omitted, ...rest } = VALID_MATCH;
      assert.throws(() => assertMatchShape(rest));
    });
  }
});

describe('assertMatchShape — phase gesloten enum #13', () => {
  test('#13 phase met ongeldige waarde -> RangeError', () => {
    assert.throws(() => assertMatchShape({ ...VALID_MATCH, phase: 'UNKNOWN' }), RangeError);
  });
});

describe('assertMatchShape — sequence/roundIndex grenzen #14-18', () => {
  test('#14 sequence = 0 -> RangeError', () => {
    assert.throws(() => assertMatchShape({ ...VALID_MATCH, sequence: 0 }), RangeError);
  });
  test('#15 sequence = 1 slaagt (grenswaarde, eerste match)', () => {
    assert.doesNotThrow(() => assertMatchShape({ ...VALID_MATCH, sequence: 1 }));
  });
  test('#16 roundIndex = 0 slaagt (0-based, HANDOFF.md §2)', () => {
    assert.doesNotThrow(() => assertMatchShape({ ...VALID_MATCH, roundIndex: 0 }));
  });
  test('#17 roundIndex negatief -> RangeError', () => {
    assert.throws(() => assertMatchShape({ ...VALID_MATCH, roundIndex: -1 }), RangeError);
  });
  test('#18 roundIndex niet-integer -> RangeError', () => {
    assert.throws(() => assertMatchShape({ ...VALID_MATCH, roundIndex: 2.5 }), RangeError);
  });
});

describe('assertMatchShape — lege arrays toegestaan voor een verse match #19', () => {
  test('#19 lege roundIds/usedQuestionKeys/previousMatchQuestionKeys slaagt', () => {
    assert.doesNotThrow(() =>
      assertMatchShape({ ...VALID_MATCH, roundIds: [], usedQuestionKeys: [], previousMatchQuestionKeys: [] })
    );
  });
});

describe('assertMatchShape — pausedState #20-25', () => {
  test('#20 pausedState: null slaagt', () => {
    assert.doesNotThrow(() => assertMatchShape({ ...VALID_MATCH, pausedState: null }));
  });
  test('#21 geldige pausedState slaagt', () => {
    assert.doesNotThrow(() => assertMatchShape({ ...VALID_MATCH, pausedState: VALID_PAUSED_STATE }));
  });
  test('#22 pausedState.previousPhase ongeldig -> RangeError', () => {
    assert.throws(
      () => assertMatchShape({ ...VALID_MATCH, pausedState: { ...VALID_PAUSED_STATE, previousPhase: 'UNKNOWN' } }),
      RangeError
    );
  });
  test('#23 pausedState.remainingMs negatief -> throw', () => {
    assert.throws(() => assertMatchShape({ ...VALID_MATCH, pausedState: { ...VALID_PAUSED_STATE, remainingMs: -1 } }));
  });
  test('#24 pausedState.reason leeg -> throw', () => {
    assert.throws(() => assertMatchShape({ ...VALID_MATCH, pausedState: { ...VALID_PAUSED_STATE, reason: '' } }));
  });
  test('#25 pausedState.pausedAt niet-eindig -> throw', () => {
    assert.throws(() => assertMatchShape({ ...VALID_MATCH, pausedState: { ...VALID_PAUSED_STATE, pausedAt: Infinity } }));
  });
});

describe('assertMatchShape — finishedAt number|null #26-27', () => {
  test('#26 finishedAt als getal slaagt', () => {
    assert.doesNotThrow(() => assertMatchShape({ ...VALID_MATCH, finishedAt: 1785624000000 }));
  });
  test('#27 finishedAt als string -> throw', () => {
    assert.throws(() => assertMatchShape({ ...VALID_MATCH, finishedAt: 'never' }));
  });
});

describe('assertMatchShape — contentVersion/rendererVersion (DECISIONS.md #21) #28-29', () => {
  test('#28 contentVersion leeg -> throw', () => {
    assert.throws(() => assertMatchShape({ ...VALID_MATCH, contentVersion: '' }));
  });
  test('#29 rendererVersion niet-string -> throw', () => {
    assert.throws(() => assertMatchShape({ ...VALID_MATCH, rendererVersion: 42 }));
  });
});

describe('MATCH_PHASE_VALUES/ROOM_PHASE_VALUES — cross-bestand-consistentie #30', () => {
  test('#30 dezelfde set van zeven fasewaarden in match.js en room.js', () => {
    const matchSet = new Set(MATCH_PHASE_VALUES);
    const roomSet = new Set(ROOM_PHASE_VALUES);
    assert.strictEqual(matchSet.size, 7);
    assert.strictEqual(roomSet.size, 7);
    assert.deepStrictEqual(matchSet, roomSet);
  });
});
