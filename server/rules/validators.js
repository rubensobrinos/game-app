'use strict';

// Spelvormvalidators voor Golf 1 (`flags_mc`, `capitals_mc`,
// `real_or_fake_flag`, `higher_lower`, `odd_one_out`). Zie
// docs/multiplayer/GAME-RULES.md ("Spelvormen") en
// docs/game-rules-plan/prompts/GR3-validators.md voor de volledige spec.
//
// Twee categorieën input, twee foutstrategieën (ontwerpbeslissing 1 in de
// spec):
// - `answer` (client, onvertrouwd): elke waarde is toegestane invoer — ook
//   `null`, een array, een primitive, of een object met verkeerde/extra/
//   ontbrekende velden. Malformed geeft altijd deterministisch
//   { valid: false, correct: false }, nooit een throw.
// - `correctAnswer` / `validOptionIds` / `optionCount` (servercontext,
//   vertrouwd maar intern-consistent-verplicht): een geschonden invariant
//   werpt RangeError. Dit representeert een kapotte ronde — dat moet luid
//   falen, niet stilzwijgend als "gewoon een foutief antwoord" verdwijnen.
//
// Geen enkele functie hier raadpleegt content-data (data/), Redis, sockets of
// de klok.

/**
 * Interne helper. Retourneert answer[key] als answer een plain object is met
 * precies één eigen, enumerable property genaamd `key`; anders null. Gooit
 * nooit — answer is onvertrouwde clientinput.
 * @param {unknown} answer
 * @param {string} key
 * @returns {unknown | null}
 */
function extractClientField(answer, key) {
  // answer moet een plain object zijn: geen null, array, class-instance of
  // primitive. De Object.prototype-check sluit arrays en class-instances uit
  // (hun prototype is nooit Object.prototype); de typeof/null-checks sluiten
  // primitives en null uit vóórdat we ooit aan destructuring/property-access
  // beginnen.
  if (
    answer === null ||
    typeof answer !== 'object' ||
    Object.getPrototypeOf(answer) !== Object.prototype
  ) {
    return null;
  }
  const ownKeys = Object.keys(answer);
  if (ownKeys.length !== 1 || ownKeys[0] !== key) {
    return null;
  }
  return answer[key];
}

/**
 * Servercontext-invariant voor validateOptionChoice: validOptionIds moet
 * exact 4 unieke, niet-lege strings bevatten. Werpt RangeError bij schending.
 * @param {unknown} validOptionIds
 */
function assertValidOptionIds(validOptionIds) {
  const ok =
    Array.isArray(validOptionIds) &&
    validOptionIds.length === 4 &&
    validOptionIds.every((id) => typeof id === 'string' && id.length > 0) &&
    new Set(validOptionIds).size === 4;
  if (!ok) {
    throw new RangeError(
      `validOptionIds must contain exactly 4 unique, non-empty strings, got: ${JSON.stringify(validOptionIds)}`
    );
  }
}

/**
 * flags_mc + capitals_mc. `answer` gooit nooit. `correctAnswer`/
 * `validOptionIds` zijn servercontext: TypeError/RangeError als
 * validOptionIds geen 4 unieke niet-lege strings zijn, of als
 * correctAnswer.optionId er niet tussen staat.
 * @param {unknown} answer
 * @param {{ optionId: string }} correctAnswer
 * @param {string[]} validOptionIds
 * @returns {{ valid: boolean, correct: boolean }}
 */
function validateOptionChoice(answer, correctAnswer, validOptionIds) {
  assertValidOptionIds(validOptionIds);
  if (
    correctAnswer === null ||
    typeof correctAnswer !== 'object' ||
    typeof correctAnswer.optionId !== 'string' ||
    !validOptionIds.includes(correctAnswer.optionId)
  ) {
    throw new RangeError(
      `correctAnswer.optionId must be one of validOptionIds, got correctAnswer=${JSON.stringify(correctAnswer)}, validOptionIds=${JSON.stringify(validOptionIds)}`
    );
  }

  const optionId = extractClientField(answer, 'optionId');
  if (typeof optionId !== 'string' || !validOptionIds.includes(optionId)) {
    return { valid: false, correct: false };
  }
  return { valid: true, correct: optionId === correctAnswer.optionId };
}

/**
 * real_or_fake_flag. correctAnswer.choice buiten {"real","fake"} -> throw.
 * @param {unknown} answer
 * @param {{ choice: "real" | "fake" }} correctAnswer
 * @returns {{ valid: boolean, correct: boolean }}
 */
function validateBinaryChoice(answer, correctAnswer) {
  if (
    correctAnswer === null ||
    typeof correctAnswer !== 'object' ||
    (correctAnswer.choice !== 'real' && correctAnswer.choice !== 'fake')
  ) {
    throw new RangeError(`correctAnswer.choice must be "real" or "fake", got: ${JSON.stringify(correctAnswer)}`);
  }

  const choice = extractClientField(answer, 'choice');
  if (choice !== 'real' && choice !== 'fake') {
    return { valid: false, correct: false };
  }
  return { valid: true, correct: choice === correctAnswer.choice };
}

/**
 * higher_lower. correctAnswer.side buiten {0,1} -> throw.
 * @param {unknown} answer
 * @param {{ side: 0 | 1 }} correctAnswer
 * @returns {{ valid: boolean, correct: boolean }}
 */
function validateHigherLowerChoice(answer, correctAnswer) {
  if (
    correctAnswer === null ||
    typeof correctAnswer !== 'object' ||
    (correctAnswer.side !== 0 && correctAnswer.side !== 1)
  ) {
    throw new RangeError(`correctAnswer.side must be 0 or 1, got: ${JSON.stringify(correctAnswer)}`);
  }

  const side = extractClientField(answer, 'side');
  if (side !== 0 && side !== 1) {
    return { valid: false, correct: false };
  }
  return { valid: true, correct: side === correctAnswer.side };
}

/**
 * odd_one_out. optionCount !== 4 (Golf-1-invariant), of
 * correctAnswer.cardIndex buiten [0, optionCount) -> throw.
 * @param {unknown} answer
 * @param {{ cardIndex: number }} correctAnswer
 * @param {number} optionCount
 * @returns {{ valid: boolean, correct: boolean }}
 */
function validateOddOneOutChoice(answer, correctAnswer, optionCount) {
  if (optionCount !== 4) {
    throw new RangeError(`optionCount must be exactly 4 for odd_one_out (Golf 1 invariant), got: ${optionCount}`);
  }
  if (
    correctAnswer === null ||
    typeof correctAnswer !== 'object' ||
    !Number.isInteger(correctAnswer.cardIndex) ||
    correctAnswer.cardIndex < 0 ||
    correctAnswer.cardIndex >= optionCount
  ) {
    throw new RangeError(
      `correctAnswer.cardIndex must be an integer in [0, ${optionCount}), got: ${JSON.stringify(correctAnswer)}`
    );
  }

  const cardIndex = extractClientField(answer, 'cardIndex');
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= optionCount) {
    return { valid: false, correct: false };
  }
  return { valid: true, correct: cardIndex === correctAnswer.cardIndex };
}

/**
 * Enige publieke functie. Dispatcht naar de juiste validator op basis van
 * gameType. Werpt RangeError bij een onbekende/niet-Golf-1 gameType.
 * @param {"flags_mc"|"capitals_mc"|"real_or_fake_flag"|"higher_lower"|"odd_one_out"} gameType
 * @param {unknown} answer
 * @param {object} correctAnswer
 * @param {{ validOptionIds?: string[], optionCount?: number }} roundContext
 * @returns {{ valid: boolean, correct: boolean }}
 */
function validateAnswer(gameType, answer, correctAnswer, roundContext = {}) {
  switch (gameType) {
    case 'flags_mc':
    case 'capitals_mc':
      return validateOptionChoice(answer, correctAnswer, roundContext.validOptionIds);
    case 'real_or_fake_flag':
      return validateBinaryChoice(answer, correctAnswer);
    case 'higher_lower':
      return validateHigherLowerChoice(answer, correctAnswer);
    case 'odd_one_out':
      return validateOddOneOutChoice(answer, correctAnswer, roundContext.optionCount);
    default:
      throw new RangeError(`Unknown or non-Golf-1 gameType: ${JSON.stringify(gameType)}`);
  }
}

// Servercode buiten deze module hoort uitsluitend validateAnswer() aan te
// roepen. De vier per-mechanisme-validators zijn module-interne helpers en
// bewust niet geëxporteerd (reviewbevinding 12 in GR3-validators.md): een
// codecomment is geen afdwingbare grens in CommonJS, dus wordt het publieke
// oppervlak zelf klein gehouden.
module.exports = { validateAnswer };
