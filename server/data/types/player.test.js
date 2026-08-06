'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { assertPlayerShape } = require('./player');

const BASE_PLAYER = Object.freeze({
  id: 'p_1',
  roomId: 'room_1',
  sessionId: 'sess_1',
  displayName: null,
  generatedName: 'Vlugge Vos',
  effectiveName: 'Vlugge Vos',
  nameSource: 'generated',
  teamId: null,
  score: 0,
  correctCount: 0,
  correctResponseTimeMsTotal: 0,
  connected: false,
  eligibleFromRound: 1,
  joinedAt: 1000,
  left: false,
  kicked: false,
});

// docs/openstaand/spelersidentiteit.md, stap 6 (migratie): een Player die
// vóór deze stap is opgeslagen heeft de sleutel `identity` niet — geen `null`,
// gewoon afwezig. Dat mag nooit alsnog werpen bij een normale savePlayer()
// (kick, score-update, ...) op zo'n bestaande speler.
describe('Player.identity — nullable, en undefined telt hetzelfde als null (stap 6, migratie) #1-5', () => {
  test('#1. identity: null is geldig', () => {
    assert.doesNotThrow(() => assertPlayerShape({ ...BASE_PLAYER, identity: null }));
  });

  test('#2. de sleutel volledig afwezig (oude, gemigreerde speler) is ook geldig', () => {
    const { identity, ...withoutIdentity } = { ...BASE_PLAYER, identity: null };
    assert.ok(!('identity' in withoutIdentity));
    assert.doesNotThrow(() => assertPlayerShape(withoutIdentity));
  });

  test('#3. een welgevormd { country, word }-paar is geldig', () => {
    assert.doesNotThrow(() => assertPlayerShape({ ...BASE_PLAYER, identity: { country: 'bg', word: 'cow' } }));
  });

  test('#4. identity als iets anders dan null/object/undefined -> TypeError', () => {
    assert.throws(() => assertPlayerShape({ ...BASE_PLAYER, identity: 'bg:cow' }), TypeError);
    assert.throws(() => assertPlayerShape({ ...BASE_PLAYER, identity: 42 }), TypeError);
    assert.throws(() => assertPlayerShape({ ...BASE_PLAYER, identity: [] }), TypeError);
  });

  test('#5. identity met een lege of ontbrekende country/word -> throw', () => {
    assert.throws(() => assertPlayerShape({ ...BASE_PLAYER, identity: { country: '', word: 'cow' } }));
    assert.throws(() => assertPlayerShape({ ...BASE_PLAYER, identity: { country: 'bg' } }));
    assert.throws(() => assertPlayerShape({ ...BASE_PLAYER, identity: { word: 'cow' } }));
  });
});

test('de rest van de Player-vorm blijft ongewijzigd streng (regressie)', () => {
  assert.throws(() => assertPlayerShape({ ...BASE_PLAYER, identity: null, effectiveName: '' }), TypeError);
  assert.throws(() => assertPlayerShape({ ...BASE_PLAYER, identity: null, score: -1 }), RangeError);
});
