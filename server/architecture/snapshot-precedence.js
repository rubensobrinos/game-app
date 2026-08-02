'use strict';

// Precedentieregel tussen snapshots en events binnen één room-sessie.
// Bron: docs/multiplayer/ARCHITECTURE.md §3 "Snapshot boven event replay",
// docs/multiplayer/PROTOCOL.md basisregel 6 ("Snapshots zijn leidend boven eerder
// ontvangen events") plus de sectie "Reconnect" (stap 1-7), en
// docs/multiplayer/DATA-MODEL.md (Room/Match: een rematch is een NIEUWE matchId
// binnen DEZELFDE room).
//
// Pure beslisregel: geen Redis, sockets, HTTP, filesystem, timers of klok. Er staat
// bewust nergens een `Date.now()` — tijd komt uitsluitend uit de `serverTime` van de
// meegegeven data (PROTOCOL.md: "tijden in epoch-milliseconden volgens servertijd").
//
// HET PROBLEEM
// Na een reconnect vraagt de client áltijd een snapshot op (PROTOCOL.md "Reconnect",
// stap 5), terwijl events van vóór de onderbreking nog onderweg kunnen zijn. Snapshot
// en events komen dus door elkaar en out-of-order binnen. Twee manieren om state te
// verliezen: (1) een oud event dat de verse snapshot terugdraait, en (2) een oude
// snapshot — bijv. een trage tweede /state-respons — die nieuwere event-state
// terugdraait. Basisregel 6 lost alleen (1) op. `serverTime` lost (2) op: dat is de
// enige ordening die beide kanten delen, want de server plant één timeline per room
// (ARCHITECTURE.md §2) en elke payload draagt servertijd. `serverTime` is daarmee de
// ENIGE volgorde-autoriteit; `matchId` ordent niets, want een rematch is
// server-authoritative en krijgt vanzelf een hogere `serverTime` (een snapshot van de
// vórige match is dus per definitie stale en valt al op tijd af).
//
// GELIJKE serverTime (ms-resolutie is grof genoeg om echt voor te komen)
//   snapshot vs. toegepast event     → snapshot wint (basisregel 6, letterlijk)
//   snapshot vs. toegepaste snapshot → duplicaat; een snapshot is TOTALE state, dus
//     een tweede op hetzelfde tijdstip voegt niets toe
//   event vs. toegepaste snapshot    → event verliest (basisregel 6)
//   event vs. toegepast event        → event wint; events zijn PARTIËLE delta's en
//     twee broadcasts kunnen dezelfde ms delen (`round:ended` + `scoreboard:updated`)
//
// ROOM-IDENTITEIT EN REMATCH (keuze bij een nieuwe matchId)
// Een andere `room.code` → altijd afgewezen (ROOM_MISMATCH): een socket hoort bij
// precies één sessie en room (PROTOCOL.md basisregel 2), dus dat is een routeringsfout.
// Een andere `matchId` binnen DEZELFDE room → WEL toepassen, maar niet blind: het
// resultaat draagt `matchChanged: true`. DATA-MODEL.md noemt een rematch expliciet een
// nieuwe match binnen dezelfde room (`game:rematch-started` levert een nieuwe
// `matchId`), dus het is een geldige overgang en geen fout. De vlag is nodig omdat de
// aanroeper per-match afgeleide state (antwoordstatus, rondetimer, lokale scoredelta)
// moet weggooien in plaats van mergen. Ze dekt alle drie de overgangen: null → id
// (eerste match), id → ander id (rematch) en id → null (room zonder actieve match,
// DATA-MODEL.md `currentMatchId: null`).
//
// CONTRACT VOOR DE AANROEPER
// Deze module beslist alleen; hij muteert niets en houdt geen state bij. Na
// `{ apply: true }` werkt de aanroeper zijn LocalState bij met de `serverTime` en
// `room.matchId` van de toegepaste boodschap en zet `appliedFrom` op 'snapshot' of
// 'event'. Die twee velden horen bij elkaar: "nog niets toegepast" is
// `appliedServerTime: null` + `appliedFrom: null`, expliciet meegegeven — een ontbrekend
// veld is een fout, geen impliciete leegte. Alleen de velden die de BESLISSING gebruikt
// worden gelezen; volledige schemavalidatie van snapshot en envelope hoort bij de
// protocol-adapter (PROTOCOL.md "Inputveiligheid"), dus `self`, `currentRound` en
// `scoreboard` blijven hier ongelezen. Afwijking t.o.v. state-machine.js: die laat een
// werpende getter naar buiten propageren, hier gaat elke lezing via `readField()` — op
// het reconnectpad zou een throw de hele herstelpoging laten sneuvelen.
//
// OPEN PUNTEN VOOR DE PROTOCOL.md-EIGENAAR (docs/architecture-plan/README.md,
// "Openstaande besluiten"):
//   a. PROTOCOL.md zegt niet wat een client moet doen met een snapshot waarvan de
//      `protocolVersion` afwijkt. Afwijzen is de veilige lezing: bij een andere versie is
//      de betekenis van de overige velden niet gegarandeerd.
//   b. `PROTOCOL_VERSION_UNSUPPORTED` is in PROTOCOL.md een WIRE-foutcode server →
//      client. Hier is het een LOKAAL motief (log/diagnostiek) dat de aanroeper niet als
//      error-event mag terugsturen.
//   c. Er is geen monotone `stateVersion`/sequence per room. Epoch-ms is grof: twee
//      snapshots binnen dezelfde milliseconde zijn niet te onderscheiden. Een oplopende
//      teller zou deze regel strikt robuuster maken.
//   d. De aanname dat `serverTime` per room monotoon is, houdt bij één game-server
//      (ARCHITECTURE.md Fase 0/1). Bij meerdere instances (Fase 2) kan klokverschil die
//      aanname breken; dan is punt (c) geen luxe meer.

/**
 * De lokaal bijgehouden herkomst van de huidige state. `protocolVersion` en `roomCode`
 * zijn wat deze client verwacht; de rest beschrijft wat er als laatste is toegepast.
 * @typedef {{ protocolVersion: string, roomCode: string, matchId: (string|null),
 *   appliedServerTime: (number|null), appliedFrom: ("snapshot"|"event"|null) }} LocalState
 * @typedef {{ apply: true, matchChanged: boolean }} SnapshotAccepted
 * @typedef {{ apply: true }} EventAccepted
 * @typedef {{ apply: false, reason: string }} Rejected
 */

/** Herkomst van de laatst toegepaste state. */
const KINDS = Object.freeze({ SNAPSHOT: 'snapshot', EVENT: 'event' });

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
  STALE_SNAPSHOT: 'STALE_SNAPSHOT',
  DUPLICATE_SNAPSHOT: 'DUPLICATE_SNAPSHOT',
  STALE_EVENT: 'STALE_EVENT',
  SUPERSEDED_BY_SNAPSHOT: 'SUPERSEDED_BY_SNAPSHOT',
});

/** De enige motieven die deze module kan retourneren. */
const REASONS = Object.freeze({ ...PROTOCOL_REASONS, ...LOCAL_REASONS });

/** Sentinel voor een property-getter die zelf werpt; faalt elke typecheck hieronder. */
const THREW = Symbol('werpende-getter');

/**
 * Mag deze binnenkomende snapshot de lokale state overschrijven?
 *
 * De volgorde van de poorten is bewust: eerst identiteit (versie, room), dan pas
 * ordening (serverTime). Een snapshot met een andere protocolversie kan geen
 * betrouwbare `serverTime` dragen, en een snapshot van een andere room hoort niet op
 * deze tijdlijn thuis. Werpt nooit — ook niet op ontbrekende, vijandige of werpende
 * velden. Muteert `localState` noch `incomingSnapshot`.
 *
 * @param {LocalState} localState
 * @param {unknown} incomingSnapshot - snapshot volgens PROTOCOL.md "State-snapshot"
 * @returns {SnapshotAccepted | Rejected}
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
  // Andere room → nooit toepassen. Een andere matchId wordt hier expliciet NIET
  // afgewezen: dat is de rematch-overgang, zie de modulekop.
  if (snapshot.roomCode !== local.roomCode) {
    return deny(REASONS.ROOM_MISMATCH);
  }

  if (local.appliedServerTime !== null) {
    if (snapshot.serverTime < local.appliedServerTime) {
      return deny(REASONS.STALE_SNAPSHOT);
    }
    // Gelijke serverTime: de snapshot wint van een event (basisregel 6), maar een
    // tweede snapshot op hetzelfde tijdstip is dezelfde totale state.
    if (snapshot.serverTime === local.appliedServerTime && local.appliedFrom === KINDS.SNAPSHOT) {
      return deny(REASONS.DUPLICATE_SNAPSHOT);
    }
  }

  return { apply: true, matchChanged: snapshot.matchId !== local.matchId };
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
 * (basisregel 2, socket-auth pint de versie). Deze functie beslist dus alleen op tijd,
 * en expliciet niet op `payload.matchId`: `game:rematch-started` draagt legitiem een
 * NIEUWE matchId, dus dat onderscheid vereist kennis van het event-type en hoort in de
 * protocol-adapter. Werpt nooit. Muteert `localState` noch `incomingEvent`.
 *
 * @param {LocalState} localState
 * @param {unknown} incomingEvent - envelope met minimaal een `serverTime`
 * @returns {EventAccepted | Rejected}
 */
function shouldApplyEvent(localState, incomingEvent) {
  const local = readLocalState(localState);
  if (local === null) {
    return deny(REASONS.INVALID_LOCAL_STATE);
  }

  const serverTime = readEventServerTime(incomingEvent);
  if (serverTime === null) {
    return deny(REASONS.INVALID_EVENT);
  }
  // Nog niets toegepast: er is niets om achterhaald door te raken.
  if (local.appliedServerTime === null) {
    return { apply: true };
  }

  if (local.appliedFrom === KINDS.SNAPSHOT) {
    // Basisregel 6 in zijn letterlijke vorm: alles van vóór of tijdens de snapshot
    // is er al in verwerkt. Alleen strikt nieuwere events voegen nog iets toe.
    return serverTime <= local.appliedServerTime
      ? deny(REASONS.SUPERSEDED_BY_SNAPSHOT)
      : { apply: true };
  }

  // Lokale state komt van een event: alleen strikt oudere events zijn achterhaald.
  // Gelijke serverTime blijft toegestaan, want events zijn partiële delta's en twee
  // broadcasts kunnen dezelfde milliseconde delen.
  return serverTime < local.appliedServerTime ? deny(REASONS.STALE_EVENT) : { apply: true };
}

/**
 * Leest de lokale state naar een genormaliseerde kopie, of null bij elke afwijking.
 * Elk veld wordt EXACT ÉÉN KEER gelezen en daarna alleen nog als local gebruikt: bij
 * een tweede lezing kan een getter een andere, ONGEVALIDEERDE waarde teruggeven.
 * @param {unknown} localState
 * @returns {LocalState | null}
 */
function readLocalState(localState) {
  if (!isObject(localState)) {
    return null;
  }

  const protocolVersion = readField(localState, 'protocolVersion');
  const roomCode = readField(localState, 'roomCode');
  const matchId = readField(localState, 'matchId');
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
  if (!isNullableId(matchId) || !originValid) {
    return null;
  }
  return { protocolVersion, roomCode, matchId, appliedServerTime, appliedFrom };
}

/**
 * Leest de beslissingsrelevante velden van een snapshot, of null bij elke afwijking.
 * Alleen `protocolVersion`, `serverTime`, `room.code` en `room.matchId` — de rest van
 * de snapshotvorm uit PROTOCOL.md is hier niet nodig en wordt dus niet geëist.
 * @param {unknown} incomingSnapshot
 * @returns {{ protocolVersion: string, serverTime: number, roomCode: string,
 *   matchId: (string|null) } | null}
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
  const matchId = readField(room, 'matchId');
  if (!isNonEmptyString(roomCode) || !isNullableId(matchId)) {
    return null;
  }
  return { protocolVersion, serverTime, roomCode, matchId };
}

/**
 * Leest `serverTime` uit een event-envelope, of null als die ontbreekt of onbruikbaar
 * is. `event`, `eventId` en `payload` worden niet gelezen: ze spelen geen rol in de
 * ordening en hun schema hoort bij de protocol-adapter.
 * @param {unknown} incomingEvent
 * @returns {number | null}
 */
function readEventServerTime(incomingEvent) {
  if (!isObject(incomingEvent)) {
    return null;
  }
  const serverTime = readField(incomingEvent, 'serverTime');
  return isEpochMs(serverTime) ? serverTime : null;
}

/**
 * Leest één property zonder ooit te werpen. Een getter die zelf werpt levert de
 * THREW-sentinel op, die elke typecheck hieronder faalt en dus tot een nette
 * afwijzing leidt.
 * @param {object} source @param {string} key @returns {unknown}
 */
function readField(source, key) {
  try {
    return /** @type {Record<string, unknown>} */ (source)[key];
  } catch {
    return THREW;
  }
}

/** Bruikbaar payload-object: geen null, geen array, geen primitieve.
 * @param {unknown} value @returns {boolean} */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @returns {boolean} */
function isNonEmptyString(value) {
  return typeof value === 'string' && value !== '';
}

/** Epoch-ms: eindig en niet-negatief. NaN, Infinity, numerieke strings en booleans
 * vallen af — een string vergelijkt met `<` stilzwijgend verkeerd.
 * @param {unknown} value @returns {boolean} */
function isEpochMs(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
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

module.exports = {
  shouldApplySnapshot,
  shouldApplyEvent,
  REASONS,
  PROTOCOL_REASONS,
  LOCAL_REASONS,
  KINDS,
};
