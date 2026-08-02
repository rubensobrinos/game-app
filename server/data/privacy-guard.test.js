'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  ALLOWED_COLUMNS,
  NULLABLE_COLUMNS,
  assertAllowedAnalyticsRecord,
} = require('./privacy-guard');

// Letterlijke voorbeeldrecords — alle kolommen ingevuld — uit
// docs/multiplayer/DATA-MODEL.md, sectie "Persistente analytics".
const EXAMPLE_RECORDS = {
  game_sessions: {
    id: 'session_1',
    room_id_hash: 'hash_abc123',
    match_sequence: 1,
    created_at: '2026-08-02T10:00:00.000Z',
    started_at: '2026-08-02T10:01:00.000Z',
    finished_at: '2026-08-02T10:30:00.000Z',
    language: 'nl',
    difficulty: 'normal',
    pacing: 'standard',
    mode: 'classic',
    game_types: ['trivia', 'estimation'],
    total_rounds: 10,
    max_player_count: 8,
    late_join_count: 1,
    joins_via_qr: 3,
    joins_via_link: 2,
    joins_via_code: 1,
    share_qr_open_count: 5,
    share_link_open_count: 4,
    finished_normally: true,
    rematch_of: 'session_0',
  },
  round_stats: {
    id: 'round_stat_1',
    game_session_id: 'session_1',
    round_number: 1,
    game_type: 'trivia',
    question_key: 'q_123',
    answer_count: 8,
    correct_count: 5,
    average_answer_ms: 4200,
    no_answer_count: 1,
  },
  daily_metrics: {
    date: '2026-08-02',
    rooms_created: 10,
    games_started: 8,
    games_finished: 7,
    players_joined: 40,
    rematches: 2,
    median_players_per_game: 5,
    median_join_to_start_seconds: 30,
  },
};

function clone(record) {
  return { ...record };
}

describe('ALLOWED_COLUMNS kolomtelling — regressietest bevinding 13 (REVIEW-DM2-DM9.md) #1-3', () => {
  test('#1 game_sessions.length === 21', () => {
    assert.strictEqual(ALLOWED_COLUMNS.game_sessions.length, 21);
  });

  test('#2 round_stats.length === 9', () => {
    assert.strictEqual(ALLOWED_COLUMNS.round_stats.length, 9);
  });

  test('#3 daily_metrics.length === 8', () => {
    assert.strictEqual(ALLOWED_COLUMNS.daily_metrics.length, 8);
  });
});

describe('happy path — letterlijk voorbeeldrecord per tabel (alle kolommen ingevuld) slaagt', () => {
  let n = 4;
  for (const table of Object.keys(EXAMPLE_RECORDS)) {
    test(`#${n++} ${table}: volledig voorbeeldrecord slaagt`, () => {
      assert.doesNotThrow(() => assertAllowedAnalyticsRecord(table, EXAMPLE_RECORDS[table]));
    });
  }
});

describe('nullable kolommen mogen ontbreken of null zijn', () => {
  let n = 7;
  for (const table of Object.keys(EXAMPLE_RECORDS)) {
    for (const column of NULLABLE_COLUMNS[table]) {
      test(`#${n++} ${table}.${column} mag ontbreken`, () => {
        const record = clone(EXAMPLE_RECORDS[table]);
        delete record[column];
        assert.doesNotThrow(() => assertAllowedAnalyticsRecord(table, record));
      });

      test(`#${n++} ${table}.${column} mag null zijn`, () => {
        const record = clone(EXAMPLE_RECORDS[table]);
        record[column] = null;
        assert.doesNotThrow(() => assertAllowedAnalyticsRecord(table, record));
      });
    }
  }
});

describe('niet-nullable kolommen: ontbreken of null -> RangeError', () => {
  let n = 19;
  for (const table of Object.keys(EXAMPLE_RECORDS)) {
    const nonNullable = ALLOWED_COLUMNS[table].filter(
      (column) => !NULLABLE_COLUMNS[table].includes(column)
    );
    for (const column of nonNullable) {
      test(`#${n++} ${table}.${column} ontbreekt -> RangeError`, () => {
        const record = clone(EXAMPLE_RECORDS[table]);
        delete record[column];
        assert.throws(() => assertAllowedAnalyticsRecord(table, record), RangeError);
      });

      test(`#${n++} ${table}.${column} is null -> RangeError`, () => {
        const record = clone(EXAMPLE_RECORDS[table]);
        record[column] = null;
        assert.throws(() => assertAllowedAnalyticsRecord(table, record), RangeError);
      });
    }
  }
});

describe('regressietest bevinding 10 — allowlist, geen denylist', () => {
  let n = 83;

  // Niet-triviale, niet-voor-de-hand-liggende extra sleutels — geen bekende
  // "slechte naam", maar simpelweg niet op de allowlist. Bewijst dat dit een
  // allowlist is: elke onbekende sleutel wordt geweigerd, ongeacht de naam.
  const unexpectedKeys = ['participant', 'rawSession', 'meta'];
  for (const table of Object.keys(EXAMPLE_RECORDS)) {
    for (const key of unexpectedKeys) {
      test(`#${n++} ${table}: onbekende sleutel "${key}" wordt geweigerd`, () => {
        const record = clone(EXAMPLE_RECORDS[table]);
        record[key] = 'irrelevant';
        assert.throws(() => assertAllowedAnalyticsRecord(table, record), RangeError);
      });
    }
  }

  // Bekende "slechte" veldnamen uit DATA-MODEL.md, sectie "Wat niet
  // persistent wordt opgeslagen" — worden vanzelfsprekend ook geweigerd,
  // zonder aparte denylist-code: ze staan simpelweg niet op de allowlist.
  const knownBadKeys = ['playerId', 'displayName', 'tokenHash', 'ip'];
  for (const table of Object.keys(EXAMPLE_RECORDS)) {
    for (const key of knownBadKeys) {
      test(`#${n++} ${table}: bekende "slechte" sleutel "${key}" wordt geweigerd`, () => {
        const record = clone(EXAMPLE_RECORDS[table]);
        record[key] = 'irrelevant';
        assert.throws(() => assertAllowedAnalyticsRecord(table, record), RangeError);
      });
    }
  }
});

describe('kolomnamen zijn tabel-specifiek — geen kruisbestuiving tussen tabellen', () => {
  let n = 104;

  // Kolommen die uniek zijn voor één tabel (geen toevallige overlap, zoals
  // `id`, dat zowel in game_sessions als round_stats voorkomt) — een sleutel
  // die op tabel A toegestaan is, wordt op tabel B alsnog geweigerd.
  const pairs = [
    ['game_sessions', 'round_stats', 'mode'],
    ['game_sessions', 'daily_metrics', 'mode'],
    ['round_stats', 'game_sessions', 'question_key'],
    ['round_stats', 'daily_metrics', 'question_key'],
    ['daily_metrics', 'game_sessions', 'rooms_created'],
    ['daily_metrics', 'round_stats', 'rooms_created'],
  ];

  for (const [sourceTable, targetTable, column] of pairs) {
    test(`#${n++} "${column}" (toegestaan op ${sourceTable}) wordt geweigerd op ${targetTable}`, () => {
      const record = clone(EXAMPLE_RECORDS[targetTable]);
      record[column] = EXAMPLE_RECORDS[sourceTable][column];
      assert.throws(() => assertAllowedAnalyticsRecord(targetTable, record), RangeError);
    });
  }
});
