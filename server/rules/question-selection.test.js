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

// Elk POOL-land "heeft een contour" tenzij een test iets anders opgeeft —
// zelfde soort default als mockGenerateFlagSpec hierboven.
const mockHasShape = () => true;

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
    hasShape: mockHasShape,
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

  test('#11 odd_one_out (continentlogica): payload zonder continent, resultDetails met beide', () => {
    // Punt 11 (5 aug 2026) gaf deze game meer afwijklogica's; zónder
    // `generateFlagSpec` blijft alleen de continentvariant over, en dat is
    // precies wat deze test wil vastleggen.
    const [q] = buildMatchQuestionPlan(baseParams({ gameType: 'odd_one_out', generateFlagSpec: undefined }));
    for (const card of q.publicQuestionPayload.cards) {
      assert.ok(!('continent' in card));
    }
    assert.strictEqual(q.resultDetails.logic, 'continent');
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

// ─────────────────────────────────────────────────────────────────────────────
// Stap 6 (5 aug 2026): real/fake blijft in balans wanneer de compositie PER
// RONDE bouwt (totalRounds: 1). Zonder deze regel was elke vraag een losse
// muntworp en kon een hele avond nep zijn.
// ─────────────────────────────────────────────────────────────────────────────

describe('real_or_fake_flag — balans bij bouwen per ronde', () => {
  test('twaalf losse vragen leveren een nette wisseling echt/nep op', () => {
    const gebruikt = [];
    const soorten = [];

    for (let ronde = 0; ronde < 12; ronde += 1) {
      const [vraag] = buildMatchQuestionPlan({
        pool: POOL,
        gameType: 'real_or_fake_flag',
        totalRounds: 1,
        difficulty: 'easy',
        metricMode: 'mixed',
        previousMatchQuestionKeys: gebruikt,
        random: Math.random,
        generateFlagSpec: (seed) => ({ pattern: 'hstripes', palette: ['#000', '#fff', '#f00'], seed, rendererVersion: 'r1' }),
      });
      gebruikt.push(vraag.questionKey);
      soorten.push(vraag.publicQuestionPayload.kind);
    }

    const echt = soorten.filter((soort) => soort === 'real').length;
    const nep = soorten.length - echt;
    assert.ok(
      Math.abs(echt - nep) <= 1,
      `verwacht hooguit één verschil tussen echt (${echt}) en nep (${nep}); reeks: ${soorten.join(',')}`,
    );
  });

  test('een plan van meerdere rondes in één keer blijft de bestaande verdeling gebruiken', () => {
    const plan = buildMatchQuestionPlan({
      pool: POOL,
      gameType: 'real_or_fake_flag',
      totalRounds: 10,
      difficulty: 'easy',
      metricMode: 'mixed',
      random: Math.random,
      generateFlagSpec: (seed) => ({ pattern: 'hstripes', palette: ['#000', '#fff', '#f00'], seed, rendererVersion: 'r1' }),
    });
    const echt = plan.filter((vraag) => vraag.publicQuestionPayload.kind === 'real').length;
    assert.equal(echt, 5, 'tien rondes: vijf echt, vijf nep');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Punt 11 (producteigenaar, 5 aug 2026): "Welke hoort er niet bij" kent meer
// dan één afwijklogica. Deze tests dekken de twee die erbij zijn gekomen —
// een nepvlag tussen echte, en een echte tussen neppe.
// ─────────────────────────────────────────────────────────────────────────────

describe('odd_one_out — afwijklogica (punt 11)', () => {
  /** Draait genoeg rondes om alle logicavormen langs te laten komen. */
  function logicasOverRondes(rondes) {
    const gezien = new Map();
    const gebruikt = [];
    for (let i = 0; i < rondes; i += 1) {
      const [vraag] = buildMatchQuestionPlan(baseParams({
        gameType: 'odd_one_out',
        previousMatchQuestionKeys: gebruikt,
        random: Math.random,
      }));
      gebruikt.push(vraag.questionKey);
      gezien.set(vraag.resultDetails.logic, (gezien.get(vraag.resultDetails.logic) ?? 0) + 1);
    }
    return gezien;
  }

  test('alle drie de logicavormen komen voor over genoeg rondes', () => {
    const gezien = logicasOverRondes(40);
    for (const logic of ['continent', 'fake_among_real', 'real_among_fake']) {
      assert.ok(gezien.get(logic) > 0, `logica "${logic}" kwam niet voor: ${[...gezien.keys()].join(',')}`);
    }
  });

  test('elke vraag heeft vier kaarten en precies één afwijkende', () => {
    const gebruikt = [];
    for (let i = 0; i < 30; i += 1) {
      const [vraag] = buildMatchQuestionPlan(baseParams({
        gameType: 'odd_one_out',
        previousMatchQuestionKeys: gebruikt,
        random: Math.random,
      }));
      gebruikt.push(vraag.questionKey);

      const kaarten = vraag.publicQuestionPayload.cards;
      assert.strictEqual(kaarten.length, 4);
      assert.deepStrictEqual(kaarten.map((k) => k.cardIndex), [0, 1, 2, 3]);

      const juist = vraag.correctAnswer.cardIndex;
      assert.ok(juist >= 0 && juist <= 3);

      if (vraag.resultDetails.logic === 'fake_among_real') {
        // Drie echte vlaggen (iso2) + één gegenereerde (spec).
        const nep = kaarten.filter((k) => k.spec !== undefined);
        assert.strictEqual(nep.length, 1);
        assert.strictEqual(nep[0].cardIndex, juist, 'de nepvlag is het juiste antwoord');
      } else if (vraag.resultDetails.logic === 'real_among_fake') {
        const echt = kaarten.filter((k) => k.spec === undefined);
        assert.strictEqual(echt.length, 1);
        assert.strictEqual(echt[0].cardIndex, juist, 'de echte vlag is het juiste antwoord');
        // Drie verschillende nepvlaggen, geen drie keer dezelfde.
        const seeds = new Set(kaarten.filter((k) => k.spec !== undefined).map((k) => k.seed));
        assert.strictEqual(seeds.size, 3);
      }
    }
  });

  test('de payload verklapt de logica niet — die zit alleen in resultDetails', () => {
    const gebruikt = [];
    for (let i = 0; i < 20; i += 1) {
      const [vraag] = buildMatchQuestionPlan(baseParams({
        gameType: 'odd_one_out',
        previousMatchQuestionKeys: gebruikt,
        random: Math.random,
      }));
      gebruikt.push(vraag.questionKey);
      assert.ok(!('logic' in vraag.publicQuestionPayload));
      assert.ok(!('correctAnswer' in vraag.publicQuestionPayload));
      assert.strictEqual(typeof vraag.resultDetails.logic, 'string');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// docs/openstaand/raad-het-land.md, stap 3 — "Raad het land". Structureel
// gelijk aan flags_mc (zelfde continentvoorkeur, vier optie-iso2's), met één
// eigen regel: niet elk pool-land heeft een contour, dus `hasShape` bepaalt
// wie TARGET mag zijn. Afleiders hoeven geen contour te hebben.
// ─────────────────────────────────────────────────────────────────────────────

describe('country_shape_mc — "Raad het land" (stap 3)', () => {
  test('resultaat heeft dezelfde vorm als flags_mc: shape:-prefix, 4 unieke opties, target erbij', () => {
    const [q] = buildMatchQuestionPlan(baseParams({ gameType: 'country_shape_mc' }));
    assert.strictEqual(q.gameType, 'country_shape_mc');
    assert.match(q.questionKey, /^shape:/);
    const { targetIso2, optionIso2s } = q.publicQuestionPayload;
    assert.strictEqual(optionIso2s.length, 4);
    assert.strictEqual(new Set(optionIso2s).size, 4);
    assert.ok(optionIso2s.includes(targetIso2));
    assert.deepEqual(q.correctAnswer, { optionId: targetIso2 });
    assert.deepEqual(q.validOptionIds, optionIso2s);
  });

  test('hasShape ontbreekt of is geen functie -> RangeError (net als generateFlagSpec bij real_or_fake_flag)', () => {
    assert.throws(
      () => buildMatchQuestionPlan(baseParams({ gameType: 'country_shape_mc', hasShape: undefined })),
      RangeError,
    );
    assert.throws(
      () => buildMatchQuestionPlan(baseParams({ gameType: 'country_shape_mc', hasShape: 'nope' })),
      RangeError,
    );
  });

  test('alleen landen waarvoor hasShape true geeft, komen als TARGET voor', () => {
    // fr/de/es hebben in deze test geen contour; nl/jp/cn/br (easy) wel.
    const zonderContour = new Set(['fr', 'de', 'es']);
    const hasShape = (iso2) => !zonderContour.has(iso2);

    const gezienAlsTarget = new Set();
    for (let i = 0; i < 40; i += 1) {
      const [q] = buildMatchQuestionPlan(
        baseParams({ gameType: 'country_shape_mc', hasShape, random: counterRandom(i) }),
      );
      gezienAlsTarget.add(q.publicQuestionPayload.targetIso2);
    }
    assert.ok(gezienAlsTarget.size > 0, 'er moet minstens één target zijn voorgekomen');
    for (const iso2 of gezienAlsTarget) {
      assert.ok(!zonderContour.has(iso2), `"${iso2}" heeft geen contour en had nooit target mogen zijn`);
    }
  });

  test('een land zonder contour mag wél als afleider meedoen', () => {
    // Alleen nl heeft een contour: elke vraag moet nl als target kiezen, en
    // de drie afleiders komen noodgedwongen uit landen zonder contour.
    const hasShape = (iso2) => iso2 === 'nl';
    const [q] = buildMatchQuestionPlan(baseParams({ gameType: 'country_shape_mc', hasShape }));
    assert.strictEqual(q.publicQuestionPayload.targetIso2, 'nl');
    const distractors = q.publicQuestionPayload.optionIso2s.filter((iso2) => iso2 !== 'nl');
    assert.strictEqual(distractors.length, 3);
    assert.ok(distractors.every((iso2) => !hasShape(iso2)), 'afleiders zonder contour moeten toegestaan zijn');
  });

  test('geen enkel land met contour op deze moeilijkheid -> RangeError', () => {
    assert.throws(
      () => buildMatchQuestionPlan(baseParams({ gameType: 'country_shape_mc', hasShape: () => false })),
      RangeError,
    );
  });

  test('rematch-exclusie werkt via de shape:-prefix, net als flags:', () => {
    const [eerste] = buildMatchQuestionPlan(baseParams({ gameType: 'country_shape_mc' }));
    const plan = buildMatchQuestionPlan(
      baseParams({ gameType: 'country_shape_mc', previousMatchQuestionKeys: [eerste.questionKey] }),
    );
    assert.ok(plan.every((q) => q.questionKey !== eerste.questionKey));
  });
});

// Punt 7 / besluit 52 (docs/openstaand/continentfilter.md): `continents`
// filtert de kandidatenpool vóór elke spelvorm-specifieke selectie —
// `buildCandidatePool` is de ENE plek waar dat gebeurt, dus deze tests lopen
// via `buildMatchQuestionPlan` (het publieke pad) voor een representatieve
// spelvorm per filtercategorie, niet voor alle zes exhaustief.
describe('continents (punt 7, besluit 52) — buildCandidatePool filtert de pool', () => {
  test('geen continents-argument -> geen filter, exact het bestaande gedrag', () => {
    assert.doesNotThrow(() => buildMatchQuestionPlan(baseParams({ continents: undefined })));
  });

  test('alle zes continenten geeft hetzelfde resultaat als geen filter', () => {
    const alle = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];
    const zonderFilter = buildMatchQuestionPlan(baseParams({ random: counterRandom(0) }));
    const metAlleZes = buildMatchQuestionPlan(baseParams({ random: counterRandom(0), continents: alle }));
    assert.deepEqual(zonderFilter, metAlleZes);
  });

  test('continents is geen array -> TypeError', () => {
    assert.throws(() => buildMatchQuestionPlan(baseParams({ continents: 'Europe' })), TypeError);
  });

  test('flags_mc: continents:["Europe"] kiest nooit een niet-Europees land', () => {
    const plan = buildMatchQuestionPlan(baseParams({ continents: ['Europe'], totalRounds: 3, random: counterRandom(0) }));
    const gezien = new Set(plan.flatMap((q) => q.publicQuestionPayload.optionIso2s));
    assert.ok([...gezien].every((iso2) => ['fr', 'de', 'es', 'nl'].includes(iso2)));
  });

  test('flags_mc: continents:["Asia"] laat te weinig landen over voor vier opties -> RangeError', () => {
    // easy/Asia is maar jp+cn: te weinig voor target + 3 afleiders, en de
    // vroegere "rest" (andere continenten) is nu ook wegfilterd.
    assert.throws(() => buildMatchQuestionPlan(baseParams({ gameType: 'flags_mc', continents: ['Asia'] })), RangeError);
  });

  test('capitals_mc: continents:["Europe"] blijft binnen Europa', () => {
    const plan = buildMatchQuestionPlan(baseParams({ gameType: 'capitals_mc', continents: ['Europe'], random: counterRandom(0) }));
    assert.ok(plan[0].publicQuestionPayload.optionIso2s.every((iso2) => ['fr', 'de', 'es', 'nl'].includes(iso2)));
  });

  test('capitals_mc: continents:["Asia"] heeft te weinig landen met hoofdstad -> RangeError', () => {
    assert.throws(
      () => buildMatchQuestionPlan(baseParams({ gameType: 'capitals_mc', continents: ['Asia'] })),
      RangeError,
    );
  });

  test('higher_lower: continents:["Asia"] vergelijkt alleen Aziatische landen', () => {
    const [q] = buildMatchQuestionPlan(baseParams({ gameType: 'higher_lower', metricMode: 'population', continents: ['Asia'], random: counterRandom(0) }));
    assert.ok(q.publicQuestionPayload.sides.every((side) => ['jp', 'cn'].includes(side.iso2)));
  });

  test('higher_lower: continents:["South America"] houdt maar één land over, geen paar mogelijk -> RangeError', () => {
    assert.throws(
      () => buildMatchQuestionPlan(baseParams({ gameType: 'higher_lower', metricMode: 'population', continents: ['South America'] })),
      RangeError,
    );
  });

  test('country_shape_mc: continents:["Europe"] blijft binnen Europa', () => {
    const plan = buildMatchQuestionPlan(baseParams({ gameType: 'country_shape_mc', continents: ['Europe'], random: counterRandom(0) }));
    assert.ok(plan[0].publicQuestionPayload.optionIso2s.every((iso2) => ['fr', 'de', 'es', 'nl'].includes(iso2)));
  });

  test('real_or_fake_flag: continents:["North America"] heeft geen enkele kandidaat in deze pool -> RangeError', () => {
    // Geen enkel POOL-land is North America; forceert de "echt"-tak via een
    // random die bij een lege uitsluiting altijd < 0.5 teruggeeft.
    assert.throws(
      () => buildMatchQuestionPlan(baseParams({ gameType: 'real_or_fake_flag', continents: ['North America'], random: counterRandom(0) })),
      RangeError,
    );
  });

  test('real_or_fake_flag: continents:["South America"] vindt het enige land (br) als echte kandidaat', () => {
    assert.doesNotThrow(
      () => buildMatchQuestionPlan(baseParams({ gameType: 'real_or_fake_flag', continents: ['South America'], random: counterRandom(0) })),
    );
  });
});

describe('continents (punt 7, besluit 52) — odd_one_out valt terug zonder foutmelding', () => {
  test('één continent (geen meerderheid+buitenbeentje mogelijk) -> nooit de continentlogica, geen throw', () => {
    const plan = buildMatchQuestionPlan(
      baseParams({ gameType: 'odd_one_out', continents: ['Europe'], totalRounds: 20, random: counterRandom(0) }),
    );
    assert.equal(plan.length, 20);
    for (const q of plan) {
      assert.notEqual(q.resultDetails.logic, 'continent');
      assert.ok(['fake_among_real', 'real_among_fake'].includes(q.resultDetails.logic));
    }
  });

  test('zonder generateFlagSpec én zonder haalbare continentvariant -> alsnog een zichtbare RangeError (geen stille hang)', () => {
    assert.throws(
      () => buildMatchQuestionPlan(
        baseParams({ gameType: 'odd_one_out', continents: ['Europe'], generateFlagSpec: undefined }),
      ),
      RangeError,
    );
  });

  test('twee continenten met genoeg landen laten de continentlogica gewoon meedoen', () => {
    // Onafhankelijke plannen van één ronde met echte willekeur (zoals
    // `logicasOverRondes` hierboven) i.p.v. één plan van veel rondes: Europe
    // (4)+Asia(2) heeft maar acht unieke continent-combinaties, dus één groot
    // plan zou zelf tegen die uitputting aanlopen — dat is een aparte, bekende
    // eigenschap (zie #19), niet wat deze test bewijst.
    const logics = new Set();
    for (let i = 0; i < 40; i++) {
      const [q] = buildMatchQuestionPlan(
        baseParams({ gameType: 'odd_one_out', continents: ['Europe', 'Asia'], totalRounds: 1, random: Math.random }),
      );
      logics.add(q.resultDetails.logic);
    }
    assert.ok(logics.has('continent'), 'continentlogica moet nog steeds kunnen voorkomen als hij haalbaar is');
  });
});
