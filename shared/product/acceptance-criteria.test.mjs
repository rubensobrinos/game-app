import test from 'node:test';
import assert from 'node:assert/strict';

import { ACCEPTANCE_CRITERIA, LAST_VERIFIED } from './acceptance-criteria.mjs';

const EXPECTED_IDS = [
  'quick_start_to_room_10s',
  'qr_scan_to_lobby_10s',
  'no_account_email_or_install_prompt',
  'every_player_can_reshare',
  'hundred_players_twenty_rounds_no_desync',
  'refresh_recovery_5s_score_kept',
  'rematch_without_new_code_scan_or_name',
  'only_anonymous_aggregated_stats_retained',
  'core_flow_without_flag_logo_spectator_payment',
];

const EXPECTED_TEXTS = {
  quick_start_to_room_10s: 'Van homepage naar aangemaakte room in maximaal 10 seconden via `Snel starten`.',
  qr_scan_to_lobby_10s: 'Van QR-scan naar lobby in maximaal 10 seconden op een gemiddelde telefoon.',
  no_account_email_or_install_prompt: 'Geen account-, e-mail- of installatieprompt vóór of tijdens een game.',
  every_player_can_reshare: 'Iedere aangesloten speler kan de QR of join-link opnieuw delen.',
  hundred_players_twenty_rounds_no_desync:
    'Eén room met 100 spelers doorloopt 20 rondes zonder desynchronisatie of crash.',
  refresh_recovery_5s_score_kept: 'Refresh of korte netwerkuitval herstelt binnen 5 seconden met behoud van score.',
  rematch_without_new_code_scan_or_name: 'Een rematch start zonder nieuwe code, QR-scan of naamkeuze.',
  only_anonymous_aggregated_stats_retained:
    'Alleen de anonieme, geaggregeerde statistieken uit `DATA-MODEL.md` blijven bewaard.',
  core_flow_without_flag_logo_spectator_payment:
    'De kernflow werkt zonder groepsvlag, logo-generator, spectator-scherm of betaling.',
};

const VALID_STATUSES = new Set(['not_started', 'partial', 'built']);

// 1
test('ACCEPTANCE_CRITERIA bevat exact 9 items', () => {
  assert.equal(ACCEPTANCE_CRITERIA.length, 9);
});

// 2
test('ACCEPTANCE_CRITERIA.map(i => i.id) komt exact overeen met de 9 canonieke ids, in die volgorde', () => {
  assert.deepEqual(
    ACCEPTANCE_CRITERIA.map((item) => item.id),
    EXPECTED_IDS,
  );
});

// 3
test('de text van elk item is exact gelijk aan de brontekst uit PRODUCT.md', () => {
  for (const item of ACCEPTANCE_CRITERIA) {
    assert.equal(item.text, EXPECTED_TEXTS[item.id]);
  }
});

// 4
test("elke status is 'not_started' | 'partial' | 'built'", () => {
  for (const item of ACCEPTANCE_CRITERIA) {
    assert.ok(VALID_STATUSES.has(item.status), `onverwachte status '${item.status}' bij '${item.id}'`);
  }
});

// 5
test('de statusverdeling is exact: 1x built, 2x not_started, 6x partial', () => {
  const statusById = Object.fromEntries(ACCEPTANCE_CRITERIA.map((item) => [item.id, item.status]));

  assert.equal(statusById.rematch_without_new_code_scan_or_name, 'built');

  assert.equal(statusById.hundred_players_twenty_rounds_no_desync, 'not_started');
  assert.equal(statusById.only_anonymous_aggregated_stats_retained, 'not_started');

  const partialIds = [
    'quick_start_to_room_10s',
    'qr_scan_to_lobby_10s',
    'no_account_email_or_install_prompt',
    'every_player_can_reshare',
    'refresh_recovery_5s_score_kept',
    'core_flow_without_flag_logo_spectator_payment',
  ];
  for (const id of partialIds) {
    assert.equal(statusById[id], 'partial');
  }

  const counts = { not_started: 0, partial: 0, built: 0 };
  for (const item of ACCEPTANCE_CRITERIA) {
    counts[item.status] += 1;
  }
  assert.equal(counts.built, 1);
  assert.equal(counts.not_started, 2);
  assert.equal(counts.partial, 6);
});

// 6
test('elk evidence-array is niet-leeg en bevat uitsluitend niet-lege strings', () => {
  for (const item of ACCEPTANCE_CRITERIA) {
    assert.ok(Array.isArray(item.evidence), `evidence van '${item.id}' is geen array`);
    assert.ok(item.evidence.length > 0, `evidence van '${item.id}' is leeg`);
    for (const entry of item.evidence) {
      assert.equal(typeof entry, 'string');
      assert.ok(entry.length > 0, `evidence-string bij '${item.id}' is leeg`);
    }
  }
});

// 7
test('ACCEPTANCE_CRITERIA en elk evidence-array zijn bevroren: een mutatiepoging verandert de inhoud niet', () => {
  assert.equal(Object.isFrozen(ACCEPTANCE_CRITERIA), true);

  assert.throws(() => {
    'use strict';
    ACCEPTANCE_CRITERIA.push({ id: 'x', text: 'x', status: 'built', evidence: Object.freeze(['x']) });
  }, TypeError);

  assert.deepEqual(
    ACCEPTANCE_CRITERIA.map((item) => item.id),
    EXPECTED_IDS,
  );

  for (const item of ACCEPTANCE_CRITERIA) {
    assert.equal(Object.isFrozen(item.evidence), true, `evidence van '${item.id}' is niet bevroren`);

    const before = [...item.evidence];
    assert.throws(() => {
      'use strict';
      item.evidence.push('nieuwe regel');
    }, TypeError);
    assert.deepEqual(item.evidence.slice(), before);
  }
});

// 8
test("LAST_VERIFIED === '2026-08-02'", () => {
  assert.equal(LAST_VERIFIED, '2026-08-02');
});
