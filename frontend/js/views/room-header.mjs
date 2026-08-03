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

  // De code zelf. `tabular-nums` + letterspacing in CSS: dit is een getal dat
  // wordt voorgelezen en overgetypt, geen gewone tekst.
  const codeWrap = el('div', 'room-header-code');
  const codeLabel = el('span', 'room-header-code-label');
  const codeValue = el('span', 'room-header-code-value');
  codeValue.textContent = formatCode(gameCode);
  codeWrap.append(codeLabel, codeValue);

  const qrButton = document.createElement('button');
  qrButton.type = 'button';
  qrButton.className = 'btn-icon room-header-qr';
  // Pictogram + toegankelijk label: 05 §3 vraagt om een tekstlabel bij elke
  // niet-universele iconactie, en een QR-glyph is dat niet.
  qrButton.textContent = '▦';
  qrButton.setAttribute('aria-haspopup', 'dialog');
  qrButton.setAttribute('aria-expanded', 'false');

  bar.append(codeWrap, qrButton);
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
    codeLabel.textContent = t('lobby.code');
    cardTitle.textContent = t('room.scanToJoin');
    image.alt = t('room.scanToJoin');
    cardUrl.textContent = displayUrl(currentJoinUrl);
    closeButton.textContent = t('lobby.back');
    qrButton.setAttribute('aria-label', t('lobby.shareQr'));
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
