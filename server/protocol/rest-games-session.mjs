/**
 * @file PR3 — `rest-games`-module, state/leave/time-deel: pure vorm-check
 *   voor `GET /api/v1/games/{code}/state`, `POST /api/v1/games/{code}/leave`
 *   en `GET /api/v1/time`.
 * @see docs/protocol-plan/prompts/PR3-rest-schemas.md — module 3
 *   (`rest-games`), functies `validateGetStateRequestShape`,
 *   `validateLeaveGameRequestShape`, `validateTimeResponse`.
 * @see docs/multiplayer/PROTOCOL.md — §REST-endpoints.
 *
 * Dit bestand dekt uitsluitend het state/leave/time-deel van de
 * `rest-games`-module (rijen 20–26 van de testtabel in PR3-rest-schemas.md).
 * De create/join-validators (`validateCreateGameRequest`,
 * `validateJoinGameRequest`, ...) horen bij een ander bestand van dezelfde
 * module en worden hier niet gedupliceerd of opnieuw gedefinieerd.
 *
 * Niet in scope (zie promptbestand, "Niet in scope"): het daadwerkelijk
 * opzoeken of `code` bij een bestaande room hoort, de geldigheidscontrole van
 * een sessietoken tegen een echte sessiestore, welke rollen bij een token
 * horen ("vereist spelerrol" bij `/leave`), en de vorm van de state-snapshot
 * zelf (PR5d). Deze validators toetsen uitsluitend de vorm van de request
 * resp. response.
 */
import { ALL_ERROR_CODES } from './error-codes.mjs';
import { parseBearerAuthHeader } from './auth-shape.mjs';

/** @typedef {import('./error-codes.mjs').ErrorCode} ErrorCode */

/**
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, code: ErrorCode }} ValidationResult
 */

const GAME_NOT_FOUND = 'GAME_NOT_FOUND';

/**
 * `PROTOCOL.md` koppelt aan een misvormde `GET /api/v1/time`-response geen
 * enkele foutcode — dit endpoint valt buiten alle vier Foutcodes-categorieën
 * (Room/join, Autorisatie, Game/ronde, Input): het heeft geen room, geen
 * sessie, geen ronde. Anders dan `GAME_NOT_FOUND` hierboven (dichtstbijzijnde
 * bestaande code uit de Room/join-categorie voor een misvormd path-
 * parameter) bestaat hier geen vergelijkbare "dichtstbijzijnde" code.
 *
 * `DECISIONS.md` punt 19 beslecht dit: een lokale, eigen constante in plaats
 * van de eerder geleende `PROTOCOL_VERSION_UNSUPPORTED`-placeholder (die
 * suggereerde dat een misvormde `serverTime` iets met protocolversies te
 * maken had, wat niet zo is). `INVALID_SERVER_RESPONSE` is bewust **geen**
 * nieuwe wire-foutcode: hij wordt niet toegevoegd aan `error-codes.mjs`'s
 * `ALL_ERROR_CODES` en blijft dus buiten de fail-fast-toets hieronder.
 * Aanroepers mogen bij een `ok: false`-resultaat van `validateTimeResponse`
 * alleen op `ok` vertrouwen, nooit op de specifieke waarde van `code`.
 */
const INVALID_SERVER_RESPONSE = 'INVALID_SERVER_RESPONSE';

// Deze module verzint geen eigen wire-foutcodes — op INVALID_SERVER_RESPONSE
// hierboven na (bewust lokaal, zie de JSDoc erbij), leent ze uitsluitend van
// `error-codes.mjs` (single source of truth). Fail fast bij module-load als
// een van deze codes ooit uit die enum verdwijnt.
for (const code of [GAME_NOT_FOUND]) {
  if (!ALL_ERROR_CODES.has(code)) {
    throw new Error(`rest-games-session: foutcode "${code}" ontbreekt in ALL_ERROR_CODES`);
  }
}

/**
 * Path-parameter `{code}`: exact zes ASCII-cijfers — dezelfde syntactische
 * regel als `architecture-plan`'s AR2 (room-codes) en `game-flow-plan`'s
 * route-resolver hanteren. Deze validator dupliceert die regex niet als
 * eigen bron van waarheid, maar past 'm lokaal toe (PR3-rest-schemas.md).
 * @type {RegExp}
 */
const GAME_CODE_PATTERN = /^[0-9]{6}$/;

/**
 * Gedeelde vorm-check voor `{ code, authorizationHeader }`-inputs van
 * `GET /{code}/state` en `POST /{code}/leave`: eerst het path-parameter
 * (exact zes ASCII-cijfers, anders `GAME_NOT_FOUND` — dichtstbijzijnde
 * bestaande Room/join-code; `PROTOCOL.md` heeft geen apart "ongeldig
 * formaat"-code voor path-parameters), dan de auth-header via
 * `parseBearerAuthHeader` (anders `TOKEN_INVALID`, via die functie).
 *
 * @param {{ code: unknown, authorizationHeader: string | undefined | null }} input
 * @returns {ValidationResult<{ code: string, token: string }>}
 */
function validateCodeAndAuthHeaderShape(input) {
  const pathCode = input?.code;
  if (typeof pathCode !== 'string' || !GAME_CODE_PATTERN.test(pathCode)) {
    return { ok: false, code: GAME_NOT_FOUND };
  }

  const authResult = parseBearerAuthHeader(input?.authorizationHeader);
  if (!authResult.ok) {
    return { ok: false, code: authResult.code };
  }

  return { ok: true, value: { code: pathCode, token: authResult.token } };
}

/**
 * Vorm-check voor `GET /api/v1/games/{code}/state`: alleen het path-
 * parameter en de auth-header. De responsebody ís de state-snapshot
 * ("Volledige actuele snapshot") — de vorm daarvan hoort bij de `snapshot`-
 * module (PR5d), en wordt hier bewust niet gedupliceerd, alleen aangeroepen.
 *
 * @param {{ code: string, authorizationHeader: string | undefined | null }} input
 * @returns {ValidationResult<{ code: string, token: string }>}
 */
export function validateGetStateRequestShape(input) {
  return validateCodeAndAuthHeaderShape(input);
}

/**
 * Vorm-check voor `POST /api/v1/games/{code}/leave`: alleen het path-
 * parameter en de auth-header. `PROTOCOL.md` documenteert geen responsebody
 * voor dit endpoint — deze module verzint er dus ook geen (zie 'Niet in
 * scope'). "Vereist spelerrol" is een autorisatiebeslissing tegen een echte
 * sessie (welke rollen hoort dit token?) en dus buiten bereik van een pure
 * vorm-check; deze functie toetst alleen dat er een sessietoken-vormige
 * header aanwezig is, niet welke rollen erbij horen.
 *
 * @param {{ code: string, authorizationHeader: string | undefined | null }} input
 * @returns {ValidationResult<{ code: string, token: string }>}
 */
export function validateLeaveGameRequestShape(input) {
  return validateCodeAndAuthHeaderShape(input);
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} body - de rauwe responsebody van `GET /api/v1/time`.
 * @returns {ValidationResult<{ serverTime: number }>} `serverTime` moet een
 *   eindig, niet-negatief geheel getal zijn (epoch-ms). Zie
 *   `INVALID_SERVER_RESPONSE` hierboven voor de (niet-canonieke, lokale)
 *   `code`-waarde bij `ok: false` — aanroepers vertrouwen daarbij alleen op
 *   `ok`, nooit op de specifieke code.
 */
export function validateTimeResponse(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: INVALID_SERVER_RESPONSE };
  }

  const { serverTime } = body;
  const isValidServerTime =
    typeof serverTime === 'number' &&
    Number.isFinite(serverTime) &&
    Number.isInteger(serverTime) &&
    serverTime >= 0;

  if (!isValidServerTime) {
    return { ok: false, code: INVALID_SERVER_RESPONSE };
  }

  return { ok: true, value: { serverTime } };
}
