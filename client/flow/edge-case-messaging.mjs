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
