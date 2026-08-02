// Tests voor shared/content — CT1. Toetst de pool tegen het leidende contract
// (docs/game-rules-plan/CONTENT-POOL-INTERFACE.md), inclusief de twee gotchas
// en de referentiecijfers, en de bruikbaarheid door de echte consument
// (server/rules/question-selection.js).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTENT_VERSION,
  CONTENT_DIFFICULTIES,
  getCountryPool,
  mapRoomDifficulty,
} from './index.mjs';

const pool = getCountryPool();

test('pool heeft exact de referentiecijfers uit het contract', () => {
  assert.equal(pool.length, 230);
  const byDifficulty = {};
  const byContinent = {};
  for (const e of pool) {
    byDifficulty[e.difficulty] = (byDifficulty[e.difficulty] ?? 0) + 1;
    byContinent[e.continent] = (byContinent[e.continent] ?? 0) + 1;
  }
  assert.deepEqual(byDifficulty, { easy: 30, medium: 66, hard: 104, extreme: 30 });
  assert.deepEqual(byContinent, {
    Africa: 58, Europe: 52, Asia: 50, 'North America': 37, Oceania: 19, 'South America': 14,
  });
});

test('iso2 is uniek, lowercase en niet leeg (questionKey- en assetconventie)', () => {
  const seen = new Set();
  for (const e of pool) {
    assert.match(e.iso2, /^[a-z]{2}$/, `iso2 "${e.iso2}" is geen 2 lowercase letters`);
    assert.ok(!seen.has(e.iso2), `dubbele iso2 "${e.iso2}"`);
    seen.add(e.iso2);
  }
});

test('elke entry voldoet veld-voor-veld aan ContentEntry', () => {
  for (const e of pool) {
    assert.ok(CONTENT_DIFFICULTIES.includes(e.difficulty), `${e.iso2}: difficulty`);
    assert.equal(typeof e.continent, 'string');
    assert.ok(e.continent.length > 0, `${e.iso2}: continent leeg`);
    for (const lang of ['nl', 'en', 'es']) {
      assert.equal(typeof e.name[lang], 'string', `${e.iso2}: name.${lang}`);
      assert.ok(e.name[lang].length > 0, `${e.iso2}: name.${lang} leeg`);
    }
    // Gotcha 1: capital is ALTIJD expliciet aanwezig — object of null.
    assert.ok('capital' in e, `${e.iso2}: capital-key ontbreekt`);
    if (e.capital !== null) {
      for (const lang of ['nl', 'en', 'es']) {
        assert.equal(typeof e.capital[lang], 'string', `${e.iso2}: capital.${lang}`);
        assert.ok(e.capital[lang].length > 0, `${e.iso2}: capital.${lang} leeg`);
      }
    }
    for (const metric of ['population', 'area', 'gdp']) {
      const v = e[metric];
      assert.ok(v === null || (typeof v === 'number' && Number.isFinite(v)), `${e.iso2}: ${metric}`);
    }
  }
});

test('elke moeilijkheidslaag heeft minstens één continent met ≥ 3 landen (Buitenbeentje-garantie)', () => {
  for (const difficulty of CONTENT_DIFFICULTIES) {
    const counts = {};
    for (const e of pool) {
      if (e.difficulty === difficulty) counts[e.continent] = (counts[e.continent] ?? 0) + 1;
    }
    assert.ok(
      Object.values(counts).some((n) => n >= 3),
      `laag "${difficulty}" kan geen Buitenbeentje-ronde vormen`,
    );
  }
});

test('de pool is diep bevroren: muteren werpt en verandert niets', () => {
  assert.throws(() => { pool[0].difficulty = 'easy2'; }, TypeError);
  assert.throws(() => { pool.push({}); }, TypeError);
  assert.throws(() => { pool[0].name.nl = 'x'; }, TypeError);
});

test('mapRoomDifficulty: normal→medium, content-tiers ongewijzigd, rest werpt (gotcha 2)', () => {
  assert.equal(mapRoomDifficulty('normal'), 'medium');
  for (const d of CONTENT_DIFFICULTIES) assert.equal(mapRoomDifficulty(d), d);
  for (const bad of ['NORMAL', 'Normaal', '', null, undefined, 3]) {
    assert.throws(() => mapRoomDifficulty(bad), RangeError, `accepteerde ${String(bad)}`);
  }
});

test('CONTENT_VERSION is een niet-lege string in jaar.maand.n-vorm', () => {
  assert.match(CONTENT_VERSION, /^\d{4}\.\d{2}\.\d+$/);
});

test('steekproef: bekende landen kloppen inhoudelijk', () => {
  const fr = pool.find((e) => e.iso2 === 'fr');
  assert.equal(fr.continent, 'Europe');
  assert.equal(fr.name.nl, 'Frankrijk');
  assert.equal(fr.capital.nl, 'Parijs');
  assert.equal(typeof fr.population, 'number');
  const nl = pool.find((e) => e.iso2 === 'nl');
  assert.equal(nl.name.es, 'Países Bajos');
});

test('integratie: de echte consument accepteert deze pool voor alle Golf 1-vormen', async () => {
  // CJS-module in ESM-test — bewijst meteen de interop die INT-A nodig heeft.
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { buildMatchQuestionPlan } = require('../../server/rules/question-selection.js');

  let seed = 42;
  const random = () => {
    // Deterministische LCG zodat deze test reproduceerbaar is.
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (const gameType of ['flags_mc', 'capitals_mc', 'higher_lower', 'odd_one_out']) {
    const plan = buildMatchQuestionPlan({
      gameType,
      totalRounds: 10,
      difficulty: mapRoomDifficulty('normal'),
      metricMode: 'mixed',
      previousMatchQuestionKeys: [],
      pool,
      random,
    });
    assert.equal(plan.length, 10, `${gameType}: geen 10 rondes`);
    const keys = new Set(plan.map((q) => q.questionKey));
    assert.equal(keys.size, 10, `${gameType}: dubbele vragen binnen de match`);
  }
});
