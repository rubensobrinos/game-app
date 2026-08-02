'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  computeEligibleFromRound,
  isEligibleForRound,
  describeLateJoin,
  countsTowardAnswerDenominator,
} = require('./eligibility');

describe('computeEligibleFromRound #1-9', () => {
  const cases = [
    {
      n: 1,
      label: 'ROUND_ACTIVE, remainingFraction >= nearEndThreshold -> currentRoundNumber',
      params: { currentRoundNumber: 5, phase: 'ROUND_ACTIVE', remainingFraction: 0.8, nearEndThreshold: 0.5 },
      expected: 5,
    },
    {
      n: 2,
      label: 'ROUND_ACTIVE, remainingFraction < nearEndThreshold -> currentRoundNumber + 1',
      params: { currentRoundNumber: 5, phase: 'ROUND_ACTIVE', remainingFraction: 0.2, nearEndThreshold: 0.5 },
      expected: 6,
    },
    {
      n: 3,
      label: 'ROUND_ACTIVE, remainingFraction = null -> currentRoundNumber + 1 (conservatief)',
      params: { currentRoundNumber: 5, phase: 'ROUND_ACTIVE', remainingFraction: null, nearEndThreshold: 0.5 },
      expected: 6,
    },
    {
      n: 4,
      label: 'ROUND_RESULT -> currentRoundNumber + 1',
      params: { currentRoundNumber: 5, phase: 'ROUND_RESULT', remainingFraction: null, nearEndThreshold: 0.5 },
      expected: 6,
    },
    {
      n: 5,
      label: 'SCOREBOARD -> currentRoundNumber + 1',
      params: { currentRoundNumber: 5, phase: 'SCOREBOARD', remainingFraction: 0.9, nearEndThreshold: 0.5 },
      expected: 6,
    },
    {
      n: 6,
      label: 'PAUSED -> currentRoundNumber + 1',
      params: { currentRoundNumber: 5, phase: 'PAUSED', remainingFraction: 0.9, nearEndThreshold: 0.5 },
      expected: 6,
    },
  ];

  for (const c of cases) {
    test(`#${c.n} ${c.label}`, () => {
      assert.strictEqual(computeEligibleFromRound(c.params), c.expected);
    });
  }

  test('#7 onbekende phase -> RangeError', () => {
    assert.throws(
      () =>
        computeEligibleFromRound({ currentRoundNumber: 1, phase: 'BOGUS', remainingFraction: null, nearEndThreshold: 0.5 }),
      RangeError
    );
  });

  test('#8 remainingFraction buiten bereik (niet null) -> RangeError', () => {
    for (const bad of [1.5, -0.1]) {
      assert.throws(
        () =>
          computeEligibleFromRound({
            currentRoundNumber: 1,
            phase: 'ROUND_ACTIVE',
            remainingFraction: bad,
            nearEndThreshold: 0.5,
          }),
        RangeError
      );
    }
  });

  test('#9 currentRoundNumber = 0 of niet-integer -> RangeError', () => {
    for (const bad of [0, 2.5, -1]) {
      assert.throws(
        () =>
          computeEligibleFromRound({ currentRoundNumber: bad, phase: 'ROUND_ACTIVE', remainingFraction: null, nearEndThreshold: 0.5 }),
        RangeError
      );
    }
  });
});

describe('isEligibleForRound #10-12', () => {
  test('#10 roundNumber > eligibleFromRound -> true', () => {
    assert.strictEqual(isEligibleForRound(3, 5), true);
  });
  test('#11 roundNumber === eligibleFromRound (grens) -> true', () => {
    assert.strictEqual(isEligibleForRound(5, 5), true);
  });
  test('#12 roundNumber < eligibleFromRound -> false', () => {
    assert.strictEqual(isEligibleForRound(5, 3), false);
  });
});

describe('describeLateJoin #13-15', () => {
  test('#13 eligibleFromRound === 1', () => {
    assert.deepStrictEqual(describeLateJoin(1), { isLateJoin: false, eligibleFromRound: 1 });
  });
  test('#14 eligibleFromRound === 4', () => {
    assert.deepStrictEqual(describeLateJoin(4), { isLateJoin: true, eligibleFromRound: 4 });
  });
  test('#15 eligibleFromRound = 0 of 2.5 -> RangeError', () => {
    assert.throws(() => describeLateJoin(0), RangeError);
    assert.throws(() => describeLateJoin(2.5), RangeError);
  });
});

describe('countsTowardAnswerDenominator #16-25', () => {
  const basePlayer = { left: false, kicked: false, eligibleFromRound: 1, connected: true, disconnectedSinceMs: null };
  const baseContext = { roundNumber: 5, nowMs: 100000, graceMs: 10000 };

  test('#16 left: true -> false', () => {
    assert.strictEqual(countsTowardAnswerDenominator({ ...basePlayer, left: true }, baseContext), false);
  });

  test('#17 kicked: true -> false', () => {
    assert.strictEqual(countsTowardAnswerDenominator({ ...basePlayer, kicked: true }, baseContext), false);
  });

  test('#18 roundNumber < eligibleFromRound -> false', () => {
    assert.strictEqual(
      countsTowardAnswerDenominator({ ...basePlayer, eligibleFromRound: 6 }, baseContext),
      false
    );
  });

  test('#19 connected, niet vertrokken/gekickt, al eligible -> true', () => {
    assert.strictEqual(countsTowardAnswerDenominator(basePlayer, baseContext), true);
  });

  test('#20 disconnected, disconnectedForMs < graceMs -> true', () => {
    const player = { ...basePlayer, connected: false, disconnectedSinceMs: baseContext.nowMs - 5000 };
    assert.strictEqual(countsTowardAnswerDenominator(player, baseContext), true);
  });

  test('#21 disconnected, disconnectedForMs === graceMs (grens) -> false', () => {
    const player = { ...basePlayer, connected: false, disconnectedSinceMs: baseContext.nowMs - baseContext.graceMs };
    assert.strictEqual(countsTowardAnswerDenominator(player, baseContext), false);
  });

  test('#22 disconnected, disconnectedForMs > graceMs -> false', () => {
    const player = { ...basePlayer, connected: false, disconnectedSinceMs: baseContext.nowMs - 20000 };
    assert.strictEqual(countsTowardAnswerDenominator(player, baseContext), false);
  });

  test('#23 disconnected zonder geldige disconnectedSinceMs -> RangeError', () => {
    const player = { ...basePlayer, connected: false, disconnectedSinceMs: null };
    assert.throws(() => countsTowardAnswerDenominator(player, baseContext), RangeError);
  });

  test('#24 graceMs < 0 -> RangeError', () => {
    assert.throws(() => countsTowardAnswerDenominator(basePlayer, { ...baseContext, graceMs: -1 }), RangeError);
  });

  test('#25 left: true én lang disconnected tegelijk -> false', () => {
    const player = { ...basePlayer, left: true, connected: false, disconnectedSinceMs: baseContext.nowMs - 999999 };
    assert.strictEqual(countsTowardAnswerDenominator(player, baseContext), false);
  });
});
