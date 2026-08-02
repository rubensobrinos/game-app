// Tests voor de gebufferde analytics-writer (INTB3a).
//
// Deze suite RAAKT GEEN ENKELE DATABASE aan. Alle sinks zijn nep, behalve één
// test die met opzet naar 127.0.0.1:5499 verbindt — een poort waar niets
// luistert. Draait dus altijd, ook zonder Docker. Het echte schrijfwerk staat
// in `analytics-postgres.test.mjs`.
//
// GEEN ENKELE TEST HANGT VAN DE ECHTE KLOK AF: `now` is een geïnjecteerde,
// handmatig verzette klok en de events dragen hun eigen `at`.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYTICS_EVENTS,
  DROP_REASONS,
  assertAnalyticsPepper,
  computeRoomIdHash,
  createAnalyticsWriter,
} from './analytics.mjs';
import { createPostgresConnection } from './connection.mjs';
import {
  TEST_DATABASE_URL,
  UNREACHABLE_DATABASE_URL,
  assertOwnTestSchema,
  assertTestInstance,
} from './test-postgres.mjs';

const ANALYTICS_PEPPER = 'analytics-pepper-32-bytes-minstens!!';
const SESSION_PEPPER = 'sessie-pepper-heel-anders-en-lang-genoeg';
const SESSION_BUNDLE = Object.freeze({
  version: 'v2',
  peppers: Object.freeze({ v1: 'oude-sessie-pepper-ook-lang-genoeg', v2: SESSION_PEPPER }),
});

const ROOM_A = 'room_Aa1Bb2Cc3Dd';
const ROOM_B = 'room_Zz9Yy8Xx7Ww';
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 6, 1, 12, 0, 0);

const SESSION_COLUMN_SET = new Set([
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

const ROUND_COLUMN_SET = new Set([
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

/** Nepsink die de uitgevoerde SQL bewaart en op commando kan falen. */
function createFakeSink() {
  const transactions = [];
  let failuresLeft = 0;
  let hangForever = false;
  return {
    transactions,
    failTimes(count) {
      failuresLeft = count;
    },
    hang(value = true) {
      hangForever = value;
    },
    get calls() {
      return transactions.length;
    },
    async withTransaction(fn) {
      if (hangForever) {
        // Een database die de verbinding accepteert maar nooit antwoordt.
        return new Promise(() => {});
      }
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' });
      }
      const queries = [];
      const value = await fn({
        query: async (text, values) => {
          queries.push({ text, values });
          return { rows: [], rowCount: 0 };
        },
      });
      transactions.push(queries);
      return value;
    },
  };
}

/** @param {object} [overrides] */
function createWriter(overrides = {}) {
  return createAnalyticsWriter({
    analyticsPepper: ANALYTICS_PEPPER,
    sessionPeppers: SESSION_BUNDLE,
    now: () => T0,
    ...overrides,
  });
}

/**
 * Eén volledige match: room, joins, deel-opens, rondes, afronding.
 * @returns {number} het aantal `record()`-aanroepen
 */
function playFullMatch(writer, { roomId = ROOM_A, matchSequence = 1, at = T0, rounds = 12 } = {}) {
  let calls = 0;
  const record = (type, event) => {
    calls += 1;
    return writer.record(type, event);
  };

  if (matchSequence === 1) record(ANALYTICS_EVENTS.ROOM_CREATED, { at, roomId });
  record(ANALYTICS_EVENTS.SHARE_OPENED, { at: at + 1, roomId, matchSequence, channel: 'qr' });
  record(ANALYTICS_EVENTS.SHARE_OPENED, { at: at + 2, roomId, matchSequence, channel: 'link' });
  record(ANALYTICS_EVENTS.PLAYER_JOINED, { at: at + 3, roomId, matchSequence, via: 'code', late: false, playerCount: 1 });
  record(ANALYTICS_EVENTS.PLAYER_JOINED, { at: at + 4, roomId, matchSequence, via: 'qr', late: false, playerCount: 2 });
  record(ANALYTICS_EVENTS.PLAYER_JOINED, { at: at + 5, roomId, matchSequence, via: 'link', late: false, playerCount: 3 });
  record(ANALYTICS_EVENTS.MATCH_STARTED, {
    at: at + 6,
    roomId,
    matchSequence,
    language: 'nl',
    difficulty: 'normaal',
    pacing: 'host',
    mode: 'quiz',
    gameTypes: ['vlaggen', 'provincies'],
    totalRounds: rounds,
  });
  record(ANALYTICS_EVENTS.PLAYER_JOINED, { at: at + 7, roomId, matchSequence, via: 'qr', late: true, playerCount: 4 });
  for (let round = 1; round <= rounds; round += 1) {
    record(ANALYTICS_EVENTS.ROUND_FINISHED, {
      at: at + 10 + round,
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
  record(ANALYTICS_EVENTS.MATCH_FINISHED, { at: at + 100, roomId, matchSequence, finishedNormally: true });
  return calls;
}

// ==========================================================================
// DECISIONS #26 — aparte pepper
// ==========================================================================

test('DECISIONS #26: een analytics-pepper gelijk aan de sessiepepper wordt geweigerd', () => {
  assert.throws(
    () => createWriter({ analyticsPepper: SESSION_PEPPER }),
    (error) => error instanceof TypeError && /aparte/i.test(error.message)
  );
});

test('DECISIONS #26: ook een gelijke OUDE pepper uit de rotatiebundel wordt geweigerd', () => {
  assert.throws(
    () => createWriter({ analyticsPepper: 'oude-sessie-pepper-ook-lang-genoeg' }),
    /aparte/i
  );
});

test('DECISIONS #26: een losse sessiepepper-string wordt net zo goed vergeleken', () => {
  assert.throws(() => assertAnalyticsPepper(SESSION_PEPPER, SESSION_PEPPER), /aparte/i);
  assert.doesNotThrow(() => assertAnalyticsPepper(ANALYTICS_PEPPER, SESSION_PEPPER));
});

test('DECISIONS #26: een Buffer-pepper met dezelfde bytes als de sessiepepper wordt herkend', () => {
  assert.throws(() => assertAnalyticsPepper(Buffer.from(SESSION_PEPPER, 'utf8'), SESSION_BUNDLE), /aparte/i);
});

test('een ontbrekende of te korte analytics-pepper werpt bij het opstarten, niet later', () => {
  assert.throws(() => createWriter({ analyticsPepper: undefined }), /verplicht/i);
  assert.throws(() => createWriter({ analyticsPepper: 'kort' }), /minimaal 16 bytes/i);
});

test('zonder sessiepeppers kan de scheiding niet worden gecontroleerd en start de writer niet', () => {
  assert.throws(() => createWriter({ sessionPeppers: undefined }), /sessionPeppers is verplicht/i);
});

// ==========================================================================
// room_id_hash
// ==========================================================================

test('room_id_hash is 64 tekens hex en bevat de roomId niet', () => {
  const hash = computeRoomIdHash(ROOM_A, { pepper: ANALYTICS_PEPPER, at: T0 });
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes(ROOM_A));
  assert.ok(!hash.includes('room_'));
});

test('room_id_hash is stabiel binnen één tijdvak (een rematch blijft dezelfde room)', () => {
  const morning = computeRoomIdHash(ROOM_A, { pepper: ANALYTICS_PEPPER, at: T0 });
  const evening = computeRoomIdHash(ROOM_A, { pepper: ANALYTICS_PEPPER, at: T0 + 6 * 3_600_000 });
  assert.equal(morning, evening);
});

test('room_id_hash verschilt per tijdvak: dezelfde identifier in een ander tijdvak is niet te koppelen', () => {
  const today = computeRoomIdHash(ROOM_A, { pepper: ANALYTICS_PEPPER, at: T0 });
  const tomorrow = computeRoomIdHash(ROOM_A, { pepper: ANALYTICS_PEPPER, at: T0 + DAY });
  const nextMonth = computeRoomIdHash(ROOM_A, { pepper: ANALYTICS_PEPPER, at: T0 + 30 * DAY });
  assert.notEqual(today, tomorrow);
  assert.notEqual(today, nextMonth);
  assert.notEqual(tomorrow, nextMonth);
});

test('room_id_hash hangt aan de ANALYTICS-pepper: met de sessiepepper komt er iets anders uit', () => {
  const withAnalytics = computeRoomIdHash(ROOM_A, { pepper: ANALYTICS_PEPPER, at: T0 });
  const withSession = computeRoomIdHash(ROOM_A, { pepper: SESSION_PEPPER, at: T0 });
  assert.notEqual(withAnalytics, withSession);
});

test('room_id_hash weigert een zescijferige join-code: die coderuimte is uitputtelijk', () => {
  assert.throws(() => computeRoomIdHash('004821', { pepper: ANALYTICS_PEPPER, at: T0 }), /JOIN-CODE/);
  assert.throws(() => computeRoomIdHash('999999', { pepper: ANALYTICS_PEPPER, at: T0 }), /JOIN-CODE/);
});

test('room_id_hash weigert een te korte identifier', () => {
  assert.throws(() => computeRoomIdHash('abc', { pepper: ANALYTICS_PEPPER, at: T0 }), /tekens/);
});

test('twee verschillende rooms krijgen in hetzelfde tijdvak verschillende hashes', () => {
  const a = computeRoomIdHash(ROOM_A, { pepper: ANALYTICS_PEPPER, at: T0 });
  const b = computeRoomIdHash(ROOM_B, { pepper: ANALYTICS_PEPPER, at: T0 });
  assert.notEqual(a, b);
});

test('een event met een join-code als roomId wordt geweigerd en geteld', () => {
  const writer = createWriter();
  const result = writer.record(ANALYTICS_EVENTS.ROOM_CREATED, { at: T0, roomId: '004821' });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, DROP_REASONS.INVALID_FIELD);
  assert.equal(writer.stats().rejected, 1);
});

// ==========================================================================
// PRINCIPE 9 — geen databasewrite in het antwoordpad
// ==========================================================================

test('principe 9: record() raakt de sink nooit aan, ook niet bij een volledige match', () => {
  const sink = createFakeSink();
  const writer = createWriter({ sink });
  playFullMatch(writer);
  assert.equal(sink.calls, 0, 'record() mag geen enkele transactie starten');
});

test('principe 9: record() geeft geen Promise terug — er valt niets te awaiten', () => {
  const writer = createWriter({ sink: createFakeSink() });
  const result = writer.record(ANALYTICS_EVENTS.ROOM_CREATED, { at: T0, roomId: ROOM_A });
  assert.equal(typeof result, 'object');
  assert.equal(typeof (/** @type {any} */ (result).then), 'undefined');
  assert.deepEqual(result, { accepted: true });
});

test('principe 9: een volledige match loopt door terwijl de sink hangt en nooit antwoordt', async () => {
  const sink = createFakeSink();
  const writer = createWriter({ sink, flushTimeoutMs: 20 });

  // Zet een flush in gang die blijft hangen: de "database" accepteert wel maar
  // antwoordt nooit. Dit is het scenario dat een naïeve writer laat vastlopen.
  sink.hang(true);
  playFullMatch(writer, { matchSequence: 1 });
  const hangingFlush = writer.flush({ force: true });

  const started = process.hrtime.bigint();
  const calls = playFullMatch(writer, { roomId: ROOM_B, matchSequence: 1 });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  assert.equal(calls, 21);
  assert.ok(elapsedMs < 100, `een volledige match kostte ${elapsedMs.toFixed(1)} ms met een hangende database`);
  assert.equal(writer.stats().rejected, 0);

  // De hangende flush loopt zelf wel af, dankzij zijn eigen deadline.
  const result = await hangingFlush;
  assert.match(String(result.error), /overschreed/);
  assert.equal(writer.stats().flushFailures, 1);
  sink.hang(false);
});

test('principe 9: een volledige match loopt door tegen een ECHT onbereikbare Postgres', async () => {
  // 127.0.0.1:5499 — daar luistert niets. Geen mock: een echte socket die
  // geweigerd wordt. `assertTestInstance` wordt hier bewust NIET gebruikt;
  // dit adres is geen database en krijgt nooit een opdracht te zien.
  const connection = createPostgresConnection({ url: UNREACHABLE_DATABASE_URL, connectTimeoutMs: 500 });
  await assert.rejects(connection.connect(), /mislukt/);

  const writer = createWriter({ sink: connection, flushTimeoutMs: 2_000 });
  const started = process.hrtime.bigint();
  const calls = playFullMatch(writer, { roomId: ROOM_A, matchSequence: 1 });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  assert.equal(calls, 21);
  assert.ok(elapsedMs < 100, `een volledige match kostte ${elapsedMs.toFixed(1)} ms zonder database`);
  assert.equal(writer.stats().rejected, 0);
  assert.equal(writer.stats().accepted, 21);
  assert.equal(writer.stats().buffered, 1, 'de verzegelde match staat in de buffer, niet in het niets');

  const result = await writer.flush({ force: true });
  assert.notEqual(result.error, null);
  assert.equal(result.requeued, 1);
  assert.equal(writer.stats().buffered, 1, 'een mislukte flush verliest niets');
  assert.equal(writer.stats().dropped.capacity, 0);

  await connection.close();
});

test('analytics komen alsnog binnen zodra de database terug is', async () => {
  const sink = createFakeSink();
  const writer = createWriter({ sink });

  playFullMatch(writer, { roomId: ROOM_A, matchSequence: 1 });
  sink.failTimes(3);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await writer.flush({ force: true });
    assert.notEqual(result.error, null);
  }
  assert.equal(writer.stats().flushFailures, 3);
  assert.equal(writer.stats().buffered, 1);
  assert.equal(writer.stats().written.sessions, 0);

  const recovered = await writer.flush({ force: true });
  assert.equal(recovered.error, null);
  assert.equal(recovered.written.sessions, 1);
  assert.equal(recovered.written.rounds, 12);
  assert.equal(writer.stats().buffered, 0);
  assert.equal(writer.stats().dropped.capacity, 0, 'niets verloren tijdens de storing');
});

test('een mislukte flush zet backoff, en force negeert die', async () => {
  const sink = createFakeSink();
  let clock = T0;
  const writer = createWriter({ sink, now: () => clock, backoffBaseMs: 1_000 });
  playFullMatch(writer);

  sink.failTimes(1);
  await writer.flush({ force: true });
  assert.equal(writer.stats().failureStreak, 1);
  assert.equal(writer.stats().nextAttemptAt, clock + 1_000);

  const skipped = await writer.flush();
  assert.equal(skipped.skipped, 'backoff');

  clock += 1_000;
  const allowed = await writer.flush();
  assert.equal(allowed.skipped, null);
  assert.equal(writer.stats().failureStreak, 0);
  assert.equal(writer.stats().nextAttemptAt, 0);
});

test('flush() werpt nooit, ook niet als de sink synchroon ontploft', async () => {
  const writer = createWriter({
    sink: {
      withTransaction() {
        throw new Error('sink is stuk');
      },
    },
  });
  playFullMatch(writer);
  const result = await writer.flush({ force: true });
  assert.match(String(result.error), /sink is stuk/);
  assert.equal(writer.stats().buffered, 1);
});

// ==========================================================================
// Bufferbeleid — vol raken blokkeert niemand, en verliezen wordt geteld
// ==========================================================================

test('een volle buffer gooit de OUDSTE match weg, telt dat, en blokkeert de aanroeper niet', () => {
  const events = [];
  const writer = createWriter({ capacity: 3, onEvent: (event) => events.push(event) });

  for (let sequence = 1; sequence <= 5; sequence += 1) {
    playFullMatch(writer, { roomId: ROOM_A, matchSequence: sequence, rounds: 2 });
  }

  const stats = writer.stats();
  assert.equal(stats.buffered, 3);
  assert.equal(stats.dropped.capacity, 2, 'twee matches weggegooid');
  assert.equal(stats.dropped.rounds, 4, 'en hun ronderijen ook geteld');
  assert.equal(stats.sealed, 5);

  const remaining = writer.peekBuffer().map((unit) => unit.session.match_sequence);
  assert.deepEqual(remaining, [3, 4, 5], 'de nieuwste blijven staan, de oudste zijn weg');

  const dropped = events.filter((event) => event.type === 'dropped');
  assert.equal(dropped.length, 2);
  assert.equal(dropped[0].reason, DROP_REASONS.CAPACITY);
});

test('verlies tijdens een storing wordt geteld, niet verzwegen', async () => {
  const sink = createFakeSink();
  const writer = createWriter({ sink, capacity: 2, batchSize: 10 });

  playFullMatch(writer, { matchSequence: 1, rounds: 1 });
  playFullMatch(writer, { matchSequence: 2, rounds: 1 });
  sink.failTimes(1);
  await writer.flush({ force: true });
  assert.equal(writer.stats().buffered, 2, 'de mislukte batch staat weer vooraan');

  // Terwijl de database weg is, komen er nieuwe matches binnen.
  playFullMatch(writer, { matchSequence: 3, rounds: 1 });
  const stats = writer.stats();
  assert.equal(stats.buffered, 2);
  assert.equal(stats.dropped.capacity, 1);
  assert.equal(stats.dropped.rounds, 1);
  assert.deepEqual(
    writer.peekBuffer().map((unit) => unit.session.match_sequence),
    [2, 3]
  );
});

test('te veel openstaande matches verzegelt de oudste in plaats van de nieuwe te weigeren', () => {
  const writer = createWriter({ maxOpenSessions: 2 });
  for (let sequence = 1; sequence <= 4; sequence += 1) {
    writer.record(ANALYTICS_EVENTS.MATCH_STARTED, {
      at: T0 + sequence,
      roomId: ROOM_A,
      matchSequence: sequence,
      language: 'nl',
      difficulty: 'normaal',
      pacing: 'host',
      mode: 'quiz',
      gameTypes: ['vlaggen'],
      totalRounds: 5,
    });
  }
  const stats = writer.stats();
  assert.equal(stats.openSessions, 2);
  assert.equal(stats.dropped.openSessions, 2);
  assert.equal(stats.buffered, 2, 'de verdrongen matches zijn verzegeld, niet weggegooid');
  assert.equal(writer.peekBuffer()[0].session.finished_normally, false);
});

test('een match die te lang stil is wordt bij de flush verzegeld als niet-normaal afgelopen', async () => {
  const sink = createFakeSink();
  let clock = T0;
  const writer = createWriter({ sink, now: () => clock, sessionIdleMs: 60_000 });
  writer.record(ANALYTICS_EVENTS.MATCH_STARTED, {
    at: T0,
    roomId: ROOM_A,
    matchSequence: 1,
    language: 'nl',
    difficulty: 'normaal',
    pacing: 'host',
    mode: 'quiz',
    gameTypes: ['vlaggen'],
    totalRounds: 5,
  });
  assert.equal(writer.stats().openSessions, 1);

  clock = T0 + 120_000;
  await writer.flush({ force: true });
  assert.equal(writer.stats().openSessions, 0);
  assert.equal(writer.stats().sealedByIdle, 1);
  assert.equal(writer.stats().written.sessions, 1);
});

// ==========================================================================
// Privacy — aggregaten, geen rijen per speler
// ==========================================================================

test('een event met spelergegevens komt de buffer niet in en wordt geteld', () => {
  const writer = createWriter();
  const forbidden = [
    ['playerId', 'p_123'],
    ['displayName', 'PRIVACY-CANARY-NAAM'],
    ['sessionToken', 'tok_abcdef'],
    ['tokenHash', 'v1:deadbeef'],
    ['ip', '203.0.113.9'],
    ['userAgent', 'Mozilla/5.0'],
    ['scores', [{ playerId: 'p_1', score: 42 }]],
    ['answers', ['NL', 'BE']],
  ];

  for (const [key, value] of forbidden) {
    const result = writer.record(ANALYTICS_EVENTS.ROUND_FINISHED, {
      at: T0,
      roomId: ROOM_A,
      matchSequence: 1,
      roundNumber: 1,
      gameType: 'vlaggen',
      questionKey: 'q-1',
      answerCount: 3,
      correctCount: 2,
      averageAnswerMs: 1_200,
      noAnswerCount: 0,
      [key]: value,
    });
    assert.equal(result.accepted, false, `${key} had geweigerd moeten worden`);
    assert.equal(result.reason, DROP_REASONS.UNKNOWN_FIELD, `${key} hoort op de onbekend-veld-route`);
  }

  assert.equal(writer.stats().rejected, forbidden.length);
  assert.equal(writer.stats().accepted, 0);
  assert.equal(writer.stats().buffered, 0);
});

test('de rijen in de buffer hebben exact de kolommen uit migrations/001-analytics.sql', () => {
  const writer = createWriter();
  playFullMatch(writer, { rounds: 3 });
  const [unit] = writer.peekBuffer();

  assert.deepEqual(new Set(Object.keys(unit.session)), SESSION_COLUMN_SET);
  assert.equal(unit.rounds.length, 3);
  for (const row of unit.rounds) {
    assert.deepEqual(new Set(Object.keys(row)), ROUND_COLUMN_SET);
  }
});

test('round_stats telt en middelt; er is geen rij en geen veld per speler', () => {
  const writer = createWriter();
  playFullMatch(writer, { rounds: 12 });
  const [unit] = writer.peekBuffer();

  assert.equal(unit.rounds.length, 12, 'twaalf rondes leveren twaalf rijen op, niet twaalf maal het aantal spelers');

  // Elke waarde in een ronderij is een scalair. Een lijst of object is precies
  // de vorm waarin per-speler-detail zou binnenkomen; die kan er dus niet zijn.
  for (const row of unit.rounds) {
    for (const [column, value] of Object.entries(row)) {
      assert.ok(
        value === null || typeof value === 'string' || typeof value === 'number',
        `round_stats.${column} bevat een ${typeof value} — per-speler-detail hoort hier niet te passen`
      );
    }
  }

  const serialised = JSON.stringify(unit.rounds);
  for (const canary of ['playerId', 'player_id', 'displayName', 'name', 'token', 'score', 'answers']) {
    assert.ok(!serialised.includes(canary), `${canary} hoort niet in de weg te schrijven ronderijen te staan`);
  }
});

test('een match zonder enige speler-informatie levert nog steeds een geldige sessierij', () => {
  const writer = createWriter();
  writer.record(ANALYTICS_EVENTS.MATCH_FINISHED, {
    at: T0,
    roomId: ROOM_A,
    matchSequence: 1,
    finishedNormally: false,
  });
  const [unit] = writer.peekBuffer();
  assert.equal(unit.session.max_player_count, 0);
  assert.equal(unit.session.finished_normally, false);
  assert.equal(unit.session.started_at, null);
  assert.match(unit.session.room_id_hash, /^[0-9a-f]{64}$/);
});

// ==========================================================================
// Aggregatie
// ==========================================================================

test('de sessierij aggregeert joins, kanalen, deel-opens en rondes correct', () => {
  const writer = createWriter();
  playFullMatch(writer, { rounds: 12 });
  const [{ session }] = writer.peekBuffer();

  assert.equal(session.match_sequence, 1);
  assert.equal(session.language, 'nl');
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
  // `created_at` is het VROEGSTE event dat deze match zag (hier de eerste
  // share-open op T0+1), niet "nu" en niet het room-created-event: dat laatste
  // hoort bij de room, niet bij een specifieke match.
  assert.equal(session.created_at, new Date(T0 + 1).toISOString());
  assert.equal(session.finished_at, new Date(T0 + 100).toISOString());
});

test('een rematch verwijst met rematch_of naar de vorige sessie in dezelfde room', () => {
  const writer = createWriter();
  playFullMatch(writer, { matchSequence: 1, rounds: 2 });
  writer.record(ANALYTICS_EVENTS.REMATCH_CREATED, {
    at: T0 + 200,
    roomId: ROOM_A,
    matchSequence: 2,
    previousMatchSequence: 1,
  });
  playFullMatch(writer, { matchSequence: 2, at: T0 + 200, rounds: 2 });

  const [first, second] = writer.peekBuffer();
  assert.equal(second.session.rematch_of, first.session.id);
  assert.equal(
    second.session.room_id_hash,
    first.session.room_id_hash,
    'dezelfde room op dezelfde dag: dezelfde hash'
  );
});

test('dagtellers tellen rooms, starts, joins, finishes en rematches', async () => {
  const sink = createFakeSink();
  const writer = createWriter({ sink });
  playFullMatch(writer, { rounds: 1 });
  writer.record(ANALYTICS_EVENTS.REMATCH_CREATED, {
    at: T0 + 200,
    roomId: ROOM_A,
    matchSequence: 2,
    previousMatchSequence: 1,
  });

  await writer.flush({ force: true });
  const [queries] = sink.transactions;
  const daily = queries.find((query) => query.text.includes('daily_metrics') && query.text.startsWith('INSERT'));
  assert.ok(daily, 'er hoort een daily_metrics-upsert te zijn');
  // date, rooms_created, games_started, games_finished, players_joined, rematches
  assert.deepEqual(daily.values, ['2026-07-01', 1, 1, 1, 4, 1]);
  assert.match(daily.text, /ON CONFLICT \(date\) DO UPDATE SET/);
  assert.match(daily.text, /rooms_created = public\.daily_metrics\.rooms_created \+ EXCLUDED\.rooms_created/);
});

test('de flush schrijft alles in één transactie en is idempotent bij herhaling', async () => {
  const sink = createFakeSink();
  const writer = createWriter({ sink });
  playFullMatch(writer, { rounds: 2 });
  await writer.flush({ force: true });

  const [queries] = sink.transactions;
  const texts = queries.map((query) => query.text);
  assert.equal(sink.transactions.length, 1, 'één transactie voor de hele batch');
  assert.ok(texts.some((text) => text.includes('INSERT INTO public.game_sessions')));
  assert.ok(texts.some((text) => text.includes('INSERT INTO public.round_stats')));
  assert.ok(texts.every((text) => !text.includes('INSERT INTO public.game_sessions') || text.includes('ON CONFLICT (id) DO NOTHING')));
  assert.ok(texts.some((text) => text.includes('percentile_cont(0.5)')), 'medianen worden herberekend, niet opgeteld');
});

test('de uuids liggen bij het verzegelen vast, zodat een herpoging dezelfde rijen schrijft', async () => {
  const sink = createFakeSink();
  const writer = createWriter({ sink });
  playFullMatch(writer, { rounds: 2 });
  const before = writer.peekBuffer()[0];

  sink.failTimes(1);
  await writer.flush({ force: true });
  const after = writer.peekBuffer()[0];

  assert.equal(after.session.id, before.session.id);
  assert.deepEqual(
    after.rounds.map((row) => row.id),
    before.rounds.map((row) => row.id)
  );
});

test('close() verzegelt wat openstaat en schrijft het alsnog weg', async () => {
  const sink = createFakeSink();
  const writer = createWriter({ sink });
  writer.record(ANALYTICS_EVENTS.MATCH_STARTED, {
    at: T0,
    roomId: ROOM_A,
    matchSequence: 1,
    language: 'nl',
    difficulty: 'normaal',
    pacing: 'host',
    mode: 'quiz',
    gameTypes: ['vlaggen'],
    totalRounds: 5,
  });
  await writer.close();

  assert.equal(writer.stats().written.sessions, 1);
  const result = writer.record(ANALYTICS_EVENTS.ROOM_CREATED, { at: T0, roomId: ROOM_A });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, DROP_REASONS.CLOSED);
  assert.equal(writer.stats().dropped.closed, 1);
});

test('zonder sink gaat er niets stil verloren: de buffer loopt vol en telt', async () => {
  const writer = createWriter({ sink: null, capacity: 1 });
  playFullMatch(writer, { matchSequence: 1, rounds: 1 });
  playFullMatch(writer, { matchSequence: 2, rounds: 1 });
  const result = await writer.flush({ force: true });
  assert.equal(result.skipped, 'no-sink');
  assert.equal(writer.stats().buffered, 1);
  assert.equal(writer.stats().dropped.capacity, 1);
});

// ==========================================================================
// Validatie
// ==========================================================================

test('een onbekend eventtype wordt geteld, niet geworpen', () => {
  const writer = createWriter();
  const result = writer.record('answer-submitted', { at: T0, roomId: ROOM_A });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, DROP_REASONS.UNKNOWN_EVENT);
  assert.equal(writer.stats().rejected, 1);
});

test('record() werpt nooit, ook niet op vijandige invoer', () => {
  const writer = createWriter();
  const hostile = [
    [ANALYTICS_EVENTS.ROOM_CREATED, null],
    [ANALYTICS_EVENTS.ROOM_CREATED, undefined],
    [ANALYTICS_EVENTS.ROOM_CREATED, 'niet-een-object'],
    [ANALYTICS_EVENTS.ROOM_CREATED, []],
    [ANALYTICS_EVENTS.ROOM_CREATED, { at: -1, roomId: ROOM_A }],
    [ANALYTICS_EVENTS.ROOM_CREATED, { at: Number.NaN, roomId: ROOM_A }],
    [ANALYTICS_EVENTS.ROOM_CREATED, { at: T0, roomId: 42 }],
    [null, { at: T0, roomId: ROOM_A }],
    [{}, { at: T0, roomId: ROOM_A }],
  ];
  for (const [type, event] of hostile) {
    assert.doesNotThrow(() => writer.record(/** @type {any} */ (type), /** @type {any} */ (event)));
  }
  assert.equal(writer.stats().rejected, hostile.length);
  assert.equal(writer.stats().buffered, 0);
});

test('een ronde met meer goede dan gegeven antwoorden is onmogelijk en wordt geweigerd', () => {
  const writer = createWriter();
  const result = writer.record(ANALYTICS_EVENTS.ROUND_FINISHED, {
    at: T0,
    roomId: ROOM_A,
    matchSequence: 1,
    roundNumber: 1,
    gameType: 'vlaggen',
    questionKey: 'q-1',
    answerCount: 2,
    correctCount: 3,
    averageAnswerMs: 100,
    noAnswerCount: 0,
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, DROP_REASONS.INVALID_FIELD);
});

test('averageAnswerMs mag null zijn — een ronde waarin niemand antwoordde', () => {
  const writer = createWriter();
  writer.record(ANALYTICS_EVENTS.ROUND_FINISHED, {
    at: T0,
    roomId: ROOM_A,
    matchSequence: 1,
    roundNumber: 1,
    gameType: 'vlaggen',
    questionKey: 'q-1',
    answerCount: 0,
    correctCount: 0,
    averageAnswerMs: null,
    noAnswerCount: 4,
  });
  writer.record(ANALYTICS_EVENTS.MATCH_FINISHED, { at: T0 + 5, roomId: ROOM_A, matchSequence: 1, finishedNormally: true });
  const [unit] = writer.peekBuffer();
  assert.equal(unit.rounds[0].average_answer_ms, null);
  assert.equal(unit.rounds[0].no_answer_count, 4);
});

test('een ongeldige schemanaam wordt bij het opstarten geweigerd', () => {
  assert.throws(() => createWriter({ schema: 'public; DROP TABLE game_sessions' }), /identifier/);
  assert.throws(() => createWriter({ schema: 'Public' }), /identifier/);
});

// ==========================================================================
// Testafscherming — de guard van test-postgres.mjs
// ==========================================================================

test('de testguard accepteert uitsluitend de wegwerpinstantie op 5434', () => {
  assert.equal(assertTestInstance(TEST_DATABASE_URL), TEST_DATABASE_URL);
});

test('de testguard weigert productie: andere poort, host, database of gebruiker', () => {
  const refused = [
    ['postgresql://gameapp_test:test-only-not-a-secret@127.0.0.1:5432/gamestats_test', /poort 5434/],
    ['postgresql://gameapp_test:test-only-not-a-secret@db.example.com:5434/gamestats_test', /127\.0\.0\.1/],
    ['postgresql://gameapp_test:test-only-not-a-secret@127.0.0.1:5434/gamestats', /database gamestats_test/],
    ['postgresql://postgres:hunter2@127.0.0.1:5434/gamestats_test', /gebruiker gameapp_test/],
    ['redis://127.0.0.1:5434/gamestats_test', /protocol postgresql/],
    ['dit is geen url', /niet parsebaar/],
  ];
  for (const [url, pattern] of refused) {
    assert.throws(() => assertTestInstance(url), pattern, `had ${url} moeten weigeren`);
  }
});

test('de testguard laat alleen zelfgemaakte schemanamen toe als drop-doelwit', () => {
  assert.equal(assertOwnTestSchema('analytics_test_1234_abcdef01'), 'analytics_test_1234_abcdef01');
  for (const schema of ['public', 'information_schema', 'analytics', '', 'analytics_test_', 'pg_catalog']) {
    assert.throws(() => assertOwnTestSchema(schema), /WEIGERING/);
  }
});
