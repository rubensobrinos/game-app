// server/transport/socket/publiceren.mjs — refactor 6
// (docs/openstaand/refactor/6-socket.md). Verplaatst LETTERLIJK uit
// socket.mjs's "Server → client"-sectie. Geen gedragsverandering.
//
// De functies sloten in het bronbestand rechtstreeks over `io`/`context`/
// `logSafe`/`toPublicErrorCode`, die `attachSocketServer` opbouwt. Dat kan
// hier niet meer (geen eigen mock-/socketinstantie), dus levert dit bestand
// een fabriek: `createPublisher(deps)` bouwt de vijf functies éénmalig per
// `attachSocketServer()`-aanroep, precies zoals de gesloten functies dat
// vóór de splitsing ook deden.

import { buildServerEnvelope } from '../../protocol/envelope.mjs';
import { buildErrorPayload } from '../../protocol/error-payload.mjs';
import { resolveRecipientRule } from '../../protocol/server-events-recipients.mjs';
import { createId } from '../../composition/context.mjs';
import { roomChannel, sessionChannel } from './channels.mjs';

/**
 * @param {{
 *   io: import('socket.io').Server,
 *   context: import('../../composition/context.mjs').Context,
 *   logSafe: (level: string, message: string, record: object) => void,
 *   toPublicErrorCode: (code: unknown) => string,
 * }} deps
 */
export function createPublisher({ io, context, logSafe, toPublicErrorCode }) {
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

  return { publish, emitToRoom, emitToSession, emitToRoomWithPersonalFields, emitError, nextEventId, envelopeFor };
}
