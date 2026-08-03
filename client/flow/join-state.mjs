/**
 * @typedef {
 *   | { type: 'invite', inviteId: string, joinSource: 'qr' | 'shared_link' | 'unknown' }
 *   | { type: 'code', code: string }
 * } Locator
 *
 * @typedef {
 *   | { status: 'idle' }
 *   | { status: 'previewing', locator: Locator }
 *   | { status: 'name-entry', locator: Locator, suggestedName: string | null, displayName: string | null }
 *   | { status: 'submitting', locator: Locator, suggestedName: string | null, displayName: string | null }
 *   | { status: 'joined', session: object }
 *   | { status: 'error', stage: 'preview' | 'submit', code: string, locator: Locator, suggestedName: string | null }
 * } JoinState
 */

// DECISIONS.md #7 (2 aug 2026, regie-sessie): a pre-join preview endpoint now
// validates the invite and returns a server-generated name suggestion BEFORE
// `POST /api/v1/games/join`. PROTOCOL.md's finalized contract (GET
// /api/v1/games/preview) is invite-ONLY — no gameCode variant — so a code
// locator skips 'previewing' entirely and goes straight to name-entry with no
// suggestion. This corrects an earlier assumption (symmetric preview for both
// locator types) made before PROTOCOL.md's preview section was written.

// Geëxporteerd (niet alleen intern gebruikt): S04 vraagt een zichtbare teller
// bij de limiet in join.mjs — die hergebruikt dezelfde grens en dezelfde
// segmenter-aanpak, telt niet zelf opnieuw met `.length` (UTF-16-eenheden,
// geen grafemen).
export const NAME_MAX_GRAPHEMES = 20;
const JOIN_SOURCES = new Set(['qr', 'shared_link', 'unknown']);
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** @param {string} value @returns {number} */
export function graphemeCount(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return 0;
  }
  return [...graphemeSegmenter.segment(value)].length;
}

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
    case 'LOCATOR_OBTAINED':
      return state.status === 'idle' ? handleLocatorObtained(event) ?? state : state;

    case 'PREVIEW_SUCCEEDED':
      return state.status === 'previewing'
        ? {
            status: 'name-entry',
            locator: state.locator,
            suggestedName: typeof event.suggestedName === 'string' ? event.suggestedName : null,
            displayName: null,
          }
        : state;

    case 'PREVIEW_FAILED':
      return state.status === 'previewing'
        ? {
            status: 'error',
            stage: 'preview',
            code: normalizeErrorCode(event.code),
            locator: state.locator,
            suggestedName: null,
          }
        : state;

    case 'NAME_CHANGED':
      return state.status === 'name-entry'
        ? { ...state, displayName: sanitizeDisplayName(event.value) }
        : state;

    case 'SUBMIT':
      return state.status === 'name-entry'
        ? {
            status: 'submitting',
            locator: state.locator,
            suggestedName: state.suggestedName,
            displayName: state.displayName,
          }
        : state;

    case 'JOIN_SUCCEEDED':
      return state.status === 'submitting'
        ? { status: 'joined', session: event.session }
        : state;

    case 'JOIN_FAILED':
      return state.status === 'submitting'
        ? {
            status: 'error',
            stage: 'submit',
            code: normalizeErrorCode(event.code),
            locator: state.locator,
            suggestedName: state.suggestedName,
          }
        : state;

    case 'RETRY':
      return handleRetry(state);

    default:
      return state;
  }
}

/**
 * Wat er nu naar `GET /api/v1/games/preview` moet, of null. Non-null alleen
 * tijdens 'previewing' — zelfde in-flight-conventie als `joinRequestFor`.
 * Levert altijd `{ inviteId }`: een code-locator bereikt 'previewing' nooit
 * (zie handleLocatorObtained), dus deze functie hoeft geen gameCode-vorm te
 * kennen.
 * @param {JoinState} state
 * @returns {{ inviteId: string } | null}
 */
export function previewRequestFor(state) {
  if (!isJoinState(state) || state.status !== 'previewing') {
    return null;
  }
  return { inviteId: state.locator.inviteId };
}

/**
 * Wat er nu naar `POST /api/v1/games/join` moet, of null.
 * @param {JoinState} state
 * @returns {{ inviteId?: string, gameCode?: string, displayName: string | null, joinSource: string } | null}
 */
export function joinRequestFor(state) {
  if (!isJoinState(state) || state.status !== 'submitting') {
    return null;
  }

  const { locator, displayName } = state;
  const joinSource = locator.type === 'invite' ? locator.joinSource : 'code';
  return { ...locatorField(locator), displayName, joinSource };
}

function locatorField(locator) {
  return locator.type === 'invite' ? { inviteId: locator.inviteId } : { gameCode: locator.code };
}

function isJoinState(state) {
  return state !== null && typeof state === 'object' && typeof state.status === 'string';
}

function handleLocatorObtained(event) {
  const locator = normalizeLocator(event.locator);
  if (locator === null) {
    return null;
  }
  // PROTOCOL.md's preview endpoint is invite-only. A code locator has no
  // suggestion to fetch, so it skips 'previewing' and lands directly in
  // name-entry, same shape PREVIEW_SUCCEEDED would have produced.
  if (locator.type === 'code') {
    return { status: 'name-entry', locator, suggestedName: null, displayName: null };
  }
  return { status: 'previewing', locator };
}

function handleRetry(state) {
  if (state.status !== 'error') {
    return state;
  }
  if (state.stage === 'preview') {
    return { status: 'previewing', locator: state.locator };
  }
  // stage === 'submit': the preview already ran successfully once, so its
  // suggestion is still valid — only the typed name is cleared, not the whole
  // flow restarted.
  return {
    status: 'name-entry',
    locator: state.locator,
    suggestedName: state.suggestedName,
    displayName: null,
  };
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
// maxlength> UX this feeds.
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
