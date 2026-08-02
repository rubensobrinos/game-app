// Precedentieregel tussen snapshots en events binnen één room-sessie.
//
// WOONT ONDER shared/ EN IS ESM — BEWUST, NIET TOEVALLIG
// Deze module heette eerder `server/architecture/snapshot-precedence.js` en was
// CommonJS. Hij is verhuisd omdat de CLIENT hem nodig heeft: `frontend/js/transport.mjs`
// dwingt er "snapshot boven events" (PROTOCOL.md basisregel 6) mee af, en dat moet in een
// BROWSER gebeuren. Onder `server/` lukte dat om twee onafhankelijke redenen niet — het
// entrypoint mount alleen `/client/*`, `/shared/*` en `frontend/` statisch (`server/index.mjs`),
// dus `/server/**` gaf een 404, én CommonJS (`module.exports`) laadt sowieso niet als
// ES-module in een browser. Server en client moeten deze regel DELEN: twee implementaties
// van precies deze ordening is hoe state stilzwijgend uiteen gaat lopen. `shared/` is
// daarvoor de afgesproken plek (DECISIONS.md #29, dezelfde reden als de contentmodule).
//
// Bron: docs/multiplayer/ARCHITECTURE.md §3 "Snapshot boven event replay",
// docs/multiplayer/PROTOCOL.md basisregel 6 ("Snapshots zijn leidend boven eerder
// ontvangen events"), de sectie "Reconnect" (stap 1-7) en §State-snapshot
// (commit bb07aa9: `room.matchSequence`, matchordening vóór serverTime,
// pre-match-lobby), docs/multiplayer/DATA-MODEL.md (Room/Match: `Match.sequence`, en
// een rematch is een NIEUWE match binnen DEZELFDE room) en
// docs/multiplayer/GAME-FLOW.md §12 (bij een rematch gaan scores en streaks naar nul).
//
// Pure beslisregel: geen Redis, sockets, HTTP, filesystem, timers of klok. Er staat
// bewust nergens een `Date.now()` — tijd komt uitsluitend uit de `serverTime` van de
// meegegeven data (PROTOCOL.md: "tijden in epoch-milliseconden volgens servertijd").
//
// EPOCH-MS: FRACTIES ZIJN GELDIG (expliciete keuze)
// `serverTime` en `appliedServerTime` hoeven geen hele milliseconde te zijn; elke
// eindige, niet-negatieve waarde telt. Dat is dezelfde definitie als `isTimestamp()` in
// server-time.js, dat aantoonbaar halve milliseconden produceert: `offsetMs = t1 - (t0 +
// roundTripMs / 2)` levert bij een oneven round-trip bijv. 498.5 op, en `serverNow()`
// telt die offset op bij de lokale tijd. Twee modules in dezelfde repo met een verschillende
// impliciete definitie van "epoch-ms" is een bug in wording. Voor de ordening maakt het
// niets uit — `<` werkt op fracties net zo goed — en afwijzen is juist duur: op het
// reconnectpad zou een `.5` een INVALID_SNAPSHOT worden en de herstelpoging laten
// sneuvelen. Deze module rondt niets af en geeft niets van de invoer door; hij vergelijkt
// alleen. Wie hele milliseconden wil afdwingen doet dat in de protocol-adapter.
//
// HET PROBLEEM
// Na een reconnect vraagt de client áltijd een snapshot op (PROTOCOL.md "Reconnect",
// stap 5), terwijl events van vóór de onderbreking nog onderweg kunnen zijn. Snapshot
// en events komen dus door elkaar en out-of-order binnen. Twee manieren om state te
// verliezen: (1) een oud event dat de verse snapshot terugdraait, en (2) een oude
// snapshot — bijv. een trage tweede /state-respons — die nieuwere event-state
// terugdraait. Basisregel 6 lost alleen (1) op. Binnen één match lost `serverTime` (2)
// op: dat is de enige ordening die beide kanten delen, want de server plant één
// timeline per room (ARCHITECTURE.md §2) en elke payload draagt servertijd.
//
// DE ORDENING: EERST `matchSequence`, DAN PAS `serverTime`
// PROTOCOL.md §State-snapshot (commit bb07aa9) maakt `room.matchSequence` onderdeel van
// het snapshot: het is `Match.sequence` uit DATA-MODEL.md, een integer ≥ 1 die matches
// binnen een room TOTAAL ordent. Het contract schrijft clients letterlijk voor om eerst
// op `matchSequence` te ordenen en pas daarna op `serverTime` binnen die match. Deze
// module doet precies dat, en niets anders:
//
//   sequence STRIKT LAGER  → altijd afgewezen (STALE_MATCH_SEQUENCE), hoe nieuw de
//     `serverTime` ook is. Een klok zegt niets over een matchgrens heen.
//   sequence STRIKT HOGER  → altijd toegepast, hoe oud de `serverTime` ook is, met
//     `matchChanged: true`. De `serverTime`-poorten worden overgeslagen: vergelijken
//     met de klok van een vórige match is betekenisloos, geen extra veiligheid.
//   sequence GELIJK        → de `serverTime`-regels hieronder, onverkort.
//
// Dat is geen verfijning maar een omkering: `serverTime` is niet langer de bovenste
// volgorde-autoriteit, `matchSequence` is dat. De oude aanname ("een rematch krijgt
// vanzelf een hogere serverTime, dus matchId hoeft niets te ordenen") hield alleen bij
// een STRIKT hogere serverTime en brak bij een gelijke; die aanname is hier vervangen
// door de sequence en wordt nergens meer gebruikt.
//
// PRE-MATCH-LOBBY = SEQUENCE 0
// Vóór de eerste match bestaat er geen match (DATA-MODEL.md §Room: `currentMatchId:
// null`). PROTOCOL.md §State-snapshot legt vast dat `room.matchId` en
// `room.matchSequence` dan ALLEBEI `null` zijn, dat precies één van beide `null`
// inconsistent en ONGELDIG is, en dat zo'n snapshot voor de ordening als sequence 0
// telt. Gevolg van die twee regels samen, en het is opzet: elke echte match (≥ 1) wint
// van een lobby-snapshot, en een lobby-snapshot dat ná een match binnenkomt is een
// terugval en wordt afgewezen. `matchSequence: 0` bestaat niet op de wire — 0 is
// uitsluitend de interne waarde waarnaar `null`/`null` wordt genormaliseerd.
//
// GELIJKE serverTime BINNEN DEZELFDE SEQUENCE (ms-resolutie is grof genoeg om echt
// voor te komen)
//   snapshot vs. toegepast event     → snapshot wint (basisregel 6, letterlijk)
//   snapshot vs. toegepaste snapshot → duplicaat; een snapshot is TOTALE state, dus
//     een tweede op hetzelfde tijdstip voegt niets toe. Dit is nu ook echt alleen
//     dezelfde state: gelijke sequence betekent dezelfde match, dus de duplicaatpoort
//     kan geen rematch meer opslokken.
//   event vs. toegepaste snapshot    → event verliest (basisregel 6)
//   event vs. toegepast event        → event wint; events zijn PARTIËLE delta's en
//     twee broadcasts kunnen dezelfde ms delen (`round:ended` + `scoreboard:updated`)
//
// ROOM-IDENTITEIT EN HET MATCHWISSEL-SIGNAAL
// Een andere `room.code` → altijd afgewezen (ROOM_MISMATCH): een socket hoort bij
// precies één sessie en room (PROTOCOL.md basisregel 2), dus dat is een routeringsfout.
// Een andere match binnen DEZELFDE room is géén fout maar een geldige overgang
// (DATA-MODEL.md: een rematch is een nieuwe match binnen dezelfde room). Ze wordt
// toegepast, maar niet blind: het resultaat draagt `matchChanged: true` zodra de
// binnenkomende boodschap bij een ándere match hoort dan wat lokaal is toegepast —
// een andere `sequence` of een andere `matchId`. De vlag is het signaal dat de
// aanroeper zijn PER-MATCH state moet WEGGOOIEN in plaats van mergen: score, streak,
// rondetimer en antwoordstatus (GAME-FLOW.md §12: bij een rematch gaan scores en
// streaks naar nul). Ze dekt de overgangen null → id (eerste match, 0 → n) en id →
// ander id (rematch, n → n+1). De overgang id → null (n → 0) is per contract een
// terugval en wordt afgewezen in plaats van gesignaleerd.
//
// EVENTS DRAGEN GEEN `matchSequence` — HOE `shouldApplyEvent` DAARMEE OMGAAT
// De event-envelope (PROTOCOL.md §Event-envelope) heeft geen `matchSequence`; sommige
// payloads dragen wel een `matchId` (`game:rematch-started` levert de NIEUWE matchId).
// Uit een matchId alleen volgt geen RICHTING: hij zegt "een andere match", niet "een
// latere". Daarom doet `shouldApplyEvent` met dat veld exact één ding — signaleren, niet
// ordenen. Ordenen blijft `serverTime`, precies zoals voorheen; `matchChanged` is true
// wanneer de payload een `matchId` NOEMT die van de lokale afwijkt, en anders false.
// Zo krijgt de aanroeper op het normale rematchpad (`game:rematch-started` is een event,
// geen snapshot) alsnog het resetsignaal dat GAME-FLOW.md §12 eist.
//   DE GRENS, expliciet: zonder sequence kan deze module een event van een OUDERE match
//   niet als zodanig herkennen. Zo'n event valt alleen af als zijn `serverTime` ouder is
//   — wat in de praktijk het geval is, want de server plant één monotone timeline per
//   room — maar bij een gelijke milliseconde ontsnapt het. Omgekeerd wordt een
//   rematch-event dat op dezelfde ms als een toegepast snapshot binnenkomt nog steeds
//   door SUPERSEDED_BY_SNAPSHOT geweigerd; het eerstvolgende snapshot van die match
//   herstelt dat, want dat draagt de sequence en wint erop. Een event zonder `matchId`
//   geeft geen signaal (matchChanged false) — afwezigheid van bewijs, niet bewijs van
//   afwezigheid. Sluitend wordt dit pas met `matchSequence` in de event-envelope; dat is
//   een openstaand punt voor de PROTOCOL.md-eigenaar, zie (e) onderaan.
//
// CONTRACT VOOR DE AANROEPER
// Deze module beslist alleen; hij muteert niets en houdt geen state bij. Na
// `{ apply: true }` op een SNAPSHOT werkt de aanroeper zijn LocalState bij met de
// `serverTime`, `room.matchId` én `room.matchSequence` van dat snapshot en zet
// `appliedFrom` op 'snapshot'. Na `{ apply: true }` op een EVENT werkt hij `serverTime`
// en `appliedFrom: 'event'` bij; `matchSequence` kan hij niet bijwerken, want het event
// draagt hem niet. Dat is geen gat maar de bovenstaande grens: de sequence loopt achter
// tot het volgende snapshot van die match, dat dan strikt hoger is en `matchChanged`
// nogmaals meldt. Een tweede reset van per-match state is idempotent; een gemiste reset
// niet.
//   Twee veldparen horen bij elkaar. `appliedServerTime` + `appliedFrom`: "nog niets
// toegepast" is `null` + `null`, expliciet meegegeven. En `matchSequence` moet als EIGEN
// property aanwezig zijn — `null` (nog geen match, telt als 0) of een integer ≥ 1. Een
// ontbrekend veld is een fout, geen impliciete leegte, en hier is dat geen vormkwestie:
// een stilzwijgende 0 zou élk snapshot strikt hoger maken en dus bij élk snapshot een
// reset van score en streak uitlokken. INVALID_LOCAL_STATE is luid; die stille variant
// corrumpeert.
//   MODULEAFSPRAAK: in de LocalState wordt `matchSequence` NIET tegen `matchId`
// gekruisd. Het snapshot moet dat paar wél sluitend hebben (contract), maar de lokale
// state mag legitiem uit de pas lopen: na een `game:rematch-started`-event kent de
// aanroeper de nieuwe `matchId` en de bijbehorende sequence nog niet. Die combinatie
// afwijzen zou de client op INVALID_LOCAL_STATE laten vastlopen, precies op het pad dat
// deze wijziging moest repareren.
//   Alleen de velden die de BESLISSING gebruikt worden gelezen; volledige
// schemavalidatie van snapshot en envelope hoort bij de protocol-adapter (PROTOCOL.md
// "Inputveiligheid"), dus `self`, `currentRound` en `scoreboard` blijven hier ongelezen.
// Afwijking t.o.v. state-machine.js: die laat een werpende getter naar buiten
// propageren, hier gaat elke lezing via `readField()` — op het reconnectpad zou een
// throw de hele herstelpoging laten sneuvelen.
//
// GEEN ENKEL PAD WERPT, OOK DE TYPECONTROLE NIET
// Elke lezing gaat via `readField()`, dat binnen ÉÉN try zowel de aanwezigheidscheck als
// de lezing doet: op een Proxy kan `hasOwnProperty` zelf al werpen, dus een check buiten
// de try zou het gat alleen verplaatsen. Om dezelfde reden zit `Array.isArray()` in
// `isObject()` in een try — het werpt op een INGETROKKEN Proxy, en dat is precies de
// vorm die een verbroken verbinding kan achterlaten.
// `readField()` eist een EIGEN property. Overgeërfd telt als afwezig: met een vervuild
// `Object.prototype` zou een ontbrekende `room.matchId` anders een impliciete waarde
// krijgen en deze module een rematch laten verzinnen die nooit is gestart. Een
// JSON-payload van de wire heeft per definitie alleen eigen properties; een snapshot dat
// zijn beslissingsvelden van een prototype erft, wordt hier bewust afgewezen.
//
// OPEN PUNTEN VOOR DE PROTOCOL.md-EIGENAAR (docs/architecture-plan/README.md,
// "Openstaande besluiten"):
//   a. PROTOCOL.md zegt niet wat een client moet doen met een snapshot waarvan de
//      `protocolVersion` afwijkt. Afwijzen is de veilige lezing: bij een andere versie is
//      de betekenis van de overige velden niet gegarandeerd.
//   b. `PROTOCOL_VERSION_UNSUPPORTED` is in PROTOCOL.md een WIRE-foutcode server →
//      client. Hier is het een LOKAAL motief (log/diagnostiek) dat de aanroeper niet als
//      error-event mag terugsturen.
//   c. BINNEN één match is er nog steeds geen monotone `stateVersion`. `matchSequence`
//      ordent matches, niet de state binnen een match; epoch-ms is daar grof genoeg dat
//      twee snapshots in dezelfde milliseconde niet te onderscheiden zijn. Een
//      oplopende teller per room zou die laatste laag strikt maken.
//   d. De aanname dat `serverTime` per room monotoon is, houdt bij één game-server
//      (ARCHITECTURE.md Fase 0/1). Bij meerdere instances (Fase 2) kan klokverschil die
//      aanname breken; dan is punt (c) geen luxe meer. `matchSequence` is daar
//      ongevoelig voor: die komt uit de datalaag, niet uit een klok.
//   e. De event-envelope draagt geen `matchSequence`, alleen sommige payloads een
//      `matchId`. Daardoor is de ordening over matches heen wél sluitend voor snapshots
//      en niet voor events; zie "EVENTS DRAGEN GEEN matchSequence" hierboven voor wat
//      deze module in plaats daarvan doet en waar dat ophoudt. `matchSequence` in de
//      envelope zou dat gat dichten en is een besluit van de PROTOCOL.md-eigenaar.

/**
 * De lokaal bijgehouden herkomst van de huidige state. `protocolVersion` en `roomCode`
 * zijn wat deze client verwacht; de rest beschrijft wat er als laatste is toegepast.
 * `matchSequence` is `null` zolang er nog geen match is (telt als 0) en verder een
 * integer ≥ 1; het veld is VERPLICHT aanwezig, zie de modulekop.
 * @typedef {{ protocolVersion: string, roomCode: string, matchId: (string|null),
 *   matchSequence: (number|null), appliedServerTime: (number|null),
 *   appliedFrom: ("snapshot"|"event"|null) }} LocalState
 * @typedef {{ apply: true, matchChanged: boolean }} Accepted
 * @typedef {{ apply: false, reason: string }} Rejected
 */

/** Herkomst van de laatst toegepaste state. */
const KINDS = Object.freeze({ SNAPSHOT: 'snapshot', EVENT: 'event' });

/** De ordeningswaarde van een room zonder match. PROTOCOL.md §State-snapshot: een
 * snapshot met `matchId: null` én `matchSequence: null` telt als sequence 0, en elke
 * echte match (≥ 1) wint daarvan. Bestaat niet op de wire; alleen hier. */
const PRE_MATCH_SEQUENCE = 0;

// Motief dat letterlijk in PROTOCOL.md ("Foutcodes") staat. Zie open punt (b): het
// wordt hier als lokaal label gebruikt, niet als wire-code.
const PROTOCOL_REASONS = Object.freeze({
  PROTOCOL_VERSION_UNSUPPORTED: 'PROTOCOL_VERSION_UNSUPPORTED',
});

// Motieven die deze module zelf introduceert. Ze staan NIET in PROTOCOL.md en horen
// dus niet ongefilterd op de wire; de client heeft er geen vertaling voor.
const LOCAL_REASONS = Object.freeze({
  INVALID_LOCAL_STATE: 'INVALID_LOCAL_STATE',
  INVALID_SNAPSHOT: 'INVALID_SNAPSHOT',
  INVALID_EVENT: 'INVALID_EVENT',
  ROOM_MISMATCH: 'ROOM_MISMATCH',
  STALE_MATCH_SEQUENCE: 'STALE_MATCH_SEQUENCE',
  STALE_SNAPSHOT: 'STALE_SNAPSHOT',
  DUPLICATE_SNAPSHOT: 'DUPLICATE_SNAPSHOT',
  STALE_EVENT: 'STALE_EVENT',
  SUPERSEDED_BY_SNAPSHOT: 'SUPERSEDED_BY_SNAPSHOT',
});

/** De enige motieven die deze module kan retourneren. */
const REASONS = Object.freeze({ ...PROTOCOL_REASONS, ...LOCAL_REASONS });

/** Sentinel voor een veld dat niet betrouwbaar te lezen was: het ontbreekt als eigen
 * property, of de lezing wierp. Faalt elke typecheck hieronder. */
const UNREADABLE = Symbol('onleesbaar-veld');

/**
 * Mag deze binnenkomende snapshot de lokale state overschrijven?
 *
 * De volgorde van de poorten is bewust: eerst identiteit (versie, room), dan de
 * matchordening (`matchSequence`), en pas binnen één match de tijd (`serverTime`).
 * Een snapshot met een andere protocolversie kan geen betrouwbare velden dragen, en
 * een snapshot van een andere room hoort niet op deze tijdlijn thuis; beide gaan dus
 * vóór de ordening. Werpt nooit — ook niet op ontbrekende, vijandige of werpende
 * velden, op een ingetrokken Proxy of bij een vervuild `Object.prototype`. Muteert
 * `localState` noch `incomingSnapshot`.
 *
 * @param {LocalState} localState
 * @param {unknown} incomingSnapshot - snapshot volgens PROTOCOL.md "State-snapshot"
 * @returns {Accepted | Rejected}
 */
function shouldApplySnapshot(localState, incomingSnapshot) {
  const local = readLocalState(localState);
  if (local === null) {
    return deny(REASONS.INVALID_LOCAL_STATE);
  }

  const snapshot = readSnapshot(incomingSnapshot);
  if (snapshot === null) {
    return deny(REASONS.INVALID_SNAPSHOT);
  }

  if (snapshot.protocolVersion !== local.protocolVersion) {
    return deny(REASONS.PROTOCOL_VERSION_UNSUPPORTED);
  }
  // Andere room → nooit toepassen. Een andere MATCH wordt hier expliciet niet
  // afgewezen op identiteit; die wordt hieronder geORDEND, zie de modulekop.
  if (snapshot.roomCode !== local.roomCode) {
    return deny(REASONS.ROOM_MISMATCH);
  }

  // Matchordening gaat vóór de klok (PROTOCOL.md §State-snapshot, commit bb07aa9).
  // Een oudere match verliest altijd; een nieuwere wint altijd, want de `serverTime`
  // van de vórige match zegt niets over de nieuwe.
  if (snapshot.matchSequence < local.matchSequence) {
    return deny(REASONS.STALE_MATCH_SEQUENCE);
  }
  if (snapshot.matchSequence === local.matchSequence && local.appliedServerTime !== null) {
    if (snapshot.serverTime < local.appliedServerTime) {
      return deny(REASONS.STALE_SNAPSHOT);
    }
    // Gelijke serverTime binnen dezelfde match: de snapshot wint van een event
    // (basisregel 6), maar een tweede snapshot op hetzelfde tijdstip is dezelfde
    // totale state van dezelfde match en voegt dus niets toe.
    if (snapshot.serverTime === local.appliedServerTime && local.appliedFrom === KINDS.SNAPSHOT) {
      return deny(REASONS.DUPLICATE_SNAPSHOT);
    }
  }

  const matchChanged =
    snapshot.matchSequence !== local.matchSequence || snapshot.matchId !== local.matchId;
  return { apply: true, matchChanged };
}

/**
 * De andere helft van dezelfde regel: mag dit binnenkomende event nog worden
 * toegepast, of is het achterhaald door een nieuwere snapshot? Zonder deze functie is
 * basisregel 6 niet af te dwingen — een snapshot die één tick later door een oud
 * event wordt teruggedraaid, was nooit leidend.
 *
 * Bewuste asymmetrie met `shouldApplySnapshot`: een server→client event-envelope
 * (PROTOCOL.md "Event-envelope") draagt geen `protocolVersion` en geen room — de
 * socket is tijdens de handshake al aan precies één sessie en room gebonden
 * (basisregel 2, socket-auth pint de versie). De envelope draagt ook geen
 * `matchSequence`, dus ORDENEN doet deze functie uitsluitend op tijd. Wat wél kan:
 * `payload.matchId` lezen en, als die van de lokale afwijkt, `matchChanged: true`
 * SIGNALEREN — zodat een `game:rematch-started` de aanroeper zijn per-match state laat
 * resetten (GAME-FLOW.md §12). Signaleren is geen ordenen: uit een matchId volgt geen
 * richting. Zie de modulekop voor waar die aanpak ophoudt. Werpt nooit, onder dezelfde
 * garantie als `shouldApplySnapshot`. Muteert `localState` noch `incomingEvent`.
 *
 * @param {LocalState} localState
 * @param {unknown} incomingEvent - envelope met minimaal een `serverTime`
 * @returns {Accepted | Rejected}
 */
function shouldApplyEvent(localState, incomingEvent) {
  const local = readLocalState(localState);
  if (local === null) {
    return deny(REASONS.INVALID_LOCAL_STATE);
  }

  const event = readEvent(incomingEvent);
  if (event === null) {
    return deny(REASONS.INVALID_EVENT);
  }
  // Een payload die geen matchId NOEMT geeft geen signaal: dat is afwezigheid van
  // bewijs, niet bewijs dat de match dezelfde is gebleven.
  const accept = {
    apply: /** @type {true} */ (true),
    matchChanged: event.matchId !== null && event.matchId !== local.matchId,
  };

  // Nog niets toegepast: er is niets om achterhaald door te raken.
  if (local.appliedServerTime === null) {
    return accept;
  }

  if (local.appliedFrom === KINDS.SNAPSHOT) {
    // Basisregel 6 in zijn letterlijke vorm: alles van vóór of tijdens de snapshot
    // is er al in verwerkt. Alleen strikt nieuwere events voegen nog iets toe.
    return event.serverTime <= local.appliedServerTime
      ? deny(REASONS.SUPERSEDED_BY_SNAPSHOT)
      : accept;
  }

  // Lokale state komt van een event: alleen strikt oudere events zijn achterhaald.
  // Gelijke serverTime blijft toegestaan, want events zijn partiële delta's en twee
  // broadcasts kunnen dezelfde milliseconde delen.
  return event.serverTime < local.appliedServerTime ? deny(REASONS.STALE_EVENT) : accept;
}

/**
 * Leest de lokale state naar een genormaliseerde kopie, of null bij elke afwijking.
 * Elk veld wordt EXACT ÉÉN KEER gelezen en daarna alleen nog als local gebruikt: bij
 * een tweede lezing kan een getter een andere, ONGEVALIDEERDE waarde teruggeven.
 * In de kopie is `matchSequence` altijd een getal: `null` is genormaliseerd naar
 * `PRE_MATCH_SEQUENCE`, zodat de vergelijking hieronder geen null-geval kent.
 * @param {unknown} localState
 * @returns {{ protocolVersion: string, roomCode: string, matchId: (string|null),
 *   matchSequence: number, appliedServerTime: (number|null),
 *   appliedFrom: ("snapshot"|"event"|null) } | null}
 */
function readLocalState(localState) {
  if (!isObject(localState)) {
    return null;
  }

  const protocolVersion = readField(localState, 'protocolVersion');
  const roomCode = readField(localState, 'roomCode');
  const matchId = readField(localState, 'matchId');
  const matchSequence = readField(localState, 'matchSequence');
  const appliedServerTime = readField(localState, 'appliedServerTime');
  const appliedFrom = readField(localState, 'appliedFrom');

  // `appliedServerTime` en `appliedFrom` zijn één samengesteld feit; een half
  // ingevulde herkomst maakt elke ordening betekenisloos.
  const originValid =
    appliedServerTime === null
      ? appliedFrom === null
      : isEpochMs(appliedServerTime) &&
        (appliedFrom === KINDS.SNAPSHOT || appliedFrom === KINDS.EVENT);

  if (!isNonEmptyString(protocolVersion) || !isNonEmptyString(roomCode)) {
    return null;
  }
  // `matchSequence` moet aanwezig zijn: `null` (nog geen match) of een integer ≥ 1.
  // Anders dan bij het snapshot wordt hij NIET tegen `matchId` gekruisd — zie de
  // modulekop, het rematch-eventpad kan die twee legitiem uit de pas laten lopen.
  if (!isNullableId(matchId) || !(matchSequence === null || isMatchSequence(matchSequence))) {
    return null;
  }
  if (!originValid) {
    return null;
  }
  return {
    protocolVersion,
    roomCode,
    matchId,
    matchSequence: matchSequence === null ? PRE_MATCH_SEQUENCE : matchSequence,
    appliedServerTime,
    appliedFrom,
  };
}

/**
 * Leest de beslissingsrelevante velden van een snapshot, of null bij elke afwijking.
 * Alleen `protocolVersion`, `serverTime`, `room.code`, `room.matchId` en
 * `room.matchSequence` — de rest van de snapshotvorm uit PROTOCOL.md is hier niet nodig
 * en wordt dus niet geëist. `matchSequence` komt genormaliseerd terug: de
 * pre-match-lobby (`matchId` én `matchSequence` allebei null) wordt
 * `PRE_MATCH_SEQUENCE`.
 * @param {unknown} incomingSnapshot
 * @returns {{ protocolVersion: string, serverTime: number, roomCode: string,
 *   matchId: (string|null), matchSequence: number } | null}
 */
function readSnapshot(incomingSnapshot) {
  if (!isObject(incomingSnapshot)) {
    return null;
  }
  const protocolVersion = readField(incomingSnapshot, 'protocolVersion');
  const serverTime = readField(incomingSnapshot, 'serverTime');
  const room = readField(incomingSnapshot, 'room');
  if (!isNonEmptyString(protocolVersion) || !isEpochMs(serverTime) || !isObject(room)) {
    return null;
  }

  const roomCode = readField(room, 'code');
  const match = readMatchIdentity(room);
  if (!isNonEmptyString(roomCode) || match === null) {
    return null;
  }
  return { protocolVersion, serverTime, roomCode, ...match };
}

/**
 * Leest het paar `room.matchId` / `room.matchSequence` als ÉÉN feit, precies zoals
 * PROTOCOL.md §State-snapshot het definieert: allebei `null` is de pre-match-lobby en
 * telt als sequence 0; anders is `matchId` een niet-lege string en `matchSequence` een
 * integer ≥ 1. Precies één van beide `null` is per contract inconsistent en dus
 * ongeldig — geen randgeval dat hier stilzwijgend wordt rechtgetrokken. Een ontbrekend
 * veld levert UNREADABLE op en valt daarmee in dezelfde afwijzing.
 * @param {object} room
 * @returns {{ matchId: (string|null), matchSequence: number } | null}
 */
function readMatchIdentity(room) {
  const matchId = readField(room, 'matchId');
  const matchSequence = readField(room, 'matchSequence');

  if (matchId === null && matchSequence === null) {
    return { matchId: null, matchSequence: PRE_MATCH_SEQUENCE };
  }
  if (isNonEmptyString(matchId) && isMatchSequence(matchSequence)) {
    return { matchId, matchSequence };
  }
  return null;
}

/**
 * Leest de beslissingsrelevante velden van een event-envelope, of null als `serverTime`
 * ontbreekt of onbruikbaar is. `payload.matchId` wordt OPTIONEEL gelezen: hij ordent
 * niets en mag de envelope dus ook niet ongeldig maken. Ontbreekt hij, is de payload
 * geen object, of is de waarde geen niet-lege string, dan is er simpelweg geen
 * matchsignaal en komt er `null` terug in dat veld. `event` en `eventId` worden niet
 * gelezen: hun schema hoort bij de protocol-adapter.
 * @param {unknown} incomingEvent
 * @returns {{ serverTime: number, matchId: (string|null) } | null}
 */
function readEvent(incomingEvent) {
  if (!isObject(incomingEvent)) {
    return null;
  }
  const serverTime = readField(incomingEvent, 'serverTime');
  if (!isEpochMs(serverTime)) {
    return null;
  }

  const payload = readField(incomingEvent, 'payload');
  if (!isObject(payload)) {
    return { serverTime, matchId: null };
  }
  const matchId = readField(payload, 'matchId');
  return { serverTime, matchId: isNonEmptyString(matchId) ? matchId : null };
}

/**
 * Leest één EIGEN property zonder ooit te werpen. Aanwezigheidscheck en lezing staan in
 * DEZELFDE try: `hasOwnProperty` roept op een Proxy de `getOwnPropertyDescriptor`-trap
 * aan en kan dus net zo goed werpen als de getter erna. Een veld dat ontbreekt, dat
 * alleen via de prototypeketen bereikbaar is, of waarvan de lezing werpt, levert de
 * UNREADABLE-sentinel op — die faalt elke typecheck hieronder en leidt tot een nette
 * afwijzing.
 * @param {object} source @param {string} key @returns {unknown}
 */
function readField(source, key) {
  try {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      return UNREADABLE;
    }
    return /** @type {Record<string, unknown>} */ (source)[key];
  } catch {
    return UNREADABLE;
  }
}

/** Bruikbaar payload-object: geen null, geen array, geen primitieve. Werpt niet:
 * `Array.isArray()` werpt op een ingetrokken Proxy en staat daarom binnen de try, zodat
 * ook de typecontrole zelf geen ontsnappingsroute is.
 * @param {unknown} value @returns {boolean} */
function isObject(value) {
  try {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  } catch {
    return false;
  }
}

/** @param {unknown} value @returns {boolean} */
function isNonEmptyString(value) {
  return typeof value === 'string' && value !== '';
}

/** Epoch-ms: eindig en niet-negatief. Fracties zijn GELDIG (zie modulekop: server-time.js
 * levert halve milliseconden). NaN, Infinity, numerieke strings en booleans vallen af —
 * een string vergelijkt met `<` stilzwijgend verkeerd.
 * @param {unknown} value @returns {boolean} */
function isEpochMs(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** `Match.sequence` uit DATA-MODEL.md zoals PROTOCOL.md §State-snapshot hem in het
 * snapshot-`room`-object zet: een INTEGER ≥ 1. Anders dan bij `serverTime` zijn fracties
 * hier ongeldig — een sequence is een teller uit de datalaag, geen meting. 0 valt af
 * omdat de pre-match-lobby op de wire `null` heet, niet 0.
 * @param {unknown} value @returns {boolean} */
function isMatchSequence(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/** Identifier die expliciet null mag zijn (`matchId` vóór de eerste match).
 * `undefined` telt NIET als null: het veld moet aanwezig zijn.
 * @param {unknown} value @returns {boolean} */
function isNullableId(value) {
  return value === null || isNonEmptyString(value);
}

/** Bouwt een afwijzing. Raakt de meegegeven objecten niet aan en werpt nooit.
 * @param {string} reason @returns {Rejected} */
function deny(reason) {
  return { apply: false, reason };
}

export {
  shouldApplySnapshot,
  shouldApplyEvent,
  REASONS,
  PROTOCOL_REASONS,
  LOCAL_REASONS,
  KINDS,
  PRE_MATCH_SEQUENCE,
};
