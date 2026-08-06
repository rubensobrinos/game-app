// server/composition/match-lifecycle.mjs
//
// Compositie rond Match, Round en Answer: match starten, fases wisselen,
// rondes bouwen, antwoorden verwerken, uitslag, tussenstand, eindstand,
// rematch en de state-snapshot.
//
// DIT BESTAND IS SINDS DE OPSPLITSING (refactoropdracht 8) ALLEEN NOG DE
// VOORDEUR. De negentien exports hieronder — twaalf functies en zeven
// constanten — zijn ongewijzigd in naam, gedrag én importpad, zodat geen enkele
// aanroeper (`transport/socket.mjs`, `transport/rest.mjs`, `server/index.mjs`,
// de integratietests) iets merkt. De code zelf staat per handeling in
// `./match/`:
//
//   match/fases.mjs      resolveNextPhase, advancePhase + de fasehulpjes
//   match/rondes.mjs     startRound, endRound, submitAnswer, resolveEligibleFromRound
//   match/verloop.mjs    startMatch, finishMatch, rematch
//   match/stand.mjs      getScoreboard, buildRankedTop
//   match/snapshot.mjs   buildSnapshot
//   match/herstel.mjs    recoverActiveRooms
//   match/gedeeld.mjs    (intern) foutcodes, applyTransition, de drie harde regels
//
// Waarom een barrel en geen verhuizing van de importpaden: dat zou een
// gedragsneutrale opsplitsing veranderen in een wijziging van tien andere
// bestanden, waaronder `transport/` — dat deze opdracht met rust moest laten.
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
// DE DRIE HARDE REGELS staan bij `match/gedeeld.mjs` — daar wonen de codes,
// `applyTransition` en de module-load-assertie die ze bewaakt.
//
// POORTVERSIE. Deze map gebruikt de poort ZOALS DIE NU IS, inclusief de
// room-scoping van DM11: `saveRound(roomId, round)`,
// `loadAnswer(roomId, matchId, roundId, playerId)` en
// `loadActionCacheEntry(roomId, actionId)`.

export {
  CONTENT_UNAVAILABLE,
  INTERNAL_STATE_MACHINE_CODES,
  PHASE_RACE_LOST,
  SERVER_RECOVERY_REASON,
} from './match/gedeeld.mjs';
export { advancePhase, COUNTDOWN_SECONDS, resolveNextPhase } from './match/fases.mjs';
export { endRound, resolveEligibleFromRound, startRound, submitAnswer } from './match/rondes.mjs';
export { finishMatch, rematch, startMatch } from './match/verloop.mjs';
export { getScoreboard, SCOREBOARD_TOP_LIMIT } from './match/stand.mjs';
export { buildSnapshot, PROTOCOL_VERSION } from './match/snapshot.mjs';
export { recoverActiveRooms } from './match/herstel.mjs';
