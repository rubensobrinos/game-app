/**
 * @typedef {{
 *   preset: string,
 *   gameTypes: string[],
 *   language: string,
 *   difficulty: string,
 *   totalRounds: number,
 *   pacing: 'auto' | 'host',
 *   speedBonus: boolean,
 *   allowLateJoin: boolean,
 *   mode: 'individual',
 * }} HostConfig
 *
 * @typedef {{
 *   mode: 'quick-start' | 'advanced',
 *   config: HostConfig,
 *   hostParticipates: boolean,
 *   displayName: string | null,
 *   status: 'editing' | 'creating' | 'created' | 'error',
 *   errorCode: string | null,
 * }} HostSetupState
 */

// Kernflow quick-start default (DECISIONS.md #31/#32/#35, 2 aug 2026,
// regie-sessie): Groepsbattle and mixed games are NOT built for this MVP —
// one gameType (flags_mc) only, matching the confirmed "10 vragen over
// vlaggen" quick-start promise. This supersedes the earlier "4 vs 5
// spelvormen" PRODUCT.md/DATA-MODEL.md conflict entirely (see the retired
// GF2b note) — no partial preset survives, so `shared/product/
// quick-start-preset.mjs`'s GROUP_BATTLE_DEFAULT_GAME_TYPES (4 types) is now
// stale and intentionally NOT imported here; flagged for its owner rather
// than edited directly, since only this module consumed it.
//
// `preset: 'default'` is a placeholder wire value, not a confirmed contract:
// DECISIONS.md retires the "group_battle" preset id but doesn't name a
// replacement — a judgment call pending confirmation, same category as GF8's
// other open interface questions.
function defaultHostConfig() {
  return {
    preset: 'default',
    gameTypes: ['flags_mc'],
    language: 'nl',
    difficulty: 'normal',
    totalRounds: 10,
    pacing: 'auto',
    speedBonus: true,
    allowLateJoin: true,
    mode: 'individual',
  };
}

const SETTABLE_CONFIG_KEYS = new Set([
  'gameTypes',
  'language',
  'difficulty',
  'totalRounds',
  'pacing',
  'speedBonus',
  'allowLateJoin',
  'mode',
]);

const NAME_MAX_GRAPHEMES = 20;
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Start altijd met de kernflow quick-start default (DECISIONS.md #35). @returns {HostSetupState} */
export function initialHostSetupState() {
  return {
    mode: 'quick-start',
    config: defaultHostConfig(),
    hostParticipates: true,
    displayName: null,
    status: 'editing',
    errorCode: null,
  };
}

/** @param {HostSetupState} state @param {object} event @returns {HostSetupState} */
export function transition(state, event) {
  if (!isHostSetupState(state) || event === null || typeof event !== 'object') {
    return state;
  }

  switch (event.type) {
    case 'OPEN_ADVANCED':
      return state.status === 'editing' ? { ...state, mode: 'advanced' } : state;

    // Prompt 09 (S02): "teruggaan verliest geen keuzes" — alleen `mode` gaat
    // terug naar 'quick-start', config/displayName/hostParticipates blijven
    // ongewijzigd. Symmetrisch met OPEN_ADVANCED, geen reset.
    case 'CLOSE_ADVANCED':
      return state.status === 'editing' ? { ...state, mode: 'quick-start' } : state;

    case 'SET_FIELD':
      return state.status === 'editing' && SETTABLE_CONFIG_KEYS.has(event.key)
        ? { ...state, config: { ...state.config, [event.key]: event.value } }
        : state;

    case 'TOGGLE_HOST_PARTICIPATES':
      return state.status === 'editing' ? toggleHostParticipates(state) : state;

    case 'NAME_CHANGED':
      return state.status === 'editing'
        ? { ...state, displayName: sanitizeDisplayName(event.value) }
        : state;

    case 'SUBMIT':
      return state.status === 'editing'
        ? { ...state, status: 'creating', errorCode: null }
        : state;

    case 'CREATE_SUCCEEDED':
      return state.status === 'creating'
        ? { ...state, status: 'created', errorCode: null }
        : state;

    case 'CREATE_FAILED':
      return state.status === 'creating'
        ? { ...state, status: 'error', errorCode: normalizeErrorCode(event.errorCode) }
        : state;

    case 'RETRY':
      return state.status === 'error'
        ? { ...state, status: 'editing', displayName: null, errorCode: null }
        : state;

    default:
      return state;
  }
}

/**
 * Wat er nu naar de server moet, of null als er niets te versturen valt. Alleen
 * non-null tijdens 'creating' — hetzelfde moment als join-state's
 * `joinRequestFor` tijdens 'submitting' — zodat een aanroeper altijd hetzelfde
 * patroon gebruikt: dispatch SUBMIT, vraag daarna pas het verzoek op.
 * @param {HostSetupState} state
 * @returns {{ config: HostConfig, hostParticipates: boolean, displayName: string | null } | null}
 */
export function createRequestFor(state) {
  if (!isHostSetupState(state) || state.status !== 'creating') {
    return null;
  }

  return {
    config: { ...state.config, gameTypes: [...state.config.gameTypes] },
    hostParticipates: state.hostParticipates,
    displayName: state.hostParticipates ? state.displayName : null,
  };
}

function isHostSetupState(state) {
  return state !== null && typeof state === 'object' && typeof state.status === 'string';
}

// A host who stops participating never has a stale name sent for them
// (GAME-FLOW.md §Hostflow); toggling back on does not resurrect it — the
// player types again, no surprising cache.
function toggleHostParticipates(state) {
  const hostParticipates = !state.hostParticipates;
  return { ...state, hostParticipates, displayName: hostParticipates ? state.displayName : null };
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

// Same rule and counting approach as join-state (GF2a): grapheme clusters via
// Intl.Segmenter, truncate rather than reject past the limit.
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
