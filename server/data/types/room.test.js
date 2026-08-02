'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { assertRoomShape, ROOM_PHASE_VALUES } = require('./room');

const VALID_CONFIG = Object.freeze({
  preset: 'group_battle',
  gameTypes: ['flags_mc', 'capitals_mc', 'real_or_fake_flag', 'higher_lower', 'odd_one_out'],
  language: 'nl',
  difficulty: 'normal',
  totalRounds: 10,
  questionSeconds: 15,
  resultSeconds: 5,
  scoreboardSeconds: 4,
  scoreboardFrequency: 'every_round',
  pacing: 'auto',
  speedBonus: true,
  deadlineGraceMs: 150,
  mode: 'individual',
  teamNames: [],
  metricMode: 'mixed',
  maxPlayers: 100,
  allowLateJoin: true,
});

const VALID_ROOM_CORE = Object.freeze({
  id: 'room_01J...',
  code: '482917',
  inviteId: 'N4x7pQm2K8tW',
  phase: 'LOBBY',
  createdAt: 1785620000000,
  lastActivityAt: 1785623412000,
  hostSessionIds: ['sess_01J...'],
  locked: false,
  config: VALID_CONFIG,
  currentMatchId: null,
});

describe('assertRoomShape — letterlijk spec-voorbeeld minus contentVersion/rendererVersion #1', () => {
  test('#1 het voorbeeld (zonder de twee uitgesloten velden) slaagt', () => {
    assert.doesNotThrow(() => assertRoomShape(VALID_ROOM_CORE));
  });
});

describe('assertRoomShape — ontbrekend verplicht veld #2-11', () => {
  const fields = Object.keys(VALID_ROOM_CORE);
  let n = 2;
  for (const field of fields) {
    const caseNum = n++;
    test(`#${caseNum} ontbrekend veld '${field}' -> throw`, () => {
      const { [field]: _omitted, ...rest } = VALID_ROOM_CORE;
      assert.throws(() => assertRoomShape(rest));
    });
  }
});

describe('assertRoomShape — phase gesloten enum #12-19', () => {
  test('#12 phase met ongeldige waarde -> RangeError', () => {
    assert.throws(() => assertRoomShape({ ...VALID_ROOM_CORE, phase: 'UNKNOWN' }), RangeError);
  });

  let n = 13;
  for (const phase of ROOM_PHASE_VALUES) {
    const caseNum = n++;
    test(`#${caseNum} phase '${phase}' slaagt`, () => {
      assert.doesNotThrow(() => assertRoomShape({ ...VALID_ROOM_CORE, phase }));
    });
  }
});

describe('assertRoomShape — config delegeert naar assertGameConfigurationShape #20', () => {
  test('#20 een ongeldige config (ontbrekend veld) faalt via delegatie', () => {
    const { preset: _omitted, ...invalidConfig } = VALID_CONFIG;
    assert.throws(() => assertRoomShape({ ...VALID_ROOM_CORE, config: invalidConfig }));
  });
});

describe('assertRoomShape — currentMatchId string|null #21-22', () => {
  test('#21 currentMatchId als niet-lege string slaagt', () => {
    assert.doesNotThrow(() => assertRoomShape({ ...VALID_ROOM_CORE, currentMatchId: 'match_01J...' }));
  });

  test('#22 currentMatchId als getal -> throw', () => {
    assert.throws(() => assertRoomShape({ ...VALID_ROOM_CORE, currentMatchId: 123 }));
  });
});

describe('assertRoomShape — hostSessionIds minimaal 1 element #23', () => {
  test('#23 lege hostSessionIds -> throw', () => {
    assert.throws(() => assertRoomShape({ ...VALID_ROOM_CORE, hostSessionIds: [] }));
  });
});

describe('assertRoomShape — regressietest: contentVersion/rendererVersion worden genegeerd, niet gevalideerd (bevinding 9) #24', () => {
  test('#24 een object MET contentVersion/rendererVersion komt nog steeds door de check', () => {
    assert.doesNotThrow(() =>
      assertRoomShape({
        ...VALID_ROOM_CORE,
        contentVersion: '2026.08.1',
        rendererVersion: 'flag-renderer-1',
      })
    );
  });
});
