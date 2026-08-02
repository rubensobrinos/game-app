'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { assertAnswerShape, MAX_POINTS_PER_ROUND } = require('./answer');

const VALID_ANSWER = Object.freeze({
  roundId: 'round_07',
  playerId: 'p_8f42d1',
  actionId: 'act_01J...',
  answer: { choice: 'fake' },
  receivedAt: 1785623418451,
  responseTimeMs: 6451,
  correct: true,
  points: 158,
});

describe('assertAnswerShape — letterlijk spec-voorbeeld #1', () => {
  test('#1 het DATA-MODEL.md-voorbeeld slaagt', () => {
    assert.doesNotThrow(() => assertAnswerShape(VALID_ANSWER));
  });
});

describe('assertAnswerShape — ontbrekend verplicht veld #2-9', () => {
  const fields = Object.keys(VALID_ANSWER);
  let n = 2;
  for (const field of fields) {
    const caseNum = n++;
    test(`#${caseNum} ontbrekend veld '${field}' -> throw`, () => {
      const { [field]: _omitted, ...rest } = VALID_ANSWER;
      assert.throws(() => assertAnswerShape(rest));
    });
  }
});

describe('assertAnswerShape — points binnen [0, 200] (GAME-RULES.md §Puntentelling) #10-14', () => {
  test('#10 points = 0 slaagt (grenswaarde)', () => {
    assert.doesNotThrow(() => assertAnswerShape({ ...VALID_ANSWER, points: 0 }));
  });
  test(`#11 points = ${MAX_POINTS_PER_ROUND} slaagt (grenswaarde)`, () => {
    assert.doesNotThrow(() => assertAnswerShape({ ...VALID_ANSWER, points: MAX_POINTS_PER_ROUND }));
  });
  test('#12 points negatief -> RangeError', () => {
    assert.throws(() => assertAnswerShape({ ...VALID_ANSWER, points: -1 }), RangeError);
  });
  test(`#13 points > ${MAX_POINTS_PER_ROUND} -> RangeError`, () => {
    assert.throws(() => assertAnswerShape({ ...VALID_ANSWER, points: MAX_POINTS_PER_ROUND + 1 }), RangeError);
  });
  test('#14 points niet-integer -> RangeError', () => {
    assert.throws(() => assertAnswerShape({ ...VALID_ANSWER, points: 158.5 }), RangeError);
  });
});

describe('assertAnswerShape — answer is opaak maar moet een plain object zijn #15-17', () => {
  test('#15 answer als array -> throw', () => {
    assert.throws(() => assertAnswerShape({ ...VALID_ANSWER, answer: ['fake'] }));
  });
  test('#16 answer als null -> throw', () => {
    assert.throws(() => assertAnswerShape({ ...VALID_ANSWER, answer: null }));
  });
  test('#17 answer met een andere gameType-specifieke vorm slaagt (opaak, geen validatie van de inhoud)', () => {
    assert.doesNotThrow(() => assertAnswerShape({ ...VALID_ANSWER, answer: { cardIndex: 2 } }));
  });
});
