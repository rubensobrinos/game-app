// server/composition/match-lifecycle.mjs
//
// Compositie rond Match, Round en Answer: match starten, fases wisselen,
// rondes bouwen, antwoorden verwerken, uitslag, tussenstand, eindstand,
// rematch en de state-snapshot.
//
// LIJM, GEEN DOMEINLOGICA. Elke inhoudelijke stap komt uit een bestaande,
// al geteste module:
//   - faselegaliteit            → server/architecture/state-machine.js
//   - acceptatie/deadline/punten→ server/rules/scoring.js (via answer-flow.js)
//   - antwoordvalidatie         → server/rules/validators.js (via answer-flow.js)
//   - antwoordresolutie         → server/data/answer-flow.js
//   - antwoordverdeling         → server/rules/answer-distribution.js
//   - late join / eligibility   → server/rules/eligibility.js
//   - eindstand + tiebreak      → server/rules/standings.js
//   - vraagselectie             → ./content-source.mjs (→ server/rules/question-selection.js)
//   - documentvormen            → server/data/types/*.js  (het vangnet)
//   - opslag                    → server/data/repository.js (de poort)
//   - foutcodes                 → server/protocol/error-codes.mjs
//   - IDs                       → ./context.mjs (createId, geen tweede formaat)
//
// RESULTAATCONVENTIE. Identiek aan room-lifecycle.mjs: `{ ok: true, value }`
// of `{ ok: false, code }` met een code uit `error-codes.mjs`. Werpen doet
// deze module alleen bij programmeerfouten van de aanroeper.
//
// DRIE HARDE REGELS IN DIT BESTAND
//
// 1. `transition()` uit server/architecture/state-machine.js is de ENIGE bron
//    van faselegaliteit. Er staat hier geen tweede fasetabel. `resolveNextPhase`
//    KIEST een bestemming (dat is expliciet aan de aanroeper gedelegeerd — zie
//    de modulekop van state-machine.js, "Kennis van roundIndex/totalRounds/
//    scoreboardFrequency zit bewust bij de aanroeper"), maar de reducer
//    beslist of die bestemming mag.
// 2. `Match.phase` EN `Match.pausedState` worden uitsluitend geschreven door
//    `setRoomAndMatchPhaseAtomically` (besluit 30 + DM19). Elke andere
//    `saveMatch()` in dit bestand laat beide velden ongemoeid op de waarde die
//    al in de store staat, zodat er nooit een niet-atomair dual-write-pad
//    ontstaat. Vóór DM19 schreef de compositie `pausedState` in een eigen
//    `saveMatch` vlak vóór de fasewissel; dat was precies het pad dat INT-16
//    aankaartte en het is hier weg.
// 3. `correctAnswer` gaat het Round-document in en verlaat deze module nooit
//    vóór `endRound` (besluit 20). `startRound` en `buildSnapshot` bouwen hun
//    publieke payload via een expliciete allowlist, niet via een spread.
//
// POORTVERSIE. Dit bestand gebruikt de poort ZOALS DIE NU IS, inclusief de
// room-scoping van DM11: `saveRound(roomId, round)`,
// `loadAnswer(roomId, matchId, roundId, playerId)` en
// `loadActionCacheEntry(roomId, actionId)`. `server/composition/
// room-lifecycle.mjs` loopt nog op de oude signatuur (`loadRoomByInviteId`) en
// is daardoor sinds DM10 stuk; dat bestand valt buiten deze opdracht en is als
// handoff-item gemeld.

import { ERROR_CODES as STATE_MACHINE_ERROR_CODES, EVENT_TYPES, PHASES, transition } from '../architecture/state-machine.js';
import { resolveAnswer } from '../data/answer-flow.js';
import { assertMatchShape } from '../data/types/match.js';
import { assertPlayerShape } from '../data/types/player.js';
import { assertRoomShape } from '../data/types/room.js';
import { assertRoundShape, toActiveRoundSnapshot } from '../data/types/round.js';
import { computeAnswerDistribution } from '../rules/answer-distribution.js';
import { computeEligibleFromRound, isEligibleForRound } from '../rules/eligibility.js';
import { rankPlayers } from '../../shared/rules/ranking.mjs';
import { ALL_ERROR_CODES } from '../protocol/error-codes.mjs';
import { createContentSource } from './content-source.mjs';
import { createId } from './context.mjs';
import { buildJoinUrl } from './room-lifecycle.mjs';

/**
 * De foutcodes die deze module kan retourneren. Geen losse stringliterals:
 * `error-codes.mjs` is de single source of truth, en dit faalt bij module-load
 * als een code daar ooit uit verdwijnt.
 */
const CODES = Object.freeze({
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
 * Startcountdown: 3 s, expliciet NIET instelbaar (GAME-RULES.md
 * §Rondestructuur). `countdownEndsAt` is vluchtig en wordt bij de transitie
 * berekend, niet persistent opgeslagen (besluit 16).
 */
export const COUNTDOWN_SECONDS = 3;

/** `scoreboard:updated` levert de top 5 (PROTOCOL.md §Server → client events). */
export const SCOREBOARD_TOP_LIMIT = 5;

/** PROTOCOL.md §State-snapshot, letterlijk. */
export const PROTOCOL_VERSION = 'v1';

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
 * `Round.status` is een open string (server/data/types/round.js); alleen
 * "ACTIVE" staat letterlijk in DATA-MODEL.md. "ENDED" is de tegenhanger die
 * server/data/answer-flow.test.js al gebruikt — daar aangesloten in plaats van
 * een derde waarde te introduceren.
 */
const ROUND_STATUS_ACTIVE = 'ACTIVE';
const ROUND_STATUS_ENDED = 'ENDED';

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

/** @param {string} code @returns {{ ok: false, code: string }} */
function fail(code) {
  return { ok: false, code };
}

/** @param {object} value @returns {{ ok: true, value: object }} */
function succeed(value) {
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
function phaseConflict(eventType, expectedPhase, actualPhase) {
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
function toWireCode(code) {
  return ALL_ERROR_CODES.has(code) ? code : CODES.INVALID_PHASE;
}

/** Spelers die nog echt meedoen. */
function activePlayers(players) {
  return players.filter((player) => player.kicked !== true && player.left !== true);
}

/**
 * Bovengrens op `snapshot.participants`. Gelijk aan de MVP-grens uit
 * PRODUCT.md (100 spelers per room). Zie PROTOCOL.md §"Waarom begrensd en niet
 * gepagineerd": bij honderd deelnemers is de lijst ~8 kB, verwaarloosbaar naast
 * de vraagpayloads, en de snapshot gaat over de lijn bij verbinden en
 * reconnecten — niet per ronde. De grens staat er voor het geval `maxPlayers`
 * ooit omhoog gaat, niet omdat honderd te veel is.
 */
const PARTICIPANTS_LIMIT = 100;

/**
 * De deelnemerslijst voor de snapshot: wie er in de room zitten, met hun naam
 * en rollen. Zonder deze lijst kent een client alleen de namen van spelers die
 * ná zijn eigen verbinding binnenkwamen (`room:player-changed`), en toont de
 * lobby een naamloze rij voor iedereen die er al zat.
 *
 * ROLLEN KOMEN VAN DE SESSIE, NIET VAN DE SPELER. `Player` kent geen rollen;
 * `Session.roles` wel. We laden daarom uitsluitend de hostsessies uit
 * `room.hostSessionIds` — meestal één — en niet de sessie van elke speler. Dat
 * scheelt bij honderd deelnemers negenennegentig lees-operaties, en het
 * antwoord is hetzelfde: wie geen hostsessie heeft, is `["player"]`.
 *
 * Een host die NIET meespeelt heeft geen `Player` en staat dus niet in de
 * lijst. Dat is de definitie, geen omissie: de lijst gaat over deelnemers.
 *
 * @param {object} context
 * @param {import('../data/types/room.js').Room} room
 * @param {Array<object>} present - al gefilterd met `activePlayers`, zodat
 *   `participants.length === room.playerCount` blijft gelden
 * @returns {Promise<{ participants: Array<object>, participantsTruncated: boolean }>}
 */
async function buildParticipants(context, room, present) {
  const hostPlayerIds = new Set();
  for (const sessionId of room.hostSessionIds) {
    const session = await context.store.loadSession(room.id, sessionId);
    // Een hostsessie kan zijn ingetrokken of verlopen terwijl de room leeft;
    // dan is er niets om een rol aan te hangen en telt de speler als gewone
    // deelnemer. Dat is beter dan de hele snapshot laten falen op een
    // hostsessie die er niet meer is.
    if (session !== null && session.playerId !== null) {
      hostPlayerIds.add(session.playerId);
    }
  }

  // Stabiele volgorde (PROTOCOL.md): oplopend op join-tijdstip, bij gelijk
  // tijdstip op playerId. Zonder die garantie zou afkappen willekeurig zijn en
  // kon de lobby bij elke snapshot van volgorde wisselen.
  const ordered = [...present].sort((a, b) => (
    a.joinedAt === b.joinedAt ? a.id.localeCompare(b.id) : a.joinedAt - b.joinedAt
  ));

  const participants = ordered.slice(0, PARTICIPANTS_LIMIT).map((player) => ({
    playerId: player.id,
    effectiveName: player.effectiveName,
    roles: hostPlayerIds.has(player.id) ? ['host', 'player'] : ['player'],
  }));

  return { participants, participantsTruncated: ordered.length > PARTICIPANTS_LIMIT };
}

/** Spelers die in de eindstand horen: gekickt valt af, vrijwillig vertrokken niet. */
function rankablePlayers(players) {
  return players.filter((player) => player.kicked !== true);
}

/**
 * DE ENIGE PLEK DIE EEN TUSSENSTAND-TOP BOUWT (§A3, 5 aug 2026).
 *
 * `getScoreboard()` en `buildSnapshot()` deden dit allebei zelf, en allebei
 * met `rank: index + 1`. Bij een gelijke stand toonde de tussenstand dus
 * 1-2-3-4 terwijl `finishMatch()` — die wél `rankPlayers()` gebruikt —
 * 1-2-2-4 zei. Binnen één snapshot spraken `scoreboard.top[].rank` en
 * `scoreboard.self.position` elkaar zelfs tegen. Één functie, één antwoord.
 *
 * `rank` blijft de veldnaam in de tussenstand-payloads (PROTOCOL.md) en
 * `position` die in de eindstand; de WAARDE komt nu uit dezelfde bron.
 *
 * @param {Array<object>} players - de volledige spelerslijst uit de store
 * @param {number} limit
 * @returns {Array<{ playerId: string, effectiveName: string | null, score: number, rank: number }>}
 */
function buildRankedTop(players, limit) {
  const rankable = rankablePlayers(players);
  const nameById = new Map(rankable.map((player) => [player.id, player.effectiveName]));
  const ranked = rankPlayers(rankable.map((player) => ({
    id: player.id,
    score: player.score,
    correctCount: player.correctCount,
    correctResponseTimeMsTotal: player.correctResponseTimeMsTotal,
  })));
  return ranked.slice(0, limit).map((entry) => ({
    playerId: entry.id,
    effectiveName: nameById.get(entry.id) ?? null,
    score: entry.score,
    rank: entry.position,
  }));
}

/**
 * De contentbron voor deze room: `./content-source.mjs`, dat sinds CT1 de
 * echte pool uit `shared/content/` gebruikt (geen stub meer).
 *
 * `contentVersion` is verplicht op de context omdat besluit 21 hem canoniek en
 * ONVERANDERLIJK op `Match` maakt: een stilzwijgende default zou een verzonnen
 * versie in echte Match-documenten pinnen. `rendererVersion` en `random`
 * mogen ontbreken; de contentbron heeft daar zelf een default voor.
 *
 * @param {import('./context.mjs').Context} context
 * @param {import('../data/types/room.js').Room} room
 */
function contentSourceFor(context, room) {
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
  });
}

/**
 * De ene gameType van deze match (besluit 32). Gepind op het Match-document
 * bij creatie; `room.config.gameTypes[0]` is de bron bij een match die nog
 * geen gepinde waarde heeft.
 * @param {import('../data/types/room.js').Room} room
 * @param {object|null} match
 * @returns {string}
 */
function matchGameType(room, match) {
  if (match !== null && typeof match.gameType === 'string' && match.gameType.length > 0) {
    return match.gameType;
  }
  return room.config.gameTypes[0];
}

/**
 * Laadt room + huidige match in één stap.
 * @param {import('./context.mjs').Context} context
 * @param {string} roomId
 * @param {{ requireMatch?: boolean }} [options]
 */
async function loadRoomAndMatch(context, roomId, { requireMatch = true } = {}) {
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

/**
 * Schrijft `lastActivityAt`/`currentMatchId` bij. Zie HANDOFF INT-7: de poort
 * kent geen partiële update, dus dit is een heel-document-write die tegen een
 * echte, gelijktijdige store een concurrent `phase`-update kan overschrijven.
 * `phase` wordt hier NOOIT gewijzigd — dat pad loopt uitsluitend via
 * `setRoomAndMatchPhaseAtomically`.
 *
 * RESTGAT (INT-7, niet opgelost door DM19). Dat "nooit gewijzigd" geldt ten
 * opzichte van de `room` die de AANROEPER heeft ingelezen. Verzet iemand anders
 * tussendoor de fase, dan schrijft deze functie de oude fase terug. De CAS
 * hieronder beschermt de fase-overgang zelf, niet deze bijschrijving; daarom
 * roept elke aanroeper hem aan met een room die zo vers mogelijk is en staat
 * hij nooit ná de atomaire operatie zonder herlaadstap.
 */
async function saveRoomFields(context, room, fields) {
  const updated = { ...room, ...fields, phase: room.phase };
  assertRoomShape(updated);
  await context.store.saveRoom(updated);
  return updated;
}

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
 */
function phaseEndsAt(room, phase, now) {
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
 * @param {import('../data/types/room.js').Room} room
 * @param {import('../data/types/match.js').Match} match
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
      return match.pausedState === null ? null : match.pausedState.previousPhase;
    default:
      return null;
  }
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
async function applyTransition(context, { room, match, event, extraPatch = {} }) {
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

  return succeed({ match: committed, previousPhase: match.phase });
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

/** Laadt de ronde die op dit moment de "huidige" is, of null. */
async function loadCurrentRound(context, room, match) {
  if (match === null || match.roundIds.length === 0) {
    return null;
  }
  const roundId = match.roundIds[match.roundIds.length - 1];
  return context.store.loadRound(room.id, match.id, roundId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Match starten
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start de match vanuit LOBBY (`game:start`).
 *
 * Maakt een Match met een GEPINDE `contentVersion`/`rendererVersion`
 * (besluit 21) en één `gameType` (besluit 32), en zet daarna de fase via de
 * state machine + `setRoomAndMatchPhaseAtomically` (besluit 30).
 *
 * Staat er al een match in fase LOBBY (het normale gevolg van `rematch()`,
 * GAME-FLOW.md §12 "aanwezige spelers blijven in de lobby"), dan wordt DIE
 * gestart in plaats van een tweede match aan te maken.
 *
 * KEUZE — PROTOCOL.md eist "minimaal één speler" maar kent daar geen foutcode
 * voor. `INVALID_PHASE` is de dichtstbijzijnde gepubliceerde code: de game kan
 * in deze toestand niet starten. Zie het handoff-item.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function startMatch(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId, { requireMatch: false });
  if (!loaded.ok) {
    return loaded;
  }
  const { room } = loaded.value;
  let match = loaded.value.match;

  if (match !== null && match.phase !== PHASES.LOBBY) {
    return fail(CODES.GAME_ALREADY_STARTED);
  }
  if (room.phase !== PHASES.LOBBY) {
    return fail(CODES.GAME_ALREADY_STARTED);
  }

  const players = activePlayers(await context.store.listPlayers(roomId));
  if (players.length === 0) {
    return fail(CODES.INVALID_PHASE);
  }

  const now = context.now();
  if (match === null) {
    const source = contentSourceFor(context, room);
    match = {
      id: createId(context, 'match'),
      roomId,
      sequence: 1,
      phase: PHASES.LOBBY,
      startedAt: now,
      finishedAt: null,
      roundIndex: 0,
      roundIds: [],
      usedQuestionKeys: [],
      previousMatchQuestionKeys: [],
      pausedState: null,
      // Besluit 21: canoniek en onveranderlijk op Match.
      contentVersion: source.contentVersion,
      rendererVersion: source.rendererVersion,
      // ADDITIEF t.o.v. DATA-MODEL.md's Match-voorbeeld en assertMatchShape:
      // besluit 32 ("één gameType per match") heeft anders geen vaste plek en
      // zou elke ronde opnieuw uit room.config moeten worden afgeleid — dan is
      // hij niet gepind. Zie het handoff-item.
      gameType: room.config.gameTypes[0],
    };
    assertMatchShape(match);
    await context.store.saveMatch(match);
    await saveRoomFields(context, room, { currentMatchId: match.id, lastActivityAt: now });
  } else {
    await saveRoomFields(context, room, { lastActivityAt: now });
  }

  const started = await applyTransition(context, {
    room,
    match,
    event: { type: EVENT_TYPES.HOST_START, nextPhase: PHASES.COUNTDOWN },
  });
  if (!started.ok) {
    return started;
  }

  return succeed({
    matchId: started.value.match.id,
    sequence: started.value.match.sequence,
    phase: started.value.match.phase,
    gameType: matchGameType(room, started.value.match),
    totalRounds: room.config.totalRounds,
    contentVersion: started.value.match.contentVersion,
    rendererVersion: started.value.match.rendererVersion,
    countdownEndsAt: now + COUNTDOWN_SECONDS * 1000,
    playerCount: players.length,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Fases
// ─────────────────────────────────────────────────────────────────────────────

/**
 * De enige publieke ingang die fases wisselt (`game:next`, `game:pause`,
 * `game:resume`, en elke timergedreven overgang).
 *
 * `event` is een state-machine-Event. `nextPhase` mag ontbreken: dan vult
 * `resolveNextPhase` hem aan en valideert `transition()` de keuze alsnog.
 *
 * @param {import('./context.mjs').Context} context
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

  const applied = await applyTransition(context, { room, match, event: normalized });
  if (!applied.ok) {
    return applied;
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
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Ronde
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bouwt de vraag en opent de ronde (COUNTDOWN → ROUND_ACTIVE).
 *
 * `exclude` is de vereniging van de al gebruikte questionKeys van DEZE match
 * en die van de direct vorige match bij een rematch (GAME-RULES.md
 * §Vraagselectie). `correctAnswer` gaat het Round-document in en staat nooit
 * in de teruggegeven payload (besluit 20) — die payload is exact de negen
 * velden van `round:started` uit PROTOCOL.md.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function startRound(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;
  const now = context.now();

  // Eerst de legaliteit toetsen met dezelfde pure reducer, zodat er geen
  // Round-document ontstaat voor een overgang die toch wordt afgewezen.
  const probe = transition(
    { phase: match.phase, pausedState: match.pausedState },
    { type: EVENT_TYPES.TIMER_ELAPSED, nextPhase: PHASES.ROUND_ACTIVE },
    room.config.pacing,
    now,
  );
  if (!probe.ok) {
    return fail(toWireCode(probe.code));
  }

  const gameType = matchGameType(room, match);
  const source = contentSourceFor(context, room);

  // VANGNET, GEEN VERGOELIJKING (PLAN-CONVERGENTIE §A0). `buildQuestion`
  // werpt wanneer de contentbron deze gameType niet kan bouwen of de pool
  // uitgeput raakt. Deze functie draait op een timer-callback, dus een throw
  // hier verdwijnt in een unhandled rejection: geen `round:started`, geen
  // foutcode, room stil in COUNTDOWN. `game-catalog.mjs` + de module-load-
  // controle in `content-source.mjs` horen dit onmogelijk te maken; komt het
  // er tóch doorheen, dan faalt het zichtbaar in plaats van stil.
  let built;
  try {
    built = source.buildQuestion({
      gameType,
      exclude: [...match.usedQuestionKeys, ...match.previousMatchQuestionKeys],
    });
  } catch (error) {
    return {
      ok: false,
      code: CONTENT_UNAVAILABLE,
      contentFailure: { gameType, reason: error instanceof Error ? error.message : String(error) },
    };
  }

  const round = {
    id: createId(context, 'round'),
    matchId: match.id,
    gameType,
    questionKey: built.questionKey,
    publicQuestionPayload: built.publicQuestionPayload,
    correctAnswer: built.correctAnswer,
    ...(built.validOptionIds === undefined ? {} : { validOptionIds: built.validOptionIds }),
    ...(built.resultDetails === undefined ? {} : { resultDetails: built.resultDetails }),
    startsAt: now,
    endsAt: now + room.config.questionSeconds * 1000,
    status: ROUND_STATUS_ACTIVE,
  };
  assertRoundShape(round);
  await context.store.saveRound(roomId, round);

  const applied = await applyTransition(context, {
    room,
    match,
    event: { type: EVENT_TYPES.TIMER_ELAPSED, nextPhase: PHASES.ROUND_ACTIVE },
    extraPatch: {
      roundIds: [...match.roundIds, round.id],
      usedQuestionKeys: [...match.usedQuestionKeys, round.questionKey],
    },
  });
  if (!applied.ok) {
    return applied;
  }

  // Expliciete allowlist, exact de tien velden van `round:started`
  // (PROTOCOL.md §Voorbeeld, gevalideerd door
  // server/protocol/server-events-round-lifecycle.mjs). Geen spread —
  // besluit 20. `contentVersion`/`rendererVersion` komen van het Match-
  // document, want die twee zijn dáár canoniek (besluit 21).
  return succeed({
    matchId: match.id,
    roundId: round.id,
    roundNumber: applied.value.match.roundIndex + 1,
    totalRounds: room.config.totalRounds,
    gameType: round.gameType,
    contentVersion: match.contentVersion,
    rendererVersion: match.rendererVersion,
    question: round.publicQuestionPayload,
    startsAt: round.startsAt,
    endsAt: round.endsAt,
  });
}

/**
 * Verwerkt één antwoord (`round:answer`).
 *
 * Sessie/speler, ronde actief, speelgerechtigdheid, deadline + grace
 * (besluit 13), geldigheid en punten komen uit `resolveAnswer()` in
 * server/data/answer-flow.js, dat op zijn beurt server/rules/scoring.js en
 * server/rules/validators.js gebruikt. Er wordt hier niets herbeslist.
 *
 * IDEMPOTENTIE IS EIGENDOM VAN DE POORT (DM13). `saveAcceptedAnswerAtomically`
 * handhaaft het contract zelf, atomair met de write: bij dezelfde `actionId`
 * lost hij stil op zonder te muteren, bij een ANDERE `actionId` voor een al
 * beantwoorde ronde werpt hij een `RangeError` met `code: 'ALREADY_ANSWERED'`.
 * Deze functie doet daarom geen voorcontrole meer — `existingAnswerForRound`
 * en `existingActionCacheEntry` gaan bewust als `null` de resolutie in. Twee
 * plekken die hetzelfde bewaken maken de poort niet de enige waarheid, en een
 * controle vóór de write dekt geen gelijktijdigheid: tussen het inlezen van de
 * context en de write past een tweede, gelijktijdige aanroep.
 *
 * DAAROM LEZEN NA DE WRITE, NIET CONTROLEREN ERVOOR. De ack komt uit
 * `loadActionCacheEntry(roomId, actionId)` ná de write: bij een verse write
 * staat daar de eigen entry, bij een replay die van de oorspronkelijke
 * aanroep. In beide gevallen de juiste ack, zonder dat vooraf bekend hoeft te
 * zijn welk geval het is. Dezelfde redenering geldt voor de persoonlijke
 * velden: die komen uit het opgeslagen Answer-document en het opgeslagen
 * Player-document, niet uit de zojuist berekende (en bij een replay
 * weggegooide) `write`.
 *
 * Het `replay`-label is het enige dat niet uit de poort kán komen: zowel de
 * stille replay-tak als een verse write geven `undefined` terug en laten
 * dezelfde store-inhoud achter. Daarvoor staat er één lezing vóór de write —
 * die niets bewaakt en niets afkort, alleen benoemt. Zie het handoff-item.
 *
 * GAT — de poort dekt één geval NIET dat de oude voorcontrole wél ving: een
 * replay die pas ná de deadline + grace binnenkomt, of nadat de ronde niet
 * meer ACTIVE is. `resolveAnswer()` wijst die af met `DEADLINE_PASSED` /
 * `ROUND_NOT_ACTIVE` en de poort komt er niet meer aan te pas, terwijl
 * PROTOCOL.md §Idempotentie "zelfde actionId: zelfde ack" belooft. Zie het
 * handoff-item; hier bewust GEEN tweede vangnet omheen gebouwd.
 *
 * `clientAnsweredAt` is diagnostiek (GAME-RULES.md: "clienttijd wordt alleen
 * voor diagnostiek meegestuurd") en gaat NIET de scoring in; servertijd is
 * leidend. Het Answer-document heeft er geen veld voor, dus de waarde komt
 * alleen in het resultaat terug.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{
 *   roomId: string, playerId: string, roundId: string,
 *   answer: unknown, actionId: string, clientAnsweredAt?: number|null,
 * }} params
 */
export async function submitAnswer(context, {
  roomId,
  playerId,
  roundId,
  answer,
  actionId,
  clientAnsweredAt = null,
} = {}) {
  if (typeof actionId !== 'string' || actionId.length === 0) {
    throw new TypeError(`submitAnswer: actionId moet een niet-lege string zijn, kreeg: ${JSON.stringify(actionId)}`);
  }

  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;

  const round = await context.store.loadRound(roomId, match.id, roundId);
  if (round === null) {
    return fail(CODES.ROUND_NOT_ACTIVE);
  }
  const player = await context.store.loadPlayer(roomId, playerId);
  if (player === null) {
    return fail(CODES.NOT_PLAYER);
  }
  const session = await context.store.loadSession(roomId, player.sessionId);
  if (session === null) {
    return fail(CODES.TOKEN_INVALID);
  }

  const receivedAt = context.now();
  const resolved = resolveAnswer({
    session,
    player,
    room,
    match,
    round,
    answer,
    actionId,
    receivedAt,
    deadlineGraceMs: room.config.deadlineGraceMs,
    // DM13: de poort bewaakt idempotentie, deze laag niet meer. Beide
    // snelpaden in answer-flow.js krijgen daarom niets om op te vallen.
    existingAnswerForRound: null,
    existingActionCacheEntry: null,
  });

  if (!resolved.ok) {
    return fail(toWireCode(resolved.code));
  }

  // LABEL, GEEN CONTROLE. Deze lezing beslist niets: ze gaat de resolutie niet
  // in, kort niets af en houdt geen write tegen — de poort hieronder doet dat.
  // Ze bepaalt uitsluitend hoe het resultaat HEET. Slaagt de write terwijl er
  // al een antwoord lag, dan kan dat alleen de stille replay-tak van de poort
  // zijn geweest (een ander actionId op een al beantwoorde ronde werpt), dus
  // `replay` is daarmee exact af te leiden zonder de idempotentie zelf te
  // bewaken. De poort kent geen returnwaarde die dit verklapt — zie het
  // handoff-item; hier geen tweede vangnet, alleen een naam voor het geval.
  const answerBeforeWrite = await context.store.loadAnswer(roomId, match.id, round.id, playerId);

  try {
    await context.store.saveAcceptedAnswerAtomically(roomId, match.id, resolved.write);
  } catch (error) {
    // Een andere actionId voor een al beantwoorde ronde. De poort werpt; naar
    // buiten is dat een gewone resultaatcode, geen exception.
    if (error !== null && typeof error === 'object' && error.code === CODES.ALREADY_ANSWERED) {
      return fail(CODES.ALREADY_ANSWERED);
    }
    throw error;
  }

  // Lezen ná de write: dit is de opgeslagen waarheid, of onze eigen write nu
  // is geland (vers) of stil is opgelost (replay met dezelfde actionId).
  const cached = await context.store.loadActionCacheEntry(roomId, actionId);
  const stored = await context.store.loadAnswer(roomId, match.id, round.id, playerId);
  const storedPlayer = await context.store.loadPlayer(roomId, playerId);

  return succeed({
    ack: cached.ack,
    // Lag er al een antwoord én slaagde de write toch, dan heeft de poort
    // stil opgelost: dit was een replay van dezelfde actionId.
    replay: answerBeforeWrite !== null,
    clientAnsweredAt,
    // Persoonlijke velden voor de aanroeper; NIET onderdeel van de ack, zodat
    // een replay exact dezelfde ack kan teruggeven (PROTOCOL.md §Idempotentie).
    correct: stored.correct,
    points: stored.points,
    responseTimeMs: stored.responseTimeMs,
    score: storedPlayer.score,
  });
}

/**
 * Sluit de ronde af (ROUND_ACTIVE → ROUND_RESULT) en levert de uitslag,
 * inclusief antwoordverdeling.
 *
 * De verdeling komt uit server/rules/answer-distribution.js (besluit 14: de
 * rules-laag rekent, het protocol transporteert alleen).
 *
 * GAT — de poort heeft geen `listAnswersForRound`; er is alleen
 * `loadAnswer(roundId, playerId)`. De antwoorden worden daarom per speler
 * opgehaald (N+1 leesoperaties). Zie het handoff-item.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function endRound(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;
  const now = context.now();

  const round = await loadCurrentRound(context, room, match);
  if (round === null) {
    return fail(CODES.ROUND_NOT_ACTIVE);
  }

  const probe = transition(
    { phase: match.phase, pausedState: match.pausedState },
    { type: EVENT_TYPES.TIMER_ELAPSED, nextPhase: PHASES.ROUND_RESULT },
    room.config.pacing,
    now,
  );
  if (!probe.ok) {
    return fail(toWireCode(probe.code));
  }

  const roundNumber = match.roundIndex + 1;
  const players = activePlayers(await context.store.listPlayers(roomId));

  const results = [];
  const accepted = [];
  for (const player of players) {
    const stored = await context.store.loadAnswer(roomId, match.id, round.id, player.id);
    const eligible = isEligibleForRound(player.eligibleFromRound, roundNumber);
    if (stored !== null) {
      accepted.push(stored);
    }
    results.push({
      playerId: player.id,
      effectiveName: player.effectiveName,
      eligible,
      answered: stored !== null,
      correct: stored === null ? false : stored.correct,
      points: stored === null ? 0 : stored.points,
      responseTimeMs: stored === null ? null : stored.responseTimeMs,
    });
  }

  // De regelslaag levert een OBJECT (`{ at: 9, pe: 5 }`); over de lijn gaat een
  // geordende ARRAY. Stap 6 (5 aug 2026) bracht dit verschil aan het licht: de
  // client (`scoreboard.mjs`, `social-headline.mjs`) leest
  // `distribution.find((d) => d.optionId === ...)` en kreeg tegen de échte
  // server altijd `undefined` — "N van M zaten goed" verscheen daardoor nooit
  // buiten de mock, zonder één foutmelding. PROTOCOL.md §round:ended legt de
  // arrayvorm nu vast (open vraag 11 gesloten).
  //
  // De volgorde is die van de antwoordopties zelf: `answer-distribution.js`
  // bouwt zijn object in optievolgorde op, en `Object.entries` behoudt die
  // (bij `higher_lower`/`odd_one_out` zijn de sleutels '0','1',… — numeriek
  // oplopend, dus ook daar de weergavevolgorde).
  const distribution = Object.entries(computeAnswerDistribution(
    round.gameType,
    accepted.map((entry) => ({ answer: entry.answer })),
    { validOptionIds: round.validOptionIds },
  )).map(([optionId, count]) => ({ optionId, count }));

  await context.store.saveRound(roomId, { ...round, status: ROUND_STATUS_ENDED });

  const applied = await applyTransition(context, {
    room,
    match,
    event: { type: EVENT_TYPES.TIMER_ELAPSED, nextPhase: PHASES.ROUND_RESULT },
  });
  if (!applied.ok) {
    return applied;
  }

  return succeed({
    matchId: match.id,
    roundId: round.id,
    roundNumber,
    totalRounds: room.config.totalRounds,
    // Pas hier verlaat het juiste antwoord de server (besluit 20 /
    // GAME-RULES.md: "nooit vóór round:ended").
    correctAnswer: round.correctAnswer,
    distribution,
    answeredCount: accepted.length,
    eligiblePlayerCount: results.filter((entry) => entry.eligible).length,
    results,
    phase: applied.value.match.phase,
    phaseEndsAt: phaseEndsAt(room, applied.value.match.phase, now),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tussenstand en eindstand
// ─────────────────────────────────────────────────────────────────────────────

/**
 * De tussenstand (`scoreboard:updated`), via `getScoreboardTop` uit de poort.
 *
 * GAT — het scoreboard van de poort wordt uitsluitend gevuld door
 * `saveAcceptedAnswerAtomically`; een speler die nog nooit heeft geantwoord
 * staat er dus niet in, ook niet met 0 punten. Zie het handoff-item; hier is
 * bewust geen tweede scoreboardbron naast de poort gebouwd.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string, limit?: number }} params
 */
export async function getScoreboard(context, { roomId, limit = SCOREBOARD_TOP_LIMIT } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;

  // §A3: niet meer `getScoreboardTop()` + `index + 1`. Die poort sorteert op
  // score en kent geen gedeelde posities, dus een tie kreeg hier vier
  // verschillende nummers waar de eindstand er drie geeft. De spelerslijst
  // werd hier toch al geladen (voor de namen); rangschikken gebeurt nu op
  // dezelfde regels als het podium.
  const players = await context.store.listPlayers(roomId);

  return succeed({
    matchId: match.id,
    limit,
    roundNumber: match.roundIndex + 1,
    totalRounds: room.config.totalRounds,
    top: buildRankedTop(players, limit),
  });
}

/**
 * De eindstand (`game:finished`), met de tiebreak-volgorde uit
 * server/rules/standings.js (score → correctCount → laagste totale
 * responstijd → gedeelde positie).
 *
 * Is de match nog niet FINISHED, dan zet deze functie hem er via HOST_FINISH
 * heen. Is hij dat al (auto-tempo loopt vanzelf naar FINISHED), dan levert hij
 * alleen de eindstand — HOST_FINISH vanuit FINISHED is per state machine
 * ongeldig en dat is hier geen fout.
 *
 * Gekickte spelers vallen af; vrijwillig vertrokken spelers blijven in de
 * eindstand staan met hun behaalde punten (GAME-FLOW.md §11).
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function finishMatch(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;

  let current = match;
  if (match.phase !== PHASES.FINISHED) {
    const applied = await applyTransition(context, {
      room,
      match,
      event: { type: EVENT_TYPES.HOST_FINISH },
    });
    if (!applied.ok) {
      return applied;
    }
    current = applied.value.match;
  }

  const players = rankablePlayers(await context.store.listPlayers(roomId));
  const byId = new Map(players.map((player) => [player.id, player]));
  const ranked = rankPlayers(players.map((player) => ({
    id: player.id,
    score: player.score,
    correctCount: player.correctCount,
    correctResponseTimeMsTotal: player.correctResponseTimeMsTotal,
  })));

  const standings = ranked.map((entry) => {
    const player = byId.get(entry.id);
    return {
      playerId: entry.id,
      effectiveName: player.effectiveName,
      score: entry.score,
      correctCount: entry.correctCount,
      correctResponseTimeMsTotal: entry.correctResponseTimeMsTotal,
      position: entry.position,
      // GAME-RULES.md §Late join: "in de eindstand desgewenst gemarkeerd met
      // vanaf ronde {n}".
      eligibleFromRound: player.eligibleFromRound,
      left: player.left === true,
    };
  });

  return succeed({
    matchId: current.id,
    sequence: current.sequence,
    phase: current.phase,
    finishedAt: current.finishedAt,
    standings,
    podium: standings.filter((entry) => entry.position <= 3),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rematch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rematch (`game:rematch`): zelfde room, code en inviteId; nieuwe `matchId`;
 * scores en streaks naar nul; instellingen blijven; vragen uit de direct
 * vorige match worden vermeden (GAME-FLOW.md §12).
 *
 * De nieuwe match begint in LOBBY — "aanwezige spelers blijven in de lobby" —
 * en wordt daarna met `startMatch()` gestart. Dat is bewust GEEN
 * `transition()`-aanroep: de state machine modelleert de levensloop van ÉÉN
 * match en kent geen uitgang uit FINISHED. Een rematch is een nieuwe machine
 * in zijn begintoestand; `Room.phase` volgt als projectie de nieuwe
 * autoritaire `Match.phase` en gaat in dezelfde atomaire operatie mee
 * (besluit 30).
 *
 * Besluit 5: een speler met `left: true` telt niet automatisch mee en wordt
 * hier dus niet gereset of gereactiveerd.
 *
 * SCHRIJFVOLGORDE (DM19/INT-7). Het nieuwe Match-document wordt opgeslagen in
 * de fase die de room op dit moment DRAAGT (FINISHED), niet alvast in LOBBY:
 * regel 2 van de modulekop geldt ook voor een vers document, en de dubbele
 * compare-and-set eist dat `Room.phase` én `Match.phase` allebei
 * `expectedPhase` dragen. De atomaire operatie zet daarna beide in één stap op
 * LOBBY — dat is meteen de enige plek waar de fase van de nieuwe match ooit
 * wordt geschreven.
 *
 * Die operatie gaat daarom ook VÓÓR de spelerreset en vóór het verzetten van
 * `Room.currentMatchId`. Verliest hij de race — twee hosttabs die tegelijk op
 * "opnieuw" drukken — dan blijft er niets anders achter dan een Match-document
 * waar niemand naar wijst: de winnende rematch houdt zijn room, zijn
 * `currentMatchId` en zijn spelers. Andersom (eerst resetten en `currentMatchId`
 * verzetten, dan pas de CAS) zou de verliezer de room naar zijn eigen dode
 * match laten wijzen terwijl de winnaar `Room.phase` al op LOBBY heeft gezet —
 * een room die daarna nergens meer uit komt.
 *
 * `saveRoomFields` schrijft het hele Room-document en zou de zojuist gezette
 * fase overschrijven met de fase uit de al ingelezen kopie; het herlaadt de
 * room daarom eerst (zie ook de waarschuwing bij `saveRoomFields` zelf).
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function rematch(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId);
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;

  if (match.phase !== PHASES.FINISHED) {
    return fail(CODES.INVALID_PHASE);
  }

  const now = context.now();
  const expectedPhase = match.phase;
  const source = contentSourceFor(context, room);
  const next = {
    id: createId(context, 'match'),
    roomId,
    sequence: match.sequence + 1,
    // De fase die de room NU draagt; de atomaire operatie hieronder maakt er
    // LOBBY van, samen met `Room.phase`.
    phase: expectedPhase,
    startedAt: now,
    finishedAt: null,
    roundIndex: 0,
    roundIds: [],
    usedQuestionKeys: [],
    previousMatchQuestionKeys: [...match.usedQuestionKeys],
    pausedState: null,
    contentVersion: source.contentVersion,
    rendererVersion: source.rendererVersion,
    gameType: matchGameType(room, match),
  };
  assertMatchShape({ ...next, phase: PHASES.LOBBY });
  await context.store.saveMatch(next);

  const applied = await context.store.setRoomAndMatchPhaseAtomically(roomId, next.id, {
    expectedPhase,
    newPhase: PHASES.LOBBY,
    pausedState: null,
  });
  if (!applied.ok) {
    // `game:rematch` is een hostactie: de host krijgt een gepubliceerde code
    // terug en zijn client haalt een verse snapshot op. `next` blijft als
    // ongerefereerd document achter; de room zelf is onaangeroerd.
    return phaseConflict('HOST_REMATCH', expectedPhase, applied.actualPhase);
  }

  // Herladen: de room in `loaded` draagt nog de fase van vóór de atomaire
  // operatie, en `saveRoomFields` schrijft het hele document.
  const flipped = await context.store.loadRoom(roomId);
  await saveRoomFields(context, flipped, { currentMatchId: next.id, lastActivityAt: now });

  const players = await context.store.listPlayers(roomId);
  const reset = [];
  for (const player of players) {
    if (player.kicked === true || player.left === true) {
      continue;
    }
    const fresh = {
      ...player,
      score: 0,
      correctCount: 0,
      correctResponseTimeMsTotal: 0,
      // Een late joiner uit de vorige match speelt de nieuwe volledig mee.
      eligibleFromRound: 1,
    };
    assertPlayerShape(fresh);
    await context.store.savePlayer(fresh);
    reset.push(fresh.id);
  }

  return succeed({
    matchId: next.id,
    previousMatchId: match.id,
    sequence: next.sequence,
    phase: PHASES.LOBBY,
    gameType: next.gameType,
    totalRounds: room.config.totalRounds,
    contentVersion: next.contentVersion,
    rendererVersion: next.rendererVersion,
    previousMatchQuestionKeys: [...next.previousMatchQuestionKeys],
    resetPlayerIds: reset,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Late join (matrixrij 9)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bepaalt de `eligibleFromRound` die aan `room-lifecycle.joinRoom()` moet
 * worden meegegeven. Alleen deze laag kent `Match.roundIndex`.
 *
 * Het getal komt uit `computeEligibleFromRound()` in
 * server/rules/eligibility.js — niet uit een eigen `+1` hier.
 *
 * KEUZE — `remainingFraction` gaat bewust als `null` de rules-laag in. GR5's
 * uitzondering "vlak na de start mag je de lopende ronde nog meespelen" heeft
 * geen bron die `nearEndThreshold` vastlegt, en matrixrij 9 eist het strengere
 * "telt pas mee vanaf de eerstvolgende volledig nieuwe ronde". Zodra een bron
 * die drempel vastlegt is dit één argument.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function resolveEligibleFromRound(context, { roomId } = {}) {
  const loaded = await loadRoomAndMatch(context, roomId, { requireMatch: false });
  if (!loaded.ok) {
    return loaded;
  }
  const { room, match } = loaded.value;

  if (match === null || match.phase === PHASES.LOBBY) {
    return succeed({ eligibleFromRound: 1, currentRoundNumber: 1, phase: room.phase, isLateJoin: false });
  }
  if (match.phase === PHASES.FINISHED) {
    // De match is klaar; een joiner speelt vanaf ronde 1 van de volgende match.
    return succeed({ eligibleFromRound: 1, currentRoundNumber: match.roundIndex + 1, phase: match.phase, isLateJoin: false });
  }

  const currentRoundNumber = match.roundIndex + 1;
  const eligibleFromRound = computeEligibleFromRound({
    currentRoundNumber,
    phase: match.phase,
    remainingFraction: null,
    nearEndThreshold: 1,
  });
  return succeed({
    eligibleFromRound,
    currentRoundNumber,
    phase: match.phase,
    isLateJoin: eligibleFromRound > 1,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot (matrixrij 14)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bouwt de state-snapshot (`room:state` / `GET /games/{code}/state`).
 *
 * MATRIXRIJ 14: het correcte antwoord van een ACTIEVE ronde zit hier op geen
 * enkel niveau in. Dat is niet met een handmatige veldselectie gedaan maar met
 * `toActiveRoundSnapshot()` uit server/data/types/round.js — de expliciete
 * allowlist van de eigenaar, die bovendien werpt zodra de ronde niet ACTIVE
 * is. De projectie hieronder hernoemt alleen naar de PROTOCOL.md-woordenschat.
 *
 * `snapshot.room` volgt de tien velden die `server/protocol/snapshot-shape.mjs`
 * eist, inclusief `matchSequence` (HANDOFF INT-2) en de volledige
 * `pausedState`-vorm (besluit 10). `snapshot.self` draagt `eligibleFromRound`
 * (besluit 3), dat diezelfde validator als integer >= 1 keurt.
 *
 * CONTRACTBOTSING, hier niet omheen gebouwd (zie het handoff-item):
 * `toActiveRoundSnapshot()` levert `id`/`publicQuestionPayload`/`status`,
 * terwijl `snapshot-shape.mjs`'s allowlist `roundId`/`question` heet en
 * `status` niet toestaat. De hernoeming hieronder overbrugt dat verschil.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string, sessionId?: string|null }} params
 */
export async function buildSnapshot(context, { roomId, sessionId = null } = {}) {
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  const match = room.currentMatchId === null
    ? null
    : await context.store.loadMatch(roomId, room.currentMatchId);

  const now = context.now();
  const players = await context.store.listPlayers(roomId);
  const present = activePlayers(players);
  const session = sessionId === null ? null : await context.store.loadSession(roomId, sessionId);
  const selfPlayer = session === null || session.playerId === null
    ? null
    : players.find((player) => player.id === session.playerId) ?? null;

  const round = await loadCurrentRound(context, room, match);
  const isActiveRound = round !== null && round.status === ROUND_STATUS_ACTIVE;

  let currentRound = {};
  if (isActiveRound) {
    // Het vangnet van de eigenaar strips eerst; daarna alleen hernoemen.
    const safe = toActiveRoundSnapshot(round, match);
    currentRound = {
      matchId: safe.matchId,
      roundId: safe.id,
      roundNumber: match.roundIndex + 1,
      totalRounds: room.config.totalRounds,
      gameType: safe.gameType,
      contentVersion: safe.contentVersion,
      rendererVersion: safe.rendererVersion,
      question: safe.publicQuestionPayload,
      startsAt: safe.startsAt,
      endsAt: safe.endsAt,
    };
  }

  const ranked = rankPlayers(rankablePlayers(players).map((player) => ({
    id: player.id,
    score: player.score,
    correctCount: player.correctCount,
    correctResponseTimeMsTotal: player.correctResponseTimeMsTotal,
  })));
  const positionById = new Map(ranked.map((entry) => [entry.id, entry.position]));

  let self = {
    roles: session === null ? [] : [...session.roles],
    playerId: selfPlayer === null ? null : selfPlayer.id,
    effectiveName: selfPlayer === null ? null : selfPlayer.effectiveName,
    // Feedbackronde 4 aug (kleurkeuze): de eigen kleur reist mee in de
    // snapshot — de join-broadcast mist de joiner zelf (die hangt dan nog
    // niet aan de socket), dus dit is zijn enige betrouwbare bron.
    color: selfPlayer === null ? null : (selfPlayer.color ?? null),
    score: selfPlayer === null ? 0 : selfPlayer.score,
    position: selfPlayer === null ? null : positionById.get(selfPlayer.id) ?? null,
    answeredCurrentRound: false,
    // Besluit 3: de client krijgt de eigen antwoordgerechtigdheid proactief te
    // zien. `snapshot-shape.mjs` eist een integer >= 1, dus een sessie zónder
    // speler (hostrol zonder deelname) krijgt de neutrale 1 in plaats van null.
    eligibleFromRound: selfPlayer === null ? 1 : selfPlayer.eligibleFromRound,
  };
  if (selfPlayer !== null && round !== null && match !== null) {
    const own = await context.store.loadAnswer(roomId, match.id, round.id, selfPlayer.id);
    self = { ...self, answeredCurrentRound: own !== null };
  }

  // §A3: dezelfde ene rangschikker als `getScoreboard()` en het podium — de
  // snapshot sprak zichzelf anders tegen (`top[].rank` uit index + 1,
  // `self.position` uit `rankPlayers`).
  const top = match === null ? [] : buildRankedTop(players, SCOREBOARD_TOP_LIMIT);

  const { participants, participantsTruncated } = await buildParticipants(context, room, present);

  return succeed({
    protocolVersion: PROTOCOL_VERSION,
    serverTime: now,
    room: {
      code: room.code,
      phase: room.phase,
      locked: room.locked,
      allowLateJoin: room.config.allowLateJoin,
      joinUrl: buildJoinUrl(context, room.inviteId),
      playerCount: present.length,
      config: { ...room.config },
      matchId: room.currentMatchId,
      // HANDOFF INT-2: Match.sequence ordent matches binnen een room totaal en
      // laat de client een rematch van een oude snapshot onderscheiden.
      matchSequence: match === null ? null : match.sequence,
      // Besluit 10: snapshot en live `game:paused` gebruiken dezelfde
      // volledige vorm (`previousPhase`, `remainingMs`, `reason`, `pausedAt`).
      pausedState: match === null ? null : match.pausedState,
    },
    self,
    currentRound,
    participants,
    participantsTruncated,
    scoreboard: {
      top,
      self: selfPlayer === null
        ? {}
        : {
          playerId: selfPlayer.id,
          score: selfPlayer.score,
          position: positionById.get(selfPlayer.id) ?? null,
        },
    },
  });
}

// De interne codes van de state machine zijn hier bewust geïmporteerd zodat de
// afhankelijkheid zichtbaar is in de importlijst: `toWireCode` moet blijven
// werken zodra er een tweede interne code bijkomt.
export const INTERNAL_STATE_MACHINE_CODES = Object.freeze(
  Object.values(STATE_MACHINE_ERROR_CODES).filter((code) => !ALL_ERROR_CODES.has(code)),
);
