'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { validateAnswer } = require('./validators');

// Zie docs/game-rules-plan/prompts/GR3-validators.md, sectie "Verplichte
// testgevallen", voor de volledige, genummerde tabel die deze tests dekken.
// Elke rij verwacht het volledige object { valid, correct } (reviewbevinding
// 11) — nooit een losse assertie op maar één van de twee velden.

describe('malformed client-answer is altijd graceful, nooit een throw #1-5', () => {
  // Toont het "nooit throwen op malformed answer"-gedrag minstens één keer
  // per mechanisme (4x: validateOptionChoice, validateBinaryChoice,
  // validateHigherLowerChoice, validateOddOneOutChoice), met alle vijf
  // varianten uit de spec-tabel (null, array, primitive, extra property,
  // ontbrekende property) verspreid over die mechanismen. validateOptionChoice
  // komt twee keer voor (#1 via flags_mc, #5 via capitals_mc) omdat het één
  // gedeeld mechanisme is voor twee gameTypes.
  const cases = [
    {
      n: 1,
      label: 'answer = null (flags_mc)',
      gameType: 'flags_mc',
      answer: null,
      correctAnswer: { optionId: 'opt_1' },
      roundContext: { validOptionIds: ['opt_1', 'opt_2', 'opt_3', 'opt_4'] },
    },
    {
      n: 2,
      label: 'answer is een array (real_or_fake_flag)',
      gameType: 'real_or_fake_flag',
      answer: ['fake'],
      correctAnswer: { choice: 'fake' },
      roundContext: undefined,
    },
    {
      n: 3,
      label: 'answer is een primitive (higher_lower)',
      gameType: 'higher_lower',
      answer: true,
      correctAnswer: { side: 0 },
      roundContext: undefined,
    },
    {
      n: 4,
      label: 'answer heeft een extra property naast de verwachte (odd_one_out)',
      gameType: 'odd_one_out',
      answer: { cardIndex: 1, role: 'host' },
      correctAnswer: { cardIndex: 1 },
      roundContext: { optionCount: 4 },
    },
    {
      n: 5,
      label: 'answer mist de verwachte property (capitals_mc)',
      gameType: 'capitals_mc',
      answer: {},
      correctAnswer: { optionId: 'cap_1' },
      roundContext: { validOptionIds: ['cap_1', 'cap_2', 'cap_3', 'cap_4'] },
    },
  ];

  for (const c of cases) {
    test(`#${c.n} ${c.label}`, () => {
      const result = validateAnswer(c.gameType, c.answer, c.correctAnswer, c.roundContext);
      assert.deepStrictEqual(result, { valid: false, correct: false });
    });
  }
});

describe('validateOptionChoice (flags_mc + capitals_mc, via validateAnswer) #6-10', () => {
  const validOptionIds = ['opt_1', 'opt_2', 'opt_3', 'opt_4'];
  const correctAnswer = { optionId: 'opt_1' };

  test('#6 optionId gelijk aan correctAnswer.optionId -> { valid: true, correct: true }', () => {
    const result = validateAnswer('flags_mc', { optionId: 'opt_1' }, correctAnswer, { validOptionIds });
    assert.deepStrictEqual(result, { valid: true, correct: true });
  });

  test('#7 optionId is een andere geldige optie -> { valid: true, correct: false }', () => {
    const result = validateAnswer('flags_mc', { optionId: 'opt_2' }, correctAnswer, { validOptionIds });
    assert.deepStrictEqual(result, { valid: true, correct: false });
  });

  test('#8 optionId staat niet in validOptionIds -> { valid: false, correct: false } (client)', () => {
    const result = validateAnswer('flags_mc', { optionId: 'opt_9' }, correctAnswer, { validOptionIds });
    assert.deepStrictEqual(result, { valid: false, correct: false });
  });

  test('#9 validOptionIds heeft geen 4 unieke niet-lege strings -> throw (servercontext)', () => {
    // Lengte 4, maar slechts 3 unieke waarden: bewijst dat uniciteit expliciet
    // gecontroleerd wordt, niet alleen de lengte.
    const brokenIds = ['opt_1', 'opt_1', 'opt_2', 'opt_3'];
    assert.throws(
      () => validateAnswer('flags_mc', { optionId: 'opt_1' }, correctAnswer, { validOptionIds: brokenIds }),
      RangeError
    );
  });

  test('#10 correctAnswer.optionId staat niet in validOptionIds -> throw (servercontext, kapotte ronde)', () => {
    const brokenCorrectAnswer = { optionId: 'opt_9' };
    assert.throws(
      () => validateAnswer('flags_mc', { optionId: 'opt_1' }, brokenCorrectAnswer, { validOptionIds }),
      RangeError
    );
  });
});

describe('validateBinaryChoice (real_or_fake_flag, via validateAnswer) #11-14', () => {
  const correctAnswer = { choice: 'fake' };

  test('#11 choice gelijk aan correctAnswer.choice -> { valid: true, correct: true }', () => {
    const result = validateAnswer('real_or_fake_flag', { choice: 'fake' }, correctAnswer);
    assert.deepStrictEqual(result, { valid: true, correct: true });
  });

  test('#12 choice is de andere geldige waarde -> { valid: true, correct: false }', () => {
    const result = validateAnswer('real_or_fake_flag', { choice: 'real' }, correctAnswer);
    assert.deepStrictEqual(result, { valid: true, correct: false });
  });

  test('#13 choice buiten {"real","fake"} -> { valid: false, correct: false } (client)', () => {
    const result = validateAnswer('real_or_fake_flag', { choice: 'maybe' }, correctAnswer);
    assert.deepStrictEqual(result, { valid: false, correct: false });
  });

  test('#14 correctAnswer.choice buiten {"real","fake"} -> throw (servercontext)', () => {
    const brokenCorrectAnswer = { choice: 'maybe' };
    assert.throws(() => validateAnswer('real_or_fake_flag', { choice: 'fake' }, brokenCorrectAnswer), RangeError);
  });
});

describe('validateHigherLowerChoice (higher_lower, via validateAnswer) #15-18', () => {
  const correctAnswer = { side: 0 };

  test('#15 side gelijk aan correctAnswer.side -> { valid: true, correct: true }', () => {
    const result = validateAnswer('higher_lower', { side: 0 }, correctAnswer);
    assert.deepStrictEqual(result, { valid: true, correct: true });
  });

  test('#16 side is de andere waarde uit {0,1} -> { valid: true, correct: false }', () => {
    const result = validateAnswer('higher_lower', { side: 1 }, correctAnswer);
    assert.deepStrictEqual(result, { valid: true, correct: false });
  });

  test('#17 side buiten {0,1} of niet-integer -> { valid: false, correct: false } (client)', () => {
    // 1.5 is zowel niet-integer als buiten {0,1} — dekt de samengestelde
    // voorwaarde in één representatieve waarde.
    const result = validateAnswer('higher_lower', { side: 1.5 }, correctAnswer);
    assert.deepStrictEqual(result, { valid: false, correct: false });
  });

  test('#18 correctAnswer.side buiten {0,1} -> throw (servercontext)', () => {
    const brokenCorrectAnswer = { side: 2 };
    assert.throws(() => validateAnswer('higher_lower', { side: 0 }, brokenCorrectAnswer), RangeError);
  });
});

describe('validateOddOneOutChoice (odd_one_out, via validateAnswer) #19-23', () => {
  const correctAnswer = { cardIndex: 2 };
  const optionCount = 4;

  test('#19 cardIndex gelijk aan correctAnswer.cardIndex -> { valid: true, correct: true }', () => {
    const result = validateAnswer('odd_one_out', { cardIndex: 2 }, correctAnswer, { optionCount });
    assert.deepStrictEqual(result, { valid: true, correct: true });
  });

  test('#20 cardIndex geldig maar niet juist -> { valid: true, correct: false }', () => {
    const result = validateAnswer('odd_one_out', { cardIndex: 0 }, correctAnswer, { optionCount });
    assert.deepStrictEqual(result, { valid: true, correct: false });
  });

  test('#21 cardIndex buiten bereik of niet-integer -> { valid: false, correct: false } (client)', () => {
    // 1.5 ligt binnen [0,4) qua grootte maar is geen integer — bewijst dat de
    // integer-check zelf afdwingt, niet alleen de bereikscheck.
    const result = validateAnswer('odd_one_out', { cardIndex: 1.5 }, correctAnswer, { optionCount });
    assert.deepStrictEqual(result, { valid: false, correct: false });
  });

  test('#22 optionCount !== 4 -> throw (servercontext)', () => {
    assert.throws(() => validateAnswer('odd_one_out', { cardIndex: 2 }, correctAnswer, { optionCount: 3 }), RangeError);
  });

  test('#23 correctAnswer.cardIndex buiten [0, optionCount) -> throw (servercontext)', () => {
    const brokenCorrectAnswer = { cardIndex: 5 };
    assert.throws(
      () => validateAnswer('odd_one_out', { cardIndex: 2 }, brokenCorrectAnswer, { optionCount }),
      RangeError
    );
  });
});

describe('validateAnswer dispatcher — routering per gameType (tabelgedreven, 15 combinaties) #24', () => {
  // Voor elk van de 5 Golf-1-gameTypes: één correct, één incorrect-maar-geldig
  // en één malformed antwoord. Elke combinatie is een eigen test() (geen
  // aggregaatassertie in een enkele loop-test), zodat routeringsfouten per
  // gameType/variant afzonderlijk zichtbaar worden. De malformed-varianten
  // hergebruiken bewust de vijf archetypes uit #1-5, nu verdeeld over andere
  // gameTypes dan daar, voor extra dekkingsbreedte.
  const cases = [
    // flags_mc
    {
      gameType: 'flags_mc',
      variant: 'correct',
      answer: { optionId: 'opt_1' },
      correctAnswer: { optionId: 'opt_1' },
      roundContext: { validOptionIds: ['opt_1', 'opt_2', 'opt_3', 'opt_4'] },
      expected: { valid: true, correct: true },
    },
    {
      gameType: 'flags_mc',
      variant: 'incorrect-maar-geldig',
      answer: { optionId: 'opt_2' },
      correctAnswer: { optionId: 'opt_1' },
      roundContext: { validOptionIds: ['opt_1', 'opt_2', 'opt_3', 'opt_4'] },
      expected: { valid: true, correct: false },
    },
    {
      gameType: 'flags_mc',
      variant: 'malformed (extra property)',
      answer: { optionId: 'opt_1', role: 'host' },
      correctAnswer: { optionId: 'opt_1' },
      roundContext: { validOptionIds: ['opt_1', 'opt_2', 'opt_3', 'opt_4'] },
      expected: { valid: false, correct: false },
    },
    // capitals_mc
    {
      gameType: 'capitals_mc',
      variant: 'correct',
      answer: { optionId: 'cap_1' },
      correctAnswer: { optionId: 'cap_1' },
      roundContext: { validOptionIds: ['cap_1', 'cap_2', 'cap_3', 'cap_4'] },
      expected: { valid: true, correct: true },
    },
    {
      gameType: 'capitals_mc',
      variant: 'incorrect-maar-geldig',
      answer: { optionId: 'cap_3' },
      correctAnswer: { optionId: 'cap_1' },
      roundContext: { validOptionIds: ['cap_1', 'cap_2', 'cap_3', 'cap_4'] },
      expected: { valid: true, correct: false },
    },
    {
      gameType: 'capitals_mc',
      variant: 'malformed (array)',
      answer: ['cap_1'],
      correctAnswer: { optionId: 'cap_1' },
      roundContext: { validOptionIds: ['cap_1', 'cap_2', 'cap_3', 'cap_4'] },
      expected: { valid: false, correct: false },
    },
    // real_or_fake_flag
    {
      gameType: 'real_or_fake_flag',
      variant: 'correct',
      answer: { choice: 'fake' },
      correctAnswer: { choice: 'fake' },
      roundContext: undefined,
      expected: { valid: true, correct: true },
    },
    {
      gameType: 'real_or_fake_flag',
      variant: 'incorrect-maar-geldig',
      answer: { choice: 'real' },
      correctAnswer: { choice: 'fake' },
      roundContext: undefined,
      expected: { valid: true, correct: false },
    },
    {
      gameType: 'real_or_fake_flag',
      variant: 'malformed (ontbrekende property)',
      answer: {},
      correctAnswer: { choice: 'fake' },
      roundContext: undefined,
      expected: { valid: false, correct: false },
    },
    // higher_lower
    {
      gameType: 'higher_lower',
      variant: 'correct',
      answer: { side: 1 },
      correctAnswer: { side: 1 },
      roundContext: undefined,
      expected: { valid: true, correct: true },
    },
    {
      gameType: 'higher_lower',
      variant: 'incorrect-maar-geldig',
      answer: { side: 0 },
      correctAnswer: { side: 1 },
      roundContext: undefined,
      expected: { valid: true, correct: false },
    },
    {
      gameType: 'higher_lower',
      variant: 'malformed (null)',
      answer: null,
      correctAnswer: { side: 1 },
      roundContext: undefined,
      expected: { valid: false, correct: false },
    },
    // odd_one_out
    {
      gameType: 'odd_one_out',
      variant: 'correct',
      answer: { cardIndex: 3 },
      correctAnswer: { cardIndex: 3 },
      roundContext: { optionCount: 4 },
      expected: { valid: true, correct: true },
    },
    {
      gameType: 'odd_one_out',
      variant: 'incorrect-maar-geldig',
      answer: { cardIndex: 0 },
      correctAnswer: { cardIndex: 3 },
      roundContext: { optionCount: 4 },
      expected: { valid: true, correct: false },
    },
    {
      gameType: 'odd_one_out',
      variant: 'malformed (primitive)',
      answer: '3',
      correctAnswer: { cardIndex: 3 },
      roundContext: { optionCount: 4 },
      expected: { valid: false, correct: false },
    },
  ];

  for (const c of cases) {
    test(`#24 ${c.gameType} — ${c.variant}`, () => {
      const result = validateAnswer(c.gameType, c.answer, c.correctAnswer, c.roundContext);
      assert.deepStrictEqual(result, c.expected);
    });
  }
});

describe('validateAnswer dispatcher — onbekende/Golf-2 gameType #25', () => {
  test('#25 onbekende of Golf 2-gameType ("typed_capitals") -> RangeError', () => {
    assert.throws(
      () => validateAnswer('typed_capitals', { text: 'Argentinie' }, { text: 'Argentinie' }),
      RangeError
    );
  });
});
