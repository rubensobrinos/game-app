// server/composition/room-lifecycle.mjs
//
// Compositie rond Room, Session en Player: roomcreatie, pre-join-preview,
// join, delen, vergrendelen, kicken en tokenresolutie.
//
// DIT BESTAND IS SINDS DE OPSPLITSING (refactoropdracht 7) ALLEEN NOG DE
// VOORDEUR. De zestien exports hieronder zijn ongewijzigd — naam, gedrag én
// importpad — zodat geen enkele aanroeper (`transport/rest.mjs`,
// `transport/socket.mjs`, `match-lifecycle.mjs`, de integratietests) iets
// merkt. De code zelf staat per handeling in `./room/`:
//
//   room/configuratie.mjs   QUICK_START_CONFIG, resolveGameConfiguration, updateConfig
//   room/aanmaken.mjs       createRoom, claimLocators, buildJoinUrl, getShareInfo, previewInvite
//   room/deelnemers.mjs     joinRoom, leaveRoom, kickPlayer, renamePlayer, recolorPlayer
//   room/sessie.mjs         resolveSession
//   room/levensduur.mjs     touchRoom, setRoomLocked
//   room/gedeeld.mjs        (intern) foutcodes, fail/succeed, spelerhelpers, invite-lookup
//
// Waarom een barrel en geen verhuizing van de importpaden: dat zou een
// gedragsneutrale opsplitsing veranderen in een wijziging van tien andere
// bestanden, waaronder `transport/` en `match-lifecycle.mjs` — precies de twee
// die deze opdracht met rust moest laten.
//
// De regels hieronder golden vóór de opsplitsing voor het hele bestand en
// gelden nu voor de hele map. Ze staan hier omdat dit de plek is waar je
// binnenkomt.
//
// LIJM, GEEN DOMEINLOGICA. Elke inhoudelijke stap komt uit een bestaande,
// al geteste module:
//   - code/inviteId + hashing   → server/architecture/room-codes.js
//   - naamverwerking            → server/data/name-processing.js
//   - documentvormen            → server/data/types/*.js  (het vangnet)
//   - opslag                    → server/data/repository.js (de poort)
//   - foutcodes                 → server/protocol/error-codes.mjs
//   - sessietokens (besluit 26) → ./context.mjs
//
// RESULTAATCONVENTIE. Elke functie geeft `{ ok: true, value }` of
// `{ ok: false, code }` met een code uit `error-codes.mjs` — dezelfde vorm die
// server/protocol/ en server/architecture/state-machine.js al gebruiken, zodat
// de transportlaag (stap 2) `code` één-op-één kan doorgeven. Werpen doet deze
// module alleen bij programmeerfouten van de aanroeper en bij
// GameCodeExhaustedError (het gedocumenteerde foutcontract van room-codes.js).
//
// AUTORISATIE ZIT HIER NIET. `setRoomLocked` en `kickPlayer` controleren geen
// hostrol; NOT_HOST is een protocol-/transportbeslissing op basis van de
// sessie die `resolveSession` teruggeeft. Deze module voert uit wat gevraagd
// wordt en beslist niet wie het mag vragen.
//
// `Room.phase` WORDT HIER NA CREATIE NOOIT GESCHREVEN. Besluit 30 maakt
// `Match.phase` autoritair en `Room.phase` een afgeleide projectie die in
// dezelfde atomaire operatie meegaat — dat pad loopt uitsluitend via
// `setRoomAndMatchPhaseAtomically` in de match-lifecycle. Bij roomcreatie
// bestaat er nog geen match, dus `LOBBY` is daar geen dual write.

export { QUICK_START_CONFIG, resolveGameConfiguration, updateConfig } from './room/configuratie.mjs';
export { buildJoinUrl, claimLocators, createRoom, getShareInfo, previewInvite } from './room/aanmaken.mjs';
export { joinRoom, kickPlayer, leaveRoom, recolorPlayer, renamePlayer } from './room/deelnemers.mjs';
export { resolveSession } from './room/sessie.mjs';
export { setRoomLocked, touchRoom } from './room/levensduur.mjs';
