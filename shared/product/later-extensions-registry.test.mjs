import test from 'node:test';
import assert from 'node:assert/strict';

import { LATER_EXTENSIONS } from './later-extensions-registry.mjs';
import { EXCLUDED_FROM_MVP } from './mvp-scope-guard.mjs';

const EXPECTED_IDS = [
  'generated_group_flag_or_badge',
  'vote_on_generated_designs',
  'save_and_reuse_flag_or_badge',
  'branded_end_card',
  'seasonal_or_event_formats',
  'multi_night_team_competitions',
  'optional_spectator_route',
  'paid_white_label_or_event_versions',
];

const EXPECTED_TEXTS = {
  generated_group_flag_or_badge: 'gegenereerde groepsvlag of groepsbadge',
  vote_on_generated_designs: 'stemmen op meerdere gegenereerde ontwerpen',
  save_and_reuse_flag_or_badge: 'vlag/badge bewaren en opnieuw gebruiken',
  branded_end_card: 'branded eindkaart',
  seasonal_or_event_formats: 'seizoens- of eventformats',
  multi_night_team_competitions: 'teamcompetities over meerdere avonden',
  optional_spectator_route: 'optionele spectator-route',
  paid_white_label_or_event_versions: 'betaalde white-label- of eventversies',
};

// 1
test('LATER_EXTENSIONS bevat exact 8 items', () => {
  assert.equal(LATER_EXTENSIONS.length, 8);
});

// 2
test('LATER_EXTENSIONS.map(i => i.id) komt exact overeen met de 8 canonieke ids, in die volgorde', () => {
  assert.deepEqual(
    LATER_EXTENSIONS.map((item) => item.id),
    EXPECTED_IDS,
  );
});

// 3
test('de text van elk item is exact gelijk aan de brontekst uit PRODUCT.md', () => {
  for (const item of LATER_EXTENSIONS) {
    assert.equal(item.text, EXPECTED_TEXTS[item.id]);
  }
});

// 4
test("optional_spectator_route.qualifies === 'spectator_screen_required'", () => {
  const item = LATER_EXTENSIONS.find((i) => i.id === 'optional_spectator_route');
  assert.equal(item.qualifies, 'spectator_screen_required');
});

// 5
test("paid_white_label_or_event_versions.qualifies === 'payments_or_premium'", () => {
  const item = LATER_EXTENSIONS.find((i) => i.id === 'paid_white_label_or_event_versions');
  assert.equal(item.qualifies, 'payments_or_premium');
});

// 6
test('de overige 6 items hebben qualifies === null', () => {
  const qualifyingIds = new Set(['optional_spectator_route', 'paid_white_label_or_event_versions']);
  const remaining = LATER_EXTENSIONS.filter((item) => !qualifyingIds.has(item.id));

  assert.equal(remaining.length, 6);
  for (const item of remaining) {
    assert.equal(item.qualifies, null);
  }
});

// 7
test('elke niet-null qualifies-waarde komt voor in EXCLUDED_FROM_MVP.map(i => i.id) (referentiële integriteit)', () => {
  const excludedIds = new Set(EXCLUDED_FROM_MVP.map((item) => item.id));

  for (const item of LATER_EXTENSIONS) {
    if (item.qualifies !== null) {
      assert.ok(
        excludedIds.has(item.qualifies),
        `qualifies '${item.qualifies}' (van '${item.id}') bestaat niet in EXCLUDED_FROM_MVP`,
      );
    }
  }
});

// 8
test('LATER_EXTENSIONS is bevroren: een mutatiepoging verandert de inhoud niet', () => {
  assert.equal(Object.isFrozen(LATER_EXTENSIONS), true);

  assert.throws(() => {
    'use strict';
    LATER_EXTENSIONS.push({ id: 'x', text: 'x', qualifies: null });
  }, TypeError);

  assert.deepEqual(
    LATER_EXTENSIONS.map((item) => item.id),
    EXPECTED_IDS,
  );
});
