'use strict';

// Player-vorm uit docs/multiplayer/DATA-MODEL.md ("Player"). Zie
// docs/data-model-plan/prompts/DM3-player-match-round-answer-presentation.md
// voor de volledige spec en docs/data-model-plan/HANDOFF.md §3 voor de
// rematch-resetsemantiek (die hier NIET geïmplementeerd wordt — dat is
// repository/answer-flow-terrein, DM6/DM7).
//
// score/correctCount/correctResponseTimeMsTotal zijn niet-negatieve integers
// omdat server/rules/standings.js's assertValidPlayerForRanking dat al keihard
// eist van elke aanroeper (via rankPlayers()) — dezelfde grens hier overnemen.

/**
 * @typedef {{ country: string, word: string }} PlayerIdentity
 *
 * @typedef {{
 *   id: string,
 *   roomId: string,
 *   sessionId: string,
 *   displayName: string | null,
 *   generatedName: string,
 *   effectiveName: string,
 *   nameSource: string,
 *   identity: PlayerIdentity | null,
 *   teamId: string | null,
 *   score: number,
 *   correctCount: number,
 *   correctResponseTimeMsTotal: number,
 *   connected: boolean,
 *   eligibleFromRound: number,
 *   joinedAt: number,
 *   left: boolean,
 *   kicked: boolean,
 * }} Player
 */

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string, got: ${JSON.stringify(value)}`);
  }
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function assertNonNegativeInteger(value, fieldName) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} must be a non-negative integer, got: ${JSON.stringify(value)}`);
  }
}

/**
 * `identity` (docs/openstaand/spelersidentiteit.md, stap 4): het
 * `{ country, word }`-paar achter een GEGENEREERDE naam — nooit gerenderde
 * tekst, zie identity-processing.js voor waarom. `null` voor een zelfgekozen
 * naam (nameSource 'chosen'): de identiteit vervangt alleen de gegenereerde
 * naam, nooit een getypte.
 *
 * `undefined` wordt hier BEWUST hetzelfde behandeld als `null` — stap 6, de
 * migratie: een Player die vóór deze stap in Redis is opgeslagen heeft de
 * sleutel `identity` helemaal niet (oude JSON, geen leeg veld). Zonder deze
 * gelijkstelling zou elke `savePlayer()`-aanroep op zo'n bestaande speler
 * (een kick, een score-update, noem het op) alsnog werpen — een speler die
 * niets fout deed zou zijn room breken. Lezers elders behandelen een
 * ontbrekend/`null`-veld identiek: `player.identity ?? null`, nooit een
 * losse "bestaat de sleutel"-tak.
 * @param {unknown} value
 */
function assertIdentityShape(value) {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`identity must be null or an { country, word } object, got: ${JSON.stringify(value)}`);
  }
  assertNonEmptyString(value.country, 'identity.country');
  assertNonEmptyString(value.word, 'identity.word');
}

/**
 * Werpt TypeError/RangeError als value niet aan de Player-vorm voldoet.
 * `nameSource` wordt uitsluitend gecontroleerd op "niet-lege string" — geen
 * gesloten enum. Alleen "generated" is ooit als letterlijke waarde getoond in
 * DATA-MODEL.md; de tegenhanger voor een zelfgekozen naam heeft geen
 * bevestigde string. Bewust open, niet vergeten.
 * @param {unknown} value
 */
function assertPlayerShape(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`Player must be an object, got: ${value === null ? 'null' : typeof value}`);
  }

  assertNonEmptyString(value.id, 'id');
  assertNonEmptyString(value.roomId, 'roomId');
  assertNonEmptyString(value.sessionId, 'sessionId');

  if (value.displayName !== null) {
    assertNonEmptyString(value.displayName, 'displayName');
  }

  assertNonEmptyString(value.generatedName, 'generatedName');
  assertNonEmptyString(value.effectiveName, 'effectiveName');
  assertNonEmptyString(value.nameSource, 'nameSource');
  assertIdentityShape(value.identity);

  if (value.teamId !== null) {
    assertNonEmptyString(value.teamId, 'teamId');
  }

  assertNonNegativeInteger(value.score, 'score');
  assertNonNegativeInteger(value.correctCount, 'correctCount');
  assertNonNegativeInteger(value.correctResponseTimeMsTotal, 'correctResponseTimeMsTotal');

  if (typeof value.connected !== 'boolean') {
    throw new TypeError(`connected must be a boolean, got: ${typeof value.connected}`);
  }

  if (typeof value.eligibleFromRound !== 'number' || !Number.isInteger(value.eligibleFromRound) || value.eligibleFromRound < 1) {
    throw new RangeError(`eligibleFromRound must be an integer >= 1, got: ${JSON.stringify(value.eligibleFromRound)}`);
  }

  if (typeof value.joinedAt !== 'number' || !Number.isFinite(value.joinedAt) || value.joinedAt < 0) {
    throw new TypeError(`joinedAt must be a finite, non-negative number, got: ${value.joinedAt}`);
  }

  if (typeof value.left !== 'boolean') {
    throw new TypeError(`left must be a boolean, got: ${typeof value.left}`);
  }
  if (typeof value.kicked !== 'boolean') {
    throw new TypeError(`kicked must be a boolean, got: ${typeof value.kicked}`);
  }
}

/**
 * Projecteert een Player naar exact de vier velden die
 * server/rules/standings.js's rankPlayers() consumeert (via
 * assertValidPlayerForRanking) — expliciete allowlist, geen spread. Zie
 * docs/data-model-plan/prompts/DM9-game-rules-reconciliation.md: de enige
 * projectie die hier gebouwd wordt, omdat rankPlayers() de enige echte,
 * bestaande consument is. toEligibilityPlayerView/toTeamPlayerView wachten op
 * GR5/GR6, die nog niet bestaan.
 * @param {Player} player
 * @returns {{ id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number }}
 */
function toStandingPlayerView(player) {
  assertPlayerShape(player);
  return {
    id: player.id,
    score: player.score,
    correctCount: player.correctCount,
    correctResponseTimeMsTotal: player.correctResponseTimeMsTotal,
  };
}

module.exports = { assertPlayerShape, toStandingPlayerView };
