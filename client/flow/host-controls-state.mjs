/**
 * @typedef {import('./match-phase-state.mjs').Phase} Phase
 *
 * @typedef {{
 *   phase: Phase,
 *   pacing: 'auto' | 'host',
 *   autoReveal?: boolean,
 *   playerCount: number,
 *   locked: boolean,
 * }} HostControlContext
 *
 * @typedef {'start'|'pause'|'resume'|'next'|'reveal'|'lock'|'unlock'|'kick'|'finish'|'rematch'} HostAction
 */

const ACTIVE_PHASES = new Set(['COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD']);
// One host action per round (DECISIONS.md #1): ROUND_RESULT -> SCOREBOARD is
// always timer-driven, even under host pacing. The host only acts from
// SCOREBOARD ("Volgende"), never from ROUND_RESULT.
const WAITING_PHASES = new Set(['SCOREBOARD']);

/**
 * Besluit C: staat "Antwoord automatisch tonen" uit, dan verhuist die ene
 * hostactie naar ROUND_RESULT ("Toon antwoord"). Er komen er dus geen twee —
 * 'next' vervalt dan, precies zoals de server hem dan weigert. Ontbreekt het
 * veld (oudere snapshot, mock), dan geldt de standaard: automatisch tonen aan.
 * @param {HostControlContext} context
 */
function onthultDeHostZelf(context) {
  return context.autoReveal === false;
}

/** @param {HostControlContext} context @returns {HostAction[]} */
export function availableHostActions(context) {
  if (!isContext(context)) {
    return [];
  }

  const { phase } = context;
  if (phase === 'UNINITIALIZED') {
    return [];
  }

  const actions = [];

  if (phase === 'LOBBY' && context.playerCount >= 1) {
    actions.push('start');
  }
  if (ACTIVE_PHASES.has(phase)) {
    actions.push('pause');
  }
  if (phase === 'PAUSED') {
    actions.push('resume');
  }
  if (onthultDeHostZelf(context) && phase === 'ROUND_RESULT') {
    actions.push('reveal');
  }
  if (!onthultDeHostZelf(context) && context.pacing === 'host' && WAITING_PHASES.has(phase)) {
    actions.push('next');
  }
  actions.push(context.locked ? 'unlock' : 'lock');
  if (context.playerCount >= 1) {
    actions.push('kick');
  }
  if (phase !== 'FINISHED') {
    // game:finish's only wire validation (PROTOCOL.md) is "not already FINISHED" —
    // no "game must have started" restriction exists, so LOBBY is included on purpose.
    actions.push('finish');
  } else {
    actions.push('rematch');
  }

  return actions;
}

/**
 * Bouwt de eventpayload voor een actie. Controleert zelf opnieuw of de actie nog
 * beschikbaar is volgens `context` (geen vertrouwen op een verouderde UI-lijst).
 * @param {HostAction} action
 * @param {HostControlContext} context
 * @param {{ playerId?: string, reason?: string }} [params]
 * @returns {{ event: string, payload: object } | null}
 */
export function hostActionRequest(action, context, params) {
  if (!availableHostActions(context).includes(action)) {
    return null;
  }

  const safeParams = params !== null && typeof params === 'object' ? params : {};

  switch (action) {
    case 'start':
      return { event: 'game:start', payload: {} };
    case 'pause':
      return { event: 'game:pause', payload: pausePayload(safeParams) };
    case 'resume':
      return { event: 'game:resume', payload: {} };
    case 'next':
      return { event: 'game:next', payload: {} };
    case 'reveal':
      return { event: 'game:reveal', payload: {} };
    case 'lock':
      return { event: 'game:lock', payload: { locked: true } };
    case 'unlock':
      return { event: 'game:lock', payload: { locked: false } };
    case 'kick':
      return typeof safeParams.playerId === 'string'
        ? { event: 'game:kick', payload: { playerId: safeParams.playerId } }
        : null;
    case 'finish':
      return { event: 'game:finish', payload: {} };
    case 'rematch':
      return { event: 'game:rematch', payload: {} };
    default:
      return null;
  }
}

function pausePayload(params) {
  return typeof params.reason === 'string' ? { reason: params.reason } : {};
}

function isContext(context) {
  return (
    context !== null &&
    typeof context === 'object' &&
    typeof context.phase === 'string' &&
    typeof context.playerCount === 'number' &&
    typeof context.locked === 'boolean'
  );
}
