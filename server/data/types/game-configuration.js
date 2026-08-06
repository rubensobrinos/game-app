'use strict';

// GameConfiguration-vorm uit docs/multiplayer/DATA-MODEL.md ("GameConfiguration").
// Zie docs/data-model-plan/prompts/DM2a-game-configuration-and-session.md voor de
// volledige spec, met name welke velden wel/niet een gesloten enum hebben.
//
// Pure module: geen Redis, geen sockets, geen klok. assertGameConfigurationShape
// controleert aanwezigheid + primitief type per veld, plus gesloten-enum-checks
// voor precies de velden waarvoor dat over meerdere brondocumenten heen
// daadwerkelijk vastligt (language, mode, gameTypes, pacing). Alle andere velden
// (incl. preset, difficulty, scoreboardFrequency, metricMode) zijn bewust NIET
// tot een gesloten enum gemaakt — zie de prompt voor de onderbouwing per veld.

/**
 * @typedef {{
 *   preset: string,
 *   gameTypes: string[],
 *   language: "nl" | "en" | "es",
 *   difficulty: string,
 *   totalRounds: number,
 *   questionSeconds: number,
 *   resultSeconds: number,
 *   scoreboardSeconds: number,
 *   scoreboardFrequency: string,
 *   pacing: "auto" | "host",
 *   autoReveal: boolean,
 *   speedBonus: boolean,
 *   deadlineGraceMs: number,
 *   mode: "individual" | "teams",
 *   teamNames: string[],
 *   metricMode: string,
 *   maxPlayers: number,
 *   allowLateJoin: boolean,
 *   continents: string[],
 * }} GameConfiguration
 */

const LANGUAGE_VALUES = Object.freeze(['nl', 'en', 'es']);

// Punt 7 productspec (docs/openstaand/continentfilter.md): de zes continenten
// van de contentpool (`shared/content/countries.data.mjs`'s `continent`-veld).
// Gesloten enum — net als language/mode/gameTypes/pacing hierboven — zodat een
// tikfout in een continentnaam bij creatie faalt, niet stil een lege pool
// oplevert bij de eerste vraagselectie.
const CONTINENT_VALUES = Object.freeze(['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania']);

// `teams` staat wél in de typedef (DATA-MODEL.md kent het veld, en het komt
// terug zodra teams gebouwd worden) maar wordt HIER GEWEIGERD zolang
// DECISIONS.md besluit 8 geldt: "Teams worden nu niet gebouwd. Er wordt geen
// teamkeuzecontract, teammodel of teamscoring aan de huidige MVP toegevoegd."
//
// Waarom weigeren en niet stilzwijgend accepteren: er is geen teamscoring, geen
// teamindeling en geen teamweergave. Een geaccepteerde `mode: "teams"` levert
// dus een match op die zich gewoon individueel gedraagt, zonder dat iemand het
// merkt — stil verkeerd gedrag. `04-SCREEN-SPECIFICATIONS.md` beschrijft een
// instelscherm met "teams of individuele modus" als stap 4, dus dit is een
// realistisch pad en geen theoretisch randgeval.
//
// Terugdraaien zodra teams gebouwd worden: zet `teams` terug in
// ACCEPTED_MODE_VALUES. De typedef en MODE_VALUES hoeven dan niet mee.
const MODE_VALUES = Object.freeze(['individual', 'teams']);
const ACCEPTED_MODE_VALUES = Object.freeze(['individual']);

// Golf 1-gameTypes: gedeeld met Round.gameType (DM3) via types/game-types.js,
// niet hier apart gedefinieerd. Zie dat bestand voor de herkomst/onderbouwing.
const { GOLF_1_GAME_TYPES } = require('./game-types');

// pacing's twee waarden, LOKAAL getranscribeerd — niet geïmporteerd uit
// server/architecture/state-machine.js. Dat bestand exporteert deze constante
// niet, en zelfs als het dat wel deed, is het een gedragslaag (transition()-
// reducer), geen neutrale constantsmodule: server/data -> server/architecture
// is de verkeerde afhankelijkheidsrichting (REVIEW-DM2-DM9.md bevinding 10).
// Zie docs/data-model-plan/HANDOFF.md §5 voor een voorstel om dit via een
// neutrale gedeelde module op te lossen; tot die tijd blijft dit een lokale
// kopie die handmatig in sync moet blijven met state-machine.js's PACING.
const PACING_VALUES = Object.freeze(['auto', 'host']);

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function assertString(value, fieldName) {
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a string, got: ${typeof value}`);
  }
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function assertNumber(value, fieldName) {
  if (typeof value !== 'number') {
    throw new TypeError(`${fieldName} must be a number, got: ${typeof value}`);
  }
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function assertBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${fieldName} must be a boolean, got: ${typeof value}`);
  }
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function assertStringArray(value, fieldName) {
  if (!Array.isArray(value) || !value.every((el) => typeof el === 'string')) {
    throw new TypeError(`${fieldName} must be an array of strings, got: ${JSON.stringify(value)}`);
  }
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @param {readonly string[]} allowedValues
 */
function assertClosedEnum(value, fieldName, allowedValues) {
  assertString(value, fieldName);
  if (!allowedValues.includes(value)) {
    throw new RangeError(
      `${fieldName} must be one of ${JSON.stringify(allowedValues)}, got: ${JSON.stringify(value)}`
    );
  }
}

/**
 * Werpt TypeError/RangeError als value niet aan de GameConfiguration-vorm
 * voldoet. Controleert aanwezigheid + primitief type voor alle 18 velden, plus
 * gesloten-enum-lidmaatschap voor language/mode/gameTypes/pacing/continents.
 * @param {unknown} value
 */
function assertGameConfigurationShape(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`GameConfiguration must be an object, got: ${value === null ? 'null' : typeof value}`);
  }

  assertString(value.preset, 'preset');

  assertStringArray(value.gameTypes, 'gameTypes');
  for (const gameType of value.gameTypes) {
    if (!GOLF_1_GAME_TYPES.includes(gameType)) {
      throw new RangeError(
        `gameTypes elements must be one of ${JSON.stringify(GOLF_1_GAME_TYPES)}, got: ${JSON.stringify(gameType)}`
      );
    }
  }

  assertClosedEnum(value.language, 'language', LANGUAGE_VALUES);
  assertString(value.difficulty, 'difficulty');
  assertNumber(value.totalRounds, 'totalRounds');
  assertNumber(value.questionSeconds, 'questionSeconds');
  assertNumber(value.resultSeconds, 'resultSeconds');
  assertNumber(value.scoreboardSeconds, 'scoreboardSeconds');
  assertString(value.scoreboardFrequency, 'scoreboardFrequency');
  assertClosedEnum(value.pacing, 'pacing', PACING_VALUES);
  // `autoReveal` (besluit C, DOELBEELD-v2 §3): staat hij uit, dan wacht de
  // uitslagfase op de host in plaats van op een timer. Boolean en verplicht —
  // net als `speedBonus`/`allowLateJoin` — zodat er geen room kan bestaan
  // waarvan het onthulgedrag onbepaald is.
  assertBoolean(value.autoReveal, 'autoReveal');
  assertBoolean(value.speedBonus, 'speedBonus');
  assertNumber(value.deadlineGraceMs, 'deadlineGraceMs');
  assertClosedEnum(value.mode, 'mode', ACCEPTED_MODE_VALUES);
  assertStringArray(value.teamNames, 'teamNames');
  assertString(value.metricMode, 'metricMode');
  assertNumber(value.maxPlayers, 'maxPlayers');
  assertBoolean(value.allowLateJoin, 'allowLateJoin');

  // `continents` (punt 7, docs/openstaand/continentfilter.md): standaard alle
  // zes (zie QUICK_START_CONFIG), maar een host mag inperken tot zelfs één.
  // Wél altijd minstens één — een lege lijst levert bij elke moeilijkheids-
  // graad een lege kandidatenpool op, geen speelbare room. Dat is geen
  // productbesluit over een AANTAL (zoals gameTypes' "exact één", dat in
  // room-lifecycle.mjs zit) maar een structurele ondergrens: "geen enkel
  // continent" is nooit een geldige GameConfiguration.
  assertStringArray(value.continents, 'continents');
  if (value.continents.length === 0) {
    throw new RangeError('continents must contain at least one continent');
  }
  for (const continent of value.continents) {
    if (!CONTINENT_VALUES.includes(continent)) {
      throw new RangeError(
        `continents elements must be one of ${JSON.stringify(CONTINENT_VALUES)}, got: ${JSON.stringify(continent)}`
      );
    }
  }
}

module.exports = {
  assertGameConfigurationShape,
  GOLF_1_GAME_TYPES,
  LANGUAGE_VALUES,
  MODE_VALUES,
  ACCEPTED_MODE_VALUES,
  PACING_VALUES,
  CONTINENT_VALUES,
};
