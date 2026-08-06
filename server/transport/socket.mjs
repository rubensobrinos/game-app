// server/transport/socket.mjs
//
// De Socket.IO-transportlaag: LIJM tussen de al bestaande eventschema's
// (server/protocol/), de al bestaande domeinlogica (server/composition/) en
// een echte Socket.IO-server.
//
// GEEN EIGEN SCHEMA'S, GEEN EIGEN DOMEINLOGICA, GEEN TWEEDE MECHANISME:
//   - envelope/ack             → ../protocol/envelope.mjs
//   - clientevent-alfabet+rol  → ../protocol/client-events-dispatch.mjs
//   - idempotentie             → ../protocol/idempotency.mjs
//   - ontvangersregel          → ../protocol/server-events-recipients.mjs
//   - round:progress-frequentie→ ../protocol/throttle-round-progress.mjs
//   - foutcodes/`error`-payload→ ../protocol/error-codes.mjs, error-payload.mjs
//   - snapshotvorm             → ../protocol/snapshot-shape.mjs
//   - sessietoken-hash/verify  → ../protocol/auth-session.mjs (via ../composition/context.mjs)
//   - alle mutaties            → ../composition/{room,match}-lifecycle.mjs
//
// VIER HARDE REGELS IN DIT BESTAND
//
// 1. Na de handshake draagt geen enkel event nog een token (PROTOCOL.md
//    Basisregel 3). `socket.data` is de enige plek waar room/sessie/speler
//    staat; er wordt nergens een token uit een payload gelezen.
// 2. Interne foutcodes (besluit 12, `INVALID_PAUSE_STATE` en alles wat niet in
//    `ALL_ERROR_CODES` staat) verlaten deze laag NOOIT ongefilterd. Elke code
//    die naar een client gaat, gaat eerst door `toPublicErrorCode()`.
// 3. Tijden zijn absoluut in epoch-ms en komen uit de compositielaag. Er gaat
//    geen enkele timer-tick over de socket; er zijn alleen servertimers die op
//    een absoluut tijdstip één fasewissel doen.
// 4. Er wordt niets gelogd wat een token, een displaynaam of een stacktrace
//    bevat. `logSafe()` is de enige loguitgang, en die komt sinds INT4a uit
//    ../transport/safe-logger.mjs — REST en index.mjs gebruiken dezelfde
//    allowlist, zodat er geen tweede logmechanisme naast dit bestand staat.
//
// OPERATIONELE CONTEXT (INT4a deel 1) — dit is uitdrukkelijk GEEN doorlopend
// correlatie-ID. Elke logregel van deze laag draagt `roomId` (bekend meteen na
// de handshake, uit `socket.data`) plus het identificerende veld van de
// gebeurtenis: `sessionId` voor een verbinding, `actionId` voor een muterende
// clientactie, `eventId` voor een uitgaand serverevent. Daarmee is alles van
// één spelavond bij elkaar te zoeken en is binnen één clientactie de keten te
// volgen. WAT DIT NIET OPLOST: bij twintig joins in dezelfde room valt niet te
// bepalen wélk serverevent door wélk verzoek is veroorzaakt. Dat vraagt een
// echte `traceId` die van REST via de compositie naar de publicatie wordt
// doorgegeven — raakt interne signaturen en mogelijk publieke contracten, dus
// bewust niet hier gebouwd. Zie het handoff-item.
//
// REFACTOR 6 (docs/openstaand/refactor/6-socket.md, 1399 regels vóór de
// splitsing): de secties hieronder wonen nu verspreid over `socket/*.mjs`,
// precies langs de sectiekoppen die er al stonden — handshake.mjs, dat ook
// `lookupSessionByToken` meenam; publiceren.mjs voor `publish` en de
// gepersonaliseerde varianten; fasepomp.mjs voor de servertimers en
// `onPhaseEntered`; clientevents.mjs voor de grote schakelaar; snapshot.mjs
// voor de snapshot en de afgeleide tellingen die de compositielaag nog niet
// aanbiedt. Plus twee triviale, afhankelijkheidsloze bestanden (channels.mjs,
// phase.mjs) om te voorkomen dat de een van de ander moest importeren.
// `attachSocketServer` hieronder blijft de plek die alles bedraadt: elke
// fabriek krijgt precies de functies die ze van een andere naad nodig heeft
// (bijvoorbeeld `clientevents.mjs` krijgt `fasepomp.mjs`'s `scheduleAt` mee),
// en de "Transportstate"-Maps (`runtimeByRoom`, `ackCacheByRoom`,
// `throttleRecordsByRound`) blijven hier staan — dat was geen eigen naad in
// de opdracht, en meerdere naden lezen/schrijven dezelfde room-runtime.
// Geen gedragsverandering: dezelfde volgorde, dezelfde timing, dezelfde
// zeven exports.

import { Server as SocketIOServer } from 'socket.io';

import { ALL_CLIENT_EVENT_NAMES } from '../protocol/client-events-dispatch.mjs';
import { ALL_ERROR_CODES } from '../protocol/error-codes.mjs';
import { NOOP_METRICS } from './metrics.mjs';

import { NOOP_LOGGER, OUTCOME, createSafeLogger, errorLabel } from './safe-logger.mjs';

import { roomChannel, sessionChannel } from './socket/channels.mjs';
import { SUPPORTED_PROTOCOL_VERSIONS, lookupSessionByToken, attachHandshake } from './socket/handshake.mjs';
import { createPublisher } from './socket/publiceren.mjs';
import { createSnapshotHelpers } from './socket/snapshot.mjs';
import { createFasepomp } from './socket/fasepomp.mjs';
import { createClientEvents } from './socket/clientevents.mjs';

export { SUPPORTED_PROTOCOL_VERSIONS, lookupSessionByToken, roomChannel, sessionChannel };

/**
 * `actionId` die we gebruiken wanneer de client er zelf geen bruikbare
 * meestuurde. `buildAck`/`validateErrorPayload` eisen een niet-lege string,
 * dus een lege envelope mag niet in een lege `actionId` resulteren.
 */
const UNKNOWN_ACTION_ID = 'unknown';

/**
 * Fallback voor elke code die niet in `ALL_ERROR_CODES` staat — dezelfde keuze
 * die `match-lifecycle.mjs`'s `toWireCode` intern al maakt, hier herhaald
 * omdat de transportlaag de laatste poort naar de client is en ook codes
 * verwerkt die niet door die functie zijn gekomen.
 */
const FALLBACK_PUBLIC_CODE = 'INVALID_PHASE';

/**
 * Beeldt elke foutcode af op een code die de wire mag halen (besluit 12).
 *
 * `state-machine.js` stelt letterlijk: de adapter MOET interne codes afvangen
 * "voordat er iets naar een client gaat — nooit ongefilterd doorsturen". Dit
 * is die adapter. De toets is een allowlist tegen `ALL_ERROR_CODES` en géén
 * denylist van bekende interne namen, zodat een toekomstige tweede interne
 * code er niet stilletjes doorheen glipt.
 *
 * @param {unknown} code
 * @returns {import('../protocol/error-codes.mjs').ErrorCode}
 */
export function toPublicErrorCode(code) {
  return ALL_ERROR_CODES.has(code) ? code : FALLBACK_PUBLIC_CODE;
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Timers op absolute tijdstippen; injecteerbaar zodat tests niet op de klok wachten. */
const DEFAULT_SCHEDULER = Object.freeze({
  setTimer(delayMs, fn) {
    const handle = setTimeout(fn, Math.max(0, delayMs));
    if (typeof handle.unref === 'function') {
      handle.unref();
    }
    return handle;
  },
  clearTimer(handle) {
    clearTimeout(handle);
  },
});

/**
 * Koppelt de Socket.IO-server aan een bestaande HTTP-server.
 *
 * @param {import('node:http').Server} httpServer
 * @param {{
 *   context: import('../composition/context.mjs').Context,
 *   config?: {
 *     path?: string,
 *     logger?: { info: Function, warn: Function, error: Function },
 *     scheduler?: { setTimer: (delayMs: number, fn: () => void) => unknown, clearTimer: (handle: unknown) => void },
 *     socketIoOptions?: object,
 *   },
 * }} params
 * @returns {{ close(): Promise<void>, io: import('socket.io').Server }}
 */
export function attachSocketServer(httpServer, { context, config = {} } = {}) {
  if (httpServer === null || typeof httpServer !== 'object') {
    throw new TypeError('attachSocketServer: `httpServer` is verplicht.');
  }
  if (context === null || typeof context !== 'object' || typeof context.now !== 'function') {
    throw new TypeError('attachSocketServer: `context` moet de compositiecontext zijn (zie server/composition/context.mjs).');
  }

  const logger = config.logger ?? NOOP_LOGGER;
  const scheduler = config.scheduler ?? DEFAULT_SCHEDULER;
  // Stap 9: het register is optioneel; zonder metrics krijgt deze laag de
  // NOOP-variant, zodat er nergens een `if (metrics)` op het hete pad staat.
  const metrics = config.metrics ?? NOOP_METRICS;

  const io = new SocketIOServer(httpServer, {
    path: config.path ?? '/socket.io',
    serveClient: false,
    ...(config.socketIoOptions ?? {}),
  });

  let closed = false;

  // ───────────────────────────────────────────────────────────────────────────
  // Transportstate (per proces, nooit domeinstate)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Idempotentiecache per room: `actionId -> ack-envelope`. Voedt
   * `resolveDuplicateAction`; er wordt hier geen tweede mechanisme gebouwd.
   * Room-gescoped zodat twee rooms elkaars `actionId` nooit kunnen raken.
   * @type {Map<string, Map<string, object>>}
   */
  const ackCacheByRoom = new Map();

  /**
   * Throttle-administratie voor `round:progress`, in de `ThrottleStore`-vorm
   * die `throttle-round-progress.mjs` verwacht: `get(roundId)`.
   * @type {Map<string, { emittedAtMs: number[] }>}
   */
  const throttleRecordsByRound = new Map();
  const throttleStore = { get: (roundId) => throttleRecordsByRound.get(roundId) };

  /**
   * Looptijdstate per room: de lopende servertimer en wat we van de actieve
   * ronde weten. Uitsluitend transport: gaat verloren bij herstart en is nooit
   * de waarheid over het spel.
   * @type {Map<string, { timer: unknown, round: { roundId: string, roundNumber: number } | null, answeredPlayerIds: Set<string> }>}
   */
  const runtimeByRoom = new Map();

  function runtimeFor(roomId) {
    let runtime = runtimeByRoom.get(roomId);
    if (runtime === undefined) {
      runtime = { timer: null, round: null, answeredPlayerIds: new Set() };
      runtimeByRoom.set(roomId, runtime);
    }
    return runtime;
  }

  function ackCacheFor(roomId) {
    let cache = ackCacheByRoom.get(roomId);
    if (cache === undefined) {
      cache = new Map();
      ackCacheByRoom.set(roomId, cache);
    }
    return { get: (actionId) => cache.get(actionId), set: (actionId, ack) => cache.set(actionId, ack) };
  }

  /**
   * De enige loguitgang van deze laag. De allowlist en de vormtoetsen wonen in
   * `./safe-logger.mjs`, gedeeld met `rest.mjs` en `index.mjs` — vroeger stond
   * hier een eigen kopie, en dat is precies het tweede mechanisme dat
   * `AGENTS.md` verbiedt.
   */
  const logSafe = createSafeLogger({ logger, layer: 'socket' });

  // ───────────────────────────────────────────────────────────────────────────
  // De vijf naden, bedraad met precies wat ze van elkaar nodig hebben
  // ───────────────────────────────────────────────────────────────────────────

  const publisher = createPublisher({ io, context, logSafe, toPublicErrorCode });
  const snapshotHelpers = createSnapshotHelpers({
    context,
    logSafe,
    publish: publisher.publish,
    toPublicErrorCode,
    fallbackPublicCode: FALLBACK_PUBLIC_CODE,
  });
  const fasepomp = createFasepomp({
    context,
    logSafe,
    toPublicErrorCode,
    scheduler,
    publish: publisher.publish,
    emitToRoom: publisher.emitToRoom,
    runtimeByRoom,
    runtimeFor,
    throttleRecordsByRound,
    throttleStore,
    eligiblePlayerCount: snapshotHelpers.eligiblePlayerCount,
    isBeforeFirstRound: snapshotHelpers.isBeforeFirstRound,
  });
  const clientEvents = createClientEvents({
    io,
    context,
    logSafe,
    metrics,
    toPublicErrorCode,
    isPlainObject,
    unknownActionId: UNKNOWN_ACTION_ID,
    publish: publisher.publish,
    emitError: publisher.emitError,
    scheduleAt: fasepomp.scheduleAt,
    cancelTimer: fasepomp.cancelTimer,
    onPhaseEntered: fasepomp.onPhaseEntered,
    runStartRound: fasepomp.runStartRound,
    announceRoundEnded: fasepomp.announceRoundEnded,
    maybeEmitRoundProgress: fasepomp.maybeEmitRoundProgress,
    playerCountOf: snapshotHelpers.playerCountOf,
    sessionIdOfPlayer: snapshotHelpers.sessionIdOfPlayer,
    ackCacheFor,
    runtimeFor,
    sessionChannel,
  });

  attachHandshake(io, { context, logSafe, toPublicErrorCode, isPlainObject });

  // Gauges worden PAS bij het scrapen afgelezen, uit de echte adapterstate
  // (INT4b): handmatig op- en aftellen bij join, leave, kick en disconnect is
  // foutgevoelig — één gemiste callback laat de waarde permanent verkeerd staan.
  metrics.setGauge('rounda_active_sockets', () => io.sockets.sockets.size);
  metrics.setGauge('rounda_active_rooms', () => {
    const kamers = new Set();
    for (const socket of io.sockets.sockets.values()) {
      if (typeof socket.data?.roomId === 'string') kamers.add(socket.data.roomId);
    }
    return kamers.size;
  });

  io.on('connection', (socket) => {
    const { roomId, sessionId } = socket.data;
    socket.join(roomChannel(roomId));
    socket.join(sessionChannel(sessionId));
    logSafe('info', 'socket verbonden', { roomId, sessionId });
    metrics.increment('rounda_socket_connections_total');

    socket.onAny((eventName, ...args) => {
      const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      clientEvents.handleClientEvent(socket, eventName, args[0], ack).catch((error) => {
        logSafe('error', 'clientevent mislukt', {
          roomId,
          event: eventName,
          outcome: OUTCOME.SERVER_ERROR,
          reason: errorLabel(error),
        });
        clientEvents.respondFailure(socket, UNKNOWN_ACTION_ID, FALLBACK_PUBLIC_CODE, ack);
      });
    });

    socket.on('disconnect', (reason) => {
      logSafe('info', 'socket verbroken', { roomId, sessionId });
      // `reason` komt uit Socket.IO's eigen, kleine verzameling
      // ('transport close', 'ping timeout', ...) — geen vrije tekst en geen
      // gebruikersinvoer. Spaties eruit zodat het een nette labelwaarde is.
      metrics.increment('rounda_socket_disconnects_total', {
        reason: typeof reason === 'string' ? reason.replace(/\s+/g, '_') : 'unknown',
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Afsluiten
  // ───────────────────────────────────────────────────────────────────────────

  return {
    io,
    /** Voor `server/index.mjs`: een snapshot naar één sessie duwen na reconnect. */
    sendSnapshot: snapshotHelpers.sendSnapshot,
    /**
     * Voor `server/transport/rest.mjs`: `POST /games/join` en `POST /leave`
     * lopen NIET over de socket, terwijl `room:player-changed` wel room-breed
     * moet worden gemeld. Zonder deze ingang ziet een lobby een nieuwe joiner
     * nooit. `delta.type` is een van `join | leave | rename | kick`
     * (`server-events-room-lifecycle.mjs`).
     *
     * @param {string} roomId
     * @param {{ type: 'join' | 'leave' | 'rename' | 'kick', playerId: string }} delta
     */
    async broadcastPlayerChanged(roomId, delta) {
      await publisher.publish('room:player-changed', {
        roomId,
        payload: { playerCount: await snapshotHelpers.playerCountOf(roomId), delta },
      });
    },
    /**
     * Stopt de socketlaag: timers weg, sockets los, engine dicht.
     *
     * Sluit BEWUST de meegegeven `httpServer` niet — die is eigendom van
     * `server/index.mjs`. `io.close()` zou hem wél sluiten, dus die wordt hier
     * niet gebruikt.
     */
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      for (const roomId of runtimeByRoom.keys()) {
        fasepomp.cancelTimer(roomId);
      }
      runtimeByRoom.clear();
      ackCacheByRoom.clear();
      throttleRecordsByRound.clear();
      for (const socket of io.sockets.sockets.values()) {
        socket.disconnect(true);
      }
      io.removeAllListeners();
      io.engine.close();
      await new Promise((resolve) => { setImmediate(resolve); });
    },
  };
}

/** Alle clientevents die deze laag bedient — afgeleid, geen tweede lijst. */
export const WIRED_CLIENT_EVENTS = ALL_CLIENT_EVENT_NAMES;
