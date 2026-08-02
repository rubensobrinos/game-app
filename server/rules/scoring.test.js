'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  isAnswerAcceptable,
  computeScore,
  scoreAnswer,
  accumulateCorrectResponseTime,
} = require('./scoring');

// Vast tijdvenster voor scenario's die zelf geen rand van startsAt/endsAt
// testen. Bewust niet op 0 gebaseerd, zodat off-by-"startsAt"-bugs niet
// toevallig gemaskeerd worden door 0 + x === x.
const STARTS_AT = 5000;
const ENDS_AT = 6000; // questionDuration = 1000ms
const DURATION = ENDS_AT - STARTS_AT;

describe('grace-validatie (assertValidGrace, via isAnswerAcceptable) #1-5', () => {
  const cases = [
    { n: 1, label: 'deadlineGraceMs = 0 -> geldig, geen throw', deadlineGraceMs: 0, throws: false },
    { n: 2, label: 'deadlineGraceMs = 250 -> geldig, geen throw (bovengrens)', deadlineGraceMs: 250, throws: false },
    { n: 3, label: 'deadlineGraceMs = 251 -> RangeError', deadlineGraceMs: 251, throws: true },
    { n: 4, label: 'deadlineGraceMs = -1 -> RangeError', deadlineGraceMs: -1, throws: true },
    { n: 5, label: 'deadlineGraceMs = NaN -> RangeError', deadlineGraceMs: NaN, throws: true },
  ];

  for (const c of cases) {
    test(`#${c.n} ${c.label}`, () => {
      // receivedAt === endsAt is altijd binnen elke geldige grace, dus dit
      // isoleert het gedrag van assertValidGrace zelf.
      const call = () =>
        isAnswerAcceptable({ receivedAt: ENDS_AT, endsAt: ENDS_AT, deadlineGraceMs: c.deadlineGraceMs });
      if (c.throws) {
        assert.throws(call, RangeError);
      } else {
        assert.strictEqual(call(), true);
      }
    });
  }
});

describe('acceptatie (isAnswerAcceptable) #6-10', () => {
  const cases = [
    { n: 6, label: 'receivedAt = endsAt, grace = 0', offset: 0, deadlineGraceMs: 0, expected: true },
    { n: 7, label: 'receivedAt = endsAt + 100, grace = 250', offset: 100, deadlineGraceMs: 250, expected: true },
    { n: 8, label: 'receivedAt = endsAt + 250, grace = 250 (exact op grens)', offset: 250, deadlineGraceMs: 250, expected: true },
    { n: 9, label: 'receivedAt = endsAt + 251, grace = 250', offset: 251, deadlineGraceMs: 250, expected: false },
    { n: 10, label: 'receivedAt = endsAt + 300, grace = 250', offset: 300, deadlineGraceMs: 250, expected: false },
  ];

  for (const c of cases) {
    test(`#${c.n} ${c.label}`, () => {
      const receivedAt = ENDS_AT + c.offset;
      const result = isAnswerAcceptable({ receivedAt, endsAt: ENDS_AT, deadlineGraceMs: c.deadlineGraceMs });
      assert.strictEqual(result, c.expected);
    });
  }
});

describe('tijdvalidatie en kortsluiting (computeScore) #11-17', () => {
  const cases = [
    {
      n: 11,
      label: 'endsAt = startsAt -> RangeError',
      // correct: true hier, correct: false in #12: samen bewijzen ze dat
      // deze structurele configuratiefout altijd breekt, ongeacht `correct`
      // (zelfde "niet stil negeren"-principe als assertValidGrace).
      params: { correct: true, receivedAt: 6000, startsAt: 6000, endsAt: 6000, speedBonusEnabled: true },
      throws: true,
    },
    {
      n: 12,
      label: 'endsAt < startsAt -> RangeError',
      params: { correct: false, receivedAt: undefined, startsAt: 6000, endsAt: 5000, speedBonusEnabled: true },
      throws: true,
    },
    {
      n: 13,
      label: 'correct = false, receivedAt ontbreekt (niet beantwoord) -> geen throw',
      params: { correct: false, receivedAt: undefined, startsAt: STARTS_AT, endsAt: ENDS_AT, speedBonusEnabled: true },
      throws: false,
      expected: { bonus: 0, points: 0 },
    },
    {
      n: 14,
      label: 'correct = false, geldige receivedAt (fout antwoord)',
      params: { correct: false, receivedAt: STARTS_AT + 500, startsAt: STARTS_AT, endsAt: ENDS_AT, speedBonusEnabled: true },
      throws: false,
      expected: { bonus: 0, points: 0 },
    },
    {
      n: 15,
      label: 'correct = true, receivedAt ontbreekt -> RangeError (aanroepersfout)',
      params: { correct: true, receivedAt: undefined, startsAt: STARTS_AT, endsAt: ENDS_AT, speedBonusEnabled: true },
      throws: true,
    },
    {
      n: 16,
      label: 'correct = true, speedBonusEnabled = false -> exact { bonus: 0, points: 100 }',
      params: { correct: true, receivedAt: STARTS_AT + 200, startsAt: STARTS_AT, endsAt: ENDS_AT, speedBonusEnabled: false },
      throws: false,
      expected: { bonus: 0, points: 100 },
    },
    {
      n: 17,
      label: 'correct = false, speedBonusEnabled = false',
      params: { correct: false, receivedAt: STARTS_AT + 500, startsAt: STARTS_AT, endsAt: ENDS_AT, speedBonusEnabled: false },
      throws: false,
      expected: { bonus: 0, points: 0 },
    },
  ];

  for (const c of cases) {
    test(`#${c.n} ${c.label}`, () => {
      if (c.throws) {
        assert.throws(() => computeScore(c.params), RangeError);
      } else {
        assert.deepStrictEqual(computeScore(c.params), c.expected);
      }
    });
  }
});

describe('bonusformule - vaste tabel (computeScore, correct = true) #18-23', () => {
  const cases = [
    { n: 18, label: 'op startsAt (100% resterend)', receivedAt: STARTS_AT, bonus: 100, points: 200 },
    { n: 19, label: '25% van de duur verstreken', receivedAt: STARTS_AT + 0.25 * DURATION, bonus: 75, points: 175 },
    { n: 20, label: '50% van de duur verstreken', receivedAt: STARTS_AT + 0.5 * DURATION, bonus: 50, points: 150 },
    { n: 21, label: '75% van de duur verstreken', receivedAt: STARTS_AT + 0.75 * DURATION, bonus: 25, points: 125 },
    { n: 22, label: 'op endsAt (0% resterend)', receivedAt: ENDS_AT, bonus: 0, points: 100 },
    { n: 23, label: '50 ms voor startsAt (klokdrift) -> clamp naar boven', receivedAt: STARTS_AT - 50, bonus: 100, points: 200 },
  ];

  for (const c of cases) {
    test(`#${c.n} ${c.label}`, () => {
      const result = computeScore({
        correct: true,
        receivedAt: c.receivedAt,
        startsAt: STARTS_AT,
        endsAt: ENDS_AT,
        speedBonusEnabled: true,
      });
      assert.deepStrictEqual(result, { bonus: c.bonus, points: c.points });
      // Cap-bewijs: geen enkele rij mag buiten [0, 200] punten opleveren.
      assert.ok(result.points >= 0 && result.points <= 200);
    });
  }
});

describe('integratie (scoreAnswer) #24-26', () => {
  const cases = [
    {
      n: 24,
      label: 'te laat (receivedAt = endsAt + 300, grace = 250) en correct = true -> geweigerd ondanks correct: true',
      params: { correct: true, receivedAt: ENDS_AT + 300, startsAt: STARTS_AT, endsAt: ENDS_AT, deadlineGraceMs: 250, speedBonusEnabled: true },
      expected: { accepted: false, bonus: 0, points: 0 },
    },
    {
      n: 25,
      label: 'binnen grace (receivedAt = endsAt + 100, grace = 250), correct = true -> basispunten, geen bonus',
      params: { correct: true, receivedAt: ENDS_AT + 100, startsAt: STARTS_AT, endsAt: ENDS_AT, deadlineGraceMs: 250, speedBonusEnabled: true },
      expected: { accepted: true, bonus: 0, points: 100 },
    },
    {
      n: 26,
      label: 'op tijd (receivedAt = startsAt), correct = true -> volledige bonus',
      params: { correct: true, receivedAt: STARTS_AT, startsAt: STARTS_AT, endsAt: ENDS_AT, deadlineGraceMs: 250, speedBonusEnabled: true },
      expected: { accepted: true, bonus: 100, points: 200 },
    },
  ];

  for (const c of cases) {
    test(`#${c.n} ${c.label}`, () => {
      assert.deepStrictEqual(scoreAnswer(c.params), c.expected);
    });
  }
});

describe('accumulatie (accumulateCorrectResponseTime) #27', () => {
  test('#27 totaal stijgt alleen bij correct: true, blijft gelijk bij correct: false', () => {
    const answers = [
      { correct: true, responseTimeMs: 1000 },
      { correct: false, responseTimeMs: 5000 },
      { correct: true, responseTimeMs: 2000 },
      { correct: false, responseTimeMs: 9999 },
      { correct: true, responseTimeMs: 500 },
    ];
    const expectedTotals = [1000, 1000, 3000, 3000, 3500];

    let total = 0;
    answers.forEach((answer, i) => {
      total = accumulateCorrectResponseTime(total, answer);
      assert.strictEqual(total, expectedTotals[i]);
    });
    assert.strictEqual(total, 3500);
  });
});

// Toegevoegd na REVIEW-GR2-GR3.md, bevinding 5: GR1 accepteerde eerder een
// niet-eindig/negatief currentTotalMs of responseTimeMs stilzwijgend, wat een
// corrupte correctResponseTimeMsTotal in de tiebreak (GR2) had kunnen opleveren.
describe('accumulatie-validatie (accumulateCorrectResponseTime) #28-32', () => {
  const cases = [
    {
      n: 28,
      label: 'currentTotalMs = -1 -> RangeError',
      currentTotalMs: -1,
      answer: { correct: true, responseTimeMs: 500 },
      throws: true,
    },
    {
      n: 29,
      label: 'currentTotalMs = NaN -> RangeError',
      currentTotalMs: NaN,
      answer: { correct: true, responseTimeMs: 500 },
      throws: true,
    },
    {
      n: 30,
      label: 'correct = true, responseTimeMs = -1 -> RangeError',
      currentTotalMs: 1000,
      answer: { correct: true, responseTimeMs: -1 },
      throws: true,
    },
    {
      n: 31,
      label: 'correct = true, responseTimeMs = NaN -> RangeError',
      currentTotalMs: 1000,
      answer: { correct: true, responseTimeMs: NaN },
      throws: true,
    },
    {
      n: 32,
      label: 'correct = false, responseTimeMs = NaN -> geen throw, ongewijzigd totaal (kortsluit vóór responseTimeMs-check)',
      currentTotalMs: 1000,
      answer: { correct: false, responseTimeMs: NaN },
      throws: false,
      expected: 1000,
    },
  ];

  for (const c of cases) {
    test(`#${c.n} ${c.label}`, () => {
      const call = () => accumulateCorrectResponseTime(c.currentTotalMs, c.answer);
      if (c.throws) {
        assert.throws(call, RangeError);
      } else {
        assert.strictEqual(call(), c.expected);
      }
    });
  }
});
