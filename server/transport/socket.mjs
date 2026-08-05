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

import { Server as SocketIOServer } from 'socket.io';

import { hashToken } from '../protocol/auth-session.mjs';
import {
  ALL_CLIENT_EVENT_NAMES,
  hasRequiredRole,
  resolveEventValidator,
} from '../protocol/client-events-dispatch.mjs';
import { buildAck, buildServerEnvelope, parseClientEnvelope } from '../protocol/envelope.mjs';
import { ALL_ERROR_CODES } from '../protocol/error-codes.mjs';
import { buildErrorPayload } from '../protocol/error-payload.mjs';
import { resolveDuplicateAction } from '../protocol/idempotency.mjs';
import { resolveRecipientRule } from '../protocol/server-events-recipients.mjs';
import { throttleRoundProgress } from '../protocol/throttle-round-progress.mjs';
import { assertNoActiveRoundAnswerLeak, validateSnapshotShape } from '../protocol/snapshot-shape.mjs';
import { NOOP_METRICS } from './metrics.mjs';

import { createId, verifySessionToken } from '../composition/context.mjs';
import {
  CONTENT_UNAVAILABLE,
  PHASE_RACE_LOST,
  advancePhase,
  buildSnapshot,
  endRound,
  finishMatch,
  getScoreboard,
  rematch,
  startMatch,
  startRound,
  submitAnswer,
} from '../composition/match-lifecycle.mjs';
import { kickPlayer, leaveRoom, recolorPlayer, renamePlayer, setRoomLocked, updateConfig } from '../composition/room-lifecycle.mjs';

import { isEligibleForRound } from '../rules/eligibility.js';

import {
  NOOP_LOGGER,
  OUTCOME,
  classifyOutcome,
  createSafeLogger,
  errorLabel,
} from './safe-logger.mjs';

/** De protocolversies die deze server accepteert (PROTOCOL.md, kop). */
export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze(new Set(['v1']));

/** Socket.IO-roomnaam per game-room. Prefix zodat hij nooit botst met socket.id. */
export function roomChannel(roomId) {
  return `room:${roomId}`;
}

/** Socket.IO-roomnaam per sessie — de drager van `single_session`-events. */
export function sessionChannel(sessionId) {
  return `sess:${sessionId}`;
}

/**
 * `actionId` die we gebruiken wanneer de client er zelf geen bruikbare
 * meestuurde. `buildAck`/`validateErrorPayload` eisen een niet-lege string,
 * dus een lege envelope mag niet in een lege `actionId` resulteren.
 */
const UNKNOWN_ACTION_ID = 'unknown';

/**
 * KEUZE — `PROTOCOL.md` §Foutcodes kent geen generieke "payload voldoet niet
 * aan het schema"-code voor de elf niet-`round:answer`-events; alleen
 * `INVALID_ANSWER_FORMAT` bestaat. De protocolvalidators geven daarom
 * `code: null` terug. Deze laag moet iets naar de client sturen en kiest
 * `INVALID_ANSWER_FORMAT` als dichtstbijzijnde gepubliceerde code voor elk
 * vormprobleem. Zie het handoff-item: er ontbreekt een `INVALID_PAYLOAD`.
 */
const MALFORMED_PAYLOAD_CODE = 'INVALID_ANSWER_FORMAT';

/**
 * Fallback voor elke code die niet in `ALL_ERROR_CODES` staat — dezelfde keuze
 * die `match-lifecycle.mjs`'s `toWireCode` intern al maakt, hier herhaald
 * omdat de transportlaag de laatste poort naar de client is en ook codes
 * verwerkt die niet door die functie zijn gekomen.
 */
const FALLBACK_PUBLIC_CODE = 'INVALID_PHASE';

/** State-machine-eventtypes die deze laag gebruikt (waarden uit state-machine.js). */
const HOST_PAUSE = 'HOST_PAUSE';
const HOST_RESUME = 'HOST_RESUME';
const HOST_NEXT = 'HOST_NEXT';
const TIMER_ELAPSED = 'TIMER_ELAPSED';

/** Fasewaarden uit ARCHITECTURE.md/state-machine.js. */
const PHASE = Object.freeze({
  LOBBY: 'LOBBY',
  COUNTDOWN: 'COUNTDOWN',
  ROUND_ACTIVE: 'ROUND_ACTIVE',
  ROUND_RESULT: 'ROUND_RESULT',
  SCOREBOARD: 'SCOREBOARD',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
});

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

/**
 * DE ENIGE PLEK DIE EEN SESSIETOKEN NAAR EEN SESSIE VERTAALT.
 *
 * Bewust één functie: op DM14 ligt een openstaand implementeerbaarheidsissue
 * (`docs/integration-plan/HANDOFF-INTB.md` INTB-9/INTB-10 — de sleutelcatalogus
 * heeft geen tokenhash-index, de Redis-adapter werpt op deze methode). Als de
 * signatuur straks wijzigt naar bijvoorbeeld `loadSessionByTokenHash(roomId,
 * tokenHash)`, hoeft alleen deze functie mee te veranderen; de rest van dit
 * bestand kent de poortmethode niet.
 *
 * Werkt tegen de POORT, niet tegen een aanname over Redis-sleutels:
 *   1. hash het token met `hashToken` uit ../protocol/auth-session.mjs — geen
 *      tweede hashmechanisme;
 *   2. zoek op via `context.store.loadSessionByTokenHash(tokenHash)`;
 *   3. verifieer daarna alsnog constant-time met `verifySessionToken` tegen de
 *      hash op het Session-document, zodat een index-hit nooit op zichzelf
 *      volstaat;
 *   4. onderscheid `SESSION_REVOKED` van `TOKEN_INVALID` — de poort houdt
 *      herroepen sessies bewust vindbaar (DM14).
 *
 * ALLE pepperversies uit `context.config.tokenPeppers.peppers` worden
 * geprobeerd, niet alleen de actieve: een index op de hash is anders
 * onverenigbaar met de pepper-rotatie die besluit 26 vraagt. Zie het
 * handoff-item.
 *
 * @param {import('../composition/context.mjs').Context} context
 * @param {unknown} sessionToken
 * @returns {Promise<{ ok: true, session: object } | { ok: false, code: string }>}
 */
export async function lookupSessionByToken(context, sessionToken) {
  if (typeof sessionToken !== 'string' || sessionToken.length === 0) {
    return { ok: false, code: 'TOKEN_INVALID' };
  }
  const peppers = context.config?.tokenPeppers?.peppers ?? {};
  for (const [version, pepper] of Object.entries(peppers)) {
    const tokenHash = hashToken(sessionToken, { version, pepper });
    const session = await context.store.loadSessionByTokenHash(tokenHash);
    if (session === null || session === undefined) {
      continue;
    }
    if (!verifySessionToken(context, sessionToken, session.tokenHash)) {
      continue;
    }
    if (session.revoked === true) {
      return { ok: false, code: 'SESSION_REVOKED' };
    }
    return { ok: true, session };
  }
  return { ok: false, code: 'TOKEN_INVALID' };
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

  /**
   * Logt een geweigerde fase-overgang met zijn INTERNE betekenis.
   *
   * WAAROM DIT NIET GEWOON `code: toPublicErrorCode(...)` MAG ZIJN (INT4a deel
   * 3): die functie beeldt `PHASE_RACE_LOST` af op `INVALID_PHASE`, dus in het
   * log stond een generieke fasefout waar in werkelijkheid een verwachte
   * verloren compare-and-set zat. Operationeel zijn dat twee verschillende
   * dingen — een `INVALID_PHASE` van een hostactie wijst op een achterhaald
   * scherm of een bug, een verloren race is normale gelijktijdigheid. Vandaar
   * ook het niveau: een verloren race is `info`, al het andere `warn`.
   *
   * De CLIENT verandert hier niets van: die krijgt nog steeds uitsluitend
   * `toPublicErrorCode()`, en deze paden sturen sowieso niets terug.
   *
   * @param {string} message
   * @param {string} roomId
   * @param {{ code?: unknown, conflict?: { expectedPhase?: string, actualPhase?: string } }} result
   * @param {'host' | 'timer' | 'recovery'} source
   */
  function logPhaseRejected(message, roomId, result, source) {
    // §A0: de contentbron kon geen vraag bouwen. Dat is geen race en geen
    // clientfout maar een defect aan onze kant — op `error`, mét de reden,
    // zodat het niet tussen de gewone fase-afwijzingen wegvalt.
    if (result.code === CONTENT_UNAVAILABLE) {
      logSafe('error', message, {
        outcome: OUTCOME.SERVER_ERROR,
        roomId,
        source,
        gameType: result.contentFailure?.gameType,
        reason: result.contentFailure?.reason,
      });
      return;
    }
    if (result.code === PHASE_RACE_LOST) {
      logSafe('info', message, {
        outcome: OUTCOME.PHASE_RACE_LOST,
        roomId,
        source,
        expectedPhase: result.conflict?.expectedPhase,
        actualPhase: result.conflict?.actualPhase,
      });
      return;
    }
    logSafe('warn', message, {
      outcome: classifyOutcome(result.code),
      roomId,
      source,
      code: toPublicErrorCode(result.code),
      expectedPhase: result.conflict?.expectedPhase,
      actualPhase: result.conflict?.actualPhase,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Servertimers — absolute tijdstippen, nooit ticks over de socket
  // ───────────────────────────────────────────────────────────────────────────

  function cancelTimer(roomId) {
    const runtime = runtimeByRoom.get(roomId);
    if (runtime?.timer != null) {
      scheduler.clearTimer(runtime.timer);
      runtime.timer = null;
    }
  }

  /**
   * Plant één fasewissel op een ABSOLUUT tijdstip dat de compositielaag heeft
   * teruggegeven (`countdownEndsAt`, `endsAt`, `phaseEndsAt`). Er wordt niets
   * per seconde verstuurd; de client rekent zelf met de absolute tijd.
   */
  function scheduleAt(roomId, atEpochMs, fn) {
    cancelTimer(roomId);
    if (typeof atEpochMs !== 'number' || !Number.isFinite(atEpochMs)) {
      return;
    }
    const runtime = runtimeFor(roomId);
    runtime.timer = scheduler.setTimer(atEpochMs - context.now(), () => {
      runtime.timer = null;
      // De promise wordt teruggegeven zodat een geïnjecteerde (test)scheduler
      // de afhandeling kan afwachten; de echte `setTimeout` negeert hem.
      return Promise.resolve(fn()).catch((error) => {
        logSafe('error', 'geplande fasewissel mislukt', {
          roomId,
          source: 'timer',
          outcome: OUTCOME.SERVER_ERROR,
          reason: errorLabel(error),
        });
      });
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Server → client
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * `eventId` is de identificatie van één uitgaand serverevent (INT4a deel 1).
   * Hij wordt hier gemaakt en meegegeven in plaats van diep in `envelopeFor`,
   * zodat de logregel dezelfde `eventId` kan noemen die de client ontvangt —
   * anders zou het log een ander id dragen dan de wire en niets correleren.
   */
  function nextEventId() {
    return createId(context, 'evt');
  }

  function envelopeFor(event, payload, eventId = nextEventId()) {
    const built = buildServerEnvelope(event, payload, context.now(), eventId);
    if (!built.ok) {
      throw new Error(`socket: kon envelope voor "${event}" niet bouwen (${built.reason})`);
    }
    return built.envelope;
  }

  /** `room`-events: naar de Socket.IO-room van deze game-room, nergens anders heen. */
  function emitToRoom(roomId, event, payload, eventId = nextEventId()) {
    io.to(roomChannel(roomId)).emit(event, envelopeFor(event, payload, eventId));
    return eventId;
  }

  /** `single_session`-events: alleen naar de sockets van die ene sessie. */
  function emitToSession(sessionId, event, payload, eventId = nextEventId()) {
    io.to(sessionChannel(sessionId)).emit(event, envelopeFor(event, payload, eventId));
    return eventId;
  }

  /**
   * `room_with_personal_fields`: één logisch event (één `eventId`, één
   * `serverTime`) maar per ontvanger aangevuld met diens eigen velden. De
   * persoonlijke velden gaan dus nooit room-breed de lucht in.
   */
  async function emitToRoomWithPersonalFields(roomId, event, basePayload, personalByPlayerId, fallbackPersonal, eventId = nextEventId()) {
    const sockets = await io.in(roomChannel(roomId)).fetchSockets();
    const serverTime = context.now();
    for (const socket of sockets) {
      const playerId = socket.data?.playerId ?? null;
      const personal = (playerId !== null ? personalByPlayerId.get(playerId) : undefined) ?? fallbackPersonal;
      const built = buildServerEnvelope(event, { ...basePayload, ...personal }, serverTime, eventId);
      if (built.ok) {
        socket.emit(event, built.envelope);
      }
    }
    return eventId;
  }

  /**
   * Verstuurt een serverevent volgens de ontvangersregel uit
   * `server-events-recipients.mjs` — die tabel is de bron, niet een tweede
   * lijstje hier.
   */
  async function publish(event, { roomId, sessionId = null, payload, personalByPlayerId, fallbackPersonal }) {
    const rule = resolveRecipientRule(event);
    const eventId = nextEventId();
    if (rule === 'single_session') {
      emitToSession(sessionId, event, payload, eventId);
    } else if (rule === 'room_with_personal_fields') {
      await emitToRoomWithPersonalFields(roomId, event, payload, personalByPlayerId ?? new Map(), fallbackPersonal ?? {}, eventId);
    } else if (rule === 'room') {
      emitToRoom(roomId, event, payload, eventId);
    } else {
      throw new Error(`socket: onbekend serverevent "${event}" — geen ontvangersregel`);
    }
    // De identificatie van één uitgaand serverevent. Bewust ná het verzenden:
    // een regel over een event dat niet de deur uit ging is misleidend.
    logSafe('info', 'serverevent verstuurd', { roomId, sessionId, event, eventId });
  }

  /** `error` gaat naar precies één sessie (tabel §Server → client events). */
  function emitError(socket, actionId, code) {
    const payload = buildErrorPayload(toPublicErrorCode(code), {});
    socket.emit('error', envelopeFor('error', { actionId, ...payload }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Afgeleide gegevens die de compositielaag (nog) niet aanbiedt
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * De noemer van `round:progress`. GAT — geen compositiefunctie levert live
   * voortgangstellers; `endRound()` berekent ze pas ná afloop. Hier wordt
   * daarom exact dezelfde predicaat-combinatie gebruikt die `endRound()`
   * gebruikt (`kicked/left` eruit, dan `isEligibleForRound`), zodat er geen
   * tweede regel ontstaat. Zie het handoff-item.
   */
  async function eligiblePlayerCount(roomId, roundNumber) {
    const players = await context.store.listPlayers(roomId);
    return players.filter(
      (player) => player.kicked !== true
        && player.left !== true
        && isEligibleForRound(player.eligibleFromRound, roundNumber),
    ).length;
  }

  /** Actueel aantal spelers in de room, via de snapshot — geen eigen telregel. */
  async function playerCountOf(roomId) {
    const snapshot = await buildSnapshot(context, { roomId });
    return snapshot.ok ? snapshot.value.room.playerCount : 0;
  }

  /**
   * Staat deze room vóór de eerste ronde van de huidige match? (§A2)
   *
   * Uit PERSISTENTE state, bewust niet uit `runtimeFor(roomId)`: runtime is
   * leeg na een serverherstart en wordt tussen twee rondes door leeggemaakt,
   * dus elk antwoord dat daarop leunt is fout zodra het ertoe doet.
   *
   * Bij twijfel `true` — dan telt de server af. Een overbodige aftelling van
   * drie seconden is hinderlijk; een overgeslagen aftelling betekent dat de
   * groep de vraag mist.
   */
  async function isBeforeFirstRound(roomId) {
    try {
      const room = await context.store.loadRoom(roomId);
      if (room === null || room.currentMatchId === null) return true;
      const match = await context.store.loadMatch(roomId, room.currentMatchId);
      if (match === null || !Array.isArray(match.roundIds)) return true;
      return match.roundIds.length === 0;
    } catch {
      return true;
    }
  }

  /** playerId → sessionId, nodig om `session:kicked` aan één sessie te richten. */
  async function sessionIdOfPlayer(roomId, playerId) {
    const players = await context.store.listPlayers(roomId);
    return players.find((player) => player.id === playerId)?.sessionId ?? null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // De fasepomp: één compositie-aanroep per overgang, geen tweede fasetabel
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Reageert op de fase waarin de room zojuist is beland. Kiest géén
   * bestemming zelf — dat doet `resolveNextPhase()` binnen `advancePhase()`;
   * deze functie bepaalt alleen welk serverevent erbij hoort en wanneer de
   * volgende, timergedreven overgang gepland moet worden.
   */
  async function onPhaseEntered(roomId, phase, phaseEndsAt, { reason = 'flow', roundEndsAt = null } = {}) {
    if (phase === PHASE.COUNTDOWN) {
      // Feedbackronde 3 (4 aug): tússen rondes geen 3 seconden stilte — de
      // aftelbalk op scherm 5 belooft "volgende vraag" en de client hoort
      // tijdens COUNTDOWN niets (er bestaat geen tussenronde-event), dus die
      // hing zichtbaar.
      //
      // §A2 (5 aug): de eerste versie hiervan las `runtime.round`, maar
      // `runEndRound()` zet dat veld op null vóórdat de volgende COUNTDOWN
      // begint. Het was dus bij élke COUNTDOWN leeg en de directe start werd
      // nooit genomen — dode code, groen in de suite. De vraag "is dit de
      // opening van de match?" wordt nu beantwoord uit PERSISTENTE state
      // (`match.roundIds`), die een serverherstart en een lege runtime
      // overleeft.
      //
      // Twee gevallen houden hun echte 3-2-1:
      //   - de opening van een match (nog geen ronde gespeeld);
      //   - hervatten na een pauze — de groep moet weer bij het scherm zitten.
      const opensMatch = await isBeforeFirstRound(roomId);
      if (opensMatch || reason === 'resume') {
        scheduleAt(roomId, phaseEndsAt, () => runStartRound(roomId));
        return;
      }
      await runStartRound(roomId);
      return;
    }
    // ROND HERVATTEN (5 aug 2026, R2-7). Zonder deze tak plande niemand het
    // einde van de ronde opnieuw in nadat de host had gepauzeerd: `game:pause`
    // doet `cancelTimer`, en `onPhaseEntered` kende ROUND_ACTIVE niet. De
    // match bleef daarna hangen — de ronde eindigde nooit meer.
    //
    // `roundEndsAt` komt uit de compositie (die schrijft de nieuwe deadline op
    // het Round-document); ontbreekt hij, dan is dit geen hervatting en valt er
    // niets te plannen.
    if (phase === PHASE.ROUND_ACTIVE) {
      if (typeof roundEndsAt === 'number') {
        scheduleAt(roomId, roundEndsAt, () => runEndRound(roomId));
      }
      return;
    }
    if (phase === PHASE.SCOREBOARD) {
      const scoreboard = await getScoreboard(context, { roomId });
      if (scoreboard.ok) {
        await publish('scoreboard:updated', {
          roomId,
          payload: { top: scoreboard.value.top, self: {} },
          personalByPlayerId: new Map(
            scoreboard.value.top.map((entry) => [entry.playerId, { self: { playerId: entry.playerId, score: entry.score, position: entry.rank } }]),
          ),
          fallbackPersonal: { self: {} },
        });
      }
      // Bij host-tempo is dit de ENE hostactie-fase (besluit 1): niets plannen,
      // wachten op `game:next`. Bij auto-tempo levert de compositielaag een
      // `phaseEndsAt` en loopt het door.
      if (phaseEndsAt !== null) {
        scheduleAt(roomId, phaseEndsAt, () => runAdvanceOnTimer(roomId));
      }
      return;
    }
    if (phase === PHASE.ROUND_RESULT) {
      scheduleAt(roomId, phaseEndsAt, () => runAdvanceOnTimer(roomId));
      return;
    }
    if (phase === PHASE.FINISHED) {
      cancelTimer(roomId);
      await publishFinished(roomId);
    }
  }

  /** COUNTDOWN → ROUND_ACTIVE, met `round:started` room-breed. */
  async function runStartRound(roomId) {
    const result = await startRound(context, { roomId });
    if (!result.ok) {
      logPhaseRejected('startRound geweigerd', roomId, result, 'timer');
      return;
    }
    const runtime = runtimeFor(roomId);
    runtime.round = { roundId: result.value.roundId, roundNumber: result.value.roundNumber };
    runtime.answeredPlayerIds = new Set();
    throttleRecordsByRound.delete(result.value.roundId);

    // Exact de tien velden die `validateRoundStartedPayload` toestaat; de
    // compositielaag levert ze al als allowlist (besluit 20: geen correct
    // antwoord in `round:started`).
    await publish('round:started', { roomId, payload: { ...result.value } });

    // Fase 4 (autoReveal, docs/openstaand/antwoord-automatisch-tonen.md): staat
    // "Antwoord automatisch tonen" uit, dan wordt `runEndRound` NIET getimed
    // ingepland. De ronde houdt gewoon zijn `endsAt` — spelers zien hun timer
    // aftellen en `submitAnswer` sluit vanzelf op de deadline (dat gaat via
    // dezelfde deadline+grace-toets als altijd, hier niets aan gewijzigd) —
    // maar het juiste antwoord verlaat de server pas bij `game:reveal`. Geen
    // aparte fase, geen weggelaten `phaseEndsAt`: gewoon een timer die er nooit
    // komt totdat de host 'm zelf triggert.
    const room = await context.store.loadRoom(roomId);
    if (room !== null && room.config.autoReveal === false) {
      return;
    }
    scheduleAt(roomId, result.value.endsAt, () => runEndRound(roomId));
  }

  /**
   * Zendt `round:ended` uit en plant de volgende fase — het deel van
   * `endRound()`'s afhandeling dat ná een geslaagde compositie-aanroep
   * gebeurt, ongeacht WANNEER die aanroep kwam (timer, of `game:reveal`).
   * Losgetrokken van `runEndRound` zodat `game:reveal` (die zelf ackt) de
   * compositie-aanroep vóór de ack kan doen en dit deel — net als elke andere
   * hostactie — pas ná de ack via `after` kan laten lopen.
   */
  async function announceRoundEnded(roomId, value) {
    const personal = new Map(
      value.results.map((entry) => [entry.playerId, {
        ownPoints: entry.points,
        ownCorrect: entry.correct,
        ownResponseTimeMs: entry.responseTimeMs,
      }]),
    );
    await publish('round:ended', {
      roomId,
      payload: {
        matchId: value.matchId,
        roundId: value.roundId,
        roundNumber: value.roundNumber,
        totalRounds: value.totalRounds,
        correctAnswer: value.correctAnswer,
        distribution: value.distribution,
        answeredCount: value.answeredCount,
        eligiblePlayerCount: value.eligiblePlayerCount,
      },
      personalByPlayerId: personal,
      fallbackPersonal: { ownPoints: 0, ownCorrect: false, ownResponseTimeMs: null },
    });

    const runtime = runtimeFor(roomId);
    runtime.round = null;
    await onPhaseEntered(roomId, value.phase, value.phaseEndsAt);
  }

  /** ROUND_ACTIVE → ROUND_RESULT, met `round:ended` inclusief persoonlijke velden. */
  async function runEndRound(roomId) {
    const result = await endRound(context, { roomId });
    if (!result.ok) {
      logPhaseRejected('endRound geweigerd', roomId, result, 'timer');
      return;
    }
    await announceRoundEnded(roomId, result.value);
  }

  /** Elke timergedreven overgang die geen ronde opent of sluit. */
  async function runAdvanceOnTimer(roomId) {
    const result = await advancePhase(context, { roomId, event: { type: TIMER_ELAPSED } });
    if (!result.ok) {
      logPhaseRejected('timerovergang geweigerd', roomId, result, 'timer');
      return;
    }
    await onPhaseEntered(roomId, result.value.phase, result.value.phaseEndsAt);
  }

  /** `game:finished`: podium room-breed, eigen samenvatting per speler. */
  async function publishFinished(roomId) {
    const result = await finishMatch(context, { roomId });
    if (!result.ok) {
      logPhaseRejected('finishMatch geweigerd', roomId, result, 'timer');
      return result;
    }
    const personal = new Map(result.value.standings.map((entry) => [entry.playerId, { self: entry }]));
    await publish('game:finished', {
      roomId,
      payload: {
        matchId: result.value.matchId,
        sequence: result.value.sequence,
        finishedAt: result.value.finishedAt,
        podium: result.value.podium,
      },
      personalByPlayerId: personal,
      fallbackPersonal: { self: { playerId: null } },
    });
    return result;
  }

  /**
   * `round:progress`, maximaal tweemaal per seconde per ronde
   * (`throttle-round-progress.mjs`, matrixrij 13). De beslissing zit in die
   * module; hier staat alleen het opslaan van het bijgewerkte record en het
   * daadwerkelijke verzenden.
   */
  async function maybeEmitRoundProgress(roomId, round) {
    const now = context.now();
    const decision = throttleRoundProgress(throttleStore, round.roundId, now);
    if (!decision.allow) {
      return false;
    }
    throttleRecordsByRound.set(round.roundId, decision.record);

    const runtime = runtimeFor(roomId);
    const eligible = await eligiblePlayerCount(roomId, round.roundNumber);
    emitToRoom(roomId, 'round:progress', {
      answeredCount: Math.min(runtime.answeredPlayerIds.size, eligible),
      eligiblePlayerCount: eligible,
    });
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Handshake
  // ───────────────────────────────────────────────────────────────────────────

  /** Een handshake-weigering die als `connect_error` bij de client aankomt. */
  function handshakeError(code) {
    const publicCode = toPublicErrorCode(code);
    const error = new Error(publicCode);
    error.data = buildErrorPayload(publicCode, {});
    return error;
  }

  io.use(async (socket, next) => {
    const auth = isPlainObject(socket.handshake?.auth) ? socket.handshake.auth : {};
    const { sessionToken, protocolVersion } = auth;

    if (!SUPPORTED_PROTOCOL_VERSIONS.has(protocolVersion)) {
      logSafe('warn', 'handshake geweigerd', { outcome: OUTCOME.AUTH_FAILED, code: 'PROTOCOL_VERSION_UNSUPPORTED' });
      next(handshakeError('PROTOCOL_VERSION_UNSUPPORTED'));
      return;
    }

    let found;
    try {
      found = await lookupSessionByToken(context, sessionToken);
    } catch (error) {
      // De poort kan werpen (INTB-10: de Redis-adapter blokkeert deze methode
      // nog). Naar buiten is dat een gewone afwijzing; nooit een stacktrace.
      logSafe('error', 'sessie-lookup mislukt', { outcome: OUTCOME.SERVER_ERROR, reason: errorLabel(error) });
      next(handshakeError('TOKEN_INVALID'));
      return;
    }

    if (!found.ok) {
      logSafe('warn', 'handshake geweigerd', { outcome: OUTCOME.AUTH_FAILED, code: toPublicErrorCode(found.code) });
      next(handshakeError(found.code));
      return;
    }

    const { session } = found;
    socket.data = {
      roomId: session.roomId,
      sessionId: session.id,
      playerId: session.playerId ?? null,
      roles: [...session.roles],
    };
    next();
  });

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
      handleClientEvent(socket, eventName, args[0], ack).catch((error) => {
        logSafe('error', 'clientevent mislukt', {
          roomId,
          event: eventName,
          outcome: OUTCOME.SERVER_ERROR,
          reason: errorLabel(error),
        });
        respondFailure(socket, UNKNOWN_ACTION_ID, FALLBACK_PUBLIC_CODE, ack);
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
  // Client → server
  // ───────────────────────────────────────────────────────────────────────────

  function respondSuccess(socket, actionId, payload, ack) {
    const built = buildAck(actionId, true, context.now(), payload);
    if (!built.ok) {
      return null;
    }
    ack?.(built.envelope);
    return built.envelope;
  }

  function respondFailure(socket, actionId, code, ack) {
    const publicCode = toPublicErrorCode(code);
    const built = buildAck(actionId, false, context.now(), buildErrorPayload(publicCode, {}));
    if (built.ok) {
      ack?.(built.envelope);
    }
    // Naast de ack ook het `error`-event: PROTOCOL.md §Foutcodes definieert dat
    // event los van de ack, en een client kan ook zónder ack meeluisteren.
    emitError(socket, actionId, publicCode);
  }

  /**
   * De hele client→server-weg: envelope → alfabet → rol → payloadvorm →
   * idempotentie → compositie → ack + serverevents.
   *
   * WIRE-VORM. De client emit `socket.emit('<protocol-event>', { actionId,
   * payload }, ack)`: de Socket.IO-eventnaam ís de protocoleventnaam (nodig om
   * per event te kunnen routeren) en de rest van de envelope zit in het
   * argument. Draagt het argument óók een `event`-veld, dan moet dat gelijk
   * zijn aan de Socket.IO-eventnaam; anders is het een onbekend event.
   */
  async function handleClientEvent(socket, eventName, raw, ack) {
    const { roomId, sessionId, roles } = socket.data;
    const body = isPlainObject(raw) ? raw : {};
    // Alleen bekende eventnamen als label: een client kan een willekeurige
    // string sturen, en die zou anders een eigen tijdreeks openen.
    const metricEvent = ALL_CLIENT_EVENT_NAMES.includes(eventName) ? eventName : 'unknown';
    const startedAt = Date.now();
    let afgerond = false;
    const meet = (outcome, code = null) => {
      if (afgerond) return;
      afgerond = true;
      metrics.observe('rounda_event_duration_seconds', { event: metricEvent }, (Date.now() - startedAt) / 1000);
      if (metricEvent === 'round:answer') {
        metrics.increment('rounda_answers_total', { outcome });
      }
      if (outcome !== 'accepted') {
        metrics.increment('rounda_event_errors_total', { event: metricEvent, code: code ?? 'unknown' });
      }
    };

    /**
     * Eén afwijzing = één logregel. Vroeger logde alleen het pad ná de
     * compositie-aanroep; een geweigerde rol, een misvormde payload of een
     * onbekend event verdween spoorloos. `outcome` draagt de INTERNE betekenis
     * (`classifyOutcome`), `code` wat de client daadwerkelijk terugkreeg — die
     * twee lopen uiteen zodra een interne code publiek wordt vertaald.
     */
    const reject = (rejectedActionId, code) => {
      meet('rejected', toPublicErrorCode(code));
      logSafe('warn', 'clientevent geweigerd', {
        roomId,
        sessionId,
        event: eventName,
        actionId: rejectedActionId,
        outcome: classifyOutcome(code),
        code: toPublicErrorCode(code),
      });
      respondFailure(socket, rejectedActionId, code, ack);
    };

    if (typeof body.event === 'string' && body.event !== eventName) {
      reject(typeof body.actionId === 'string' && body.actionId.length > 0 ? body.actionId : UNKNOWN_ACTION_ID, 'UNSUPPORTED_EVENT');
      return;
    }

    const parsed = parseClientEnvelope({
      event: eventName,
      actionId: body.actionId,
      payload: isPlainObject(body.payload) ? body.payload : undefined,
    });
    if (!parsed.ok) {
      const actionId = typeof body.actionId === 'string' && body.actionId.length > 0 ? body.actionId : UNKNOWN_ACTION_ID;
      reject(actionId, parsed.reason === 'missing-event' ? 'UNSUPPORTED_EVENT' : MALFORMED_PAYLOAD_CODE);
      return;
    }
    const { actionId, payload } = parsed;

    // Basisregel 7: het alfabet van 12 eventnamen zit in client-events-dispatch.
    const resolved = resolveEventValidator(eventName);
    if (!resolved.ok) {
      reject(actionId, resolved.code);
      return;
    }
    const entry = resolved.entry;

    if (!hasRequiredRole(roles, entry.requiredRole)) {
      reject(actionId, entry.requiredRole === 'host' ? 'NOT_HOST' : 'NOT_PLAYER');
      return;
    }

    const validated = entry.validate(payload);
    if (!validated.ok) {
      reject(actionId, validated.code ?? MALFORMED_PAYLOAD_CODE);
      return;
    }

    // Idempotentie: dezelfde `actionId` geeft dezelfde ack zonder de mutatie te
    // herhalen. `alreadyAnswered` blijft `false` — DM13 heeft die bewaking bij
    // de poort belegd (zie submitAnswer's JSDoc), en twee plekken die hetzelfde
    // bewaken maken de poort niet meer de enige waarheid.
    const store = ackCacheFor(roomId);
    const duplicate = resolveDuplicateAction(store, actionId, eventName);
    if (duplicate.replay) {
      // Een replay is geen nieuw antwoord: hij telt als `replay`, niet als
      // geaccepteerd — anders lijkt het alsof er meer geantwoord is dan er
      // gespeeld is.
      meet('replay');
      ack?.(duplicate.ack);
      return;
    }
    if (!duplicate.ok) {
      reject(actionId, duplicate.reason);
      return;
    }

    const outcome = await runEvent(socket, eventName, actionId, payload);
    if (!outcome.ok) {
      reject(actionId, outcome.code);
      return;
    }

    meet('accepted');
    const ackEnvelope = respondSuccess(socket, actionId, outcome.value ?? {}, ack);
    if (ackEnvelope !== null) {
      // Pas ná geslaagde uitvoering opslaan: een mislukking mag nooit als
      // "al gedaan" in de cache belanden.
      store.set(actionId, ackEnvelope);
    }
    await outcome.after?.();
  }

  /**
   * Eén compositie-aanroep per clientevent. Geeft `{ ok, value, after }`
   * terug: `after` doet de serverevents en loopt pas ná de ack, zodat een
   * client zijn eigen ack nooit ná het bijbehorende broadcast-event ziet.
   */
  async function runEvent(socket, eventName, actionId, payload) {
    const { roomId, sessionId, playerId } = socket.data;

    switch (eventName) {
      case 'game:start': {
        const result = await startMatch(context, { roomId });
        if (!result.ok) return result;
        const value = result.value;
        return {
          ok: true,
          value: { matchId: value.matchId, phase: value.phase },
          after: async () => {
            await publish('game:started', {
              roomId,
              payload: {
                matchId: value.matchId,
                totalRounds: value.totalRounds,
                countdownEndsAt: value.countdownEndsAt,
              },
            });
            scheduleAt(roomId, value.countdownEndsAt, () => runStartRound(roomId));
          },
        };
      }

      case 'game:pause': {
        const result = await advancePhase(context, {
          roomId,
          event: { type: HOST_PAUSE, ...(typeof payload.reason === 'string' ? { reason: payload.reason } : {}) },
        });
        if (!result.ok) return result;
        const pausedState = result.value.pausedState;
        cancelTimer(roomId);
        return {
          ok: true,
          value: { phase: result.value.phase },
          // Besluit 10: snapshot en live event dragen dezelfde volledige vorm.
          after: () => publish('game:paused', { roomId, payload: { ...pausedState } }),
        };
      }

      case 'game:resume': {
        const result = await advancePhase(context, { roomId, event: { type: HOST_RESUME } });
        if (!result.ok) return result;
        const value = result.value;
        return {
          ok: true,
          value: { phase: value.phase },
          after: async () => {
            await publish('game:resumed', {
              roomId,
              payload: {
                phase: value.phase,
                countdownEndsAt: value.phaseEndsAt ?? context.now(),
                // R2-7: bij het hervatten van een lopende ronde schuift de
                // deadline op met de pauzeduur. Zonder dit veld telt elke
                // client door naar de oude wandkloktijd en is de pauze
                // afgetrokken van de antwoordtijd.
                ...(typeof value.roundEndsAt === 'number' ? { roundEndsAt: value.roundEndsAt } : {}),
              },
            });
            // §A2: hervatten krijgt altijd een echte aftelling terug, ook
            // midden in een match — de groep zat net niet bij het scherm.
            await onPhaseEntered(roomId, value.phase, value.phaseEndsAt, {
              reason: 'resume',
              roundEndsAt: value.roundEndsAt ?? null,
            });
          },
        };
      }

      case 'game:next': {
        // Besluit 1: één hostactie per ronde, altijd vanuit SCOREBOARD.
        const result = await advancePhase(context, { roomId, event: { type: HOST_NEXT } });
        if (!result.ok) return result;
        const value = result.value;
        return {
          ok: true,
          value: { phase: value.phase },
          after: () => onPhaseEntered(roomId, value.phase, value.phaseEndsAt),
        };
      }

      case 'game:reveal': {
        // Fase 4 (autoReveal). GEEN fase-overgang zoals `game:next` — dit is
        // dezelfde `endRound()`-aanroep die de timer anders had gedaan, alleen
        // op het moment dat de host kiest i.p.v. op de deadline. Precies
        // daarom géén `advancePhase`/state-machine-event: er wordt geen fase
        // overgeslagen, er wordt een ronde later afgesloten (zie het
        // opdrachtdocument — dát was de fout van de vorige poging).
        //
        // Twee poorten die `endRound()` zelf niet bewaakt (die kent geen
        // transportintentie): autoReveal moet uit staan, en de deadline moet
        // al voorbij zijn — een host die te vroeg tikt, onthult niet vervroegd.
        const room = await context.store.loadRoom(roomId);
        if (room === null) return { ok: false, code: 'GAME_NOT_FOUND' };
        if (room.config.autoReveal !== false) return { ok: false, code: 'INVALID_PHASE' };
        if (room.currentMatchId === null) return { ok: false, code: 'INVALID_PHASE' };
        const match = await context.store.loadMatch(roomId, room.currentMatchId);
        if (match === null || match.phase !== PHASE.ROUND_ACTIVE || match.roundIds.length === 0) {
          return { ok: false, code: 'INVALID_PHASE' };
        }
        const activeRoundId = match.roundIds[match.roundIds.length - 1];
        const round = await context.store.loadRound(roomId, match.id, activeRoundId);
        // Zelfde coulance als besluit 13's antwoorddeadline (`deadlineGraceMs`,
        // standaard 250ms): de host ziet "Toon antwoord" verschijnen op basis
        // van zijn EIGEN, licht afwijkende klokschatting (`estimateServerOffset`)
        // — zonder deze marge zou een tik op het exacte moment dat de knop
        // verschijnt soms nog vóór de server dezelfde deadline zien, en dan
        // zwijgend niets doen (browsermeting, 6 aug 2026: precies dit gebeurde).
        if (round === null || context.now() < round.endsAt - room.config.deadlineGraceMs) {
          return { ok: false, code: 'INVALID_PHASE' };
        }

        const result = await endRound(context, { roomId });
        if (!result.ok) return result;
        return {
          ok: true,
          value: {},
          after: () => announceRoundEnded(roomId, result.value),
        };
      }

      case 'game:lock': {
        const result = await setRoomLocked(context, { roomId, locked: payload.locked });
        if (!result.ok) return result;
        return {
          ok: true,
          value: { locked: result.value.locked },
          after: () => publish('room:lock-changed', { roomId, payload: { locked: result.value.locked } }),
        };
      }

      case 'game:kick': {
        const targetSessionId = await sessionIdOfPlayer(roomId, payload.playerId);
        const result = await kickPlayer(context, { roomId, playerId: payload.playerId });
        if (!result.ok) return result;
        return {
          ok: true,
          value: { playerId: payload.playerId },
          after: async () => {
            if (targetSessionId !== null) {
              await publish('session:kicked', { roomId, sessionId: targetSessionId, payload: { reason: 'host' } });
            }
            await publish('room:player-changed', {
              roomId,
              payload: { playerCount: await playerCountOf(roomId), delta: { type: 'kick', playerId: payload.playerId } },
            });
            // De sessie is ingetrokken; de socket mag niet blijven meeluisteren.
            for (const target of await io.in(sessionChannel(targetSessionId ?? '')).fetchSockets()) {
              target.disconnect(true);
            }
          },
        };
      }

      case 'game:finish': {
        cancelTimer(roomId);
        const result = await finishMatch(context, { roomId });
        if (!result.ok) return result;
        const value = result.value;
        return {
          ok: true,
          value: { matchId: value.matchId, phase: value.phase },
          after: async () => {
            const personal = new Map(value.standings.map((entry) => [entry.playerId, { self: entry }]));
            await publish('game:finished', {
              roomId,
              payload: {
                matchId: value.matchId,
                sequence: value.sequence,
                finishedAt: value.finishedAt,
                podium: value.podium,
              },
              personalByPlayerId: personal,
              fallbackPersonal: { self: { playerId: null } },
            });
          },
        };
      }

      case 'game:rematch': {
        const result = await rematch(context, { roomId });
        if (!result.ok) return result;
        const value = result.value;
        return {
          ok: true,
          value: { matchId: value.matchId, sequence: value.sequence },
          after: async () => {
            const snapshot = await buildSnapshot(context, { roomId });
            await publish('game:rematch-started', {
              roomId,
              payload: { matchId: value.matchId, lobbyState: snapshot.ok ? snapshot.value.room : {} },
            });
          },
        };
      }

      case 'round:answer': {
        const result = await submitAnswer(context, {
          roomId,
          playerId,
          roundId: payload.roundId,
          answer: payload.answer,
          actionId,
          clientAnsweredAt: payload.clientAnsweredAt,
        });
        if (!result.ok) return result;
        const runtime = runtimeFor(roomId);
        if (result.value.replay !== true) {
          runtime.answeredPlayerIds.add(playerId);
        }
        return {
          // De ack draagt geen punten/correctheid: die mogen de ronde niet
          // verlaten vóór `round:ended` (Basisregel 4).
          ok: true,
          value: { roundId: payload.roundId },
          after: async () => {
            await publish('round:answer-accepted', { roomId, sessionId, payload: { roundId: payload.roundId } });
            if (runtime.round !== null) {
              await maybeEmitRoundProgress(roomId, runtime.round);
            }
          },
        };
      }

      case 'share:opened': {
        // "analytics, mag falen zonder UX-effect" — geen mutatie, alleen een ack.
        logSafe('info', 'share geopend', { roomId, sessionId, actionId, method: payload.method });
        return { ok: true, value: {} };
      }

      case 'player:rename': {
        // Besluit 40B + feedbackronde 4 aug: het rename-gat is gedicht — de
        // compositiefunctie bestaat nu (room-lifecycle.renamePlayer, LOBBY-
        // only, max één keer, volledige naamnormalisatie).
        const result = await renamePlayer(context, {
          roomId,
          playerId: session.playerId,
          displayName: payload.displayName,
        });
        if (!result.ok) return result;
        return {
          ok: true,
          value: { effectiveName: result.value.effectiveName },
          after: async () => publish('room:player-changed', {
            roomId,
            payload: {
              playerCount: await playerCountOf(roomId),
              delta: { type: 'rename', playerId: session.playerId, effectiveName: result.value.effectiveName },
            },
          }),
        };
      }

      case 'player:recolor': {
        // Feedbackronde punt 13: eigen kleur kiezen (LOBBY-only, gesloten
        // palet — protocollaag valideerde de waarde al).
        const result = await recolorPlayer(context, {
          roomId,
          playerId: session.playerId,
          color: payload.color,
        });
        if (!result.ok) return result;
        return {
          ok: true,
          value: { color: result.value.color },
          after: async () => publish('room:player-changed', {
            roomId,
            payload: {
              playerCount: await playerCountOf(roomId),
              delta: { type: 'recolor', playerId: session.playerId, color: result.value.color },
            },
          }),
        };
      }

      case 'game:update-config': {
        // Besluit 40 (scherm 2): host stelt in de lobby bij; iedereen hoort
        // de nieuwe stand via room:config-changed.
        const result = await updateConfig(context, { roomId, patch: payload });
        if (!result.ok) return result;
        return {
          ok: true,
          value: { config: result.value.config },
          after: () => publish('room:config-changed', { roomId, payload: { config: result.value.config } }),
        };
      }

      case 'player:leave': {
        // Fase 2 (agent 1): vrijwillig vertrekken, geleend van de
        // `kickPlayer`-structuur maar zonder sessie-intrekking (besluit 4).
        const result = await leaveRoom(context, { roomId, playerId });
        if (!result.ok) return result;
        return {
          ok: true,
          value: {},
          after: async () => {
            // Alleen uitzenden bij een échte overgang — een tweede `leave`
            // van dezelfde speler is een no-op en meldt de room dus niets.
            if (!result.value.changed) return;
            await publish('room:player-changed', {
              roomId,
              payload: {
                playerCount: await playerCountOf(roomId),
                delta: { type: 'leave', playerId },
              },
            });
          },
        };
      }

      default:
        return { ok: false, code: 'UNSUPPORTED_EVENT' };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Snapshot
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Stuurt de volledige snapshot naar één sessie (`room:state`). Beide
   * invarianten uit `snapshot-shape.mjs` worden hier getoetst — de vorm én
   * "een snapshot van een actieve ronde bevat nooit het correcte antwoord".
   * Een snapshot die daar niet doorheen komt, wordt niet verstuurd.
   */
  async function sendSnapshot(roomId, sessionId) {
    const snapshot = await buildSnapshot(context, { roomId, sessionId });
    if (!snapshot.ok) {
      return { ok: false, code: toPublicErrorCode(snapshot.code) };
    }
    const shape = validateSnapshotShape(snapshot.value);
    const leak = assertNoActiveRoundAnswerLeak(snapshot.value);
    if (!shape.ok || !leak.ok) {
      logSafe('error', 'snapshot afgekeurd, niet verstuurd', { roomId, sessionId, outcome: OUTCOME.SERVER_ERROR });
      return { ok: false, code: FALLBACK_PUBLIC_CODE };
    }
    await publish('room:state', { roomId, sessionId, payload: snapshot.value });
    return { ok: true };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Afsluiten
  // ───────────────────────────────────────────────────────────────────────────

  return {
    io,
    /** Voor `server/index.mjs`: een snapshot naar één sessie duwen na reconnect. */
    sendSnapshot,
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
      await publish('room:player-changed', {
        roomId,
        payload: { playerCount: await playerCountOf(roomId), delta },
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
        cancelTimer(roomId);
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
