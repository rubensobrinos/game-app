// Tests voor participant-presentation.mjs — T5-9. Elke drempel uit
// `07` §9's tabel expliciet getest, plus de randgevallen eromheen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { participantPresentationFor } from './participant-presentation.mjs';

test('0 spelers is empty', () => {
  assert.equal(participantPresentationFor(0), 'empty');
});

test('1-8 spelers is rows', () => {
  assert.equal(participantPresentationFor(1), 'rows');
  assert.equal(participantPresentationFor(8), 'rows');
});

test('9-35 spelers is grid', () => {
  assert.equal(participantPresentationFor(9), 'grid');
  assert.equal(participantPresentationFor(20), 'grid');
  assert.equal(participantPresentationFor(21), 'grid');
  assert.equal(participantPresentationFor(35), 'grid');
});

test('36+ spelers is aggregate, ook ver boven de mock-limiet van 100', () => {
  assert.equal(participantPresentationFor(36), 'aggregate');
  assert.equal(participantPresentationFor(100), 'aggregate');
  assert.equal(participantPresentationFor(101), 'aggregate');
  assert.equal(participantPresentationFor(150), 'aggregate');
});

test('negatieve of niet-numerieke invoer valt terug op empty, geen crash', () => {
  assert.equal(participantPresentationFor(-1), 'empty');
  assert.equal(participantPresentationFor(NaN), 'empty');
  assert.equal(participantPresentationFor(undefined), 'empty');
});
