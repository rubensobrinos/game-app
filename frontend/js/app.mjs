// app.mjs — UI1. Entry point (`<script type="module">`), geladen vanuit
// `index.html`. Bepaalt de route (`route-resolver`) en de bijbehorende view
// (`view-switcher`), en mount scherm 1 (Home) of scherm 2 (Preview/join) uit
// `views/`. UI2-UI5's routes (`lobby`/`gameplay`/`scoreboard`/`podium`) tonen
// hier bewust nog een placeholder — die schermen bestaan pas vanaf UI2.
//
// Ook verantwoordelijk voor het appbrede hamburgermenu (`app-menu.mjs`,
// gemount in `#app-header`, buiten `#app-root` zodat het elke routewissel
// overleeft): de taal van de app-UI zelf en het licht/donker-thema. Dit is
// UI-voorkeur, geen game-instelling — de taal waarin vragen gesteld worden
// blijft apart in `host-setup-state`'s `config.language`.
//
// Transportlaag: `transport-mock.mjs` (INT-A's stap 2 bestaat nog niet). Eén
// module-brede instantie — `createMockTransport()` houdt zijn "room" in
// geheugen per instantie, dus code-invoer moet dezelfde instantie raadplegen
// als "Snel starten" gebruikte. De swap naar de echte transportlaag is later
// één importwijziging hier (`transport-mock.mjs` → `transport.mjs`).

import { applyI18n, t, setLang, getLang } from './i18n.mjs';
import { loadLang, saveLang, loadTheme, saveTheme } from './preferences.mjs';
import { createAppMenu } from './app-menu.mjs';
import { resolveRoute } from '../../client/flow/route-resolver.mjs';
import { joinSourceFor } from '../../client/flow/share-actions.mjs';
import { viewFor } from './view-switcher.mjs';
import { createMockTransport } from './transport-mock.mjs';
import { createHomeView } from './views/home.mjs';
import { createJoinView } from './views/join.mjs';

const ROOT_ID = 'app-root';
const HEADER_ID = 'app-header';
const transport = createMockTransport();
const storage = window.localStorage;

let currentScreen = null; // { render() } van de actief gemounte view — ververst bij een taalwissel

function getRoot() {
  return document.getElementById(ROOT_ID);
}

function navigate(path) {
  window.history.pushState(null, '', path);
  render();
}

function renderPlaceholder(root, key) {
  root.textContent = '';
  const message = document.createElement('p');
  message.dataset.i18n = key;
  root.appendChild(message);
  applyI18n();
}

function render() {
  const root = getRoot();
  if (root === null) {
    return;
  }

  const route = resolveRoute(window.location.pathname, window.location.search);
  const view = viewFor({ route: route.route });

  if (view === 'home') {
    currentScreen = createHomeView({
      root,
      t,
      transport,
      storage,
      onNavigate: navigate,
      onCodeLocator: (locator) => {
        root.textContent = '';
        currentScreen = createJoinView({
          root,
          t,
          transport,
          storage,
          onJoined: (session) => navigate(`/game/${session.gameCode}`),
        });
        currentScreen.start(locator);
      },
    });
    return;
  }

  if (view === 'preview-join') {
    const locator =
      route.route === 'join'
        ? { type: 'invite', inviteId: route.inviteId, joinSource: joinSourceFor(window.location.search) }
        : null;
    if (locator === null) {
      // route 'game'/'host' zonder actieve fase en zonder invite/code bij de
      // hand (bv. een herladen deep link zonder opgeslagen sessie) — UI1b
      // regelt reconnect via een opgeslagen sessie; nu nog een placeholder.
      currentScreen = null;
      renderPlaceholder(root, 'scaffold.ready');
      return;
    }
    currentScreen = createJoinView({
      root,
      t,
      transport,
      storage,
      onJoined: (session) => navigate(`/game/${session.gameCode}`),
    });
    currentScreen.start(locator);
    return;
  }

  // 'lobby' | 'gameplay' | 'scoreboard' | 'podium' | 'unknown': schermen van
  // UI2-UI5, nog niet gebouwd.
  currentScreen = null;
  renderPlaceholder(root, 'scaffold.ready');
}

function initialTheme() {
  const stored = loadTheme(storage);
  if (stored !== null) {
    return stored;
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function setupMenu() {
  const headerRoot = document.getElementById(HEADER_ID);
  if (headerRoot === null) {
    return;
  }

  const menu = createAppMenu({
    root: headerRoot,
    t,
    initialLang: getLang(),
    initialTheme: document.documentElement.dataset.theme,
    onLangChange(lang) {
      setLang(lang);
      saveLang(storage, lang);
      applyI18n();
      menu.setLang(lang);
      currentScreen?.render?.();
    },
    onThemeChange(theme) {
      applyTheme(theme);
      saveTheme(storage, theme);
      menu.setTheme(theme);
    },
  });
}

function main() {
  const storedLang = loadLang(storage);
  if (storedLang !== null) {
    setLang(storedLang);
  }
  applyTheme(initialTheme());
  applyI18n();
  setupMenu();
  render();
  window.addEventListener('popstate', render);
  console.log('[frontend] UI1 home + join screens wired up.');
}

main();
