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
// 2. Host-tempo: BESLIST — docs/multiplayer/DECISIONS.md, besluit 1. Host-tempo
//    gebruikt ÉÉN hostactie per ronde: ROUND_RESULT loopt op zijn timer door naar
//    SCOREBOARD, waarna de host "Volgende" kiest. Bij `pacing: "host"` accepteert
//    ROUND_RESULT daarom TIMER_ELAPSED, maar uitsluitend naar SCOREBOARD. Dit
//    vervangt de eerdere strenge lezing (twee bevestigingen per ronde).
//
//    Besluit 1 geldt ONVOORWAARDELIJK: bij host-tempo zit de hostactie ALTIJD bij
//    SCOREBOARD, in élke configuratie. Elke ronde loopt dus via
//    ROUND_RESULT --timer--> SCOREBOARD --HOST_NEXT--> volgende, en kost precies
//    één hostactie. HOST_NEXT vanuit ROUND_RESULT bestaat daarom niet.
//
//    TERUGGEDRAAID — deze module kende hier eerder een als zodanig gemarkeerde
//    INTERPRETATIE: bij een overgeslagen tussenstand zou de hostactie naar
//    ROUND_RESULT verschuiven (HOST_NEXT naar COUNTDOWN/ROUND_ACTIVE/FINISHED).
//    Die tak veroorzaakte een DEADLOCK met client/flow/host-controls-state.mjs,
//    dat de hostactie 'next' uitsluitend bij SCOREBOARD aanbiedt: de server
//    wachtte op een actie die de client nooit stuurt, terwijl de timerovergang
//    geweigerd werd. Zie docs/integration-plan/HANDOFF.md, INT-10. Niet
//    terugzetten.
//
//    NOTITIE VOOR DE EIGENAAR VAN GAME-RULES.md — dit heeft één consequentie die
//    daar thuishoort: `scoreboardFrequency: 'uit'` betekent bij host-tempo "toon
//    geen tussenstand", NIET "sla de fase over". De SCOREBOARD-fase blijft
//    bestaan, want daar doet de host zijn enige actie; wat die fase toont is een
//    presentatiekeuze. Bij auto-tempo verandert er niets: daar mag ROUND_RESULT
//    de tussenstand nog steeds overslaan (TIMER_ELAPSED rechtstreeks naar
//    COUNTDOWN/ROUND_ACTIVE/FINISHED).
//
// 3. HOST_REVEAL — de hostactie van besluit C (5 aug 2026). Staat de
//    configuratie `autoReveal` UIT, dan loopt ROUND_RESULT niet op zijn timer
//    door maar wacht hij op de host. Deze module kent `autoReveal` niet (het
//    zit in GameConfiguration, net als pacing) en accepteert HOST_REVEAL vanuit
//    ROUND_RESULT daarom bij BEIDE tempo's; de aanroeper (match-lifecycle)
//    weigert het event wanneer automatisch tonen aanstaat.
//
//    Dit is NIET de teruggedraaide HOST_NEXT-tak hierboven. Het verschil dat
//    telt is de DEADLOCK die dáár het probleem was: de server wachtte op een
//    actie die de client nooit stuurde. HOST_REVEAL komt tegelijk met zijn
//    knop — `client/flow/host-controls-state.mjs` biedt 'reveal' aan zodra de
//    fase ROUND_RESULT is en automatisch tonen uitstaat — en besluit 1 blijft
//    staan: bij `autoReveal: false` VERHUIST de ene hostactie van SCOREBOARD
//    naar ROUND_RESULT, er komt er geen tweede bij. match-lifecycle regelt dat
//    door de reducer in dat geval 'auto' als pacing te geven, zodat SCOREBOARD
//    gewoon doortikt.
//
// TWEE HERVAT-EVENTS — HOST_RESUME en RECOVERY_RESUME (INT-16)
//
// Deze module kende eerst één hervat-event, waarbij de aanroeper de bestemming
// meeleverde. Het onderscheid tussen een handmatige hervatting en herstel na een
// serverherstart zat daardoor nergens in het alfabet: alleen in de vrije tekst van
// `pausedState.reason`, die deze module niet leest. Zie
// docs/integration-plan/HANDOFF.md, INT-16 ("Twee resume-events in plaats van
// één"); de poortkant van dat item is inmiddels gebouwd (DM19).
//
// De splitsing bestaat om precies één reden — de toegestane bestemming verschilt:
//
//   HOST_RESUME      → COUNTDOWN | ROUND_ACTIVE | ROUND_RESULT | SCOREBOARD.
//                      Een host hervat waar hij gebleven was; welke fase dat is
//                      beslist de aanroeper, niet deze reducer.
//   RECOVERY_RESUME  → UITSLUITEND COUNTDOWN. ARCHITECTURE.md §10
//                      ("Herstelbaarheid") eist dat hervatten na een
//                      game-serverherstart gebeurt "met een nieuwe korte
//                      countdown" — niet door stilletjes meerdere fases over te
//                      slaan en midden in een lopende ronde terug te vallen.
//
// Zou RECOVERY_RESUME overal heen mogen, dan was het een synoniem van HOST_RESUME
// en had een `reason`-veld volstaan. De beperking tot COUNTDOWN IS het event.
//
// Twee dingen dragen die keuze:
//
// - DECISIONS.md besluit 11 kent `server_recovery` al als eigen pauzereden naast
//   `host` / `host_disconnected` / `no_answers`. Het onderscheid bestaat dus al
//   productmatig aan de pauzekant; dit trekt het door naar de hervatkant, zodat
//   een match niet met `reason: 'server_recovery'` gepauzeerd raakt en vervolgens
//   via een pad hervat dat alleen een host mag nemen.
// - Analytics en logs kunnen een herstart-hervatting nu onderscheiden van een
//   hostactie. Voorheen was dat ONMOGELIJK: beide landden als hetzelfde
//   HOST_RESUME in de eventstroom, en de enige aanwijzing (`pausedState.reason`)
//   was op het moment van hervatten al weggegooid — `accept()` zet pausedState op
//   null, dus het event zelf droeg geen spoor van de aanleiding.
//
// HOST_RESUME behoudt exact zijn oude gedrag; bestaande aanroepers breken niet.
// Beide events zijn alleen geldig vanuit PAUSED en zetten `pausedState` op null
// (invariant 1).

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
 *   | { type: "HOST_REVEAL", nextPhase: string }
 *   | { type: "HOST_PAUSE", reason: string, remainingMs: number }
 *   | { type: "HOST_RESUME", nextPhase: string }
 *   | { type: "RECOVERY_RESUME", nextPhase: "COUNTDOWN" }
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
  HOST_REVEAL: 'HOST_REVEAL',
  HOST_PAUSE: 'HOST_PAUSE',
  HOST_RESUME: 'HOST_RESUME',
  RECOVERY_RESUME: 'RECOVERY_RESUME',
  HOST_FINISH: 'HOST_FINISH',
});

// Codes die letterlijk in PROTOCOL.md ("Foutcodes") staan en dus ongewijzigd naar
// de wire mogen: de client heeft er een vertaling voor.
const PROTOCOL_ERROR_CODES = Object.freeze({
  UNSUPPORTED_EVENT: 'UNSUPPORTED_EVENT',
  INVALID_PHASE: 'INVALID_PHASE',
});

// Codes die deze module zelf introduceert en die BEWUST niet in PROTOCOL.md staan.
// docs/multiplayer/DECISIONS.md besluit 12: `INVALID_PAUSE_STATE` blijft intern en
// wordt niet als wire-foutcode gepubliceerd. De client heeft er dus geen vertaling
// voor. De protocol-adapter (AR5/AR6) MOET deze codes daarom afvangen en op een
// gepubliceerde code afbeelden voordat er iets naar een client gaat — nooit
// ongefilterd doorsturen. Dit is geen open punt meer; het is een vaste eis.
const INTERNAL_ERROR_CODES = Object.freeze({
  INVALID_PAUSE_STATE: 'INVALID_PAUSE_STATE',
});

/** De enige codes die deze module kan retourneren. */
const ERROR_CODES = Object.freeze({
  ...PROTOCOL_ERROR_CODES,
  ...INTERNAL_ERROR_CODES,
});

const PACING = Object.freeze({ AUTO: 'auto', HOST: 'host' });

/** `pacing`-waarde van een bestemming die bij zowel auto als host geldig is. */
const ANY_PACING = null;

/**
 * Eén toegestane bestemming binnen een tabelrij. De pacing hangt aan de
 * BESTEMMING en niet aan de hele rij, omdat ROUND_RESULT + TIMER_ELAPSED bij
 * host-tempo wél naar SCOREBOARD mag en niet naar de overige drie fasen.
 * @param {string} phase
 * @param {"auto" | "host" | null} pacing - ANY_PACING = geldig bij beide tempo's
 * @returns {{ phase: string, pacing: (string|null) }}
 */
function target(phase, pacing) {
  return Object.freeze({ phase, pacing });
}

// Overgangstabel als data: bronfase → event → { targets: [{ phase, pacing }] }.
// `ANY_PACING` betekent "geldig bij zowel auto als host" (COUNTDOWN en
// ROUND_ACTIVE zijn altijd timer-gedreven, ongeacht pacing). Alleen de
// uitslag- en tussenstandfasen zijn host-tempo gevoelig.
//
// De reducer VALIDEERT hier alleen lidmaatschap van `targets`; hij KIEST de
// bestemming niet. Kennis van roundIndex/totalRounds/scoreboardFrequency zit
// bewust bij de aanroeper, niet hier.
const TRANSITIONS = Object.freeze({
  [PHASES.LOBBY]: Object.freeze({
    [EVENT_TYPES.HOST_START]: Object.freeze({
      targets: Object.freeze([target(PHASES.COUNTDOWN, ANY_PACING)]),
    }),
  }),
  [PHASES.COUNTDOWN]: Object.freeze({
    [EVENT_TYPES.TIMER_ELAPSED]: Object.freeze({
      targets: Object.freeze([target(PHASES.ROUND_ACTIVE, ANY_PACING)]),
    }),
  }),
  [PHASES.ROUND_ACTIVE]: Object.freeze({
    [EVENT_TYPES.TIMER_ELAPSED]: Object.freeze({
      targets: Object.freeze([target(PHASES.ROUND_RESULT, ANY_PACING)]),
    }),
  }),
  // ROUND_RESULT kent bewust GEEN HOST_NEXT: bij host-tempo loopt de uitslag
  // altijd op de timer door naar SCOREBOARD, waar de host zijn enige actie doet
  // (aanname 2 in de modulekop, INT-10). Die tak niet terugzetten.
  [PHASES.ROUND_RESULT]: Object.freeze({
    [EVENT_TYPES.TIMER_ELAPSED]: Object.freeze({
      targets: Object.freeze([
        // Besluit 1: bij host-tempo loopt de uitslag op zijn timer door naar de
        // tussenstand — daar zit de enige hostactie van de ronde.
        target(PHASES.SCOREBOARD, ANY_PACING),
        target(PHASES.COUNTDOWN, PACING.AUTO),
        target(PHASES.ROUND_ACTIVE, PACING.AUTO),
        target(PHASES.FINISHED, PACING.AUTO),
      ]),
    }),
    // Besluit C: bij `autoReveal: false` onthult de host zelf, en dat onthullen
    // ÍS de hostactie van de ronde (aanname 3 in de modulekop). Alle vier de
    // bestemmingen bij ANY_PACING: welke het wordt beslist de aanroeper, en
    // `autoReveal` — niet pacing — bepaalt of dit event überhaupt mag.
    [EVENT_TYPES.HOST_REVEAL]: Object.freeze({
      targets: Object.freeze([
        target(PHASES.SCOREBOARD, ANY_PACING),
        target(PHASES.COUNTDOWN, ANY_PACING),
        target(PHASES.ROUND_ACTIVE, ANY_PACING),
        target(PHASES.FINISHED, ANY_PACING),
      ]),
    }),
  }),
  [PHASES.SCOREBOARD]: Object.freeze({
    [EVENT_TYPES.TIMER_ELAPSED]: Object.freeze({
      targets: Object.freeze([
        target(PHASES.COUNTDOWN, PACING.AUTO),
        target(PHASES.ROUND_ACTIVE, PACING.AUTO),
        target(PHASES.FINISHED, PACING.AUTO),
      ]),
    }),
    [EVENT_TYPES.HOST_NEXT]: Object.freeze({
      targets: Object.freeze([
        target(PHASES.COUNTDOWN, PACING.HOST),
        target(PHASES.ROUND_ACTIVE, PACING.HOST),
        target(PHASES.FINISHED, PACING.HOST),
      ]),
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
 * Toegestane nextPhase-waarden bij RECOVERY_RESUME. Bewust ÉÉN bestemming:
 * ARCHITECTURE.md §10 schrijft voor dat herstel na een serverherstart met een
 * nieuwe korte countdown gebeurt. Deze lijst breder maken maakt RECOVERY_RESUME
 * een synoniem van HOST_RESUME en haalt de bestaansreden van de splitsing weg
 * (INT-16) — niet doen.
 */
const RECOVERY_RESUMABLE_PHASES = Object.freeze([PHASES.COUNTDOWN]);

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
      return applyResume(phase, event, RESUMABLE_PHASES);
    case EVENT_TYPES.RECOVERY_RESUME:
      return applyResume(phase, event, RECOVERY_RESUMABLE_PHASES);
    case EVENT_TYPES.HOST_FINISH:
      return applyFinish(phase);
    default:
      // HOST_START, TIMER_ELAPSED, HOST_NEXT en HOST_REVEAL lopen via de tabel.
      return applyTableTransition(phase, type, event, pacing);
  }
}

/**
 * Voortgangsevents: bronfase/event moeten in de tabel staan, de aangeleverde
 * nextPhase moet een bestemming van die rij zijn en de pacing moet bij díe
 * bestemming horen.
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

  // HOST_START draagt volgens de event-union geen nextPhase; dan geldt de
  // enige toegestane bestemming. Wordt er tóch een nextPhase meegegeven, dan
  // wordt die net als bij de andere events tegen de tabel gevalideerd.
  const requested =
    type === EVENT_TYPES.HOST_START && event.nextPhase === undefined
      ? row.targets[0].phase
      : event.nextPhase;

  const allowed = findTarget(row, requested);
  if (allowed === undefined) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }

  // pacing telt alleen mee waar de tabel onderscheid maakt, en dat onderscheid
  // hangt aan de bestemming: ROUND_RESULT + TIMER_ELAPSED mag bij host-tempo
  // wél naar SCOREBOARD, maar niet naar de drie andere bestemmingen.
  if (allowed.pacing !== ANY_PACING && pacing !== allowed.pacing) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }

  return accept(requested);
}

/**
 * Zoekt de bestemming van een tabelrij. Vergelijkt strikt op de fase-string, dus
 * een nextPhase van een willekeurig type lokt nooit een key-lookup of coercion
 * uit (invariant 3: nooit een throw).
 * @param {{ targets: ReadonlyArray<{ phase: string, pacing: (string|null) }> }} row
 * @param {unknown} requested
 * @returns {{ phase: string, pacing: (string|null) } | undefined}
 */
function findTarget(row, requested) {
  for (const candidate of row.targets) {
    if (candidate.phase === requested) {
      return candidate;
    }
  }
  return undefined;
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
 * Gedeelde afhandeling van HOST_RESUME en RECOVERY_RESUME: beide zijn alleen
 * geldig vanuit PAUSED en zetten pausedState op null. Het ENIGE verschil zit in
 * `allowedPhases` — dat is de hele reden dat het twee events zijn (INT-16,
 * ARCHITECTURE.md §10). Fase vóór payload, net als bij HOST_PAUSE: hervatten
 * vanuit een niet-gepauzeerde fase blijft INVALID_PHASE, ook bij een onzinnige
 * nextPhase.
 *
 * De reducer controleert uitsluitend het lidmaatschap van `allowedPhases`, niet
 * of nextPhase gelijk is aan pausedState.previousPhase — welke fase de host
 * hervat is een keuze van de aanroeper. Wélk van de twee events past bij de
 * aanleiding is dat óók; de reducer leidt dat niet af uit pausedState.reason.
 * @param {string} phase
 * @param {Event} event
 * @param {ReadonlyArray<string>} allowedPhases - RESUMABLE_PHASES of
 *   RECOVERY_RESUMABLE_PHASES
 * @returns {{ ok: true, state: MatchState } | { ok: false, code: string }}
 */
function applyResume(phase, event, allowedPhases) {
  if (phase !== PHASES.PAUSED) {
    return reject(ERROR_CODES.INVALID_PHASE);
  }
  // Eén lezing vóór de validatie: valideren en gebruiken moeten over dezelfde
  // waarde gaan. Bij twee lezingen kan een getter de tweede keer een
  // ONGEVALIDEERDE fase teruggeven ('PAUSED', of iets buiten het domein).
  const requested = event.nextPhase;
  if (!allowedPhases.includes(requested)) {
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
