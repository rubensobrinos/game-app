const SESSION_COLUMNS = Object.freeze([
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
]);

const ROUND_COLUMNS = Object.freeze([
  'id',
  'game_session_id',
  'round_number',
  'game_type',
  'question_key',
  'answer_count',
  'correct_count',
  'average_answer_ms',
  'no_answer_count',
]);

export const DAY_COUNTERS = Object.freeze([
  'rooms_created',
  'games_started',
  'games_finished',
  'players_joined',
  'rematches',
]);

// --------------------------------------------------------------------------
// Pepper
// --------------------------------------------------------------------------

/**
 * Bytelengte van een HMAC-sleutel, ongeacht of het een string of bytes zijn.
 * @param {unknown} pepper
 * @returns {number}
 */
// --------------------------------------------------------------------------
// SQL
// --------------------------------------------------------------------------

/**
 * Valideert een schemanaam en levert hem als identifier. Er wordt NOOIT iets
 * anders dan deze gecontroleerde string in SQL geïnterpoleerd; alle waarden
 * gaan via parameters.
 * @param {string} schema
 * @returns {string}
 */
export function assertSchemaName(schema) {
  if (typeof schema !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(schema) || schema.length > 63) {
    throw new TypeError(
      `schema moet een eenvoudige lowercase identifier zijn ([a-z_][a-z0-9_]*, max 63), kreeg: ${JSON.stringify(schema)}`
    );
  }
  return schema;
}

/**
 * `($1,$2,...),($n,...)` voor een meerrijige INSERT.
 * @param {number} rowCount
 * @param {number} columnCount
 * @returns {string}
 */
function placeholders(rowCount, columnCount) {
  const groups = [];
  let index = 1;
  for (let row = 0; row < rowCount; row += 1) {
    const group = [];
    for (let column = 0; column < columnCount; column += 1) {
      group.push(`$${index}`);
      index += 1;
    }
    groups.push(`(${group.join(', ')})`);
  }
  return groups.join(', ');
}


export function createBatchWriter(qualified) {
  async function writeBatch(executor, units, drainedDays) {
    const sessionRows = units.map((unit) => unit.session);
    const roundRows = units.flatMap((unit) => unit.rounds);
  
    if (sessionRows.length > 0) {
      const values = sessionRows.flatMap((row) => SESSION_COLUMNS.map((column) => row[column]));
      await executor.query(
        `INSERT INTO ${qualified('game_sessions')} (${SESSION_COLUMNS.join(', ')}) ` +
          `VALUES ${placeholders(sessionRows.length, SESSION_COLUMNS.length)} ` +
          'ON CONFLICT (id) DO NOTHING',
        values
      );
    }
  
    if (roundRows.length > 0) {
      const values = roundRows.flatMap((row) => ROUND_COLUMNS.map((column) => row[column]));
      await executor.query(
        `INSERT INTO ${qualified('round_stats')} (${ROUND_COLUMNS.join(', ')}) ` +
          `VALUES ${placeholders(roundRows.length, ROUND_COLUMNS.length)} ` +
          'ON CONFLICT (id) DO NOTHING',
        values
      );
    }
  
    if (drainedDays.length > 0) {
      const columns = ['date', ...DAY_COUNTERS];
      const values = drainedDays.flatMap((entry) => columns.map((column) => entry[column]));
      await executor.query(
        `INSERT INTO ${qualified('daily_metrics')} (${columns.join(', ')}, median_players_per_game, median_join_to_start_seconds) ` +
          `VALUES ${drainedDays
            .map((_entry, index) => {
              const base = index * columns.length;
              return `(${columns.map((_c, offset) => `$${base + offset + 1}`).join(', ')}, NULL, NULL)`;
            })
            .join(', ')} ` +
          'ON CONFLICT (date) DO UPDATE SET ' +
          DAY_COUNTERS.map((counter) => `${counter} = ${qualified('daily_metrics')}.${counter} + EXCLUDED.${counter}`).join(', '),
        values
      );
    }
  
    // Medianen zijn niet incrementeel bij te houden — een lopende mediaan
    // bestaat niet. Ze worden daarom in dezelfde transactie HERBEREKEND uit
    // `game_sessions`, dat per match één rij heeft. Dat blijft een aggregaat:
    // er wordt geen enkele rij per speler voor gelezen of geschreven.
    const affectedDates = [
      ...new Set([
        ...drainedDays.map((entry) => entry.date),
        ...sessionRows.map((row) => String(row.created_at).slice(0, 10)),
      ]),
    ];
    if (affectedDates.length > 0) {
      await executor.query(
        `UPDATE ${qualified('daily_metrics')} AS d SET ` +
          'median_players_per_game = m.median_players, ' +
          'median_join_to_start_seconds = m.median_join_to_start ' +
          'FROM (SELECT (s.created_at AT TIME ZONE \'UTC\')::date AS day, ' +
          'percentile_cont(0.5) WITHIN GROUP (ORDER BY s.max_player_count) AS median_players, ' +
          'percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (s.started_at - s.created_at))) ' +
          '  FILTER (WHERE s.started_at IS NOT NULL) AS median_join_to_start ' +
          `FROM ${qualified('game_sessions')} AS s ` +
          "WHERE (s.created_at AT TIME ZONE 'UTC')::date = ANY($1::date[]) " +
          'GROUP BY 1) AS m ' +
          'WHERE d.date = m.day',
        [affectedDates]
      );
    }
  
    return { sessions: sessionRows.length, rounds: roundRows.length, days: drainedDays.length };
  }
  
  
  return writeBatch;
}
