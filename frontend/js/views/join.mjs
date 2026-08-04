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
import { formatCode } from './room-header.mjs';

// SCHERM 3 (besluit 40B, doelbeeld v2): de aparte naamstap is hier weg —
// een gast joint direct met het servervoorstel en landt meteen in de lobby;
// naam kiezen ("Zo heet je vanavond") gebeurt dáár, via `player:rename`.
// De naamveld-DOM blijft bestaan maar wordt niet meer getoond: de reducer
// (join-state.mjs) is ongewijzigd, dit bestand submit alleen automatisch
// zodra 'name-entry' bereikt is. Foutpaden (code bestaat niet, room op slot,
// vol, al bezig) werken onveranderd — auto-join stopt daar gewoon op de
// bestaande foutschermen.

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
  // 04's inhoudspunt "Je doet mee aan game 482 917" — alleen tonen bij een
  // code-locator: `state.locator.code` is dan al bekend (de speler typte 'm),
  // maar `GET /api/v1/games/preview` (invite-locator) levert alleen `roomId`
  // terug, geen `gameCode` (PROTOCOL.md) — voor die weg is de code hier
  // simpelweg niet beschikbaar, geen aanname/gok hier over verzinnen.
  const roomConfirmation = el('p', 'join-room-confirmation');
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

  screen.append(title, status, roomConfirmation, waitingCount, nameLabel, errorMessage, submitButton, backToStartButton, retryButton);
  root.append(screen);

  let state = initialJoinState();
  // Besluit 40B: éénmaal automatisch submitten per flow-poging. Na een RETRY
  // wordt dit weer op false gezet zodat de nieuwe poging óók weer auto-joint.
  let autoJoined = false;

  function maybeAutoJoin() {
    if (state.status === 'name-entry' && !autoJoined) {
      autoJoined = true;
      dispatch({ type: 'SUBMIT' });
      runJoin();
    }
  }

  nameInput.addEventListener('input', () => {
    dispatch({ type: 'NAME_CHANGED', value: nameInput.value });
    // join-state.mjs kapt `state.displayName` al stil af op `NAME_MAX_GRAPHEMES`
    // (`sanitizeDisplayName`) — dat gold tot nu toe alleen voor wát verstuurd
    // wordt bij SUBMIT. Het zichtbare veld zelf bleef ongewijzigd (kon dus
    // >20 tekens tonen, met een teller die "25/20" liet zien i.p.v. echt af
    // te kappen). Hier alleen resyncen wanneer de waarden al uiteenlopen
    // (d.w.z. er wérd afgekapt) — anders zou elke toets de cursor naar het
    // einde duwen, ook onder de limiet.
    if (nameInput.value !== (state.displayName ?? '')) {
      nameInput.value = state.displayName ?? '';
    }
    updateNameCounter();
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
    autoJoined = false; // nieuwe poging mag opnieuw automatisch joinen (40B)
    dispatch({ type: 'RETRY' });
    if (state.status === 'previewing') {
      runPreview();
    } else {
      maybeAutoJoin();
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
      maybeAutoJoin();
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
    roomConfirmation.hidden = true;

    if (state.status === 'previewing') {
      status.textContent = t('join.previewing');
      return;
    }

    if (state.status === 'name-entry' || state.status === 'submitting') {
      // Besluit 40B: geen naamstap meer — dit is nog hooguit één tel
      // zichtbaar terwijl de auto-join loopt. Naamveld/submit blijven
      // verborgen; naam kiezen gebeurt in de lobby.
      status.textContent = t('join.submitting');
      if (state.locator.type === 'code') {
        roomConfirmation.hidden = false;
        roomConfirmation.textContent = t('join.roomConfirmation').replace('{code}', formatCode(state.locator.code));
      }
      if (previewPlayerCount !== null && previewPlayerCount > 0) {
        waitingCount.hidden = false;
        waitingCount.textContent = tCount('join.waitingCount', previewPlayerCount);
      }
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
      autoJoined = false;
      dispatch({ type: 'LOCATOR_OBTAINED', locator });
      if (state.status === 'previewing') {
        runPreview();
      } else {
        maybeAutoJoin(); // code-locator slaat preview over → direct joinen (40B)
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
