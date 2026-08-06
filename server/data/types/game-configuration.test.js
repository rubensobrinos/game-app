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
  autoReveal: true,
  speedBonus: true,
  deadlineGraceMs: 150,
  mode: 'individual',
  teamNames: [],
  metricMode: 'mixed',
  maxPlayers: 100,
  allowLateJoin: true,
  continents: ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'],
});

describe('assertGameConfigurationShape — letterlijk spec-voorbeeld #1', () => {
  test('#1 het DATA-MODEL.md-voorbeeld slaagt', () => {
    assert.doesNotThrow(() => assertGameConfigurationShape(VALID_CONFIG));
  });
});

describe('assertGameConfigurationShape — ontbrekend verplicht veld #2-20', () => {
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

  test('mode "teams" wordt geweigerd zolang besluit 8 geldt, niet stilzwijgend geaccepteerd', () => {
    // `teams` staat in de typedef en in MODE_VALUES, maar besluit 8 zegt dat
    // teams nu niet gebouwd worden — er is geen teamscoring, -indeling of
    // -weergave. Zou de validator het accepteren, dan draait een match die
    // "teams" heet gewoon individueel zonder dat iemand het merkt.
    // `04-SCREEN-SPECIFICATIONS.md` §Instellingen beschrijft stap 4 als "teams
    // of individuele modus", dus dit is een realistisch pad.
    //
    // Draai deze assertie om zodra teams gebouwd worden.
    assert.throws(() => assertGameConfigurationShape({ ...VALID_CONFIG, mode: 'teams' }), RangeError);
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

describe('assertGameConfigurationShape — autoReveal is een verplichte boolean (besluit C)', () => {
  test('een string "false" is geen boolean en wordt geweigerd', () => {
    // Waarom expliciet: `autoReveal` komt binnen via een toggle en via
    // `game:update-config`. Een waarheidsachtige string zou hier stilzwijgend
    // "aan" betekenen, terwijl de host "uit" bedoelde — en dan wacht de
    // uitslagfase nooit op hem.
    assert.throws(() => assertGameConfigurationShape({ ...VALID_CONFIG, autoReveal: 'false' }), TypeError);
  });

  test('false slaagt gewoon', () => {
    assert.doesNotThrow(() => assertGameConfigurationShape({ ...VALID_CONFIG, autoReveal: false }));
  });
});

describe('assertGameConfigurationShape — preset slaagt op het voorbeeld, niet gesloten #27', () => {
  test('#27 preset met een andere waarde dan "group_battle" slaagt (geen gesloten enum)', () => {
    assert.doesNotThrow(() => assertGameConfigurationShape({ ...VALID_CONFIG, preset: 'custom_preset' }));
  });
});

describe('assertGameConfigurationShape — continents (punt 7, continentfilter.md)', () => {
  test('een enkel continent slaagt — geen ondergrens op het aantal', () => {
    assert.doesNotThrow(() => assertGameConfigurationShape({ ...VALID_CONFIG, continents: ['Oceania'] }));
  });

  test('alle zes continenten (het standaardvoorbeeld) slaagt', () => {
    assert.doesNotThrow(() => assertGameConfigurationShape(VALID_CONFIG));
  });

  test('een lege lijst -> RangeError (geen speelbare room zonder continent)', () => {
    assert.throws(() => assertGameConfigurationShape({ ...VALID_CONFIG, continents: [] }), RangeError);
  });

  test('een onbekende continentnaam -> RangeError', () => {
    assert.throws(() => assertGameConfigurationShape({ ...VALID_CONFIG, continents: ['Europe', 'Atlantis'] }), RangeError);
  });

  test('een niet-array -> TypeError', () => {
    assert.throws(() => assertGameConfigurationShape({ ...VALID_CONFIG, continents: 'Europe' }), TypeError);
  });
});
