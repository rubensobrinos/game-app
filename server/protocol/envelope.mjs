/**
 * @file Pure envelope helpers for the client<->server wire protocol.
 * @see docs/multiplayer/PROTOCOL.md — "Event-envelope", "Ack", payload-size
 *   part of "Inputveiligheid"; Basisregels 3 and 5.
 *
 * Pure: no I/O, no Redis/sockets/timers, no Date.now()/Math.random() — time
 * and ids always arrive as arguments. Never throws; returns
 * { ok: true, ... } or { ok: false, reason }.
 *
 * `reason` strings are lowercase, module-internal labels — NOT the 23
 * SCREAMING_CASE PROTOCOL.md error codes. Mapping a reason to an official
 * protocol error code happens later, in the PR2 `error-codes` module.
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a client -> server envelope. `raw` is already JSON-parsed.
 * @param {unknown} raw
 * @returns {{ ok: true, event: string, actionId: string, payload: object } | { ok: false, reason: string }}
 */
export function parseClientEnvelope(raw) {
  if (!isPlainObject(raw)) return { ok: false, reason: 'invalid-envelope-shape' };
  const { event, actionId, payload } = raw;
  if (typeof event !== 'string' || event.length === 0) return { ok: false, reason: 'missing-event' };
  if (typeof actionId !== 'string' || actionId.length === 0) {
    return { ok: false, reason: 'missing-action-id' };
  }
  if (!isPlainObject(payload)) return { ok: false, reason: 'invalid-payload' };
  return { ok: true, event, actionId, payload };
}

/**
 * Builds a server -> client envelope, matching the `round:started` example
 * in PROTOCOL.md's "Event-envelope" section.
 * @param {string} event
 * @param {object} payload
 * @param {number} serverTime - epoch-ms, supplied by the caller
 * @param {string} eventId
 * @returns {{ ok: true, envelope: { event: string, eventId: string, serverTime: number, payload: object } } | { ok: false, reason: string }}
 */
export function buildServerEnvelope(event, payload, serverTime, eventId) {
  if (typeof event !== 'string' || event.length === 0) return { ok: false, reason: 'missing-event' };
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { ok: false, reason: 'missing-event-id' };
  }
  if (typeof serverTime !== 'number' || !Number.isFinite(serverTime)) {
    return { ok: false, reason: 'invalid-server-time' };
  }
  return { ok: true, envelope: { event, eventId, serverTime, payload } };
}

/**
 * Builds an ack envelope, matching PROTOCOL.md's "Ack" example.
 * @param {string} actionId
 * @param {boolean} ok
 * @param {number} serverTime - epoch-ms, supplied by the caller
 * @param {object} payload
 * @returns {{ ok: true, envelope: { actionId: string, ok: boolean, serverTime: number, payload: object } } | { ok: false, reason: string }}
 */
export function buildAck(actionId, ok, serverTime, payload) {
  if (typeof actionId !== 'string' || actionId.length === 0) {
    return { ok: false, reason: 'missing-action-id' };
  }
  if (typeof ok !== 'boolean') return { ok: false, reason: 'invalid-ok-flag' };
  if (typeof serverTime !== 'number' || !Number.isFinite(serverTime)) {
    return { ok: false, reason: 'invalid-server-time' };
  }
  return { ok: true, envelope: { actionId, ok, serverTime, payload } };
}

/**
 * Checks the raw (not yet parsed) UTF-8 byte size of a client payload
 * against a maximum, meant to run before `parseClientEnvelope` (PROTOCOL.md
 * "Inputveiligheid": "payloadgrootte wordt begrensd").
 * @param {string} rawPayload - the raw, not yet parsed payload string
 * @param {number} maxBytes
 * @returns {{ ok: true } | { ok: false, reason: 'payload-too-large' }}
 */
export function assertPayloadSize(rawPayload, maxBytes) {
  const size = Buffer.byteLength(rawPayload, 'utf8');
  return size <= maxBytes ? { ok: true } : { ok: false, reason: 'payload-too-large' };
}
