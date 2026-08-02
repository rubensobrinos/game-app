'use strict';

// Faseovergangen van één match. Zie docs/architecture-plan/prompts/AR0-AR1-state-machine.md
// (secties "Toegestane overgangen", "Pauzeren", "Hervatten", "Beëindigen",
// "Invarianten") en docs/multiplayer/ARCHITECTURE.md ("State machine") voor de
// volledige spec.
//
// Pure reducer: geen Redis, sockets, HTTP, filesystem, timers of klok. `now`
// komt altijd als expliciet argument binnen (epoch-ms, zelfde tijdlijn als de
// aanroeper), zodat de functie deterministisch testbaar blijft.
//
// `pacing` is bewust een LOS argument en geen onderdeel van MatchState: het
// hoort bij Room.config/GameConfiguration, niet bij Match (DATA-MODEL.md).
//
// Afwijking t.o.v. server/rules/scoring.js: deze module werpt nooit op DATA. Een
// ongeldige transitie levert altijd een resultaatobject { ok: false, code } op,
// zoals de spec voor deze module eist. Let op: een property-getter die zelf
// werpt (vijandige input) propageert wel naar buiten; de aanroeper levert platte,
// schema-gevalideerde payloads aan, dus dat pad is geen onderdeel van het contract.
//
// AANNAMES VAN DE AANROEPER — deze module beslist ze bewust niet zelf:
//
// 1. `reason` is hier VERPLICHT bij HOST_PAUSE, terwijl PROTOCOL.md `game:pause`
//    definieert als `{ reason?: string }`. De protocol-adapter (AR5/AR6) vult een
//    ontbrekende reden in vóór de aanroep — de reducer verzint geen
//    protocol-defaults. Verandert die keuze, dan hoort hij in PROTOCOL.md thuis,
//    niet hier.
// 2. Host-tempo: bij `pacing: "host"` vereist deze module een HOST_NEXT ná
//    ROUND_RESULT én ná SCOREBOARD, dus twee bevestigingen per ronde wanneer de
//    tussenstand elke ronde wordt getoond. GAME-RULES.md ("wacht na de uitslag of
//    de tussenstand") laat ook de lezing toe dat de uitslag op zijn timer
//    doorloopt. OPEN VRAAG voor de GAME-RULES.md-eigenaar; de strenge lezing is
//    hier gekozen omdat ze de andere niet uitsluit — één tik per ronde vereist
//    alleen dat ROUND_RESULT bij host-tempo óók TIMER_ELAPSED gaat accepteren.

/**
 * @typedef {{
 *   phase: "LOBBY" | "COUNTDOWN" | "ROUND_ACTIVE" | "ROUND_RESULT" |
 *          "SCOREBOARD" | "PAUSED" | "FINISHED",
 *   pausedState: null | {
 *     previousPhase: string,
 *     remainingMs: number,
 *     reason: string,
 *     pausedAt: number,
 *   },
 * }} MatchState
 */

/**
 * @typedef {
 *   | { type: "HOST_START" }
 *   | { type: "TIMER_ELAPSED", nextPhase: string }
 *   | { type: "HOST_NEXT", nextPhase: string }
 *   | { type: "HOST_PAUSE", reason: string, remainingMs: number }
 *   | { type: "HOST_RESUME", nextPhase: string }
 *   | { type: "HOST_FINISH" }
 * } Event
 */

/** Exacte fasewaarden uit ARCHITECTURE.md. */
const PHASES = Object.freeze({
  LOBBY: 'LOBBY',
  COUNTDOWN: 'COUNTDOWN',
  ROUND_ACTIVE: 'ROUND_ACTIVE',
  ROUND_RESULT: 'ROUND_RESULT',
  SCOREBOARD: 'SCOREBOARD',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
});

/** Het volledige toegestane event-alfabet; elk ander type is UNSUPPORTED_EVENT. */
const EVENT_TYPES = Object.freeze({
  HOST_START: 'HOST_START',
  TIMER_ELAPSED: 'TIMER_ELAPSED',
  HOST_NEXT: 'HOST_NEXT',
  HOST_PAUSE: 'HOST_PAUSE',
  HOST_RESUME: 'HOST_RESUME',
  HOST_FINISH: 'HOST_FINISH',
});

// Codes die letterlijk in PROTOCOL.md ("Foutcodes") staan en dus ongewijzigd naar
// de wire mogen: de client heeft er een vertaling voor.
const PROTOCOL_ERROR_CODES = Object.freeze({
  UNSUPPORTED_EVENT: 'UNSUPPORTED_EVENT',
  INVALID_PHASE: 'INVALID_PHASE',
});

// Codes die deze module zelf introduceert en die NOG NIET in PROTOCOL.md staan.
// De client kan ze niet vertalen, dus de protocol-adapter (AR5/AR6) mag ze niet
// ongefilterd doorsturen zolang dat zo is. OPEN VERZOEK aan de PROTOCOL.md-
// eigenaar: `INVALID_PAUSE_STATE` toevoegen aan de foutcodelijst, of aangeven dat
// payloadfouten onder `INVALID_PHASE` moeten vallen. Zie
// docs/architecture-plan/README.md, "Openstaande besluiten".
const INTERNAL_ERROR_CODES = Object.freeze({
  INVALID_PAUSE_STATE: 'INVALID_PAUSE_STATE',
});

/** De enige codes die deze module kan retourneren. */
const ERROR_CODES = Object.freeze({
  ...PROTOCOL_ERROR_CODES,
  ...INTERNAL_ERROR_CODES,
});

const PACING = Object.freeze({ AUTO: 'auto', HOST: 'host' });

// Overgangstabel als data: bronfase → event → { pacing, targets }.
// `pacing: null` betekent "geldig bij zowel auto als host" (COUNTDOWN en
// ROUND_ACTIVE zijn altijd timer-gedreven, ongeacht pacing). Alleen de
// uitslag- en tussenstandfasen zijn host-tempo gevoelig.
//
// De reducer VALIDEERT hier alleen lidmaatschap van `targets`; hij KIEST de
// bestemming niet. Kennis van roundIndex/totalRounds/scoreboardFrequency zit
// bewust bij de aanroeper, niet hier.
const TRANSITIONS = Object.freeze({
  [PHASES.LOBBY]: Object.freeze({
    [EVENT_TYPES.HOST_START]: Object.freeze({
      pacing: null,
      targets: Object.freeze([PHASES.COUNTDOWN]),
    }),
  }),
  [PHASES.COUNTDOWN]: Object.freeze({
    [EVENT_TYPES.TIMER_ELAPSED]: Object.freeze({
      pacing: null,
      targets: Object.freeze([PHASES.ROUND_ACTIVE]),
    }),
  }),
  [PHASES.ROUND_ACTIVE]: Object.freeze({
    [EVENT_TYPES.TIMER_ELAPSED]: Object.freeze({
      pacing: null,
      targets: Object.freeze([PHASES.ROUND_RESULT]),
    }),
  }),
  [PHASES.ROUND_RESULT]: Object.freeze({
    [EVENT_TYPES.TIMER_ELAPSED]: Object.freeze({
      pacing: PACING.AUTO,
      targets: Object.freeze([
        PHASES.SCOREBOARD,
        PHASES.COUNTDOWN,
        PHASES.ROUND_ACTIVE,
        PHASES.FINISHED,
      ]),
    }),
    [EVENT_TYPES.HOST_NEXT]: Object.freeze({
      pacing: PACING.HOST,
      targets: Object.freeze([
        PHASES.SCOREBOARD,
        PHASES.COUNTDOWN,
        PHASES.ROUND_ACTIVE,
        PHASES.FINISHED,
      ]),
    }),
  }),
  [PHASES.SCOREBOARD]: Object.freeze({
    [EVENT_TYPES.TIMER_ELAPSED]: Object.freeze({
      pacing: PACING.AUTO,
      targets: Object.freeze([PHASES.COUNTDOWN, PHASES.ROUND_ACTIVE, PHASES.FINISHED]),
    }),
    [EVENT_TYPES.HOST_NEXT]: Object.freeze({
      pacing: PACING.HOST,
      targets: Object.freeze([PHASES.COUNTDOWN, PHASES.ROUND_ACTIVE, PHASES.FINISHED]),
    }),
  }),
});

/** Fasen waaruit HOST_PAUSE is toegestaan (niet LOBBY, PAUSED of FINISHED). */
const PAUSABLE_PHASES = Object.freeze([
  PHASES.COUNTDOWN,
  PHASES.ROUND_ACTIVE,
  PHASES.ROUND_RESULT,
  PHASES.SCOREBOARD,
]);

/** Toegestane nextPhase-waarden bij HOST_RESUME (nooit LOBBY/PAUSED/FINISHED). */
const RESUMABLE_PHASES = Object.freeze([
  PHASES.COUNTDOWN,
  PHASES.ROUND_ACTIVE,
  PHASES.ROUND_RESULT,
  PHASES.SCOREBOARD,
]);

/**
 * Enige publieke ingang: valideert de overgang en levert een nieuwe MatchState.
 * Werpt nooit — elke afwijzing komt terug als { ok: false, code }.
 * @param {MatchState} state - wordt nooit gemuteerd
 * @param {Event} event
 * @param {"auto" | "host"} pacing - projectie van Room.config.pacing
 * @param {number} now - epoch-ms, altijd door de aanroeper geleverd
 * @returns {{ ok: true, state: MatchState } | { ok: false, code: string }}
 */
function transition(state, event, pacing, now) {
  // Het event-alfabet is de buitenste poort: een onbekend type is altijd
  // UNSUPPORTED_EVENT, ook als de bronfase daarnaast ongeldig zou zijn.
  const type = readEventType(event);
  if (type === null) {
    return reject(ERROR_CODES.UNSUPPORTED_EVENT);
  }

  const phase = readPhase(state);
  if (phase === null) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }

  // pacing hoort bij hetzelfde alfabet als phase en type: hier centraal
  // valideren, zodat een foute projectie van Room.config.pacing meteen opvalt
  // en niet pas bij de eerste pacing-gevoelige overgang.
  if (!isValidPacing(pacing)) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }

  switch (type) {
    case EVENT_TYPES.HOST_PAUSE:
      return applyPause(phase, event, now);
    case EVENT_TYPES.HOST_RESUME:
      return applyResume(phase, event);
    case EVENT_TYPES.HOST_FINISH:
      return applyFinish(phase);
    default:
      // HOST_START, TIMER_ELAPSED en HOST_NEXT lopen allemaal via de tabel.
      return applyTableTransition(phase, type, event, pacing);
  }
}

/**
 * Voortgangsevents: bronfase/event moeten in de tabel staan, de pacing moet
 * kloppen en de aangeleverde nextPhase moet in `targets` zitten.
 * @param {string} phase
 * @param {string} type
 * @param {Event} event
 * @param {"auto" | "host"} pacing
 * @returns {{ ok: true, state: MatchState } | { ok: false, code: string }}
 */
function applyTableTransition(phase, type, event, pacing) {
  const row = TRANSITIONS[phase] === undefined ? undefined : TRANSITIONS[phase][type];
  if (row === undefined) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }

  // pacing telt alleen mee waar de tabel onderscheid maakt: TIMER_ELAPSED
  // vanuit ROUND_RESULT/SCOREBOARD vereist "auto", HOST_NEXT vereist "host".
  if (row.pacing !== null && pacing !== row.pacing) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }

  // HOST_START draagt volgens de event-union geen nextPhase; dan geldt de
  // enige toegestane bestemming. Wordt er tóch een nextPhase meegegeven, dan
  // wordt die net als bij de andere events tegen de tabel gevalideerd.
  const requested =
    type === EVENT_TYPES.HOST_START && event.nextPhase === undefined
      ? row.targets[0]
      : event.nextPhase;

  if (!row.targets.includes(requested)) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }

  return accept(requested);
}

/**
 * HOST_PAUSE: eerst de bronfase, daarna de payload. Zo blijft een pauze vanuit
 * LOBBY/PAUSED/FINISHED een INVALID_PHASE, ook bij een onzinnige remainingMs.
 * @param {string} phase
 * @param {Event} event
 * @param {number} now
 * @returns {{ ok: true, state: MatchState } | { ok: false, code: string }}
 */
function applyPause(phase, event, now) {
  if (!PAUSABLE_PHASES.includes(phase)) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }

  // Elke payload-property EXACT ÉÉN KEER lezen vóór de validatie en daarna
  // alleen de local gebruiken: bij een tweede `event.x` kan een getter een
  // andere, ONGEVALIDEERDE waarde teruggeven en die de state in duwen.
  const remainingMs = event.remainingMs;
  const reason = event.reason;

  if (!isValidRemainingMs(remainingMs)) {
    return reject(ERROR_CODES.INVALID_PAUSE_STATE);
  }
  if (!isValidReason(reason)) {
    return reject(ERROR_CODES.INVALID_PAUSE_STATE);
  }
  // pausedAt moet aan de typedef voldoen (epoch-ms getal, DATA-MODEL.md).
  // Alleen hier valideren: dit is het enige pad dat `now` gebruikt.
  if (!isValidNow(now)) {
    return reject(ERROR_CODES.INVALID_PAUSE_STATE);
  }

  return {
    ok: true,
    state: {
      phase: PHASES.PAUSED,
      pausedState: {
        previousPhase: phase,
        remainingMs,
        reason,
        pausedAt: now,
      },
    },
  };
}

/**
 * HOST_RESUME: alleen vanuit PAUSED. De reducer controleert uitsluitend of
 * nextPhase in RESUMABLE_PHASES zit, niet of die gelijk is aan
 * pausedState.previousPhase — dat onderscheid (handmatige pauze vs. herstel na
 * serverrestart) is een bewuste keuze van de aanroeper.
 * @param {string} phase
 * @param {Event} event
 * @returns {{ ok: true, state: MatchState } | { ok: false, code: string }}
 */
function applyResume(phase, event) {
  if (phase !== PHASES.PAUSED) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }
  // Eén lezing vóór de validatie: valideren en gebruiken moeten over dezelfde
  // waarde gaan. Bij twee lezingen kan een getter de tweede keer een
  // ONGEVALIDEERDE fase teruggeven ('PAUSED', of iets buiten het domein).
  const requested = event.nextPhase;
  if (!RESUMABLE_PHASES.includes(requested)) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }
  return accept(requested);
}

/**
 * HOST_FINISH: geldig vanuit elke fase behalve FINISHED, inclusief PAUSED.
 * pausedState wordt daarbij altijd null (invariant 1).
 * @param {string} phase
 * @returns {{ ok: true, state: MatchState } | { ok: false, code: string }}
 */
function applyFinish(phase) {
  if (phase === PHASES.FINISHED) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }
  return accept(PHASES.FINISHED);
}

/**
 * Leest het event-type als het in het alfabet zit; anders null. Een ontbrekend
 * of niet-object event telt als onbekend type (nooit een throw).
 * @param {unknown} event
 * @returns {string | null}
 */
function readEventType(event) {
  if (event === null || typeof event !== 'object') {
    return null;
  }
  const type = /** @type {{ type?: unknown }} */ (event).type;
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(EVENT_TYPES, type)) {
    return null;
  }
  return EVENT_TYPES[type];
}

/**
 * Leest de bronfase als die een bekende fase is; anders null (→ INVALID_PHASE).
 * @param {unknown} state
 * @returns {string | null}
 */
function readPhase(state) {
  if (state === null || typeof state !== 'object') {
    return null;
  }
  const phase = /** @type {{ phase?: unknown }} */ (state).phase;
  if (typeof phase !== 'string' || !Object.prototype.hasOwnProperty.call(PHASES, phase)) {
    return null;
  }
  return PHASES[phase];
}

/**
 * remainingMs moet een eindig, niet-negatief getal zijn: NaN, Infinity,
 * negatieve waarden en niet-numerieke types worden afgewezen.
 * @param {unknown} remainingMs
 * @returns {boolean}
 */
function isValidRemainingMs(remainingMs) {
  return typeof remainingMs === 'number' && Number.isFinite(remainingMs) && remainingMs >= 0;
}

/**
 * now gaat ongewijzigd als pausedAt (epoch-ms) de state in en is daarom net zo
 * streng als remainingMs: een eindig, niet-negatief getal.
 * @param {unknown} now
 * @returns {boolean}
 */
function isValidNow(now) {
  return typeof now === 'number' && Number.isFinite(now) && now >= 0;
}

/**
 * pacing kent maar twee waarden; al het andere is een projectiefout.
 * @param {unknown} pacing
 * @returns {boolean}
 */
function isValidPacing(pacing) {
  return pacing === PACING.AUTO || pacing === PACING.HOST;
}

/**
 * reason moet een niet-lege string zijn (alleen witruimte telt als leeg).
 * @param {unknown} reason
 * @returns {boolean}
 */
function isValidReason(reason) {
  return typeof reason === 'string' && reason.trim() !== '';
}

/**
 * Bouwt een succesresultaat. Altijd een NIEUW state-object; pausedState is hier
 * per definitie null, want alleen applyPause() maakt een gevulde pausedState.
 * @param {string} phase
 * @returns {{ ok: true, state: MatchState }}
 */
function accept(phase) {
  return { ok: true, state: { phase, pausedState: null } };
}

/**
 * Bouwt een afwijzing. Raakt de meegegeven state niet aan en werpt nooit.
 * @param {string} code
 * @returns {{ ok: false, code: string }}
 */
function reject(code) {
  return { ok: false, code };
}

module.exports = {
  transition,
  PHASES,
  EVENT_TYPES,
  ERROR_CODES,
  PROTOCOL_ERROR_CODES,
  INTERNAL_ERROR_CODES,
};
