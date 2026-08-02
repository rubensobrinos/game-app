// Tabelgedreven testsuite voor de precedentieregel snapshot vs. event.
// Spec: docs/multiplayer/PROTOCOL.md basisregel 6, sectie "Reconnect" en
// §State-snapshot (commit bb07aa9: `room.matchSequence`, matchordening vóór
// serverTime, pre-match-lobby als sequence 0), docs/multiplayer/ARCHITECTURE.md §3,
// docs/multiplayer/DATA-MODEL.md (`Match.sequence`; een rematch is een nieuwe match
// binnen dezelfde room) en docs/multiplayer/GAME-FLOW.md §12 (bij een rematch gaan
// scores en streaks naar nul). Alleen node:test + node:assert, geen externe
// dependencies. Geen enkele test raakt de systeemklok: alle tijdstempels zijn vaste
// literals, zodat elke ordening exact te asserten is.
//
// TWEE SOORTEN RIJEN — LEES DIT VOORDAT JE ER EEN VERANDERT
// De meeste rijen leggen een BRONEIS vast: haal je die weg, dan wijkt de module af van
// PROTOCOL.md, ARCHITECTURE.md, DATA-MODEL.md of GAME-FLOW.md. Maar een deel van het
// gedrag staat in géén enkele bron; dat is een MODULEAFSPRAAK die
// snapshot-precedence.mjs zelf heeft gekozen omdat de spec zwijgt. Die rijen dragen het
// voorvoegsel "moduleafspraak — " en zijn precies zo hard getest, maar om een andere
// reden: ze bevriezen een keuze zodat een wijziging zichtbaar wordt in plaats van
// stilzwijgend. Verandert de spec (of de besluiten in de modulekop), dan mag zo'n rij
// meebewegen; een broneis niet.
// Als moduleafspraak gemarkeerd: DUPLICATE_SNAPSHOT (een tweede snapshot op hetzelfde
// tijdstip binnen dezelfde match), de afwijzing op protocolVersion (PROTOCOL.md
// schrijft geen clientgedrag voor — zie open punt a/b in de modulekop), de keuze om
// fractionele epoch-ms te accepteren, de LocalState-vorm (verplichte `matchSequence`,
// en juist géén kruiscontrole met `matchId`) en het matchwissel-signaal op het
// EVENTpad, dat de module uit `payload.matchId` afleidt omdat de envelope geen
// sequence draagt. NIET als moduleafspraak: de ordening zelf. Dat
// `matchSequence` vóór `serverTime` gaat, dat een pre-match-snapshot als 0 telt en dat
// precies één `null` ongeldig is, staat letterlijk in PROTOCOL.md §State-snapshot.
// De meta-test onderaan bewaakt dat de markering blijft staan.

import { test } from 'node:test';
import assert from 'node:assert';

import { shouldApplySnapshot, shouldApplyEvent, REASONS } from './snapshot-precedence.mjs';

const V1 = 'v1';
const ROOM = '482917';
const OTHER_ROOM = '194026';
const MATCH_A = 'match_01JA';
const MATCH_B = 'match_01JB';

/** `Match.sequence` (DATA-MODEL.md): integer ≥ 1, totale ordening binnen een room.
 * MATCH_A is de eerste match, MATCH_B de rematch erna. De pre-match-lobby heeft géén
 * sequence op de wire — daar zijn `matchId` en `matchSequence` allebei null. */
const SEQ_A = 1;
const SEQ_B = 2;

/** Vaste epoch-ms op één roomtijdlijn — nooit Date.now(). */
const T_EARLY = 1_785_623_400_000;
const T_NOW = 1_785_623_412_000;
const T_LATE = 1_785_623_427_000;

/** Halve milliseconden. server-time.js produceert die aantoonbaar (`offsetMs = t1 - (t0 +
 * roundTripMs / 2)` geeft bij een oneven round-trip bijv. 498.5), dus "epoch-ms" mag hier
 * niet stilzwijgend "geheel getal" betekenen. De modulekop kiest expliciet: fracties zijn
 * geldige epoch-ms en ordenen gewoon mee. */
const T_JUST_AFTER_NOW = T_NOW + 0.5;
const T_JUST_BEFORE_NOW = T_NOW - 0.5;

/** Voorvoegsel voor rijen die een moduleafspraak vastleggen i.p.v. een broneis. */
const MODULE_CHOICE = 'moduleafspraak — ';

/** @typedef {{ description: string, localState: unknown, incoming: unknown,
 *   expected: object }} Fixture */

/** LocalState met geldige defaults: state komt van een event op T_NOW, in match A. */
function local(overrides = {}) {
  return {
    protocolVersion: V1,
    roomCode: ROOM,
    matchId: MATCH_A,
    matchSequence: SEQ_A,
    appliedServerTime: T_NOW,
    appliedFrom: 'event',
    ...overrides,
  };
}

/** Verse client: nog niets toegepast en nog geen match (reconnect stap 5, allereerste
 * snapshot). `matchSequence: null` telt in de ordening als 0. */
function fresh(overrides = {}) {
  return local({
    matchId: null,
    matchSequence: null,
    appliedServerTime: null,
    appliedFrom: null,
    ...overrides,
  });
}

/** Lokale state in de pre-match-lobby waar wél al iets is toegepast: sequence 0, maar
 * een klok die kan meedoen. */
function preMatch(overrides = {}) {
  return local({ matchId: null, matchSequence: null, ...overrides });
}

/** Snapshot volgens PROTOCOL.md "State-snapshot"; alleen beslissingsvelden variëren. */
function snap({
  protocolVersion = V1, serverTime = T_LATE, code = ROOM,
  matchId = MATCH_A, matchSequence = SEQ_A, room,
} = {}) {
  return {
    protocolVersion,
    serverTime,
    room:
      room === undefined
        ? {
            code, phase: 'ROUND_ACTIVE', locked: false, playerCount: 23, config: {},
            matchId, matchSequence,
          }
        : room,
    self: { roles: ['player'], playerId: 'p_8f42d1', score: 600, answeredCurrentRound: false },
    currentRound: {},
    scoreboard: { top: [], self: {} },
  };
}

/** Pre-match-lobby-snapshot: `matchId` én `matchSequence` allebei null (PROTOCOL.md
 * §State-snapshot, INT-17). Telt voor de ordening als sequence 0. */
function lobbySnap(overrides = {}) {
  return snap({ matchId: null, matchSequence: null, ...overrides });
}

/** Server → client envelope (PROTOCOL.md "Event-envelope"). De envelope draagt GEEN
 * matchSequence; alleen sommige payloads dragen een `matchId`. */
function evt(serverTime = T_LATE, name = 'round:started', matchId = MATCH_A) {
  return { event: name, eventId: 'evt_01J', serverTime, payload: { matchId } };
}

/** Kopie zonder één sleutel — voor de "ontbrekend veld"-rijen. */
function omit(source, key) {
  const copy = { ...source };
  delete copy[key];
  return copy;
}

const applied = (matchChanged) => ({ apply: true, matchChanged });
/** Beide ingangen geven dezelfde vorm terug; op het eventpad is `matchChanged` alleen
 * true als de payload een ándere `matchId` NOEMT (de envelope draagt geen sequence). */
const appliedEvent = (matchChanged = false) => ({ apply: true, matchChanged });
const denied = (reason) => ({ apply: false, reason });

/** @returns {Fixture} */
const row = (description, localState, incoming, expected) =>
  ({ description, localState, incoming, expected });

/** @type {Fixture[]} */
const SNAPSHOT_FIXTURES = [
  // [1] Kernregel: een snapshot wint van eerder ontvangen events (basisregel 6).
  row('nieuwere snapshot overschrijft event-state', local(), snap(), applied(false)),
  row('snapshot met GELIJKE serverTime wint van reeds toegepast event',
    local(), snap({ serverTime: T_NOW }), applied(false)),
  row('nieuwere snapshot overschrijft eerdere snapshot-state',
    local({ appliedFrom: 'snapshot' }), snap(), applied(false)),

  // [2] Maar een STALE snapshot wint niet: out-of-order aankomst na reconnect.
  row('oudere snapshot draait nieuwere event-state niet terug',
    local(), snap({ serverTime: T_EARLY }), denied(REASONS.STALE_SNAPSHOT)),
  row('oudere snapshot draait nieuwere snapshot-state niet terug',
    local({ appliedServerTime: T_LATE, appliedFrom: 'snapshot' }), snap({ serverTime: T_NOW }),
    denied(REASONS.STALE_SNAPSHOT)),
  row('trage tweede /state-respons van vóór de laatste event-tick is stale',
    local({ appliedServerTime: T_LATE }), snap({ serverTime: T_EARLY }),
    denied(REASONS.STALE_SNAPSHOT)),
  // DUPLICATE_SNAPSHOT staat in geen enkele bron: PROTOCOL.md zegt niets over twee
  // snapshots op hetzelfde tijdstip. De module redeneert dat een snapshot TOTALE state
  // is en een tweede dus niets toevoegt. Dat is een afspraak, geen eis.
  row(`${MODULE_CHOICE}snapshot met GELIJKE serverTime als reeds toegepaste snapshot is een duplicaat`,
    local({ appliedFrom: 'snapshot' }), snap({ serverTime: T_NOW }),
    denied(REASONS.DUPLICATE_SNAPSHOT)),

  // [3] Verse client: er is nog niets om achterhaald door te raken.
  row('eerste snapshot op een verse client wordt toegepast', fresh(), snap(), applied(true)),
  row('eerste snapshot zonder actieve match', fresh(), lobbySnap(), applied(false)),
  row('oude serverTime is op een verse client prima', fresh(), snap({ serverTime: T_EARLY }), applied(true)),

  // [4] Protocolversie gaat vóór alles wat inhoud is. PROTOCOL.md schrijft NIET voor wat
  // een client met een afwijkende protocolVersion moet doen, en gebruikt
  // PROTOCOL_VERSION_UNSUPPORTED als wire-foutcode server → client. Afwijzen én die code
  // lokaal als motief hergebruiken zijn allebei keuzes van de module (open punt a en b).
  row(`${MODULE_CHOICE}afwijkende protocolVersion v2 wordt afgewezen`,
    local(), snap({ protocolVersion: 'v2' }), denied(REASONS.PROTOCOL_VERSION_UNSUPPORTED)),
  row(`${MODULE_CHOICE}protocolVersion is hoofdlettergevoelig: "V1" wordt afgewezen`,
    local(), snap({ protocolVersion: 'V1' }), denied(REASONS.PROTOCOL_VERSION_UNSUPPORTED)),
  row(`${MODULE_CHOICE}versiecheck gaat vóór de tijdcheck: stale én v2 → PROTOCOL_VERSION_UNSUPPORTED`,
    local(), snap({ protocolVersion: 'v2', serverTime: T_EARLY }),
    denied(REASONS.PROTOCOL_VERSION_UNSUPPORTED)),
  row(`${MODULE_CHOICE}versiecheck gaat vóór de roomcheck: andere room én v2 → PROTOCOL_VERSION_UNSUPPORTED`,
    local(), snap({ protocolVersion: 'v2', code: OTHER_ROOM }),
    denied(REASONS.PROTOCOL_VERSION_UNSUPPORTED)),
  row(`${MODULE_CHOICE}lokaal verwachte v2 wijst een v1-snapshot af`,
    local({ protocolVersion: 'v2' }), snap(), denied(REASONS.PROTOCOL_VERSION_UNSUPPORTED)),

  // [5] Room-identiteit: een snapshot van een andere room is een routeringsfout.
  row('snapshot voor een andere room wordt afgewezen',
    local(), snap({ code: OTHER_ROOM }), denied(REASONS.ROOM_MISMATCH)),
  row('roomcheck gaat vóór de tijdcheck: andere room én nieuwer → ROOM_MISMATCH',
    local({ appliedServerTime: T_EARLY }), snap({ code: OTHER_ROOM, serverTime: T_LATE }),
    denied(REASONS.ROOM_MISMATCH)),
  row('roomcheck gaat vóór de tijdcheck: andere room én stale → ROOM_MISMATCH',
    local(), snap({ code: OTHER_ROOM, serverTime: T_EARLY }), denied(REASONS.ROOM_MISMATCH)),

  // [6] Matchordening: `matchSequence` gaat vóór `serverTime` (PROTOCOL.md
  // §State-snapshot, commit bb07aa9). Een strikt lagere sequence verliest altijd, een
  // strikt hogere wint altijd — hoe de klok er ook bij staat.
  row('strikt lagere sequence verliest, ook met een veel NIEUWERE serverTime',
    local({ matchId: MATCH_B, matchSequence: SEQ_B }),
    snap({ matchId: MATCH_A, matchSequence: SEQ_A, serverTime: T_LATE + 3_600_000 }),
    denied(REASONS.STALE_MATCH_SEQUENCE)),
  row('strikt hogere sequence wint, ook met een OUDERE serverTime',
    local({ appliedServerTime: T_LATE }),
    snap({ matchId: MATCH_B, matchSequence: SEQ_B, serverTime: T_EARLY }), applied(true)),
  row('strikt hogere sequence wint ook van een toegepaste snapshot op hetzelfde tijdstip',
    local({ appliedFrom: 'snapshot' }),
    snap({ matchId: MATCH_B, matchSequence: SEQ_B, serverTime: T_NOW }), applied(true)),
  row('strikt lagere sequence verliest ook bij een gelijke serverTime',
    local({ matchId: MATCH_B, matchSequence: SEQ_B }),
    snap({ matchId: MATCH_A, matchSequence: SEQ_A, serverTime: T_NOW }),
    denied(REASONS.STALE_MATCH_SEQUENCE)),
  row('matchordening komt ná de roomcheck: andere room én hogere sequence → ROOM_MISMATCH',
    local(), snap({ code: OTHER_ROOM, matchId: MATCH_B, matchSequence: SEQ_B }),
    denied(REASONS.ROOM_MISMATCH)),
  row(`${MODULE_CHOICE}matchordening komt ná de versiecheck: v2 én lagere sequence → PROTOCOL_VERSION_UNSUPPORTED`,
    local({ matchId: MATCH_B, matchSequence: SEQ_B }),
    snap({ protocolVersion: 'v2', matchId: MATCH_A, matchSequence: SEQ_A }),
    denied(REASONS.PROTOCOL_VERSION_UNSUPPORTED)),
  row('een sprong van meer dan één sequence wint gewoon',
    local(), snap({ matchId: MATCH_B, matchSequence: SEQ_A + 7 }), applied(true)),

  // [6b] Rematch: een nieuwe match binnen DEZELFDE room is een geldige overgang, geen
  // fout. Het resultaat draagt `matchChanged: true` zodat de aanroeper score, streak,
  // rondetimer en antwoordstatus weggooit (GAME-FLOW.md §12).
  row('rematch: nieuwe match binnen dezelfde room wordt toegepast en gemarkeerd',
    local(), snap({ matchId: MATCH_B, matchSequence: SEQ_B }), applied(true)),
  row('rematch met gelijke serverTime wint op sequence van event-state',
    local(), snap({ matchId: MATCH_B, matchSequence: SEQ_B, serverTime: T_NOW }), applied(true)),
  row('eerste match: sequence 0 → 1 wordt gemarkeerd als matchwissel',
    preMatch(), snap({ matchId: MATCH_A, matchSequence: SEQ_A }), applied(true)),
  row('zelfde match levert matchChanged false op',
    local(), snap({ matchId: MATCH_A, matchSequence: SEQ_A }), applied(false)),
  row('snapshot van de VORIGE match valt nu af op sequence, niet meer op tijd',
    local({ matchId: MATCH_B, matchSequence: SEQ_B, appliedServerTime: T_LATE }),
    snap({ matchId: MATCH_A, matchSequence: SEQ_A, serverTime: T_NOW }),
    denied(REASONS.STALE_MATCH_SEQUENCE)),
  row('binnen DEZELFDE match valt een oudere snapshot nog steeds af op tijd',
    local({ appliedServerTime: T_LATE }), snap({ serverTime: T_NOW }),
    denied(REASONS.STALE_SNAPSHOT)),

  // [6c] Pre-match-lobby (PROTOCOL.md §State-snapshot, INT-17): `matchId` én
  // `matchSequence` allebei null telt als sequence 0. Elke echte match wint ervan, en
  // een lobby-snapshot dat ná een match binnenkomt is een terugval.
  row('pre-match-lobby verliest van elke echte match, ook met een nieuwere serverTime',
    local(), lobbySnap({ serverTime: T_LATE }), denied(REASONS.STALE_MATCH_SEQUENCE)),
  row('pre-match-lobby verliest ook van een match met een oudere serverTime',
    local({ appliedServerTime: T_LATE }), lobbySnap({ serverTime: T_LATE + 1 }),
    denied(REASONS.STALE_MATCH_SEQUENCE)),
  row('pre-match-lobby wint van niets: op een verse client wordt hij toegepast',
    fresh(), lobbySnap(), applied(false)),
  row('een echte match wint van een toegepaste pre-match-lobby, ook met een oudere klok',
    preMatch({ appliedServerTime: T_LATE }), snap({ serverTime: T_EARLY }), applied(true)),
  row('twee lobby-snapshots ordenen onderling gewoon op serverTime',
    preMatch({ appliedServerTime: T_LATE }), lobbySnap({ serverTime: T_NOW }),
    denied(REASONS.STALE_SNAPSHOT)),
  row(`${MODULE_CHOICE}tweede lobby-snapshot op hetzelfde tijdstip is een duplicaat`,
    preMatch({ appliedFrom: 'snapshot' }), lobbySnap({ serverTime: T_NOW }),
    denied(REASONS.DUPLICATE_SNAPSHOT)),

  // [7] Ontbrekende, lege of vijandige snapshotvelden → nooit een exception.
  row('snapshot null', local(), null, denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot undefined', local(), undefined, denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot als array', local(), [], denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot als string', local(), 'snapshot', denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot als getal', local(), 42, denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot zonder protocolVersion', local(), omit(snap(), 'protocolVersion'),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot met lege protocolVersion', local(), snap({ protocolVersion: '' }),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot zonder serverTime', local(), omit(snap(), 'serverTime'),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('serverTime als numerieke string vergelijkt niet en wordt afgewezen',
    local(), snap({ serverTime: String(T_LATE) }), denied(REASONS.INVALID_SNAPSHOT)),
  row('serverTime NaN', local(), snap({ serverTime: NaN }), denied(REASONS.INVALID_SNAPSHOT)),
  row('serverTime Infinity', local(), snap({ serverTime: Infinity }), denied(REASONS.INVALID_SNAPSHOT)),
  row('serverTime negatief', local(), snap({ serverTime: -1 }), denied(REASONS.INVALID_SNAPSHOT)),
  row('serverTime null', local(), snap({ serverTime: null }), denied(REASONS.INVALID_SNAPSHOT)),
  row('snapshot zonder room', local(), omit(snap(), 'room'), denied(REASONS.INVALID_SNAPSHOT)),
  row('room null', local(), snap({ room: null }), denied(REASONS.INVALID_SNAPSHOT)),
  row('room als array', local(), snap({ room: [] }), denied(REASONS.INVALID_SNAPSHOT)),
  row('room zonder code', local(),
    snap({ room: { phase: 'LOBBY', matchId: MATCH_A, matchSequence: SEQ_A } }),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('room.code leeg', local(), snap({ code: '' }), denied(REASONS.INVALID_SNAPSHOT)),
  row('room zonder matchId: ontbrekend is geen impliciete null',
    local(), snap({ room: { code: ROOM, phase: 'LOBBY', matchSequence: SEQ_A } }),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('room.matchId als lege string', local(), snap({ matchId: '' }), denied(REASONS.INVALID_SNAPSHOT)),
  row('structuurcheck gaat vóór de versiecheck: v2 zonder room → INVALID_SNAPSHOT',
    local(), omit(snap({ protocolVersion: 'v2' }), 'room'), denied(REASONS.INVALID_SNAPSHOT)),

  // [7b] `room.matchId` en `room.matchSequence` zijn ÉÉN feit. PROTOCOL.md
  // §State-snapshot: allebei null is de pre-match-lobby, precies één van beide null is
  // inconsistent en ongeldig — geen randgeval maar een afwijzing. En `matchSequence` is
  // een integer ≥ 1: 0 bestaat niet op de wire, die waarde heet daar `null`.
  row('alleen matchId null (sequence gevuld) is inconsistent en ongeldig',
    local(), snap({ matchId: null, matchSequence: SEQ_A }), denied(REASONS.INVALID_SNAPSHOT)),
  row('alleen matchSequence null (matchId gevuld) is inconsistent en ongeldig',
    local(), snap({ matchId: MATCH_A, matchSequence: null }), denied(REASONS.INVALID_SNAPSHOT)),
  row('room zonder matchSequence: ontbrekend is geen impliciete null',
    local(), snap({ room: { code: ROOM, phase: 'LOBBY', matchId: MATCH_A } }),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('room zonder matchId én zonder matchSequence is niet dezelfde vorm als twee keer null',
    local(), snap({ room: { code: ROOM, phase: 'LOBBY' } }), denied(REASONS.INVALID_SNAPSHOT)),
  row('matchSequence 0 bestaat niet op de wire: pre-match heet daar null',
    local(), snap({ matchSequence: 0 }), denied(REASONS.INVALID_SNAPSHOT)),
  row('matchSequence negatief', local(), snap({ matchSequence: -1 }),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('matchSequence fractioneel: een teller is geen meting',
    local(), snap({ matchSequence: 1.5 }), denied(REASONS.INVALID_SNAPSHOT)),
  row('matchSequence als numerieke string', local(), snap({ matchSequence: '2' }),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('matchSequence NaN', local(), snap({ matchSequence: NaN }), denied(REASONS.INVALID_SNAPSHOT)),
  row('matchSequence Infinity', local(), snap({ matchSequence: Infinity }),
    denied(REASONS.INVALID_SNAPSHOT)),
  row('structuurcheck gaat vóór de matchordening: lagere sequence én kapot paar → INVALID_SNAPSHOT',
    local({ matchId: MATCH_B, matchSequence: SEQ_B }), snap({ matchId: null, matchSequence: SEQ_A }),
    denied(REASONS.INVALID_SNAPSHOT)),

  // [8] LocalState-validatie gaat vóór alles: zonder betrouwbare lokale herkomst is
  // er niets om tegen af te wegen.
  row('localState null', null, snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState undefined', undefined, snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState als array', [], snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState als string', 'state', snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState zonder roomCode', omit(local(), 'roomCode'), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState met lege protocolVersion', local({ protocolVersion: '' }), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row('localState zonder matchId-veld', omit(local(), 'matchId'), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  // `matchSequence` is verplicht aanwezig. Zou hij bij afwezigheid stilzwijgend 0
  // worden, dan is ELK snapshot strikt hoger en resetten score en streak bij elke
  // binnenkomst. Luid afwijzen is hier de veilige kant; zie de modulekop.
  row(`${MODULE_CHOICE}localState zonder matchSequence-veld wordt afgewezen, niet als 0 gelezen`,
    omit(local(), 'matchSequence'), snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row(`${MODULE_CHOICE}localState met matchSequence 0`, local({ matchSequence: 0 }), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row(`${MODULE_CHOICE}localState met fractionele matchSequence`, local({ matchSequence: 1.5 }), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row(`${MODULE_CHOICE}localState met matchSequence als string`, local({ matchSequence: '1' }), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row(`${MODULE_CHOICE}localState met matchSequence undefined`, local({ matchSequence: undefined }),
    snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  // Het paar matchId/matchSequence wordt in de LOKALE state juist NIET gekruist: na een
  // rematch-event kent de aanroeper de nieuwe matchId al en de sequence nog niet. Die
  // combinatie moet blijven werken, anders loopt de client vast op het pad dat de
  // matchordening moest repareren.
  row(`${MODULE_CHOICE}localState met matchId zonder sequence-verhoging blijft geldig`,
    local({ matchId: MATCH_B }), snap({ matchId: MATCH_B, matchSequence: SEQ_B }), applied(true)),
  row(`${MODULE_CHOICE}localState met matchId null en een sequence blijft geldig`,
    local({ matchId: null }), snap(), applied(true)),
  row('halve herkomst: appliedServerTime gevuld, appliedFrom null',
    local({ appliedFrom: null }), snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('halve herkomst: appliedServerTime null, appliedFrom "event"',
    local({ appliedServerTime: null }), snap(), denied(REASONS.INVALID_LOCAL_STATE)),
  row('onbekende appliedFrom-waarde', local({ appliedFrom: 'snap' }), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row('appliedServerTime als string', local({ appliedServerTime: String(T_NOW) }), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row('appliedServerTime ontbreekt volledig', omit(local(), 'appliedServerTime'), snap(),
    denied(REASONS.INVALID_LOCAL_STATE)),
  row('ongeldige localState wint van ongeldige snapshot', null, null, denied(REASONS.INVALID_LOCAL_STATE)),

  // [9] Fractionele epoch-ms. server-time.js levert halve milliseconden (`offsetMs`
  // 498.5), dus "epoch-ms" mag niet twee verschillende impliciete betekenissen krijgen.
  // De modulekop kiest expliciet: elke eindige, niet-negatieve waarde is geldig, ook een
  // fractie, en fracties ordenen gewoon mee. Beide richtingen liggen hier vast.
  row(`${MODULE_CHOICE}fractionele serverTime is geldig: een halve ms nieuwer wint`,
    local(), snap({ serverTime: T_JUST_AFTER_NOW }), applied(false)),
  row(`${MODULE_CHOICE}fractionele serverTime een halve ms ouder is stale`,
    local(), snap({ serverTime: T_JUST_BEFORE_NOW }), denied(REASONS.STALE_SNAPSHOT)),
  row(`${MODULE_CHOICE}fractionele appliedServerTime in de lokale state is geldig`,
    local({ appliedServerTime: T_JUST_BEFORE_NOW }), snap({ serverTime: T_NOW }), applied(false)),
  row(`${MODULE_CHOICE}identiek fractioneel tijdstip na een snapshot is een duplicaat`,
    local({ appliedServerTime: T_JUST_AFTER_NOW, appliedFrom: 'snapshot' }),
    snap({ serverTime: T_JUST_AFTER_NOW }), denied(REASONS.DUPLICATE_SNAPSHOT)),
  row(`${MODULE_CHOICE}fractionele serverTime op een verse client wordt toegepast`,
    fresh(), snap({ serverTime: T_JUST_AFTER_NOW }), applied(true)),
];

/** @type {Fixture[]} */
const EVENT_FIXTURES = [
  // [1] Normale event-voortgang op event-state.
  row('nieuwer event wordt toegepast', local(), evt(T_LATE), appliedEvent()),
  row('event met gelijke serverTime als een eerder event landt ook (partiële delta)',
    local(), evt(T_NOW, 'scoreboard:updated'), appliedEvent()),
  row('out-of-order: ouder event dan de laatste event-tick wordt genegeerd',
    local(), evt(T_EARLY), denied(REASONS.STALE_EVENT)),

  // [2] De andere helft van basisregel 6: de snapshot is leidend boven eerder
  // ontvangen events.
  row('event van vóór de toegepaste snapshot wordt genegeerd',
    local({ appliedFrom: 'snapshot' }), evt(T_EARLY), denied(REASONS.SUPERSEDED_BY_SNAPSHOT)),
  row('event met gelijke serverTime als de snapshot verliest van de snapshot',
    local({ appliedFrom: 'snapshot' }), evt(T_NOW), denied(REASONS.SUPERSEDED_BY_SNAPSHOT)),
  row('event ná de snapshot landt wel', local({ appliedFrom: 'snapshot' }), evt(T_LATE), appliedEvent()),

  // [3] Verse client: elk geldig event mag landen. De payload noemt match A terwijl er
  // lokaal nog geen match is, dus het matchwissel-signaal staat aan.
  row('event op een verse client wordt toegepast', fresh(), evt(T_LATE), appliedEvent(true)),
  row('oud event op een verse client wordt ook toegepast', fresh(), evt(T_EARLY), appliedEvent(true)),

  // [4] Ongeldige envelope → nooit een exception.
  row('event null', local(), null, denied(REASONS.INVALID_EVENT)),
  row('event undefined', local(), undefined, denied(REASONS.INVALID_EVENT)),
  row('event als array', local(), [], denied(REASONS.INVALID_EVENT)),
  row('event als string', local(), 'round:started', denied(REASONS.INVALID_EVENT)),
  row('event zonder serverTime', local(), omit(evt(), 'serverTime'), denied(REASONS.INVALID_EVENT)),
  row('event met serverTime als string', local(), evt(String(T_LATE)), denied(REASONS.INVALID_EVENT)),
  row('event met serverTime NaN', local(), evt(NaN), denied(REASONS.INVALID_EVENT)),
  row('event met negatieve serverTime', local(), evt(-1), denied(REASONS.INVALID_EVENT)),
  row('event zonder eventnaam is geldig: alleen serverTime telt voor de ordening',
    local(), { serverTime: T_LATE }, appliedEvent()),

  // [5] Fractionele epoch-ms, dezelfde keuze als bij de snapshotregel: een halve ms telt
  // volwaardig mee in de ordening, in beide richtingen en tegen beide herkomsten.
  row(`${MODULE_CHOICE}event een halve ms ná het laatste event landt`,
    local(), evt(T_JUST_AFTER_NOW), appliedEvent()),
  row(`${MODULE_CHOICE}event een halve ms vóór het laatste event is stale`,
    local(), evt(T_JUST_BEFORE_NOW), denied(REASONS.STALE_EVENT)),
  row(`${MODULE_CHOICE}event een halve ms vóór de toegepaste snapshot is achterhaald`,
    local({ appliedFrom: 'snapshot' }), evt(T_JUST_BEFORE_NOW),
    denied(REASONS.SUPERSEDED_BY_SNAPSHOT)),
  row(`${MODULE_CHOICE}event een halve ms ná de toegepaste snapshot landt wel`,
    local({ appliedFrom: 'snapshot' }), evt(T_JUST_AFTER_NOW), appliedEvent()),

  // [6] Het matchwissel-signaal op het EVENTpad. De envelope draagt geen
  // `matchSequence`, dus dit is uitdrukkelijk SIGNALEREN en geen ordenen: uit een
  // afwijkende `payload.matchId` volgt "een andere match", niet "een latere". Dat de
  // module dit signaal überhaupt afgeeft is een moduleafspraak — PROTOCOL.md schrijft
  // het niet voor — maar zonder dat signaal haalt het normale rematchpad
  // (`game:rematch-started` is een event) GAME-FLOW.md §12 niet.
  row(`${MODULE_CHOICE}game:rematch-started met een nieuwe matchId markeert een matchwissel`,
    local(), evt(T_LATE, 'game:rematch-started', MATCH_B), appliedEvent(true)),
  row(`${MODULE_CHOICE}event van dezelfde match markeert geen matchwissel`,
    local(), evt(T_LATE, 'round:started', MATCH_A), appliedEvent(false)),
  row(`${MODULE_CHOICE}event zonder payload geeft geen signaal`,
    local(), { event: 'round:progress', serverTime: T_LATE }, appliedEvent(false)),
  row(`${MODULE_CHOICE}event met een lege payload geeft geen signaal`,
    local(), { event: 'round:progress', serverTime: T_LATE, payload: {} }, appliedEvent(false)),
  row(`${MODULE_CHOICE}payload.matchId als lege string telt als geen signaal, niet als fout`,
    local(), evt(T_LATE, 'round:started', ''), appliedEvent(false)),
  row(`${MODULE_CHOICE}payload.matchId van het verkeerde type maakt de envelope niet ongeldig`,
    local(), { event: 'round:started', serverTime: T_LATE, payload: { matchId: 42 } },
    appliedEvent(false)),
  row(`${MODULE_CHOICE}payload als array levert geen signaal en geen fout`,
    local(), { event: 'round:started', serverTime: T_LATE, payload: [MATCH_B] },
    appliedEvent(false)),
  // DE GRENS, expliciet vastgelegd: zonder sequence kan de eventregel de RICHTING van
  // een matchwissel niet zien. Een rematch-event op dezelfde ms als een toegepast
  // snapshot valt dus alsnog af, en een event van een OUDERE match dat toevallig een
  // nieuwere serverTime draagt landt gewoon. Beide worden pas sluitend met
  // `matchSequence` in de event-envelope (open punt (e) in de modulekop).
  row(`${MODULE_CHOICE}grens: rematch-event op de ms van een toegepaste snapshot valt alsnog af`,
    local({ appliedFrom: 'snapshot' }), evt(T_NOW, 'game:rematch-started', MATCH_B),
    denied(REASONS.SUPERSEDED_BY_SNAPSHOT)),
  row(`${MODULE_CHOICE}grens: event van een oudere match met nieuwere serverTime landt gewoon`,
    local({ matchId: MATCH_B, matchSequence: SEQ_B }), evt(T_LATE, 'round:started', MATCH_A),
    appliedEvent(true)),

  // [7] LocalState-validatie gaat ook hier voorop, inclusief het verplichte
  // `matchSequence`-veld.
  row('event: localState null', null, evt(T_LATE), denied(REASONS.INVALID_LOCAL_STATE)),
  row('event: ongeldige local wint van ongeldig event', 'state', null, denied(REASONS.INVALID_LOCAL_STATE)),
  row(`${MODULE_CHOICE}event: localState zonder matchSequence-veld wordt afgewezen`,
    omit(local(), 'matchSequence'), evt(T_LATE), denied(REASONS.INVALID_LOCAL_STATE)),
];

/** Draait één fixtureset: exacte uitkomst plus non-mutatie van beide argumenten. */
async function runFixtures(t, fixtures, decide) {
  for (const fixture of fixtures) {
    await t.test(fixture.description, () => {
      const localBefore = structuredClone(fixture.localState);
      const incomingBefore = structuredClone(fixture.incoming);
      const result = decide(fixture.localState, fixture.incoming);

      assert.deepStrictEqual(result, fixture.expected);
      assert.deepStrictEqual(fixture.localState, localBefore, 'localState mag niet muteren');
      assert.deepStrictEqual(fixture.incoming, incomingBefore, 'invoer mag niet muteren');
    });
  }
}

test('shouldApplySnapshot — beslistabel', async (t) => {
  await runFixtures(t, SNAPSHOT_FIXTURES, shouldApplySnapshot);
});

test('shouldApplyEvent — beslistabel', async (t) => {
  await runFixtures(t, EVENT_FIXTURES, shouldApplyEvent);
});

test('beide argumenten blijven ongewijzigd, inclusief geneste objecten', () => {
  const localState = local();
  const snapshot = snap({ matchId: MATCH_B, matchSequence: SEQ_B });
  const localCopy = structuredClone(localState);
  const incomingCopy = structuredClone(snapshot);
  const roomRef = snapshot.room;

  assert.deepStrictEqual(shouldApplySnapshot(localState, snapshot), applied(true));
  assert.deepStrictEqual(localState, localCopy);
  assert.deepStrictEqual(snapshot, incomingCopy);
  assert.strictEqual(snapshot.room, roomRef, 'genest room-object niet vervangen');
});

test('afwijzing raakt de lokale state niet aan en draagt geen matchChanged', () => {
  const localState = local({ appliedFrom: 'snapshot' });
  const before = structuredClone(localState);
  const result = shouldApplySnapshot(localState, snap({ serverTime: T_EARLY }));

  assert.deepStrictEqual(result, denied(REASONS.STALE_SNAPSHOT));
  assert.deepStrictEqual(localState, before);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'matchChanged'), false);
});

/** Kopie waarin precies één property werpt bij lezing. */
function withThrowingGetter(base, key) {
  const target = { ...base };
  Object.defineProperty(target, key, {
    enumerable: true,
    get() {
      throw new Error('vijandige getter');
    },
  });
  return target;
}

test('werpende getters leveren een afwijzing op, geen exception', () => {
  const hostileRoom = withThrowingGetter({ code: ROOM, matchId: MATCH_A, matchSequence: SEQ_A }, 'code');
  const hostileSequence = withThrowingGetter({ code: ROOM, matchId: MATCH_A, matchSequence: SEQ_A }, 'matchSequence');

  assert.deepStrictEqual(shouldApplySnapshot(local(), withThrowingGetter(snap(), 'room')),
    denied(REASONS.INVALID_SNAPSHOT));
  assert.deepStrictEqual(shouldApplySnapshot(local(), snap({ room: hostileRoom })),
    denied(REASONS.INVALID_SNAPSHOT));
  assert.deepStrictEqual(shouldApplySnapshot(local(), snap({ room: hostileSequence })),
    denied(REASONS.INVALID_SNAPSHOT));
  assert.deepStrictEqual(shouldApplySnapshot(withThrowingGetter(local(), 'appliedServerTime'), snap()),
    denied(REASONS.INVALID_LOCAL_STATE));
  assert.deepStrictEqual(shouldApplySnapshot(withThrowingGetter(local(), 'matchSequence'), snap()),
    denied(REASONS.INVALID_LOCAL_STATE));
  assert.deepStrictEqual(shouldApplyEvent(local(), withThrowingGetter(evt(), 'serverTime')),
    denied(REASONS.INVALID_EVENT));
  // Een werpende `payload` mag het event NIET ongeldig maken: hij draagt alleen het
  // signaal, niet de ordening. Het event landt zonder matchwissel-signaal.
  assert.deepStrictEqual(shouldApplyEvent(local(), withThrowingGetter(evt(), 'payload')),
    appliedEvent(false));
});

/** Ingetrokken Proxy: élke bewerking werpt, inclusief `Array.isArray()` — dus ook de
 * typecontrole zelf, niet alleen de veldlezing. Dit is de vorm die een opgeruimde wrapper
 * rond een verbroken socket kan achterlaten. Kan niet door de tabelrunner: hij is niet te
 * klonen en niet te vergelijken. */
function revokedProxy() {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  return proxy;
}

/** Proxy waarvan élke trap werpt: zowel de aanwezigheidscheck als de lezing loopt erop
 * stuk, ook bij een veld dat "gewoon" zou moeten bestaan. */
function hostileProxy() {
  const boom = () => {
    throw new Error('vijandige trap');
  };
  return new Proxy({}, { get: boom, has: boom, getOwnPropertyDescriptor: boom, ownKeys: boom });
}

test('ingetrokken Proxy geeft een afwijzing, geen exception — alle drie de ingangen', () => {
  const revoked = revokedProxy();

  assert.deepStrictEqual(shouldApplySnapshot(local(), revoked), denied(REASONS.INVALID_SNAPSHOT));
  assert.deepStrictEqual(shouldApplySnapshot(revoked, snap()), denied(REASONS.INVALID_LOCAL_STATE));
  assert.deepStrictEqual(shouldApplyEvent(local(), revoked), denied(REASONS.INVALID_EVENT));
  // En genest: `room` is de enige geneste lezing in de beslissing.
  assert.deepStrictEqual(shouldApplySnapshot(local(), snap({ room: revoked })),
    denied(REASONS.INVALID_SNAPSHOT));
});

test('Proxy met werpende traps geeft een afwijzing, geen exception — alle drie de ingangen', () => {
  const hostile = hostileProxy();

  assert.deepStrictEqual(shouldApplySnapshot(local(), hostile), denied(REASONS.INVALID_SNAPSHOT));
  assert.deepStrictEqual(shouldApplySnapshot(hostile, snap()), denied(REASONS.INVALID_LOCAL_STATE));
  assert.deepStrictEqual(shouldApplyEvent(local(), hostile), denied(REASONS.INVALID_EVENT));
  assert.deepStrictEqual(shouldApplySnapshot(local(), snap({ room: hostile })),
    denied(REASONS.INVALID_SNAPSHOT));
});

test('vervuild Object.prototype vult geen ontbrekend veld in', () => {
  const snapshotZonderMatchId = snap({ room: { code: ROOM, phase: 'LOBBY', matchSequence: SEQ_A } });
  const snapshotZonderSequence = snap({ room: { code: ROOM, phase: 'LOBBY', matchId: MATCH_A } });

  assert.deepStrictEqual(shouldApplySnapshot(local(), snapshotZonderMatchId),
    denied(REASONS.INVALID_SNAPSHOT), 'schoon prototype: ontbrekend veld blijft ongeldig');

  // Opruimen in finally, anders lekt de vervuiling naar elke andere test in dit proces.
  Object.prototype.matchId = MATCH_B;
  Object.prototype.matchSequence = SEQ_B;
  Object.prototype.serverTime = T_LATE;
  Object.prototype.appliedFrom = 'event';
  try {
    assert.deepStrictEqual(shouldApplySnapshot(local(), snapshotZonderMatchId),
      denied(REASONS.INVALID_SNAPSHOT), 'geen verzonnen matchId, dus ook geen verzonnen rematch');
    // Dit is de gevaarlijkste van de vier: een verzonnen `matchSequence` zou een
    // snapshot over de matchgrens heen laten winnen en per-match state laten resetten.
    assert.deepStrictEqual(shouldApplySnapshot(local(), snapshotZonderSequence),
      denied(REASONS.INVALID_SNAPSHOT), 'geen verzonnen matchSequence in een snapshot');
    assert.deepStrictEqual(shouldApplySnapshot(local(), omit(snap(), 'serverTime')),
      denied(REASONS.INVALID_SNAPSHOT), 'geen verzonnen serverTime in een snapshot');
    assert.deepStrictEqual(shouldApplyEvent(local(), omit(evt(), 'serverTime')),
      denied(REASONS.INVALID_EVENT), 'geen verzonnen serverTime in een envelope');
    assert.deepStrictEqual(shouldApplySnapshot(omit(local(), 'appliedFrom'), snap()),
      denied(REASONS.INVALID_LOCAL_STATE), 'geen verzonnen herkomst in de lokale state');
    assert.deepStrictEqual(shouldApplySnapshot(omit(local(), 'matchSequence'), snap()),
      denied(REASONS.INVALID_LOCAL_STATE), 'geen verzonnen sequence in de lokale state');
  } finally {
    delete Object.prototype.matchId;
    delete Object.prototype.matchSequence;
    delete Object.prototype.serverTime;
    delete Object.prototype.appliedFrom;
  }

  assert.strictEqual('matchId' in {}, false, 'Object.prototype is weer schoon');
  assert.strictEqual('matchSequence' in {}, false, 'Object.prototype is weer schoon');
});

test('reconnectscenario: snapshot en events lopen door elkaar (PROTOCOL.md "Reconnect")', () => {
  // De aanroeper werkt zijn LocalState telkens bij zoals de modulekop voorschrijft;
  // deze test doet dat expliciet, met vaste tijdstempels en zonder klok.
  let state = fresh();

  // Stap 5: na verbinding vraagt de client een snapshot; niets heeft die achterhaald.
  assert.deepStrictEqual(shouldApplySnapshot(state, snap({ serverTime: T_NOW })), applied(true));
  state = local({ appliedServerTime: T_NOW, appliedFrom: 'snapshot' });

  // Een event van vóór de onderbreking arriveert alsnog en mag niets terugdraaien.
  assert.deepStrictEqual(shouldApplyEvent(state, evt(T_EARLY)),
    denied(REASONS.SUPERSEDED_BY_SNAPSHOT));

  // Een verse event-tick landt wel.
  assert.deepStrictEqual(shouldApplyEvent(state, evt(T_LATE)), appliedEvent(false));
  state = local({ appliedServerTime: T_LATE, appliedFrom: 'event' });

  // Een trage tweede /state-respons van vóór die tick draait niets terug.
  assert.deepStrictEqual(shouldApplySnapshot(state, snap({ serverTime: T_NOW })),
    denied(REASONS.STALE_SNAPSHOT));

  // De host start een rematch: nieuwe match binnen dezelfde room, nieuwere tijd.
  assert.deepStrictEqual(
    shouldApplySnapshot(state, snap({ serverTime: T_LATE + 1, matchId: MATCH_B, matchSequence: SEQ_B })),
    applied(true));
});

test('rematchscenario: het event reset, het snapshot bevestigt (GAME-FLOW.md §12)', () => {
  // Het NORMALE rematchpad loopt via een event, niet via een snapshot. Deze test legt
  // vast dat de aanroeper op beide momenten hoort dat hij per-match state weggooit.
  let state = local({ appliedServerTime: T_NOW, appliedFrom: 'snapshot' });

  // 1. `game:rematch-started` draagt de NIEUWE matchId maar geen sequence. De module
  //    ordent hem op tijd en signaleert de matchwissel.
  const rematch = shouldApplyEvent(state, evt(T_LATE, 'game:rematch-started', MATCH_B));
  assert.deepStrictEqual(rematch, appliedEvent(true), 'score en streak moeten hier naar nul');

  // 2. De aanroeper werkt bij wat hij weet: tijd, herkomst en matchId. De sequence kan
  //    hij niet bijwerken — het event draagt hem niet. Die achterstand is toegestaan.
  state = local({ matchId: MATCH_B, matchSequence: SEQ_A, appliedServerTime: T_LATE, appliedFrom: 'event' });

  // 3. Het eerstvolgende snapshot van die match draagt de sequence wél en wint erop,
  //    ook met een oudere klok. Het signaal komt een tweede keer; een reset is
  //    idempotent, een gemiste reset niet.
  const confirm = shouldApplySnapshot(state, snap({ matchId: MATCH_B, matchSequence: SEQ_B, serverTime: T_EARLY }));
  assert.deepStrictEqual(confirm, applied(true));

  // 4. Daarna is de client op de hoogte: hetzelfde snapshot nog eens geeft geen reset.
  state = local({ matchId: MATCH_B, matchSequence: SEQ_B, appliedServerTime: T_EARLY, appliedFrom: 'snapshot' });
  assert.deepStrictEqual(
    shouldApplySnapshot(state, snap({ matchId: MATCH_B, matchSequence: SEQ_B, serverTime: T_NOW })),
    applied(false));
});

test('sequence-terugkeer 2 → 1 → 2 wordt in de juiste richting afgewezen', () => {
  // matchIds zijn uniek per room (DATA-MODEL.md), dus terugkeer naar een eerdere match
  // is altijd fout. Met oplopende serverTime zou de oude regel alle vier de stappen
  // accepteren; de sequence-ordening weigert precies de middelste.
  const inMatchTwo = local({ matchId: MATCH_B, matchSequence: SEQ_B, appliedServerTime: T_NOW, appliedFrom: 'snapshot' });

  // Terug naar match 1, met een NIEUWERE klok: afgewezen.
  assert.deepStrictEqual(
    shouldApplySnapshot(inMatchTwo, snap({ matchId: MATCH_A, matchSequence: SEQ_A, serverTime: T_LATE })),
    denied(REASONS.STALE_MATCH_SEQUENCE));

  // En weer vooruit naar match 2: gewoon toegepast, ordenend op tijd binnen die match.
  assert.deepStrictEqual(
    shouldApplySnapshot(inMatchTwo, snap({ matchId: MATCH_B, matchSequence: SEQ_B, serverTime: T_LATE })),
    applied(false));

  // De omgekeerde richting blijft open: 1 → 2 wint altijd, ook met een oudere klok.
  const inMatchOne = local({ appliedServerTime: T_LATE, appliedFrom: 'snapshot' });
  assert.deepStrictEqual(
    shouldApplySnapshot(inMatchOne, snap({ matchId: MATCH_B, matchSequence: SEQ_B, serverTime: T_EARLY })),
    applied(true));
});

/** Motieven die deze module zelf verzint: PROTOCOL.md kent ze niet als clientgedrag. */
const SOURCELESS_REASONS = new Set([
  REASONS.DUPLICATE_SNAPSHOT,
  REASONS.PROTOCOL_VERSION_UNSUPPORTED,
]);

// Meta-test op de fixture-sets zelf: bewaakt de eisen aan de suite.
test('meta: exacte verwachtingen, unieke beschrijvingen en volledige motiefdekking', () => {
  const allFixtures = [...SNAPSHOT_FIXTURES, ...EVENT_FIXTURES];
  const seen = new Set();
  const usedReasons = new Set();
  const known = new Set(Object.values(REASONS));
  assert.ok(allFixtures.length > 0);

  for (const fixture of allFixtures) {
    assert.strictEqual(seen.has(fixture.description), false, `dubbel: ${fixture.description}`);
    seen.add(fixture.description);

    if (!fixture.expected.apply) {
      assert.ok(known.has(fixture.expected.reason), `onbekend motief: ${fixture.description}`);
      usedReasons.add(fixture.expected.reason);
      // Deze twee motieven staan in geen enkele bron; hun rijen moeten zichtbaar een
      // moduleafspraak vastleggen, anders vervaagt het onderscheid met een broneis weer.
      if (SOURCELESS_REASONS.has(fixture.expected.reason)) {
        assert.ok(fixture.description.startsWith(MODULE_CHOICE),
          `moet als moduleafspraak gemarkeerd zijn: ${fixture.description}`);
      }
      continue;
    }
    // Beide ingangen dragen het matchwissel-signaal, en allebei op dezelfde plek in de
    // uitkomst: zonder dat kan de aanroeper niet op één manier zien dat hij per-match
    // state moet weggooien. Op het snapshotpad volgt de vlag uit de sequence, op het
    // eventpad uit `payload.matchId` — de vorm van het antwoord is identiek.
    const hasFlag = Object.prototype.hasOwnProperty.call(fixture.expected, 'matchChanged');
    assert.strictEqual(hasFlag, true, `mist matchChanged: ${fixture.description}`);
    assert.strictEqual(typeof fixture.expected.matchChanged, 'boolean', fixture.description);
    assert.strictEqual(Object.keys(fixture.expected).length, 2, fixture.description);
  }

  // Elk gepubliceerd motief moet minstens één rij hebben.
  assert.deepStrictEqual([...usedReasons].sort(), [...known].sort());

  // De markering zelf mag niet stilletjes uit de suite verdwijnen.
  const marked = allFixtures.filter((f) => f.description.startsWith(MODULE_CHOICE));
  assert.ok(marked.length > 0, 'geen enkele rij is nog als moduleafspraak gemarkeerd');
});
