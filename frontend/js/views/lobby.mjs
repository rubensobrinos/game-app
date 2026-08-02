// views/lobby.mjs — UI2. DOM-laag van scherm 3 (Lobby). Alle deelnemers- en
// deellogica komt van buiten (session-shell.mjs, UI0's orchestratiepatroon):
// dit bestand rendert alleen en vertaalt tikken naar callbacks.
//
// Deelnemerslijst: `match-phase-state` bewaart bewust geen spelerscount/-lijst
// (GF-HANDOFF-TO-INT-A.md), dus de aanroeper houdt die lokaal bij uit
// `room:state`'s `room.playerCount` (altijd betrouwbaar) en
// `room:player-changed`'s deltas (namen, alleen vanaf het moment van
// verbinden — een joiner ziet dus geen namen van spelers die er al eerder
// waren, alleen het aantal; zie HANDOFF-UI voor de reden).
//
// Delen: exact de volgorde uit `share-actions.shareActionsFor(capabilities)`.
// QR is schermvullend (eigen overlay), nooit een externe QR-dienst
// (`frontend/js/qr.mjs`, gevendorde generator).

import { shareActionsFor, shareUrlsFor } from '../../../client/flow/share-actions.mjs';
import { qrDataUrl } from '../qr.mjs';

export function createLobbyView({ root, t, isHost, gameCode, onStart, onShareAction }) {
  root.textContent = '';

  // Geen eigen `.screen`-klasse: de aanroeper (session-shell.mjs) mount dit in
  // een container die dat al levert (consistent met hoe gameplay.mjs/
  // scoreboard.mjs/podium.mjs geen eigen layout-wrapper hebben).
  const screen = el('div', 'lobby-screen');
  const title = el('h2', 'lobby-title');
  const waiting = el('p', 'lobby-waiting');
  const countLine = el('p', 'lobby-count');
  const list = document.createElement('ul');
  list.className = 'lobby-players';

  const shareRow = el('div', 'lobby-share-row');
  const shareButtons = new Map();
  for (const action of ['show-qr', 'native-share', 'copy-link', 'show-code']) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-secondary lobby-share-${action}`;
    btn.hidden = true;
    btn.addEventListener('click', () => handleShareAction(action));
    shareButtons.set(action, btn);
    shareRow.appendChild(btn);
  }

  const feedback = el('p', 'lobby-share-feedback');
  const codeReveal = el('p', 'lobby-code-reveal');
  codeReveal.hidden = true;
  const linkFallback = document.createElement('input');
  linkFallback.type = 'text';
  linkFallback.readOnly = true;
  linkFallback.className = 'field-input lobby-link-fallback';
  linkFallback.hidden = true;
  linkFallback.addEventListener('focus', () => linkFallback.select());

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'btn-primary lobby-start';
  startButton.hidden = !isHost;
  startButton.addEventListener('click', () => {
    if (!startButton.disabled) {
      onStart();
    }
  });

  // Schermvullende QR-overlay — apart van de rest van de lobby, sluit met
  // dezelfde tik overal (achtergrond of terugknop).
  const qrOverlay = el('div', 'lobby-qr-overlay');
  qrOverlay.hidden = true;
  const qrImage = document.createElement('img');
  qrImage.className = 'lobby-qr-image';
  qrImage.alt = '';
  const qrBack = document.createElement('button');
  qrBack.type = 'button';
  qrBack.className = 'btn-secondary lobby-qr-back';
  qrBack.addEventListener('click', closeQr);
  qrOverlay.addEventListener('click', (event) => {
    if (event.target === qrOverlay) {
      closeQr();
    }
  });
  qrOverlay.append(qrImage, qrBack);

  screen.append(title, waiting, countLine, list, shareRow, feedback, codeReveal, linkFallback, startButton);
  root.append(screen, qrOverlay);

  let availableActions = [];
  let shareUrls = { qrUrl: '', copyUrl: '' };
  let feedbackTimer = null;

  function closeQr() {
    qrOverlay.hidden = true;
  }

  async function handleShareAction(action) {
    onShareAction(action);
    feedback.textContent = '';

    if (action === 'show-qr') {
      // cellSize 8 ≈ schermvullend op mobiel (qr.mjs's eigen richtlijn).
      qrImage.src = qrDataUrl(shareUrls.qrUrl, { cellSize: 8 });
      qrOverlay.hidden = false;
      return;
    }

    if (action === 'show-code') {
      codeReveal.hidden = !codeReveal.hidden;
      return;
    }

    if (action === 'native-share') {
      try {
        await navigator.share({ url: shareUrls.copyUrl });
      } catch {
        // Geannuleerd of geweigerd door de gebruiker/OS — geen foutmelding,
        // dit is een normale uitkomst van de native deelsheet.
      }
      return;
    }

    if (action === 'copy-link') {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrls.copyUrl);
          showFeedback(t('lobby.copied'));
          return;
        } catch {
          // valt door naar de zichtbare fallback hieronder
        }
      }
      linkFallback.value = shareUrls.copyUrl;
      linkFallback.hidden = false;
      linkFallback.focus();
      showFeedback(t('lobby.copyFailed'));
    }
  }

  function showFeedback(message) {
    feedback.textContent = message;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      feedback.textContent = '';
    }, 3000);
  }

  const SHARE_LABEL_KEYS = {
    'show-qr': 'lobby.shareQr',
    'native-share': 'lobby.shareNative',
    'copy-link': 'lobby.shareCopy',
    'show-code': 'lobby.shareCode',
  };

  function renderStatic() {
    title.textContent = t('lobby.title');
    waiting.textContent = t('lobby.waiting');
    qrBack.textContent = t('lobby.back');
    startButton.textContent = t('lobby.start');
    for (const [action, btn] of shareButtons) {
      btn.textContent = t(SHARE_LABEL_KEYS[action]);
      btn.hidden = !availableActions.includes(action);
    }
  }

  renderStatic();

  /**
   * @param {{ playerCount: number, participants: Map<string,string>, canStart: boolean, capabilities: {nativeShareAvailable:boolean}, joinUrl: string }} model
   */
  function update(model) {
    availableActions = shareActionsFor(model.capabilities);
    shareUrls = shareUrlsFor(model.joinUrl);
    renderStatic();

    countLine.textContent = `${model.playerCount} ${t('lobby.players')}`;
    codeReveal.textContent = `${t('lobby.code')}: ${gameCode}`;

    list.textContent = '';
    for (const name of model.participants.values()) {
      const item = document.createElement('li');
      item.className = 'lobby-player';
      item.textContent = name;
      list.appendChild(item);
    }

    if (isHost) {
      startButton.hidden = false;
      startButton.disabled = !model.canStart;
    }
  }

  return { update, render: renderStatic };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
