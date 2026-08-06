import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  iso2sSeenInRound,
  resetPassportForNewMatch,
  recordRoundEndedForPassport,
  passportSummaryForPodium,
} from './passport-tracker.mjs';
import { loadPassport } from '../../../client/flow/passport-store.mjs';

function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

// ── iso2sSeenInRound — per gameType, "elk land dat je zag" (besluit 53) ────

test('iso2sSeenInRound: flags_mc/capitals_mc/country_shape_mc leveren het target op, kleine letters', () => {
  for (const gameType of ['flags_mc', 'capitals_mc', 'country_shape_mc']) {
    assert.deepStrictEqual(iso2sSeenInRound(gameType, {}, { optionId: 'FR' }), ['fr']);
  }
});

test('iso2sSeenInRound: real_or_fake_flag levert het land alleen op als de vraag écht was', () => {
  assert.deepStrictEqual(
    iso2sSeenInRound('real_or_fake_flag', { kind: 'real', iso2: 'DE' }, { choice: 'real' }),
    ['de'],
  );
  assert.deepStrictEqual(
    iso2sSeenInRound('real_or_fake_flag', { kind: 'generated', spec: {} }, { choice: 'fake' }),
    [],
    'een gegenereerde vlag hoort bij geen enkel bestaand land',
  );
});

test('iso2sSeenInRound: higher_lower levert BEIDE kanten van het duel op', () => {
  const question = { metric: 'population', sides: [{ side: 0, iso2: 'FR' }, { side: 1, iso2: 'DE' }] };
  assert.deepStrictEqual(iso2sSeenInRound('higher_lower', question, { side: 1 }), ['fr', 'de']);
});

test('iso2sSeenInRound: odd_one_out levert elke kaart met een écht land op, generated-kaarten niet', () => {
  const question = {
    cards: [
      { cardIndex: 0, iso2: 'FR' },
      { cardIndex: 1, iso2: 'DE' },
      { cardIndex: 2, seed: 'fx_1', spec: {} }, // gegenereerd, geen land
      { cardIndex: 3, iso2: 'IT' },
    ],
  };
  assert.deepStrictEqual(iso2sSeenInRound('odd_one_out', question, { cardIndex: 2 }), ['fr', 'de', 'it']);
});

test('iso2sSeenInRound: onbekend/ontbrekend gameType of ontbrekende data levert nooit een throw of iets vreemds op', () => {
  assert.deepStrictEqual(iso2sSeenInRound(null, null, null), []);
  assert.deepStrictEqual(iso2sSeenInRound('flags_mc', {}, {}), []);
  assert.deepStrictEqual(iso2sSeenInRound('higher_lower', {}, {}), []);
  assert.deepStrictEqual(iso2sSeenInRound('odd_one_out', {}, {}), []);
});

// ── resetPassportForNewMatch / recordRoundEndedForPassport / passportSummaryForPodium ──

test('een volledige partij: paspoort groeit, "vanavond" telt de ronde-landen, "nieuw" alleen wat er echt bijkwam', () => {
  const storage = createFakeStorage();
  // Al eerder gezien, in een vorige partij op dit apparaat.
  storage.setItem('mp:passport', JSON.stringify({ fr: 100 }));

  resetPassportForNewMatch(storage);

  recordRoundEndedForPassport(storage, 'flags_mc', {}, { optionId: 'FR' }); // al bekend
  recordRoundEndedForPassport(storage, 'flags_mc', {}, { optionId: 'DE' }); // nieuw
  recordRoundEndedForPassport(
    storage,
    'higher_lower',
    { sides: [{ side: 0, iso2: 'ES' }, { side: 1, iso2: 'IT' }] },
    { side: 0 },
  ); // twee nieuwe in één ronde

  const samenvatting = passportSummaryForPodium(storage);
  assert.strictEqual(samenvatting.totalSeen, 4, 'fr (al bekend) + de + es + it');
  assert.deepStrictEqual(samenvatting.seenThisMatch, ['fr', 'de', 'es', 'it']);
  assert.deepStrictEqual(samenvatting.newThisMatch, ['de', 'es', 'it'], 'fr was al bekend vóór deze partij');

  const opgeslagen = loadPassport(storage);
  assert.deepStrictEqual(Object.keys(opgeslagen).sort(), ['de', 'es', 'fr', 'it']);
  assert.strictEqual(opgeslagen.fr, 100, 'fr bestond al — het eerste-gezien-moment verandert niet');
});

test('hetzelfde land twee keer in één partij telt maar één keer mee voor "vanavond"', () => {
  const storage = createFakeStorage();
  resetPassportForNewMatch(storage);
  recordRoundEndedForPassport(storage, 'flags_mc', {}, { optionId: 'FR' });
  recordRoundEndedForPassport(storage, 'flags_mc', {}, { optionId: 'FR' });
  const samenvatting = passportSummaryForPodium(storage);
  assert.deepStrictEqual(samenvatting.seenThisMatch, ['fr']);
  assert.deepStrictEqual(samenvatting.newThisMatch, ['fr']);
});

test('een nieuwe match (rematch) reset "vanavond" en de nieuw-vergelijkingsbasis', () => {
  const storage = createFakeStorage();
  resetPassportForNewMatch(storage);
  recordRoundEndedForPassport(storage, 'flags_mc', {}, { optionId: 'FR' });
  assert.deepStrictEqual(passportSummaryForPodium(storage).seenThisMatch, ['fr']);

  // Revanche: nieuwe match, "vanavond" begint weer bij nul — maar fr is nu
  // al bekend, dus zou in de nieuwe match niet meer als "nieuw" gelden.
  resetPassportForNewMatch(storage);
  assert.deepStrictEqual(passportSummaryForPodium(storage).seenThisMatch, [], 'schone lei voor de nieuwe match');
  recordRoundEndedForPassport(storage, 'flags_mc', {}, { optionId: 'FR' });
  const samenvatting = passportSummaryForPodium(storage);
  assert.deepStrictEqual(samenvatting.seenThisMatch, ['fr']);
  assert.deepStrictEqual(samenvatting.newThisMatch, [], 'fr was al bekend vóór déze (tweede) match');
});
