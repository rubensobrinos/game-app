'use strict';

// Repository-domeinpoort: WAT de rest van de server nodig heeft op
// Room/Session/Player/Match/Round/Answer, niet HOE dat ooit tegen Redis
// wordt uitgevoerd. Zie
// docs/data-model-plan/prompts/DM6-repository-port.md voor de volledige spec.
//
// Geen Redis-vormige primitieven (hSet/zAdd/multi/eval) in dit contract — een
// latere ADR (checkpoints 2, 3, 5, 6, 7) kiest clientlibrary, serialisatie,
// hashalgoritme en atomiciteitsmechanisme áchter dezelfde methodenamen, zonder
// de aanroepers te raken.
//
// Uitgebreid door DM10 (docs/data-model-plan/prompts/DM10-room-locator-claim.md)
// en DM11 (docs/data-model-plan/prompts/DM11-room-scoped-round-answer.md), als
// reactie op docs/integration-plan/HANDOFF.md (INT-1) en HANDOFF-INTB.md
// (INTB-1, INTB-2): `loadRoomByInviteId(inviteId)` is hernoemd naar
// `loadRoomByInviteHash(inviteHash)`, en `saveRound`/`loadAnswer`/
// `loadActionCacheEntry` zijn room-gescoped. Geen nieuwe velden op Round/Answer
// — zie DM11 voor waarom dat bewust is afgewezen.

/**
 * @typedef {object} DataStore
 * @property {(roomId: string) => Promise<import('./types/room').Room|null>} loadRoom
 * @property {(room: import('./types/room').Room) => Promise<void>} saveRoom
 * @property {(code: string) => Promise<import('./types/room').Room|null>} loadRoomByCode
 * @property {(inviteHash: string) => Promise<import('./types/room').Room|null>} loadRoomByInviteHash
 * @property {(claim: RoomLocatorClaim) => Promise<{ ok: true } | { ok: false, conflict: 'code' | 'inviteHash' }>} claimRoomLocatorsAtomically
 * @property {(locators: RoomLocatorPair) => Promise<void>} releaseRoomLocators
 * @property {(claim: RoomLocatorClaim) => Promise<void>} refreshRoomLocators
 * @property {(rotation: RoomLocatorRotation) => Promise<{ ok: true } | { ok: false, conflict: 'code' | 'inviteHash' }>} rotateRoomLocators
 * @property {(roomId: string, sessionId: string) => Promise<import('./types/session').Session|null>} loadSession
 * @property {(session: import('./types/session').Session) => Promise<void>} saveSession
 * @property {(tokenHash: string) => Promise<import('./types/session').Session|null>} loadSessionByTokenHash
 *
 * `saveSession` (DM17, Deel B — reactie op INTB-10's rotatie-eis): als een
 * bestaande sessie een NIEUWE `tokenHash` krijgt, geeft de vorige
 * `tokenHash`-index-entry in dezelfde stap vrij — anders blijft een oud token
 * een tweede geldige capability naast het nieuwe (dezelfde klasse fout als
 * INTB-5, nu voor sessies). `loadSessionByTokenHash` ververst nooit bij een
 * lookup ("touch-on-read") — de TTL-koppeling loopt via de room-brede
 * refresh, niet via hoe vaak een token wordt opgezocht, anders verliest een
 * stille speler zijn reconnectrecht terwijl de room nog leeft.
 * @property {(roomId: string, playerId: string) => Promise<import('./types/player').Player|null>} loadPlayer
 * @property {(player: import('./types/player').Player) => Promise<void>} savePlayer
 * @property {(roomId: string) => Promise<import('./types/player').Player[]>} listPlayers
 * @property {() => Promise<string[]>} listActiveRoomIds
 * @property {(roomId: string, matchId: string) => Promise<import('./types/match').Match|null>} loadMatch
 * @property {(match: import('./types/match').Match) => Promise<void>} saveMatch
 * @property {(roomId: string, matchId: string, roundId: string) => Promise<import('./types/round').Round|null>} loadRound
 * @property {(roomId: string, round: import('./types/round').Round) => Promise<void>} saveRound
 * @property {(roomId: string, matchId: string, roundId: string, playerId: string) => Promise<import('./types/answer').Answer|null>} loadAnswer
 * @property {(roomId: string, matchId: string, transition: PhaseTransition) => Promise<{ ok: true } | { ok: false, actualPhase: string }>} setRoomAndMatchPhaseAtomically
 * @property {(roomId: string, matchId: string, write: AcceptedAnswerWrite) => Promise<{ replay: boolean }>} saveAcceptedAnswerAtomically
 * @property {(roomId: string, actionId: string) => Promise<{ actionId: string, ack: object } | null>} loadActionCacheEntry
 * @property {(roomId: string, matchId: string, limit: number) => Promise<Array<{playerId: string, score: number}>>} getScoreboardTop
 */

/**
 * Eén gecombineerde claim voor de join-code en de invite-hash-index van een
 * room, atomair: beide of geen van beide (`DECISIONS.md` #30's "geen
 * niet-atomair dual-write-pad" geldt hier net zo goed als voor
 * `Room.phase`/`Match.phase`). `inviteHash`, niet `inviteId` — de aanroeper
 * hasht vóór de repository (`hashInviteId()` uit `server/architecture/
 * room-codes.js`); deze poort ziet nooit de platte capability en heeft dus
 * nooit de pepper nodig.
 *
 * CLUSTER-OPMERKING (documentatie, geen ontwerpwijziging): een Lua-script dat
 * in één transactie zowel `room:code:{code}` als `room:invite:{inviteHash}`
 * aanraakt veronderstelt dat beide sleutels in dezelfde Redis-hashslot vallen.
 * Bij één Redis-instance (checkpoint 2, huidig uitgangspunt) is dat geen
 * probleem; bij Redis Cluster zouden beide `{roomId}`-hashtags nodig hebben
 * om co-locatie te garanderen.
 *
 * Dit maakt de atomaire Redis-implementatie MOGELIJK ("unblocks" INT-A/INT-B)
 * — het bewijst zelf geen Redis-atomiciteit. Die garantie blijft een
 * (b)-ADR-uitvoeringsdetail van de echte adapter (checkpoint 2, 6), net als
 * bij `setRoomAndMatchPhaseAtomically`/`saveAcceptedAnswerAtomically`.
 * @typedef {{ roomId: string, code: string, inviteHash: string, ttlSeconds: number }} RoomLocatorClaim
 * @typedef {{ roomId: string, code: string, inviteHash: string }} RoomLocatorPair
 */

/**
 * DM16 (§9, reactie op INTB-5 🔴 — geroteerde uitnodiging bleef geldig).
 * Atomaire wissel: oude locators vrijgeven én nieuwe claimen in één stap, of
 * geen van beide. `ARCHITECTURE.md` §inviteId eist "direct intrekbaar of
 * roteerbaar" — twee losse aanroepen (release + claim) zouden een venster
 * openen waarin de oude locator na een mislukte nieuwe claim toch nog geldig
 * blijft, en dat is bij "direct intrekbaar" de ergere uitkomst dan een room
 * die tijdelijk via geen enkele code bereikbaar is. Bij een conflict op de
 * nieuwe locators gebeurt daarom NIETS — de oude locators blijven geldig
 * (veilige no-op, geen halve rotatie).
 * @typedef {{ roomId: string, oldCode: string, oldInviteHash: string, newCode: string, newInviteHash: string, ttlSeconds: number }} RoomLocatorRotation
 */

/**
 * DM19 (reactie op INT-16). Drie uitbreidingen op het DM6-ontwerp van
 * `setRoomAndMatchPhaseAtomically`:
 *   - **Dubbele compare-and-set.** Zowel `Room.phase` als `Match.phase`
 *     moeten op het moment van aanroepen `expectedPhase` dragen — dit
 *     vertrouwt niet stilzwijgend dat de twee al gelijk lopen. Een mismatch
 *     aan één van beide kanten → `{ ok: false, actualPhase }` (normale
 *     uitkomst, geen exception, net als bij de locatorclaim).
 *     `actualPhase` is altijd `Match.phase` (besluit 30: dat veld is
 *     autoritair), ook als het ándere veld de mismatch veroorzaakte.
 *   - **`pausedState` in dezelfde atomaire stap.** Was vóór DM19 een aparte
 *     `saveMatch`-aanroep van de aanroeper — een niet-atomair
 *     dual-write-pad voor het veld dat besluit 30 niet met naam noemde maar
 *     in de geest evident meeneemt.
 *   - **`pausedState`/`PAUSED`-invariant, BEIDE richtingen, als throw.**
 *     `newPhase === 'PAUSED'` vereist `pausedState !== null` en omgekeerd —
 *     een contractschending van de aanroeper (nooit geldig, ongeacht de
 *     store-toestand), dus een `RangeError`, geen `{ ok: false }`. Anders dan
 *     de compare-and-set hierboven: dit is geen normale racefout maar een
 *     intern inconsistente aanvraag.
 * @typedef {{ expectedPhase: string, newPhase: string, pausedState: import('./types/match').MatchPausedState | null }} PhaseTransition
 */

/**
 * Alles wat stappen 7–10 van de atomaire antwoordverwerking in ÉÉN mutatie
 * horen te schrijven — inclusief de ack (stap 10), niet als losse latere
 * uitbreiding (REVIEW-DM2-DM9.md bevinding 5). `updatedPlayer` bevat absolute
 * nieuwe waarden, geen delta — de aanroeper (DM7) berekent `player.score +
 * points` zelf en geeft het resultaat door.
 *
 * FOUTCONTRACT van `saveAcceptedAnswerAtomically` (DM13, reactie op INTB-4;
 * returnwaarde DM15, reactie op INT-14): idempotentie en "één antwoord per
 * ronde" zitten ÍN deze operatie, niet ervóór — een check in de aanroeper
 * (bijv. `answer-flow.js`'s stap 1/5) dekt geen gelijktijdige aanroepen af.
 *   - `write.actionCacheEntry.actionId` staat al in de action-cache van deze
 *     room → replay: `{ replay: true }`, geen mutatie, geen ack in de
 *     returnwaarde (de aanroeper gebruikt `loadActionCacheEntry` als hij hem
 *     nodig heeft). Dit signaal laat de aanroeper een replay herkennen zónder
 *     een eigen, niet-atomaire vooraf-lezing (INT-14: zo'n lezing dekte geen
 *     gelijktijdigheid en liet een replay ná de deadline ten onrechte op
 *     `DEADLINE_PASSED` stuklopen, vóórdat deze operatie ooit werd bereikt).
 *   - anders, en er bestaat al een `Answer` voor deze `roundId` + `playerId`
 *     (een andere `actionId`) → werpt een `RangeError` met
 *     `.code === 'ALREADY_ANSWERED'` (zelfde codestring als `resolveAnswer`'s
 *     eigen returncode).
 *   - anders, geslaagde nieuwe write → `{ replay: false }`.
 *   - onbekende `updatedPlayer.id` → werpt `RangeError` (ongewijzigd).
 * @typedef {{
 *   answer: import('./types/answer').Answer,
 *   updatedPlayer: { id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number },
 *   actionCacheEntry: { actionId: string, ack: object },
 * }} AcceptedAnswerWrite
 */

// De methodenamen die elke DataStore-implementatie moet hebben. `loadAnswer`
// is een kleine, additieve toevoeging t.o.v. de representatieve lijst uit de
// DM6-prompt zelf — nodig om saveAcceptedAnswerAtomically's schrijfresultaat
// te kunnen verifiëren (test), en om DM7's answer-flow-context
// (`existingAnswerForRound`) te kunnen opbouwen. Verdere methoden mogen later
// net zo additief bijkomen zodra een consument ze nodig heeft (DM6-prompt:
// "nadrukkelijk niet-uitputtend").
const DATA_STORE_METHOD_NAMES = Object.freeze([
  'loadRoom', 'saveRoom', 'loadRoomByCode', 'loadRoomByInviteHash',
  'claimRoomLocatorsAtomically', 'releaseRoomLocators', 'refreshRoomLocators', 'rotateRoomLocators',
  'loadSession', 'saveSession', 'loadSessionByTokenHash',
  'loadPlayer', 'savePlayer', 'listPlayers', 'listActiveRoomIds',
  'loadMatch', 'saveMatch',
  'loadRound', 'saveRound',
  'loadAnswer',
  'setRoomAndMatchPhaseAtomically', 'saveAcceptedAnswerAtomically',
  'loadActionCacheEntry', 'getScoreboardTop',
]);

/**
 * Werpt TypeError als `candidate` niet elke methode van `DataStore` als
 * functie heeft. Puur een contract-sanity-check (JSDoc-typedefs worden niet
 * door de JS-runtime afgedwongen) — geen gedragscontrole.
 * @param {unknown} candidate
 */
function assertImplementsDataStore(candidate) {
  if (typeof candidate !== 'object' || candidate === null) {
    throw new TypeError(`DataStore implementation must be an object, got: ${candidate === null ? 'null' : typeof candidate}`);
  }
  for (const methodName of DATA_STORE_METHOD_NAMES) {
    if (typeof candidate[methodName] !== 'function') {
      throw new TypeError(`DataStore implementation is missing method: ${methodName}`);
    }
  }
}

module.exports = { DATA_STORE_METHOD_NAMES, assertImplementsDataStore };
