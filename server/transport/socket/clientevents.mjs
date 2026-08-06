// server/transport/socket/clientevents.mjs — refactor 6
// (docs/openstaand/refactor/6-socket.md). Verplaatst LETTERLIJK uit
// socket.mjs's "Client → server"-sectie: `respondSuccess`, `respondFailure`,
// `handleClientEvent` en de grote schakelaar `runEvent`. Geen
// gedragsverandering.
//
// LET OP (uit de opdracht): de volgorde van ack vóór broadcast is bewust.
// `handleClientEvent` hieronder stuurt de ack van elke clientactie vóórdat
// het `after`-vervolg (de serverevents) loopt — dat is precies onderzocht bij
// een flaky test, dus die volgorde staat hier ongewijzigd.

import {
  ALL_CLIENT_EVENT_NAMES,
  hasRequiredRole,
  resolveEventValidator,
} from '../../protocol/client-events-dispatch.mjs';
import { buildAck, parseClientEnvelope } from '../../protocol/envelope.mjs';
import { buildErrorPayload } from '../../protocol/error-payload.mjs';
import { resolveDuplicateAction } from '../../protocol/idempotency.mjs';
import { classifyOutcome } from '../safe-logger.mjs';
import { PHASE } from './phase.mjs';

import {
  advancePhase,
  buildSnapshot,
  endRound,
  finishMatch,
  rematch,
  startMatch,
  submitAnswer,
} from '../../composition/match-lifecycle.mjs';
import {
  kickPlayer,
  leaveRoom,
  recolorPlayer,
  renamePlayer,
  setRoomLocked,
  updateConfig,
} from '../../composition/room-lifecycle.mjs';

/**
 * KEUZE — `PROTOCOL.md` §Foutcodes kent geen generieke "payload voldoet niet
 * aan het schema"-code voor de elf niet-`round:answer`-events; alleen
 * `INVALID_ANSWER_FORMAT` bestaat. De protocolvalidators geven daarom
 * `code: null` terug. Deze laag moet iets naar de client sturen en kiest
 * `INVALID_ANSWER_FORMAT` als dichtstbijzijnde gepubliceerde code voor elk
 * vormprobleem. Zie het handoff-item: er ontbreekt een `INVALID_PAYLOAD`.
 */
const MALFORMED_PAYLOAD_CODE = 'INVALID_ANSWER_FORMAT';

/** State-machine-eventtypes die deze laag gebruikt (waarden uit state-machine.js). */
const HOST_PAUSE = 'HOST_PAUSE';
const HOST_RESUME = 'HOST_RESUME';
const HOST_NEXT = 'HOST_NEXT';

/**
 * @param {{
 *   io: import('socket.io').Server,
 *   context: import('../../composition/context.mjs').Context,
 *   logSafe: (level: string, message: string, record: object) => void,
 *   metrics: object,
 *   toPublicErrorCode: (code: unknown) => string,
 *   isPlainObject: (value: unknown) => boolean,
 *   unknownActionId: string,
 *   publish: (event: string, params: object) => Promise<void>,
 *   emitError: (socket: object, actionId: string, code: unknown) => void,
 *   scheduleAt: (roomId: string, atEpochMs: number, fn: () => unknown) => void,
 *   cancelTimer: (roomId: string) => void,
 *   onPhaseEntered: (roomId: string, phase: string, phaseEndsAt: number | null, opts?: object) => Promise<void>,
 *   runStartRound: (roomId: string) => Promise<void>,
 *   announceRoundEnded: (roomId: string, value: object) => Promise<void>,
 *   maybeEmitRoundProgress: (roomId: string, round: object) => Promise<boolean>,
 *   playerCountOf: (roomId: string) => Promise<number>,
 *   sessionIdOfPlayer: (roomId: string, playerId: string) => Promise<string | null>,
 *   ackCacheFor: (roomId: string) => { get: (actionId: string) => object | undefined, set: (actionId: string, ack: object) => void },
 *   runtimeFor: (roomId: string) => { round: { roundId: string, roundNumber: number } | null, answeredPlayerIds: Set<string> },
 *   sessionChannel: (sessionId: string) => string,
 * }} deps
 */
export function createClientEvents({
  io,
  context,
  logSafe,
  metrics,
  toPublicErrorCode,
  isPlainObject,
  unknownActionId,
  publish,
  emitError,
  scheduleAt,
  cancelTimer,
  onPhaseEntered,
  runStartRound,
  announceRoundEnded,
  maybeEmitRoundProgress,
  playerCountOf,
  sessionIdOfPlayer,
  ackCacheFor,
  runtimeFor,
  sessionChannel,
}) {
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
      reject(typeof body.actionId === 'string' && body.actionId.length > 0 ? body.actionId : unknownActionId, 'UNSUPPORTED_EVENT');
      return;
    }

    const parsed = parseClientEnvelope({
      event: eventName,
      actionId: body.actionId,
      payload: isPlainObject(body.payload) ? body.payload : undefined,
    });
    if (!parsed.ok) {
      const actionId = typeof body.actionId === 'string' && body.actionId.length > 0 ? body.actionId : unknownActionId;
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

      case 'game:rename-player': {
        // docs/openstaand/host-wijzigt-naam-en-kleur.md: hostvariant van
        // player:rename, mét `bypassRenameLimit` — de once-per-speler-limiet
        // geldt niet voor de host (anders kan hij "Speler 7" niet herstellen).
        const result = await renamePlayer(context, {
          roomId,
          playerId: payload.playerId,
          displayName: payload.displayName,
          bypassRenameLimit: true,
        });
        if (!result.ok) return result;
        return {
          ok: true,
          value: { playerId: payload.playerId, effectiveName: result.value.effectiveName },
          after: async () => publish('room:player-changed', {
            roomId,
            payload: {
              playerCount: await playerCountOf(roomId),
              delta: { type: 'rename', playerId: payload.playerId, effectiveName: result.value.effectiveName },
            },
          }),
        };
      }

      case 'game:recolor-player': {
        // docs/openstaand/host-wijzigt-naam-en-kleur.md: hostvariant van
        // player:recolor — `recolorPlayer` kende al geen eenmaal-limiet,
        // dus alleen de doelspeler-id verschilt van de eigen-kleur-route.
        const result = await recolorPlayer(context, { roomId, playerId: payload.playerId, color: payload.color });
        if (!result.ok) return result;
        return {
          ok: true,
          value: { playerId: payload.playerId, color: result.value.color },
          after: async () => publish('room:player-changed', {
            roomId,
            payload: {
              playerCount: await playerCountOf(roomId),
              delta: { type: 'recolor', playerId: payload.playerId, color: result.value.color },
            },
          }),
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
          playerId,
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
              delta: { type: 'rename', playerId, effectiveName: result.value.effectiveName },
            },
          }),
        };
      }

      case 'player:recolor': {
        // Feedbackronde punt 13: eigen kleur kiezen (LOBBY-only, gesloten
        // palet — protocollaag valideerde de waarde al).
        const result = await recolorPlayer(context, {
          roomId,
          playerId,
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
              delta: { type: 'recolor', playerId, color: result.value.color },
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

  return { handleClientEvent, respondFailure };
}
