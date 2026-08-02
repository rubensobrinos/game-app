// views/join.mjs — UI1. DOM + bedrading van scherm 2 (Preview + join).
// `join-state.mjs` (client/flow) is de enige plek met flowlogica; dit bestand
// dispatcht erop, roept ná elke SUBMIT/PREVIEW-stap de bijbehorende
// `transport`-functie aan, en tekent alleen wat de reducer teruggeeft.
//
// Bereikbaar via twee paden (UI1-home-and-join.md scherm 2):
//   - een invite-URL (`/j/{inviteId}`): start(locator) met een
//     `{ type: 'invite', inviteId, joinSource }`-locator → preview eerst.
//   - de code-invoer op het homescherm: start(locator) met
//     `{ type: 'code', code }` → slaat preview over (PROTOCOL.md's
//     previewendpoint is invite-only), toont dit scherm meteen met een leeg
//     naamveld, geen aparte tussenstap.
//
// Gebruik: const view = createJoinView({ root, t, transport, storage, onJoined });
// view.start(locator) begint de flow; onJoined({ sessionToken, roomCode,
// playerId }) wordt aangeroepen ná een geslaagde join — de aanroeper (app.mjs)
// bepaalt wat daarna gebeurt (navigeren), niet dit bestand.

import { initialJoinState, transition, previewRequestFor, joinRequestFor } from '../../../client/flow/join-state.mjs';
import { saveSession } from '../../../client/flow/session-store.mjs';
import { messageForErrorCode } from '../../../client/flow/edge-case-messaging.mjs';

export function createJoinView({ root, t, transport, storage, onJoined }) {
  root.textContent = '';

  const screen = el('div', 'screen join-screen');
  const title = el('h1', 'join-title');
  const status = el('p', 'join-status');
  const nameLabel = el('label', 'join-name-label field-label');
  const nameLabelText = el('span', 'field-label-text');
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'join-name-input field-input';
  nameInput.maxLength = 60; // grapheme-afkap gebeurt in join-state, dit is alleen een ruime UI-grens
  nameInput.placeholder = t('join.namePlaceholder');
  nameLabel.append(nameLabelText, nameInput);
  const errorMessage = el('p', 'join-error field-error');
  const submitButton = document.createElement('button');
  submitButton.type = 'button';
  submitButton.className = 'join-submit btn-primary';
  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'join-retry btn-secondary';

  screen.append(title, status, nameLabel, errorMessage, submitButton, retryButton);
  root.append(screen);

  let state = initialJoinState();

  nameInput.addEventListener('input', () => {
    dispatch({ type: 'NAME_CHANGED', value: nameInput.value });
  });

  submitButton.addEventListener('click', () => {
    if (state.status !== 'name-entry') {
      return;
    }
    dispatch({ type: 'SUBMIT' });
    runJoin();
  });

  retryButton.addEventListener('click', () => {
    dispatch({ type: 'RETRY' });
    if (state.status === 'previewing') {
      runPreview();
    }
  });

  function dispatch(event) {
    state = transition(state, event);
    render();
  }

  async function runPreview() {
    const request = previewRequestFor(state);
    if (request === null) {
      return;
    }
    try {
      const preview = await transport.previewInvite(request.inviteId);
      dispatch({ type: 'PREVIEW_SUCCEEDED', suggestedName: preview.suggestedName });
    } catch (err) {
      dispatch({ type: 'PREVIEW_FAILED', code: err?.code });
    }
  }

  async function runJoin() {
    const request = joinRequestFor(state);
    if (request === null) {
      return;
    }
    try {
      const response = await transport.joinGame(request);
      saveSession(storage, {
        sessionToken: response.sessionToken,
        roomCode: response.gameCode,
        playerId: response.playerId,
        savedAt: Date.now(),
      });
      dispatch({ type: 'JOIN_SUCCEEDED', session: response });
      onJoined(response);
    } catch (err) {
      dispatch({ type: 'JOIN_FAILED', code: err?.code });
    }
  }

  function render() {
    title.textContent = t('join.title');
    errorMessage.textContent = '';
    retryButton.hidden = true;
    submitButton.hidden = true;
    nameLabel.hidden = true;

    if (state.status === 'previewing') {
      status.textContent = t('join.previewing');
      return;
    }

    if (state.status === 'name-entry' || state.status === 'submitting') {
      status.textContent = state.status === 'submitting' ? t('join.submitting') : '';
      nameLabel.hidden = false;
      nameLabelText.textContent = t('join.nameLabel');
      // Voorinvullen, niet als placeholder (harde regel 2: één tik moet
      // volstaan zonder te typen) — alleen bij het eerste render van dit
      // status, anders overschrijft elke render de eigen typeactie.
      if (nameInput.dataset.prefilledFor !== state.locator.type + (state.suggestedName ?? '')) {
        nameInput.value = state.displayName ?? state.suggestedName ?? '';
        nameInput.dataset.prefilledFor = state.locator.type + (state.suggestedName ?? '');
      }
      submitButton.hidden = false;
      submitButton.disabled = state.status === 'submitting';
      submitButton.textContent = t('join.submit');
      return;
    }

    if (state.status === 'error') {
      status.textContent = '';
      errorMessage.textContent = messageForErrorCode(state.code);
      retryButton.hidden = false;
      retryButton.textContent = t('join.retry');
      return;
    }

    if (state.status === 'joined') {
      status.textContent = t('join.joined');
    }
  }

  return {
    start(locator) {
      state = initialJoinState();
      dispatch({ type: 'LOCATOR_OBTAINED', locator });
      if (state.status === 'previewing') {
        runPreview();
      }
    },
    // Ná een taalwissel (app-menu.mjs) — ververst labels/knoppen zonder de
    // reducerstate (typed naam, locator) te resetten.
    render,
  };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
