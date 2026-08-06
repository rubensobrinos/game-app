// shared/content/game-catalog.mjs
//
// DE ENIGE LIJST die zegt welke spelvorm een host écht kan spelen.
//
// Waarom dit bestand bestaat (5 aug 2026, PLAN-CONVERGENTIE §A0): de
// lobbycarrousel, de protocolvalidatie van `game:update-config` en de
// contentbron hielden alle drie hun eigen antwoord bij op dezelfde vraag. Ze
// liepen uit elkaar: de carrousel zette `real_or_fake_flag` op speelbaar, het
// protocol accepteerde het, en de contentbron wierp bij de eerste ronde —
// waarna de room stil in COUNTDOWN bleef staan. Eén lijst, drie lezers.
//
// Dit bestand woont in `shared/` omdat het de enige plek is die zowel de
// server (`server/protocol/`, `server/composition/`) als de browserfrontend
// (`frontend/js/views/lobby.mjs`) kan importeren. Geen tweede transcriptie.
//
// SPEELBAAR IS EEN KETENUITSPRAAK, geen wens. Een gameType hoort hier pas bij
// `PLAYABLE_GAME_TYPES` als ALLE vijf schakels bestaan:
//   1. vraagselectie      server/rules/question-selection.js
//   2. contentbron        server/composition/content-source.mjs (FILLED_GAME_TYPES)
//   3. spelscherm         frontend/js/views/gameplay.mjs (een eigen rendertak)
//   4. uitslag/reveal     frontend/js/views/reveal-model.mjs + scoreboard
//   5. mockpariteit       frontend/js/transport-mock.mjs
// `content-source.mjs` bewaakt schakel 2 bij module-load; de rest is
// mensenwerk en hoort bij de verticale oplevering (PLAN-CONVERGENTIE stap 6).

/**
 * De vier wereldgames uit DOELBEELD-v2 §1, in carrouselvolgorde.
 *
 * `key` is de i18n-sleutelstam (`lobby.game_<key>`, `lobby.game_<key>_desc`);
 * `gameType` is de wire-waarde uit `GOLF_1_GAME_TYPES`, of `null` wanneer de
 * game server-side nog niet bestaat. "Raad het land" (contour) is zo'n geval:
 * de contourdata zit nog in de singleplayer-app (`data/geo-countries.js`) en
 * heeft nog geen gameType — zie PLAN-CONVERGENTIE §B3.
 *
 * @type {ReadonlyArray<{ key: string, gameType: string | null }>}
 */
export const GAME_CATALOG = Object.freeze([
  Object.freeze({ key: 'flag', gameType: 'flags_mc' }),
  Object.freeze({ key: 'realfake', gameType: 'real_or_fake_flag' }),
  Object.freeze({ key: 'odd', gameType: 'odd_one_out' }),
  Object.freeze({ key: 'outline', gameType: 'country_shape_mc' }),
  // Besluit 49 (producteigenaar, 6 aug 2026): deze twee bestonden al in de
  // regellaag maar stonden nergens aan. De ketencontrole is gedraaid vóór ze
  // hier landden — vraagselectie, contentbron, spelscherm, uitslag én mock
  // kennen ze alle vijf.
  Object.freeze({ key: 'capitals', gameType: 'capitals_mc' }),
  Object.freeze({ key: 'higherlower', gameType: 'higher_lower' }),
]);

/**
 * De gameTypes waarvan de HELE keten af is. Alleen deze mag een host kiezen.
 *
 * Uitbreiden is een bewuste handeling met een verticaal bewijs erachter, geen
 * bijvangst van een frontendwijziging.
 *
 * @type {ReadonlyArray<string>}
 */
export const PLAYABLE_GAME_TYPES = Object.freeze([
  'flags_mc', 'real_or_fake_flag', 'odd_one_out', 'capitals_mc', 'higher_lower',
  // Besluit C-2: de vierde wereldgame. Pas hier omgezet nadat alle vijf de
  // schakels bestonden en een partij van vijf rondes solo én tegen de echte
  // server is uitgespeeld (opdracht D). De ketentest vond onderweg nog een
  // stille vastloper: computeAnswerDistribution kende dit gameType niet en
  // wierp binnen de fasepomp, waardoor de room zonder foutmelding in
  // ROUND_ACTIVE bleef hangen tot de TTL verliep — hetzelfde patroon als
  // 4 augustus, één fase later.
  'country_shape_mc',
]);

const PLAYABLE = new Set(PLAYABLE_GAME_TYPES);

/**
 * @param {unknown} gameType
 * @returns {boolean}
 */
export function isPlayableGameType(gameType) {
  return typeof gameType === 'string' && PLAYABLE.has(gameType);
}

// Een catalogusregel die naar een niet-bestaande gameType wijst is een typefout
// die anders pas in de lobby zichtbaar wordt. Faalt bij module-load.
for (const entry of GAME_CATALOG) {
  if (entry.gameType === null) continue;
  if (typeof entry.gameType !== 'string' || entry.gameType.length === 0) {
    throw new Error(`game-catalog: ongeldige gameType voor "${entry.key}"`);
  }
}
for (const gameType of PLAYABLE_GAME_TYPES) {
  if (!GAME_CATALOG.some((entry) => entry.gameType === gameType)) {
    throw new Error(`game-catalog: "${gameType}" is speelbaar maar staat niet in GAME_CATALOG`);
  }
}
