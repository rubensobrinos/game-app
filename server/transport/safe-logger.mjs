// server/transport/safe-logger.mjs — de ENIGE loguitgang van de transportlaag.
//
// WAAROM DIT BESTAAT. `logSafe()` woonde als closure ín `attachSocketServer()`.
// REST kon hem daardoor niet gebruiken en had praktisch geen logregels; hem
// kopiëren zou precies het tweede mechanisme opleveren dat `AGENTS.md` verbiedt
// ("twee bronnen voor dezelfde waarheid lopen gegarandeerd uit elkaar"). Dit
// bestand is dus geen extra laag maar het weghalen van een dubbeling: één
// allowlist, één formatter, drie aanroepers (`rest.mjs`, `socket.mjs`,
// `index.mjs`).
//
// HARDE EISEN (docs/multiplayer/DEPLOYMENT-AND-TESTING.md §Observability →
// Logging en PROTOCOL.md §Basisregels punt 8):
//   - gestructureerde JSON-logregels;
//   - geen displaynamen, geen tokens, geen volledige antwoordpayloads;
//   - geen IP in applicatielogs;
//   - foutcodes en veilige metadata, geen stacktraces.
//
// DIT IS EEN ALLOWLIST, GEEN FILTER OP VERBODEN NAMEN. Een filter beschermt
// alleen tegen de namen die iemand ooit heeft bedacht; een allowlist beschermt
// ook tegen het veld dat morgen wordt toegevoegd. Bovendien wordt niet alleen
// de NAAM maar ook de VORM van elke waarde getoetst (`FIELD_GUARDS`): een veld
// dat er is maar er niet uitziet zoals het hoort, wordt vervangen door
// `UNSAFE_VALUE`. Dat sluit de laatste opening: `reason` mag bestaan, maar een
// `error.message` met spaties komt er niet doorheen — de belofte "nooit een
// message of stacktrace" wordt zo door de code afgedwongen en niet door de
// discipline van de aanroeper.

import { LogController } from 'fastify';

import { ALL_ERROR_CODES } from '../protocol/error-codes.mjs';

/** De drie lagen die mogen loggen. Elke aanroeper geeft er precies één mee. */
export const LOG_LAYERS = Object.freeze(new Set(['rest', 'socket', 'server']));

/**
 * De gesloten waardeverzameling van `source`: wie de overgang aanvroeg.
 * Sluit aan op `HOST_EVENT_TYPES`/`SERVER_EVENT_TYPES` in
 * `server/composition/match-lifecycle.mjs` — `recovery` hoort bij
 * `RECOVERY_RESUME` en heeft vandaag nog geen transportpad.
 */
export const LOG_SOURCES = Object.freeze(new Set(['host', 'timer', 'recovery']));

/** Wat er in het veld terechtkomt als de waarde de vormtoets niet haalt. */
export const UNSAFE_VALUE = 'invalid';

/** Stille standaardlogger: de transportlaag logt nooit ongevraagd naar stdout. */
export const NOOP_LOGGER = Object.freeze({ info() {}, warn() {}, error() {} });

/**
 * Interne uitkomstlabels. Bewust `snake_case` en bewust géén foutcodes: dit
 * veld zegt wat er WERKELIJK gebeurde, terwijl `code` zegt wat de client kreeg.
 * Die twee lopen uiteen zodra een interne code publiek wordt vertaald.
 */
export const OUTCOME = Object.freeze({
  /** Een normale, gepubliceerde afwijzing — de client kreeg exact `code`. */
  REJECTED: 'rejected',
  /** Een verloren compare-and-set op de fase — verwachte gelijktijdigheid. */
  PHASE_RACE_LOST: 'phase_race_lost',
  /** Authenticatie mislukt: geen/ongeldig/ingetrokken token. */
  AUTH_FAILED: 'auth_failed',
  /** Onverwachte serverfout: 500, geen detail naar de client. */
  SERVER_ERROR: 'server_error',
});

// ─────────────────────────────────────────────────────────────────────────────
// Vormtoetsen per veld — dit ís de motivering waarom een veld veilig is
// ─────────────────────────────────────────────────────────────────────────────

const OPAQUE_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Protocol-eventnaam: `game:start`, `room:player-changed`, … */
const EVENT_NAME = /^[a-z]+:[a-z-]+$/;
/** SCREAMING_CASE, zoals elke foutcode en elke fasenaam. */
const SCREAMING = /^[A-Z_]{1,40}$/;
/** Eén woord zonder spaties: een LABEL, dus per constructie geen zin. */
const LABEL = /^[A-Za-z0-9_.:-]{1,64}$/;
const LOWER_LABEL = /^[a-z_]{1,40}$/;
const SHORT_WORD = /^[A-Za-z]{1,16}$/;

/** @param {RegExp} pattern */
function matching(pattern) {
  return (value) => (typeof value === 'string' && pattern.test(value) ? value : UNSAFE_VALUE);
}

/** @param {ReadonlySet<string>} allowed */
function oneOf(allowed) {
  return (value) => (typeof value === 'string' && allowed.has(value) ? value : UNSAFE_VALUE);
}

/**
 * Per toegestaan veld: waarom het veilig is, en welke vorm het moet hebben.
 *
 * Wil je hier een veld bijzetten, bedenk dan éérst of het een geheim of een
 * persoonsgegeven kan dragen — en schrijf een guard die dat uitsluit in plaats
 * van erop te vertrouwen dat elke aanroeper het netjes doet.
 */
const FIELD_GUARDS = Object.freeze({
  // ── Identificatie ─────────────────────────────────────────────────────────
  /** Opaak id van één spelavond. Géén join-capability: dat zijn `gameCode` en `inviteId`. */
  roomId: matching(OPAQUE_ID),
  /** Opaak sessie-id, uitdrukkelijk NIET het sessietoken. */
  sessionId: matching(OPAQUE_ID),
  /** Fastify's `request.id` — een procesteller, draagt geen clientgegeven. */
  requestId: matching(OPAQUE_ID),
  /**
   * Idempotentiesleutel van één clientactie. CLIENTGEKOZEN, dus de enige weg
   * waarlangs een client iets van zichzelf in zijn eigen logregel kan zetten;
   * de vormtoets houdt daar alles buiten wat op een naam of een zin lijkt.
   */
  actionId: matching(LABEL),
  /** Servergegenereerd `evt_…` uit `createId(context, 'evt')`. */
  eventId: matching(OPAQUE_ID),

  // ── Wat er gebeurde ───────────────────────────────────────────────────────
  /**
   * Eventnaam uit het vaste protocolalfabet. Bij een clientevent is dit
   * clientinvoer (`socket.onAny`), dus ook hier een vormtoets en geen vertrouwen.
   */
  event: matching(EVENT_NAME),
  /** Gepubliceerde PROTOCOL.md-foutcode: wat de CLIENT te zien kreeg. */
  code: matching(SCREAMING),
  /** Interne uitkomst: wat er WERKELIJK gebeurde (zie `OUTCOME`). */
  outcome: matching(LOWER_LABEL),
  /** Reeds gelabelde foutklasse. Een `error.message` haalt deze toets nooit. */
  reason: matching(LABEL),
  /** HTTP-methode bij `layer: 'rest'`, deelmethode (qr|link|native) bij `share:opened`. */
  method: matching(SHORT_WORD),

  // ── Fase-races ────────────────────────────────────────────────────────────
  /** De fase die de compositie las vlak vóór de compare-and-set. */
  expectedPhase: matching(SCREAMING),
  /** `Match.phase` op het moment van de compare-and-set (besluit 30). */
  actualPhase: matching(SCREAMING),
  /** Wie de overgang aanvroeg — gesloten verzameling. */
  source: oneOf(LOG_SOURCES),

  // ── Waar ──────────────────────────────────────────────────────────────────
  /** Wordt door de binding gestempeld; een aanroeper kan hem niet vervalsen. */
  layer: oneOf(LOG_LAYERS),

  // ── Levenscyclus (`layer: 'server'`) ──────────────────────────────────────
  /** Luisterpoort uit de configuratie; geen persoonsgegeven. */
  port: (value) => (Number.isInteger(value) && value >= 0 && value <= 65535 ? value : UNSAFE_VALUE),
  /** `SIGTERM` | `SIGINT`. */
  signal: matching(SCREAMING),
  /** Welke opslag eronder draait: `memory` of `redis`. */
  store: oneOf(new Set(['memory', 'redis'])),
  /**
   * Het GEREDIGEERDE Redis-endpoint uit `connection.describe()` — protocol,
   * host en poort, credentials al vervangen door `***` (connection.mjs). Dit is
   * het adres van onze eigen infrastructuur en nooit dat van een speler; de
   * "geen IP in applicatielogs"-regel gaat over clients.
   */
  endpoint: matching(/^[A-Za-z0-9_.:@/*[\]-]{1,120}$/),
});

/** De volledige allowlist, afgeleid van de guards zodat er geen tweede lijst is. */
export const LOGGABLE_FIELDS = Object.freeze(Object.keys(FIELD_GUARDS));

// ─────────────────────────────────────────────────────────────────────────────
// Labels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Een korte, stabiele foutklasse: nooit `message`, nooit de stacktrace.
 *
 * Een `error.code` (`ECONNREFUSED`, `ERR_MODULE_NOT_FOUND`) is stabieler dan de
 * klassenaam en heeft daarom voorrang; anders de constructornaam.
 * @param {unknown} error
 * @returns {string}
 */
export function errorLabel(error) {
  if (error === null || typeof error !== 'object') return 'unknown';
  if (typeof error.code === 'string') return error.code;
  return error.constructor?.name ?? 'Error';
}

/**
 * Vertaalt een foutcode naar zijn INTERNE uitkomstlabel, vóór de publieke
 * vertaling.
 *
 * Dit is de reparatie uit INT4a deel 3. `toPublicErrorCode()` beeldt élke
 * niet-gepubliceerde code op `INVALID_PHASE` af, dus in het log stond een
 * generieke fasefout waar in werkelijkheid een verwachte verloren
 * compare-and-set (`PHASE_RACE_LOST`) of een interne `INVALID_PAUSE_STATE`
 * zat. Operationeel zijn die totaal verschillend: de eerste wijst op normale
 * gelijktijdigheid, de tweede op een bug.
 *
 * Bewust een ALLOWLIST-toets tegen `ALL_ERROR_CODES` en geen lijstje bekende
 * interne namen: elke interne code die er ooit bijkomt — ook die uit
 * `INTERNAL_ERROR_CODES` in `server/architecture/state-machine.js` — krijgt
 * hierdoor vanzelf zijn eigen label in plaats van de vermomming.
 *
 * @param {unknown} code
 * @returns {string}
 */
export function classifyOutcome(code) {
  if (typeof code !== 'string' || code.length === 0) return OUTCOME.SERVER_ERROR;
  if (ALL_ERROR_CODES.has(code)) return OUTCOME.REJECTED;
  return code.toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// De formatter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zeeft een veldenverzameling door de allowlist én door de vormtoetsen.
 * @param {Record<string, unknown>} fields
 * @returns {Record<string, string | number>}
 */
export function pickSafeFields(fields = {}) {
  const safe = {};
  if (fields === null || typeof fields !== 'object') {
    return safe;
  }
  for (const key of LOGGABLE_FIELDS) {
    const value = fields[key];
    if (value === undefined || value === null) continue;
    safe[key] = FIELD_GUARDS[key](value);
  }
  return safe;
}

/**
 * Bindt een logger aan één laag en levert de enige loguitgang van die laag op.
 *
 * De teruggegeven functie heeft precies de vorm die `socket.mjs` al gebruikte
 * (`logSafe(level, message, fields)`), zodat er niets van aanroepstijl verandert
 * — alleen de plek waar de allowlist woont.
 *
 * @param {{ logger?: { info?: Function, warn?: Function, error?: Function } | null, layer: 'rest' | 'socket' | 'server' }} params
 * @returns {(level: 'info' | 'warn' | 'error', message: string, fields?: Record<string, unknown>) => void}
 */
export function createSafeLogger({ logger, layer } = {}) {
  if (!LOG_LAYERS.has(layer)) {
    throw new TypeError(`createSafeLogger: onbekende laag ${JSON.stringify(layer)} (verwacht ${[...LOG_LAYERS].join(' | ')}).`);
  }
  const sink = logger ?? NOOP_LOGGER;
  return function logSafe(level, message, fields = {}) {
    // `layer` wordt LAATST gestempeld: een aanroeper kan zijn eigen laag niet
    // vervalsen, ook niet per ongeluk.
    const record = { ...pickSafeFields(fields), layer };
    sink[level]?.(record, typeof message === 'string' ? message : 'log');
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fastify/Pino — de logweg die niemand schrijft en die daarom het meest lekt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializers voor Fastify's EIGEN logger.
 *
 * Dit is de gevaarlijkste logweg, want er komt geen regel code van ons aan te
 * pas: Pino serialiseert een `req` standaard mét `headers` en `remoteAddress`,
 * en een `err` mét `message` en `stack`. Een veilige applicatielog is
 * waardeloos als de automatische requestlogging er een `Authorization`-header
 * of een IP naast zet.
 *
 * Deze drie serializers zijn opzettelijk verminkend: ze bouwen een NIEUW object
 * met alleen wat veilig is, in plaats van iets uit het origineel weg te laten.
 */
export const SAFE_LOG_SERIALIZERS = Object.freeze({
  /** Geen headers, geen url (die draagt de `gameCode`), geen remote address. */
  req: (request) => ({
    id: typeof request?.id === 'string' || typeof request?.id === 'number' ? request.id : undefined,
    method: typeof request?.method === 'string' ? request.method : undefined,
  }),
  /** Alleen de status; een responsbody of header hoort nooit in een logregel. */
  res: (reply) => ({ statusCode: reply?.statusCode }),
  /** Alleen de foutklasse — geen `message`, geen `stack`, geen `cause`. */
  err: (error) => ({ type: errorLabel(error) }),
});

/**
 * Bouwt de `logger`-optie voor `Fastify()`: de aanroeperkeuze plus de veilige
 * serializers. `false` blijft `false` — dan bestaat er geen logger om te
 * beveiligen.
 *
 * Zet dit ALTIJD samen met `disableRequestLogging: true` in (zie
 * `SAFE_FASTIFY_OPTIONS`): de serializers dekken het geval waarin Fastify tóch
 * iets logt, het uitzetten dekt het geval waarin dat per verzoek gebeurt.
 *
 * @param {boolean | object} logger
 * @returns {boolean | object}
 */
export function withSafeSerializers(logger) {
  if (logger === false || logger === undefined || logger === null) {
    return false;
  }
  const options = logger === true ? {} : logger;
  return {
    ...options,
    serializers: { ...SAFE_LOG_SERIALIZERS, ...(options.serializers ?? {}) },
  };
}

/**
 * De Fastify-opties die de automatische requestlogging dichtzetten.
 *
 * `disableRequestLogging` haalt de "incoming request"/"request completed"- en
 * "request errored"-regels weg. Die dragen per verzoek `req`/`res`/`err` en
 * zijn precies de regels die zonder enige code van ons een IP, een
 * `Authorization`-header of een stacktrace in het log zetten. Wat wij zelf
 * willen loggen (een afwijzing, een authenticatiefout, een 500) schrijven we
 * expliciet via `createSafeLogger` — één weg, één allowlist.
 *
 * Het gaat via `logController` en niet via de gelijknamige top-level optie:
 * die is in Fastify 5 afgeschaft (FSTDEP023) en verdwijnt in 6. De controller
 * draagt per-instantie-state, dus elke server krijgt zijn eigen exemplaar.
 *
 * @returns {{ logController: LogController }}
 */
export function safeFastifyOptions() {
  return { logController: new LogController({ disableRequestLogging: true }) };
}
