/**
 * @file PR10 — preview-endpoint: pure vorm-check voor
 *   `GET /api/v1/games/preview?inviteId=<inviteId>`, het lichte
 *   pre-join-endpoint uit `docs/multiplayer/DECISIONS.md`, punt 7 ("Er komt
 *   een licht pre-join-previewendpoint dat de invite valideert en een
 *   servergegenereerde naamsuggestie levert vóór `POST /games/join`.").
 * @see docs/protocol-plan/prompts/PR10-preview-endpoint.md.
 * @see docs/multiplayer/PROTOCOL.md — §REST-endpoints, `GET /api/v1/games/preview`.
 *
 * **Herzien naar het al gebouwde contract** (`docs/integration-plan/HANDOFF.md`,
 * INT-8): een eerdere versie van dit bestand verzon een tweede, afwijkend
 * previewcontract (ook `gameCode`, kale `{ suggestedName }`-respons) náást de
 * al gebouwde en geteste `previewInvite()` in
 * `server/composition/room-lifecycle.mjs`. Dit bestand volgt nu dat
 * daadwerkelijke contract:
 *
 * - **Uitsluitend `inviteId`** — geen `gameCode`-variant.
 * - Succesrespons: `{ roomId, suggestedName, phase, locked, allowLateJoin,
 *   playerCount, maxPlayers }` — bewust rijker dan de eerdere, striktere
 *   privacy-aanname van dit bestand; `playerCount`/`maxPlayers`/`phase`/
 *   `locked`/`allowLateJoin` zijn roomstatusvelden, geen spelersnamen of
 *   hostgegevens, en zijn expliciet akkoord bevonden.
 * - Ongeldige `inviteId` (verkeerd formaat): `INVITE_INVALID`.
 * - Syntactisch geldige maar onbekende/verlopen `inviteId`: `GAME_NOT_FOUND` —
 *   precies dezelfde code als een verlopen room-TTL elders (`DECISIONS.md`
 *   punt 2). De daadwerkelijke lookup tegen een echte room hoort niet bij deze
 *   module; dat is waar een aanroeper deze code ná deze validator toekent.
 *
 * Nog steeds geldig, ongewijzigd:
 *   - de responsvorm bevat nooit `sessionToken`/`playerId`: preview maakt geen
 *     sessie of `Player`-record aan (dat gebeurt pas bij `POST /games/join`);
 *   - `suggestedName` volgt dezelfde naamlimiet als bij join (`NAME_TOO_LONG`,
 *     20 zichtbare tekens uit `input-safety.mjs`) — `validatePreviewResponse`
 *     hergebruikt daarvoor `normalizeAndValidateDisplayName` rechtstreeks.
 *
 * Niet in scope: de daadwerkelijke invite-lookup tegen een echte room (dat is
 * `previewInvite()` zelf, in `server/composition/`), de
 * servergegenereerde-naam-logica, rate limiting op dit endpoint, sessie- of
 * `Player`-aanmaak. Deze module toetst uitsluitend de vorm van request en
 * response.
 */
import { ALL_ERROR_CODES } from './error-codes.mjs';
import { normalizeAndValidateDisplayName } from './input-safety.mjs';
import { isValidInviteId } from '../architecture/room-codes.js';

/** @typedef {import('./error-codes.mjs').ErrorCode} ErrorCode */

/**
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, code: ErrorCode }} ValidationResult
 */

const INVITE_INVALID = 'INVITE_INVALID';
const GAME_NOT_FOUND = 'GAME_NOT_FOUND';

// Deze module verzint geen eigen foutcodes — ze leent uitsluitend van
// `error-codes.mjs` (single source of truth). Fail fast bij module-load als
// een van deze codes ooit uit die enum verdwijnt.
for (const code of [INVITE_INVALID, GAME_NOT_FOUND]) {
  if (!ALL_ERROR_CODES.has(code)) {
    throw new Error(`preview-endpoint: foutcode "${code}" ontbreekt in ALL_ERROR_CODES`);
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} query - de rauwe querystring-parameters van
 *   `GET /api/v1/games/preview`. Uitsluitend `inviteId`.
 * @returns {ValidationResult<{ inviteId: string }>}
 */
export function validatePreviewRequest(query) {
  if (!isPlainObject(query)) {
    return { ok: false, code: INVITE_INVALID };
  }
  const { inviteId } = query;

  // isValidInviteId() werpt nooit en geeft altijd een boolean, ook op
  // vijandige input (niet-string, te kort, verkeerd alfabet, ...) — zie
  // room-codes.js.
  if (!isValidInviteId(inviteId)) {
    return { ok: false, code: INVITE_INVALID };
  }

  return { ok: true, value: { inviteId } };
}

/**
 * Vorm-check van de responsebody: exact de zeven velden die `previewInvite()`
 * teruggeeft. `suggestedName` blijft binnen de bestaande naamlimiet (via
 * `normalizeAndValidateDisplayName`, geen lokale herhaling van de limiet).
 * Geen sessie-/spelerachtige velden (`sessionToken`, `playerId`, ...) — een
 * responsvorm die zulke velden bevat is altijd ongeldig.
 *
 * @param {unknown} body
 * @returns {ValidationResult<{
 *   roomId: string, suggestedName: string, phase: string, locked: boolean,
 *   allowLateJoin: boolean, playerCount: number, maxPlayers: number,
 * }>}
 */
export function validatePreviewResponse(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: INVITE_INVALID };
  }

  const keys = Object.keys(body);
  const expectedKeys = [
    'roomId', 'suggestedName', 'phase', 'locked', 'allowLateJoin', 'playerCount', 'maxPlayers',
  ];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: INVITE_INVALID };
  }

  const { roomId, suggestedName, phase, locked, allowLateJoin, playerCount, maxPlayers } = body;
  if (typeof roomId !== 'string' || roomId.length === 0) return { ok: false, code: INVITE_INVALID };
  if (typeof phase !== 'string' || phase.length === 0) return { ok: false, code: INVITE_INVALID };
  if (typeof locked !== 'boolean') return { ok: false, code: INVITE_INVALID };
  if (typeof allowLateJoin !== 'boolean') return { ok: false, code: INVITE_INVALID };
  if (!Number.isInteger(playerCount) || playerCount < 0) return { ok: false, code: INVITE_INVALID };
  if (!Number.isInteger(maxPlayers) || maxPlayers < 1) return { ok: false, code: INVITE_INVALID };

  if (typeof suggestedName !== 'string') {
    return { ok: false, code: INVITE_INVALID };
  }
  // Hergebruikt de bestaande NAME_TOO_LONG/NAME_INVALID-grens uit
  // input-safety.mjs rechtstreeks, in plaats van de 20-tekens-limiet hier
  // opnieuw te dupliceren als eigen bron van waarheid.
  const nameResult = normalizeAndValidateDisplayName(suggestedName);
  if (!nameResult.ok) {
    return nameResult;
  }

  return {
    ok: true,
    value: {
      roomId, suggestedName: nameResult.value, phase, locked, allowLateJoin, playerCount, maxPlayers,
    },
  };
}
