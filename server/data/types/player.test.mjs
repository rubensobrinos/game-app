import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { assertPlayerShape, toStandingPlayerView } from './player.js';
import { rankPlayers } from '../../../shared/rules/ranking.mjs';

const VALID_PLAYER = Object.freeze({
  id: 'p_8f42d1',
  roomId: 'room_01J...',
  sessionId: 'sess_01J...',
  displayName: null,
  generatedName: 'Vlugge Vos',
  effectiveName: 'Vlugge Vos',
  nameSource: 'generated',
  teamId: null,
  score: 4200,
  correctCount: 12,
  correctResponseTimeMsTotal: 56420,
  connected: true,
  eligibleFromRound: 1,
  joinedAt: 1785620100000,
  left: false,
  kicked: false,
});

describe('assertPlayerShape — letterlijk spec-voorbeeld #1', () => {
  test('#1 het DATA-MODEL.md-voorbeeld slaagt', () => {
    assert.doesNotThrow(() => assertPlayerShape(VALID_PLAYER));
  });
});

describe('assertPlayerShape — ontbrekend verplicht veld #2-17', () => {
  const fields = Object.keys(VALID_PLAYER);
  let n = 2;
  for (const field of fields) {
    const caseNum = n++;
    test(`#${caseNum} ontbrekend veld '${field}' -> throw`, () => {
      const { [field]: _omitted, ...rest } = VALID_PLAYER;
      assert.throws(() => assertPlayerShape(rest));
    });
  }
});

describe('assertPlayerShape — displayName/teamId string|null #18-21', () => {
  test('#18 displayName als niet-lege string slaagt', () => {
    assert.doesNotThrow(() => assertPlayerShape({ ...VALID_PLAYER, displayName: 'Ruben' }));
  });
  test('#19 displayName als getal -> throw', () => {
    assert.throws(() => assertPlayerShape({ ...VALID_PLAYER, displayName: 123 }));
  });
  test('#20 teamId als niet-lege string slaagt', () => {
    assert.doesNotThrow(() => assertPlayerShape({ ...VALID_PLAYER, teamId: 'team_1' }));
  });
  test('#21 teamId als getal -> throw', () => {
    assert.throws(() => assertPlayerShape({ ...VALID_PLAYER, teamId: 42 }));
  });
});

describe('assertPlayerShape — nameSource bewust open, geen gesloten enum #22', () => {
  test('#22 nameSource met een andere waarde dan "generated" slaagt', () => {
    assert.doesNotThrow(() => assertPlayerShape({ ...VALID_PLAYER, nameSource: 'chosen' }));
  });
});

describe('assertPlayerShape — score/correctCount/correctResponseTimeMsTotal niet-negatieve integers #23-28', () => {
  test('#23 score negatief -> RangeError', () => {
    assert.throws(() => assertPlayerShape({ ...VALID_PLAYER, score: -1 }), RangeError);
  });
  test('#24 score niet-integer -> RangeError', () => {
    assert.throws(() => assertPlayerShape({ ...VALID_PLAYER, score: 4200.5 }), RangeError);
  });
  test('#25 correctCount negatief -> RangeError', () => {
    assert.throws(() => assertPlayerShape({ ...VALID_PLAYER, correctCount: -1 }), RangeError);
  });
  test('#26 correctResponseTimeMsTotal negatief -> RangeError', () => {
    assert.throws(() => assertPlayerShape({ ...VALID_PLAYER, correctResponseTimeMsTotal: -1 }), RangeError);
  });
  test('#27 score = 0 slaagt (grenswaarde)', () => {
    assert.doesNotThrow(() => assertPlayerShape({ ...VALID_PLAYER, score: 0, correctCount: 0, correctResponseTimeMsTotal: 0 }));
  });
  test('#28 score als string -> RangeError', () => {
    assert.throws(() => assertPlayerShape({ ...VALID_PLAYER, score: '4200' }), RangeError);
  });
});

describe('assertPlayerShape — eligibleFromRound integer >= 1 #29-31', () => {
  test('#29 eligibleFromRound = 0 -> RangeError', () => {
    assert.throws(() => assertPlayerShape({ ...VALID_PLAYER, eligibleFromRound: 0 }), RangeError);
  });
  test('#30 eligibleFromRound = 1 slaagt (grenswaarde)', () => {
    assert.doesNotThrow(() => assertPlayerShape({ ...VALID_PLAYER, eligibleFromRound: 1 }));
  });
  test('#31 eligibleFromRound niet-integer -> RangeError', () => {
    assert.throws(() => assertPlayerShape({ ...VALID_PLAYER, eligibleFromRound: 1.5 }), RangeError);
  });
});

describe('toStandingPlayerView — allowlist tegen rankPlayers() (DM9) #32-34', () => {
  test('#32 levert exact de vier velden die rankPlayers() nodig heeft, niets meer', () => {
    const view = toStandingPlayerView(VALID_PLAYER);
    assert.deepStrictEqual(Object.keys(view).sort(), ['correctCount', 'correctResponseTimeMsTotal', 'id', 'score'].sort());
  });

  test('#33 sessionId/displayName/nameSource/teamId/etc. lekken niet naar de output', () => {
    const view = toStandingPlayerView(VALID_PLAYER);
    for (const leaked of ['sessionId', 'displayName', 'nameSource', 'teamId', 'roomId', 'connected', 'eligibleFromRound', 'joinedAt', 'left', 'kicked', 'generatedName', 'effectiveName']) {
      assert.strictEqual(leaked in view, false, `${leaked} lekt naar toStandingPlayerView()'s output`);
    }
  });

  test('#34 end-to-end: de output gaat rechtstreeks door de echte rankPlayers() heen', () => {
    const players = [
      toStandingPlayerView({ ...VALID_PLAYER, id: 'p_1', score: 100 }),
      toStandingPlayerView({ ...VALID_PLAYER, id: 'p_2', score: 300 }),
    ];
    const ranked = rankPlayers(players);
    assert.strictEqual(ranked[0].id, 'p_2');
    assert.strictEqual(ranked[0].position, 1);
    assert.strictEqual(ranked[1].id, 'p_1');
    assert.strictEqual(ranked[1].position, 2);
  });
});
