/**
 * @typedef {
 *   | { type: 'invite', inviteId: string, joinSource: 'qr' | 'shared_link' | 'unknown' }
 *   | { type: 'code', code: string }
 * } Locator
 *
 * @typedef {
 *   | { status: 'idle' }
 *   | { status: 'name-entry', locator: Locator, suggestedName: string | null, displayName: string | null }
 *   | { status: 'submitting', locator: Locator, displayName: string | null }
 *   | { status: 'joined', session: object }
 *   | { status: 'error', code: string, locator: Locator }
 * } JoinState
 */

const NAME_MAX_GRAPHEMES = 20;
const JOIN_SOURCES = new Set(['qr', 'shared_link', 'unknown']);
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** @returns {JoinState} */
export function initialJoinState() {
  return { status: 'idle' };
}

/** @param {JoinState} state @param {object} event @returns {JoinState} */
export function transition(state, event) {
  if (!isJoinState(state) || event === null || typeof event !== 'object') {
    return state;
  }

  switch (event.type) {
    case 'LOCATOR_READY':
      return handleLocatorReady(event) ?? state;

    case 'NAME_CHANGED':
      return state.status === 'name-entry'
        ? { ...state, displayName: sanitizeDisplayName(event.value) }
        : state;

    case 'SUBMIT':
      return state.status === 'name-entry'
        ? { status: 'submitting', locator: state.locator, displayName: state.displayName }
        : state;

    case 'JOIN_SUCCEEDED':
      return state.status === 'submitting'
        ? { status: 'joined', session: event.session }
        : state;

    case 'JOIN_FAILED':
      return state.status === 'submitting'
        ? { status: 'error', code: normalizeErrorCode(event.code), locator: state.locator }
        : state;

    case 'RETRY':
      return state.status === 'error'
        ? { status: 'name-entry', locator: state.locator, suggestedName: null, displayName: null }
        : state;

    default:
      return state;
  }
}

/**
 * Wat er nu naar de server moet, of null als er niets te versturen valt.
 * @param {JoinState} state
 * @returns {{ inviteId?: string, gameCode?: string, displayName: string | null, joinSource: string } | null}
 */
export function joinRequestFor(state) {
  if (!isJoinState(state) || state.status !== 'submitting') {
    return null;
  }

  const { locator, displayName } = state;
  if (locator.type === 'invite') {
    return { inviteId: locator.inviteId, displayName, joinSource: locator.joinSource };
  }
  if (locator.type === 'code') {
    return { gameCode: locator.code, displayName, joinSource: 'code' };
  }
  return null;
}

function isJoinState(state) {
  return state !== null && typeof state === 'object' && typeof state.status === 'string';
}

function handleLocatorReady(event) {
  const locator = normalizeLocator(event.locator);
  if (locator === null) {
    return null;
  }
  const suggestedName = typeof event.suggestedName === 'string' ? event.suggestedName : null;
  return { status: 'name-entry', locator, suggestedName, displayName: null };
}

function normalizeLocator(locator) {
  if (locator === null || typeof locator !== 'object') {
    return null;
  }
  if (locator.type === 'invite' && typeof locator.inviteId === 'string') {
    const joinSource = JOIN_SOURCES.has(locator.joinSource) ? locator.joinSource : 'unknown';
    return { type: 'invite', inviteId: locator.inviteId, joinSource };
  }
  if (locator.type === 'code' && typeof locator.code === 'string') {
    return { type: 'code', code: locator.code };
  }
  return null;
}

function normalizeErrorCode(code) {
  return typeof code === 'string' && code.length > 0 ? code : 'unknown';
}

function sanitizeDisplayName(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  return truncateToGraphemes(value, NAME_MAX_GRAPHEMES);
}

// Chosen behavior for >20 graphemes: silently truncate, not reject. JoinState
// carries no "invalid input" flag, so truncating mirrors the plain <input
// maxlength> UX this feeds and keeps the state shape unchanged.
function truncateToGraphemes(value, limit) {
  let result = '';
  let count = 0;
  for (const { segment } of graphemeSegmenter.segment(value)) {
    if (count >= limit) {
      break;
    }
    result += segment;
    count += 1;
  }
  return result;
}
