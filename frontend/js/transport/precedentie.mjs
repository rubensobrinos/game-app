// transport/precedentie.mjs — refactor 9 (docs/openstaand/refactor/9-transport-client.md).
// DE POORT: bepaalt of een binnengekomen snapshot of event de waarheid is.
// Verplaatst LETTERLIJK uit transport.mjs's "De precedentiepoort"-kopje — de
// volgorde van de afwegingen is niet aangeraakt. Geen gedragsverandering.
//
// ─────────────────────────────────────────────────────────────────────────────
// De precedentieregel — de enige bron, nu ook in een browser laadbaar
//
// `shared/protocol/snapshot-precedence.mjs` is de ENIGE implementatie van deze
// regel (AR3). Er wordt hier bewust GEEN kopie van gemaakt: twee implementaties
// van precies deze ordening is hoe server- en clientstate stilzwijgend uiteen
// gaan lopen.
//
// Dit was eerder een dynamische import met een foutvangnet, omdat de module
// toen `server/architecture/snapshot-precedence.js` heette en om twee
// onafhankelijke redenen niet in een browser laadde: `server/**` wordt niet
// statisch geserveerd (`server/index.mjs` mount alleen `/client/*`, `/shared/*`
// en `frontend/`), en de module was CommonJS. Beide zijn opgelost door de
// verhuizing naar `shared/` als ESM, dus dit is nu een gewone statische import:
// `/shared/protocol/snapshot-precedence.mjs` is over HTTP bereikbaar en is een
// echte ES-module. Een mislukte import is daarmee geen af te vangen toestand
// meer maar een laadfout van dit bestand zelf — precies zoals bij elke andere
// import hierboven.
import {
  shouldApplyEvent,
  shouldApplySnapshot,
} from '../../../shared/protocol/snapshot-precedence.mjs';
import { PROTOCOL_VERSION } from './protocol.mjs';
import { readObject, readString } from './helpers.mjs';

/**
 * Events die NOOIT door de precedentiepoort worden tegengehouden.
 *
 * De regel ordent STATE (`PROTOCOL.md` basisregel 6: "snapshots zijn leidend
 * boven eerder ontvangen events"). Deze drie dragen geen roomstate maar een
 * mededeling die door geen enkele latere snapshot wordt hersteld: een
 * weggegooide `session:kicked` laat de speler in een room zitten waar hij niet
 * meer in zit, en een weggegooide `error` laat een mislukte actie er geslaagd
 * uitzien.
 */
const UNORDERED_EVENTS = new Set(['error', 'session:kicked', 'session:revoked']);

/**
 * De twee events die legitiem een NIEUWE `matchId` dragen (`PROTOCOL.md`
 * §Server → client events). Bij alle andere events is een afwijkende `matchId`
 * een aanwijzing dat het event bij een andere match hoort.
 */
const MATCH_START_EVENTS = new Set(['game:started', 'game:rematch-started']);

/**
 * Houdt de `LocalState` bij die `snapshot-precedence.mjs` verwacht en sequencet
 * zijn twee functies. **Dit is geen tweede beslisregel**: elke ja/nee komt uit
 * `shouldApplySnapshot` / `shouldApplyEvent`, inclusief de matchordening. De
 * module ordent sinds `PROTOCOL.md` §State-snapshot (commit `bb07aa9`) zelf
 * **eerst op `matchSequence` en pas daarna op `serverTime` binnen die match**;
 * deze poort heeft daar geen eigen versie meer van en mag die ook niet hebben
 * (`AGENTS.md`: één implementatie per regel).
 *
 * Wat deze poort daarvoor moet doen is precies het contract dat de modulekop
 * beschrijft: `matchSequence` is een VERPLICHT veld van de `LocalState` — `null`
 * vóór de eerste match (telt als 0), verder een integer ≥ 1 — en wordt na een
 * toegepast snapshot samen met `matchId` bijgewerkt. Een ontbrekend veld levert
 * `INVALID_LOCAL_STATE` op, en dat is opzet: een stilzwijgende 0 zou élk
 * snapshot strikt hoger maken en dus bij élk snapshot score en streak resetten.
 *
 * `matchId` en `matchSequence` mogen na een match-start-EVENT legitiem uit de
 * pas lopen (het event draagt geen sequence, dus `registerEvent` zet alleen
 * `matchId`). De module kruist dat paar in de `LocalState` bewust niet; bouw er
 * hier dus ook geen validatie omheen.
 *
 * @param {{ protocolVersion?: string }} [options]
 */
export function createSnapshotPrecedenceGate(options = {}) {
  /** @type {{ protocolVersion: string, roomCode: string | null, matchId: string | null, matchSequence: number | null, appliedServerTime: number | null, appliedFrom: 'snapshot' | 'event' | null }} */
  const local = {
    protocolVersion: options.protocolVersion ?? PROTOCOL_VERSION,
    roomCode: null,
    matchId: null,
    matchSequence: null,
    appliedServerTime: null,
    appliedFrom: null,
  };

  /**
   * `matchId → matchSequence`, gevuld uit snapshots.
   *
   * DIT IS GEEN KOPIE VAN DE ORDENINGSREGEL MAAR EEN CAPABILITY DIE DE MODULE
   * NIET KAN HEBBEN. `shouldApplyEvent` is stateloos en ziet per aanroep één
   * envelope; de event-envelope draagt geen `matchSequence` (alleen sommige
   * payloads een `matchId`), dus de module kan een event van een OUDERE match
   * principieel niet als zodanig herkennen — dat is open punt (e) in
   * `snapshot-precedence.mjs`. Deze tabel reconstrueert de sequence van een
   * `matchId` die in een EERDER snapshot is gezien; alleen daarmee is de
   * afwijzing hieronder mogelijk. Het vergelijken zelf blijft de regel van de
   * module en wordt hier niet herhaald. Zodra `matchSequence` in de
   * event-envelope landt, vervalt deze tabel samen met open punt (e).
   * @type {Map<string, number>}
   */
  const sequenceByMatchId = new Map();

  return { registerSnapshot, registerEvent, inspect };

  /**
   * @param {unknown} snapshot - `PROTOCOL.md` §State-snapshot
   * @returns {{ apply: boolean, matchChanged?: boolean, reason?: string }}
   */
  function registerSnapshot(snapshot) {
    const roomCode = readString(readObject(snapshot)?.room, 'code');
    const incomingSequence = readSequence(snapshot);

    // De module eist een niet-lege `roomCode` in de LocalState. Bij de eerste
    // snapshot is die er nog niet; hij wordt hier geleerd en teruggedraaid als
    // de module de snapshot alsnog afwijst.
    const bootstrapped = local.roomCode === null && roomCode !== null;
    if (bootstrapped) {
      local.roomCode = roomCode;
    }

    const decision = shouldApplySnapshot(local, snapshot);
    if (decision.apply !== true) {
      if (bootstrapped) {
        local.roomCode = null;
      }
      return decision;
    }

    const snapshotObject = readObject(snapshot);
    local.roomCode = roomCode;
    local.matchId = readString(readObject(snapshotObject?.room), 'matchId');
    // `matchId` en `matchSequence` zijn één paar (PROTOCOL.md §State-snapshot):
    // ze gaan samen naar `null` bij een lobby-snapshot, anders samen naar de
    // waarden uit dít snapshot.
    local.matchSequence = incomingSequence;
    local.appliedServerTime = snapshotObject.serverTime;
    local.appliedFrom = 'snapshot';
    if (incomingSequence !== null && local.matchId !== null) {
      sequenceByMatchId.set(local.matchId, incomingSequence);
    }
    return decision;
  }

  /**
   * @param {unknown} envelope - `PROTOCOL.md` §Event-envelope (server → client)
   * @returns {{ apply: boolean, reason?: string }}
   */
  function registerEvent(envelope) {
    const event = readString(envelope, 'event');

    if (event !== null && UNORDERED_EVENTS.has(event)) {
      return { apply: true, reason: 'NOT_STATE' };
    }
    if (local.roomCode === null) {
      // Nog geen enkele snapshot gezien: er is geen baseline om iets tegen af
      // te wegen, en de module zou hier INVALID_LOCAL_STATE teruggeven. In elke
      // echte flow gaat createGame/joinGame/fetchState hieraan vooraf.
      return { apply: true, reason: 'NO_BASELINE' };
    }

    const eventMatchId = readString(readObject(readObject(envelope)?.payload), 'matchId');

    if (eventMatchId !== null && local.matchId !== null && eventMatchId !== local.matchId) {
      // Zie `sequenceByMatchId` hierboven: dit is het enige wat de stateloze
      // module niet zelf kan. Zij ziet alleen deze envelope en die draagt geen
      // `matchSequence`; hier is uit een eerder snapshot bekend bij wélke
      // sequence deze `matchId` hoorde, en dan is een event van een strikt
      // oudere match herkenbaar en dus afwijsbaar.
      const eventSequence = sequenceByMatchId.get(eventMatchId) ?? null;
      if (eventSequence !== null && local.matchSequence !== null && eventSequence < local.matchSequence) {
        return { apply: false, reason: 'STALE_MATCH_SEQUENCE' };
      }
      // Onbekende match zonder sequence: niet te ordenen op match. Valt terug
      // op de serverTime-ordening van de module (zie het handoff-item over matchSequence in de event-envelope).
    }

    const decision = shouldApplyEvent(local, envelope);
    if (decision.apply !== true) {
      return decision;
    }

    local.appliedServerTime = readObject(envelope).serverTime;
    local.appliedFrom = 'event';
    if (eventMatchId !== null && event !== null && MATCH_START_EVENTS.has(event)) {
      local.matchId = eventMatchId;
    }
    return decision;
  }

  /** Alleen voor tests/diagnostiek: een kopie van de bijgehouden positie.
   * `appliedMatchSequence` is een alias van `local.matchSequence`, bewaard voor
   * bestaande aanroepers van vóór het veld in de `LocalState` zelf landde. */
  function inspect() {
    return {
      ...local,
      appliedMatchSequence: local.matchSequence,
      knownMatches: new Map(sequenceByMatchId),
    };
  }
}

/** `room.matchSequence` is een integer >= 1, of `null` vóór de eerste match. */
function readSequence(snapshot) {
  const room = readObject(readObject(snapshot)?.room);
  const value = room?.matchSequence;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}
