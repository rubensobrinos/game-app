// views/rounda.mjs — Rounda, de lobby-minigame (BOUWTICKET-rondo-
// lobbygame.md). DOM-laag; alle spelregels zitten in rounda-model.mjs
// (puur, getest). Volgt het DOM-contract in frontend/css/rounda.css's kop
// letterlijk.
//
// Aansturing: `--rounda-angle` op `.rounda-wheel` (transform, geen
// keyframes in spelmodus), `--rounda-ball-color` op `.rounda-ball`,
// `--rounda-fall-duration` korter bij hogere streak. Opening blijft vast
// op 14% (buiten scope, zie CSS-kop).
//
// "Overal waar je wacht, nergens waar je speelt" (producteigenaar, 3 aug):
// dit component NOOIT mounten tijdens een actieve ronde — dat is aan de
// aanroeper (lobby/pauze-overlay/reconnect/podium), niet aan dit bestand.

import {
  initialRoundaState,
  start,
  rotate,
  drop,
  land,
  nextRound,
  fallDurationMsFor,
} from './rounda-model.mjs';

// Wachttijd vóór de bal valt (bob-fase) — geen vaste spec in het ticket,
// kort genoeg om niet traag te voelen, lang genoeg om te kunnen richten.
const WAITING_MS = 900;
// Hoe lang de vang/mis-feedback zichtbaar blijft vóór de volgende bal.
const RESULT_PAUSE_MS = 550;
// Swipe-gevoeligheid: graden rotatie per pixel horizontale beweging.
const DEG_PER_PIXEL = 0.6;

export function createRoundaView({ root }) {
  root.textContent = '';

  const roundaWrapper = el('div', 'rounda');
  const ball = el('div', 'rounda-ball rounda-ball--waiting');
  const dropLine = el('div', 'rounda-drop-line');
  const wheel = el('div', 'rounda-wheel rounda-wheel--idle');
  const ring = el('div', 'rounda-wheel__ring');
  const hole = el('div', 'rounda-wheel__hole');
  const core = el('div', 'rounda-wheel__core');
  hole.appendChild(core);
  const gateTop = el('div', 'rounda-gate rounda-gate--top');
  gateTop.append(el('span', 'rounda-gate__edge'), el('span', 'rounda-gate__edge'));
  const gateBottom = el('div', 'rounda-gate rounda-gate--bottom');
  gateBottom.append(el('span', 'rounda-gate__edge'), el('span', 'rounda-gate__edge'));
  wheel.append(ring, hole, gateTop, gateBottom);
  roundaWrapper.append(ball, dropLine, wheel);
  root.appendChild(roundaWrapper);

  let state = initialRoundaState();
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
    wheel.style.setProperty('--rounda-angle', `${state.angleDeg}deg`);
    wheel.classList.toggle('rounda-wheel--idle', state.phase === 'idle');
    wheel.classList.toggle('rounda-wheel--catch', state.phase === 'result' && state.lastOutcome === 'catch');
    wheel.classList.toggle('rounda-wheel--miss', state.phase === 'result' && state.lastOutcome === 'miss');

    ball.style.setProperty('--rounda-ball-color', state.ballColor === 'cyan' ? 'var(--rounda-cyan)' : 'var(--rounda-magenta)');
    ball.classList.toggle('rounda-ball--waiting', state.phase === 'waiting' || state.phase === 'idle');
    ball.classList.toggle('rounda-ball--falling', state.phase === 'falling');

    if (state.phase === 'falling') {
      wheel.style.setProperty('--rounda-fall-duration', `${fallDurationMsFor(state.streak)}ms`);
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
      // `--rounda-fall-duration` via M0's blanket-regel bijna op 0 zet.
    }, WAITING_MS);
  }

  ball.addEventListener('animationend', (event) => {
    if (event.animationName === 'rounda-fall' && state.phase === 'falling') {
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
    roundaWrapper.setPointerCapture?.(event.pointerId);
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

  roundaWrapper.addEventListener('pointerdown', handlePointerDown);
  roundaWrapper.addEventListener('pointermove', handlePointerMove);
  roundaWrapper.addEventListener('pointerup', handlePointerUp);
  roundaWrapper.addEventListener('pointercancel', handlePointerUp);

  render();

  return {
    /** Ontkoppelt timers/luisteraars — aanroepen bij unmount (fase- of
     * scherm-wissel), anders blijft een `setTimeout` een losstaand
     * component-object in leven. */
    destroy() {
      clearTimers();
      roundaWrapper.removeEventListener('pointerdown', handlePointerDown);
      roundaWrapper.removeEventListener('pointermove', handlePointerMove);
      roundaWrapper.removeEventListener('pointerup', handlePointerUp);
      roundaWrapper.removeEventListener('pointercancel', handlePointerUp);
    },
  };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
