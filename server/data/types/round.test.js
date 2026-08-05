'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { assertRoundShape, assertCorrectAnswerShape, toActiveRoundSnapshot } = require('./round');

const BASE_ROUND = Object.freeze({
  id: 'round_07',
  matchId: 'match_01J...',
  questionKey: 'rof:fx_91b2',
  publicQuestionPayload: {},
  startsAt: 1785623412000,
  endsAt: 1785623427000,
  status: 'ACTIVE',
});

const ROUND_REAL_OR_FAKE_FLAG = Object.freeze({
  ...BASE_ROUND,
  gameType: 'real_or_fake_flag',
  correctAnswer: { choice: 'fake' },
});

const ROUND_FLAGS_MC = Object.freeze({
  ...BASE_ROUND,
  gameType: 'flags_mc',
  correctAnswer: { optionId: 'nl' },
  validOptionIds: ['nl', 'de', 'fr', 'be'],
});

const ROUND_CAPITALS_MC = Object.freeze({
  ...BASE_ROUND,
  gameType: 'capitals_mc',
  correctAnswer: { optionId: 'paris' },
  validOptionIds: ['paris', 'berlin', 'rome', 'madrid'],
});

const ROUND_HIGHER_LOWER = Object.freeze({
  ...BASE_ROUND,
  gameType: 'higher_lower',
  correctAnswer: { side: 0 },
  resultDetails: { values: [{ side: 0, value: 100 }, { side: 1, value: 50 }] },
});

const ROUND_ODD_ONE_OUT = Object.freeze({
  ...BASE_ROUND,
  gameType: 'odd_one_out',
  correctAnswer: { cardIndex: 2 },
  resultDetails: { majorityContinent: 'Europe', minorityContinent: 'Asia' },
});

describe('assertRoundShape — letterlijk spec-voorbeeld (real_or_fake_flag) #1', () => {
  test('#1 het DATA-MODEL.md-voorbeeld slaagt', () => {
    assert.doesNotThrow(() => assertRoundShape(ROUND_REAL_OR_FAKE_FLAG));
  });
});

describe('assertRoundShape — alle vijf Golf-1-gameTypes slagen met hun eigen vorm #2-6', () => {
  test('#2 flags_mc', () => {
    assert.doesNotThrow(() => assertRoundShape(ROUND_FLAGS_MC));
  });
  test('#3 capitals_mc', () => {
    assert.doesNotThrow(() => assertRoundShape(ROUND_CAPITALS_MC));
  });
  test('#4 real_or_fake_flag', () => {
    assert.doesNotThrow(() => assertRoundShape(ROUND_REAL_OR_FAKE_FLAG));
  });
  test('#5 higher_lower', () => {
    assert.doesNotThrow(() => assertRoundShape(ROUND_HIGHER_LOWER));
  });
  test('#6 odd_one_out', () => {
    assert.doesNotThrow(() => assertRoundShape(ROUND_ODD_ONE_OUT));
  });
});

describe('assertCorrectAnswerShape — juiste vorm per gameType, faalt op andermans vorm #7-16', () => {
  test('#7 flags_mc met optionId slaagt', () => {
    assert.doesNotThrow(() => assertCorrectAnswerShape('flags_mc', { optionId: 'nl' }));
  });
  test('#8 flags_mc met choice (verkeerde vorm) -> throw', () => {
    assert.throws(() => assertCorrectAnswerShape('flags_mc', { choice: 'real' }));
  });
  test('#9 real_or_fake_flag met choice slaagt', () => {
    assert.doesNotThrow(() => assertCorrectAnswerShape('real_or_fake_flag', { choice: 'fake' }));
  });
  test('#10 real_or_fake_flag met side (verkeerde vorm) -> throw', () => {
    assert.throws(() => assertCorrectAnswerShape('real_or_fake_flag', { side: 0 }));
  });
  test('#11 real_or_fake_flag met ongeldige choice -> RangeError', () => {
    assert.throws(() => assertCorrectAnswerShape('real_or_fake_flag', { choice: 'maybe' }), RangeError);
  });
  test('#12 higher_lower met side slaagt', () => {
    assert.doesNotThrow(() => assertCorrectAnswerShape('higher_lower', { side: 1 }));
  });
  test('#13 higher_lower met cardIndex (verkeerde vorm) -> throw', () => {
    assert.throws(() => assertCorrectAnswerShape('higher_lower', { cardIndex: 0 }));
  });
  test('#14 odd_one_out met cardIndex slaagt', () => {
    assert.doesNotThrow(() => assertCorrectAnswerShape('odd_one_out', { cardIndex: 3 }));
  });
  test('#15 odd_one_out met optionId (verkeerde vorm) -> throw', () => {
    assert.throws(() => assertCorrectAnswerShape('odd_one_out', { optionId: 'x' }));
  });
  test('#16 onbekende gameType -> RangeError', () => {
    assert.throws(() => assertCorrectAnswerShape('logo_quiz', { optionId: 'x' }), RangeError);
  });
});

describe('assertRoundShape — validOptionIds verplicht/verboden per gameType, beide richtingen #17-22', () => {
  test('#17 flags_mc zonder validOptionIds -> RangeError', () => {
    const { validOptionIds: _omitted, ...withoutIt } = ROUND_FLAGS_MC;
    assert.throws(() => assertRoundShape(withoutIt), RangeError);
  });
  test('#18 capitals_mc zonder validOptionIds -> RangeError', () => {
    const { validOptionIds: _omitted, ...withoutIt } = ROUND_CAPITALS_MC;
    assert.throws(() => assertRoundShape(withoutIt), RangeError);
  });
  test('#19 real_or_fake_flag MET validOptionIds -> RangeError (moet afwezig zijn)', () => {
    assert.throws(() => assertRoundShape({ ...ROUND_REAL_OR_FAKE_FLAG, validOptionIds: ['a', 'b', 'c', 'd'] }), RangeError);
  });
  test('#20 higher_lower MET validOptionIds -> RangeError (moet afwezig zijn)', () => {
    assert.throws(() => assertRoundShape({ ...ROUND_HIGHER_LOWER, validOptionIds: ['a', 'b', 'c', 'd'] }), RangeError);
  });
  test('#21 odd_one_out MET validOptionIds -> RangeError (moet afwezig zijn)', () => {
    assert.throws(() => assertRoundShape({ ...ROUND_ODD_ONE_OUT, validOptionIds: ['a', 'b', 'c', 'd'] }), RangeError);
  });
  test('#22 flags_mc met validOptionIds zonder 4 unieke elementen -> RangeError', () => {
    assert.throws(() => assertRoundShape({ ...ROUND_FLAGS_MC, validOptionIds: ['nl', 'nl', 'fr', 'be'] }), RangeError);
  });
});

describe('assertRoundShape — resultDetails verplicht/verboden per gameType, beide richtingen #23-26', () => {
  test('#23 higher_lower zonder resultDetails -> RangeError', () => {
    const { resultDetails: _omitted, ...withoutIt } = ROUND_HIGHER_LOWER;
    assert.throws(() => assertRoundShape(withoutIt), RangeError);
  });
  test('#24 odd_one_out zonder resultDetails -> RangeError', () => {
    const { resultDetails: _omitted, ...withoutIt } = ROUND_ODD_ONE_OUT;
    assert.throws(() => assertRoundShape(withoutIt), RangeError);
  });
  test('#25 flags_mc MET resultDetails -> RangeError (moet afwezig zijn)', () => {
    assert.throws(() => assertRoundShape({ ...ROUND_FLAGS_MC, resultDetails: {} }), RangeError);
  });
  test('#26 real_or_fake_flag MET resultDetails -> RangeError (moet afwezig zijn)', () => {
    assert.throws(() => assertRoundShape({ ...ROUND_REAL_OR_FAKE_FLAG, resultDetails: {} }), RangeError);
  });
});

describe('assertRoundShape — startsAt/endsAt en status #27-29', () => {
  test('#27 endsAt <= startsAt -> RangeError', () => {
    assert.throws(
      () => assertRoundShape({ ...ROUND_REAL_OR_FAKE_FLAG, startsAt: 100, endsAt: 100 }),
      RangeError
    );
  });
  test('#28 status "ACTIVE" slaagt', () => {
    assert.doesNotThrow(() => assertRoundShape({ ...ROUND_REAL_OR_FAKE_FLAG, status: 'ACTIVE' }));
  });
  test('#29 status met een andere waarde dan "ACTIVE" slaagt ook (bewust open enum)', () => {
    assert.doesNotThrow(() => assertRoundShape({ ...ROUND_REAL_OR_FAKE_FLAG, status: 'ENDED' }));
  });
});

// contentVersion/rendererVersion komen van Match, niet Round (DECISIONS.md
// #21) — toActiveRoundSnapshot() vraagt daarom sinds die beslissing ook een
// Match-object aan.
const MATCHING_MATCH = Object.freeze({
  id: 'match_01J...',
  contentVersion: '2026.08.1',
  rendererVersion: 'flag-renderer-1',
});

describe('toActiveRoundSnapshot — statuscontrole (regressietest bevinding 15) #30-31', () => {
  test('#30 werpt op elke status behalve ACTIVE', () => {
    assert.throws(() => toActiveRoundSnapshot({ ...ROUND_REAL_OR_FAKE_FLAG, status: 'ENDED' }, MATCHING_MATCH), RangeError);
  });
  test('#31 status ACTIVE slaagt', () => {
    assert.doesNotThrow(() => toActiveRoundSnapshot(ROUND_REAL_OR_FAKE_FLAG, MATCHING_MATCH));
  });
});

describe('toActiveRoundSnapshot — match moet bij de ronde horen (DECISIONS.md #21) #32', () => {
  test('#32 match.id !== round.matchId -> RangeError', () => {
    assert.throws(
      () => toActiveRoundSnapshot(ROUND_REAL_OR_FAKE_FLAG, { ...MATCHING_MATCH, id: 'match_other' }),
      RangeError
    );
  });
});

describe('toActiveRoundSnapshot — allowlist, geen lekkage van geheime/interne velden #33-36', () => {
  test('#33 bevat nooit correctAnswer', () => {
    const snapshot = toActiveRoundSnapshot(ROUND_REAL_OR_FAKE_FLAG, MATCHING_MATCH);
    assert.strictEqual('correctAnswer' in snapshot, false);
  });
  test('#34 bevat nooit resultDetails/validOptionIds/questionKey', () => {
    const snapshot = toActiveRoundSnapshot(ROUND_HIGHER_LOWER, MATCHING_MATCH);
    assert.strictEqual('resultDetails' in snapshot, false);
    assert.strictEqual('validOptionIds' in snapshot, false);
    assert.strictEqual('questionKey' in snapshot, false);
  });
  test('#35 een willekeurig extra veld op de input lekt niet naar de output (allowlist, geen spread)', () => {
    const snapshot = toActiveRoundSnapshot({ ...ROUND_REAL_OR_FAKE_FLAG, somethingUnexpected: 'leak-me-not' }, MATCHING_MATCH);
    assert.strictEqual('somethingUnexpected' in snapshot, false);
  });
  test('#36 bevat exact de negen toegestane velden, incl. contentVersion/rendererVersion van Match', () => {
    const snapshot = toActiveRoundSnapshot(ROUND_REAL_OR_FAKE_FLAG, MATCHING_MATCH);
    assert.deepStrictEqual(
      Object.keys(snapshot).sort(),
      ['contentVersion', 'endsAt', 'gameType', 'id', 'matchId', 'publicQuestionPayload', 'rendererVersion', 'startsAt', 'status'].sort()
    );
    assert.strictEqual(snapshot.contentVersion, MATCHING_MATCH.contentVersion);
    assert.strictEqual(snapshot.rendererVersion, MATCHING_MATCH.rendererVersion);
  });
});

// docs/openstaand/raad-het-land.md, stap 2/3: `country_shape_mc` erbij — zelfde
// vorm als flags_mc/capitals_mc (optionId + verplichte validOptionIds). Los
// blok, niet in de bestaande #1-36-nummering geplakt: dat zou elders in dit
// bestand werkende agents onnodig in de weg zitten.
const ROUND_COUNTRY_SHAPE_MC = Object.freeze({
  ...BASE_ROUND,
  gameType: 'country_shape_mc',
  correctAnswer: { optionId: 'fr' },
  validOptionIds: ['fr', 'de', 'es', 'it'],
});

describe('country_shape_mc — zelfde vorm als flags_mc/capitals_mc', () => {
  test('assertRoundShape slaagt met optionId + validOptionIds', () => {
    assert.doesNotThrow(() => assertRoundShape(ROUND_COUNTRY_SHAPE_MC));
  });
  test('assertCorrectAnswerShape: optionId slaagt, choice/cardIndex/side falen', () => {
    assert.doesNotThrow(() => assertCorrectAnswerShape('country_shape_mc', { optionId: 'fr' }));
    assert.throws(() => assertCorrectAnswerShape('country_shape_mc', { choice: 'real' }));
    assert.throws(() => assertCorrectAnswerShape('country_shape_mc', { cardIndex: 0 }));
  });
  test('zonder validOptionIds -> RangeError (verplicht, net als flags_mc/capitals_mc)', () => {
    const { validOptionIds: _omitted, ...withoutIt } = ROUND_COUNTRY_SHAPE_MC;
    assert.throws(() => assertRoundShape(withoutIt), RangeError);
  });
  test('validOptionIds zonder 4 unieke elementen -> RangeError', () => {
    assert.throws(
      () => assertRoundShape({ ...ROUND_COUNTRY_SHAPE_MC, validOptionIds: ['fr', 'fr', 'de', 'it'] }),
      RangeError,
    );
  });
  test('MET resultDetails -> RangeError (moet afwezig zijn, net als flags_mc)', () => {
    assert.throws(() => assertRoundShape({ ...ROUND_COUNTRY_SHAPE_MC, resultDetails: {} }), RangeError);
  });
  test('toActiveRoundSnapshot: geen validOptionIds/correctAnswer/questionKey in de actieve-rondesnapshot', () => {
    const snapshot = toActiveRoundSnapshot(ROUND_COUNTRY_SHAPE_MC, MATCHING_MATCH);
    assert.strictEqual('validOptionIds' in snapshot, false);
    assert.strictEqual('correctAnswer' in snapshot, false);
    assert.strictEqual('questionKey' in snapshot, false);
    assert.strictEqual(snapshot.gameType, 'country_shape_mc');
  });
});
