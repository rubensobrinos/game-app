// views/home.mjs — UI1. DOM + bedrading van scherm 1 (Home). `host-setup-
// state.mjs` (client/flow) draagt de kernflow quick-start default
// (DECISIONS.md #35: alléén flags_mc); dit bestand dispatcht erop en roept
// ná SUBMIT `transport.createGame` aan. Geavanceerde instellingen
// ("Game instellen") blijven in UI1a ingeklapt — de default werkt zonder ze
// te openen (UI1-home-and-join.md).
//
// Code-invoer slaat scherm 2's preview-stap over (PROTOCOL.md's
// previewendpoint is invite-only) en gaat direct naar het naamveld — dat is
// hetzelfde scherm als een invite-URL zou tonen, dus deze module roept
// `onCodeLocator(locator)` aan in plaats van zelf een naamveld te bouwen; de
// aanroeper (app.mjs) mount daarvoor `views/join.mjs`.

import { initialHostSetupState, transition, createRequestFor } from '../../../client/flow/host-setup-state.mjs';
import { saveSession } from '../../../client/flow/session-store.mjs';
import { messageForErrorCode } from '../../../client/flow/edge-case-messaging.mjs';

const CODE_FORMAT = /^[0-9]{6}$/;

export function createHomeView({ root, t, transport, storage, onNavigate, onCodeLocator }) {
  root.textContent = '';

  const title = el('h1', 'home-title');
  const quickStartButton = document.createElement('button');
  quickStartButton.type = 'button';
  quickStartButton.className = 'home-quick-start';

  const codeLabel = el('label', 'home-code-label');
  const codeInput = document.createElement('input');
  codeInput.type = 'text';
  codeInput.inputMode = 'numeric';
  codeInput.maxLength = 6;
  codeInput.className = 'home-code-input';
  codeLabel.appendChild(codeInput);
  const codeSubmitButton = document.createElement('button');
  codeSubmitButton.type = 'button';
  codeSubmitButton.className = 'home-code-submit';
  const codeError = el('p', 'home-code-error');

  const quickStartError = el('p', 'home-quick-start-error');

  root.append(title, quickStartButton, quickStartError, codeLabel, codeSubmitButton, codeError);

  let state = initialHostSetupState();

  quickStartButton.addEventListener('click', () => {
    if (state.status === 'error') {
      dispatch({ type: 'RETRY' });
    }
    if (state.status !== 'editing') {
      return;
    }
    dispatch({ type: 'SUBMIT' });
    runCreate();
  });

  codeSubmitButton.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (!CODE_FORMAT.test(code)) {
      codeError.textContent = t('home.codeInvalid');
      return;
    }
    codeError.textContent = '';
    onCodeLocator({ type: 'code', code });
  });

  function dispatch(event) {
    state = transition(state, event);
    render();
  }

  async function runCreate() {
    const request = createRequestFor(state);
    if (request === null) {
      return;
    }
    try {
      const response = await transport.createGame(request);
      saveSession(storage, {
        sessionToken: response.sessionToken,
        roomCode: response.gameCode,
        playerId: response.playerId,
        savedAt: Date.now(),
      });
      dispatch({ type: 'CREATE_SUCCEEDED' });
      onNavigate(`/host/${response.gameCode}`);
    } catch (err) {
      dispatch({ type: 'CREATE_FAILED', errorCode: err?.code });
    }
  }

  function render() {
    title.textContent = t('home.title');
    quickStartButton.textContent = t('home.quickStart');
    quickStartButton.disabled = state.status === 'creating';
    codeLabel.hidden = state.status === 'creating';
    codeSubmitButton.hidden = state.status === 'creating';
    codeSubmitButton.textContent = t('home.codeSubmit');
    quickStartError.textContent = state.status === 'error' ? messageForErrorCode(state.errorCode) : '';
  }

  render();

  return { render };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
