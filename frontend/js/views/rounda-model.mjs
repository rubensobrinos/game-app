// views/rounda-model.mjs — Rounda, de lobby-minigame (BOUWTICKET-rondo-
// lobbygame.md). Pure logica: rotatie, vangen/missen, streak/tempo. Geen
// DOM, geen timers — dat zit in rounda.mjs, zelfde scheiding als round-
// model.mjs/reveal-model.mjs.
//
// Spelidee: het rad heeft twee openingen, 180° uit elkaar (rounda.css'
// conic-gradient) — de bovenste (wheel-lokaal 0°) heeft cyaan-zijkanten, de
// onderste (wheel-lokaal 180°) magenta. De bal valt altijd recht naar
// beneden (vaste `.rounda-drop-line`); de speler draait het rad zodat de
// opening met de kleur van de bal onder die lijn staat op het moment dat de
// bal landt. (`--rounda-*` is rounda.css's eigen naamgeving, niet de onze —
// zie rounda.mjs.)

// --rounda-opening (rounda.css) — vast op 14% van de omtrek, NIET dynamisch
// maken (expliciet buiten scope). Vangen = binnen de halve openingsbreedte
// van het middelpunt van de juiste kleur-opening.
const OPENING_FRACTION = 0.14;
const OPENING_HALF_DEG = (OPENING_FRACTION * 360) / 2;

const CYAN_CENTER_DEG = 0;
const MAGENTA_CENTER_DEG = 180;

// --rounda-fall-duration (rounda.css) — korter bij hogere streak, geclamped
// zodat het nooit onspeelbaar snel wordt.
const MIN_FALL_MS = 700;
const MAX_FALL_MS = 1600;
const FALL_MS_PER_STREAK = 80;

/** @returns {{phase: 'idle'|'waiting'|'falling'|'result', angleDeg: number, ballColor: 'cyan'|'magenta', streak: number, best: number, lastOutcome: 'catch'|'miss'|null}} */
export function initialRoundaState() {
  return Object.freeze({
    phase: 'idle',
    angleDeg: 0,
    ballColor: 'cyan',
    streak: 0,
    best: 0,
    lastOutcome: null,
  });
}

/** Attract-stand → spel, bij de eerste aanraking. */
export function start(state) {
  if (state.phase !== 'idle') {
    return state;
  }
  return { ...state, phase: 'waiting' };
}

/** Veeg-input — toegestaan tijdens `waiting` én `falling` (tot het landt). */
export function rotate(state, deltaDeg) {
  if (state.phase !== 'waiting' && state.phase !== 'falling') {
    return state;
  }
  if (typeof deltaDeg !== 'number' || !Number.isFinite(deltaDeg)) {
    return state;
  }
  return { ...state, angleDeg: normalizeAngle(state.angleDeg + deltaDeg) };
}

/** Bal begint te vallen (rounda.mjs bepaalt wannéér, na de wachttijd). */
export function drop(state) {
  if (state.phase !== 'waiting') {
    return state;
  }
  return { ...state, phase: 'falling' };
}

/** Bal landt — bepaalt vangen/missen en werkt streak/best bij. */
export function land(state) {
  if (state.phase !== 'falling') {
    return state;
  }
  const outcome = roundaOutcomeFor({ angleDeg: state.angleDeg, ballColor: state.ballColor });
  const streak = outcome === 'catch' ? state.streak + 1 : 0;
  const best = Math.max(state.best, streak);
  return { ...state, phase: 'result', lastOutcome: outcome, streak, best };
}

/** Ná de korte vang/mis-feedback: nieuwe bal, wisselt van kleur. */
export function nextRound(state) {
  if (state.phase !== 'result') {
    return state;
  }
  return {
    ...state,
    phase: 'waiting',
    ballColor: state.ballColor === 'cyan' ? 'magenta' : 'cyan',
    lastOutcome: null,
  };
}

/**
 * Puur: gegeven een rotatiehoek en de balkleur, ving of mis? Los van state
 * zodat dit zelfstandig te testen is met elke hoek/kleurcombinatie.
 * @param {{angleDeg: number, ballColor: 'cyan'|'magenta'}} input
 * @returns {'catch'|'miss'}
 */
export function roundaOutcomeFor({ angleDeg, ballColor }) {
  const center = ballColor === 'magenta' ? MAGENTA_CENTER_DEG : CYAN_CENTER_DEG;
  const distance = angularDistance(normalizeAngle(angleDeg), center);
  return distance <= OPENING_HALF_DEG ? 'catch' : 'miss';
}

/** `--rounda-fall-duration` in ms — korter naarmate de streak stijgt. */
export function fallDurationMsFor(streak) {
  const validStreak = typeof streak === 'number' && streak >= 0 ? Math.floor(streak) : 0;
  return Math.max(MIN_FALL_MS, MAX_FALL_MS - validStreak * FALL_MS_PER_STREAK);
}

function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

function angularDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}
