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

/**
 * De enige `gameType` waarvoor `PROTOCOL.md` een volledig uitgewerkt
 * `question`-voorbeeld geeft (§Voorbeeld `round:started`). Deze module past
 * de strikte multiple-choice-vormcontrole uitsluitend toe wanneer `gameType`
 * exact deze waarde is; elke andere `gameType` krijgt de coulantere,
 * generieke controle (zie Open vraag §10 — niet hier opgelost, want de
 * andere vier spelvormen hebben geen gespecificeerde vraag-payload). Dit is
 * een toepassingskeuze van deze validator (welke `gameType`-waarde de
 * strikte tak activeert), geen taxonomiebeslissing over welke spelvormen
 * "multiple choice" zijn.
 * @type {string}
 */
const MULTIPLE_CHOICE_GAME_TYPE = 'real_or_fake_flag';

/**
 * Valideert `question` tegen de letterlijke multiple-choice-vorm uit het
 * `round:started`-voorbeeld: `promptKey` (niet-lege string), `options`
 * (array van `{ optionId: niet-lege string, labelKey: niet-lege string }`,
 * geen andere sleutels per item), `image` (ondoorzichtig object, niet dieper
 * getoetst) — en geen andere toplevel-sleutels binnen `question` zelf
 * (literaal, Ontwerpkeuze #2).
 * @param {unknown} question
 * @returns {boolean}
 */
function isValidMultipleChoiceQuestion(question) {
  if (!isPlainObject(question)) return false;

  const keys = Object.keys(question);
  const expectedKeys = ['promptKey', 'image', 'options'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return false;
  }

  if (typeof question.promptKey !== 'string' || question.promptKey.length === 0) {
    return false;
  }
  if (!isPlainObject(question.image)) return false;

  if (!Array.isArray(question.options)) return false;
  return question.options.every((option) => {
    if (!isPlainObject(option)) return false;
    const optionKeys = Object.keys(option);
    if (optionKeys.length !== 2 || !optionKeys.includes('optionId') || !optionKeys.includes('labelKey')) {
      return false;
    }
    return (
      typeof option.optionId === 'string' && option.optionId.length > 0 &&
      typeof option.labelKey === 'string' && option.labelKey.length > 0
    );
  });
}

/**
 * Valideert de payload van `round:started` tegen het volledige, letterlijke
 * voorbeeld uit `PROTOCOL.md`. Envelopevelden (`matchId`, `roundId`,
 * `roundNumber`, `totalRounds`, `gameType`, `contentVersion`, `startsAt`,
 * `endsAt`) zijn altijd verplicht en getypeerd, en `endsAt` moet groter dan
 * of gelijk aan `startsAt` zijn (expliciete vormcontrole, geen tijdslogica).
 * Geen andere toplevel-sleutels dan deze acht plus `question` toegestaan
 * (literaal, Ontwerpkeuze #2).
 *
 * `question` wordt alleen strikt gevalideerd tegen de multiple-choice-vorm
 * wanneer `gameType === "real_or_fake_flag"` (de enige `gameType` met een
 * volledig voorbeeld); voor elke andere `gameType` wordt `question`
 * geaccepteerd als niet-leeg object zonder diepere toets (Open vraag §10,
 * hier niet opgelost).
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateRoundStartedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };

  const keys = Object.keys(payload);
  const expectedKeys = [
    'matchId', 'roundId', 'roundNumber', 'totalRounds', 'gameType',
    'contentVersion', 'question', 'startsAt', 'endsAt',
  ];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: null };
  }

  const {
    matchId, roundId, roundNumber, totalRounds, gameType, contentVersion,
    question, startsAt, endsAt,
  } = payload;

  if (typeof matchId !== 'string' || matchId.length === 0) return { ok: false, code: null };
  if (typeof roundId !== 'string' || roundId.length === 0) return { ok: false, code: null };
  if (!Number.isInteger(roundNumber) || roundNumber <= 0) return { ok: false, code: null };
  if (!Number.isInteger(totalRounds) || totalRounds <= 0) return { ok: false, code: null };
  if (typeof gameType !== 'string' || gameType.length === 0) return { ok: false, code: null };
  if (typeof contentVersion !== 'string' || contentVersion.length === 0) {
    return { ok: false, code: null };
  }
  if (typeof startsAt !== 'number' || !Number.isFinite(startsAt)) return { ok: false, code: null };
  if (typeof endsAt !== 'number' || !Number.isFinite(endsAt)) return { ok: false, code: null };
  if (endsAt < startsAt) return { ok: false, code: null };

  if (gameType === MULTIPLE_CHOICE_GAME_TYPE) {
    if (!isValidMultipleChoiceQuestion(question)) return { ok: false, code: null };
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
