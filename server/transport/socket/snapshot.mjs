// server/transport/socket/snapshot.mjs — refactor 6
// (docs/openstaand/refactor/6-socket.md). Verplaatst LETTERLIJK uit
// socket.mjs's "Afgeleide gegevens die de compositielaag (nog) niet
// aanbiedt"- en "Snapshot"-secties. Geen gedragsverandering.

import { buildSnapshot } from '../../composition/match-lifecycle.mjs';
import { isEligibleForRound } from '../../rules/eligibility.js';
import { assertNoActiveRoundAnswerLeak, validateSnapshotShape } from '../../protocol/snapshot-shape.mjs';
import { OUTCOME } from '../safe-logger.mjs';

/**
 * @param {{
 *   context: import('../../composition/context.mjs').Context,
 *   logSafe: (level: string, message: string, record: object) => void,
 *   publish: (event: string, params: object) => Promise<void>,
 *   toPublicErrorCode: (code: unknown) => string,
 *   fallbackPublicCode: string,
 * }} deps
 */
export function createSnapshotHelpers({ context, logSafe, publish, toPublicErrorCode, fallbackPublicCode }) {
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
      return { ok: false, code: fallbackPublicCode };
    }
    await publish('room:state', { roomId, sessionId, payload: snapshot.value });
    return { ok: true };
  }

  return { eligiblePlayerCount, playerCountOf, isBeforeFirstRound, sessionIdOfPlayer, sendSnapshot };
}
