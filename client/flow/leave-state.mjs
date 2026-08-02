/**
 * @typedef {
 *   | { status: 'idle' }
 *   | { status: 'confirming' }
 *   | { status: 'leaving' }
 *   | { status: 'left' }
 * } LeaveState
 */

/** @returns {LeaveState} */
export function initialLeaveState() {
  return { status: 'idle' };
}

/** @param {LeaveState} state @param {{ type: string }} event @returns {LeaveState} */
export function transition(state, event) {
  if (!isLeaveState(state) || event === null || typeof event !== 'object') {
    return state;
  }

  switch (event.type) {
    case 'REQUEST_LEAVE':
      return state.status === 'idle' ? { status: 'confirming' } : state;

    case 'CANCEL':
      return state.status === 'confirming' ? { status: 'idle' } : state;

    case 'CONFIRM':
      return state.status === 'confirming' ? { status: 'leaving' } : state;

    case 'LEFT':
      return state.status === 'leaving' ? { status: 'left' } : state;

    default:
      return state;
  }
}

/**
 * Wat er nu naar de server moet, of null. Non-null alleen tijdens 'leaving' —
 * zelfde conventie als `joinRequestFor`/`createRequestFor`.
 * @param {LeaveState} state
 * @returns {{} | null}
 */
export function leaveRequestFor(state) {
  return isLeaveState(state) && state.status === 'leaving' ? {} : null;
}

function isLeaveState(state) {
  return state !== null && typeof state === 'object' && typeof state.status === 'string';
}
