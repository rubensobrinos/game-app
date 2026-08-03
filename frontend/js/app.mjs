// app.mjs — UI1/UI2/UI1b-kern. Entry point (`<script type="module">`),
// geladen vanuit `index.html`. Bepaalt de route (`route-resolver`) en mount
// het bijbehorende scherm: `home` (Snel starten/code), `join` (invite-
// preview), of — voor `game`/`host` — `session-shell.mjs`, dat zelf de
// socketverbinding en faseafhankelijke schermen (lobby/gameplay/scoreboard/
// podium) beheert zodra er een lokaal opgeslagen sessie is. Zonder sessie
// (een kale deep link) valt `game`/`host` terug op de code-invoerflow met de
// code uit de URL — dat is een betere UX dan een permanente placeholder.
//
// Ook verantwoordelijk voor het appbrede hamburgermenu (`app-menu.mjs`,
// gemount in `#app-header`, buiten `#app-root` zodat het elke routewissel
// overleeft): de taal van de app-UI zelf en het licht/donker-thema. Dit is
// UI-voorkeur, geen game-instelling — de taal waarin vragen gesteld worden
// blijft apart in `host-setup-state`'s `config.language`.
//
// Transportlaag: de ECHTE (`transport.mjs`) — REST + Socket.IO tegen de
// draaiende game-server, met snapshot-precedence en de onStatus-callback.
// De swap (mock → echt) is gedaan op 2 aug 2026, op aanwijzing van de
// producteigenaar; `transport-mock.mjs` blijft bestaan voor tests — én voor
// de mockmodus hieronder.
//
// MOCKMODUS (verzoek producteigenaar, 3 aug 2026): met `?mock=1` in de URL
// draait de app op de mock-transport — geen server, geen verbinding, geen
// tweede speler nodig. Bedoeld om schermen en flows solo te doorlopen
// (UX-werk, demo's, testen zonder host). De keuze geldt per pagelaad: de
// query hoeft alleen op de eerste URL te staan en verdwijnt daarna gewoon
// uit beeld bij navigatie; een verse reload zonder `?mock` is weer echt.

import { applyI18n, t, setLang, getLang } from './i18n.mjs';
import { loadLang, saveLang, loadTheme, saveTheme } from './preferences.mjs';
import { createAppMenu } from './app-menu.mjs';
import { resolveRoute } from '../../client/flow/route-resolver.mjs';
import { joinSourceFor } from '../../client/flow/share-actions.mjs';
import { loadSession } from '../../client/flow/session-store.mjs';
import { createTransport } from './transport.mjs';
import { createMockTransport } from './transport-mock.mjs';
import { createHomeView } from './views/home.mjs';
import { createJoinView } from './views/join.mjs';
import { createSessionShell } from './session-shell.mjs';

const ROOT_ID = 'app-root';
const HEADER_ID = 'app-header';
const mockMode = new URLSearchParams(window.location.search).has('mock');
const transport = mockMode ? createMockTransport() : createTransport();
if (mockMode) {
  console.warn('[frontend] MOCKMODUS actief (?mock=1): geen server, alles lokaal gesimuleerd.');
}
const storage = window.localStorage;

let currentScreen = null; // { render()?, destroy()? } van de actief gemounte view

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

function mountJoin(root, locator) {
  const view = createJoinView({
    root,
    t,
    transport,
    storage,
    onJoined: (session) => navigate(`/game/${session.gameCode}`),
  });
  view.start(locator);
  return view;
}

function render() {
  const root = getRoot();
  if (root === null) {
    return;
  }

  currentScreen?.destroy?.(); // sluit een eventueel open socket vóór de volgende view mount
  currentScreen = null;

  const route = resolveRoute(window.location.pathname, window.location.search);

  if (route.route === 'home') {
    currentScreen = createHomeView({
      root,
      t,
      transport,
      storage,
      onNavigate: navigate,
      onCodeLocator: (locator) => {
        currentScreen = mountJoin(root, locator);
      },
    });
    return;
  }

  if (route.route === 'join') {
    currentScreen = mountJoin(root, {
      type: 'invite',
      inviteId: route.inviteId,
      joinSource: joinSourceFor(window.location.search),
    });
    return;
  }

  if (route.route === 'game' || route.route === 'host') {
    const session = loadSession(storage, route.code);
    if (session !== null) {
      currentScreen = createSessionShell({
        root,
        t,
        transport,
        storage,
        code: route.code,
        isHostRoute: route.route === 'host',
        session,
        onLeaveHome: () => navigate('/'),
      });
      return;
    }
    // Kale deep link zonder lokale sessie: laat de code-invoerflow het
    // oplossen met de code uit de URL, in plaats van een dode placeholder.
    currentScreen = mountJoin(root, { type: 'code', code: route.code });
    return;
  }

  // 'screen' (spectators, buiten scope — DECISIONS.md #9) | 'unknown'
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
  console.log('[frontend] UI1/UI2 screens + session-shell wired up.');
}

main();
