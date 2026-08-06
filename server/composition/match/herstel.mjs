// server/composition/match/herstel.mjs
//
// Herstel na een serverherstart (C-3, ARCHITECTURE §10).
//
// Dit pad leunt op de aanname dat een FASEDEADLINE een herstart niet overleeft:
// `phaseEndsAt` is vluchtig en wordt nooit opgeslagen (besluit 16, zie
// `fases.mjs`). Precies dáárom moet er hersteld worden — de state staat er nog,
// de timers niet.

import { EVENT_TYPES, PHASES } from '../../architecture/state-machine.js';
import {
  applyTransition,
  CONTENT_UNAVAILABLE,
  SERVER_RECOVERY_REASON,
  succeed,
} from './gedeeld.mjs';

/** De fasen waarin een match "onderweg" is en dus hersteld moet worden. */
const RECOVERABLE_PHASES = Object.freeze([
  PHASES.COUNTDOWN,
  PHASES.ROUND_ACTIVE,
  PHASES.ROUND_RESULT,
  PHASES.SCOREBOARD,
]);

/**
 * Zet elke onderweg zijnde match op `PAUSED(server_recovery)`.
 *
 * WAAROM DIT BESTAAT. Redis houdt room, match, ronde, antwoorden en scores
 * vast — dat overleeft een herstart. Wat níét overleeft zijn de timers en de
 * socketverbindingen: die leven in het geheugen van het proces. Zonder dit pad
 * blijft de state dus correct staan terwijl niemand de avond nog in beweging
 * zet, en kijkt de groep naar een scherm dat niet meer verandert.
 *
 * WAT DIT BEWUST NIET DOET:
 *
 * - **Geen verlopen antwoordvenster hervatten.** Een ronde die liep, wordt niet
 *   voortgezet: het venster is verstreken en de clients hebben geen lopende
 *   timer meer. `resolveNextPhase` stuurt een `server_recovery`-pauze daarom
 *   naar COUNTDOWN, niet terug naar de vorige fase.
 * - **Geen punten weggooien.** Scoren gebeurt bij het aannemen van het
 *   antwoord (`saveAcceptedAnswerAtomically` schrijft Answer én Player in één
 *   keer), niet pas bij het sluiten van de ronde. De antwoorden die vóór de
 *   herstart binnenkwamen tellen dus gewoon mee; alleen de reveal van die ene
 *   ronde slaan we over.
 * - **Niet zelf hervatten.** De groep zat op dat moment niet klaar. Hervatten
 *   is een hostactie (`game:resume`), met een nieuwe aftelling.
 * - **Geen dubbele timers.** De runtime is na een herstart per definitie leeg,
 *   en elke geplande overgang loopt langs de compare-and-set van
 *   `setRoomAndMatchPhaseAtomically` — een tweede winnaar bestaat niet.
 *
 * Idempotent: een match die al PAUSED staat wordt niet nog eens gepauzeerd, dus
 * twee keer aanroepen (of herstarten tijdens het herstel) is veilig.
 *
 * @param {import('../context.mjs').Context} context
 * @returns {Promise<{ ok: true, value: { scanned: number, recovered: number, outcomes: Array<{ roomId: string, outcome: string }> } }>}
 */
export async function recoverActiveRooms(context) {
  let roomIds;
  try {
    roomIds = await context.store.listActiveRoomIds();
  } catch (error) {
    // De opslag is niet bereikbaar. Dat is een opstartprobleem van een andere
    // orde; hier niet omheen bouwen, wel zichtbaar teruggeven.
    return { ok: false, code: CONTENT_UNAVAILABLE, contentFailure: { gameType: null, reason: String(error) } };
  }

  const outcomes = [];
  for (const roomId of roomIds) {
    outcomes.push({ roomId, outcome: await recoverRoom(context, roomId) });
  }
  return succeed({
    scanned: roomIds.length,
    recovered: outcomes.filter((entry) => entry.outcome === 'paused').length,
    outcomes,
  });
}

/**
 * @param {import('../context.mjs').Context} context
 * @param {string} roomId
 * @returns {Promise<'gone' | 'no_match' | 'not_active' | 'already_paused' | 'paused' | 'failed'>}
 */
async function recoverRoom(context, roomId) {
  const room = await context.store.loadRoom(roomId);
  // `rooms:active` heeft bewust geen TTL terwijl roomdocumenten die wél hebben:
  // een verlopen room in de index is normaal, geen fout.
  if (room === null) return 'gone';
  if (room.currentMatchId === null) return 'no_match';

  const match = await context.store.loadMatch(roomId, room.currentMatchId);
  if (match === null) return 'gone';
  if (match.phase === PHASES.PAUSED) return 'already_paused';
  if (!RECOVERABLE_PHASES.includes(match.phase)) return 'not_active';

  const applied = await applyTransition(context, {
    room,
    match,
    event: {
      type: EVENT_TYPES.HOST_PAUSE,
      reason: SERVER_RECOVERY_REASON,
      // Expliciet 0: `remainingMs` belooft de client hoeveel er van de vorige
      // fase over was. Bij een herstelpauze zetten we die belofte niet, want
      // we hervatten die fase juist niet — er komt een verse aftelling.
      remainingMs: 0,
    },
  });
  return applied.ok ? 'paused' : 'failed';
}
