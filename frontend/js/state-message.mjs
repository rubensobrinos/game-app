// state-message.mjs — T2-11. De twee staten die `05` §13 naast loading noemt:
// **leeg** en **fout**.
//
// Ze staan in één module omdat het dezelfde vorm is met een andere betekenis:
// een kop, een uitleg, en een uitweg. Wat ze scheidt is wat de gebruiker moet
// denken — "er is nog niets" of "er ging iets mis" — en dat verschil zit in de
// rol en de kleur, niet in de opbouw.
//
// Waarom als component en niet per scherm: er waren vier oplossingen voor deze
// twee patronen (`.lobby-empty`, `.field-error`, de reconnect-banner, het
// terminale roomfoutscherm). Dat werkt bij vier schermen en niet bij acht —
// precies wat bij de knoppen al een keer is opgeruimd (`05` §15).
//
// Deze module bevat geen tekst. Wat er staat is thema 4 (`09` §4 en §6); de
// aanroeper geeft het mee. Bij een ontbrekende tekst: melden, niet zelf
// invullen.

/**
 * Lege staat — `05` §13: verklaart wáárom hij leeg is en biedt een concrete
 * volgende actie. Een lege lijst zonder uitleg leest als een fout.
 *
 * @param {{
 *   root: HTMLElement,
 *   title: string,
 *   hint?: string,
 *   action?: { label: string, onClick: () => void } | null,
 * }} options
 */
export function createEmptyState({ root, title, hint = '', action = null }) {
  const blok = el('div', 'state-empty');

  const kop = el('p', 'state-title');
  kop.textContent = title;
  blok.appendChild(kop);

  if (hint) {
    const uitleg = el('p', 'state-hint');
    uitleg.textContent = hint;
    blok.appendChild(uitleg);
  }

  if (action) {
    blok.appendChild(actieknop(action, 'btn-secondary'));
  }

  root.appendChild(blok);
  return { element: blok, remove: () => blok.remove() };
}

/**
 * Foutstaat in twee zwaartes.
 *
 * - `inline` — bij een veld of een blok. Compact, geen kop.
 * - `page` — een scherm dat niet verder kan. Gecentreerd, met kop.
 *
 * De herstelactie is onderdeel van de component en niet optioneel bijwerk:
 * `05` §13 en `08` §6 koppelen aan elke fout een vervolgstap. Een fout zonder
 * uitweg is een doodlopende weg.
 *
 * @param {{
 *   root: HTMLElement,
 *   message: string,
 *   title?: string,
 *   variant?: 'inline' | 'page',
 *   action?: { label: string, onClick: () => void } | null,
 * }} options
 */
export function createErrorState({ root, message, title = '', variant = 'inline', action = null }) {
  const zwaarte = variant === 'page' ? 'page' : 'inline';
  const blok = el('div', `state-error is-${zwaarte}`);

  // `role="alert"` en niet alleen `aria-live`: een fout die verschijnt ná een
  // handeling moet meteen worden voorgelezen, niet pas bij de volgende
  // onderbreking (`08` §2.2). De aanroeper hoeft daar niets voor te doen.
  blok.setAttribute('role', 'alert');

  if (zwaarte === 'page' && title) {
    const kop = el('p', 'state-title');
    kop.textContent = title;
    blok.appendChild(kop);
  }

  const tekst = el('p', 'state-message');
  tekst.textContent = message;
  blok.appendChild(tekst);

  if (action) {
    blok.appendChild(actieknop(action, zwaarte === 'page' ? 'btn-primary' : 'btn-secondary'));
  }

  root.appendChild(blok);

  return {
    element: blok,
    remove: () => blok.remove(),
    /** @param {string} nieuweTekst */
    setMessage(nieuweTekst) {
      tekst.textContent = nieuweTekst;
    },
  };
}

function actieknop({ label, onClick }, klasse) {
  const knop = document.createElement('button');
  knop.type = 'button';
  knop.className = `${klasse} state-action`;
  knop.textContent = label;
  knop.addEventListener('click', onClick);
  return knop;
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
