'use strict';

// Allowlist per analytics-doeltabel, uit docs/multiplayer/DATA-MODEL.md, secties
// "Wat niet persistent wordt opgeslagen" en "Persistente analytics", en
// docs/data-model-plan/prompts/DM5-privacy-guard.md. Corrigeert REVIEW.md
// bevinding 10: een denylist op bekende slechte veldnamen (playerId,
// displayName, token, ...) mist aliassen en geneste objecten (bijv.
// `participant`, `rawSession`, een geneste `meta.ip`-property) — die heten niet
// letterlijk zoals de denylist verwacht en komen er toch doorheen. Een
// allowlist per tabel is sterker: alleen kolomnamen die letterlijk in de bron
// staan mogen door, ongeacht welke andere sleutels een record verder bevat.
// Dat is tegelijk het privacymechanisme (namen/tokens/IP's staan simpelweg
// niet op de lijst) en een schema-mechanisme (typefouten/nieuwe velden vallen
// meteen op).
//
// Kolomtype-validatie (uuid-formaat, timestamptz-parsing, etc.) is
// uitdrukkelijk geen taak van deze module — dat is DM8 (traceability/schema).
// Deze guard controleert uitsluitend welke velden aanwezig mogen/moeten zijn.

const ALLOWED_COLUMNS = Object.freeze({
  game_sessions: Object.freeze([
    'id',
    'room_id_hash',
    'match_sequence',
    'created_at',
    'started_at',
    'finished_at',
    'language',
    'difficulty',
    'pacing',
    'mode',
    'game_types',
    'total_rounds',
    'max_player_count',
    'late_join_count',
    'joins_via_qr',
    'joins_via_link',
    'joins_via_code',
    'share_qr_open_count',
    'share_link_open_count',
    'finished_normally',
    'rematch_of',
  ]),
  round_stats: Object.freeze([
    'id',
    'game_session_id',
    'round_number',
    'game_type',
    'question_key',
    'answer_count',
    'correct_count',
    'average_answer_ms',
    'no_answer_count',
  ]),
  daily_metrics: Object.freeze([
    'date',
    'rooms_created',
    'games_started',
    'games_finished',
    'players_joined',
    'rematches',
    'median_players_per_game',
    'median_join_to_start_seconds',
  ]),
});

const NULLABLE_COLUMNS = Object.freeze({
  game_sessions: Object.freeze(['started_at', 'finished_at', 'rematch_of']),
  round_stats: Object.freeze(['average_answer_ms']),
  daily_metrics: Object.freeze(['median_players_per_game', 'median_join_to_start_seconds']),
});

/**
 * Werpt RangeError als `record` een key bevat die niet in
 * ALLOWED_COLUMNS[table] staat, of als een niet-nullable kolom ontbreekt/null
 * is. Controleert GEEN kolomtypen (dat is DM8-traceability, niet privacy) —
 * uitsluitend welke velden aanwezig mogen zijn. Geneste objecten/arrays als
 * waarde zijn toegestaan mits de sleutel zelf op de allowlist staat (bijv.
 * `game_types` is een array — de allowlist controleert de buitenste sleutel,
 * niet de waardevorm).
 * @param {"game_sessions"|"round_stats"|"daily_metrics"} table
 * @param {Record<string, unknown>} record
 */
function assertAllowedAnalyticsRecord(table, record) {
  const allowedColumns = ALLOWED_COLUMNS[table];
  if (!allowedColumns) {
    throw new RangeError(`Unknown analytics table: ${JSON.stringify(table)}`);
  }
  const nullableColumns = NULLABLE_COLUMNS[table];

  for (const key of Object.keys(record)) {
    if (!allowedColumns.includes(key)) {
      throw new RangeError(
        `${table}: column "${key}" is not on the allowlist (${allowedColumns.join(', ')})`
      );
    }
  }

  for (const column of allowedColumns) {
    if (nullableColumns.includes(column)) {
      continue;
    }
    if (!(column in record) || record[column] === null || record[column] === undefined) {
      throw new RangeError(`${table}: required column "${column}" is missing or null`);
    }
  }
}

module.exports = {
  ALLOWED_COLUMNS,
  NULLABLE_COLUMNS,
  assertAllowedAnalyticsRecord,
};
