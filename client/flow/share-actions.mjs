const JOIN_SOURCES = new Set(['qr', 'shared_link']);

/**
 * @param {string} joinUrl De kale joinUrl uit PROTOCOL.md (zonder querystring).
 * @returns {{ qrUrl: string, copyUrl: string }}
 */
export function shareUrlsFor(joinUrl) {
  const base = typeof joinUrl === 'string' ? joinUrl : '';
  return {
    qrUrl: appendSrc(base, 'qr'),
    copyUrl: appendSrc(base, 'shared_link'),
  };
}

/**
 * Inverse van shareUrlsFor: leest de src-parameter terug.
 * @param {string} search bv. `location.search` op de `/j/{inviteId}`-route.
 * @returns {'qr' | 'shared_link' | 'unknown'}
 */
export function joinSourceFor(search) {
  if (typeof search !== 'string' || search.length === 0) {
    return 'unknown';
  }
  const params = new URLSearchParams(search);
  const src = params.get('src');
  return JOIN_SOURCES.has(src) ? src : 'unknown';
}

/**
 * @param {{ nativeShareAvailable: boolean }} capabilities
 * @returns {Array<'show-qr' | 'native-share' | 'copy-link' | 'show-code'>}
 */
export function shareActionsFor(capabilities) {
  const nativeShareAvailable =
    capabilities !== null && typeof capabilities === 'object' && capabilities.nativeShareAvailable === true;

  const actions = ['show-qr'];
  if (nativeShareAvailable) {
    actions.push('native-share');
  }
  actions.push('copy-link', 'show-code');
  return actions;
}

/**
 * Puur informatief (bv. voor een waarschuwing naast de deelknop) — bepaalt niet
 * of de Delen-actie zelf zichtbaar is, die is altijd beschikbaar.
 * @param {{ locked: boolean, allowLateJoin: boolean, gameHasStarted: boolean }} roomState
 * @returns {boolean} of een nieuwe joiner nu via deze link zou kunnen meedoen
 */
export function canNewJoinerUse(roomState) {
  // locked/gameHasStarted must be real booleans, not just falsy-safe: an
  // object missing them entirely (e.g. {}) is malformed input, not "unlocked,
  // not started" — per spec that must resolve to false, not true.
  if (
    roomState === null ||
    typeof roomState !== 'object' ||
    typeof roomState.locked !== 'boolean' ||
    typeof roomState.gameHasStarted !== 'boolean'
  ) {
    return false;
  }
  if (roomState.locked === true) {
    return false;
  }
  if (roomState.gameHasStarted !== true) {
    return true;
  }
  return roomState.allowLateJoin === true;
}

// DECISIONS.md #18: share:opened.method uses exactly these four values.
const SHARE_OPENED_METHODS = new Map([
  ['show-qr', 'qr'],
  ['copy-link', 'link'],
  ['native-share', 'native'],
  ['show-code', 'code'],
]);

/**
 * Vertaalt een deelactie naar de `share:opened.method`-waarde voor PROTOCOL.md.
 * @param {'show-qr' | 'native-share' | 'copy-link' | 'show-code'} action
 * @returns {'qr' | 'link' | 'native' | 'code' | null}
 */
export function shareOpenedMethodFor(action) {
  return SHARE_OPENED_METHODS.get(action) ?? null;
}

function appendSrc(joinUrl, src) {
  const separator = joinUrl.includes('?') ? '&' : '?';
  return `${joinUrl}${separator}src=${src}`;
}
