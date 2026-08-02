// app-menu.mjs — UI1. Het hamburgermenu in de appheader, zichtbaar op élk
// scherm (gemount in `#app-header`, buiten `#app-root` — dat laatste wordt
// bij elke routewissel leeggemaakt, de header niet). Twee losse keuzes:
//
//   - Taal van de app-UI zelf (menu's, knoppen, foutmeldingen) — niet de taal
//     waarin vragen gesteld worden, dat is een aparte game-instelling
//     (`host-setup-state`'s `config.language`).
//   - Licht/donker-thema, toegepast via `document.documentElement.dataset.theme`
//     (CSS-variabelen in `base.css` onder `:root[data-theme="light"]`).
//
// Gebruik: createAppMenu({ root, t, initialLang, initialTheme, onLangChange,
// onThemeChange }) bouwt de hamburgerknop + het paneel; `refresh()` ververst
// de labels/actieve-status ná een taalwissel (dezelfde aanroeper-ververst-
// conventie als de schermmodules).

export function createAppMenu({ root, t, initialLang, initialTheme, onLangChange, onThemeChange }) {
  root.textContent = '';

  const hamburger = document.createElement('button');
  hamburger.type = 'button';
  hamburger.className = 'btn-icon app-hamburger';
  hamburger.textContent = '☰';
  // Het paneel is een menu dat de knop open-/dichtklapt; zonder deze drie
  // attributen kondigt een screenreader alleen "knop" aan, zonder dat er iets
  // open is gegaan. `aria-expanded` wordt bij elke wissel bijgewerkt.
  hamburger.setAttribute('aria-haspopup', 'true');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-controls', PANEL_ID);

  const panel = el('div', 'app-menu');
  panel.id = PANEL_ID;
  panel.hidden = true;

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
    });
    themeButtons.set(theme, btn);
    themeGroup.appendChild(btn);
  }
  const themeSection = el('div', 'app-menu-section');
  themeSection.append(themeLabel, themeGroup);

  panel.append(langSection, themeSection);
  root.append(hamburger, panel);

  hamburger.setAttribute('aria-label', t('menu.open'));

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
    hamburger.setAttribute('aria-expanded', String(open));
    if (!open && returnFocus) {
      hamburger.focus();
    }
  }

  hamburger.addEventListener('click', () => {
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

  function refresh() {
    hamburger.setAttribute('aria-label', t('menu.open'));
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

const LANG_FLAG = { nl: '🇳🇱', en: '🇬🇧', es: '🇪🇸' };

// Vaste id's: het menu bestaat precies één keer per pagina (gemount in
// #app-header), dus ze kunnen niet botsen.
const PANEL_ID = 'app-menu-panel';
const LANG_LABEL_ID = 'app-menu-lang-label';
const THEME_LABEL_ID = 'app-menu-theme-label';

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
