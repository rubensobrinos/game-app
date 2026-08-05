import test from 'node:test';
import assert from 'node:assert/strict';
import { socialHeadlineFor, pickHeadlineVariantKey } from './social-headline.mjs';

test('enige correct: alleen als jijzelf die ene correcte speler was', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 1 }, { optionId: 'be', count: 3 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 4,
    movement: new Map(),
    participants: new Map(),
    selfCorrect: true,
  });
  assert.deepEqual(headline, { type: 'self-sole-correct' });
});

test('geen "enige correct"-headline als een ANDERE speler de enige correcte was (geen identiteit bekend)', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 1 }, { optionId: 'be', count: 3 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 4,
    movement: new Map(),
    participants: new Map(),
    selfCorrect: false,
  });
  assert.notEqual(headline?.type, 'self-sole-correct');
});

test('iedereen correct: telling correcte optie === eligiblePlayerCount', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 4 }, { optionId: 'be', count: 0 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 4,
    movement: new Map(),
    participants: new Map(),
  });
  assert.deepEqual(headline, { type: 'everyone-correct' });
});

test('niet iedereen correct als niet iedereen antwoordde (eligiblePlayerCount hoger dan totaal)', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 2 }, { optionId: 'be', count: 0 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 8,
    movement: new Map(),
    participants: new Map(),
  });
  assert.notEqual(headline?.type, 'everyone-correct');
});

test('iedereen fout: 0 op de correcte optie, wel data', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 0 }, { optionId: 'be', count: 3 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 3,
    movement: new Map(),
    participants: new Map(),
  });
  assert.deepEqual(headline, { type: 'everyone-wrong' });
});

test('geen "iedereen fout" als er helemaal geen data is (niemand antwoordde)', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 0 }, { optionId: 'be', count: 0 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 5,
    movement: new Map(),
    participants: new Map(),
  });
  assert.equal(headline, null);
});

test('comeback: grootste stijger met naam, alleen bij >= 2 plaatsen', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 1 }, { optionId: 'be', count: 1 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 4,
    movement: new Map([['p1', 3], ['p2', -1], ['p3', 1]]),
    participants: new Map([['p1', 'Sanne'], ['p2', 'Tom'], ['p3', 'Ruben']]),
  });
  assert.deepEqual(headline, { type: 'comeback', name: 'Sanne', diff: 3 });
});

test('geen comeback-headline bij slechts 1 plaats stijging', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 1 }, { optionId: 'be', count: 1 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 4,
    movement: new Map([['p1', 1]]),
    participants: new Map([['p1', 'Sanne']]),
  });
  assert.notEqual(headline?.type, 'comeback');
});

test('comeback zonder bekende naam wordt overgeslagen, valt door naar de volgende conditie', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 2 }, { optionId: 'be', count: 0 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 2,
    movement: new Map([['p1', 5]]),
    participants: new Map(), // p1 niet bekend
  });
  assert.deepEqual(headline, { type: 'everyone-correct' });
});

test('opvallende misleider: fout antwoord minstens zo vaak gekozen als het juiste', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 2 }, { optionId: 'be', count: 3 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 5,
    movement: new Map(),
    participants: new Map(),
  });
  assert.deepEqual(headline, { type: 'misleading-answer', optionId: 'be' });
});

test('geen misleider-headline als de foute optie minder vaak gekozen werd dan het juiste antwoord', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 5 }, { optionId: 'be', count: 1 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 6,
    movement: new Map(),
    participants: new Map(),
  });
  assert.equal(headline, null);
});

test('comeback wint van iedereen-correct als beide condities gelden (04s prioriteitsvolgorde)', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 3 }, { optionId: 'be', count: 0 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 3,
    movement: new Map([['p1', 2]]),
    participants: new Map([['p1', 'Sanne']]),
  });
  assert.deepEqual(headline, { type: 'comeback', name: 'Sanne', diff: 2 });
});

test('geen enkele conditie: geen headline (geldige, verwachte uitkomst)', () => {
  const headline = socialHeadlineFor({
    distribution: [{ optionId: 'nl', count: 2 }, { optionId: 'be', count: 1 }],
    correctOptionId: 'nl',
    eligiblePlayerCount: 4,
    movement: new Map([['p1', 1]]),
    participants: new Map([['p1', 'Sanne']]),
  });
  assert.equal(headline, null);
});

test('rommelige/ontbrekende invoer breekt niets', () => {
  assert.equal(socialHeadlineFor({}), null);
  assert.equal(socialHeadlineFor(null), null);
  assert.equal(socialHeadlineFor(undefined), null);
});

test('pickHeadlineVariantKey: kiest een volledige sleutel binnen het verwachte bereik', () => {
  const key = pickHeadlineVariantKey('self-sole-correct', null, () => 0.5);
  assert.equal(key, 'headline.selfSoleCorrect.4');
});

test('pickHeadlineVariantKey: dekt de volledige range van 0 tot count - 1', () => {
  assert.equal(pickHeadlineVariantKey('comeback', null, () => 0), 'headline.comeback.0');
  assert.equal(pickHeadlineVariantKey('comeback', null, () => 0.999), 'headline.comeback.8');
});

test('pickHeadlineVariantKey: nooit twee keer achter elkaar dezelfde variant', () => {
  // random() geeft steeds dezelfde waarde als vorige keer, dus zonder de
  // herhaal-check zou dit twee keer dezelfde sleutel opleveren.
  const first = pickHeadlineVariantKey('streak', null, () => 0.5);
  const second = pickHeadlineVariantKey('streak', first, () => 0.5);
  assert.notEqual(second, first);
});

test('pickHeadlineVariantKey: onbekende situatie faalt duidelijk', () => {
  assert.throws(() => pickHeadlineVariantKey('unknown-type', null, () => 0.5), RangeError);
});

test('pickHeadlineVariantKey: random() buiten [0, 1) faalt duidelijk', () => {
  assert.throws(() => pickHeadlineVariantKey('streak', null, () => 1), RangeError);
  assert.throws(() => pickHeadlineVariantKey('streak', null, () => -0.1), RangeError);
});
