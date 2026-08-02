/**
 * @typedef {{
 *   status: 'connected' | 'disconnected' | 'reconnecting',
 *   attempt: number,
 *   pendingSnapshotRequest: boolean,
 * }} ReconnectState
 */

/** @returns {ReconnectState} */
export function initialReconnectState() {
  return { status: 'connected', attempt: 0, pendingSnapshotRequest: false };
}

/** @param {ReconnectState} state @param {{ type: string }} event @returns {ReconnectState} */
export function transition(state, event) {
  if (!isReconnectState(state) || event === null || typeof event !== 'object') {
    return state;
  }

  switch (event.type) {
    // Always attempt: 0, regardless of the previous status (see backoff reset
    // rationale below) — a fresh disconnect never compounds onto a prior run
    // of failed attempts, even one already in flight.
    case 'DISCONNECTED':
      return { status: 'disconnected', attempt: 0, pendingSnapshotRequest: false };

    case 'RECONNECT_ATTEMPT_STARTED':
      return state.status === 'disconnected'
        ? { ...state, status: 'reconnecting', attempt: state.attempt + 1 }
        : state;

    // A late RECONNECT_FAILED for an attempt already overtaken by success
    // (status === 'connected') is ignored — never let a stale failure signal
    // disturb a connection that has since recovered.
    case 'RECONNECT_FAILED':
      return state.status === 'reconnecting' ? { ...state, status: 'disconnected' } : state;

    // Unconditional pendingSnapshotRequest: true — PROTOCOL.md point 5 asks
    // for a snapshot after every reconnection, no exception for a brief drop.
    case 'RECONNECT_SUCCEEDED':
      return state.status === 'reconnecting'
        ? { status: 'connected', attempt: 0, pendingSnapshotRequest: true }
        : state;

    case 'SNAPSHOT_REQUEST_SENT':
      return state.pendingSnapshotRequest ? { ...state, pendingSnapshotRequest: false } : state;

    default:
      return state;
  }
}

/**
 * Zuivere backoff-formule, geen timer. `attempt` is 1-based (de eerstvolgende poging).
 * @param {number} attempt
 * @returns {number} vertraging in milliseconden
 */
export function backoffDelayMs(attempt) {
  const validAttempt = typeof attempt === 'number' && Number.isFinite(attempt) && attempt >= 1;
  const step = validAttempt ? Math.floor(attempt) : 1;
  return Math.min(1000 * 2 ** (step - 1), 30000);
}

/**
 * Wat er nu moet gebeuren, of null. Nooit meer dan één actie tegelijk: eerst
 * reconnecten, dan (na RECONNECT_SUCCEEDED) pas de snapshotaanvraag.
 * @param {ReconnectState} state
 * @returns
 *   | { type: 'schedule-reconnect', delayMs: number }
 *   | { type: 'request-snapshot' }
 *   | null
 */
export function nextActionFor(state) {
  if (!isReconnectState(state)) {
    return null;
  }
  if (state.status === 'disconnected') {
    return { type: 'schedule-reconnect', delayMs: backoffDelayMs(state.attempt + 1) };
  }
  if (state.status === 'connected' && state.pendingSnapshotRequest) {
    return { type: 'request-snapshot' };
  }
  return null;
}

function isReconnectState(state) {
  return state !== null && typeof state === 'object' && typeof state.status === 'string';
}
