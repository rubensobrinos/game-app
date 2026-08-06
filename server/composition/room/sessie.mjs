// server/composition/room/sessie.mjs
//
// Eén handeling, eigen bestand: een aangeboden sessietoken omzetten naar de
// Session waar het bij hoort.
//
// Klein maar apart, om twee redenen. Het is de enige functie in deze map die
// een geheim vergelijkt, en de VOLGORDE waarin dat gebeurt is de hele
// beveiligingswaarde ervan — die volgorde moet zichtbaar blijven en niet
// tussen tien andere handelingen wegvallen. En het is de functie waarop de
// hele autorisatielaag rust: elk `NOT_HOST` en `NOT_PLAYER` in de
// transportlaag begint met wat hier teruggegeven wordt.

import { verifySessionToken } from '../context.mjs';
import { CODES, fail, succeed } from './gedeeld.mjs';

/**
 * Resolvet een aangeboden sessietoken naar de bijbehorende Session.
 *
 * `sessionId` en `roomId` moeten worden meegegeven omdat de poort alleen
 * `loadSession(roomId, sessionId)` heeft en geen lookup op tokenhash — zie de
 * handoff-notitie; de echte transportlaag krijgt van de client uitsluitend
 * `Authorization: Bearer <sessionToken>` en heeft die lookup wél nodig. Er
 * wordt hier bewust geen schaduwindex naast de poort gebouwd.
 *
 * Volgorde is bewust: eerst de tokenvergelijking (constant-time), dan pas de
 * revocatiecheck. Andersom zou een verkeerd token verklappen dát een sessie
 * is ingetrokken.
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string, sessionId: string, sessionToken: string }} params
 */
export async function resolveSession(context, { roomId, sessionId, sessionToken } = {}) {
  const session = await context.store.loadSession(roomId, sessionId);
  if (session === null) {
    return fail(CODES.TOKEN_INVALID);
  }
  if (!verifySessionToken(context, sessionToken, session.tokenHash)) {
    return fail(CODES.TOKEN_INVALID);
  }
  if (session.revoked === true) {
    return fail(CODES.SESSION_REVOKED);
  }
  return succeed(session);
}
