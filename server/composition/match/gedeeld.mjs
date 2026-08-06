// server/composition/match/gedeeld.mjs
//
// Het gereedschap dat méér dan één handeling nodig heeft, plus de drie harde
// regels die voor de hele map gelden. Wat hier staat, stond vóór de
// opsplitsing als privéhelper in `match-lifecycle.mjs` en is letterlijk
// verhuisd.
//
// `applyTransition` is de kern van dit bestand: de ENIGE plek die een fase
// wisselt. Elke handeling in deze map loopt erlangs. Dat het hier staat en niet
// in `fases.mjs` is opzet — `fases.mjs` zou dan door alle andere bestanden
// geïmporteerd worden en de "gedeeld"-laag alsnog zijn, alleen met een naam die
// dat verbergt.
//
// DRIE HARDE REGELS IN DEZE MAP
//
// 1. `transition()` uit server/architecture/state-machine.js is de ENIGE bron
//    van faselegaliteit. Er staat hier nergens een tweede fasetabel.
//    `resolveNextPhase` (in `fases.mjs`) KIEST een bestemming — dat is expliciet
//    aan de aanroeper gedelegeerd, zie de modulekop van state-machine.js
//    ("Kennis van roundIndex/totalRounds/scoreboardFrequency zit bewust bij de
//    aanroeper") — maar de reducer beslist of die bestemming mag.
// 2. `Match.phase` EN `Match.pausedState` worden uitsluitend geschreven door
//    `setRoomAndMatchPhaseAtomically` (besluit 30 + DM19). Elke andere
//    `saveMatch()` in deze map laat beide velden ongemoeid op de waarde die
//    al in de store staat, zodat er nooit een niet-atomair dual-write-pad
//    ontstaat. Vóór DM19 schreef de compositie `pausedState` in een eigen
//    `saveMatch` vlak vóór de fasewissel; dat was precies het pad dat INT-16
//    aankaartte en het is hier weg.
// 3. `correctAnswer` gaat het Round-document in en verlaat deze map nooit
//    vóór `endRound` (besluit 20). `startRound` en `buildSnapshot` bouwen hun
//    publieke payload via een expliciete allowlist, niet via een spread.

import { ERROR_CODES as STATE_MACHINE_ERROR_CODES, EVENT_TYPES, PHASES, transition } from '../../architecture/state-machine.js';
import { assertMatchShape } from '../../data/types/match.js';
import { ALL_ERROR_CODES } from '../../protocol/error-codes.mjs';
import { createContentSource } from '../content-source.mjs';
import { touchRoom } from '../room-lifecycle.mjs';

/**
 * De foutcodes die deze module kan retourneren. Geen losse stringliterals:
 * `error-codes.mjs` is de single source of truth, en dit faalt bij module-load
 * als een code daar ooit uit verdwijnt.
 */
export const CODES = Object.freeze({
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED',
  INVALID_PHASE: 'INVALID_PHASE',
  ROUND_NOT_ACTIVE: 'ROUND_NOT_ACTIVE',
  NOT_PLAYER: 'NOT_PLAYER',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNSUPPORTED_EVENT: 'UNSUPPORTED_EVENT',
  ALREADY_ANSWERED: 'ALREADY_ANSWERED',
});
for (const code of Object.values(CODES)) {
  if (!ALL_ERROR_CODES.has(code)) {
    throw new Error(`match-lifecycle: foutcode "${code}" ontbreekt in ALL_ERROR_CODES`);
  }
}

/**
 * INTERNE uitkomst, bewust GEEN gepubliceerde foutcode (INT-7).
 *
 * Een timergedreven overgang die de dubbele compare-and-set van
 * `setRoomAndMatchPhaseAtomically` verliest, is geen fout: iemand anders — een
 * host die `game:finish` stuurde terwijl de fasepomp naar SCOREBOARD wilde —
 * heeft de fase al verder gezet. De winnaar blijft staan, de pomp stopt
 * stilletjes en er gaat GEEN foutcode naar een client. Deze code bestaat
 * alleen om die stille stop intern zichtbaar te maken (de transportlaag logt
 * hem; zijn `toPublicErrorCode()` maakt er `INVALID_PHASE` van mocht hij ooit
 * tóch richting een client lopen — zelfde vangnet als voor
 * `INVALID_PAUSE_STATE`, besluit 12).
 *
 * Hij staat daarom expliciet NIET in `ALL_ERROR_CODES`; die assertie hieronder
 * is het slot op de deur.
 */
export const PHASE_RACE_LOST = 'PHASE_RACE_LOST';
if (ALL_ERROR_CODES.has(PHASE_RACE_LOST)) {
  throw new Error(`match-lifecycle: "${PHASE_RACE_LOST}" is intern en mag geen gepubliceerde foutcode zijn`);
}

/**
 * De pauzereden die het herstelpad zet (ARCHITECTURE §10, besluit 11 kent hem
 * al als eigen reden). Alles wat op deze waarde reageert staat in deze map: de
 * bestemming bij hervatten (`resolveNextPhase` in `fases.mjs` — COUNTDOWN, niet
 * de vorige fase) en de uitkomstlabels van `recoverActiveRooms` in
 * `herstel.mjs`.
 */
export const SERVER_RECOVERY_REASON = 'server_recovery';

/**
 * INTERNE uitkomst nummer twee (5 aug 2026, PLAN-CONVERGENTIE §A0): de
 * contentbron kon voor deze gameType geen vraag bouwen.
 *
 * Bewust géén gepubliceerde foutcode. Niemand wacht op een ack — `startRound`
 * draait op de fasepomp — en er bestaat geen zinnige clientactie: dit is een
 * configuratiefout van ons, geen verkeerd verzoek van de speler. De
 * transportlaag logt hem op `error` (in tegenstelling tot `PHASE_RACE_LOST`,
 * die normaal gedrag beschrijft); `toPublicErrorCode()` maakt er de generieke
 * fallback van mocht hij ooit tóch richting een client lopen.
 */
export const CONTENT_UNAVAILABLE = 'CONTENT_UNAVAILABLE';
if (ALL_ERROR_CODES.has(CONTENT_UNAVAILABLE)) {
  throw new Error(`match-lifecycle: "${CONTENT_UNAVAILABLE}" is intern en mag geen gepubliceerde foutcode zijn`);
}

/**
 * Wie de overgang heeft aangevraagd. Dit is de ENIGE as waarlangs deze module
 * beslist wat een verloren compare-and-set betekent (INT-7):
 *
 *   - **Hostactie** — de host drukte een knop op een scherm dat inmiddels
 *     achterhaald is. Hij hoort een nette, gepubliceerde foutcode terug te
 *     krijgen (`INVALID_PHASE`: "de game staat niet in de fase die je dacht"),
 *     zodat de client een verse snapshot ophaalt. Geen nieuwe foutcode — deze
 *     bestaande betekent exact dit.
 *   - **Servergedreven** — de fasepomp of een herstelpad. Niemand wacht op een
 *     ack, dus een verloren race is geen foutmelding maar een stille stop
 *     (`PHASE_RACE_LOST`, intern).
 *
 * De volledigheidscontrole bij module-load is opzet: komt er een achtste
 * eventtype bij, dan faalt dit bestand meteen in plaats van dat het nieuwe
 * type stilzwijgend in de verkeerde emmer valt.
 */
const HOST_EVENT_TYPES = Object.freeze(new Set([
  EVENT_TYPES.HOST_START,
  EVENT_TYPES.HOST_NEXT,
  EVENT_TYPES.HOST_PAUSE,
  EVENT_TYPES.HOST_RESUME,
  EVENT_TYPES.HOST_FINISH,
  // `game:rematch` is bewust GEEN state-machine-event (zie `rematch()`: de
  // machine kent geen uitgang uit FINISHED), maar het is wél een hostknop en
  // hoort bij een verloren race dus dezelfde behandeling te krijgen. Alleen
  // dáárvoor staat dit label hier; `EVENT_TYPES` blijft ongemoeid.
  'HOST_REMATCH',
]));
const SERVER_EVENT_TYPES = Object.freeze(new Set([
  EVENT_TYPES.TIMER_ELAPSED,
  EVENT_TYPES.RECOVERY_RESUME,
]));
for (const type of Object.values(EVENT_TYPES)) {
  if (HOST_EVENT_TYPES.has(type) === SERVER_EVENT_TYPES.has(type)) {
    throw new Error(
      `match-lifecycle: eventtype "${type}" is niet eenduidig geclassificeerd als hostactie of servergedreven`,
    );
  }
}

/**
 * `Round.status` is een open string (server/data/types/round.js); alleen
 * "ACTIVE" staat letterlijk in DATA-MODEL.md. "ENDED" is de tegenhanger die
 * server/data/answer-flow.test.js al gebruikt — daar aangesloten in plaats van
 * een derde waarde te introduceren.
 */
export const ROUND_STATUS_ACTIVE = 'ACTIVE';
export const ROUND_STATUS_ENDED = 'ENDED';

/** @param {string} code @returns {{ ok: false, code: string }} */
export function fail(code) {
  return { ok: false, code };
}

/** @param {object} value @returns {{ ok: true, value: object }} */
export function succeed(value) {
  return { ok: true, value };
}

/**
 * Het antwoord op een verloren dubbele compare-and-set van
 * `setRoomAndMatchPhaseAtomically` (INT-7).
 *
 * De store heeft NIETS gemuteerd — de fase die er staat is die van de winnaar,
 * en die blijft staan. Wat er terugkomt hangt uitsluitend af van wie de
 * overgang aanvroeg (zie `HOST_EVENT_TYPES`): een hostactie krijgt de
 * gepubliceerde `INVALID_PHASE` zodat de client een verse snapshot kan halen,
 * een servergedreven overgang de interne `PHASE_RACE_LOST` die nooit een client
 * bereikt.
 *
 * `conflict` is diagnostiek voor de aanroeper/logs, geen wire-payload: het
 * protocol kent geen veld waarin dit terechtkomt, en de transportlaag geeft
 * alleen `code` door.
 *
 * @param {string} eventType
 * @param {string} expectedPhase de fase die de compositie las vlak vóór de CAS
 * @param {string} actualPhase `Match.phase` op het moment van de CAS (besluit 30)
 */
export function phaseConflict(eventType, expectedPhase, actualPhase) {
  return {
    ok: false,
    code: HOST_EVENT_TYPES.has(eventType) ? CODES.INVALID_PHASE : PHASE_RACE_LOST,
    conflict: { eventType, expectedPhase, actualPhase },
  };
}

/**
 * Vertaalt een reducer-foutcode naar een code die de wire mag halen.
 *
 * `INVALID_PAUSE_STATE` is per besluit 12 INTERN: state-machine.js stelt
 * expliciet dat de adapter hem MOET afvangen "voordat er iets naar een client
 * gaat — nooit ongefilterd doorsturen". Deze module is de laatste laag die dat
 * kan; de transportlaag geeft `code` één-op-één door.
 * @param {string} code
 * @returns {string}
 */
export function toWireCode(code) {
  return ALL_ERROR_CODES.has(code) ? code : CODES.INVALID_PHASE;
}

/** Spelers die nog echt meedoen. */
export function activePlayers(players) {
  return players.filter((player) => player.kicked !== true && player.left !== true);
}

/** Spelers die in de eindstand horen: gekickt valt af, vrijwillig vertrokken niet. */
export function rankablePlayers(players) {
  return players.filter((player) => player.kicked !== true);
}

/**
 * De contentbron voor deze room: `../content-source.mjs`, dat sinds CT1 de
 * echte pool uit `shared/content/` gebruikt (geen stub meer).
 *
 * `contentVersion` is verplicht op de context omdat besluit 21 hem canoniek en
 * ONVERANDERLIJK op `Match` maakt: een stilzwijgende default zou een verzonnen
 * versie in echte Match-documenten pinnen. `rendererVersion` en `random`
 * mogen ontbreken; de contentbron heeft daar zelf een default voor.
 *
 * @param {import('../context.mjs').Context} context
 * @param {import('../../data/types/room.js').Room} room
 */
export function contentSourceFor(context, room) {
  const { contentVersion, rendererVersion, random } = context.config;
  if (typeof contentVersion !== 'string' || contentVersion.length === 0) {
    throw new TypeError(
      'match-lifecycle: `context.config.contentVersion` is verplicht (besluit 21: canoniek en onveranderlijk op Match).',
    );
  }
  return createContentSource({
    contentVersion,
    language: room.config.language,
    difficulty: room.config.difficulty,
    ...(rendererVersion === undefined ? {} : { rendererVersion }),
    ...(random === undefined ? {} : { random }),
    // Punt 7 (continentfilter.md): `room.config.continents` is sinds
    // besluit 52 verplicht op elke GameConfiguration (default: alle zes),
    // dus dit is nooit `undefined` in een echte room — alleen fixtures uit
    // vóór dat besluit zouden het veld kunnen missen.
    continents: room.config.continents,
  });
}

/**
 * De ene gameType van deze match (besluit 32). Gepind op het Match-document
 * bij creatie; `room.config.gameTypes[0]` is de bron bij een match die nog
 * geen gepinde waarde heeft.
 * @param {import('../../data/types/room.js').Room} room
 * @param {object|null} match
 * @returns {string}
 */
export function matchGameType(room, match) {
  if (match !== null && typeof match.gameType === 'string' && match.gameType.length > 0) {
    return match.gameType;
  }
  return room.config.gameTypes[0];
}

/**
 * Laadt room + huidige match in één stap.
 * @param {import('../context.mjs').Context} context
 * @param {string} roomId
 * @param {{ requireMatch?: boolean }} [options]
 */
export async function loadRoomAndMatch(context, roomId, { requireMatch = true } = {}) {
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  const match = room.currentMatchId === null
    ? null
    : await context.store.loadMatch(roomId, room.currentMatchId);
  if (requireMatch && match === null) {
    // Er is nog geen match: elke fase-actie is in deze toestand ongeldig.
    return fail(CODES.INVALID_PHASE);
  }
  return succeed({ room, match });
}

/** Laadt de ronde die op dit moment de "huidige" is, of null. */
export async function loadCurrentRound(context, room, match) {
  if (match === null || match.roundIds.length === 0) {
    return null;
  }
  const roundId = match.roundIds[match.roundIds.length - 1];
  return context.store.loadRound(room.id, match.id, roundId);
}

/**
 * De Match-velden die bij een specifieke overgang meeveranderen. Puur
 * boekhouding rond de fase; de fase zelf zit er niet in.
 */
function transitionPatch(match, fromPhase, toPhase, now) {
  const patch = {};
  const leavesRound = fromPhase === PHASES.ROUND_RESULT || fromPhase === PHASES.SCOREBOARD;
  const entersRound = toPhase === PHASES.COUNTDOWN || toPhase === PHASES.ROUND_ACTIVE;
  if (leavesRound && entersRound) {
    // roundIndex is 0-based en wijst de ronde aan die nú gespeeld wordt.
    patch.roundIndex = match.roundIndex + 1;
  }
  if (toPhase === PHASES.FINISHED && match.finishedAt === null) {
    patch.finishedAt = now;
  }
  return patch;
}

/**
 * De enige plek die een fase wisselt. Legaliteit komt volledig uit
 * `transition()`; deze functie doet daarna alleen de schrijfvolgorde.
 *
 * SCHRIJFVOLGORDE. Eerst de BOEKHOUDING (`roundIndex`, `roundIds`,
 * `usedQuestionKeys`, `finishedAt`) via `saveMatch`, met `phase` én
 * `pausedState` ongemoeid; daarna flipt `setRoomAndMatchPhaseAtomically` in
 * ÉÉN operatie `Room.phase`, `Match.phase` en `Match.pausedState`
 * (besluit 30 + DM19). Zo schrijft nooit iets anders dan die ene atomaire
 * operatie een fase, en is de enige zichtbare tussentoestand "oude fase, nieuwe
 * boekhouding". Valt er niets te boekhouden — een pauze en een hervatting zijn
 * precies dat geval — dan blijft die `saveMatch` volledig achterwege en is de
 * atomaire operatie de ENIGE schrijfactie van de hele overgang.
 *
 * COMPARE-AND-SET (DM19). `expectedPhase` is `match.phase`: exact de fase die
 * hierboven is ingelezen en die de reducer zojuist heeft beoordeeld — niet een
 * opnieuw afgeleide waarde, want dan bewaakt de CAS niets. Verliest hij, dan
 * heeft de store niets gemuteerd en beslist `phaseConflict()` wat de aanroeper
 * hoort te zien (INT-7).
 *
 * @returns {{ ok: true, value: { match: object, previousPhase: string } }
 *   | { ok: false, code: string, conflict?: object }}
 */
export async function applyTransition(context, { room, match, event, extraPatch = {} }) {
  const now = context.now();
  const result = transition(
    { phase: match.phase, pausedState: match.pausedState },
    event,
    room.config.pacing,
    now,
  );
  if (!result.ok) {
    return fail(toWireCode(result.code));
  }

  const nextPhase = result.state.phase;
  const nextPausedState = result.state.pausedState;
  // De boekhouding rond de fase — bewust ZONDER `pausedState`: dat veld gaat
  // sinds DM19 mee in de atomaire operatie en mag hier niet nog eens geschreven
  // worden (dat was het dual-write-pad van INT-16).
  const bookkeeping = { ...transitionPatch(match, match.phase, nextPhase, now), ...extraPatch };

  // Het vangnet keurt het EINDRESULTAAT, inclusief de fase en de pausedState
  // die de atomaire operatie zo gaat zetten.
  const committed = { ...match, ...bookkeeping, phase: nextPhase, pausedState: nextPausedState };
  assertMatchShape(committed);

  if (Object.keys(bookkeeping).length > 0) {
    await context.store.saveMatch({
      ...match,
      ...bookkeeping,
      phase: match.phase,
      pausedState: match.pausedState,
    });
  }

  const applied = await context.store.setRoomAndMatchPhaseAtomically(room.id, match.id, {
    expectedPhase: match.phase,
    newPhase: nextPhase,
    pausedState: nextPausedState,
  });
  if (!applied.ok) {
    return phaseConflict(event.type, match.phase, applied.actualPhase);
  }

  // Fase 3 (agent 1, F1/F2 — "de room mag niet doodgaan tijdens het
  // spelen"). DIT IS DE ENE PLEK die de room-TTL tijdens een lopende match
  // verlengt: `applyTransition` is de enige weg naar een fase-overgang
  // (`startMatch`, `startRound`, `endRound`, `advancePhase`/pauzeren/
  // hervatten, `finishMatch`, `recoverRoom` lopen er allemaal doorheen), en
  // een fase-overgang gebeurt een handvol keer per ronde — niet honderd keer
  // zoals bij een schrijfactie per binnenkomend antwoord. `submitAnswer` roept
  // dit daarom bewust NIET aan.
  //
  // `room` is de kopie die de AANROEPER vóór de transitie inlas — dus nog met
  // de OUDE fase. `touchRoom` doet een heel-document-write (INT-7): zonder
  // correctie zou die de fase die de CAS hierboven zojuist atomair heeft
  // gezet, terugschrijven naar de oude waarde. Vandaar expliciet `phase:
  // nextPhase` in `extraFields` — dezelfde fase die `setRoomAndMatchPhaseAtomically`
  // net heeft vastgelegd, niet een herleiding.
  await touchRoom(context, room, now, { phase: nextPhase });

  return succeed({ match: committed, previousPhase: match.phase });
}

// De interne codes van de state machine zijn hier bewust geïmporteerd zodat de
// afhankelijkheid zichtbaar is in de importlijst: `toWireCode` moet blijven
// werken zodra er een tweede interne code bijkomt.
export const INTERNAL_STATE_MACHINE_CODES = Object.freeze(
  Object.values(STATE_MACHINE_ERROR_CODES).filter((code) => !ALL_ERROR_CODES.has(code)),
);
