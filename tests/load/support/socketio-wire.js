// tests/load/support/socketio-wire.js
//
// Kale Engine.IO-v4-/Socket.IO-v5-framing als pure functies, voor gebruik
// binnen een k6 `ws.connect(...)`-callback (die zelf niet async is — vandaar
// puur functionele encode/decode-helpers in plaats van een promise-API zoals
// `tests/integration/support/socket-io-test-client.mjs` heeft; k6's `k6/ws`
// is callback-gedreven, geen `async`/`await` rond de socket zelf).
//
// Zelfde wireformaat, dezelfde reden om het zelf te bouwen: `socket.io-client`
// staat niet in `package.json` en er mag geen nieuwe dependency bij zonder
// apart akkoord — dit spreekt het protocol rechtstreeks over k6's ingebouwde
// `k6/ws`, net zoals de integratietests dat over Node's ingebouwde `WebSocket`
// doen.

const ENGINE_OPEN = '0';
const ENGINE_PING = '2';
const ENGINE_PONG = '3';
const ENGINE_MESSAGE = '4';
const SIO_CONNECT = '0';
const SIO_EVENT = '2';
const SIO_ACK = '3';
const SIO_CONNECT_ERROR = '4';

/** @param {{ sessionToken: string, protocolVersion?: string }} auth */
export function encodeConnect(auth) {
  return `${ENGINE_MESSAGE}${SIO_CONNECT}${JSON.stringify(auth)}`;
}

export function encodePong() {
  return ENGINE_PONG;
}

/**
 * @param {string} event
 * @param {object} payload
 * @param {number} [ackId] - zonder ackId verwacht de server geen ack terug.
 */
export function encodeEvent(event, payload, ackId) {
  const prefix = ackId === undefined ? '' : String(ackId);
  return `${ENGINE_MESSAGE}${SIO_EVENT}${prefix}${JSON.stringify([event, payload])}`;
}

/**
 * Ontleedt één binnenkomend frame. Geeft een getypeerd resultaat terug in
 * plaats van de caller de rauwe Engine.IO-prefixes te laten herkennen.
 *
 * @param {string} raw
 * @returns
 *   | { kind: 'engine-open' }
 *   | { kind: 'engine-ping' }
 *   | { kind: 'sio-connect' }
 *   | { kind: 'sio-connect-error', data: unknown }
 *   | { kind: 'sio-event', event: string, envelope: object }
 *   | { kind: 'sio-ack', id: number, payload: unknown }
 *   | { kind: 'ignored' }
 */
export function decodeFrame(raw) {
  const engineType = raw[0];
  if (engineType === ENGINE_OPEN) return { kind: 'engine-open' };
  if (engineType === ENGINE_PING) return { kind: 'engine-ping' };
  if (engineType !== ENGINE_MESSAGE) return { kind: 'ignored' };

  const body = raw.slice(1);
  const socketIoType = body[0];
  const rest = body.slice(1);

  if (socketIoType === SIO_CONNECT) return { kind: 'sio-connect' };
  if (socketIoType === SIO_CONNECT_ERROR) {
    const parsed = rest.length > 0 ? JSON.parse(rest) : {};
    return { kind: 'sio-connect-error', data: parsed.data ?? parsed };
  }
  if (socketIoType === SIO_EVENT) {
    const withoutAckId = rest.replace(/^\d+/, '');
    const [event, envelope] = JSON.parse(withoutAckId);
    return { kind: 'sio-event', event, envelope };
  }
  if (socketIoType === SIO_ACK) {
    const match = /^\d+/.exec(rest);
    const id = Number(match[0]);
    const args = JSON.parse(rest.slice(match[0].length));
    return { kind: 'sio-ack', id, payload: args[0] };
  }
  return { kind: 'ignored' };
}

/**
 * Kiest een geldig (niet per se correct) antwoord voor een `round:started`-
 * payload, per `gameType` — zie PROTOCOL.md §Voorbeeld round:started. Een
 * loadtest hoeft niet het juiste antwoord te raden, alleen een vorm die de
 * validator accepteert, zodat de ack-/verwerkingslatency gemeten kan worden.
 *
 * @param {{ gameType: string, question: object }} roundStartedPayload
 * @returns {object}
 */
export function pickAnswerPayload({ gameType, question }) {
  switch (gameType) {
    case 'flags_mc':
    case 'capitals_mc':
      return { optionId: question.optionIso2s[0] };
    case 'real_or_fake_flag':
      return { choice: 'real' };
    case 'higher_lower':
      return { side: question.sides[0].side };
    case 'odd_one_out':
      return { cardIndex: question.cards[0].cardIndex };
    default:
      throw new Error(`socketio-wire: onbekend gameType "${gameType}"`);
  }
}
