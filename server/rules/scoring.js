'use strict';

// Puntentelling voor quizrondes. Zie docs/multiplayer/GAME-RULES.md ("Puntentelling")
// en docs/game-rules-plan/prompts/GR1-scoring.md voor de volledige spec.
//
// Geen enkele functie hier raakt Redis, sockets, bestanden of de klok: alle
// tijden komen binnen als parameter (ms, zelfde tijdlijn/epoch als de caller).

const MAX_DEADLINE_GRACE_MS = 250;

/**
 * Werpt RangeError als deadlineGraceMs geen eindig getal in [0, 250] is.
 * @param {number} deadlineGraceMs
 */
function assertValidGrace(deadlineGraceMs) {
  if (
    typeof deadlineGraceMs !== 'number' ||
    !Number.isFinite(deadlineGraceMs) ||
    deadlineGraceMs < 0 ||
    deadlineGraceMs > MAX_DEADLINE_GRACE_MS
  ) {
    throw new RangeError(
      `deadlineGraceMs must be a finite number in [0, ${MAX_DEADLINE_GRACE_MS}], got: ${deadlineGraceMs}`
    );
  }
}

/**
 * Bepaalt of een antwoord nog geaccepteerd wordt. Werpt RangeError bij een
 * ongeldige deadlineGraceMs of niet-eindige receivedAt/endsAt.
 * @param {{ receivedAt: number, endsAt: number, deadlineGraceMs: number }} p
 * @returns {boolean}
 */
function isAnswerAcceptable({ receivedAt, endsAt, deadlineGraceMs }) {
  assertValidGrace(deadlineGraceMs);
  if (!Number.isFinite(receivedAt) || !Number.isFinite(endsAt)) {
    throw new RangeError(
      `receivedAt and endsAt must be finite numbers, got receivedAt=${receivedAt}, endsAt=${endsAt}`
    );
  }
  return receivedAt <= endsAt + deadlineGraceMs;
}

/**
 * Berekent bonus en punten. PRECONDITIE: alleen aanroepen met een antwoord
 * waarvoor isAnswerAcceptable() al true retourneerde — roep in servercode niet
 * rechtstreeks aan, gebruik scoreAnswer(). Werpt RangeError bij
 * endsAt <= startsAt, of bij correct=true zonder eindige receivedAt.
 * @param {{
 *   correct: boolean,
 *   receivedAt: number | undefined,
 *   startsAt: number,
 *   endsAt: number,
 *   speedBonusEnabled: boolean,
 * }} p
 * @returns {{ bonus: number, points: number }}
 */
function computeScore({ correct, receivedAt, startsAt, endsAt, speedBonusEnabled }) {
  // Structurele configuratiefout: een ongeldig tijdvenster moet altijd
  // zichtbaar breken, ongeacht of dit antwoord correct is (zelfde principe
  // als assertValidGrace: niet stil clampen/negeren).
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    throw new RangeError(
      `endsAt must be a finite number greater than startsAt, got startsAt=${startsAt}, endsAt=${endsAt}`
    );
  }

  // correct: false (of onbeantwoord) kortsluit vóór elke tijdberekening op
  // receivedAt, zodat een ontbrekende receivedAt nooit een NaN-bonus geeft.
  if (!correct) {
    return { bonus: 0, points: 0 };
  }

  if (!Number.isFinite(receivedAt)) {
    throw new RangeError(
      `correct=true requires a finite receivedAt (caller error), got: ${receivedAt}`
    );
  }

  if (!speedBonusEnabled) {
    return { bonus: 0, points: 100 };
  }

  const questionDuration = endsAt - startsAt;
  const remainingFraction = clamp((endsAt - receivedAt) / questionDuration, 0, 1);
  const bonus = Math.round(100 * remainingFraction);
  return { bonus, points: 100 + bonus };
}

/**
 * Aanbevolen ingang voor servercode: combineert acceptatie en score zodat een
 * te laat antwoord nooit basispunten kan opleveren, ongeacht wat de aanroeper
 * als `correct` doorgeeft.
 * @param {{
 *   correct: boolean,
 *   receivedAt: number,
 *   startsAt: number,
 *   endsAt: number,
 *   deadlineGraceMs: number,
 *   speedBonusEnabled: boolean,
 * }} p
 * @returns {{ accepted: boolean, bonus: number, points: number }}
 */
function scoreAnswer({ correct, receivedAt, startsAt, endsAt, deadlineGraceMs, speedBonusEnabled }) {
  const accepted = isAnswerAcceptable({ receivedAt, endsAt, deadlineGraceMs });
  if (!accepted) {
    return { accepted: false, bonus: 0, points: 0 };
  }
  const { bonus, points } = computeScore({ correct, receivedAt, startsAt, endsAt, speedBonusEnabled });
  return { accepted: true, bonus, points };
}

/**
 * Telt de responstijd van een correct antwoord op bij het lopende totaal.
 * Incorrecte of niet-gegeven antwoorden veranderen het totaal niet. Werpt
 * RangeError bij een niet-eindig/negatief currentTotalMs (altijd gecontroleerd,
 * zelfde structurele-state-principe als computeScore's endsAt/startsAt-check),
 * of bij een niet-eindig/negatief responseTimeMs wanneer correct=true.
 * @param {number} currentTotalMs
 * @param {{ correct: boolean, responseTimeMs: number }} answer
 * @returns {number}
 */
function accumulateCorrectResponseTime(currentTotalMs, { correct, responseTimeMs }) {
  if (!Number.isFinite(currentTotalMs) || currentTotalMs < 0) {
    throw new RangeError(
      `currentTotalMs must be a finite, non-negative number, got: ${currentTotalMs}`
    );
  }
  if (!correct) {
    return currentTotalMs;
  }
  if (!Number.isFinite(responseTimeMs) || responseTimeMs < 0) {
    throw new RangeError(
      `responseTimeMs must be a finite, non-negative number when correct is true, got: ${responseTimeMs}`
    );
  }
  return currentTotalMs + responseTimeMs;
}

/** @returns {number} value geklemd tussen min en max. */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Servercode buiten deze module hoort uitsluitend scoreAnswer() aan te roepen.
// isAnswerAcceptable en computeScore zijn alleen geëxporteerd voor gerichte
// unit tests (zie scoring.test.js) en voor gebruik door scoreAnswer() zelf.
module.exports = {
  isAnswerAcceptable,
  computeScore,
  scoreAnswer,
  accumulateCorrectResponseTime,
};
