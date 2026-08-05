// views/room-header.mjs — de gamecode in de appheader, permanent zichtbaar
// zolang er een lopende sessie is (D-018).
//
// Waarom hier en niet in de lobby: D-004 eist dat code en QR nooit achter een
// knop of menu verdwijnen, maar een volledige QR-kaart permanent in beeld kost
// op een telefoon te veel ruimte zodra de vraag begint. De code is klein en
// voorleesbaar, dus die staat er altijd; de QR zit één tik verderop achter een
// pictogram en opent als modal.
//
// D-019: dit is er voor iedereen, host én speler, en blijft ook staan als de
// host de room vergrendelt — vergrendelen blokkeert het joinen, niet het
// tonen. Spelers kunnen dus altijd iemand uitnodigen, wat het benchmark-
// rapport als onderscheidende verspreidingsfunctie aanwijst.
//
// Zelfde DOM-in/callbacks-uit-patroon als de andere viewmodules: deze module
// kent geen transport en geen sessie, alleen wat hij moet tonen.

import { qrDataUrl } from '../qr.mjs';

/**
 * @param {{
 *   root: HTMLElement,
 *   t: (key: string) => string,
 *   gameCode: string,
 *   joinUrl: string,
 *   onShareAction?: (action: string) => void,
 * }} options
 */
export function createRoomHeader({ root, t, gameCode, joinUrl, onShareAction }) {
  const bar = el('div', 'room-header');

  // Feedback 4 aug (punten 5+6): geen "CODE"-label meer (spreekt voor zich)
  // en de code op ÉÉN regel — het klemde eerder in twee regels onder elkaar.
  const codeValue = el('span', 'room-header-code-value');
  codeValue.textContent = formatCode(gameCode);

  // Feedback 4 aug (punt 7): geen halve witte QR permanent in de balk — een
  // compact lime QR-pictogram (CSS-getekend, geen witte achtergrond); de
  // grote, mooie QR zit één tik verderop in de modal.
  const qrButton = document.createElement('button');
  qrButton.type = 'button';
  qrButton.className = 'btn-icon room-header-qr';
  qrButton.setAttribute('aria-haspopup', 'dialog');
  qrButton.setAttribute('aria-expanded', 'false');
  // Feedbackronde 2 (punt 3): een herkenbare mini-QR — 5×5 met de drie
  // vierkante finder-hoeken die iedereen van echte QR's kent.
  // A1 (punt 16): het 5×5-blokjespatroon las op 20 px als ruis. Wat een QR
  // herkenbaar maakt zijn de drie zoekvierkanten in de hoeken; die zijn hier
  // vier lege <i>'s die rounda-1c.css positioneert (drie ringen + één
  // datablokje). Geen betekenis in de volgorde — puur vorm, vandaar aria-hidden
  // op de hele glyph en het label op de knop.
  const qrGlyph = el('span', 'room-header-qr-glyph');
  qrGlyph.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 4; i += 1) {
    qrGlyph.appendChild(document.createElement('i'));
  }
  qrButton.appendChild(qrGlyph);

  // Feedback 4 aug (punt 14): delen hoort hier als klein pictogram — niet
  // als groot "UITNODIGEN"-blok onderin de lobby dat de startknop wegduwt.
  // Feedbackronde 2 (punt 4) maakte er het woord DEEL van omdat het schuine
  // pijltje onduidelijk was. A1 (punt 15) draait dat terug naar een symbool,
  // maar niet naar dat pijltje: dit is het deelsymbool zelf (drie knopen, twee
  // verbindingen, opgebouwd in rounda-1c.css). Reden is ruimte — het woord
  // kostte ~55 px in een rij van 366 px waar ook de code in moet.
  const shareButton = document.createElement('button');
  shareButton.type = 'button';
  shareButton.className = 'btn-icon room-header-share';
  const shareGlyph = el('span', 'room-header-share-glyph');
  shareGlyph.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i += 1) {
    shareGlyph.appendChild(document.createElement('i'));
  }
  shareButton.appendChild(shareGlyph);
  const shareToast = el('span', 'room-header-share-toast');
  shareToast.hidden = true;
  shareToast.setAttribute('role', 'status');
  let shareToastTimer = null;

  bar.append(codeValue, qrButton, shareButton, shareToast);
  root.appendChild(bar);

  // Modale QR-overlay. Zelfde discipline als app-menu.mjs en de eerdere
  // lobby-overlay: rol + label, Escape sluit, focus gaat erin bij openen en
  // keert terug naar de knop bij sluiten.
  const overlay = el('div', 'room-qr-overlay');
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const card = el('div', 'room-qr-card');
  const cardTitle = el('h2', 'room-qr-title');
  const image = document.createElement('img');
  image.className = 'room-qr-image';
  const cardCode = el('p', 'room-qr-code');
  cardCode.textContent = formatCode(gameCode);
  const cardUrl = el('p', 'room-qr-url');
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'btn-secondary room-qr-close';

  card.append(cardTitle, image, cardCode, cardUrl, closeButton);
  overlay.appendChild(card);
  root.appendChild(overlay);

  let currentJoinUrl = joinUrl ?? '';

  function open() {
    // Pas hier genereren: bij het mounten is de joinUrl er soms nog niet, en
    // een QR van een lege string gooit (qr.mjs).
    if (currentJoinUrl === '') {
      return;
    }
    image.src = qrDataUrl(currentJoinUrl, { cellSize: 8 });
    overlay.hidden = false;
    qrButton.setAttribute('aria-expanded', 'true');
    closeButton.focus();
    onShareAction?.('show-qr');
  }

  function close({ returnFocus = false } = {}) {
    overlay.hidden = true;
    qrButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) {
      qrButton.focus();
    }
  }

  qrButton.addEventListener('click', () => {
    if (overlay.hidden) {
      open();
    } else {
      close({ returnFocus: true });
    }
  });
  shareButton.addEventListener('click', async () => {
    if (currentJoinUrl === '') {
      return;
    }
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      onShareAction?.('native-share');
      try {
        await navigator.share({ url: currentJoinUrl });
      } catch {
        // geannuleerd — normale uitkomst van de deelsheet
      }
      return;
    }
    onShareAction?.('copy-link');
    try {
      await navigator.clipboard.writeText(currentJoinUrl);
      shareToast.textContent = t('lobby.copied');
    } catch {
      shareToast.textContent = displayUrl(currentJoinUrl); // kopiëren kan niet: toon de link zelf
    }
    shareToast.hidden = false;
    clearTimeout(shareToastTimer);
    shareToastTimer = setTimeout(() => {
      shareToast.hidden = true;
    }, 2500);
  });
  closeButton.addEventListener('click', () => close({ returnFocus: true }));
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close({ returnFocus: true });
    }
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close({ returnFocus: true });
    }
  });

  function render() {
    cardTitle.textContent = t('room.scanToJoin');
    image.alt = t('room.scanToJoin');
    cardUrl.textContent = displayUrl(currentJoinUrl);
    closeButton.textContent = t('lobby.back');
    qrButton.setAttribute('aria-label', t('lobby.shareQr'));
    shareButton.setAttribute('aria-label', t('lobby.shareCopy'));
  }

  render();

  return {
    render,
    /** @param {string} nextJoinUrl */
    setJoinUrl(nextJoinUrl) {
      if (typeof nextJoinUrl === 'string' && nextJoinUrl !== '') {
        currentJoinUrl = nextJoinUrl;
        cardUrl.textContent = displayUrl(currentJoinUrl);
      }
    },
    /** Verwijdert de balk en de overlay — bij het verlaten van een sessie. */
    destroy() {
      bar.remove();
      overlay.remove();
    },
  };
}

/**
 * `123456` → `123 456`: in twee groepen is een code hardop voor te lezen.
 * Ook bruikbaar tijdens het typen (S03, `home.mjs`'s codeveld): bij minder
 * dan 4 cijfers is er nog geen tweede groep, dus dan blijft de invoer
 * ongewijzigd — geen strikte `=== 6`-eis, dat zou live formatteren tijdens
 * het typen onmogelijk maken (dan is de waarde nooit tussentijds exact 6).
 */
export function formatCode(code) {
  const raw = String(code ?? '');
  return raw.length > 3 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : raw;
}

/** Toont de URL zonder schema — korter, en op een QR-kaart leest dat beter. */
function displayUrl(url) {
  return String(url ?? '').replace(/^https?:\/\//, '');
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
