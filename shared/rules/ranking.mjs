// shared/rules/ranking.mjs
//
// Eindstandberekening voor spelers. Zie docs/multiplayer/GAME-RULES.md
// ("Gelijke eindscore") en docs/game-rules-plan/prompts/GR2-standings.md voor
// de volledige spec.
//
// VERHUISD op 5 aug 2026 uit `server/rules/standings.js` (PLAN-CONVERGENTIE
// §A3). Reden: dit is de enige plek in de codebase die een POSITIE mag
// bepalen, en die uitspraak moet ook gelden voor de browserkant — de
// mocktransport (`frontend/js/transport-mock.mjs`) speelde de server na met
// een eigen sortering zonder gedeelde posities. Een CJS-bestand in `server/`
// kan een browser niet importeren; als ESM in `shared/` kan iedereen erbij:
// compositie, transport, mock en tests. Eén implementatie, geen transcriptie.
//
// Competitierangschikking (gedeelde spelers krijgen 1,1,3,4 in plaats van
// 1,1,2,3) was een VOORGESTELDE conventie (GR2-standings.md, ontwerpbeslissing
// 1). BEVESTIGD door de producteigenaar op 5 aug 2026: dit is de spelregel,
// en scoreboard, snapshot, eindstand en mock dragen allemaal dezelfde waarde.
//
// Geen enkele functie hier raakt Redis, sockets, bestanden of de klok.

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function assertNonNegativeInteger(value, fieldName) {
  if (typeof value !== 'number') {
    throw new TypeError(`${fieldName} must be a number, got: ${typeof value}`);
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} must be a non-negative integer, got: ${value}`);
  }
}

/**
 * Werpt TypeError/RangeError als player niet voldoet aan: id is een
 * niet-lege string; score, correctCount en correctResponseTimeMsTotal zijn
 * niet-negatieve integers.
 * @param {object} player
 */
function assertValidPlayerForRanking(player) {
  if (typeof player !== 'object' || player === null) {
    throw new TypeError(`player must be an object, got: ${player === null ? 'null' : typeof player}`);
  }

  if (typeof player.id !== 'string') {
    throw new TypeError(`player.id must be a string, got: ${typeof player.id}`);
  }
  if (player.id.length === 0) {
    throw new RangeError('player.id must be a non-empty string');
  }

  assertNonNegativeInteger(player.score, 'player.score');
  assertNonNegativeInteger(player.correctCount, 'player.correctCount');
  assertNonNegativeInteger(player.correctResponseTimeMsTotal, 'player.correctResponseTimeMsTotal');
}

/**
 * Valideert een hele lijst in één keer, vóór sortering: elk record via
 * assertValidPlayerForRanking, plus uniciteit van id over de lijst. Werpt bij
 * de eerste schending.
 * @param {Array<object>} players
 */
function assertValidPlayerList(players) {
  if (!Array.isArray(players)) {
    throw new TypeError(`players must be an array, got: ${typeof players}`);
  }

  const seenIds = new Set();
  for (const player of players) {
    assertValidPlayerForRanking(player);
    if (seenIds.has(player.id)) {
      throw new RangeError(`Duplicate player id in list: ${player.id}`);
    }
    seenIds.add(player.id);
  }
}

/**
 * Vergelijkt twee spelers voor ranking (score desc, correctCount desc,
 * correctResponseTimeMsTotal asc). 0 bij volledige gelijkstand — bepaalt GEEN
 * lijstvolgorde, zie rankPlayers() voor de presentatie-tiebreak op id.
 * Werpt via assertValidPlayerForRanking bij een ongeldig record.
 * @param {{ id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number }} a
 * @param {{ id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number }} b
 * @returns {number}
 */
function compareForRanking(a, b) {
  assertValidPlayerForRanking(a);
  assertValidPlayerForRanking(b);

  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.correctCount !== b.correctCount) {
    return b.correctCount - a.correctCount;
  }
  if (a.correctResponseTimeMsTotal !== b.correctResponseTimeMsTotal) {
    return a.correctResponseTimeMsTotal - b.correctResponseTimeMsTotal;
  }
  return 0;
}

/**
 * Sorteert spelers en kent een 1-indexed `position` toe volgens
 * competitierangschikking (VOORGESTELD, zie ontwerpbeslissing 1). Gelijke
 * spelers delen `position`; hun onderlinge volgorde in de teruggegeven array
 * is deterministisch via `id` oplopend (presentatie, geen ranginformatie).
 * Valideert de volledige lijst vóór sortering. Muteert `players` niet.
 * @param {Array<{ id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number }>} players
 * @returns {Array<{ id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number, position: number }>}
 */
function rankPlayers(players) {
  assertValidPlayerList(players);

  // Kopieer eerst (spread per speler) zodat sort() en de position-toewijzing
  // hieronder nooit de input-objects of -array aanraken.
  const sorted = players.map((player) => ({ ...player }));
  sorted.sort((a, b) => {
    const cmp = compareForRanking(a, b);
    if (cmp !== 0) {
      return cmp;
    }
    // Presentatie-tiebreak (ontwerpbeslissing 3): wijst geen winnaar aan en
    // heft de gedeelde position hieronder niet op.
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  let currentPosition = 1;
  sorted.forEach((player, index) => {
    if (index > 0 && compareForRanking(sorted[index - 1], player) !== 0) {
      currentPosition = index + 1;
    }
    player.position = currentPosition;
  });

  return sorted;
}

// Alleen compareForRanking en rankPlayers doen iets naast valideren; de twee
// assert-helpers blijven intern (zie GR2-standings.md).
export { compareForRanking, rankPlayers };
