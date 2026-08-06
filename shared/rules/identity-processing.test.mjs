import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { pickIdentity, identityKey } from './identity-processing.mjs';

function sequenceRandom(values) {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

describe('identityKey — structurele sleutel, geen tekst', () => {
  test('gelijke paren geven gelijke sleutel', () => {
    assert.equal(identityKey({ country: 'bg', word: 'cow' }), identityKey({ country: 'bg', word: 'cow' }));
  });
  test('een ander land of woord geeft een andere sleutel', () => {
    assert.notEqual(identityKey({ country: 'bg', word: 'cow' }), identityKey({ country: 'pe', word: 'cow' }));
    assert.notEqual(identityKey({ country: 'bg', word: 'cow' }), identityKey({ country: 'bg', word: 'rabbit' }));
  });
});

describe('pickIdentity — invoervalidatie', () => {
  test('countryPool of wordPool geen array -> TypeError', () => {
    assert.throws(() => pickIdentity(null, ['cow'], []), TypeError);
    assert.throws(() => pickIdentity(['bg'], null, []), TypeError);
  });
  test('existingIdentities geen array -> TypeError', () => {
    assert.throws(() => pickIdentity(['bg'], ['cow'], null), TypeError);
  });
  test('lege countryPool of wordPool -> null, geen throw', () => {
    assert.equal(pickIdentity([], ['cow'], []), null);
    assert.equal(pickIdentity(['bg'], [], []), null);
  });
});

describe('pickIdentity — kiest uit de pool, nooit iets erbuiten', () => {
  test('het resultaat komt letterlijk uit countryPool/wordPool', () => {
    const countryPool = ['bg', 'pe', 'nl'];
    const wordPool = ['cow', 'rabbit'];
    for (let seed = 0; seed < 20; seed += 1) {
      const result = pickIdentity(countryPool, wordPool, [], sequenceRandom([seed / 20]));
      assert.ok(countryPool.includes(result.country));
      assert.ok(wordPool.includes(result.word));
    }
  });

  test('random()=0 kiest altijd het eerste element van elke pool', () => {
    const result = pickIdentity(['bg', 'pe'], ['cow', 'rabbit'], [], () => 0);
    assert.deepEqual(result, { country: 'bg', word: 'cow' });
  });
});

describe('DE VALKUIL: uniciteit gaat over het paar, niet over gerenderde tekst #1-3', () => {
  test('#1. een bezet paar wordt nooit teruggegeven, ook al is er maar één alternatief', () => {
    const countryPool = ['bg', 'pe'];
    const wordPool = ['cow'];
    // Poging 1 (aanroepen 1-2): random()=0 geeft { bg, cow } — al bezet.
    // Poging 2 (aanroepen 3-4): random() net onder 1 duwt de landindex naar
    // 'pe', het enige nog vrije paar.
    const result = pickIdentity(countryPool, wordPool, [{ country: 'bg', word: 'cow' }], sequenceRandom([0, 0, 0.99, 0]));
    assert.deepEqual(result, { country: 'pe', word: 'cow' });
  });

  test('#2. twee spelers met hetzelfde land maar een ander woord zijn geen botsing', () => {
    const countryPool = ['bg'];
    const wordPool = ['cow', 'rabbit'];
    // Poging 1: { bg, cow } — al bezet. Poging 2: de woordindex schuift naar
    // 'rabbit', het enige nog vrije paar (er is maar één land).
    const result = pickIdentity(countryPool, wordPool, [{ country: 'bg', word: 'cow' }], sequenceRandom([0, 0, 0, 0.99]));
    assert.deepEqual(result, { country: 'bg', word: 'rabbit' });
  });

  test('#3. alle paren bezet -> null, geen cijfer-suffix op het paar verzonnen', () => {
    const countryPool = ['bg', 'pe'];
    const wordPool = ['cow'];
    const existing = [{ country: 'bg', word: 'cow' }, { country: 'pe', word: 'cow' }];
    const result = pickIdentity(countryPool, wordPool, existing, () => 0);
    assert.equal(result, null);
  });

  test('#4. de check is op het paar, niet op de plek in de pool-array (verschillende volgorde, zelfde uitkomst)', () => {
    const existing = [{ country: 'nl', word: 'rabbit' }];
    const a = pickIdentity(['nl', 'bg'], ['cow', 'rabbit'], existing, () => 0);
    const b = pickIdentity(['bg', 'nl'], ['rabbit', 'cow'], existing.slice(), () => 0);
    // Beide vermijden nl+rabbit, ongeacht waar dat paar in de array staat.
    assert.notEqual(identityKey(a), identityKey({ country: 'nl', word: 'rabbit' }));
    assert.notEqual(identityKey(b), identityKey({ country: 'nl', word: 'rabbit' }));
  });
});

describe('determinisme', () => {
  test('identieke random-reeks + identieke input geeft identiek resultaat', () => {
    const a = pickIdentity(['bg', 'pe', 'nl'], ['cow', 'rabbit', 'penguin'], [], sequenceRandom([0.4, 0.7]));
    const b = pickIdentity(['bg', 'pe', 'nl'], ['cow', 'rabbit', 'penguin'], [], sequenceRandom([0.4, 0.7]));
    assert.deepEqual(a, b);
  });
});
