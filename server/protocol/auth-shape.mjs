/**
 * @file PR3 — vorm-check voor authenticatie: de REST
 *   `Authorization: Bearer <sessionToken>`-header en de socket-handshake-
 *   payload `{ sessionToken, protocolVersion }`.
 * @see docs/multiplayer/PROTOCOL.md — §Authenticatie en tijdelijke sessies.
 * @see docs/protocol-plan/prompts/PR3-rest-schemas.md — module 2 (`auth-shape`).
 *
 * Expliciet gemarkeerd: dit is letterlijk coderen van de vorm die
 * `PROTOCOL.md` al vastlegt (Bearer-prefix, `{sessionToken, protocolVersion}`-
 * handshake) — **geen** tokenbeslissing. Geen van beide functies hieronder
 * roept tokengeneratie, hashing, of een sessiestore aan; ze controleren
 * uitsluitend of de aangeleverde string/object de juiste vorm heeft. De
 * daadwerkelijke geldigheidscontrole tegen een echte sessiestore hoort bij
 * het latere serverproces (PR8a/PR8b), niet bij deze module.
 */
import { ALL_ERROR_CODES } from './error-codes.mjs';

/** @typedef {import('./error-codes.mjs').ErrorCode} ErrorCode */

const TOKEN_INVALID = 'TOKEN_INVALID';
const PROTOCOL_VERSION_UNSUPPORTED = 'PROTOCOL_VERSION_UNSUPPORTED';

// Deze module verzint geen eigen foutcodes — ze leent uitsluitend van
// `error-codes.mjs` (single source of truth). Fail fast bij module-load als
// een van deze twee codes ooit uit die enum verdwijnt.
for (const code of [TOKEN_INVALID, PROTOCOL_VERSION_UNSUPPORTED]) {
  if (!ALL_ERROR_CODES.has(code)) {
    throw new Error(`auth-shape: foutcode "${code}" ontbreekt in ALL_ERROR_CODES`);
  }
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Pure vorm-check voor de REST-header `Authorization: Bearer <sessionToken>`
 * (PROTOCOL.md §REST-auth). Beoordeelt uitsluitend de vorm — niet of het
 * token bestaat, geldig is, of bij een sessie hoort (dat vereist een echte
 * sessiestore en hoort bij het latere serverproces, niet bij PR8a/b zelf).
 *
 * Vergelijkt het `Bearer`-prefix hoofdlettergevoelig — `PROTOCOL.md` schrijft
 * exact `Bearer` (hoofdletter B); deze validator voegt geen eigen RFC 7235-
 * tolerantie voor scheme-namen toe die niet in de brontekst staat.
 *
 * @param {string | undefined | null} headerValue - de rauwe waarde van de
 *   `Authorization`-header, of `undefined`/`null` als de header ontbreekt.
 * @returns {{ ok: true, token: string } | { ok: false, code: 'TOKEN_INVALID' }}
 */
export function parseBearerAuthHeader(headerValue) {
  if (typeof headerValue !== 'string' || !headerValue.startsWith(BEARER_PREFIX)) {
    return { ok: false, code: TOKEN_INVALID };
  }
  const token = headerValue.slice(BEARER_PREFIX.length);
  if (token.trim().length === 0) {
    return { ok: false, code: TOKEN_INVALID };
  }
  return { ok: true, token };
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Pure vorm-check voor de socket-handshake-payload
 * `{ sessionToken, protocolVersion }` (PROTOCOL.md §Socket-auth). Wordt
 * ongewijzigd hergebruikt bij reconnect (PROTOCOL.md §Reconnect, stap 4:
 * "Socketauth gebruikt dezelfde sessietoken") — zie PR6, geen apart
 * reconnect-schema.
 *
 * Controlevolgorde (vastgelegd voor deterministische tests, geen citaat):
 * eerst de vorm van `sessionToken` (niet-lege string) → `TOKEN_INVALID` bij
 * afwijking; pas daarna `protocolVersion === 'v1'` →
 * `PROTOCOL_VERSION_UNSUPPORTED` bij afwijking of ontbreken. Zijn beide
 * ongeldig, dan retourneert deze functie `TOKEN_INVALID`.
 *
 * @param {unknown} auth - de rauwe `auth`-waarde uit de Socket.IO-handshake;
 *   mag alles zijn, inclusief `undefined` of een niet-object.
 * @returns
 *   | { ok: true, sessionToken: string, protocolVersion: 'v1' }
 *   | { ok: false, code: 'TOKEN_INVALID' | 'PROTOCOL_VERSION_UNSUPPORTED' }
 */
export function parseSocketAuthPayload(auth) {
  const authObject = isPlainObject(auth) ? auth : {};
  const sessionToken = authObject.sessionToken;
  const sessionTokenValid = typeof sessionToken === 'string' && sessionToken.trim().length > 0;
  if (!sessionTokenValid) {
    return { ok: false, code: TOKEN_INVALID };
  }
  if (authObject.protocolVersion !== 'v1') {
    return { ok: false, code: PROTOCOL_VERSION_UNSUPPORTED };
  }
  return { ok: true, sessionToken, protocolVersion: 'v1' };
}
