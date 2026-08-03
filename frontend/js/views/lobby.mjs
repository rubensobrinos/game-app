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

  // De vier deelacties als één omkaderde groep met een kop, in plaats van vier
  // losse knoppen tussen de rest van het scherm. `lobby.share` ("Uitnodigen")
  // bestond al in alle drie de locales maar werd nergens getoond.
  const shareSection = el('section', 'lobby-share');
  const shareTitle = el('h3', 'lobby-share-title');
  const shareRow = el('div', 'lobby-share-row');
  const shareButtons = new Map();
  for (const action of ['show-qr', 'native-share', 'copy-link', 'show-code']) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-secondary lobby-share-${action}`;
    btn.hidden = true;
    if (action === 'show-code') {
      // De enige deelactie die iets in-place toont/verbergt i.p.v. een
      // dialoog te openen of een systeemactie te starten — aria-expanded
      // hoort daarbij.
      btn.setAttribute('aria-expanded', 'false');
    }
    btn.addEventListener('click', () => handleShareAction(action));
    shareButtons.set(action, btn);
    shareRow.appendChild(btn);
  }

  const feedback = el('p', 'lobby-share-feedback');
  feedback.setAttribute('aria-live', 'polite');
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
  // dezelfde tik overal (achtergrond of terugknop). Een modale dialoog (net
  // als app-menu.mjs's paneel): rol + label voor een screenreader, Escape
  // sluit, en focus gaat ín bij openen en terug naar de knop die 'm opende
  // bij sluiten — anders valt de focus terug naar `body` en begint Tab weer
  // bovenaan de pagina.
  const qrOverlay = el('div', 'lobby-qr-overlay');
  qrOverlay.hidden = true;
  qrOverlay.setAttribute('role', 'dialog');
  qrOverlay.setAttribute('aria-modal', 'true');
  qrOverlay.setAttribute('aria-label', t('lobby.shareQr'));
  const qrImage = document.createElement('img');
  qrImage.className = 'lobby-qr-image';
  // Beschrijft het doel, niet de QR-patroon-pixels (die zijn voor een
  // screenreader toch niet te "lezen") — vergelijkbaar met hoe de zichtbare
  // code/link ernaast al hetzelfde doel dienen.
  qrImage.alt = t('lobby.shareQr');
  const qrBack = document.createElement('button');
  qrBack.type = 'button';
  qrBack.className = 'btn-secondary lobby-qr-back';
  qrBack.addEventListener('click', () => closeQr({ returnFocus: true }));
  qrOverlay.addEventListener('click', (event) => {
    if (event.target === qrOverlay) {
      closeQr({ returnFocus: true });
    }
  });
  qrOverlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeQr({ returnFocus: true });
    }
  });
  qrOverlay.append(qrImage, qrBack);

  // Feedback, code en link horen bij het deelblok — die stonden eerder los
  // onder de knoppen, waardoor "Gekopieerd!" losgezongen van zijn actie
  // verscheen.
  shareSection.append(shareTitle, shareRow, feedback, codeReveal, linkFallback);
  screen.append(title, waiting, countLine, list, shareSection, startButton);
  root.append(screen, qrOverlay);

  let availableActions = [];
  let shareUrls = { qrUrl: '', copyUrl: '' };
  let feedbackTimer = null;

  function closeQr({ returnFocus = false } = {}) {
    qrOverlay.hidden = true;
    if (returnFocus) {
      shareButtons.get('show-qr')?.focus();
    }
  }

  async function handleShareAction(action) {
    onShareAction(action);
    feedback.textContent = '';

    if (action === 'show-qr') {
      // cellSize 8 ≈ schermvullend op mobiel (qr.mjs's eigen richtlijn).
      qrImage.src = qrDataUrl(shareUrls.qrUrl, { cellSize: 8 });
      qrOverlay.hidden = false;
      qrBack.focus();
      return;
    }

    if (action === 'show-code') {
      codeReveal.hidden = !codeReveal.hidden;
      shareButtons.get('show-code')?.setAttribute('aria-expanded', String(!codeReveal.hidden));
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
    shareTitle.textContent = t('lobby.share');
    qrBack.textContent = t('lobby.back');
    startButton.textContent = t('lobby.start');
    qrOverlay.setAttribute('aria-label', t('lobby.shareQr'));
    qrImage.alt = t('lobby.shareQr');
    linkFallback.setAttribute('aria-label', t('lobby.shareCopy'));
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
