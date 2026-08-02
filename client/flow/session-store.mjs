/**
 * @typedef {{
 *   sessionToken: string,
 *   roomCode: string,
 *   playerId: string | null,
 *   savedAt: number,
 * }} StoredSession
 *
 * @typedef {{
 *   getItem: (key: string) => string | null,
 *   setItem: (key: string, value: string) => void,
 *   removeItem: (key: string) => void,
 * }} StorageLike
 */

/** @param {string} roomCode @returns {string} */
export function storageKeyFor(roomCode) {
  return `mp:session:${roomCode}`;
}

/** @param {StorageLike} storage @param {StoredSession} session */
export function saveSession(storage, session) {
  storage.setItem(storageKeyFor(session.roomCode), JSON.stringify(session));
}

/**
 * @param {StorageLike} storage
 * @param {string} roomCode
 * @returns {StoredSession | null}
 */
export function loadSession(storage, roomCode) {
  try {
    const raw = storage.getItem(storageKeyFor(roomCode));
    if (typeof raw !== 'string') {
      return null;
    }
    const parsed = JSON.parse(raw);
    return isValidStoredSession(parsed, roomCode) ? parsed : null;
  } catch {
    return null;
  }
}

/** @param {StorageLike} storage @param {string} roomCode */
export function clearSession(storage, roomCode) {
  storage.removeItem(storageKeyFor(roomCode));
}

function isValidStoredSession(value, roomCode) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.sessionToken === 'string' &&
    value.sessionToken.length > 0 &&
    typeof value.roomCode === 'string' &&
    value.roomCode === roomCode &&
    (value.playerId === null || typeof value.playerId === 'string') &&
    typeof value.savedAt === 'number'
  );
}
