'use strict';

// Tabelgedreven testsuite voor de tijdsoffset-module. Spec: docs/multiplayer/
// PROTOCOL.md, sectie `GET /api/v1/time` ("De client meet meerdere samples en
// gebruikt het midpoint van de request round-trip om de offset te schatten") en
// docs/multiplayer/ARCHITECTURE.md, principe 2 "Eén timeline per room" (server
// plant absolute tijden; client rendert lokaal, zonder timer-ticks).
//
// Alleen node:test + node:assert, geen externe dependencies. Elke fixture heeft een
// EXACTE verwachting, en geen enkele test raakt de systeemklok: alle tijdstempels
// zijn vaste literals, net als in state-machine.test.js.

const { test } = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const {
  computeOffsetFromSample, estimateOffset, serverNow, toLocalTime, remainingMs,
  ERROR_CODES, DEFAULT_OPTIONS,
} = require('./server-time');

/** Vaste tijdstempels — nooit Date.now(). T en ENDS_AT komen uit het
 * `round:started`-voorbeeld in PROTOCOL.md (startsAt/endsAt, ronde van 15 s). */
const T = 1_785_623_412_000;
const ENDS_AT = 1_785_623_427_000;
/** Korte lokale tijdstempel; houdt de handmatig uitgerekende fixtures leesbaar. */
const L = 1_000_000;
const THREE_DAYS_MS = 259_200_000;

/** Waarden die nooit als epoch-ms tijdstempel mogen doorkomen (-1 is te klein). */
const ONZIN_TIJD = Object.freeze([NaN, Infinity, -Infinity, -1, '1000', null, undefined, true, {}, []]);
/** Idem voor een offset — die mag wél negatief zijn, maar niet oneindig of niet-numeriek. */
const ONZIN_OFFSET = Object.freeze([NaN, Infinity, -Infinity, '1000', null, undefined, true, {}, []]);

/** Sample uit LITERALE waarden: t0, de round-trip, en de serverTime uit de response. */
function sample(t0, roundTripMs, t1) { return { t0, t1, t2: t0 + roundTripMs }; }

/** Verwachte uitkomst van computeOffsetFromSample, resp. een verwachte afwijzing. */
function okSample(offsetMs, roundTripMs) { return { ok: true, offsetMs, roundTripMs }; }
function err(code) { return { ok: false, code }; }

/**
 * Verwachte uitkomst van estimateOffset. Alle velden worden expliciet meegegeven —
 * niets wordt hier afgeleid, zodat de test geen tweede implementatie wordt.
 * @param {number[]} counts - [sampleCount, usedCount, discardedCount]
 * @param {number[]} rtts - [best, worst, spread, uncertainty]
 */
function okEstimate(offsetMs, [sampleCount, usedCount, discardedCount], [best, worst, spread, uncertainty]) {
  return {
    ok: true, offsetMs, sampleCount, usedCount, discardedCount,
    bestRoundTripMs: best, worstRoundTripMs: worst, roundTripSpreadMs: spread, uncertaintyMs: uncertainty,
  };
}

/** Leesbaar én uniek label voor een onzinwaarde in een fixture-beschrijving. */
function label(value) {
  if (Array.isArray(value)) return 'lege array';
  if (value === null) return 'null';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return `string "${value}"`;
  return String(value);
}

/** Rijbouwers per fixture-tabel. */
function sRow(description, sampleValue, expected) { return { description, sample: sampleValue, expected }; }
function eRow(description, samples, options, expected) { return { description, samples, options, expected }; }
function cRow(description, fn, args, expected) { return { description, fn, args, expected }; }

/** INVALID_TIME-rijen voor één argumentpositie van een conversiefunctie. */
function tijdRows(naam, fn, waarden, bouwArgs) {
  return waarden.map((v) => cRow(`${naam} ${label(v)} → INVALID_TIME`, fn, bouwArgs(v), err('INVALID_TIME')));
}

const SAMPLE_FIXTURES = [
  // [1] Perfect symmetrische round-trip: de offset moet exact kloppen.
  sRow('symmetrisch, klokken gelijk → offset exact 0', sample(L, 100, 1_000_050), okSample(0, 100)),
  sRow('symmetrisch, server 5000 ms vóór → offset exact 5000', sample(L, 100, 1_005_050), okSample(5_000, 100)),
  sRow('symmetrisch, lokale klok 3000 ms vóór → offset exact -3000', sample(L, 100, 997_050), okSample(-3_000, 100)),
  sRow('round-trip 0 (t0 === t2): offset is het pure verschil', sample(L, 0, 1_000_250), okSample(250, 0)),
  sRow('round-trip 0 met identieke tijden → offset 0', sample(L, 0, L), okSample(0, 0)),
  sRow('oneven round-trip geeft een halve-milliseconde midpoint', sample(L, 3, 1_000_500), okSample(498.5, 3)),

  // [2] Asymmetrische vertraging is met één sample niet corrigeerbaar: de module
  // past het midpoint gewoon toe. De fout blijft binnen roundTripMs / 2 = 500 ms,
  // en precies die grens rapporteert estimateOffset later als uncertaintyMs.
  sRow('asymmetrisch, traag terug: schijnbare offset -400 terwijl de klokken gelijk lopen',
    sample(L, 1_000, 1_000_100), okSample(-400, 1_000)),
  sRow('asymmetrisch, traag heen: schijnbare offset +400 terwijl de klokken gelijk lopen',
    sample(L, 1_000, 1_000_900), okSample(400, 1_000)),

  // [3] Zeer grote offset: de lokale klok staat dagen verkeerd.
  sRow('lokale klok drie dagen achter → offset +259_200_000',
    sample(T, 40, 1_785_882_612_020), okSample(THREE_DAYS_MS, 40)),
  sRow('lokale klok drie dagen vóór → offset -259_200_000',
    sample(T, 40, 1_785_364_212_020), okSample(-THREE_DAYS_MS, 40)),

  // [4] t2 < t0: de lokale klok sprong terug tijdens de meting.
  sRow('t2 honderd ms vóór t0 → NEGATIVE_ROUND_TRIP', sample(L, -100, L), err('NEGATIVE_ROUND_TRIP')),
  sRow('t2 exact één ms vóór t0 → NEGATIVE_ROUND_TRIP', sample(L, -1, L), err('NEGATIVE_ROUND_TRIP')),
  sRow('ongeldig veldtype gaat vóór de round-trip-check', { t0: 1_000_100, t1: NaN, t2: L },
    err('INVALID_SAMPLE')),

  // [5] Onzinnige invoer: nooit een throw, altijd INVALID_SAMPLE.
  ...[null, undefined, 42, 'sample', true, []].map((value) =>
    sRow(`sample ${label(value)} → INVALID_SAMPLE`, value, err('INVALID_SAMPLE'))),
  sRow('leeg object → INVALID_SAMPLE', {}, err('INVALID_SAMPLE')),
  sRow('sample zonder t2 → INVALID_SAMPLE', { t0: L, t1: L }, err('INVALID_SAMPLE')),
  ...ONZIN_TIJD.map((v) =>
    sRow(`t0 = ${label(v)} → INVALID_SAMPLE`, { t0: v, t1: L, t2: L }, err('INVALID_SAMPLE'))),
  ...ONZIN_TIJD.map((v) =>
    sRow(`t1 = ${label(v)} → INVALID_SAMPLE`, { t0: L, t1: v, t2: L }, err('INVALID_SAMPLE'))),
  ...ONZIN_TIJD.map((v) =>
    sRow(`t2 = ${label(v)} → INVALID_SAMPLE`, { t0: L, t1: L, t2: v }, err('INVALID_SAMPLE'))),
];

/** Drie schone samples: round-trip 100, offset exact 1000. */
const CLEAN = [sample(L, 100, 1_001_050), sample(1_002_000, 100, 1_003_050), sample(1_004_000, 100, 1_005_050)];
/** Traag én fout: round-trip 4000 ms en een offset van 5000 in plaats van 1000. */
const SLOW_OUTLIER = sample(1_006_000, 4_000, 1_013_000);
/**
 * Vier samples met een plausibele round-trip (100-150 ms), waarvan de laatste er
 * 900 seconden naast zit. Het round-trip-filter ziet deze uitschieter NIET; alleen
 * de mediaan houdt hem tegen. Dit is de belangrijkste fixture van de suite.
 */
const SNEAKY = [
  sample(L, 100, 1_001_050), // offset 1000
  sample(1_002_000, 110, 1_003_065), // offset 1010
  sample(1_004_000, 120, 1_005_080), // offset 1020
  sample(1_006_000, 150, 1_906_075), // offset 900_000 — grove uitschieter
];
/** Uitschieter aan de andere kant: -900 s, round-trip 140 ms. */
const LOW_OUTLIER = sample(1_008_000, 140, 108_070);

const ESTIMATE_FIXTURES = [
  // [1] Lege en niet-bruikbare invoer.
  eRow('lege lijst → NO_SAMPLES', [], undefined, err('NO_SAMPLES')),
  ...[null, undefined, 42, 'samples', {}].map((value) =>
    eRow(`samples ${label(value)} → INVALID_SAMPLE_LIST`, value, undefined, err('INVALID_SAMPLE_LIST'))),
  eRow('alle samples ongeldig → NO_USABLE_SAMPLES', [null, 'x', { t0: 1, t1: NaN, t2: 2 }], undefined,
    err('NO_USABLE_SAMPLES')),
  eRow('maxRoundTripMs verwerpt alles → NO_USABLE_SAMPLES', CLEAN, { maxRoundTripMs: 50 },
    err('NO_USABLE_SAMPLES')),

  // [2] Eén sample: geldig, maar zonder enige kruiscontrole.
  eRow('één sample → ok met usedCount 1 en spreiding 0', [CLEAN[0]], undefined,
    okEstimate(1_000, [1, 1, 0], [100, 100, 0, 50])),
  eRow('één traag sample → uncertaintyMs waarschuwt (1500 ms)', [sample(L, 3_000, 1_003_500)], undefined,
    okEstimate(2_000, [1, 1, 0], [3_000, 3_000, 0, 1_500])),

  // [3] Meerdere schone samples: de schatting moet exact kloppen.
  eRow('twee samples → mediaan is het gemiddelde van de twee middelste', [CLEAN[0], SNEAKY[1]], undefined,
    okEstimate(1_005, [2, 2, 0], [100, 110, 10, 50])),
  eRow('drie perfect symmetrische samples zonder offset → exact 0',
    [sample(L, 100, 1_000_050), sample(1_002_000, 100, 1_002_050), sample(1_004_000, 100, 1_004_050)],
    undefined, okEstimate(0, [3, 3, 0], [100, 100, 0, 50])),
  eRow('drie samples met een negatieve offset → exact -3000',
    [sample(L, 100, 997_050), sample(1_002_000, 100, 999_050), sample(1_004_000, 100, 1_001_050)],
    undefined, okEstimate(-3_000, [3, 3, 0], [100, 100, 0, 50])),
  eRow('drie samples met een offset van drie dagen → exact 259_200_000',
    [sample(T, 40, 1_785_882_612_020), sample(1_785_623_413_000, 40, 1_785_882_613_020),
      sample(1_785_623_414_000, 40, 1_785_882_614_020)],
    undefined, okEstimate(THREE_DAYS_MS, [3, 3, 0], [40, 40, 0, 20])),

  // [4] Uitschieters — de kern van de robuustheidseis.
  eRow('trage grove uitschieter wordt weggefilterd (een gemiddelde zou 2000 zijn)',
    [...CLEAN, SLOW_OUTLIER], undefined, okEstimate(1_000, [4, 3, 1], [100, 100, 0, 50])),
  eRow('snelle grove uitschieter overleeft het filter maar niet de mediaan (gemiddelde: 225_757,5)',
    SNEAKY, undefined, okEstimate(1_015, [4, 4, 0], [100, 150, 50, 50])),
  eRow('oneven aantal: één uitschieter verschuift de mediaan geen millimeter',
    [...SNEAKY, sample(1_008_000, 130, 1_009_095)], undefined,
    okEstimate(1_020, [5, 5, 0], [100, 150, 50, 50])),
  eRow('uitschieter aan de onderkant (-900 s) wordt net zo goed genegeerd',
    [SNEAKY[0], SNEAKY[1], SNEAKY[2], LOW_OUTLIER], undefined,
    okEstimate(1_005, [4, 4, 0], [100, 140, 40, 50])),
  eRow('uitschieters aan beide kanten tussen drie goede samples: mediaan houdt stand',
    [...SNEAKY, LOW_OUTLIER], undefined, okEstimate(1_010, [5, 5, 0], [100, 150, 50, 50])),
  eRow('ongeldige samples tussen geldige tellen mee als discarded',
    [CLEAN[0], null, { t0: 1_002_100, t1: 1_003_050, t2: 1_002_000 }, CLEAN[2]], undefined,
    okEstimate(1_000, [4, 2, 2], [100, 100, 0, 50])),

  // [5] Opties: absolute bovengrens en relatieve factor.
  eRow('maxRoundTripMs is inclusief: precies gelijk blijft staan', CLEAN, { maxRoundTripMs: 100 },
    okEstimate(1_000, [3, 3, 0], [100, 100, 0, 50])),
  eRow('maxRoundTripMs 0 laat alleen een round-trip van 0 door',
    [sample(L, 0, 1_000_250), CLEAN[0]], { maxRoundTripMs: 0 }, okEstimate(250, [2, 1, 1], [0, 0, 0, 0])),
  eRow('maxRoundTripMs verwijdert de trage uitschieter', [...CLEAN, SLOW_OUTLIER], { maxRoundTripMs: 1_000 },
    okEstimate(1_000, [4, 3, 1], [100, 100, 0, 50])),
  eRow('maxRoundTripMs null betekent geen bovengrens', [...CLEAN, SLOW_OUTLIER], { maxRoundTripMs: null },
    okEstimate(1_000, [4, 3, 1], [100, 100, 0, 50])),
  eRow('roundTripFactor 1 houdt alleen de allersnelste sample over', SNEAKY, { roundTripFactor: 1 },
    okEstimate(1_000, [4, 1, 3], [100, 100, 0, 50])),
  eRow('roundTripFactor 1.25 laat 100, 110 en 120 door, 150 niet', SNEAKY, { roundTripFactor: 1.25 },
    okEstimate(1_010, [4, 3, 1], [100, 120, 20, 50])),
  eRow('ruime roundTripFactor laat de trage uitschieter toe; de mediaan vangt hem alsnog',
    [...CLEAN, SLOW_OUTLIER], { roundTripFactor: 50 }, okEstimate(1_000, [4, 4, 0], [100, 4_000, 3_900, 50])),
  eRow('options null → standaardwaarden', CLEAN, null, okEstimate(1_000, [3, 3, 0], [100, 100, 0, 50])),
  eRow('leeg options-object → standaardwaarden', CLEAN, {}, okEstimate(1_000, [3, 3, 0], [100, 100, 0, 50])),
  eRow('DEFAULT_OPTIONS expliciet meegeven → zelfde resultaat als weglaten', CLEAN, DEFAULT_OPTIONS,
    okEstimate(1_000, [3, 3, 0], [100, 100, 0, 50])),

  // [6] Ongeldige opties zijn een programmeerfout en gaan vóór de sample-poorten.
  ...[['options 42', 42], ['options als string', 'snel'], ['options als array', []],
    ['roundTripFactor 0', { roundTripFactor: 0 }], ['roundTripFactor 0.5 (< 1)', { roundTripFactor: 0.5 }],
    ['roundTripFactor NaN', { roundTripFactor: NaN }], ['roundTripFactor Infinity', { roundTripFactor: Infinity }],
    ['roundTripFactor als string', { roundTripFactor: '2' }],
    ['roundTripFactor null is geen default', { roundTripFactor: null }],
    ['maxRoundTripMs -1', { maxRoundTripMs: -1 }], ['maxRoundTripMs NaN', { maxRoundTripMs: NaN }],
    ['maxRoundTripMs Infinity', { maxRoundTripMs: Infinity }],
    ['maxRoundTripMs als string', { maxRoundTripMs: '100' }],
  ].map(([naam, options]) => eRow(`${naam} → INVALID_OPTIONS`, CLEAN, options, err('INVALID_OPTIONS'))),
  eRow('ongeldige options gaan vóór een lege lijst', [], { roundTripFactor: 0 }, err('INVALID_OPTIONS')),
  eRow('ongeldige options gaan vóór een niet-array lijst', null, { roundTripFactor: 0 }, err('INVALID_OPTIONS')),
];

const CONVERSION_FIXTURES = [
  // [1] serverNow: lokale klok → servertijdlijn.
  cRow('serverNow met offset 0 verandert niets', serverNow, [L, 0], { ok: true, serverTime: L }),
  cRow('serverNow telt een positieve offset op', serverNow, [L, 1_000], { ok: true, serverTime: 1_001_000 }),
  cRow('serverNow trekt een negatieve offset af', serverNow, [L, -3_000], { ok: true, serverTime: 997_000 }),
  cRow('serverNow met offset -1 (geldig, want een offset mag negatief zijn)', serverNow, [L, -1],
    { ok: true, serverTime: 999_999 }),
  cRow('serverNow met een halve-milliseconde offset', serverNow, [L, 498.5], { ok: true, serverTime: 1_000_498.5 }),
  cRow('serverNow met localNow 0 (falsy maar geldig)', serverNow, [0, 0], { ok: true, serverTime: 0 }),
  cRow('serverNow met een offset van drie dagen', serverNow, [T, THREE_DAYS_MS],
    { ok: true, serverTime: 1_785_882_612_000 }),

  // [2] toLocalTime: startsAt/endsAt → lokale klok.
  cRow('toLocalTime zet startsAt om naar de lokale klok', toLocalTime, [T, 1_000],
    { ok: true, localTime: 1_785_623_411_000 }),
  cRow('toLocalTime zet endsAt om bij een negatieve offset', toLocalTime, [ENDS_AT, -3_000],
    { ok: true, localTime: 1_785_623_430_000 }),
  cRow('toLocalTime met offset 0 verandert niets', toLocalTime, [L, 0], { ok: true, localTime: L }),
  cRow('toLocalTime bij een lokale klok die drie dagen achterloopt', toLocalTime, [T, THREE_DAYS_MS],
    { ok: true, localTime: 1_785_364_212_000 }),

  // [3] remainingMs: resterende rondetijd volgens de servertijdlijn.
  cRow('remainingMs midden in de ronde', remainingMs, [ENDS_AT, 1_785_623_420_000, -3_000],
    { ok: true, remainingMs: 10_000 }),
  cRow('remainingMs exact op de deadline → 0', remainingMs, [ENDS_AT, 1_785_623_430_000, -3_000],
    { ok: true, remainingMs: 0 }),
  cRow('remainingMs na de deadline → 0 en niet negatief', remainingMs, [ENDS_AT, 1_785_623_440_000, -3_000],
    { ok: true, remainingMs: 0 }),
  cRow('remainingMs ruim na de deadline → nog steeds 0', remainingMs, [ENDS_AT, 1_785_640_000_000, 0],
    { ok: true, remainingMs: 0 }),
  cRow('remainingMs zonder offsetcorrectie', remainingMs, [1_000_500, L, 0], { ok: true, remainingMs: 500 }),
  cRow('remainingMs met een halve-milliseconde offset', remainingMs, [1_000_500, L, 498.5],
    { ok: true, remainingMs: 1.5 }),
  // Zonder offset zou deze client 259_207_000 ms overhouden en de ronde nooit zien
  // aflopen; mét offset staat hij exact op de servertijdlijn.
  cRow('remainingMs corrigeert een lokale klok die drie dagen achterloopt', remainingMs,
    [ENDS_AT, 1_785_364_220_000, THREE_DAYS_MS], { ok: true, remainingMs: 7_000 }),
  // Spiegelbeeld: zonder offset zou de ronde meteen als afgelopen tellen.
  cRow('remainingMs corrigeert een lokale klok die drie dagen vóórloopt', remainingMs,
    [ENDS_AT, 1_785_882_620_000, -THREE_DAYS_MS], { ok: true, remainingMs: 7_000 }),
  cRow('remainingMs met localNow gelijk aan endsAt en offset 0', remainingMs, [ENDS_AT, ENDS_AT, 0],
    { ok: true, remainingMs: 0 }),

  // [4] Onzinnige argumenten: nooit een throw, altijd INVALID_TIME.
  ...tijdRows('serverNow met localNow', serverNow, ONZIN_TIJD, (v) => [v, 1_000]),
  ...tijdRows('serverNow met offsetMs', serverNow, ONZIN_OFFSET, (v) => [L, v]),
  ...tijdRows('toLocalTime met serverTimestamp', toLocalTime, ONZIN_TIJD, (v) => [v, 1_000]),
  ...tijdRows('toLocalTime met offsetMs', toLocalTime, ONZIN_OFFSET, (v) => [L, v]),
  ...tijdRows('remainingMs met endsAtServer', remainingMs, ONZIN_TIJD, (v) => [v, L, 0]),
  ...tijdRows('remainingMs met localNow', remainingMs, ONZIN_TIJD, (v) => [ENDS_AT, v, 0]),
  ...tijdRows('remainingMs met offsetMs', remainingMs, ONZIN_OFFSET, (v) => [ENDS_AT, L, v]),
];

/** Draait één fixture-tabel: elke rij is een eigen subtest met een exacte gelijkheid. */
async function runTable(t, fixtures, roep) {
  for (const fixture of fixtures) {
    await t.test(fixture.description, () => assert.deepStrictEqual(roep(fixture), fixture.expected));
  }
}

test('computeOffsetFromSample (fixture-set)', (t) =>
  runTable(t, SAMPLE_FIXTURES, (f) => computeOffsetFromSample(f.sample)));

test('estimateOffset (fixture-set)', (t) =>
  runTable(t, ESTIMATE_FIXTURES, (f) => estimateOffset(f.samples, f.options)));

test('serverNow, toLocalTime en remainingMs (fixture-set)', (t) =>
  runTable(t, CONVERSION_FIXTURES, (f) => f.fn(...f.args)));

test('estimateOffset laat de aangeleverde samples volledig ongemoeid', () => {
  const samples = [...CLEAN, SLOW_OUTLIER];
  const snapshot = structuredClone(samples);

  const result = estimateOffset(samples);

  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(samples, snapshot, 'estimateOffset mag de invoer niet muteren of hersorteren');
});

test('toLocalTime is de exacte inverse van serverNow', () => {
  const paren = [[L, 0], [L, 1_000], [L, -3_000], [L, 498.5], [T, THREE_DAYS_MS], [T, -THREE_DAYS_MS]];
  for (const [localNow, offsetMs] of paren) {
    const heen = serverNow(localNow, offsetMs);
    assert.strictEqual(heen.ok, true);
    assert.deepStrictEqual(toLocalTime(heen.serverTime, offsetMs), { ok: true, localTime: localNow });
  }
});

test('remainingMs blijft op +0 staan en wordt nooit negatief of -0', () => {
  for (const localNow of [1_785_623_430_000, 1_785_623_440_000, 1_800_000_000_000]) {
    const result = remainingMs(ENDS_AT, localNow, -3_000);
    assert.deepStrictEqual(result, { ok: true, remainingMs: 0 });
    assert.strictEqual(Object.is(result.remainingMs, 0), true, 'exact +0, nooit -0');
  }
});

test('end-to-end: vier samples → offset → lokale tijden en resterende rondetijd', () => {
  // Eén van de vier metingen is traag én fout; de schatter houdt 1000 ms over.
  const estimate = estimateOffset([...CLEAN, SLOW_OUTLIER]);
  assert.deepStrictEqual(estimate, okEstimate(1_000, [4, 3, 1], [100, 100, 0, 50]));

  // startsAt/endsAt uit het `round:started`-voorbeeld, vertaald naar de lokale klok
  // van deze client (die 1000 ms achterloopt) — ARCHITECTURE.md principe 2.
  const off = estimate.offsetMs;
  assert.deepStrictEqual(toLocalTime(T, off), { ok: true, localTime: 1_785_623_411_000 });
  assert.deepStrictEqual(toLocalTime(ENDS_AT, off), { ok: true, localTime: 1_785_623_426_000 });
  assert.deepStrictEqual(serverNow(1_785_623_418_500, off), { ok: true, serverTime: 1_785_623_419_500 });
  assert.deepStrictEqual(remainingMs(ENDS_AT, 1_785_623_418_500, off), { ok: true, remainingMs: 7_500 });
});

// Meta-tests: bewaken de eisen aan de module en aan de fixture-set zelf.
test('meta: de module leest nergens een klok en heeft geen dependencies', () => {
  const source = readFileSync(join(__dirname, 'server-time.js'), 'utf8');
  // Alleen de CODE-regels tellen; de modulekop noemt Date.now() en performance.now()
  // juist om vast te leggen dat ze er niet in staan.
  const code = source.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
  for (const patroon of [/Date\.now/, /performance\.now/, /new Date/, /setTimeout/, /setInterval/,
    /require\(/, /process\./, /Math\.random/]) {
    assert.strictEqual(patroon.test(code), false, `verboden in server-time.js: ${patroon}`);
  }
});

test('meta: ERROR_CODES en DEFAULT_OPTIONS liggen vast', () => {
  assert.deepStrictEqual(DEFAULT_OPTIONS, { roundTripFactor: 2, maxRoundTripMs: null });
  assert.strictEqual(Object.isFrozen(DEFAULT_OPTIONS), true);
  assert.strictEqual(Object.isFrozen(ERROR_CODES), true);
});

test('meta: elke fixture heeft een unieke beschrijving en een exacte verwachting', () => {
  const alle = [...SAMPLE_FIXTURES, ...ESTIMATE_FIXTURES, ...CONVERSION_FIXTURES];
  assert.ok(alle.length > 0);
  const gezien = new Set();

  for (const fixture of alle) {
    assert.strictEqual(gezien.has(fixture.description), false, `dubbele description: ${fixture.description}`);
    gezien.add(fixture.description);
    if (fixture.expected.ok) {
      // Een geslaagde verwachting bestaat uitsluitend uit exacte, eindige getallen —
      // geen "ongeveer", geen NaN die per ongeluk gelijk lijkt.
      for (const [sleutel, waarde] of Object.entries(fixture.expected)) {
        if (sleutel === 'ok') continue;
        assert.strictEqual(Number.isFinite(waarde), true, `${fixture.description}: ${sleutel} niet exact`);
      }
    } else {
      assert.ok(Object.values(ERROR_CODES).includes(fixture.expected.code),
        `onbekende foutcode in ${fixture.description}`);
    }
  }
});
