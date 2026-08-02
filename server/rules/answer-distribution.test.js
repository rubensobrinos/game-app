'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { computeAnswerDistribution } = require('./answer-distribution');

describe('computeAnswerDistribution #1-12', () => {
  test('#1 flags_mc, gemengde antwoorden over 3 van de 4 opties', () => {
    const answers = [
      { answer: { optionId: 'fr' } },
      { answer: { optionId: 'fr' } },
      { answer: { optionId: 'de' } },
      { answer: { optionId: 'es' } },
      { answer: { optionId: 'es' } },
      { answer: { optionId: 'es' } },
    ];
    const result = computeAnswerDistribution('flags_mc', answers, { validOptionIds: ['fr', 'de', 'es', 'nl'] });
    assert.deepStrictEqual(result, { fr: 2, de: 1, es: 3, nl: 0 });
  });

  test('#2 capitals_mc routeert correct (zelfde tellogica als flags_mc)', () => {
    const answers = [{ answer: { optionId: 'jp' } }, { answer: { optionId: 'cn' } }];
    const result = computeAnswerDistribution('capitals_mc', answers, { validOptionIds: ['jp', 'cn', 'kr', 'th'] });
    assert.deepStrictEqual(result, { jp: 1, cn: 1, kr: 0, th: 0 });
  });

  test('#3 real_or_fake_flag, mix van real/fake', () => {
    const answers = [
      { answer: { choice: 'real' } },
      { answer: { choice: 'real' } },
      { answer: { choice: 'fake' } },
    ];
    const result = computeAnswerDistribution('real_or_fake_flag', answers, {});
    assert.deepStrictEqual(result, { real: 2, fake: 1 });
  });

  test('#4 higher_lower, mix van side 0/1 -> sleutels zijn strings', () => {
    const answers = [{ answer: { side: 0 } }, { answer: { side: 1 } }, { answer: { side: 1 } }];
    const result = computeAnswerDistribution('higher_lower', answers, {});
    assert.deepStrictEqual(result, { '0': 1, '1': 2 });
    assert.ok(Object.prototype.hasOwnProperty.call(result, '0'));
  });

  test('#5 odd_one_out, antwoorden over alle 4 cardIndex-waarden', () => {
    const answers = [
      { answer: { cardIndex: 0 } },
      { answer: { cardIndex: 1 } },
      { answer: { cardIndex: 1 } },
      { answer: { cardIndex: 2 } },
      { answer: { cardIndex: 3 } },
      { answer: { cardIndex: 3 } },
      { answer: { cardIndex: 3 } },
    ];
    const result = computeAnswerDistribution('odd_one_out', answers, {});
    assert.deepStrictEqual(result, { '0': 1, '1': 2, '2': 1, '3': 3 });
  });

  test('#6 lege answers-array -> alle bekende sleutels op 0, geen leeg object', () => {
    const result = computeAnswerDistribution('real_or_fake_flag', [], {});
    assert.deepStrictEqual(result, { real: 0, fake: 0 });
  });

  test('#7 flags_mc, optionId buiten validOptionIds -> RangeError', () => {
    const answers = [{ answer: { optionId: 'zz' } }];
    assert.throws(
      () => computeAnswerDistribution('flags_mc', answers, { validOptionIds: ['fr', 'de', 'es', 'nl'] }),
      RangeError
    );
  });

  test('#8 higher_lower, side: 2 -> RangeError', () => {
    const answers = [{ answer: { side: 2 } }];
    assert.throws(() => computeAnswerDistribution('higher_lower', answers, {}), RangeError);
  });

  test('#9 odd_one_out, cardIndex: 4 -> RangeError', () => {
    const answers = [{ answer: { cardIndex: 4 } }];
    assert.throws(() => computeAnswerDistribution('odd_one_out', answers, {}), RangeError);
  });

  test('#10 onbekende gameType -> RangeError', () => {
    assert.throws(() => computeAnswerDistribution('typed_capitals', [], {}), RangeError);
  });

  test('#11 answers-array en antwoord-objecten blijven ongewijzigd', () => {
    const answers = [{ answer: { choice: 'real' } }, { answer: { choice: 'fake' } }];
    const before = JSON.parse(JSON.stringify(answers));
    computeAnswerDistribution('real_or_fake_flag', answers, {});
    assert.deepStrictEqual(answers, before);
  });

  test('#12 twee identieke aanroepen geven identiek resultaat', () => {
    const answers = [{ answer: { side: 0 } }, { answer: { side: 1 } }];
    const resultA = computeAnswerDistribution('higher_lower', answers, {});
    const resultB = computeAnswerDistribution('higher_lower', answers, {});
    assert.deepStrictEqual(resultA, resultB);
  });
});
