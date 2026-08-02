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

/**
 * @typedef {object} DataStore
 * @property {(roomId: string) => Promise<import('./types/room').Room|null>} loadRoom
 * @property {(room: import('./types/room').Room) => Promise<void>} saveRoom
 * @property {(code: string) => Promise<import('./types/room').Room|null>} loadRoomByCode
 * @property {(inviteId: string) => Promise<import('./types/room').Room|null>} loadRoomByInviteId
 * @property {(roomId: string, sessionId: string) => Promise<import('./types/session').Session|null>} loadSession
 * @property {(session: import('./types/session').Session) => Promise<void>} saveSession
 * @property {(roomId: string, playerId: string) => Promise<import('./types/player').Player|null>} loadPlayer
 * @property {(player: import('./types/player').Player) => Promise<void>} savePlayer
 * @property {(roomId: string) => Promise<import('./types/player').Player[]>} listPlayers
 * @property {(roomId: string, matchId: string) => Promise<import('./types/match').Match|null>} loadMatch
 * @property {(match: import('./types/match').Match) => Promise<void>} saveMatch
 * @property {(roomId: string, matchId: string, roundId: string) => Promise<import('./types/round').Round|null>} loadRound
 * @property {(round: import('./types/round').Round) => Promise<void>} saveRound
 * @property {(roundId: string, playerId: string) => Promise<import('./types/answer').Answer|null>} loadAnswer
 * @property {(roomId: string, matchId: string, newPhase: string) => Promise<void>} setRoomAndMatchPhaseAtomically
 * @property {(roomId: string, matchId: string, write: AcceptedAnswerWrite) => Promise<void>} saveAcceptedAnswerAtomically
 * @property {(actionId: string) => Promise<{ actionId: string, ack: object } | null>} loadActionCacheEntry
 * @property {(roomId: string, matchId: string, limit: number) => Promise<Array<{playerId: string, score: number}>>} getScoreboardTop
 */

/**
 * Alles wat stappen 7–10 van de atomaire antwoordverwerking in ÉÉN mutatie
 * horen te schrijven — inclusief de ack (stap 10), niet als losse latere
 * uitbreiding (REVIEW-DM2-DM9.md bevinding 5). `updatedPlayer` bevat absolute
 * nieuwe waarden, geen delta — de aanroeper (DM7) berekent `player.score +
 * points` zelf en geeft het resultaat door.
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
  'loadRoom', 'saveRoom', 'loadRoomByCode', 'loadRoomByInviteId',
  'loadSession', 'saveSession',
  'loadPlayer', 'savePlayer', 'listPlayers',
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
