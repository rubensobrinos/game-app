'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { compareForRanking, rankPlayers } = require('./standings');

// Vaste geldige baseline-spelers voor de validatietests hieronder. Een tweede,
// eveneens geldige speler is nodig omdat compareForRanking() twee argumenten
// valideert (ontwerpbeslissing 4) — het testgeval raakt alleen `player`.
const BASE_PLAYER = { id: 'p1', score: 100, correctCount: 3, correctResponseTimeMsTotal: 1500 };
const OTHER_PLAYER = { id: 'p2', score: 50, correctCount: 1, correctResponseTimeMsTotal: 300 };

describe('validatie van één record (indirect via compareForRanking) #1-9', () => {
  const cases = [
    { n: 1, label: 'score = -1', overrides: { score: -1 }, error: RangeError },
    { n: 2, label: 'score = 10.5 (niet-integer)', overrides: { score: 10.5 }, error: RangeError },
    { n: 3, label: 'correctCount = -1', overrides: { correctCount: -1 }, error: RangeError },
    { n: 4, label: 'correctCount = 2.5', overrides: { correctCount: 2.5 }, error: RangeError },
    {
      n: 5,
      label: 'correctResponseTimeMsTotal = -1',
      overrides: { correctResponseTimeMsTotal: -1 },
      error: RangeError,
    },
    {
      n: 6,
      label: 'correctResponseTimeMsTotal = 10.5',
      overrides: { correctResponseTimeMsTotal: 10.5 },
      error: RangeError,
    },
    { n: 7, label: 'id = "" (leeg)', overrides: { id: '' }, error: RangeError },
    { n: 9, label: 'alle velden geldig -> geen throw', overrides: {}, error: null },
  ];

  for (const c of cases) {
    test(`#${c.n} ${c.label}`, () => {
      const player = { ...BASE_PLAYER, ...c.overrides };
      const call = () => compareForRanking(player, OTHER_PLAYER);
      if (c.error) {
        assert.throws(call, c.error);
      } else {
        assert.strictEqual(typeof call(), 'number');
      }
    });
  }

  test('#8 id ontbreekt of is geen string', () => {
    const missingId = { ...BASE_PLAYER };
    delete missingId.id;
    const nonStringId = { ...BASE_PLAYER, id: 42 };

    assert.throws(() => compareForRanking(missingId, OTHER_PLAYER), TypeError);
    assert.throws(() => compareForRanking(nonStringId, OTHER_PLAYER), TypeError);
  });
});

describe('compareForRanking — volgorde #10-13', () => {
  test('#10 verschillende score -> hogere score wint', () => {
    const high = { id: 'a', score: 200, correctCount: 1, correctResponseTimeMsTotal: 1000 };
    const low = { id: 'b', score: 100, correctCount: 1, correctResponseTimeMsTotal: 1000 };
    assert.ok(compareForRanking(high, low) < 0);
    assert.ok(compareForRanking(low, high) > 0);
  });

  test('#11 gelijke score, verschillende correctCount -> hogere correctCount wint', () => {
    const high = { id: 'a', score: 100, correctCount: 5, correctResponseTimeMsTotal: 1000 };
    const low = { id: 'b', score: 100, correctCount: 2, correctResponseTimeMsTotal: 1000 };
    assert.ok(compareForRanking(high, low) < 0);
    assert.ok(compareForRanking(low, high) > 0);
  });

  test('#12 gelijke score en correctCount, verschillende responstijd -> lagere tijd wint', () => {
    const fast = { id: 'a', score: 100, correctCount: 5, correctResponseTimeMsTotal: 500 };
    const slow = { id: 'b', score: 100, correctCount: 5, correctResponseTimeMsTotal: 1500 };
    assert.ok(compareForRanking(fast, slow) < 0);
    assert.ok(compareForRanking(slow, fast) > 0);
  });

  test('#13 alle drie gelijk -> 0', () => {
    const a = { id: 'a', score: 100, correctCount: 5, correctResponseTimeMsTotal: 1000 };
    const b = { id: 'b', score: 100, correctCount: 5, correctResponseTimeMsTotal: 1000 };
    assert.strictEqual(compareForRanking(a, b), 0);
    assert.strictEqual(compareForRanking(b, a), 0);
  });
});

describe('rankPlayers — validatie van de hele lijst vóór sortering #14-15', () => {
  test('#14 twee spelers met dezelfde id -> throw, vóór enige output', () => {
    const players = [
      { id: 'dup', score: 100, correctCount: 1, correctResponseTimeMsTotal: 100 },
      { id: 'dup', score: 50, correctCount: 1, correctResponseTimeMsTotal: 200 },
    ];
    assert.throws(() => rankPlayers(players), RangeError);
  });

  test('#15 één ongeldig record ergens middenin een lijst van 10 -> throw, ongeacht positie', () => {
    // Bewijst dat rankPlayers() de hele lijst vóór sortering valideert
    // (ontwerpbeslissing 4): het ongeldige record breekt altijd, ongeacht of
    // het aan het begin, midden of eind van de array staat — dus ongeacht
    // welke paren het sorteeralgoritme toevallig zou vergelijken.
    for (const invalidIndex of [0, 4, 9]) {
      const players = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        score: 100 - i,
        correctCount: 1,
        correctResponseTimeMsTotal: 100,
      }));
      players[invalidIndex] = { ...players[invalidIndex], score: -1 };

      assert.throws(() => rankPlayers(players), RangeError);
    }
  });
});

describe('rankPlayers — positienummering (competition ranking, voorgesteld) #16-20', () => {
  test('#16 4 spelers, elk strikt verschillend -> posities 1,2,3,4', () => {
    const players = [
      { id: 'a', score: 400, correctCount: 4, correctResponseTimeMsTotal: 400 },
      { id: 'b', score: 300, correctCount: 3, correctResponseTimeMsTotal: 300 },
      { id: 'c', score: 200, correctCount: 2, correctResponseTimeMsTotal: 200 },
      { id: 'd', score: 100, correctCount: 1, correctResponseTimeMsTotal: 100 },
    ];
    const result = rankPlayers(players);
    assert.deepStrictEqual(result.map((p) => p.id), ['a', 'b', 'c', 'd']);
    assert.deepStrictEqual(result.map((p) => p.position), [1, 2, 3, 4]);
  });

  test('#17 twee gelijk op de kop, twee eronder verschillend -> posities 1,1,3,4 (niet 1,1,2,3)', () => {
    const players = [
      { id: 'a', score: 400, correctCount: 4, correctResponseTimeMsTotal: 400 },
      { id: 'b', score: 400, correctCount: 4, correctResponseTimeMsTotal: 400 },
      { id: 'c', score: 300, correctCount: 3, correctResponseTimeMsTotal: 300 },
      { id: 'd', score: 200, correctCount: 2, correctResponseTimeMsTotal: 200 },
    ];
    const result = rankPlayers(players);
    assert.deepStrictEqual(result.map((p) => p.position), [1, 1, 3, 4]);
  });

  test('#18 drievoudige gelijkstand op de kop, één eronder -> posities 1,1,1,4', () => {
    const players = [
      { id: 'a', score: 400, correctCount: 4, correctResponseTimeMsTotal: 400 },
      { id: 'b', score: 400, correctCount: 4, correctResponseTimeMsTotal: 400 },
      { id: 'c', score: 400, correctCount: 4, correctResponseTimeMsTotal: 400 },
      { id: 'd', score: 100, correctCount: 1, correctResponseTimeMsTotal: 100 },
    ];
    const result = rankPlayers(players);
    assert.deepStrictEqual(result.map((p) => p.position), [1, 1, 1, 4]);
  });

  test('#19 één speler -> position: 1', () => {
    const result = rankPlayers([{ id: 'a', score: 100, correctCount: 1, correctResponseTimeMsTotal: 100 }]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].position, 1);
  });

  test('#20 lege lijst -> [], geen throw', () => {
    assert.deepStrictEqual(rankPlayers([]), []);
  });
});

describe('rankPlayers — deterministische presentatievolgorde bij gedeelde positie #21', () => {
  test('#21 twee volledig gelijke spelers, verschillende id -> zelfde position, id-oplopende volgorde, reproduceerbaar', () => {
    const players = [
      { id: 'z', score: 100, correctCount: 1, correctResponseTimeMsTotal: 100 },
      { id: 'a', score: 100, correctCount: 1, correctResponseTimeMsTotal: 100 },
    ];

    const result1 = rankPlayers(players);
    const result2 = rankPlayers(players);

    assert.deepStrictEqual(result1.map((p) => p.id), ['a', 'z']); // id oplopend, ongeacht invoervolgorde
    assert.strictEqual(result1[0].position, 1);
    assert.strictEqual(result1[1].position, 1); // gedeelde position, ondanks presentatievolgorde
    assert.deepStrictEqual(result1, result2); // twee aanroepen, identiek resultaat
  });
});

describe('rankPlayers — overig #22-23', () => {
  test('#22 input-array en -objects blijven ongewijzigd na aanroep; resultaat is nieuw', () => {
    const players = [
      { id: 'a', score: 300, correctCount: 3, correctResponseTimeMsTotal: 300 },
      { id: 'b', score: 200, correctCount: 2, correctResponseTimeMsTotal: 200 },
    ];
    const snapshot = players.map((p) => ({ ...p }));

    const result = rankPlayers(players);

    assert.deepStrictEqual(players, snapshot); // ongewijzigd, o.a. geen position-veld bijgeschreven
    assert.notStrictEqual(result, players); // nieuwe array
    result.forEach((resultPlayer, i) => {
      assert.notStrictEqual(resultPlayer, players[i]); // nieuwe objects, geen gedeelde referenties
    });
  });

  test('#23 gemengde dataset: tiebreak op minstens 2 velden, plus volledige gelijkstand in het midden', () => {
    // Opbouw van de verwachte eindvolgorde a > {t1 = t2} > b > c:
    // - a vs t1: score beslist (900 vs 600)              -> tiebreakveld 1 (score)
    // - t1 vs t2: volledige gelijkstand op alle 3 velden  -> id-presentatietiebreak (t1 vóór t2)
    // - t2 vs b:  gelijke score (600), correctCount beslist (8 vs 7) -> tiebreakveld 2 (correctCount)
    // - b  vs c:  gelijke score én correctCount, responstijd beslist (50 vs 900) -> tiebreakveld 3 (tijd)
    // t1/t2 liggen daarmee bewust in het midden van de eindvolgorde (posities 2 van de 5),
    // met a erboven en b/c eronder.
    const a = { id: 'a', score: 900, correctCount: 5, correctResponseTimeMsTotal: 100 };
    const t1 = { id: 't1', score: 600, correctCount: 8, correctResponseTimeMsTotal: 400 };
    const t2 = { id: 't2', score: 600, correctCount: 8, correctResponseTimeMsTotal: 400 };
    const b = { id: 'b', score: 600, correctCount: 7, correctResponseTimeMsTotal: 50 };
    const c = { id: 'c', score: 600, correctCount: 7, correctResponseTimeMsTotal: 900 };

    // Bewust geschud aangeleverd, niet al in eindvolgorde.
    const result = rankPlayers([c, t2, a, b, t1]);

    assert.deepStrictEqual(result.map((p) => p.id), ['a', 't1', 't2', 'b', 'c']);
    assert.deepStrictEqual(result.map((p) => p.position), [1, 2, 2, 4, 5]);
  });
});
