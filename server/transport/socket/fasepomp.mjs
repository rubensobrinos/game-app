// server/transport/socket/fasepomp.mjs — refactor 6
// (docs/openstaand/refactor/6-socket.md). Verplaatst LETTERLIJK uit
// socket.mjs's "Servertimers — absolute tijdstippen, nooit ticks over de
// socket"- en "De fasepomp: één compositie-aanroep per overgang, geen tweede
// fasetabel"-secties, plus `maybeEmitRoundProgress` (stond bij "Client →
// server", maar plant net als de rest hier de volgende stap). Geen
// gedragsverandering.
//
// LET OP (uit de opdracht): tijden zijn en blijven absolute epoch-ms-
// tijdstippen die uit de compositielaag komen — er gaat geen enkele
// timer-tick over de socket, alleen servertimers die op één afgesproken
// moment één fasewissel doen (`scheduleAt`). En: dit is ÉÉN compositie-
// aanroep per overgang — er ontstaat hier geen tweede fasetabel naast
// `match-lifecycle.mjs`'s state machine, alleen de vertaling van een
// compositieresultaat naar "welk serverevent, en wanneer de volgende timer".
//
// De functies sloten in het bronbestand over `attachSocketServer`'s
// gedeelde toestand (`runtimeByRoom`, `throttleRecordsByRound`, de
// scheduler). Die blijft daar staan ("Transportstate" is geen eigen naad in
// de opdracht) en wordt hier binnengebracht via `deps`.

import {
  advancePhase,
  endRound,
  finishMatch,
  getScoreboard,
  startRound as startRoundComposition,
  CONTENT_UNAVAILABLE,
  PHASE_RACE_LOST,
} from '../../composition/match-lifecycle.mjs';
import { throttleRoundProgress } from '../../protocol/throttle-round-progress.mjs';
import { OUTCOME, classifyOutcome, errorLabel } from '../safe-logger.mjs';
import { PHASE } from './phase.mjs';

/** State-machine-eventtype dat deze laag gebruikt (waarde uit state-machine.js). */
const TIMER_ELAPSED = 'TIMER_ELAPSED';

/**
 * @param {{
 *   context: import('../../composition/context.mjs').Context,
 *   logSafe: (level: string, message: string, record: object) => void,
 *   toPublicErrorCode: (code: unknown) => string,
 *   scheduler: { setTimer: (delayMs: number, fn: () => void) => unknown, clearTimer: (handle: unknown) => void },
 *   publish: (event: string, params: object) => Promise<void>,
 *   emitToRoom: (roomId: string, event: string, payload: object) => string,
 *   runtimeByRoom: Map<string, object>,
 *   runtimeFor: (roomId: string) => object,
 *   throttleRecordsByRound: Map<string, object>,
 *   throttleStore: { get: (roundId: string) => object | undefined },
 *   eligiblePlayerCount: (roomId: string, roundNumber: number) => Promise<number>,
 *   isBeforeFirstRound: (roomId: string) => Promise<boolean>,
 * }} deps
 */
export function createFasepomp({
  context,
  logSafe,
  toPublicErrorCode,
  scheduler,
  publish,
  emitToRoom,
  runtimeByRoom,
  runtimeFor,
  throttleRecordsByRound,
  throttleStore,
  eligiblePlayerCount,
  isBeforeFirstRound,
}) {
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
    const result = await startRoundComposition(context, { roomId });
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

  return {
    cancelTimer,
    scheduleAt,
    onPhaseEntered,
    runStartRound,
    runEndRound,
    announceRoundEnded,
    runAdvanceOnTimer,
    publishFinished,
    maybeEmitRoundProgress,
  };
}
