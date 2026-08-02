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

  const panel = el('div', 'app-menu');
  panel.hidden = true;

  const langLabel = el('span', 'app-menu-label');
  const langGroup = el('div', 'btn-group');
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
  const themeGroup = el('div', 'btn-group');
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
  hamburger.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
  });
  document.addEventListener('click', (event) => {
    if (!panel.hidden && !root.contains(event.target)) {
      panel.hidden = true;
    }
  });

  let currentLang = initialLang;
  let currentTheme = initialTheme;

  function refresh() {
    hamburger.setAttribute('aria-label', t('menu.open'));
    langLabel.textContent = t('menu.language');
    themeLabel.textContent = t('menu.theme');
    for (const [lang, btn] of langButtons) {
      btn.classList.toggle('active', lang === currentLang);
    }
    for (const [theme, btn] of themeButtons) {
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

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
