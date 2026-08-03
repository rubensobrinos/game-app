export const KNOWN_ERROR_CODES = new Set([
  'GAME_NOT_FOUND', 'INVITE_INVALID', 'GAME_FULL', 'GAME_ALREADY_STARTED',
  'LATE_JOIN_DISABLED', 'ROOM_LOCKED', 'CODE_RATE_LIMITED',
  'TOKEN_INVALID', 'TOKEN_EXPIRED', 'SESSION_REVOKED', 'NOT_HOST', 'NOT_PLAYER',
  'INVALID_PHASE', 'ROUND_NOT_ACTIVE', 'PLAYER_NOT_ELIGIBLE', 'ALREADY_ANSWERED',
  'DEADLINE_PASSED', 'INVALID_ANSWER_FORMAT', 'UNSUPPORTED_EVENT',
  'NAME_TOO_LONG', 'NAME_INVALID', 'RATE_LIMITED', 'PROTOCOL_VERSION_UNSUPPORTED',
]);

/** @param {string} errorCode @returns {string} */
export function messageForErrorCode(errorCode) {
  return typeof errorCode === 'string' && KNOWN_ERROR_CODES.has(errorCode)
    ? errorCode
    : 'UNKNOWN_ERROR';
}

// Confirmed reason enum, DECISIONS.md #11: host, host_disconnected, no_answers,
// server_recovery. The fallback stays for forward-compat with any value a
// future protocol revision might add.
const PAUSE_REASON_KEYS = new Map([
  ['host', 'pause.host'],
  ['host_disconnected', 'pause.host_disconnected'],
  ['no_answers', 'pause.no_answers'],
  ['server_recovery', 'pause.server_recovery'],
]);

/** @param {string | null | undefined} reason @returns {string} */
export function messageForPauseReason(reason) {
  return PAUSE_REASON_KEYS.get(reason) ?? 'pause.unknown';
}

/**
 * @param {'connected' | 'disconnected' | 'reconnecting'} status
 * @returns {string | null} null voor 'connected' — niets te tonen
 */
export function messageForConnectionStatus(status) {
  if (status === 'connected') {
    return null;
  }
  if (status === 'disconnected') {
    return 'connection.disconnected';
  }
  if (status === 'reconnecting') {
    return 'connection.reconnecting';
  }
  return null;
}

// Prompt 05, punt 1 (03 §5.1: "iedere fout heeft een specifieke vervolgstap").
// Uitsluitend de foutcodes die `previewInvite`/`joinGame` daadwerkelijk kunnen
// opleveren (PROTOCOL.md's join-/create-sectie en `rest-games-create-join.mjs`'s
// eigen opsomming) — niet de volledige 23, de meeste horen bij een lopende
// ronde, niet bij joinen.
const PERMANENTLY_INVALID_JOIN_CODES = new Set(['GAME_NOT_FOUND', 'INVITE_INVALID']);
const MAY_CHANGE_LATER_JOIN_CODES = new Set([
  'GAME_FULL',
  'ROOM_LOCKED',
  'GAME_ALREADY_STARTED',
  'LATE_JOIN_DISABLED',
]);

/**
 * Welke vervolgactie(s) een joinfout rechtvaardigt. `retry` blijft altijd
 * mogelijk (de gebruiker kan het altijd proberen), maar voor de eerste twee
 * categorieën is dat zinloos — dezelfde code/link/naam blijft dezelfde fout
 * geven — dus daar hoort "terug naar start" als (mede-)primaire actie bij.
 * @param {string | null | undefined} errorCode
 * @returns {'permanently-invalid' | 'may-change-later' | 'retry-only'}
 */
export function joinErrorCategoryFor(errorCode) {
  if (typeof errorCode === 'string' && PERMANENTLY_INVALID_JOIN_CODES.has(errorCode)) {
    return 'permanently-invalid';
  }
  if (typeof errorCode === 'string' && MAY_CHANGE_LATER_JOIN_CODES.has(errorCode)) {
    return 'may-change-later';
  }
  // NAME_INVALID/NAME_TOO_LONG: join-state.mjs's eigen RETRY-afhandeling wist
  // al de ingevoerde naam en gaat terug naar name-entry — dat IS al de juiste
  // vervolgstap, geen aparte categorie nodig. CODE_RATE_LIMITED en een
  // netwerkfout (geen `.code`) horen hier ook: simpelweg opnieuw proberen
  // blijft daar de zinnige actie.
  return 'retry-only';
}

/** @param {'kicked' | 'revoked'} kind @param {string | null} [reason] @returns {string} */
export function messageForSessionTermination(kind, reason) {
  if (kind === 'kicked') {
    return 'session.kicked';
  }
  if (kind === 'revoked') {
    return 'session.revoked';
  }
  return 'session.unknown';
}
