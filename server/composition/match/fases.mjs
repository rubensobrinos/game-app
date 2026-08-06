// server/composition/match/fases.mjs
//
// De fasewissel als publieke handeling (`advancePhase`), de bestemmingskeuze
// (`resolveNextPhase`) en de hulpjes die daar omheen hangen.
//
// TWEE DINGEN DIE HIER STIL KUNNEN BREKEN — zie
// docs/openstaand/refactor/8-match-lifecycle.md:
//
// 1. `resolveNextPhase` IS GEEN TWEEDE FASETABEL. `state-machine.js` bepaalt
//    wát mag; deze functie kiest alleen de bestemming, omdat de reducer
//    `roundIndex`/`totalRounds`/`scoreboardFrequency` bewust niet kent. De
//    keuze die hier valt wordt daarna alsnog door `transition()` gekeurd (in
//    `applyTransition`, `gedeeld.mjs`). Dat onderscheid moet intact blijven:
//    wie hier legaliteit gaat beslissen, heeft twee bronnen van waarheid.
// 2. `phaseEndsAt` IS VLUCHTIG EN WORDT NOOIT OPGESLAGEN (besluit 16). De
//    waarde gaat uitsluitend het RESULTAAT in, nooit een Match- of
//    Round-document. Trekt iemand hem per ongeluk in de opgeslagen state, dan
//    breekt het herstel na een serverherstart — dat pad (`herstel.mjs`) gaat er
//    juist van uit dat een fasedeadline een herstart niet overleeft.
//
// En een derde, die in dit bestand woont maar zijn eigen waarschuwing draagt:
// `resumeDeadlineFor` — de hervattijd na een pauze, onderaan.

import { EVENT_TYPES, PHASES } from '../../architecture/state-machine.js';
import { assertRoundShape } from '../../data/types/round.js';
import {
  applyTransition,
  loadCurrentRound,
  loadRoomAndMatch,
  SERVER_RECOVERY_REASON,
  succeed,
} from './gedeeld.mjs';

/**
 * Startcountdown: 3 s, expliciet NIET instelbaar (GAME-RULES.md
 * §Rondestructuur). `countdownEndsAt` is vluchtig en wordt bij de transitie
 * berekend, niet persistent opgeslagen (besluit 16).
 */
export const COUNTDOWN_SECONDS = 3;

/**
 * KEUZE — `scoreboardFrequency` is in server/data/types/game-configuration.js
 * bewust een open string; GAME-RULES.md noemt "elke ronde / periodiek / uit"
 * zonder het periodieke interval vast te leggen. Gekozen: elke 3 rondes, plus
 * altijd na de laatste ronde. Eén constante om te wijzigen zodra een bron het
 * interval vastlegt.
 */
const PERIODIC_SCOREBOARD_EVERY = 3;

/** Waarden van `scoreboardFrequency` die de tussenstand uitzetten. */
const SCOREBOARD_OFF_VALUES = Object.freeze(['off', 'none', 'never', 'uit']);

/**
 * KEUZE — besluit 11 somt de vier MVP-pauzeredenen op (`host`,
 * `host_disconnected`, `no_answers`, `server_recovery`) maar maakt er geen
 * gesloten enum van. `transition()` eist een niet-lege `reason`; PROTOCOL.md
 * definieert `game:pause` als `{ reason?: string }`. Een ontbrekende reden
 * wordt hier aangevuld met de meest voorkomende (`host`) in plaats van een
 * interne `INVALID_PAUSE_STATE` te veroorzaken. Elke meegegeven waarde gaat
 * ongewijzigd door naar de reducer.
 */
const DEFAULT_PAUSE_REASON = 'host';

/** Toont deze ronde een tussenstand? */
function showsScoreboard(config, roundNumber) {
  const frequency = String(config.scoreboardFrequency);
  if (SCOREBOARD_OFF_VALUES.includes(frequency)) {
    return false;
  }
  if (frequency === 'periodic') {
    return roundNumber % PERIODIC_SCOREBOARD_EVERY === 0 || roundNumber >= config.totalRounds;
  }
  // `every_round` en elke onbekende waarde: tussenstand aan.
  return true;
}

/**
 * De fase waarin bij host-tempo de ENE hostactie van de ronde zit
 * (besluit 1): dat is ALTIJD SCOREBOARD, in elke configuratie.
 * state-machine.js heeft `HOST_NEXT` vanuit ROUND_RESULT bewust verwijderd
 * (INT-10: die tak liep vast op client/flow/host-controls-state.mjs, dat de
 * hostactie alleen bij SCOREBOARD aanbiedt). `scoreboardFrequency: 'uit'`
 * betekent bij host-tempo dus "toon geen tussenstand", niet "sla de fase over".
 */
function isHostActionPhase(phase) {
  return phase === PHASES.SCOREBOARD;
}

/** Duur van een timergedreven fase in ms, of null als de fase geen timer heeft. */
function phaseDurationMs(config, phase) {
  switch (phase) {
    case PHASES.COUNTDOWN:
      return COUNTDOWN_SECONDS * 1000;
    case PHASES.ROUND_ACTIVE:
      return config.questionSeconds * 1000;
    case PHASES.ROUND_RESULT:
      return config.resultSeconds * 1000;
    case PHASES.SCOREBOARD:
      return config.scoreboardSeconds * 1000;
    default:
      return null;
  }
}

/**
 * Wanneer de nieuwe fase vanzelf afloopt. Vluchtig, nooit opgeslagen
 * (besluit 16). `null` betekent "wacht op een hostactie of op een expliciete
 * aanroep".
 *
 * GEËXPORTEERD binnen deze map (niet naar buiten): `endRound` in `rondes.mjs`
 * zet dezelfde waarde in zijn resultaat. Dat blijft één berekening; een tweede
 * kopie daar zou de twee stilzwijgend uit elkaar kunnen laten lopen.
 */
export function phaseEndsAt(room, phase, now) {
  if (room.config.pacing === 'host' && isHostActionPhase(phase)) {
    return null;
  }
  const duration = phaseDurationMs(room.config, phase);
  return duration === null ? null : now + duration;
}

/**
 * Kiest de bestemming van de eerstvolgende overgang. Dit is GEEN tweede
 * fasetabel: state-machine.js delegeert de keuze van `nextPhase` expliciet aan
 * de aanroeper (het kent roundIndex/totalRounds/scoreboardFrequency bewust
 * niet) en valideert de gekozen bestemming daarna alsnog. Levert `null` als er
 * vanuit deze fase niets te kiezen valt.
 *
 * @param {import('../../data/types/room.js').Room} room
 * @param {import('../../data/types/match.js').Match} match
 * @returns {string|null}
 */
export function resolveNextPhase(room, match) {
  const roundNumber = match.roundIndex + 1;
  const isLastRound = roundNumber >= room.config.totalRounds;

  switch (match.phase) {
    case PHASES.LOBBY:
      return PHASES.COUNTDOWN;
    case PHASES.COUNTDOWN:
      return PHASES.ROUND_ACTIVE;
    case PHASES.ROUND_ACTIVE:
      return PHASES.ROUND_RESULT;
    case PHASES.ROUND_RESULT:
      // Besluit 1: bij host-tempo loopt de uitslag ALTIJD op zijn timer door
      // naar SCOREBOARD — daar zit de enige hostactie van de ronde, ook als de
      // tussenstand niets toont. Bij auto-tempo beslist scoreboardFrequency.
      if (room.config.pacing === 'host' || showsScoreboard(room.config, roundNumber)) {
        return PHASES.SCOREBOARD;
      }
      return isLastRound ? PHASES.FINISHED : PHASES.COUNTDOWN;
    case PHASES.SCOREBOARD:
      return isLastRound ? PHASES.FINISHED : PHASES.COUNTDOWN;
    case PHASES.PAUSED:
      if (match.pausedState === null) return null;
      // C-3 (5 aug 2026): een pauze die dóór een serverherstart is ontstaan
      // hervat NOOIT de fase waar hij vandaan kwam. De ronde die toen liep is
      // niet voort te zetten — het antwoordvenster is verlopen en de client
      // heeft geen lopende timer meer. Hervatten gaat via een nieuwe
      // aftelling, precies de enige bestemming die `RECOVERY_RESUME` in de
      // state machine toestaat (ARCHITECTURE §10).
      if (match.pausedState.reason === SERVER_RECOVERY_REASON) {
        return PHASES.COUNTDOWN;
      }
      return match.pausedState.previousPhase;
    default:
      return null;
  }
}

/**
 * De resterende tijd die in `pausedState` hoort (besluit 10). Alleen tijdens
 * ROUND_ACTIVE is die uit persistente state af te leiden (`Round.endsAt`); de
 * overige fasedeadlines zijn vluchtig (besluit 16) en moet de aanroeper zelf
 * meegeven.
 */
function remainingMsForPause(match, activeRound, now) {
  if (match.phase !== PHASES.ROUND_ACTIVE || activeRound === null) {
    return null;
  }
  return Math.max(0, activeRound.endsAt - now);
}

/**
 * Normaliseert een binnenkomend event: vult een ontbrekende `nextPhase` aan
 * met `resolveNextPhase` en een ontbrekende pauzereden/`remainingMs`.
 * Verandert nooit een waarde die de aanroeper zelf heeft meegegeven.
 */
function normalizeEvent(room, match, event, activeRound, now) {
  if (event === null || typeof event !== 'object') {
    return event;
  }
  if (event.type === EVENT_TYPES.HOST_PAUSE) {
    const remainingMs = event.remainingMs !== undefined
      ? event.remainingMs
      : remainingMsForPause(match, activeRound, now);
    return {
      ...event,
      reason: event.reason === undefined ? DEFAULT_PAUSE_REASON : event.reason,
      ...(remainingMs === null ? {} : { remainingMs }),
    };
  }
  if (event.nextPhase !== undefined) {
    return event;
  }
  const nextPhase = resolveNextPhase(room, match);
  return nextPhase === null ? event : { ...event, nextPhase };
}

/**
 * DE HERVATTIJD NA EEN PAUZE. Raak deze berekening niet aan.
 *
 * De nieuwe `Round.endsAt` bij het hervatten van een gepauzeerde RONDE, of
 * `null` als deze overgang daar niet over gaat.
 *
 * Alleen wanneer we vanuit PAUSED terugkeren naar ROUND_ACTIVE: de andere
 * fases hebben geen persistente deadline (besluit 16, die zijn vluchtig) en
 * regelen zichzelf via `phaseEndsAt`.
 *
 * DIT WAS EEN ECHTE BUG (5 aug 2026, gevonden bij R2-7): de deadline schoof
 * niet op, de gepauzeerde seconden gingen verloren én de match bleef hangen. De
 * mocktransport deed het wél goed, waardoor drieduizend tests groen bleven —
 * de suite bewees de mock, niet de server. Zie ook de uitgebreide toelichting
 * in `advancePhase` hieronder, op de plek waar de uitkomst wordt weggeschreven.
 *
 * @param {import('../../data/types/match.js').Match} match - de stand VÓÓR de transitie
 * @param {{ type: string, nextPhase?: string }} event
 * @param {number} now
 * @returns {number | null}
 */
function resumeDeadlineFor(match, event, now) {
  const hervat = event.type === EVENT_TYPES.HOST_RESUME || event.type === EVENT_TYPES.RECOVERY_RESUME;
  if (!hervat) return null;
  if (match.phase !== PHASES.PAUSED || match.pausedState === null) return null;
  if (event.nextPhase !== PHASES.ROUND_ACTIVE) return null;
  const rest = match.pausedState.remainingMs;
  return typeof rest === 'number' && Number.isFinite(rest) && rest >= 0 ? now + rest : null;
}

/**
 * De enige publieke ingang die fases wisselt (`game:next`, `game:pause`,
 * `game:resume`, en elke timergedreven overgang).
 *
 * `event` is een state-machine-Event. `nextPhase` mag ontbreken: dan vult
 * `resolveNextPhase` hem aan en valideert `transition()` de keuze alsnog.
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string, event: { type: string, nextPhase?: string, reason?: string, remainingMs?: number } }} params
 */
export async function advancePhase(context, { roomId, event } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;

  const now = context.now();
  const activeRound = await loadCurrentRound(context, room, match);
  const normalized = normalizeEvent(room, match, event, activeRound, now);

  // De pauzeduur van de RONDE moet hier worden ingelopen, vóór de transitie:
  // daarna is `pausedState` weg (de state machine zet 'm op null) en is de
  // resterende tijd niet meer te achterhalen.
  const hervatDeadline = resumeDeadlineFor(match, normalized, now);

  const applied = await applyTransition(context, { room, match, event: normalized });
  if (!applied.ok) {
    return applied;
  }

  // ROND HERVATTEN NA EEN PAUZE (5 aug 2026, gevonden bij R2-7).
  //
  // `Round.endsAt` werd één keer geschreven en bij hervatten nooit
  // opgeschoven, terwijl de pauze de resterende tijd wél bewaart
  // (`pausedState.remainingMs`). Gevolg: de pauzeseconden waren gewoon weg —
  // de client telde door naar een wandklok-deadline die tijdens de pauze
  // gewoon doorliep. Pauzeer je acht seconden, dan verlies je acht seconden
  // antwoordtijd. De mocktransport deed dit wél goed, en dáárom zag geen
  // enkele test of mockmeting dit: de suite bewees de mock, niet de server.
  let hervatteRonde = null;
  if (hervatDeadline !== null && activeRound !== null) {
    hervatteRonde = { ...activeRound, endsAt: hervatDeadline };
    assertRoundShape(hervatteRonde);
    await context.store.saveRound(roomId, hervatteRonde);
  }

  const updated = applied.value.match;
  return succeed({
    matchId: updated.id,
    phase: updated.phase,
    previousPhase: applied.value.previousPhase,
    roundIndex: updated.roundIndex,
    roundNumber: updated.roundIndex + 1,
    totalRounds: room.config.totalRounds,
    pausedState: updated.pausedState,
    phaseEndsAt: phaseEndsAt(room, updated.phase, now),
    // De nieuwe rondedeadline reist mee zodat de transportlaag zijn timer
    // opnieuw kan plannen én de clients hun timer kunnen gelijkzetten.
    ...(hervatteRonde === null ? {} : { roundEndsAt: hervatteRonde.endsAt, roundId: hervatteRonde.id }),
  });
}
