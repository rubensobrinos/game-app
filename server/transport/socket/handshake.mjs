// server/transport/socket/handshake.mjs — refactor 6
// (docs/openstaand/refactor/6-socket.md). Verplaatst LETTERLIJK uit
// socket.mjs's "Handshake"-sectie, plus `lookupSessionByToken` (stond
// erboven, maar hoort inhoudelijk bij dezelfde authenticatiestap). Geen
// gedragsverandering.

import { hashToken } from '../../protocol/auth-session.mjs';
import { buildErrorPayload } from '../../protocol/error-payload.mjs';
import { verifySessionToken } from '../../composition/context.mjs';
import { OUTCOME, errorLabel } from '../safe-logger.mjs';

/** De protocolversies die deze server accepteert (PROTOCOL.md, kop). */
export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze(new Set(['v1']));

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
 * @param {import('../../composition/context.mjs').Context} context
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

/**
 * Registreert de handshake-middleware op `io`. Bij elke (nieuwe of
 * hervattende) verbinding: protocolversie toetsen, token opzoeken via
 * `lookupSessionByToken`, en bij succes `socket.data` vullen — de enige plek
 * waar room/sessie/speler daarna nog vandaan komen (PROTOCOL.md Basisregel 3,
 * kopnotitie in socket.mjs).
 *
 * @param {import('socket.io').Server} io
 * @param {{
 *   context: import('../../composition/context.mjs').Context,
 *   logSafe: (level: string, message: string, record: object) => void,
 *   toPublicErrorCode: (code: unknown) => string,
 *   isPlainObject: (value: unknown) => boolean,
 * }} deps
 */
export function attachHandshake(io, { context, logSafe, toPublicErrorCode, isPlainObject }) {
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
}
