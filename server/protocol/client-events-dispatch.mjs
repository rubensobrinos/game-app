/**
 * @file PR4c — `client-events`-module, sub-batch c: `player:rename`,
 *   `player:leave`, `round:answer` (envelopeniveau), `share:opened`, en
 *   `resolveEventValidator` (de dispatch-lookup voor alle 12 clientevents).
 * @see docs/multiplayer/PROTOCOL.md — §Client → server events, Basisregel 7.
 * @see docs/protocol-plan/prompts/PR4-client-events.md — sub-batch PR4c.
 *
 * Hergebruikt PR4a/PR4b's validators en `hasRequiredRole` via import — geen
 * duplicatie. `resolveEventValidator` is de enige plek die de 12 bekende
 * eventnamen opsomt als geldig alfabet: alles daarbuiten levert
 * `UNSUPPORTED_EVENT` op (Basisregel 7: "onbekende clientevents leveren
 * `UNSUPPORTED_EVENT`"), nooit een throw en nooit een stille passthrough.
 */
import { PLAYABLE_GAME_TYPES, isPlayableGameType } from '../../shared/content/game-catalog.mjs';
import {
  hasRequiredRole,
  validateGameStartPayload,
  validateGamePausePayload,
  validateGameResumePayload,
  validateGameNextPayload,
  validateGameRevealPayload,
} from './client-events-game-lifecycle-a.mjs';
import {
  validateGameLockPayload,
  validateGameKickPayload,
  validateGameFinishPayload,
  validateGameRematchPayload,
} from './client-events-game-lifecycle-b.mjs';

/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valideert de payload van `player:rename`. Toetst alleen aanwezigheid en
 * stringtype van `displayName` — NFKC-normalisatie, control-character-
 * verwijdering en de 20-tekenlimiet horen bij `input-safety.mjs` (PR3), niet
 * hier. Geen andere sleutels toegestaan.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validatePlayerRenamePayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'displayName') return { ok: false, code: null };
  if (typeof payload.displayName !== 'string') return { ok: false, code: null };
  return { ok: true };
}

/**
 * Valideert de payload van `player:leave`. Verwacht exact een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validatePlayerLeavePayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  if (Object.keys(payload).length !== 0) return { ok: false, code: null };
  return { ok: true };
}

/**
 * Valideert de envelopevelden van `round:answer`: `roundId` (niet-lege
 * string), `answer` (niet-lege, niet-array object — de inhoud zelf wordt hier
 * NIET verder gevalideerd, dat gebeurt in PR4d door de vijf variant-
 * validators) en `clientAnsweredAt` (eindig getal). Geen andere toplevel-
 * sleutels toegestaan (Ontwerpkeuze #1) — dit maakt de cross-cutting
 * Bearer-token-test (PR4c) betekenisvol: een extra `sessionToken`-veld wordt
 * hierdoor al afgewezen zonder dat deze functie die naam kent.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateRoundAnswerEnvelope(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  const keys = Object.keys(payload);
  const expectedKeys = ['roundId', 'answer', 'clientAnsweredAt'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: null };
  }

  const { roundId, answer, clientAnsweredAt } = payload;
  if (typeof roundId !== 'string' || roundId.length === 0) return { ok: false, code: null };
  if (!isPlainObject(answer) || Object.keys(answer).length === 0) return { ok: false, code: null };
  if (typeof clientAnsweredAt !== 'number' || !Number.isFinite(clientAnsweredAt)) {
    return { ok: false, code: null };
  }

  return { ok: true };
}

/**
 * De zestien toegestane spelerkleuren (besluit 40 + feedbackronde
 * producteigenaar, 4 aug 2026 — die ronde verving `blue` door `red`; besluit
 * besluit 42, 5 aug 2026 — acht erbij).
 *
 * Gesloten enum: elke andere waarde is een vormfout, geen open veld. De
 * VOLGORDE is betekenisvol: de server wijst bij join round-robin toe in deze
 * volgorde (zie `room-lifecycle.mjs`). Geëxporteerd zodat de compositielaag
 * (`recolorPlayer`) en tests dezelfde lijst gebruiken — geen tweede opsomming.
 *
 * De eerste acht staan er ongewijzigd en op dezelfde plek: er kunnen rooms in
 * Redis leven met een speler die `purple` heeft, en die waarde moet geldig
 * blijven. Aanvullen mag dus, herschikken niet — dat zou bestaande spelers
 * stilzwijgend van kleur laten wisselen én de round-robin-volgorde breken.
 *
 * De acht nieuwe zijn bewust dieper van toon dan de eerste acht: die zijn
 * ontworpen om op te lichten op bijna-zwart en zakken op het lichte thema
 * onder 3:1. De nieuwe halen ≥3,3:1 op béíde oppervlakken (meting in
 * `DECISIONS.md` besluit 42), en dat lichtheidsverschil maakt ze meteen ook
 * onderscheidbaar van hun heldere buur.
 * @type {ReadonlyArray<'orange' | 'magenta' | 'cyan' | 'green' | 'yellow' | 'purple' | 'lime' | 'red' | 'blue' | 'teal' | 'indigo' | 'violet' | 'rose' | 'moss' | 'rust' | 'slate'>}
 */
export const PLAYER_COLORS = Object.freeze([
  'orange', 'magenta', 'cyan', 'green', 'yellow', 'purple', 'lime', 'red',
  'blue', 'teal', 'indigo', 'violet', 'rose', 'moss', 'rust', 'slate',
]);
const VALID_PLAYER_COLORS = new Set(PLAYER_COLORS);

/**
 * Valideert de payload van `player:recolor` (besluit 40 + feedbackronde,
 * 4 aug 2026 — eventnaam was in het 40B/13-voorwerk nog `player:set-color`):
 * exact één sleutel `color`, waarde uit de gesloten `PLAYER_COLORS`-enum.
 * Geen andere sleutels toegestaan. Een ongeldige kleursleutel is een
 * vormfout (`code: null`), die de transportlaag — net als elk ander
 * vormprobleem — als `INVALID_ANSWER_FORMAT` op de wire zet; er is bewust
 * geen aparte `COLOR_INVALID`-code toegevoegd.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validatePlayerRecolorPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'color') return { ok: false, code: null };
  if (!VALID_PLAYER_COLORS.has(payload.color)) return { ok: false, code: null };
  return { ok: true };
}

/**
 * De zeven configuratievelden die een host ná creatie nog mag bijstellen
 * (besluit 40 + feedbackronde producteigenaar, 4 aug 2026). Bewust een subset
 * van GameConfiguration: de overige velden (preset, gameTypes, mode, ...)
 * blijven create-only. De feedbackronde verving `questionSeconds` (bewust
 * NIET meer wijzigbaar na creatie) door `speedBonus`; `hostParticipates`
 * blijft eveneens uitgesloten (te laat na join). `autoReveal` kwam er bij
 * (fase 4, docs/openstaand/antwoord-automatisch-tonen.md): de toggle staat in
 * de lobby náást "Automatisch volgende vraag" (`pacing`), dus hij moet net zo
 * bijstelbaar zijn.
 * @type {ReadonlyArray<string>}
 */
export const UPDATABLE_CONFIG_KEYS = Object.freeze([
  'totalRounds', 'difficulty', 'language', 'pacing', 'autoReveal', 'speedBonus', 'allowLateJoin', 'gameTypes',
]);

/**
 * De speltypen die een host live mag kiezen. GEEN eigen lijst meer (5 aug,
 * PLAN-CONVERGENTIE §A0): deze laag had er één, de carrousel een tweede en de
 * contentbron een derde, en ze liepen uit elkaar — een host kon een game
 * kiezen die de server niet kon bouwen. `shared/content/game-catalog.mjs` is
 * nu de enige bron; hier alleen doorgegeven zodat de importlijst laat zien
 * waar de waarheid vandaan komt.
 * @type {ReadonlyArray<string>}
 */
export const SELECTABLE_GAME_TYPES = PLAYABLE_GAME_TYPES;

/** Zelfde gesloten enums als `server/data/types/game-configuration.js` — de
 * create-validatie. Lokaal getranscribeerd omdat dat CJS-bestand in de
 * datalaag woont en protocol → data de verkeerde afhankelijkheidsrichting is
 * (zelfde afweging als PACING_VALUES dáár, zie dat bestand). */
const UPDATE_LANGUAGE_VALUES = new Set(['nl', 'en', 'es']);
const UPDATE_PACING_VALUES = new Set(['auto', 'host']);

/**
 * Valideert de payload van `game:update-config` (besluit 40 + feedbackronde,
 * 4 aug 2026): een NIET-LEGE subset van `UPDATABLE_CONFIG_KEYS`. Onbekende
 * sleutels — waaronder expliciet `questionSeconds` en `hostParticipates` —
 * zijn een vormfout (de transportlaag vertaalt `code: null` naar haar
 * `MALFORMED_PAYLOAD_CODE`, net als bij elk ander vormprobleem).
 *
 * Grenzen per veld volgen de create-validatie
 * (`assertGameConfigurationShape`): `language` en `pacing` gesloten enums,
 * `speedBonus` en `allowLateJoin` boolean, `difficulty` string. Voor
 * `totalRounds` eist create alleen "number"; hier geldt aanvullend
 * positief-geheel — dezelfde grens die `validateGameStartedPayload` al aan
 * `totalRounds` stelt, zodat er nooit een config ontstaat waar `game:started`
 * niet meer doorheen komt.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateGameUpdateConfigPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  const keys = Object.keys(payload);
  if (keys.length === 0) return { ok: false, code: null };
  if (!keys.every((key) => UPDATABLE_CONFIG_KEYS.includes(key))) return { ok: false, code: null };

  if ('totalRounds' in payload && (!Number.isInteger(payload.totalRounds) || payload.totalRounds <= 0)) {
    return { ok: false, code: null };
  }
  if ('difficulty' in payload && (typeof payload.difficulty !== 'string' || payload.difficulty.length === 0)) {
    return { ok: false, code: null };
  }
  if ('language' in payload && !UPDATE_LANGUAGE_VALUES.has(payload.language)) {
    return { ok: false, code: null };
  }
  if ('pacing' in payload && !UPDATE_PACING_VALUES.has(payload.pacing)) {
    return { ok: false, code: null };
  }
  if ('autoReveal' in payload && typeof payload.autoReveal !== 'boolean') {
    return { ok: false, code: null };
  }
  if ('speedBonus' in payload && typeof payload.speedBonus !== 'boolean') {
    return { ok: false, code: null };
  }
  if ('allowLateJoin' in payload && typeof payload.allowLateJoin !== 'boolean') {
    return { ok: false, code: null };
  }
  if ('gameTypes' in payload) {
    // EXACT ÉÉN (§A1, besluit 32: één gameType per match). De eerste versie
    // accepteerde iedere niet-lege lijst terwijl de compositie alleen
    // `gameTypes[0]` gebruikt: een client kon er drie sturen, kreeg ze alle
    // drie bevestigd in `room:config-changed` en er werden er stilzwijgend
    // twee genegeerd. Dat leest bovendien als heropende mixed games, die
    // expliciet buiten scope staan. Meer dan één waarde — ook een duplicaat —
    // is daarom een vormfout, geen stille reductie.
    const list = payload.gameTypes;
    if (!Array.isArray(list) || list.length !== 1) return { ok: false, code: null };
    if (!isPlayableGameType(list[0])) return { ok: false, code: null };
  }
  return { ok: true };
}

/** @type {ReadonlySet<'qr' | 'link' | 'native' | 'code'>} */
const VALID_SHARE_METHODS = new Set(['qr', 'link', 'native', 'code']);

/**
 * Valideert de payload van `share:opened`. `method` verplicht, exact één van
 * `"qr" | "link" | "native" | "code"` (`DECISIONS.md` punt 18: de vier
 * herkomsten zijn gelijkgetrokken — voorheen bespraken PROTOCOL.md §Client →
 * server events en Open vraag §6 in `../README.md` nog maar drie
 * gedocumenteerde waarden). Geen andere sleutels toegestaan.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
export function validateShareOpenedPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, code: null };
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'method') return { ok: false, code: null };
  if (!VALID_SHARE_METHODS.has(payload.method)) return { ok: false, code: null };
  return { ok: true };
}

/**
 * @typedef {{
 *   validate: (payload: unknown) => ValidationResult,
 *   requiredRole: "host" | "player" | "host_or_player",
 * }} EventValidatorEntry
 */

/**
 * De 15 bekende clientevents (de 12 uit §Client → server events, plus
 * `player:recolor` en `game:update-config` uit besluit 40 + feedbackronde,
 * 4 aug 2026, plus `game:reveal` uit fase 4/besluit C, 5 aug 2026), met hun
 * validator en vereiste rol. Enige bron van waarheid voor "welke eventnamen
 * bestaan" — `resolveEventValidator` doet een pure lookup hierop, geen tweede
 * lijst.
 * @type {ReadonlyMap<string, EventValidatorEntry>}
 */
const EVENT_VALIDATORS_BY_NAME = new Map([
  ['game:start', { validate: validateGameStartPayload, requiredRole: 'host' }],
  ['game:pause', { validate: validateGamePausePayload, requiredRole: 'host' }],
  ['game:resume', { validate: validateGameResumePayload, requiredRole: 'host' }],
  ['game:next', { validate: validateGameNextPayload, requiredRole: 'host' }],
  ['game:reveal', { validate: validateGameRevealPayload, requiredRole: 'host' }],
  ['game:lock', { validate: validateGameLockPayload, requiredRole: 'host' }],
  ['game:kick', { validate: validateGameKickPayload, requiredRole: 'host' }],
  ['game:finish', { validate: validateGameFinishPayload, requiredRole: 'host' }],
  ['game:rematch', { validate: validateGameRematchPayload, requiredRole: 'host' }],
  ['game:update-config', { validate: validateGameUpdateConfigPayload, requiredRole: 'host' }],
  ['player:rename', { validate: validatePlayerRenamePayload, requiredRole: 'player' }],
  ['player:recolor', { validate: validatePlayerRecolorPayload, requiredRole: 'player' }],
  ['player:leave', { validate: validatePlayerLeavePayload, requiredRole: 'player' }],
  ['round:answer', { validate: validateRoundAnswerEnvelope, requiredRole: 'player' }],
  ['share:opened', { validate: validateShareOpenedPayload, requiredRole: 'host_or_player' }],
]);

/**
 * Alle 15 bekende clientevent-namen, afgeleid van `EVENT_VALIDATORS_BY_NAME`
 * (geen tweede handmatige lijst), voor gebruik in exhaustiviteitstests.
 * @type {ReadonlyArray<string>}
 */
export const ALL_CLIENT_EVENT_NAMES = Object.freeze([...EVENT_VALIDATORS_BY_NAME.keys()]);

/**
 * Zoekt de validator en rolvereiste op voor een clientevent-naam. Basisregel
 * 7: "onbekende clientevents leveren `UNSUPPORTED_EVENT`" — dit is de enige
 * plek waar dat wordt beslist, nooit een throw en nooit een stille
 * passthrough voor een onbekende naam.
 * @param {string} eventName
 * @returns {{ ok: true, entry: EventValidatorEntry } | { ok: false, code: 'UNSUPPORTED_EVENT' }}
 */
export function resolveEventValidator(eventName) {
  const entry = EVENT_VALIDATORS_BY_NAME.get(eventName);
  if (entry === undefined) {
    return { ok: false, code: 'UNSUPPORTED_EVENT' };
  }
  return { ok: true, entry };
}

/**
 * Re-exporteert `hasRequiredRole` (gedefinieerd in PR4a) zodat aanroepers die
 * alleen dit dispatch-bestand importeren niet ook nog los
 * `client-events-game-lifecycle-a.mjs` hoeven te kennen.
 */
export { hasRequiredRole };
