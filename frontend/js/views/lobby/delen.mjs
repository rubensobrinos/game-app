// views/lobby/delen.mjs — UI2, uit lobby.mjs gesplitst (docs/openstaand/
// refactor/11-lobby.md). De deelacties en de uitnodiging.
//
// `show-qr`/`show-code` uit `share-actions.shareActionsFor(capabilities)`
// worden hier bewust NIET getoond (02-S05-permanente-qr-code.md, D-018/D-019):
// `room-header.mjs` toont code + QR nu permanent in de appheader, voor
// iedereen, de hele sessie lang — een tweede ingang hier zou D-018's "geen
// dubbele ingang" schenden. Alleen `native-share`/`copy-link` blijven staan:
// die dienen een ander doel (de OS-deelsheet, het klembord) dan wat de
// header al permanent toont.
//
// Geen eigen root/mount: `shareSection` is een DIRECTE kind van `.lobby-
// screen` (CSS-gap-ritme, `lobby.css`) — de aanroeper (lobby.mjs) plakt 'm op
// zijn plek, deze module wrapt 'm niet in nog een element.

import { shareActionsFor, shareUrlsFor } from '../../../../client/flow/share-actions.mjs';

const SHARE_LABEL_KEYS = {
  'native-share': 'lobby.shareNative',
  'copy-link': 'lobby.shareCopy',
};

export function createDelenView({ t, onShareAction }) {
  // De vier deelacties als één omkaderde groep met een kop, in plaats van vier
  // losse knoppen tussen de rest van het scherm. `lobby.share` ("Uitnodigen")
  // bestond al in alle drie de locales maar werd nergens getoond.
  const shareSection = document.createElement('section');
  shareSection.className = 'lobby-share';
  const shareTitle = document.createElement('h3');
  shareTitle.className = 'lobby-share-title';
  const shareRow = document.createElement('div');
  shareRow.className = 'lobby-share-row';
  const shareButtons = new Map();
  for (const action of ['native-share', 'copy-link']) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-secondary lobby-share-${action}`;
    btn.hidden = true;
    btn.addEventListener('click', () => handleShareAction(action));
    shareButtons.set(action, btn);
    shareRow.appendChild(btn);
  }

  const feedback = document.createElement('p');
  feedback.className = 'lobby-share-feedback';
  feedback.setAttribute('aria-live', 'polite');
  const linkFallback = document.createElement('input');
  linkFallback.type = 'text';
  linkFallback.readOnly = true;
  linkFallback.className = 'field-input lobby-link-fallback';
  linkFallback.hidden = true;
  linkFallback.addEventListener('focus', () => linkFallback.select());

  // Feedback en link horen bij het deelblok — die stonden eerder los onder de
  // knoppen, waardoor "Gekopieerd!" losgezongen van zijn actie verscheen.
  shareSection.append(shareTitle, shareRow, feedback, linkFallback);

  let availableActions = [];
  let shareUrls = { qrUrl: '', copyUrl: '' };
  let feedbackTimer = null;

  async function handleShareAction(action) {
    onShareAction(action);
    feedback.textContent = '';

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

  function render() {
    shareTitle.textContent = t('lobby.share');
    linkFallback.setAttribute('aria-label', t('lobby.shareCopy'));
    for (const [action, btn] of shareButtons) {
      btn.textContent = t(SHARE_LABEL_KEYS[action]);
      btn.hidden = !availableActions.includes(action);
    }
  }

  render();

  /** @param {{ capabilities: {nativeShareAvailable:boolean}, joinUrl: string }} model */
  function update(model) {
    availableActions = shareActionsFor(model.capabilities);
    shareUrls = shareUrlsFor(model.joinUrl);
    render();
  }

  return { shareSection, update, render };
}
