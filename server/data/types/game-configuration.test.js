'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { assertGameConfigurationShape } = require('./game-configuration');

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

describe('assertGameConfigurationShape — letterlijk spec-voorbeeld #1', () => {
  test('#1 het DATA-MODEL.md-voorbeeld slaagt', () => {
    assert.doesNotThrow(() => assertGameConfigurationShape(VALID_CONFIG));
  });
});

describe('assertGameConfigurationShape — ontbrekend verplicht veld #2-18', () => {
  const fields = Object.keys(VALID_CONFIG);
  let n = 2;
  for (const field of fields) {
    const caseNum = n++;
    test(`#${caseNum} ontbrekend veld '${field}' -> throw`, () => {
      const { [field]: _omitted, ...rest } = VALID_CONFIG;
      assert.throws(() => assertGameConfigurationShape(rest));
    });
  }
});

describe('assertGameConfigurationShape — gesloten enums falen op ongeldige waarde #19-23', () => {
  test('#19 language met ongeldige waarde -> RangeError', () => {
    assert.throws(() => assertGameConfigurationShape({ ...VALID_CONFIG, language: 'fr' }), RangeError);
  });

  test('#20 mode met ongeldige waarde -> RangeError', () => {
    assert.throws(() => assertGameConfigurationShape({ ...VALID_CONFIG, mode: 'solo' }), RangeError);
  });

  test('#21 gameTypes met ongeldig element -> RangeError', () => {
    assert.throws(
      () => assertGameConfigurationShape({ ...VALID_CONFIG, gameTypes: ['flags_mc', 'not_a_real_type'] }),
      RangeError
    );
  });

  test('#22 pacing met ongeldige waarde -> RangeError', () => {
    assert.throws(() => assertGameConfigurationShape({ ...VALID_CONFIG, pacing: 'manual' }), RangeError);
  });

  test('#23 gameTypes faalt specifiek op een plausibele-maar-niet-Golf-1-waarde (regressietest bevinding 7)', () => {
    assert.throws(
      () => assertGameConfigurationShape({ ...VALID_CONFIG, gameTypes: ['logo_quiz'] }),
      RangeError
    );
  });
});

describe('assertGameConfigurationShape — bewust-open velden slagen op elke string #24-26', () => {
  test('#24 difficulty met een andere waarde dan het voorbeeld slaagt', () => {
    assert.doesNotThrow(() => assertGameConfigurationShape({ ...VALID_CONFIG, difficulty: 'expert' }));
  });

  test('#25 scoreboardFrequency met een andere waarde dan het voorbeeld slaagt', () => {
    assert.doesNotThrow(() => assertGameConfigurationShape({ ...VALID_CONFIG, scoreboardFrequency: 'periodic' }));
  });

  test('#26 metricMode met een andere waarde dan het voorbeeld slaagt', () => {
    assert.doesNotThrow(() => assertGameConfigurationShape({ ...VALID_CONFIG, metricMode: 'population' }));
  });
});

describe('assertGameConfigurationShape — preset slaagt op het voorbeeld, niet gesloten #27', () => {
  test('#27 preset met een andere waarde dan "group_battle" slaagt (geen gesloten enum)', () => {
    assert.doesNotThrow(() => assertGameConfigurationShape({ ...VALID_CONFIG, preset: 'custom_preset' }));
  });
});
