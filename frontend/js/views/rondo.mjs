// views/rondo.mjs — Rondo, de lobby-minigame (BOUWTICKET-rondo-lobbygame.md).
// DOM-laag; alle spelregels zitten in rondo-model.mjs (puur, getest). Volgt
// het DOM-contract in frontend/css/rondo.css's kop letterlijk — die CSS is
// af en wordt hier niet aangepast.
//
// Aansturing: `--rondo-angle` op `.rondo-wheel` (transform, geen keyframes
// in spelmodus), `--rondo-ball-color` op `.rondo-ball`, `--rondo-fall-
// duration` korter bij hogere streak. Opening blijft vast op 14% (buiten
// scope, zie CSS-kop).
//
// "Overal waar je wacht, nergens waar je speelt" (producteigenaar, 3 aug):
// dit component NOOIT mounten tijdens een actieve ronde — dat is aan de
// aanroeper (lobby/pauze-overlay/reconnect/podium), niet aan dit bestand.

import {
  initialRondoState,
  start,
  rotate,
  drop,
  land,
  nextRound,
  fallDurationMsFor,
} from './rondo-model.mjs';

// Wachttijd vóór de bal valt (bob-fase) — geen vaste spec in het ticket,
// kort genoeg om niet traag te voelen, lang genoeg om te kunnen richten.
const WAITING_MS = 900;
// Hoe lang de vang/mis-feedback zichtbaar blijft vóór de volgende bal.
const RESULT_PAUSE_MS = 550;
// Swipe-gevoeligheid: graden rotatie per pixel horizontale beweging.
const DEG_PER_PIXEL = 0.6;

export function createRondoView({ root }) {
  root.textContent = '';

  const rondo = el('div', 'rondo');
  const ball = el('div', 'rondo-ball rondo-ball--waiting');
  const dropLine = el('div', 'rondo-drop-line');
  const wheel = el('div', 'rondo-wheel rondo-wheel--idle');
  const ring = el('div', 'rondo-wheel__ring');
  const hole = el('div', 'rondo-wheel__hole');
  const core = el('div', 'rondo-wheel__core');
  hole.appendChild(core);
  const gateTop = el('div', 'rondo-gate rondo-gate--top');
  gateTop.append(el('span', 'rondo-gate__edge'), el('span', 'rondo-gate__edge'));
  const gateBottom = el('div', 'rondo-gate rondo-gate--bottom');
  gateBottom.append(el('span', 'rondo-gate__edge'), el('span', 'rondo-gate__edge'));
  wheel.append(ring, hole, gateTop, gateBottom);
  rondo.append(ball, dropLine, wheel);
  root.appendChild(rondo);

  let state = initialRondoState();
  let waitingTimer = null;
  let resultTimer = null;
  let pointerStartX = null;
  let pointerActive = false;

  function clearTimers() {
    clearTimeout(waitingTimer);
    clearTimeout(resultTimer);
    waitingTimer = null;
    resultTimer = null;
  }

  function render() {
    wheel.style.setProperty('--rondo-angle', `${state.angleDeg}deg`);
    wheel.classList.toggle('rondo-wheel--idle', state.phase === 'idle');
    wheel.classList.toggle('rondo-wheel--catch', state.phase === 'result' && state.lastOutcome === 'catch');
    wheel.classList.toggle('rondo-wheel--miss', state.phase === 'result' && state.lastOutcome === 'miss');

    ball.style.setProperty('--rondo-ball-color', state.ballColor === 'cyan' ? 'var(--rondo-cyan)' : 'var(--rondo-magenta)');
    ball.classList.toggle('rondo-ball--waiting', state.phase === 'waiting' || state.phase === 'idle');
    ball.classList.toggle('rondo-ball--falling', state.phase === 'falling');

    if (state.phase === 'falling') {
      wheel.style.setProperty('--rondo-fall-duration', `${fallDurationMsFor(state.streak)}ms`);
    }
  }

  function dispatch(next) {
    state = next;
    render();
  }

  function beginWaitingPhase() {
    clearTimeout(waitingTimer);
    waitingTimer = setTimeout(() => {
      dispatch(drop(state));
      // `animationend` op de bal (niet een tweede timer) bepaalt wanneer
      // 'm landt — zo blijft dit correct ook als reduced motion de
      // `--rondo-fall-duration` via M0's blanket-regel bijna op 0 zet.
    }, WAITING_MS);
  }

  ball.addEventListener('animationend', (event) => {
    if (event.animationName === 'rondo-fall' && state.phase === 'falling') {
      dispatch(land(state));
      clearTimeout(resultTimer);
      resultTimer = setTimeout(() => {
        dispatch(nextRound(state));
        beginWaitingPhase();
      }, RESULT_PAUSE_MS);
    }
  });

  function handlePointerDown(event) {
    if (state.phase === 'idle') {
      dispatch(start(state));
      beginWaitingPhase();
    }
    pointerActive = true;
    pointerStartX = event.clientX;
    rondo.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!pointerActive || pointerStartX === null) {
      return;
    }
    const deltaX = event.clientX - pointerStartX;
    pointerStartX = event.clientX;
    dispatch(rotate(state, deltaX * DEG_PER_PIXEL));
  }

  function handlePointerUp() {
    pointerActive = false;
    pointerStartX = null;
  }

  rondo.addEventListener('pointerdown', handlePointerDown);
  rondo.addEventListener('pointermove', handlePointerMove);
  rondo.addEventListener('pointerup', handlePointerUp);
  rondo.addEventListener('pointercancel', handlePointerUp);

  render();

  return {
    /** Ontkoppelt timers/luisteraars — aanroepen bij unmount (fase- of
     * scherm-wissel), anders blijft een `setTimeout` een losstaand
     * component-object in leven. */
    destroy() {
      clearTimers();
      rondo.removeEventListener('pointerdown', handlePointerDown);
      rondo.removeEventListener('pointermove', handlePointerMove);
      rondo.removeEventListener('pointerup', handlePointerUp);
      rondo.removeEventListener('pointercancel', handlePointerUp);
    },
  };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
