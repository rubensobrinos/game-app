// app-menu.mjs — UI1. Het voorkeurenmenu in de appheader, zichtbaar op élk
// scherm (gemount in `#app-header`, buiten `#app-root` — dat laatste wordt
// bij elke routewissel leeggemaakt, de header niet). Drie losse keuzes:
//
//   - Taal van de app-UI zelf (menu's, knoppen, foutmeldingen) — niet de taal
//     waarin vragen gesteld worden, dat is een aparte game-instelling
//     (`host-setup-state`'s `config.language`).
//   - Licht/donker-thema, toegepast via `document.documentElement.dataset.theme`
//     (CSS-variabelen in `base.css` onder `:root[data-theme="light"]`).
//   - Reactiezinnen (11-verzoek, BOUWSPRINT doel 4): GAME-RULES.md eist "per
//     speler uitzetbaar" — bewust NIET via app.mjs bedraad zoals taal/thema
//     (dat bestand is voor deze sprint "blijf uit"): dit paneel beheert de
//     voorkeur zelfstandig via `preferences.mjs`, met `storage` als optionele
//     parameter (default `window.localStorage`) zodat de bestaande aanroep
//     in app.mjs ongewijzigd kan blijven — geen nieuwe verplichte parameter.
//
// Gebruik: createAppMenu({ root, t, initialLang, initialTheme, onLangChange,
// onThemeChange, storage? }) bouwt de ⋯-knop + het paneel; `refresh()`
// ververst de labels/actieve-status ná een taalwissel (dezelfde aanroeper-
// ververst-conventie als de schermmodules).
//
// A1 (punt 7): dit was een hamburger. Een hamburger belooft hoofdnavigatie —
// "waar kan ik heen?" — en daarachter zaten drie voorkeuren. Drie puntjes
// beloven precies wat er is: opties bij wat je nu ziet. Alleen de aanleiding
// verandert; het paneel eronder is ongewijzigd.

import { loadReactionsEnabled, saveReactionsEnabled } from './preferences.mjs';

export function createAppMenu({ root, t, initialLang, initialTheme, onLangChange, onThemeChange, storage = window.localStorage }) {
  root.textContent = '';

  const menuKnop = document.createElement('button');
  menuKnop.type = 'button';
  menuKnop.className = 'btn-icon app-menu-trigger';
  menuKnop.textContent = '⋯';
  // Het paneel is een menu dat de knop open-/dichtklapt; zonder deze drie
  // attributen kondigt een screenreader alleen "knop" aan, zonder dat er iets
  // open is gegaan. `aria-expanded` wordt bij elke wissel bijgewerkt.
  menuKnop.setAttribute('aria-haspopup', 'true');
  menuKnop.setAttribute('aria-expanded', 'false');
  menuKnop.setAttribute('aria-controls', PANEL_ID);

  const panel = el('div', 'app-menu');
  panel.id = PANEL_ID;
  panel.hidden = true;

  // A3 (#7/#8/#46) — de ene ingang. Er stonden twee ⋯-knoppen naast elkaar in
  // de chrome: deze (voorkeuren) en die van de hostbalk. Twee identieke
  // glyphs naast elkaar dwingen de gebruiker om te raden welke hij nodig
  // heeft; dat is precies het probleem dat punt 7 aanwijst.
  //
  // Waarom een lege sectie hier en niet een hostmenu ín dit bestand: de
  // rolvraag. Een speler heeft alleen voorkeuren, een host heeft daarnaast
  // hostacties. Dit paneel is het enige dat op élk scherm en voor élke rol
  // bestaat, dus het is de plek. De inhoud van de hostsectie komt van
  // `views/hostbar.mjs` (eigenaar D): session-shell.mjs hangt daar het
  // bestaande ⋯-paneel in en zet `hidden` weer aan zodra er niets in zit.
  // Standaard verborgen — een speler mag nooit een lege groep zien.
  const hostSection = el('div', 'app-menu-section app-menu-host');
  hostSection.id = HOST_SLOT_ID;
  hostSection.hidden = true;
  // Zelfde behandeling als de drie groepen hieronder: zonder rol + label
  // hoort een screenreader losse knoppen zonder te weten waar ze bij horen.
  hostSection.setAttribute('role', 'group');
  hostSection.setAttribute('aria-labelledby', HOST_LABEL_ID);
  const hostLabel = el('span', 'app-menu-label');
  hostLabel.id = HOST_LABEL_ID;
  hostSection.appendChild(hostLabel);

  const langLabel = el('span', 'app-menu-label');
  langLabel.id = LANG_LABEL_ID;
  const langGroup = el('div', 'btn-group');
  // Zonder role+aria-labelledby zijn dit drie losse knoppen "🇳🇱 NL"; met de
  // groep eromheen leest een screenreader "Taal, groep" vóór de opties.
  langGroup.setAttribute('role', 'group');
  langGroup.setAttribute('aria-labelledby', LANG_LABEL_ID);
  const langButtons = new Map();
  for (const lang of ['nl', 'en', 'es']) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-opt';
    btn.textContent = `${LANG_FLAG[lang]} ${lang.toUpperCase()}`;
    btn.addEventListener('click', () => {
      onLangChange(lang);
      setOpen(false); // feedback 4 aug: keuze gemaakt = paneel dicht
    });
    langButtons.set(lang, btn);
    langGroup.appendChild(btn);
  }
  const langSection = el('div', 'app-menu-section');
  langSection.append(langLabel, langGroup);

  const themeLabel = el('span', 'app-menu-label');
  themeLabel.id = THEME_LABEL_ID;
  const themeGroup = el('div', 'btn-group');
  themeGroup.setAttribute('role', 'group');
  themeGroup.setAttribute('aria-labelledby', THEME_LABEL_ID);
  const themeButtons = new Map();
  for (const theme of ['dark', 'light']) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-opt';
    const icon = theme === 'dark' ? '🌙' : '☀️';
    const textSpan = document.createElement('span');
    textSpan.dataset.themeLabel = theme;
    btn.append(`${icon} `, textSpan);
    btn.addEventListener('click', () => {
      onThemeChange(theme);
      setOpen(false);
    });
    themeButtons.set(theme, btn);
    themeGroup.appendChild(btn);
  }
  const themeSection = el('div', 'app-menu-section');
  themeSection.append(themeLabel, themeGroup);

  const reactionsLabel = el('span', 'app-menu-label');
  reactionsLabel.id = REACTIONS_LABEL_ID;
  const reactionsGroup = el('div', 'btn-group');
  reactionsGroup.setAttribute('role', 'group');
  reactionsGroup.setAttribute('aria-labelledby', REACTIONS_LABEL_ID);
  const reactionsButtons = new Map();
  for (const enabled of [true, false]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-opt';
    const textSpan = document.createElement('span');
    textSpan.dataset.reactionsLabel = String(enabled);
    btn.append(textSpan);
    btn.addEventListener('click', () => {
      reactionsEnabled = enabled;
      saveReactionsEnabled(storage, enabled);
      refresh();
      setOpen(false);
    });
    reactionsButtons.set(enabled, btn);
    reactionsGroup.appendChild(btn);
  }
  const reactionsSection = el('div', 'app-menu-section');
  reactionsSection.append(reactionsLabel, reactionsGroup);

  // Hostacties bovenaan: ze horen bij wat er nú gebeurt en zijn de reden dat
  // een host het menu opent. Taal en thema zet je één keer per apparaat.
  panel.append(hostSection, langSection, themeSection, reactionsSection);
  root.append(menuKnop, panel);

  menuKnop.setAttribute('aria-label', t('menu.open'));

  /**
   * Eén plek die openen/sluiten regelt, zodat `aria-expanded` niet uit de pas
   * kan lopen met `panel.hidden` — dat gebeurde eerder wél, want de knop
   * toggelde alleen `hidden` en de klik-buiten-handler zette alleen `hidden`.
   * @param {boolean} open
   * @param {{ returnFocus?: boolean }} [options] returnFocus bij sluiten via
   *   toetsenbord (Escape): de focus staat dan ín het paneel en zou anders
   *   naar `body` vallen, waarna Tab weer bovenaan de pagina begint.
   */
  function setOpen(open, { returnFocus = false } = {}) {
    panel.hidden = !open;
    menuKnop.setAttribute('aria-expanded', String(open));
    if (!open && returnFocus) {
      menuKnop.focus();
    }
  }

  menuKnop.addEventListener('click', () => {
    setOpen(panel.hidden);
  });

  document.addEventListener('click', (event) => {
    if (!panel.hidden && !root.contains(event.target)) {
      setOpen(false);
    }
  });

  // Escape sluit het paneel vanuit élk element erbinnen (en vanaf de knop).
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.stopPropagation();
      setOpen(false, { returnFocus: true });
    }
  });

  let currentLang = initialLang;
  let currentTheme = initialTheme;
  // GAME-RULES.md: "staan standaard aan" — `null` (nooit ingesteld) valt dus
  // op `true`, niet op `false` zoals `loadMuted`'s consumenten dat zouden doen.
  let reactionsEnabled = loadReactionsEnabled(storage) ?? true;

  function refresh() {
    menuKnop.setAttribute('aria-label', t('menu.open'));
    hostLabel.textContent = t('menu.hostActions');
    langLabel.textContent = t('menu.language');
    themeLabel.textContent = t('menu.theme');
    // `.active` is puur visueel; `aria-pressed` is wat een screenreader hoort.
    // Beide bijwerken, altijd samen — anders klopt het beeld niet met de
    // aankondiging.
    for (const [lang, btn] of langButtons) {
      const active = lang === currentLang;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
    for (const [theme, btn] of themeButtons) {
      btn.setAttribute('aria-pressed', String(theme === currentTheme));
      btn.classList.toggle('active', theme === currentTheme);
      btn.querySelector('[data-theme-label]').textContent = t(theme === 'dark' ? 'menu.themeDark' : 'menu.themeLight');
    }
    reactionsLabel.textContent = t('menu.reactions');
    for (const [enabled, btn] of reactionsButtons) {
      const active = enabled === reactionsEnabled;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      btn.querySelector('[data-reactions-label]').textContent = t(enabled ? 'menu.reactionsOn' : 'menu.reactionsOff');
    }
  }

  refresh();

  return {
    refresh,
    setLang(lang) {
      currentLang = lang;
      refresh();
    },
    setTheme(theme) {
      currentTheme = theme;
      refresh();
    },
  };
}

/**
 * A3/#46 — de vaste plek voor hostacties, opzoekbaar zonder dat de aanroeper
 * een verwijzing naar dit menu hoeft te hebben. `session-shell.mjs` mount ná
 * `app.mjs` en heeft die verwijzing niet; dit voorkomt dat er alsnog een draad
 * dwars door `app.mjs` gespannen moet worden voor één DOM-plek.
 *
 * VOOR PAKKET D (hostmenu-inhoud, D3) — wat je van deze plek mag verwachten:
 * - Het is een `<div class="app-menu-section app-menu-host">` met bovenin een
 *   `.app-menu-label` ("Hostacties"). Jouw knoppen komen daaronder.
 * - Breedte: `min(280px, 100vw - 2rem)`, dus reken op ~248 px binnenwerk.
 *   Knoppen zijn volle breedte en stapelen; naast elkaar past niet.
 * - Hij hangt onder de chromerij, rechts uitgelijnd, boven de pauze-overlay
 *   (z-index 61 tegen 55) — ook tijdens PAUSED dus bereikbaar.
 * - Sluiten doet het menu zelf: klik buiten, Escape, of een keuze maken.
 *   Bouw daar geen eigen sluitknop bij.
 * - Zichtbaarheid regel je NIET hier: de sectie is verborgen zodra jouw
 *   ⋯-knop `hidden` is (dat is jouw `hasMore`), zodat een speler nooit een
 *   lege groep ziet. Verander je die logica, dan volgt deze sectie vanzelf.
 * @returns {HTMLElement | null}
 */
export function hostActionSlot() {
  return document.getElementById(HOST_SLOT_ID);
}

const LANG_FLAG = { nl: '🇳🇱', en: '🇬🇧', es: '🇪🇸' };

// Vaste id's: het menu bestaat precies één keer per pagina (gemount in
// #app-header), dus ze kunnen niet botsen.
const PANEL_ID = 'app-menu-panel';
const HOST_SLOT_ID = 'app-menu-host';
const HOST_LABEL_ID = 'app-menu-host-label';
const LANG_LABEL_ID = 'app-menu-lang-label';
const THEME_LABEL_ID = 'app-menu-theme-label';
const REACTIONS_LABEL_ID = 'app-menu-reactions-label';

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
