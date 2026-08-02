'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildMatchQuestionPlan } = require('./question-selection');

// Kleine handgeschreven fixture, geen echte 230-landenset (sneller, leesbaarder).
// easy: 7 landen (Europa:4, Azië:2, Zuid-Amerika:1) — Europa is de enige
//   continent met >= 3 op deze moeilijkheid, dus de enige geldige
//   Buitenbeentje-meerderheid. br heeft capital: null. de/jp delen gdp: 4000.
// medium: 4 landen, elk continent < 3 — forceert flags_mc-afleiderfallback
//   én bewijst dat odd_one_out dan geen meerderheid kan vinden.
// extreme: 2 landen — te weinig voor 4-optie-spelvormen (RangeError-bewijs).
const POOL = [
  { iso2: 'fr', difficulty: 'easy', continent: 'Europe', name: { nl: 'Frankrijk', en: 'France', es: 'Francia' }, capital: { nl: 'Parijs', en: 'Paris', es: 'París' }, population: 68000000, area: 551695, gdp: 3000 },
  { iso2: 'de', difficulty: 'easy', continent: 'Europe', name: { nl: 'Duitsland', en: 'Germany', es: 'Alemania' }, capital: { nl: 'Berlijn', en: 'Berlin', es: 'Berlín' }, population: 84000000, area: 357588, gdp: 4000 },
  { iso2: 'es', difficulty: 'easy', continent: 'Europe', name: { nl: 'Spanje', en: 'Spain', es: 'España' }, capital: { nl: 'Madrid', en: 'Madrid', es: 'Madrid' }, population: 47000000, area: 505990, gdp: 1400 },
  { iso2: 'nl', difficulty: 'easy', continent: 'Europe', name: { nl: 'Nederland', en: 'Netherlands', es: 'Países Bajos' }, capital: { nl: 'Amsterdam', en: 'Amsterdam', es: 'Ámsterdam' }, population: 17000000, area: null, gdp: 900 },
  { iso2: 'jp', difficulty: 'easy', continent: 'Asia', name: { nl: 'Japan', en: 'Japan', es: 'Japón' }, capital: { nl: 'Tokio', en: 'Tokyo', es: 'Tokio' }, population: 125000000, area: 377975, gdp: 4000 },
  { iso2: 'cn', difficulty: 'easy', continent: 'Asia', name: { nl: 'China', en: 'China', es: 'China' }, capital: { nl: 'Peking', en: 'Beijing', es: 'Pekín' }, population: 1400000000, area: 9596961, gdp: 17000 },
  { iso2: 'br', difficulty: 'easy', continent: 'South America', name: { nl: 'Brazilië', en: 'Brazil', es: 'Brasil' }, capital: null, population: 215000000, area: 8515767, gdp: 1600 },
  { iso2: 'it', difficulty: 'medium', continent: 'Europe', name: { nl: 'Italië', en: 'Italy', es: 'Italia' }, capital: { nl: 'Rome', en: 'Rome', es: 'Roma' }, population: 59000000, area: 301340, gdp: 2000 },
  { iso2: 'pt', difficulty: 'medium', continent: 'Europe', name: { nl: 'Portugal', en: 'Portugal', es: 'Portugal' }, capital: { nl: 'Lissabon', en: 'Lisbon', es: 'Lisboa' }, population: 10000000, area: 92212, gdp: 250 },
  { iso2: 'kr', difficulty: 'medium', continent: 'Asia', name: { nl: 'Zuid-Korea', en: 'South Korea', es: 'Corea del Sur' }, capital: { nl: 'Seoel', en: 'Seoul', es: 'Seúl' }, population: 51000000, area: 100210, gdp: 1700 },
  { iso2: 'eg', difficulty: 'medium', continent: 'Africa', name: { nl: 'Egypte', en: 'Egypt', es: 'Egipto' }, capital: { nl: 'Caïro', en: 'Cairo', es: 'El Cairo' }, population: 104000000, area: 1002450, gdp: 400 },
  { iso2: 'va', difficulty: 'extreme', continent: 'Europe', name: { nl: 'Vaticaanstad', en: 'Vatican City', es: 'Ciudad del Vaticano' }, capital: { nl: 'Vaticaanstad', en: 'Vatican City', es: 'Ciudad del Vaticano' }, population: 800, area: 0.49, gdp: 1 },
  { iso2: 'gi', difficulty: 'extreme', continent: 'Europe', name: { nl: 'Gibraltar', en: 'Gibraltar', es: 'Gibraltar' }, capital: null, population: 34000, area: 6.8, gdp: 3 },
];

function sequenceRandom(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

// Formule-gebaseerd, niet toevalsafhankelijk: dezelfde offset geeft altijd
// dezelfde reeks (nodig voor het determinisme-bewijs in #25).
function counterRandom(offset) {
  let n = offset;
  return () => {
    const v = (n % 97) / 97;
    n += 1;
    return v;
  };
}

const mockGenerateFlagSpec = (seed) => ({
  pattern: 'nordic',
  palette: ['#000000', '#ffffff'],
  seedEcho: seed,
  rendererVersion: 'flag-renderer-test-1',
});

function baseParams(overrides) {
  return {
    pool: POOL,
    gameType: 'flags_mc',
    totalRounds: 1,
    difficulty: 'easy',
    metricMode: 'population',
    previousMatchQuestionKeys: [],
    random: counterRandom(0),
    generateFlagSpec: mockGenerateFlagSpec,
    ...overrides,
  };
}

describe('inputvalidatie #1-6', () => {
  test('#1 gameType ontbreekt of is onbekend -> RangeError', () => {
    assert.throws(() => buildMatchQuestionPlan(baseParams({ gameType: undefined })), RangeError);
    assert.throws(() => buildMatchQuestionPlan(baseParams({ gameType: 'not_a_type' })), RangeError);
  });

  test('#2 totalRounds <= 0 of niet-integer -> RangeError', () => {
    assert.throws(() => buildMatchQuestionPlan(baseParams({ totalRounds: 0 })), RangeError);
    assert.throws(() => buildMatchQuestionPlan(baseParams({ totalRounds: -1 })), RangeError);
    assert.throws(() => buildMatchQuestionPlan(baseParams({ totalRounds: 1.5 })), RangeError);
  });

  test('#3 onbekende difficulty -> RangeError', () => {
    assert.throws(() => buildMatchQuestionPlan(baseParams({ difficulty: 'legendary' })), RangeError);
  });

  test('#4 onbekende metricMode -> RangeError', () => {
    assert.throws(() => buildMatchQuestionPlan(baseParams({ metricMode: 'weight' })), RangeError);
  });

  test('#5 dubbele iso2 in pool -> RangeError', () => {
    const dupPool = [...POOL, { ...POOL[0] }];
    assert.throws(() => buildMatchQuestionPlan(baseParams({ pool: dupPool })), RangeError);
  });

  test('#6 random() buiten [0,1) -> RangeError', () => {
    for (const bad of [1, -0.1, NaN, Infinity]) {
      assert.throws(() => buildMatchQuestionPlan(baseParams({ random: () => bad })), RangeError);
    }
  });
});

describe('outputcontract per spelvorm #7-12', () => {
  test('#7 flags_mc-resultaat', () => {
    const [q] = buildMatchQuestionPlan(baseParams({ gameType: 'flags_mc' }));
    const { targetIso2, optionIso2s } = q.publicQuestionPayload;
    assert.strictEqual(optionIso2s.length, 4);
    assert.strictEqual(new Set(optionIso2s).size, 4);
    assert.ok(optionIso2s.includes(targetIso2));
    assert.deepStrictEqual(q.correctAnswer, { optionId: targetIso2 });
    assert.deepStrictEqual(q.validOptionIds, optionIso2s);
  });

  test('#8 capitals_mc: land met capital=null nooit target of afleider', () => {
    const results = buildMatchQuestionPlan(
      baseParams({ gameType: 'capitals_mc', totalRounds: 6, random: counterRandom(0) })
    );
    const eligibleTargets = new Set(['fr', 'de', 'es', 'nl', 'jp', 'cn']);
    for (const q of results) {
      assert.ok(!q.publicQuestionPayload.optionIso2s.includes('br'));
      assert.ok(eligibleTargets.has(q.publicQuestionPayload.targetIso2));
    }
    assert.strictEqual(new Set(results.map((q) => q.publicQuestionPayload.targetIso2)).size, 6);
  });

  test('#8b een ontbrekende capital-key (niet expliciet null) wordt ook uitgesloten van capitals_mc', () => {
    // Regressietest voor de interface-gotcha richting CT/INT-A: een
    // contentbron die de key weglaat i.p.v. `capital: null` te zetten, mag
    // niet stilzwijgend als geschikt voor capitals_mc worden behandeld.
    const poolWithMissingKey = POOL.map((e) => {
      if (e.iso2 !== 'jp') return e;
      const { capital, ...withoutCapital } = e;
      return withoutCapital;
    });
    const results = buildMatchQuestionPlan(
      baseParams({ pool: poolWithMissingKey, gameType: 'capitals_mc', totalRounds: 5, random: counterRandom(0) })
    );
    for (const q of results) {
      assert.notStrictEqual(q.publicQuestionPayload.targetIso2, 'jp');
      assert.ok(!q.publicQuestionPayload.optionIso2s.includes('jp'));
    }
  });

  test('#9 real_or_fake_flag, generated-tak levert seed/rendererVersion/spec van generateFlagSpec', () => {
    const results = buildMatchQuestionPlan(
      baseParams({ gameType: 'real_or_fake_flag', totalRounds: 6, random: counterRandom(0) })
    );
    const generated = results.find((q) => q.publicQuestionPayload.kind === 'generated');
    assert.ok(generated, 'verwacht minstens één generated ronde in 6 pogingen');
    assert.strictEqual(generated.publicQuestionPayload.rendererVersion, 'flag-renderer-test-1');
    assert.deepStrictEqual(generated.publicQuestionPayload.spec, {
      pattern: 'nordic',
      palette: ['#000000', '#ffffff'],
      seedEcho: generated.publicQuestionPayload.seed,
    });
    assert.strictEqual(generated.questionKey, `rof:${generated.publicQuestionPayload.seed}`);
  });

  test('#10 higher_lower: publicQuestionPayload zonder waarden, resultDetails met beide', () => {
    const [q] = buildMatchQuestionPlan(baseParams({ gameType: 'higher_lower', metricMode: 'gdp' }));
    for (const side of q.publicQuestionPayload.sides) {
      assert.ok(!('value' in side));
    }
    assert.strictEqual(q.resultDetails.values.length, 2);
    for (const v of q.resultDetails.values) {
      assert.strictEqual(typeof v.value, 'number');
    }
  });

  test('#11 odd_one_out: publicQuestionPayload zonder continent, resultDetails met beide', () => {
    const [q] = buildMatchQuestionPlan(baseParams({ gameType: 'odd_one_out' }));
    for (const card of q.publicQuestionPayload.cards) {
      assert.ok(!('continent' in card));
    }
    assert.strictEqual(typeof q.resultDetails.majorityContinent, 'string');
    assert.strictEqual(typeof q.resultDetails.minorityContinent, 'string');
    assert.notStrictEqual(q.resultDetails.majorityContinent, q.resultDetails.minorityContinent);
  });

  test('#12 questionKey voor higher_lower bevat de metriek', () => {
    const pairSuffix = (key) => key.split(':').slice(2).join(':');
    const popResults = buildMatchQuestionPlan(
      baseParams({ gameType: 'higher_lower', metricMode: 'population', totalRounds: 21, random: counterRandom(0) })
    );
    const gdpResults = buildMatchQuestionPlan(
      baseParams({ gameType: 'higher_lower', metricMode: 'gdp', totalRounds: 20, random: counterRandom(0) })
    );
    const popPairs = new Set(popResults.map((q) => pairSuffix(q.questionKey)));
    const gdpPairs = new Set(gdpResults.map((q) => pairSuffix(q.questionKey)));
    const shared = [...popPairs].find((p) => gdpPairs.has(p));
    assert.ok(shared, 'verwacht een gedeeld landenpaar tussen beide metriekruns');

    const popKey = popResults.find((q) => pairSuffix(q.questionKey) === shared).questionKey;
    const gdpKey = gdpResults.find((q) => pairSuffix(q.questionKey) === shared).questionKey;
    assert.notStrictEqual(popKey, gdpKey);
    assert.ok(popKey.startsWith('higher_lower:population:'));
    assert.ok(gdpKey.startsWith('higher_lower:gdp:'));
  });
});

describe('echt/nep-balancering #13-15', () => {
  test('#13 6 rondes -> exact 3 real + 3 generated', () => {
    const results = buildMatchQuestionPlan(
      baseParams({ gameType: 'real_or_fake_flag', totalRounds: 6, random: counterRandom(0) })
    );
    const real = results.filter((q) => q.publicQuestionPayload.kind === 'real').length;
    const generated = results.filter((q) => q.publicQuestionPayload.kind === 'generated').length;
    assert.strictEqual(real, 3);
    assert.strictEqual(generated, 3);
  });

  test('#14 5 rondes -> 3/2 of 2/3, nooit 5/0 of 0/5', () => {
    const results = buildMatchQuestionPlan(
      baseParams({ gameType: 'real_or_fake_flag', totalRounds: 5, random: counterRandom(0) })
    );
    const real = results.filter((q) => q.publicQuestionPayload.kind === 'real').length;
    const generated = results.length - real;
    assert.ok(real >= 2 && generated >= 2);
    assert.strictEqual(Math.abs(real - generated), 1);
  });

  test('#15 random blijft altijd < 0.5 (zou bij per-ronde opgooi altijd real geven) -> toch max. 1 verschil', () => {
    // Blijft onder 0.5 (zou een naïeve per-ronde `random() < 0.5`-opgooi altijd
    // "real" laten geven), maar varieert genoeg om seedgeneratie niet te laten
    // botsen — dat is een aparte zorg dan wat deze test bewijst.
    let n = 0;
    const alwaysLowRandom = () => ((n++ % 41) / 41) * 0.49;
    const results = buildMatchQuestionPlan(
      baseParams({ gameType: 'real_or_fake_flag', totalRounds: 6, random: alwaysLowRandom })
    );
    const real = results.filter((q) => q.publicQuestionPayload.kind === 'real').length;
    const generated = results.length - real;
    assert.strictEqual(real, 3);
    assert.strictEqual(generated, 3);
  });
});

describe('afleider-fallback #16-17', () => {
  test('#16 doelcontinent < 3 andere landen -> rest van de pool vult aan tot 3', () => {
    const [q] = buildMatchQuestionPlan(baseParams({ gameType: 'flags_mc', difficulty: 'medium' }));
    assert.strictEqual(q.publicQuestionPayload.optionIso2s.length, 4);
    assert.strictEqual(new Set(q.publicQuestionPayload.optionIso2s).size, 4);
  });

  test('#17 pool op moeilijkheid heeft < 4 landen totaal -> RangeError (flags_mc en capitals_mc)', () => {
    assert.throws(() => buildMatchQuestionPlan(baseParams({ gameType: 'flags_mc', difficulty: 'extreme' })), RangeError);
    assert.throws(
      () => buildMatchQuestionPlan(baseParams({ gameType: 'capitals_mc', difficulty: 'extreme' })),
      RangeError
    );
  });
});

describe('rematch-exclusie met fallback #18-20', () => {
  test('#18 uitsluiting sluit weinig uit, ruim genoeg over -> blijft actief', () => {
    const q = buildMatchQuestionPlan(
      baseParams({
        gameType: 'flags_mc',
        previousMatchQuestionKeys: ['flags:fr', 'flags:de', 'flags:es'],
        random: counterRandom(0),
      })
    )[0];
    assert.ok(!['fr', 'de', 'es'].includes(q.publicQuestionPayload.targetIso2));
  });

  test('#19 uitsluiting sluit te veel uit -> vervalt, match wordt toch volledig gevuld', () => {
    const results = buildMatchQuestionPlan(
      baseParams({
        gameType: 'flags_mc',
        totalRounds: 7,
        previousMatchQuestionKeys: ['flags:fr'],
        random: counterRandom(0),
      })
    );
    assert.strictEqual(results.length, 7);
    assert.strictEqual(new Set(results.map((q) => q.questionKey)).size, 7);
  });

  test('#20 zelfde patroon voor odd_one_out (begrensde herhaling i.p.v. volledige opsomming)', () => {
    // "easy" heeft precies 1 continent (Europa) met >= 3 landen, dus maximaal
    // C(4,3) x 3 = 12 unieke Buitenbeentje-combinaties. Deze test vraagt niet
    // de volledige 12 op (dat duwt de begrensde-herhaling-aanpak naar zijn
    // uiterste, wat een aparte, fragielere zorg is) — 6 is ruim genoeg om als
    // stevige uitsluiting te dienen én betrouwbaar binnen de pogingslimiet te
    // vinden.
    const priorMatch = buildMatchQuestionPlan(
      baseParams({ gameType: 'odd_one_out', totalRounds: 6, random: counterRandom(0) })
    );
    const heavyExclusion = priorMatch.map((q) => q.questionKey);
    assert.strictEqual(new Set(heavyExclusion).size, 6);

    const results = buildMatchQuestionPlan(
      baseParams({
        gameType: 'odd_one_out',
        totalRounds: 3,
        previousMatchQuestionKeys: heavyExclusion,
        random: counterRandom(50),
      })
    );
    assert.strictEqual(results.length, 3);
    assert.strictEqual(new Set(results.map((q) => q.questionKey)).size, 3);
  });
});

describe('geen dubbele vraag binnen de match #21-23', () => {
  test('#21 genoeg pool -> alle questionKeys uniek', () => {
    const results = buildMatchQuestionPlan(
      baseParams({ gameType: 'flags_mc', totalRounds: 5, random: counterRandom(0) })
    );
    assert.strictEqual(new Set(results.map((q) => q.questionKey)).size, 5);
  });

  test('#22 pool net genoeg -> slaagt, geen herhaling', () => {
    const results = buildMatchQuestionPlan(
      baseParams({ gameType: 'flags_mc', totalRounds: 7, random: counterRandom(0) })
    );
    assert.strictEqual(results.length, 7);
    assert.strictEqual(new Set(results.map((q) => q.questionKey)).size, 7);
  });

  test('#23 pool te klein -> RangeError', () => {
    assert.throws(
      () => buildMatchQuestionPlan(baseParams({ gameType: 'flags_mc', totalRounds: 8, random: counterRandom(0) })),
      RangeError
    );
  });
});

describe('immutability en volledig determinisme #24-26', () => {
  test('#24 pool en previousMatchQuestionKeys blijven ongewijzigd', () => {
    const poolBefore = JSON.parse(JSON.stringify(POOL));
    const prevKeys = ['flags:fr'];
    const prevKeysBefore = [...prevKeys];
    buildMatchQuestionPlan(baseParams({ gameType: 'flags_mc', previousMatchQuestionKeys: prevKeys }));
    assert.deepStrictEqual(POOL, poolBefore);
    assert.deepStrictEqual(prevKeys, prevKeysBefore);
  });

  test('#25 identieke input + identieke randomreeks -> byte-voor-byte identiek plan', () => {
    const paramsA = baseParams({ gameType: 'odd_one_out', totalRounds: 4, random: counterRandom(7) });
    const paramsB = baseParams({ gameType: 'odd_one_out', totalRounds: 4, random: counterRandom(7) });
    const resultA = buildMatchQuestionPlan(paramsA);
    const resultB = buildMatchQuestionPlan(paramsB);
    assert.deepStrictEqual(resultA, resultB);
  });

  test('#26 alle rondes hebben exact het gevraagde gameType, geen mengeling', () => {
    for (const gameType of ['flags_mc', 'capitals_mc', 'real_or_fake_flag', 'higher_lower', 'odd_one_out']) {
      const results = buildMatchQuestionPlan(baseParams({ gameType, totalRounds: 3, random: counterRandom(0) }));
      assert.strictEqual(results.length, 3);
      assert.ok(results.every((q) => q.gameType === gameType));
    }
  });
});
