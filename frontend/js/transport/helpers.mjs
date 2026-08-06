// transport/helpers.mjs — refactor 9 (docs/openstaand/refactor/9-transport-client.md).
// Kleine, stateloze hulpfuncties zonder eigen domeinkennis, gedeeld tussen
// transport/verbinding.mjs en transport/precedentie.mjs. Verplaatst LETTERLIJK
// uit transport.mjs's "Kleine helpers"-kopje. Geen gedragsverandering.

import { TRANSPORT_ERROR_CODES } from './protocol.mjs';

/** @param {string | undefined} value */
export function normalizeBaseUrl(value) {
  const candidate = typeof value === 'string' && value.length > 0
    ? value
    : globalThis.location?.origin;
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new TypeError('createTransport: `baseUrl` is verplicht buiten een browser.');
  }
  return candidate.endsWith('/') ? candidate.slice(0, -1) : candidate;
}

export function safeJsonParse(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Leest de foutcode uit een Socket.IO-CONNECT_ERROR. `socket.mjs` zet de
 * `{ code, meta }`-payload op `error.data`; Socket.IO verpakt dat als
 * `{ message, data }`.
 */
export function readHandshakeErrorCode(parsed) {
  const fromData = readString(readObject(parsed)?.data, 'code');
  if (fromData !== null) {
    return fromData;
  }
  const fromRoot = readString(parsed, 'code');
  if (fromRoot !== null) {
    return fromRoot;
  }
  const message = readString(parsed, 'message');
  return message ?? TRANSPORT_ERROR_CODES.NETWORK;
}

export function readObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/** @returns {string | null} */
export function readString(source, key) {
  const object = readObject(source);
  if (object === null) {
    return null;
  }
  const value = object[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
