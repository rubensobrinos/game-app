// Tests voor de TIJDELIJKE contentstub. Toetsen de VORM van het contract uit
// docs/integration-plan/content-interface-request.md, niet de inhoud van de
// pool — die verdwijnt met CT1.

import test from 'node:test';
import assert from 'node:assert/strict';

import { assertRoundShape } from '../data/types/round.js';
import { createContentSource, normalizeDifficulty, STUB_COUNTRY_POOL } from './content-source.mjs';

/** Deterministische PRNG (mulberry32) — geen Math.random in de tests. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSource(overrides = {}) {
  return createContentSource({
    contentVersion: 'stub-content-1',
    language: 'nl',
    difficulty: 'normal',
    random: seededRandom(42),
    ...overrides,
  });
}

test('createContentSource levert exact het contract uit content-interface-request.md', () => {
  const source = makeSource();
  assert.equal(source.contentVersion, 'stub-content-1');
  assert.equal(typeof source.rendererVersion, 'string');
  assert.equal(typeof source.poolSize, 'function');
  assert.equal(typeof source.buildQuestion, 'function');
});

test('contentVersion en rendererVersion zijn onveranderlijk op de bron (besluit 21)', () => {
  const source = makeSource({ rendererVersion: 'r-9' });
  assert.throws(() => {
    source.contentVersion = 'iets-anders';
  }, TypeError);
  assert.equal(source.rendererVersion, 'r-9');
});

test('normalizeDifficulty vertaalt de configuratieschaal naar de poolschaal', () => {
  assert.equal(normalizeDifficulty('normal'), 'medium');
  assert.equal(normalizeDifficulty('normaal'), 'medium');
  assert.equal(normalizeDifficulty('medium'), 'medium');
  assert.equal(normalizeDifficulty('easy'), 'easy');
});

test('alleen flags_mc is gevuld; de andere Golf 1-vormen geven poolSize 0', () => {
  const source = makeSource();
  assert.ok(source.poolSize('flags_mc') >= 16);
  for (const gameType of ['capitals_mc', 'real_or_fake_flag', 'higher_lower', 'odd_one_out']) {
    assert.equal(source.poolSize(gameType), 0);
    assert.throws(() => source.buildQuestion({ gameType }), /alleen \["flags_mc"\]/);
  }
  assert.throws(() => source.poolSize('typing_flags'), /onbekende gameType/);
});

test('buildQuestion levert questionKey, publicQuestionPayload en een GESCHEIDEN correctAnswer', () => {
  const source = makeSource();
  const question = source.buildQuestion({ gameType: 'flags_mc' });

  assert.match(question.questionKey, /^flags:[a-z]{2}$/);
  assert.equal(typeof question.publicQuestionPayload, 'object');
  assert.equal(typeof question.correctAnswer, 'object');
  assert.equal(typeof question.correctAnswer.optionId, 'string');

  // Besluit 20: correctAnswer komt gescheiden terug en is nooit onderdeel van
  // de publieke payload — geen `correctAnswer`-sleutel op welk niveau dan ook.
  assert.ok(!Object.prototype.hasOwnProperty.call(question.publicQuestionPayload, 'correctAnswer'));
  assert.ok(!JSON.stringify(question.publicQuestionPayload).includes('correctAnswer'));
});

test('buildQuestion respecteert exclude: 10 opeenvolgende vragen zijn allemaal uniek', () => {
  const source = makeSource();
  const exclude = new Set();
  for (let round = 0; round < 10; round += 1) {
    const question = source.buildQuestion({ gameType: 'flags_mc', exclude });
    assert.equal(exclude.has(question.questionKey), false, `ronde ${round + 1} herhaalt een vraag`);
    exclude.add(question.questionKey);
  }
  assert.equal(exclude.size, 10);
});

test('een gebouwde vraag past in het Round-document van server/data/types/round.js', () => {
  const source = makeSource();
  const question = source.buildQuestion({ gameType: 'flags_mc' });

  const round = {
    id: 'round_1',
    matchId: 'match_1',
    gameType: 'flags_mc',
    questionKey: question.questionKey,
    publicQuestionPayload: question.publicQuestionPayload,
    correctAnswer: question.correctAnswer,
    validOptionIds: question.validOptionIds,
    startsAt: 1_754_136_000_000,
    endsAt: 1_754_136_015_000,
    status: 'ACTIVE',
  };
  // Het vangnet: geen eigen validatie, maar de shape-assertion van de eigenaar.
  assertRoundShape(round);
  assert.ok(round.validOptionIds.includes(question.correctAnswer.optionId));
});

test('een andere seed levert een andere vraag op; dezelfde seed dezelfde', () => {
  const a = makeSource({ random: seededRandom(1) }).buildQuestion({ gameType: 'flags_mc' });
  const b = makeSource({ random: seededRandom(1) }).buildQuestion({ gameType: 'flags_mc' });
  const c = makeSource({ random: seededRandom(999) }).buildQuestion({ gameType: 'flags_mc' });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('de pool volgt de ContentEntry-vorm uit CONTENT-POOL-INTERFACE.md', () => {
  const codes = new Set(STUB_COUNTRY_POOL.map((entry) => entry.iso2));
  assert.equal(codes.size, STUB_COUNTRY_POOL.length, 'iso2 moet uniek zijn over de hele pool');
  for (const entry of STUB_COUNTRY_POOL) {
    assert.match(entry.iso2, /^[a-z]{2}$/);
    assert.ok(['easy', 'medium', 'hard', 'extreme'].includes(entry.difficulty));
    assert.equal(typeof entry.continent, 'string');
    for (const language of ['nl', 'en', 'es']) {
      assert.equal(typeof entry.name[language], 'string');
    }
    // Nullable velden staan er expliciet op (gotcha 1: nooit een ontbrekende key).
    for (const field of ['capital', 'population', 'area', 'gdp']) {
      assert.ok(Object.prototype.hasOwnProperty.call(entry, field), `${entry.iso2} mist ${field}`);
    }
  }
});

test('createContentSource weigert een ontbrekende contentVersion of language', () => {
  assert.throws(() => createContentSource({ language: 'nl', difficulty: 'normal' }), /contentVersion/);
  assert.throws(() => createContentSource({ contentVersion: 'v1', difficulty: 'normal' }), /language/);
});
