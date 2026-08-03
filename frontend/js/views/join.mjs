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
// Gebruik: const view = createJoinView({ root, t, tCount, transport, storage, onJoined });
// view.start(locator) begint de flow; onJoined({ sessionToken, roomCode,
// playerId }) wordt aangeroepen ná een geslaagde join — de aanroeper (app.mjs)
// bepaalt wat daarna gebeurt (navigeren), niet dit bestand.

import {
  initialJoinState,
  transition,
  previewRequestFor,
  joinRequestFor,
  graphemeCount,
  NAME_MAX_GRAPHEMES,
} from '../../../client/flow/join-state.mjs';
import { saveSession } from '../../../client/flow/session-store.mjs';
import { messageForErrorCode, joinErrorCategoryFor } from '../../../client/flow/edge-case-messaging.mjs';

export function createJoinView({ root, t, tCount, transport, storage, onJoined, onLeaveHome }) {
  root.textContent = '';

  const screen = el('div', 'screen join-screen');
  const title = el('h1', 'join-title');
  const status = el('p', 'join-status');
  // Puur presentationeel, geen flowbeslissing — hoort daarom niet in
  // join-state.mjs's reducer (T4-4 §2). Gereset in start(), gezet zodra de
  // preview binnenkomt; alleen ooit niet-null ná een uitnodigingslink, want
  // een code-locator doorloopt 'previewing' nooit (join-state.mjs).
  let previewPlayerCount = null;
  const waitingCount = el('p', 'join-waiting-count');
  const nameLabel = el('label', 'join-name-label field-label');
  const nameLabelText = el('span', 'field-label-text');
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'join-name-input field-input';
  nameInput.maxLength = 60; // grapheme-afkap gebeurt in join-state, dit is alleen een ruime UI-grens
  nameInput.placeholder = t('join.namePlaceholder');
  // "Hoe noemen we je?" leest op zichzelf als verplicht — deze regel maakt
  // zichtbaar dat leeg laten geldig is (reviewfeedback T4-1 punt 6).
  const nameOptionalHint = el('span', 'field-label-hint');
  // S04: grafeemgebaseerde teller — `join-state.mjs` kapt al stil af op
  // `NAME_MAX_GRAPHEMES`, deze teller telt met dezelfde `Intl.Segmenter`-
  // aanpak (`graphemeCount`), niet met `.length` (UTF-16-eenheden).
  const nameCounter = el('span', 'join-name-counter');
  nameCounter.setAttribute('aria-hidden', 'true'); // decoratief naast het veld, geen eigen aankondiging
  nameLabel.append(nameLabelText, nameInput, nameOptionalHint, nameCounter);
  const errorMessage = el('p', 'join-error field-error');
  const submitButton = document.createElement('button');
  submitButton.type = 'button';
  submitButton.className = 'join-submit btn-primary';
  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'join-retry btn-secondary';
  // Prompt 05, punt 1: sommige foutcodes rechtvaardigen geen "opnieuw
  // proberen" (dezelfde ongeldige code/link/volle room geeft toch weer
  // dezelfde fout) — die tonen dit i.p.v./naast de retry-knop.
  const backToStartButton = document.createElement('button');
  backToStartButton.type = 'button';
  backToStartButton.className = 'join-back-to-start btn-primary';
  backToStartButton.addEventListener('click', () => onLeaveHome?.());

  screen.append(title, status, waitingCount, nameLabel, errorMessage, submitButton, backToStartButton, retryButton);
  root.append(screen);

  let state = initialJoinState();

  nameInput.addEventListener('input', () => {
    updateNameCounter();
    dispatch({ type: 'NAME_CHANGED', value: nameInput.value });
  });

  function updateNameCounter() {
    nameCounter.textContent = `${graphemeCount(nameInput.value)}/${NAME_MAX_GRAPHEMES}`;
  }

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
      previewPlayerCount = typeof preview.playerCount === 'number' ? preview.playerCount : null;
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
    backToStartButton.hidden = true;
    submitButton.hidden = true;
    nameLabel.hidden = true;
    waitingCount.hidden = true;

    if (state.status === 'previewing') {
      status.textContent = t('join.previewing');
      return;
    }

    if (state.status === 'name-entry' || state.status === 'submitting') {
      status.textContent = state.status === 'submitting' ? t('join.submitting') : '';
      if (previewPlayerCount !== null && previewPlayerCount > 0) {
        waitingCount.hidden = false;
        waitingCount.textContent = tCount('join.waitingCount', previewPlayerCount);
      }
      nameLabel.hidden = false;
      nameLabelText.textContent = t('join.nameLabel');
      nameOptionalHint.textContent = t('join.nameOptionalHint');
      // Voorinvullen, niet als placeholder (harde regel 2: één tik moet
      // volstaan zonder te typen) — alleen bij het eerste render van dit
      // status, anders overschrijft elke render de eigen typeactie.
      if (nameInput.dataset.prefilledFor !== state.locator.type + (state.suggestedName ?? '')) {
        nameInput.value = state.displayName ?? state.suggestedName ?? '';
        nameInput.dataset.prefilledFor = state.locator.type + (state.suggestedName ?? '');
      }
      updateNameCounter();
      submitButton.hidden = false;
      submitButton.disabled = state.status === 'submitting';
      submitButton.textContent = t('join.submit');
      return;
    }

    if (state.status === 'error') {
      status.textContent = '';
      errorMessage.textContent = t(`error.${messageForErrorCode(state.code)}`);
      // Prompt 05, punt 1: welke knop(pen) hangt af van de foutcategorie, niet
      // altijd dezelfde ene "Opnieuw proberen" — zie edge-case-messaging.mjs.
      const category = joinErrorCategoryFor(state.code);
      backToStartButton.hidden = category === 'retry-only';
      backToStartButton.textContent = t('session.backToStart');
      // Blijvend ongeldig (dezelfde code/link geeft toch weer dezelfde fout):
      // geen "opnieuw proberen" aanbieden, dat is hier gewoon zinloos. Bij de
      // andere twee categorieën blijft retry staan — secundair (`btn-
      // secondary`, al zo gestyled) zodra "terug naar start" ernaast staat,
      // nooit twee even dominante knoppen (04's S01-regel, zelfde principe).
      retryButton.hidden = category === 'permanently-invalid';
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
      previewPlayerCount = null;
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
