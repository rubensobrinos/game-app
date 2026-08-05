// Tests voor de contentbron van de compositielaag. Toetsen de VORM van het
// contract uit docs/integration-plan/content-interface-request.md en de
// bedrading naar de ECHTE pool uit `shared/content/` (CT1) — geen stub meer.
// Over de INHOUD van de pool doet dit bestand geen uitspraken die verder gaan
// dan het ContentEntry-contract; die inhoud is eigendom van CT.

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONTENT_VERSION, getCountryPool, mapRoomDifficulty } from '../../shared/content/index.mjs';
import { assertRoundShape } from '../data/types/round.js';
import * as contentSourceModule from './content-source.mjs';
import { createContentSource } from './content-source.mjs';

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

test('de moeilijkheidsvertaling komt uit mapRoomDifficulty, niet uit een eigen mapping', () => {
  // Er is geen tweede mapping meer in deze module; `normalizeDifficulty` is met
  // CT1 verdwenen (CONTENT-POOL-INTERFACE.md §Gotcha 2).
  assert.equal(contentSourceModule.normalizeDifficulty, undefined);
  assert.equal(contentSourceModule.mapRoomDifficulty, mapRoomDifficulty);

  // De room-difficulty "normal" landt aantoonbaar op de content-tier "medium":
  // dezelfde poolgrootte als een expliciete "medium", en dat is exact het
  // aantal medium-entries in de echte pool.
  const mediumEntries = getCountryPool().filter((entry) => entry.difficulty === 'medium').length;
  assert.equal(makeSource({ difficulty: 'normal' }).poolSize('flags_mc'), mediumEntries);
  assert.equal(makeSource({ difficulty: 'medium' }).poolSize('flags_mc'), mediumEntries);
  assert.equal(
    makeSource({ difficulty: 'easy' }).poolSize('flags_mc'),
    getCountryPool().filter((entry) => entry.difficulty === 'easy').length,
  );
  // Onbekende waarden worden niet stil doorgemapt maar geworpen — door
  // shared/content, niet door een eigen controle hier.
  assert.throws(() => makeSource({ difficulty: 'normaal' }), RangeError);
});

test('CONTENT_VERSION komt ongewijzigd uit shared/content door', () => {
  assert.equal(contentSourceModule.CONTENT_VERSION, CONTENT_VERSION);
  // Geen stille default: besluit 21 wil dat de samenstelwortel de versie pint.
  assert.equal(makeSource().contentVersion, 'stub-content-1');
});

test('de drie doelbeeld-games zijn gevuld; de rest geeft poolSize 0 en werpt zichtbaar', () => {
  const source = makeSource();
  assert.ok(source.poolSize('flags_mc') >= 16);
  // Stap 6 (5 aug 2026): `real_or_fake_flag` erbij — de CT-3-blokkade was
  // verlopen. Besluit C-2: `odd_one_out` erbij als derde doelbeeld-game.
  assert.ok(source.poolSize('real_or_fake_flag') >= 16);
  assert.ok(source.poolSize('odd_one_out') >= 16);
  // `capitals_mc` en `higher_lower` staan niet in doelbeeld v2 (besluit C-2)
  // en blijven daarom leeg: een spelscherm ervoor zou dood hout zijn.
  for (const gameType of ['capitals_mc', 'higher_lower']) {
    assert.equal(source.poolSize(gameType), 0);
    assert.throws(() => source.buildQuestion({ gameType }), /deze contentbron vult alleen/);
  }
  assert.throws(() => source.poolSize('typing_flags'), /onbekende gameType/);
});

test('real_or_fake_flag levert beide vraagsoorten: een echte vlag en een gegenereerde', () => {
  const source = makeSource();
  const gezien = new Set();
  const sleutels = new Set();

  // Ruim genoeg trekkingen om beide takken te raken; de verdeling zelf is
  // eigendom van question-selection.js (ongeveer half om half per match).
  for (let poging = 0; poging < 40; poging += 1) {
    const vraag = source.buildQuestion({ gameType: 'real_or_fake_flag', exclude: sleutels });
    sleutels.add(vraag.questionKey);
    gezien.add(vraag.publicQuestionPayload.kind);

    assert.ok(vraag.questionKey.startsWith('rof:'));
    if (vraag.publicQuestionPayload.kind === 'real') {
      assert.equal(typeof vraag.publicQuestionPayload.iso2, 'string');
      assert.deepEqual(vraag.correctAnswer, { choice: 'real' });
    } else {
      assert.equal(vraag.publicQuestionPayload.kind, 'generated');
      assert.equal(typeof vraag.publicQuestionPayload.seed, 'string');
      assert.equal(typeof vraag.publicQuestionPayload.rendererVersion, 'string');
      assert.ok(vraag.publicQuestionPayload.spec !== null && typeof vraag.publicQuestionPayload.spec === 'object');
      assert.deepEqual(vraag.correctAnswer, { choice: 'fake' });
    }
    // Besluit 20: het antwoord zit nooit in de publieke payload.
    assert.equal('choice' in vraag.publicQuestionPayload, false);
  }

  assert.deepEqual([...gezien].sort(), ['generated', 'real'], 'beide vraagsoorten moeten voorkomen');
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

test('de echte pool volgt de ContentEntry-vorm uit CONTENT-POOL-INTERFACE.md', () => {
  const pool = getCountryPool();
  // Eigenschappen van de ECHTE pool, geen stubinhoud: diep bevroren (muteren
  // kan een lopende match nooit stil beïnvloeden) en unieke iso2-sleutels.
  assert.ok(Object.isFrozen(pool));
  assert.ok(Object.isFrozen(pool[0]));
  assert.ok(pool.length > 200, 'de volledige landenpool, niet een handvol stubentries');
  const codes = new Set(pool.map((entry) => entry.iso2));
  assert.equal(codes.size, pool.length, 'iso2 moet uniek zijn over de hele pool');
  for (const entry of pool) {
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
