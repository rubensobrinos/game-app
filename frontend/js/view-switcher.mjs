// view-switcher.mjs — UI0. Pure koppeling tussen `route-resolver`'s route en
// `match-phase-state`'s fase naar "welke view-module tonen". Bevat zelf geen
// routerings- of overgangslogica — die blijft in `client/flow/`
// (`route-resolver.mjs`, `match-phase-state.mjs`); dit bestand hergebruikt
// alleen hun uitkomst (`route`, `phase`) via een simpele context-vorm zodat
// het geen afhankelijkheid nodig heeft op die modules zelf.
//
// Contract: docs/frontend-plan/prompts/UI0-scaffold.md §Viewswitcher.

/**
 * @typedef {'home' | 'preview-join' | 'lobby' | 'gameplay' | 'scoreboard' | 'podium' | 'unknown'} ViewName
 */

const GAMEPLAY_PHASES = new Set(['COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT']);

/**
 * @param {{ route: string, phase?: string, pausedState?: { previousPhase: string } | null }} context
 * @returns {ViewName}
 */
export function viewFor(context) {
  if (!isContext(context)) {
    return 'unknown';
  }

  const { route } = context;

  if (route === 'home') {
    return 'home';
  }

  if (route === 'join') {
    return 'preview-join';
  }

  if (route === 'game' || route === 'host') {
    return hasActiveSession(context.phase)
      ? viewForPhase(context.phase, context.pausedState)
      : 'preview-join';
  }

  // route: 'screen' (spectators, buiten scope — DECISIONS.md #9) en elke
  // andere/onbekende route-waarde (incl. 'unknown' van route-resolver zelf)
  // vallen allebei terug op 'unknown'.
  return 'unknown';
}

/**
 * "Een lopende sessie" betekent hier: `match-phase-state` heeft ooit een
 * serverevent verwerkt en is voorbij zijn `initialMatchPhaseState()`
 * (`phase: 'UNINITIALIZED'`). Vóór dat moment (of zonder `phase` erbij) is er
 * niets om op de fase te routeren, dus telt dat als "geen lopende sessie".
 * @param {string | undefined} phase
 */
function hasActiveSession(phase) {
  return typeof phase === 'string' && phase !== 'UNINITIALIZED';
}

/**
 * @param {string} phase
 * @param {{ previousPhase: string } | null | undefined} pausedState
 * @returns {ViewName}
 */
function viewForPhase(phase, pausedState) {
  if (phase === 'LOBBY') {
    return 'lobby';
  }
  if (GAMEPLAY_PHASES.has(phase)) {
    return 'gameplay';
  }
  if (phase === 'SCOREBOARD') {
    return 'scoreboard';
  }
  if (phase === 'FINISHED') {
    return 'podium';
  }
  if (phase === 'PAUSED') {
    // Gecorrigeerd na review: pauzeren is een normale MVP-flow (DECISIONS.md
    // #10/#11), geen onbekende toestand. De onderliggende view blijft
    // getoond — een pauze-overlay erbovenop is UI5-werk (hostbalk), niet iets
    // wat de viewswitcher zelf tekent. Alleen als `pausedState` of
    // `previousPhase` ontbreekt (zou niet moeten gebeuren, match-phase-state
    // zet 'm altijd bij PAUSED) valt dit defensief terug op 'unknown' in
    // plaats van te gokken.
    const previousPhase = pausedState?.previousPhase;
    return typeof previousPhase === 'string' && previousPhase !== 'PAUSED'
      ? viewForPhase(previousPhase, null)
      : 'unknown';
  }
  return 'unknown';
}

function isContext(context) {
  return context !== null && typeof context === 'object' && typeof context.route === 'string';
}
