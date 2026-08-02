/**
 * @file PR5b — server→client payloadvalidators voor `game:paused`,
 *   `game:resumed`, `round:started` en `round:answer-accepted`.
 * @see docs/multiplayer/PROTOCOL.md — §Server → client events,
 *   §Voorbeeld `round:started`.
 * @see docs/protocol-plan/prompts/PR5-server-events.md — sub-batch PR5b.
 *
 * Pure vorm-validatie, geen I/O, geen inhoud (Uitgangspunt 5). Elke
 * `ok: false` hieronder draagt `code: null` — zie de toelichting bovenaan
 * `./server-events-room-lifecycle.mjs` voor waarom deze module geen
 * PROTOCOL.md-foutcode aan een afgewezen server-eventpayload koppelt.
 */

/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Bekende matchfasen (`ARCHITECTURE.md`), hier uitsluitend gebruikt als
 * platte stringlijst voor `game:paused.previousPhase` — geen
 * state-machine-kennis, geen import van een `architecture-plan`-module.
 * @type {ReadonlySet<string>}
 */
const KNOWN_MATCH_PHASES = new Set([
  'LOBBY', 'COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD', 'PAUSED', 'FINISHED',
]);

/**
 * Valideert de payload van `game:paused`. `reason` is verplicht en moet een
 * string zijn — géén enum-toets op de waarde (Open vraag §2, hier niet
 * opgelost: minstens vier scenario's delen dit veld en zijn client-zijdig
 * niet te onderscheiden, inclusief het serverherstart-geval). `previousPhase`
 * is voorgesteld en moet, indien aanwezig, één van de bekende matchfasen
 * zijn. Voorgesteld veld → coulanter schema (Ontwerpkeuze #2): onbekende
 * extra toplevel-sleutels worden niet afgewezen.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGamePausedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  if (typeof payload.reason !== 'string') {
    return { ok: false, code: null };
  }

  if ('previousPhase' in payload && payload.previousPhase !== undefined) {
    if (!KNOWN_MATCH_PHASES.has(payload.previousPhase)) {
      return { ok: false, code: null };
    }
  }

  return { ok: true };
}

/**
 * Valideert de payload van `game:resumed`. Voorgesteld: minimaal
 * `countdownEndsAt` (eindig epoch-ms getal), naar analogie van
 * `game:started`. Coulanter schema (Ontwerpkeuze #2): onbekende extra
 * toplevel-sleutels worden niet afgewezen.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameResumedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  const { countdownEndsAt } = payload;
  if (typeof countdownEndsAt !== 'number' || !Number.isFinite(countdownEndsAt)) {
    return { ok: false, code: null };
  }

  return { ok: true };
}

/** @param {unknown} value @returns {value is string} niet-lege string. */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/** Metrieken uit `question-selection.js`'s `VALID_METRICS`. @type {ReadonlySet<string>} */
const VALID_HIGHER_LOWER_METRICS = new Set(['population', 'area', 'gdp']);

/**
 * Valideert `question` voor `flags_mc`/`capitals_mc`, tegen de echte
 * `publicQuestionPayload`-vorm die `selectFlagsMcQuestion`/
 * `selectCapitalsMcQuestion` opleveren (`question-selection.js`):
 * `{ targetIso2: niet-lege string, optionIso2s: array van niet-lege
 * strings }`, geen andere toplevel-sleutels. Bevat bewust geen
 * `correctAnswer`/`optionId` (dat blijft `{ optionId }`, nooit in
 * `round:started` — zie de tabel in `PR11-validators-decisions-update.md`).
 * @param {unknown} question
 * @returns {boolean}
 */
function isValidFlagsOrCapitalsMcQuestion(question) {
  if (!isPlainObject(question)) return false;

  const keys = Object.keys(question);
  const expectedKeys = ['targetIso2', 'optionIso2s'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return false;
  }

  if (!isNonEmptyString(question.targetIso2)) return false;
  if (!Array.isArray(question.optionIso2s) || question.optionIso2s.length === 0) return false;
  return question.optionIso2s.every(isNonEmptyString);
}

/**
 * Valideert `question` voor `real_or_fake_flag`, tegen de echte
 * `publicQuestionPayload`-vorm die `selectRealOrFakeFlagQuestion`
 * (`question-selection.js`) oplevert — een discriminated union op `kind`:
 * `{ kind: 'real', iso2 }` of `{ kind: 'generated', seed, rendererVersion,
 * spec }`. `spec` is ondoorzichtig (niet dieper getoetst, per
 * `generateFlagSpec`'s vrije vorm). Elke andere/ontbrekende `kind` wordt
 * afgewezen.
 * @param {unknown} question
 * @returns {boolean}
 */
function isValidRealOrFakeFlagQuestion(question) {
  if (!isPlainObject(question)) return false;

  if (question.kind === 'real') {
    const keys = Object.keys(question);
    const expectedKeys = ['kind', 'iso2'];
    if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
      return false;
    }
    return isNonEmptyString(question.iso2);
  }

  if (question.kind === 'generated') {
    const keys = Object.keys(question);
    const expectedKeys = ['kind', 'seed', 'rendererVersion', 'spec'];
    if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
      return false;
    }
    if (!isNonEmptyString(question.seed)) return false;
    if (!isNonEmptyString(question.rendererVersion)) return false;
    return isPlainObject(question.spec);
  }

  return false;
}

/**
 * Valideert `question` voor `higher_lower`, tegen de echte
 * `publicQuestionPayload`-vorm die `selectHigherLowerQuestion`
 * (`question-selection.js`) oplevert: `{ metric, sides: [{ side, iso2 }] }`
 * met precies 2 `sides` (één `side: 0`, één `side: 1`). Bevat bewust géén
 * `resultDetails.values` (de rauwe metriekwaarden) — dat rules-only veld
 * verraadt het antwoord en mag pas in `round:ended` lekken (zie `PR9`).
 * @param {unknown} question
 * @returns {boolean}
 */
function isValidHigherLowerQuestion(question) {
  if (!isPlainObject(question)) return false;

  const keys = Object.keys(question);
  const expectedKeys = ['metric', 'sides'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return false;
  }

  if (!VALID_HIGHER_LOWER_METRICS.has(question.metric)) return false;
  if (!Array.isArray(question.sides) || question.sides.length !== 2) return false;

  const isValidSide = (side) => {
    if (!isPlainObject(side)) return false;
    const sideKeys = Object.keys(side);
    if (sideKeys.length !== 2 || !sideKeys.includes('side') || !sideKeys.includes('iso2')) {
      return false;
    }
    return (side.side === 0 || side.side === 1) && isNonEmptyString(side.iso2);
  };
  if (!question.sides.every(isValidSide)) return false;

  const sideValues = question.sides.map((side) => side.side).sort();
  return sideValues[0] === 0 && sideValues[1] === 1;
}

/**
 * Valideert `question` voor `odd_one_out`, tegen de echte
 * `publicQuestionPayload`-vorm die `selectOddOneOutQuestion`
 * (`question-selection.js`) oplevert: `{ cards: [{ cardIndex, iso2 }] }` met
 * precies 4 `cards`, `cardIndex` een permutatie van `0..3`. Bevat bewust géén
 * `resultDetails.majorityContinent`/`minorityContinent` — die rules-only
 * velden verraden het antwoord en mogen pas in `round:ended` lekken.
 * @param {unknown} question
 * @returns {boolean}
 */
function isValidOddOneOutQuestion(question) {
  if (!isPlainObject(question)) return false;

  const keys = Object.keys(question);
  if (keys.length !== 1 || keys[0] !== 'cards') return false;
  if (!Array.isArray(question.cards) || question.cards.length !== 4) return false;

  const isValidCard = (card) => {
    if (!isPlainObject(card)) return false;
    const cardKeys = Object.keys(card);
    if (cardKeys.length !== 2 || !cardKeys.includes('cardIndex') || !cardKeys.includes('iso2')) {
      return false;
    }
    return Number.isInteger(card.cardIndex) && card.cardIndex >= 0 && card.cardIndex <= 3 && isNonEmptyString(card.iso2);
  };
  if (!question.cards.every(isValidCard)) return false;

  const cardIndexes = question.cards.map((card) => card.cardIndex).sort();
  return cardIndexes.join(',') === '0,1,2,3';
}

/**
 * Dispatch-tabel `gameType` → strikte `question`-vormvalidator, één per
 * spelvorm uit `question-selection.js`'s `VALID_GAME_TYPES`. Vervangt de vorige aanname dat
 * alleen `real_or_fake_flag` een uitgewerkt voorbeeld had (die vorm
 * (`promptKey`/`image`/`options`) kwam niet overeen met wat
 * `question-selection.js` daadwerkelijk produceert).
 *
 * Elke validator hierboven toetst **structureel** (Herformulering "niet-
 * afleidbaar"-eis, `PR11` punt 9): een strikte allowlist van toegestane
 * sleutels per `gameType` — geen expliciet correctheidsveld (`correctAnswer`,
 * `correctOptionId`, `isCorrect` e.d.) en geen rules-only veld
 * (`resultDetails`, rauwe metriekwaarden, `majorityContinent`/
 * `minorityContinent`) kan hierdoor ongemerkt meeliften, want elke sleutel
 * die niet expliciet op de allowlist staat wordt al afgewezen. Semantische
 * geheimhouding (of de content zelf slim te raden is) blijft een
 * verantwoordelijkheid van de rules-/contentlaag, niet van deze validator.
 * @type {ReadonlyMap<string, (question: unknown) => boolean>}
 */
const QUESTION_VALIDATORS_BY_GAME_TYPE = new Map([
  ['flags_mc', isValidFlagsOrCapitalsMcQuestion],
  ['capitals_mc', isValidFlagsOrCapitalsMcQuestion],
  ['real_or_fake_flag', isValidRealOrFakeFlagQuestion],
  ['higher_lower', isValidHigherLowerQuestion],
  ['odd_one_out', isValidOddOneOutQuestion],
]);

/**
 * Valideert de payload van `round:started`. Envelopevelden (`matchId`,
 * `roundId`, `roundNumber`, `totalRounds`, `gameType`, `contentVersion`,
 * `rendererVersion`, `startsAt`, `endsAt`) zijn altijd verplicht en
 * getypeerd, en `endsAt` moet groter dan of gelijk aan `startsAt` zijn
 * (expliciete vormcontrole, geen tijdslogica). `rendererVersion` is het
 * algemene, canonieke roundveld naast `contentVersion` (`DECISIONS.md` punt
 * 21, `PR9`) — niet te verwarren met het geneste `rendererVersion` binnen
 * `real_or_fake_flag`'s `{ kind: 'generated', ... }`-vorm (open ontwerpvraag
 * over hun onderlinge relatie, zie `PR9-decisions-spec-update.md`; deze
 * validator toetst beide onafhankelijk van elkaar, zonder aan te nemen dat
 * ze gelijk moeten zijn). Geen andere toplevel-sleutels dan deze negen plus
 * `question` toegestaan (literaal, Ontwerpkeuze #2).
 *
 * `question` wordt strikt gevalideerd tegen de echte
 * `publicQuestionPayload`-vorm van `question-selection.js` voor elk van de
 * vijf bekende `gameType`-waarden (zie `QUESTION_VALIDATORS_BY_GAME_TYPE`);
 * voor een onbekende `gameType` wordt `question` coulanter geaccepteerd als
 * niet-leeg object zonder diepere toets.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateRoundStartedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  const keys = Object.keys(payload);
  const expectedKeys = [
    'matchId', 'roundId', 'roundNumber', 'totalRounds', 'gameType',
    'contentVersion', 'rendererVersion', 'question', 'startsAt', 'endsAt',
  ];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: null };
  }

  const {
    matchId, roundId, roundNumber, totalRounds, gameType, contentVersion,
    rendererVersion, question, startsAt, endsAt,
  } = payload;

  if (typeof matchId !== 'string' || matchId.length === 0) return { ok: false, code: null };
  if (typeof roundId !== 'string' || roundId.length === 0) return { ok: false, code: null };
  if (!Number.isInteger(roundNumber) || roundNumber <= 0) return { ok: false, code: null };
  if (!Number.isInteger(totalRounds) || totalRounds <= 0) return { ok: false, code: null };
  if (typeof gameType !== 'string' || gameType.length === 0) return { ok: false, code: null };
  if (typeof contentVersion !== 'string' || contentVersion.length === 0) {
    return { ok: false, code: null };
  }
  if (!isNonEmptyString(rendererVersion)) return { ok: false, code: null };
  if (typeof startsAt !== 'number' || !Number.isFinite(startsAt)) return { ok: false, code: null };
  if (typeof endsAt !== 'number' || !Number.isFinite(endsAt)) return { ok: false, code: null };
  if (endsAt < startsAt) return { ok: false, code: null };

  const questionValidator = QUESTION_VALIDATORS_BY_GAME_TYPE.get(gameType);
  if (questionValidator) {
    if (!questionValidator(question)) return { ok: false, code: null };
  } else if (!isPlainObject(question) || Object.keys(question).length === 0) {
    return { ok: false, code: null };
  }

  return { ok: true };
}

/**
 * Valideert de payload van `round:answer-accepted`. Literaal: `roundId`
 * verplicht, niet-lege string, en geen andere toplevel-sleutels
 * (Ontwerpkeuze #2).
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateRoundAnswerAcceptedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'roundId') {
    return { ok: false, code: null };
  }
  if (typeof payload.roundId !== 'string' || payload.roundId.length === 0) {
    return { ok: false, code: null };
  }

  return { ok: true };
}
