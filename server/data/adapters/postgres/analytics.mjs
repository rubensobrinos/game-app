// Asynchrone, gebufferde analytics-writer (INTB3a).
//
// ==========================================================================
// DE BELANGRIJKSTE EIS IS EEN NEGATIEVE
// ==========================================================================
// ARCHITECTURE.md principe 9: "Geen databasewrite in het kritieke antwoordpad.
// Events worden in-memory of via Redis gebufferd en in batches geaggregeerd."
//
// Daarom is `record()` SYNCHROON, geeft hij geen Promise terug, raakt hij de
// database niet aan, en WERPT HIJ NOOIT. Alles wat mis kan gaan — een
// onbekend eventtype, een volle buffer, een onbereikbare database — wordt
// geteld en via `onEvent` gemeld, nooit doorgegeven aan de aanroeper. Een
// speler die een antwoord instuurt mag niet merken dat Postgres weg is, en al
// helemaal niet wachten tot hij terug is.
//
// Wie hier ooit een `await` in `record()` zet, of `record()` `async` maakt,
// haalt principe 9 onderuit. De test "record() raakt de sink nooit aan" en de
// test "een volledige match loopt door terwijl Postgres onbereikbaar is"
// bewaken dat.
//
// ==========================================================================
// WAT ER IN DE DATABASE KOMT — EN VOORAL WAT NIET
// ==========================================================================
// DATA-MODEL.md "Wat niet persistent wordt opgeslagen": geen namen, geen
// sessietokens of tokenhashes, geen individuele scores of antwoordhistorie,
// geen IP's, geen user-agents, geen permanente speler-ID's, geen koppelingen
// tussen rooms van dezelfde persoon.
//
// Drie lagen houden dat vast, met opzet los van elkaar:
//   1. `EVENT_SCHEMAS` hieronder is een ALLOWLIST per eventtype. Een event met
//      een onbekende sleutel (`playerId`, `displayName`, `scores`, …) komt de
//      buffer niet eens in en wordt geteld als `rejected`.
//   2. De rijbouwers (`buildSessionRow`, `buildRoundRow`) kopiëren VELD VOOR
//      VELD. Er wordt nergens een event gespreid; een extra sleutel kan dus
//      ook per ongeluk niet meeliften.
//   3. `assertAllowedAnalyticsRecord()` uit `server/data/privacy-guard.js`
//      controleert vlak vóór het schrijven nog eens tegen de kolom-allowlist
//      per tabel.
//
// `round_stats` telt en middelt; er gaat één rij per RONDE in, nooit één per
// speler. De aanroeper levert de ronde al geaggregeerd aan (`answerCount`,
// `correctCount`, `averageAnswerMs`, `noAnswerCount`) — een lijst met
// individuele antwoorden wordt door laag 1 geweigerd.
//
// ==========================================================================
// DECISIONS #26 — EEN APARTE PEPPER, GEEN UITZONDERINGEN
// ==========================================================================
// "Analytics-identifiers gebruiken een aparte HMAC-pepper" — niet die van de
// sessietokens. De constructor EIST de sessiepepper(s) erbij en weigert te
// starten als de analytics-pepper daar ook maar één van gelijk is. Dat is
// bewust een harde fout bij het opstarten en geen waarschuwing: met dezelfde
// pepper wordt `room_id_hash` een orakel waarmee iemand met de analyticstabel
// én een tokenhash die twee aan elkaar kan knopen.
//
// ==========================================================================
// LEVERINGSGARANTIE — EERLIJK OPGESCHREVEN
// ==========================================================================
//   * `game_sessions` en `round_stats`: EXACTLY-ONCE bij herpogingen. De
//     uuid's worden bij het VERZEGELEN gegenereerd, niet bij het schrijven,
//     en beide inserts zijn `ON CONFLICT (id) DO NOTHING`.
//   * `daily_metrics`-tellers: AT-LEAST-ONCE. Het zijn optellingen; als een
//     COMMIT slaagt maar de bevestiging onderweg verdwijnt, telt de herpoging
//     die batch dubbel. Dat venster is klein en het alternatief (een
//     dedupliceer-tabel) staat niet in `migrations/001-analytics.sql` en die
//     mag niet worden uitgebreid. Bewust geaccepteerd, hier vastgelegd.
//   * Overloop: geteld, nooit stil. Zie `BUFFERBELEID` hieronder.

import { randomUUID } from 'node:crypto';

import { assertAllowedAnalyticsRecord } from '../../privacy-guard.js';
import {
  ANALYTICS_EVENTS, DROP_REASONS, MIN_ANALYTICS_PEPPER_BYTES,
  DEFAULT_CAPACITY, DEFAULT_MAX_OPEN_SESSIONS, DEFAULT_BATCH_SIZE,
  DEFAULT_FLUSH_INTERVAL_MS, DEFAULT_FLUSH_TIMEOUT_MS, DEFAULT_SESSION_IDLE_MS,
  DEFAULT_BACKOFF_BASE_MS, DEFAULT_BACKOFF_MAX_MS,
  assertAnalyticsPepper, computeRoomIdHash, validateEvent,
} from './analytics-contract.mjs';
import { DAY_COUNTERS, assertSchemaName, createBatchWriter } from './analytics-sql.mjs';

export { ANALYTICS_EVENTS, DROP_REASONS, MIN_ANALYTICS_PEPPER_BYTES, assertAnalyticsPepper, computeRoomIdHash };

// --------------------------------------------------------------------------
// De writer
// --------------------------------------------------------------------------

/**
 * @typedef {object} AnalyticsSink
 * @property {<T>(fn: (executor: { query: (text: string, values?: unknown[]) => Promise<any> }) => Promise<T>) => Promise<T>} withTransaction
 */

/**
 * Maakt de analytics-writer.
 *
 * @param {object} config
 * @param {AnalyticsSink|null} [config.sink] - iets met `withTransaction`, in
 *   productie `createPostgresConnection(...)`. `null` betekent: alleen
 *   bufferen. Ook dan gaat er niets stil verloren — de tellers lopen door.
 * @param {string|NodeJS.ArrayBufferView} config.analyticsPepper - DECISIONS #26.
 * @param {unknown} config.sessionPeppers - de sessietoken-pepper(s), UITSLUITEND
 *   om te controleren dat de analytics-pepper een andere is. Wordt nooit
 *   bewaard, gebruikt of gelogd.
 * @param {string} [config.schema='public']
 * @param {number} [config.capacity=500] - verzegelde matches in de buffer.
 * @param {number} [config.maxOpenSessions=200]
 * @param {number} [config.batchSize=50]
 * @param {number} [config.flushIntervalMs=5000]
 * @param {number} [config.flushTimeoutMs=10000]
 * @param {number} [config.sessionIdleMs=1800000]
 * @param {number} [config.backoffBaseMs=1000]
 * @param {number} [config.backoffMaxMs=60000]
 * @param {number} [config.epochMs=86400000] - tijdvak voor `room_id_hash`.
 * @param {() => number} [config.now=Date.now] - injecteerbare klok.
 * @param {((event: object) => void)|null} [config.onEvent]
 */
export function createAnalyticsWriter(config = {}) {
  const {
    sink = null,
    analyticsPepper,
    sessionPeppers,
    schema = 'public',
    capacity = DEFAULT_CAPACITY,
    maxOpenSessions = DEFAULT_MAX_OPEN_SESSIONS,
    batchSize = DEFAULT_BATCH_SIZE,
    flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
    flushTimeoutMs = DEFAULT_FLUSH_TIMEOUT_MS,
    sessionIdleMs = DEFAULT_SESSION_IDLE_MS,
    backoffBaseMs = DEFAULT_BACKOFF_BASE_MS,
    backoffMaxMs = DEFAULT_BACKOFF_MAX_MS,
    epochMs = 86_400_000,
    now = Date.now,
    onEvent = null,
  } = config;

  // Configuratiefouten werpen HIER, bij het opstarten — niet later, in het
  // antwoordpad. Dit is de enige plek in deze module die werpt bij normaal
  // gebruik.
  assertAnalyticsPepper(analyticsPepper, sessionPeppers);
  const schemaName = assertSchemaName(schema);
  /** @param {string} table */
  const qualified = (table) => `${schemaName}.${table}`;
  const writeBatch = createBatchWriter(qualified);
  for (const [name, value] of Object.entries({
    capacity,
    maxOpenSessions,
    batchSize,
    flushIntervalMs,
    flushTimeoutMs,
    sessionIdleMs,
    backoffBaseMs,
    backoffMaxMs,
  })) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new TypeError(`${name} moet een geheel getal >= 1 zijn, kreeg: ${JSON.stringify(value)}`);
    }
  }
  if (sink !== null && typeof sink?.withTransaction !== 'function') {
    throw new TypeError('sink moet null zijn of een object met withTransaction(fn).');
  }
  if (typeof now !== 'function') throw new TypeError('now moet een functie zijn.');
  if (onEvent !== null && typeof onEvent !== 'function') throw new TypeError('onEvent moet een functie zijn of null.');

  /** Open matches: matchKey -> aggregaat. */
  const open = new Map();
  /** Verzegelde matches, wachtend op de database. Oudste vooraan. */
  const outbox = [];
  /** Dagtellers: 'YYYY-MM-DD' -> { rooms_created, ... }. */
  const days = new Map();
  /** Laatste analytics-uuid per room, voor `rematch_of`. */
  const lastSessionIdByRoom = new Map();

  let closed = false;
  let flushing = false;
  let failureStreak = 0;
  let nextAttemptAt = 0;
  /** @type {ReturnType<typeof setInterval>|null} */
  let timer = null;

  const stats = {
    accepted: 0,
    rejected: 0,
    sealed: 0,
    sealedByIdle: 0,
    dropped: { capacity: 0, rounds: 0, openSessions: 0, closed: 0 },
    flushes: 0,
    flushFailures: 0,
    written: { sessions: 0, rounds: 0, days: 0 },
    lastErrorCode: null,
    lastErrorMessage: null,
  };

  /** @param {object} event */
  function emit(event) {
    if (!onEvent) return;
    try {
      onEvent(event);
    } catch {
      // Een kapotte observatiehaak mag de writer nooit omtrekken — en al
      // helemaal niet vanuit `record()`.
    }
  }

  /** @param {number} at */
  function dayKey(at) {
    return new Date(at).toISOString().slice(0, 10);
  }

  /** @param {number} at */
  function dayCounters(at) {
    const key = dayKey(at);
    let entry = days.get(key);
    if (!entry) {
      entry = { rooms_created: 0, games_started: 0, games_finished: 0, players_joined: 0, rematches: 0 };
      days.set(key, entry);
    }
    return entry;
  }

  /**
   * @param {string} roomId
   * @param {number} matchSequence
   */
  function matchKey(roomId, matchSequence) {
    return `${roomId} ${matchSequence}`;
  }

  /**
   * Haalt of opent het aggregaat van één match. Het aggregaat bevat GEEN
   * spelergegevens: alleen tellers, en de roomId die uitsluitend gebruikt
   * wordt om bij het verzegelen `room_id_hash` te berekenen. Hij verlaat het
   * proces nooit.
   *
   * `createdAt` is het VROEGSTE `at` dat deze match ooit zag, niet "nu". Het
   * eerste event van een match is in de praktijk een deel-open of een join in
   * de lobby, dus `created_at - started_at` is precies de lobbytijd die
   * `daily_metrics.median_join_to_start_seconds` bedoelt. Events komen niet
   * gegarandeerd op volgorde binnen, vandaar het minimum en niet "de eerste
   * die toevallig aankwam".
   * @param {string} roomId
   * @param {number} matchSequence
   * @param {number} at
   */
  function openSession(roomId, matchSequence, at) {
    const key = matchKey(roomId, matchSequence);
    let session = open.get(key);
    if (session) {
      session.touchedAt = at;
      if (at < session.createdAt) session.createdAt = at;
      return session;
    }

    if (open.size >= maxOpenSessions) {
      // Verlaten matches (host sluit de tab, room verloopt) blijven anders
      // eeuwig staan. Verzegel de oudste in plaats van de nieuwe te weigeren:
      // een oude open match is per definitie de minst waarschijnlijke om nog
      // af te lopen.
      const oldest = [...open.entries()].reduce((a, b) => (a[1].touchedAt <= b[1].touchedAt ? a : b));
      seal(oldest[0], { finishedNormally: false, finishedAt: null, reason: 'open-sessions' });
      stats.dropped.openSessions += 1;
      emit({ type: 'open-session-evicted', reason: DROP_REASONS.OPEN_SESSIONS, openSessions: open.size });
    }

    session = {
      roomId,
      matchSequence,
      createdAt: at,
      touchedAt: at,
      startedAt: null,
      language: null,
      difficulty: null,
      pacing: null,
      mode: null,
      gameTypes: null,
      totalRounds: null,
      maxPlayerCount: 0,
      lateJoinCount: 0,
      joinsViaQr: 0,
      joinsViaLink: 0,
      joinsViaCode: 0,
      shareQrOpenCount: 0,
      shareLinkOpenCount: 0,
      rematchOfSequence: null,
      rounds: [],
    };
    open.set(key, session);
    return session;
  }

  /**
   * Bouwt de `game_sessions`-rij VELD VOOR VELD. Er wordt hier nooit een
   * event of aggregaat gespreid — dat is laag 2 van de privacybescherming.
   * @param {object} session
   * @param {{ finishedAt: number|null, finishedNormally: boolean }} outcome
   */
  function buildSessionRow(session, outcome) {
    const id = randomUUID();
    const rematchOf =
      session.rematchOfSequence === null
        ? null
        : (lastSessionIdByRoom.get(matchKey(session.roomId, session.rematchOfSequence)) ?? null);

    return {
      id,
      room_id_hash: computeRoomIdHash(session.roomId, {
        pepper: analyticsPepper,
        at: session.createdAt,
        epochMs,
      }),
      match_sequence: session.matchSequence,
      created_at: new Date(session.createdAt).toISOString(),
      started_at: session.startedAt === null ? null : new Date(session.startedAt).toISOString(),
      finished_at: outcome.finishedAt === null ? null : new Date(outcome.finishedAt).toISOString(),
      language: session.language ?? 'unknown',
      difficulty: session.difficulty ?? 'unknown',
      pacing: session.pacing ?? 'unknown',
      mode: session.mode ?? 'unknown',
      game_types: session.gameTypes ?? [],
      total_rounds: session.totalRounds ?? session.rounds.length,
      max_player_count: session.maxPlayerCount,
      late_join_count: session.lateJoinCount,
      joins_via_qr: session.joinsViaQr,
      joins_via_link: session.joinsViaLink,
      joins_via_code: session.joinsViaCode,
      share_qr_open_count: session.shareQrOpenCount,
      share_link_open_count: session.shareLinkOpenCount,
      finished_normally: outcome.finishedNormally,
      rematch_of: rematchOf,
    };
  }

  /**
   * Bouwt één `round_stats`-rij, veld voor veld. Eén rij per RONDE, nooit per
   * speler: `answer_count`/`correct_count` zijn tellingen en
   * `average_answer_ms` is een gemiddelde. Er is geen kolom waarin een
   * individueel antwoord of een individuele score zou passen, en er wordt er
   * ook geen aangeleverd — `EVENT_SCHEMAS` laat zo'n veld niet toe.
   * @param {string} sessionId
   * @param {object} round
   */
  function buildRoundRow(sessionId, round) {
    return {
      id: round.id,
      game_session_id: sessionId,
      round_number: round.roundNumber,
      game_type: round.gameType,
      question_key: round.questionKey,
      answer_count: round.answerCount,
      correct_count: round.correctCount,
      average_answer_ms: round.averageAnswerMs,
      no_answer_count: round.noAnswerCount,
    };
  }

  /** Zet een verzegelde eenheid in de buffer; gooit bij overloop de OUDSTE weg. */
  function enqueue(unit) {
    while (outbox.length >= capacity) {
      const evicted = outbox.shift();
      stats.dropped.capacity += 1;
      stats.dropped.rounds += evicted.rounds.length;
      emit({
        type: 'dropped',
        reason: DROP_REASONS.CAPACITY,
        droppedSessions: stats.dropped.capacity,
        droppedRounds: stats.dropped.rounds,
        buffered: outbox.length,
      });
    }
    outbox.push(unit);
  }

  /**
   * Verzegelt een open match: uuid's vast, rijen gebouwd, buffer in. Vanaf hier
   * verandert er niets meer aan de rijen — dat is wat een herpoging
   * idempotent maakt.
   * @param {string} key
   * @param {{ finishedNormally: boolean, finishedAt: number|null, reason: string }} outcome
   */
  function seal(key, outcome) {
    const session = open.get(key);
    if (!session) return;
    open.delete(key);

    let sessionRow;
    let roundRows;
    // Laag 3: de kolom-allowlist van `privacy-guard.js`, vlak vóór de buffer.
    // Faalt die (of de hashberekening), dan is dat een programmeerfout in de
    // rijbouwers hierboven — maar ook die mag het antwoordpad niet raken en
    // mag `flush()` niet laten werpen: geteld, gemeld, en de rij verdwijnt in
    // plaats van dat hij het proces meeneemt.
    try {
      sessionRow = buildSessionRow(session, outcome);
      roundRows = session.rounds.map((round) => buildRoundRow(sessionRow.id, round));
      assertAllowedAnalyticsRecord('game_sessions', sessionRow);
      for (const row of roundRows) assertAllowedAnalyticsRecord('round_stats', row);
    } catch (error) {
      stats.rejected += 1;
      stats.lastErrorMessage = String(/** @type {Error} */ (error)?.message ?? error);
      emit({ type: 'privacy-guard-rejected', reason: stats.lastErrorMessage });
      return;
    }

    lastSessionIdByRoom.set(key, sessionRow.id);
    enqueue({ session: sessionRow, rounds: roundRows });
    stats.sealed += 1;
    if (outcome.reason === 'idle' || outcome.reason === 'open-sessions') stats.sealedByIdle += 1;
    emit({ type: 'sealed', reason: outcome.reason, buffered: outbox.length });
  }

  /** Verzegelt matches die te lang stil zijn. Alleen zo lekt de map niet. */
  function sealIdleSessions(atMs) {
    for (const [key, session] of [...open.entries()]) {
      if (atMs - session.touchedAt >= sessionIdleMs) {
        seal(key, { finishedNormally: false, finishedAt: null, reason: 'idle' });
      }
    }
  }

  /** Neemt de dagtellers uit de map en maakt hem leeg. */
  function drainDays() {
    const drained = [...days.entries()].map(([date, counters]) => ({ date, ...counters }));
    days.clear();
    return drained;
  }

  /** Zet niet-geschreven dagtellers terug, opgeteld bij wat er inmiddels bij kwam. */
  function restoreDays(drained) {
    for (const entry of drained) {
      let current = days.get(entry.date);
      if (!current) {
        current = { rooms_created: 0, games_started: 0, games_finished: 0, players_joined: 0, rematches: 0 };
        days.set(entry.date, current);
      }
      for (const counter of DAY_COUNTERS) current[counter] += entry[counter];
    }
  }

  /**
   * Zet niet-geschreven matches terug vooraan in de buffer. Loopt de buffer
   * daardoor over, dan geldt hetzelfde beleid: oudste weg, geteld.
   */
  function requeue(units) {
    outbox.unshift(...units);
    while (outbox.length > capacity) {
      const evicted = outbox.shift();
      stats.dropped.capacity += 1;
      stats.dropped.rounds += evicted.rounds.length;
      emit({
        type: 'dropped',
        reason: DROP_REASONS.CAPACITY,
        droppedSessions: stats.dropped.capacity,
        droppedRounds: stats.dropped.rounds,
        buffered: outbox.length,
      });
    }
  }

  /**
   * Race met een deadline. De onderliggende belofte loopt door — dat mag, hij
   * heeft zijn eigen `statement_timeout` — maar de flush-lock komt vrij.
   * @template T
   * @param {Promise<T>} promise
   * @param {number} ms
   */
  function withDeadline(promise, ms) {
    let timeoutHandle;
    const deadline = new Promise((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        const error = new Error(`analytics-flush overschreed ${ms} ms`);
        /** @type {any} */ (error).code = 'ANALYTICS_FLUSH_TIMEOUT';
        reject(error);
      }, ms);
      timeoutHandle.unref?.();
    });
    return Promise.race([promise, deadline]).finally(() => {
      clearTimeout(timeoutHandle);
      Promise.resolve(promise).catch(() => {});
    });
  }

  /**
   * Schrijft één batch in ÉÉN transactie: sessies, ronderijen, dagtellers en
   * de herberekende medianen. Alles of niets.
   * @param {{ query: (text: string, values?: unknown[]) => Promise<any> }} executor
   */
  return {
    /**
     * Neemt één event op. SYNCHROON, GOEDKOOP, WERPT NOOIT, RAAKT DE DATABASE
     * NIET AAN. Dit is de enige methode die op het antwoordpad mag staan.
     *
     * Alles wat mis is aan een event wordt geteld (`stats().rejected`) en
     * gemeld via `onEvent` — nooit geworpen. Zie de modulekop.
     *
     * @param {string} type - een van `ANALYTICS_EVENTS`
     * @param {Record<string, unknown>} event
     * @returns {{ accepted: boolean, reason?: string }}
     */
    record(type, event) {
      if (closed) {
        stats.dropped.closed += 1;
        emit({ type: 'rejected', eventType: type, reason: DROP_REASONS.CLOSED });
        return { accepted: false, reason: DROP_REASONS.CLOSED };
      }

      const problem = validateEvent(type, event);
      if (problem) {
        stats.rejected += 1;
        stats.lastErrorMessage = problem.detail;
        emit({ type: 'rejected', eventType: type, reason: problem.reason, detail: problem.detail });
        return { accepted: false, reason: problem.reason };
      }

      const at = /** @type {number} */ (event.at);
      const roomId = /** @type {string} */ (event.roomId);

      try {
        switch (type) {
          case ANALYTICS_EVENTS.ROOM_CREATED: {
            dayCounters(at).rooms_created += 1;
            break;
          }
          case ANALYTICS_EVENTS.MATCH_STARTED: {
            const session = openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            session.startedAt = at;
            session.language = /** @type {string} */ (event.language);
            session.difficulty = /** @type {string} */ (event.difficulty);
            session.pacing = /** @type {string} */ (event.pacing);
            session.mode = /** @type {string} */ (event.mode);
            session.gameTypes = [.../** @type {string[]} */ (event.gameTypes)];
            session.totalRounds = /** @type {number} */ (event.totalRounds);
            dayCounters(at).games_started += 1;
            break;
          }
          case ANALYTICS_EVENTS.PLAYER_JOINED: {
            const session = openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            const playerCount = /** @type {number} */ (event.playerCount);
            if (playerCount > session.maxPlayerCount) session.maxPlayerCount = playerCount;
            if (event.late === true) session.lateJoinCount += 1;
            if (event.via === 'qr') session.joinsViaQr += 1;
            else if (event.via === 'link') session.joinsViaLink += 1;
            else session.joinsViaCode += 1;
            dayCounters(at).players_joined += 1;
            break;
          }
          case ANALYTICS_EVENTS.SHARE_OPENED: {
            const session = openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            if (event.channel === 'qr') session.shareQrOpenCount += 1;
            else session.shareLinkOpenCount += 1;
            break;
          }
          case ANALYTICS_EVENTS.ROUND_FINISHED: {
            const session = openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            // uuid NU vastleggen, niet bij het schrijven: dat maakt een
            // herpoging na een mislukte flush idempotent.
            session.rounds.push({
              id: randomUUID(),
              roundNumber: /** @type {number} */ (event.roundNumber),
              gameType: /** @type {string} */ (event.gameType),
              questionKey: /** @type {string} */ (event.questionKey),
              answerCount: /** @type {number} */ (event.answerCount),
              correctCount: /** @type {number} */ (event.correctCount),
              averageAnswerMs: event.averageAnswerMs === undefined ? null : /** @type {number|null} */ (event.averageAnswerMs),
              noAnswerCount: /** @type {number} */ (event.noAnswerCount),
            });
            break;
          }
          case ANALYTICS_EVENTS.MATCH_FINISHED: {
            const key = matchKey(roomId, /** @type {number} */ (event.matchSequence));
            openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            seal(key, {
              finishedNormally: /** @type {boolean} */ (event.finishedNormally),
              finishedAt: at,
              reason: 'match-finished',
            });
            dayCounters(at).games_finished += 1;
            break;
          }
          case ANALYTICS_EVENTS.REMATCH_CREATED: {
            const session = openSession(roomId, /** @type {number} */ (event.matchSequence), at);
            session.rematchOfSequence = /** @type {number} */ (event.previousMatchSequence);
            dayCounters(at).rematches += 1;
            break;
          }
          default:
            break;
        }
      } catch (error) {
        // Onbereikbaar bij een gevalideerd event, maar principe 9 staat geen
        // "onbereikbaar" toe op het antwoordpad: tel en ga door.
        stats.rejected += 1;
        stats.lastErrorMessage = String(/** @type {Error} */ (error)?.message ?? error);
        emit({ type: 'record-failed', eventType: type, reason: stats.lastErrorMessage });
        return { accepted: false, reason: DROP_REASONS.INVALID_FIELD };
      }

      stats.accepted += 1;
      return { accepted: true };
    },

    /**
     * Schrijft maximaal één batch weg. WERPT NOOIT — een mislukte flush is
     * een resultaat, geen uitzondering; er staat immers geen aanroeper te
     * wachten die er iets mee kan.
     *
     * Bij een fout gaat de batch ONGEWIJZIGD terug in de buffer en loopt de
     * backoff op. Zodra de database terug is, komt alles alsnog binnen. Wat er
     * ondertussen door overloop uitvalt, staat in `stats().dropped`.
     *
     * @param {{ force?: boolean }} [options] - `force` negeert de backoff.
     * @returns {Promise<{ written: {sessions:number,rounds:number,days:number}|null, requeued: number, skipped: string|null, error: string|null }>}
     */
    async flush({ force = false } = {}) {
      const idle = { written: null, requeued: 0, error: null };
      if (closed) return { ...idle, skipped: 'closed' };
      if (flushing) return { ...idle, skipped: 'in-flight' };
      const atMs = now();
      if (!force && atMs < nextAttemptAt) return { ...idle, skipped: 'backoff' };

      flushing = true;
      try {
        sealIdleSessions(atMs);
        const units = outbox.splice(0, batchSize);
        const drainedDays = drainDays();
        if (units.length === 0 && drainedDays.length === 0) {
          return { ...idle, skipped: 'empty' };
        }

        if (!sink) {
          requeue(units);
          restoreDays(drainedDays);
          return { ...idle, requeued: units.length, skipped: 'no-sink' };
        }

        try {
          const written = await withDeadline(
            sink.withTransaction((executor) => writeBatch(executor, units, drainedDays)),
            flushTimeoutMs
          );
          stats.flushes += 1;
          stats.written.sessions += written.sessions;
          stats.written.rounds += written.rounds;
          stats.written.days += written.days;
          failureStreak = 0;
          nextAttemptAt = 0;
          emit({ type: 'flushed', ...written, buffered: outbox.length });
          return { written, requeued: 0, skipped: null, error: null };
        } catch (error) {
          requeue(units);
          restoreDays(drainedDays);
          stats.flushFailures += 1;
          failureStreak += 1;
          const code = /** @type {{ code?: unknown }} */ (error)?.code;
          stats.lastErrorCode = typeof code === 'string' ? code : null;
          stats.lastErrorMessage = String(/** @type {Error} */ (error)?.message ?? error);
          const backoff = Math.min(backoffMaxMs, backoffBaseMs * 2 ** (failureStreak - 1));
          nextAttemptAt = now() + backoff;
          emit({
            type: 'flush-failed',
            reason: stats.lastErrorCode ?? stats.lastErrorMessage,
            requeued: units.length,
            buffered: outbox.length,
            retryInMs: backoff,
          });
          return { written: null, requeued: units.length, skipped: null, error: stats.lastErrorMessage };
        }
      } finally {
        flushing = false;
      }
    },

    /**
     * Leegt de buffer in meerdere batches. Voor tests en voor een nette
     * afsluiting; niet voor het antwoordpad.
     * @param {{ maxBatches?: number }} [options]
     */
    async drain({ maxBatches = 100 } = {}) {
      const results = [];
      for (let batch = 0; batch < maxBatches; batch += 1) {
        const result = await this.flush({ force: true });
        results.push(result);
        if (result.skipped === 'empty' || result.error !== null || result.skipped === 'no-sink') break;
      }
      return results;
    },

    /** Start de achtergrondflush. `unref`: dit timertje houdt geen proces open. */
    start() {
      if (timer || closed) return;
      timer = setInterval(() => {
        // Bewust geen await: `flush()` werpt nooit, en de interval mag niet op
        // hem wachten.
        this.flush().catch(() => {});
      }, flushIntervalMs);
      timer.unref?.();
    },

    /** Stopt de achtergrondflush. De buffer blijft staan. */
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },

    /**
     * Verzegelt alles wat openstaat, probeert de buffer nog leeg te schrijven
     * en sluit daarna definitief. Na `close()` weigert `record()` (geteld).
     * @param {{ flushOnClose?: boolean }} [options]
     */
    async close({ flushOnClose = true } = {}) {
      this.stop();
      if (closed) return { buffered: outbox.length };
      for (const key of [...open.keys()]) {
        seal(key, { finishedNormally: false, finishedAt: null, reason: 'close' });
      }
      if (flushOnClose && sink) await this.drain();
      closed = true;
      return { buffered: outbox.length, droppedOnClose: outbox.length };
    },

    /**
     * Alles wat er te tellen valt, inclusief wat er verloren ging. Een kopie:
     * de aanroeper kan de interne tellers niet aanpassen.
     */
    stats() {
      return {
        buffered: outbox.length,
        openSessions: open.size,
        pendingDays: days.size,
        accepted: stats.accepted,
        rejected: stats.rejected,
        sealed: stats.sealed,
        sealedByIdle: stats.sealedByIdle,
        dropped: { ...stats.dropped },
        flushes: stats.flushes,
        flushFailures: stats.flushFailures,
        written: { ...stats.written },
        failureStreak,
        nextAttemptAt,
        closed,
        lastErrorCode: stats.lastErrorCode,
        lastErrorMessage: stats.lastErrorMessage,
      };
    },

    /** Alleen voor tests: de rijen zoals ze de database in zouden gaan. */
    peekBuffer() {
      return outbox.map((unit) => ({ session: { ...unit.session }, rounds: unit.rounds.map((row) => ({ ...row })) }));
    },
  };
}
