// Integratietests van de analytics-writer tegen een ECHTE PostgreSQL.
//
// UITSLUITEND tegen de wegwerpinstantie op 127.0.0.1:5434 (`compose.test.yml`),
// en uitsluitend in een schema dat deze run zelf aanmaakt en zelf opruimt. De
// afscherming zit in `test-postgres.mjs`: hardgecodeerde URL, geen
// env-override, controle op protocol/host/poort/database/gebruiker, en een
// drop die alleen `analytics_test_<pid>_<hex>` als doelwit accepteert.
//
// Draait de testinstantie niet, dan slaat deze suite zichzelf over MET REDEN.
// Nooit stilzwijgend groen:
//
//   docker compose -p aseso-game-test -f compose.test.yml up -d

import test, { after } from 'node:test';
import assert from 'node:assert/strict';

import { ANALYTICS_EVENTS, createAnalyticsWriter } from './analytics.mjs';
import { createPostgresConnection } from './connection.mjs';
import {
  ANALYTICS_TABLES,
  createTestSchema,
  dropTestSchema,
  probeTestPostgres,
  testConnectionConfig,
  uniqueSchemaName,
} from './test-postgres.mjs';

const ANALYTICS_PEPPER = 'analytics-pepper-32-bytes-minstens!!';
const SESSION_PEPPER = 'sessie-pepper-heel-anders-en-lang-genoeg';
const ROOM_A = 'room_Aa1Bb2Cc3Dd';
const ROOM_B = 'room_Zz9Yy8Xx7Ww';
const T0 = Date.UTC(2026, 6, 1, 12, 0, 0);

const probe = await probeTestPostgres();
const skip = probe.ok ? false : probe.reason;

const schema = uniqueSchemaName();
/** @type {ReturnType<typeof createPostgresConnection>|null} */
let connection = null;

if (probe.ok) {
  connection = createPostgresConnection(testConnectionConfig());
  await connection.connect();
  await createTestSchema(connection, schema);
}

after(async () => {
  if (!connection) return;
  const result = await dropTestSchema(connection, schema);
  if (!result.dropped) {
    // Luid, want een achtergebleven schema is rommel in andermans database.
    console.error(`OPRUIMEN MISLUKT voor schema ${schema}: ${result.reason}`);
  }
  await connection.close();
});

/** Leegt de drie tabellen tussen tests. Alleen binnen het eigen schema. */
async function truncate() {
  await connection.query(
    `TRUNCATE ${ANALYTICS_TABLES.map((table) => `${schema}.${table}`).join(', ')}`
  );
}

/** @param {object} [overrides] */
function createWriter(overrides = {}) {
  return createAnalyticsWriter({
    sink: connection,
    analyticsPepper: ANALYTICS_PEPPER,
    sessionPeppers: SESSION_PEPPER,
    schema,
    now: () => T0,
    ...overrides,
  });
}

/** Eén volledige match, gelijk aan de scriptversie in `analytics.test.mjs`. */
function playFullMatch(writer, { roomId = ROOM_A, matchSequence = 1, at = T0, rounds = 12 } = {}) {
  if (matchSequence === 1) writer.record(ANALYTICS_EVENTS.ROOM_CREATED, { at, roomId });
  writer.record(ANALYTICS_EVENTS.SHARE_OPENED, { at: at + 1, roomId, matchSequence, channel: 'qr' });
  writer.record(ANALYTICS_EVENTS.SHARE_OPENED, { at: at + 2, roomId, matchSequence, channel: 'link' });
  writer.record(ANALYTICS_EVENTS.PLAYER_JOINED, { at: at + 3, roomId, matchSequence, via: 'code', late: false, playerCount: 1 });
  writer.record(ANALYTICS_EVENTS.PLAYER_JOINED, { at: at + 4, roomId, matchSequence, via: 'qr', late: false, playerCount: 2 });
  writer.record(ANALYTICS_EVENTS.PLAYER_JOINED, { at: at + 5, roomId, matchSequence, via: 'link', late: false, playerCount: 3 });
  writer.record(ANALYTICS_EVENTS.MATCH_STARTED, {
    at: at + 30_000,
    roomId,
    matchSequence,
    language: 'nl',
    difficulty: 'normaal',
    pacing: 'host',
    mode: 'quiz',
    gameTypes: ['vlaggen', 'provincies'],
    totalRounds: rounds,
  });
  writer.record(ANALYTICS_EVENTS.PLAYER_JOINED, { at: at + 30_001, roomId, matchSequence, via: 'qr', late: true, playerCount: 4 });
  for (let round = 1; round <= rounds; round += 1) {
    writer.record(ANALYTICS_EVENTS.ROUND_FINISHED, {
      at: at + 30_100 + round,
      roomId,
      matchSequence,
      roundNumber: round,
      gameType: round % 2 === 0 ? 'provincies' : 'vlaggen',
      questionKey: `q-${round}`,
      answerCount: 4,
      correctCount: round % 3,
      averageAnswerMs: 2_500 + round,
      noAnswerCount: 0,
    });
  }
  writer.record(ANALYTICS_EVENTS.MATCH_FINISHED, { at: at + 60_000, roomId, matchSequence, finishedNormally: true });
}

test('de drie tabellen uit migrations/001-analytics.sql bestaan in het eigen schema', { skip }, async () => {
  const result = await connection.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name',
    [schema]
  );
  assert.deepEqual(
    result.rows.map((row) => row.table_name).sort(),
    [...ANALYTICS_TABLES].sort()
  );
});

test('een volledige match landt als één sessierij en twaalf ronderijen', { skip }, async () => {
  await truncate();
  const writer = createWriter();
  playFullMatch(writer, { rounds: 12 });
  const result = await writer.flush({ force: true });
  assert.equal(result.error, null);
  assert.deepEqual(result.written, { sessions: 1, rounds: 12, days: 1 });

  const sessions = await connection.query(`SELECT * FROM ${schema}.game_sessions`);
  assert.equal(sessions.rowCount, 1);
  const session = sessions.rows[0];
  assert.match(session.room_id_hash, /^[0-9a-f]{64}$/);
  assert.equal(session.match_sequence, 1);
  assert.deepEqual(session.game_types, ['vlaggen', 'provincies']);
  assert.equal(session.total_rounds, 12);
  assert.equal(session.max_player_count, 4);
  assert.equal(session.late_join_count, 1);
  assert.equal(session.joins_via_qr, 2);
  assert.equal(session.joins_via_link, 1);
  assert.equal(session.joins_via_code, 1);
  assert.equal(session.share_qr_open_count, 1);
  assert.equal(session.share_link_open_count, 1);
  assert.equal(session.finished_normally, true);
  assert.equal(session.rematch_of, null);

  const rounds = await connection.query(
    `SELECT * FROM ${schema}.round_stats WHERE game_session_id = $1 ORDER BY round_number`,
    [session.id]
  );
  assert.equal(rounds.rowCount, 12);
  assert.equal(rounds.rows[0].question_key, 'q-1');
  assert.equal(rounds.rows[0].answer_count, 4);
  assert.equal(rounds.rows[11].average_answer_ms, 2_512);
});

test('de opgeslagen room_id_hash is nergens de roomId zelf', { skip }, async () => {
  await truncate();
  const writer = createWriter();
  playFullMatch(writer, { rounds: 1 });
  await writer.flush({ force: true });

  const hit = await connection.query(
    `SELECT count(*)::int AS n FROM ${schema}.game_sessions WHERE room_id_hash LIKE '%room_%' OR room_id_hash = $1`,
    [ROOM_A]
  );
  assert.equal(hit.rows[0].n, 0);
});

test('dagtellers en medianen komen uit de aggregaten, niet uit rijen per speler', { skip }, async () => {
  await truncate();
  const writer = createWriter();
  playFullMatch(writer, { roomId: ROOM_A, matchSequence: 1, rounds: 2 });
  playFullMatch(writer, { roomId: ROOM_B, matchSequence: 1, at: T0 + 1_000, rounds: 2 });
  await writer.flush({ force: true });

  // `to_char` en niet `row.date`: node-pg levert een `date` als JS-Date in de
  // LOKALE tijdzone, waardoor `toISOString()` er een dag naast kan zitten. Wat
  // hier getest wordt is wat er in de kolom staat, niet hoe de driver hem
  // omrekent.
  const daily = await connection.query(
    `SELECT *, to_char(date, 'YYYY-MM-DD') AS date_text FROM ${schema}.daily_metrics`
  );
  assert.equal(daily.rowCount, 1);
  const row = daily.rows[0];
  assert.equal(row.date_text, '2026-07-01');
  assert.equal(row.rooms_created, 2);
  assert.equal(row.games_started, 2);
  assert.equal(row.games_finished, 2);
  assert.equal(row.players_joined, 8);
  assert.equal(row.rematches, 0);
  // Beide matches hadden vier spelers en 30 s lobbytijd; de mediaan is dus exact.
  assert.equal(Number(row.median_players_per_game), 4);
  assert.equal(Number(row.median_join_to_start_seconds), 29.999);
});

test('een rematch legt rematch_of vast en telt mee in de dagteller', { skip }, async () => {
  await truncate();
  const writer = createWriter();
  playFullMatch(writer, { matchSequence: 1, rounds: 1 });
  writer.record(ANALYTICS_EVENTS.REMATCH_CREATED, {
    at: T0 + 70_000,
    roomId: ROOM_A,
    matchSequence: 2,
    previousMatchSequence: 1,
  });
  playFullMatch(writer, { matchSequence: 2, at: T0 + 70_000, rounds: 1 });
  await writer.flush({ force: true });

  const rows = await connection.query(
    `SELECT id, match_sequence, rematch_of, room_id_hash FROM ${schema}.game_sessions ORDER BY match_sequence`
  );
  assert.equal(rows.rowCount, 2);
  assert.equal(rows.rows[1].rematch_of, rows.rows[0].id);
  assert.equal(rows.rows[1].room_id_hash, rows.rows[0].room_id_hash);

  const daily = await connection.query(`SELECT rematches FROM ${schema}.daily_metrics`);
  assert.equal(daily.rows[0].rematches, 1);
});

test('een herpoging na een verloren COMMIT-bevestiging dupliceert geen sessies of rondes', { skip }, async () => {
  await truncate();
  // Simuleert het gemeenste geval: de transactie COMMIT wél, maar de
  // bevestiging bereikt ons niet. De writer denkt dat het misging en probeert
  // dezelfde batch opnieuw.
  let loseAck = true;
  const flakySink = {
    async withTransaction(fn) {
      const value = await connection.withTransaction(fn);
      if (loseAck) {
        loseAck = false;
        throw Object.assign(new Error('verbinding weg na COMMIT'), { code: 'ECONNRESET' });
      }
      return value;
    },
  };

  const writer = createWriter({ sink: flakySink });
  playFullMatch(writer, { rounds: 3 });

  const first = await writer.flush({ force: true });
  assert.notEqual(first.error, null, 'de writer denkt dat het misging');
  const second = await writer.flush({ force: true });
  assert.equal(second.error, null);

  const sessions = await connection.query(`SELECT count(*)::int AS n FROM ${schema}.game_sessions`);
  const rounds = await connection.query(`SELECT count(*)::int AS n FROM ${schema}.round_stats`);
  assert.equal(sessions.rows[0].n, 1, 'ON CONFLICT (id) DO NOTHING plus vaste uuids: exactly-once');
  assert.equal(rounds.rows[0].n, 3);

  // EERLIJK OPGESCHREVEN: de dagtellers zijn optellingen en dus at-least-once.
  // Deze test legt dat vast in plaats van het te verzwijgen; zie de modulekop
  // van analytics.mjs, sectie LEVERINGSGARANTIE.
  const daily = await connection.query(`SELECT rooms_created FROM ${schema}.daily_metrics`);
  assert.equal(daily.rows[0].rooms_created, 2, 'dagtellers tellen de herpoging dubbel — bekend en vastgelegd');
});

test('twee vlak na elkaar geschreven batches op dezelfde dag tellen op in plaats van te overschrijven', { skip }, async () => {
  await truncate();
  const writer = createWriter();
  playFullMatch(writer, { roomId: ROOM_A, matchSequence: 1, rounds: 1 });
  await writer.flush({ force: true });
  playFullMatch(writer, { roomId: ROOM_B, matchSequence: 1, at: T0 + 5_000, rounds: 1 });
  await writer.flush({ force: true });

  const daily = await connection.query(`SELECT * FROM ${schema}.daily_metrics`);
  assert.equal(daily.rowCount, 1);
  assert.equal(daily.rows[0].rooms_created, 2);
  assert.equal(daily.rows[0].games_finished, 2);
  assert.equal(Number(daily.rows[0].median_players_per_game), 4);
});

test('een grote batch gaat in één transactie de deur uit', { skip }, async () => {
  await truncate();
  const writer = createWriter({ batchSize: 40 });
  for (let sequence = 1; sequence <= 40; sequence += 1) {
    playFullMatch(writer, { roomId: `room_bulk${String(sequence).padStart(4, '0')}`, matchSequence: 1, at: T0 + sequence, rounds: 5 });
  }
  const result = await writer.flush({ force: true });
  assert.equal(result.error, null);
  assert.deepEqual(result.written, { sessions: 40, rounds: 200, days: 1 });

  const counts = await connection.query(
    `SELECT (SELECT count(*) FROM ${schema}.game_sessions)::int AS sessions, (SELECT count(*) FROM ${schema}.round_stats)::int AS rounds`
  );
  assert.equal(counts.rows[0].sessions, 40);
  assert.equal(counts.rows[0].rounds, 200);
});

test('een match die doorloopt terwijl de verbinding gesloten is, komt binnen zodra hij terug is', { skip }, async () => {
  await truncate();
  // Een tweede verbinding die we mogen slopen zonder de rest van de suite te
  // raken. Na `close()` weigert hij elke transactie — precies zoals een
  // weggevallen Postgres.
  const disposable = createPostgresConnection(testConnectionConfig());
  await disposable.connect();
  await disposable.close();

  let live = false;
  const writer = createWriter({
    sink: {
      withTransaction: (fn) => (live ? connection : disposable).withTransaction(fn),
    },
  });

  playFullMatch(writer, { rounds: 4 });
  const down = await writer.flush({ force: true });
  assert.notEqual(down.error, null);
  assert.equal(writer.stats().buffered, 1);
  assert.equal(writer.stats().dropped.capacity, 0);

  live = true;
  const up = await writer.flush({ force: true });
  assert.equal(up.error, null);
  const counts = await connection.query(
    `SELECT (SELECT count(*) FROM ${schema}.game_sessions)::int AS sessions, (SELECT count(*) FROM ${schema}.round_stats)::int AS rounds`
  );
  assert.equal(counts.rows[0].sessions, 1);
  assert.equal(counts.rows[0].rounds, 4);
});
