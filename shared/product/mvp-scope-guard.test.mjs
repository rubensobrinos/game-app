import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXCLUDED_FROM_MVP,
  isExplicitlyExcluded,
  assertNoneExcluded,
} from './mvp-scope-guard.mjs';

const EXPECTED_IDS = [
  'accounts_and_registration',
  'native_app',
  'global_leaderboard',
  'friends_or_chat',
  'mandatory_avatars',
  'co_host_or_moderator_roles',
  'user_generated_quizzes',
  'payments_or_premium',
  'extended_group_history',
  'spectator_screen_required',
  'persistent_player_names',
  'one_container_per_game',
];

const EXPECTED_TEXTS = {
  accounts_and_registration: 'accounts, profielen, e-mail, wachtwoorden',
  native_app: 'native iOS- of Android-app',
  global_leaderboard: 'globaal leaderboard over rooms heen',
  friends_or_chat: 'vriendenlijsten of chat',
  mandatory_avatars: 'verplichte avatars',
  co_host_or_moderator_roles: 'co-host- en moderatorrollen',
  user_generated_quizzes: 'user-generated quizsets',
  payments_or_premium: 'betalingen of premium',
  extended_group_history: 'uitgebreide groepshistorie',
  spectator_screen_required: 'spectator-scherm als vereiste',
  persistent_player_names: 'permanente opslag van spelersnamen',
  one_container_per_game: 'één container of proces per game',
};

// 1
test('EXCLUDED_FROM_MVP bevat exact 12 items', () => {
  assert.equal(EXCLUDED_FROM_MVP.length, 12);
});

// 2
test('EXCLUDED_FROM_MVP.map(i => i.id) komt exact overeen met de 12 canonieke ids, in volgorde', () => {
  assert.deepEqual(
    EXCLUDED_FROM_MVP.map((item) => item.id),
    EXPECTED_IDS,
  );
});

// 3
test('de text van elk item is exact gelijk aan de brontekst uit PRODUCT.md', () => {
  for (const item of EXCLUDED_FROM_MVP) {
    assert.equal(item.text, EXPECTED_TEXTS[item.id]);
  }
});

// 4
test("isExplicitlyExcluded('payments_or_premium') is true", () => {
  assert.equal(isExplicitlyExcluded('payments_or_premium'), true);
});

// 5
test("isExplicitlyExcluded('premium') (synoniem, geen canonieke id) is false", () => {
  assert.equal(isExplicitlyExcluded('premium'), false);
});

// 6
test('isExplicitlyExcluded(123) gooit TypeError', () => {
  assert.throws(() => isExplicitlyExcluded(123), TypeError);
});

// 7
test('assertNoneExcluded([]) gooit niet', () => {
  assert.doesNotThrow(() => assertNoneExcluded([]));
});

// 8
test("assertNoneExcluded(['flags_mc']) gooit niet", () => {
  assert.doesNotThrow(() => assertNoneExcluded(['flags_mc']));
});

// 9
test("assertNoneExcluded(['payments_or_premium']) gooit met .violations = ['payments_or_premium']", () => {
  assert.throws(
    () => assertNoneExcluded(['payments_or_premium']),
    (err) => {
      assert.ok(err instanceof Error);
      assert.deepEqual(err.violations, ['payments_or_premium']);
      return true;
    },
  );
});

// 10
test("assertNoneExcluded(['flags_mc', 'accounts_and_registration']) gooit met .violations die alleen accounts_and_registration bevat", () => {
  assert.throws(
    () => assertNoneExcluded(['flags_mc', 'accounts_and_registration']),
    (err) => {
      assert.deepEqual(err.violations, ['accounts_and_registration']);
      return true;
    },
  );
});

// 11
test('assertNoneExcluded met duplicaat dedupliceert .violations', () => {
  assert.throws(
    () => assertNoneExcluded(['payments_or_premium', 'payments_or_premium']),
    (err) => {
      assert.deepEqual(err.violations, ['payments_or_premium']);
      return true;
    },
  );
});

// 12
test('assertNoneExcluded(null) / assertNoneExcluded("x") gooit TypeError, niet de scope-Error', () => {
  assert.throws(() => assertNoneExcluded(null), TypeError);
  assert.throws(() => assertNoneExcluded('x'), TypeError);
});

// 13
test('assertNoneExcluded([1, 2]) gooit TypeError', () => {
  assert.throws(() => assertNoneExcluded([1, 2]), TypeError);
});
