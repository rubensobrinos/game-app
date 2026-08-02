// app.mjs — UI1. Entry point (`<script type="module">`), geladen vanuit
// `index.html`. Bepaalt de route (`route-resolver`) en de bijbehorende view
// (`view-switcher`), en mount scherm 1 (Home) of scherm 2 (Preview/join) uit
// `views/`. UI2-UI5's routes (`lobby`/`gameplay`/`scoreboard`/`podium`) tonen
// hier bewust nog een placeholder — die schermen bestaan pas vanaf UI2.
//
// Transportlaag: `transport-mock.mjs` (INT-A's stap 2 bestaat nog niet). Eén
// module-brede instantie — `createMockTransport()` houdt zijn "room" in
// geheugen per instantie, dus code-invoer moet dezelfde instantie raadplegen
// als "Snel starten" gebruikte. De swap naar de echte transportlaag is later
// één importwijziging hier (`transport-mock.mjs` → `transport.mjs`).

import { applyI18n, t } from './i18n.mjs';
import { resolveRoute } from '../../client/flow/route-resolver.mjs';
import { joinSourceFor } from '../../client/flow/share-actions.mjs';
import { viewFor } from './view-switcher.mjs';
import { createMockTransport } from './transport-mock.mjs';
import { createHomeView } from './views/home.mjs';
import { createJoinView } from './views/join.mjs';

const ROOT_ID = 'app-root';
const transport = createMockTransport();
const storage = window.localStorage;

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
    createHomeView({
      root,
      t,
      transport,
      storage,
      onNavigate: navigate,
      onCodeLocator: (locator) => {
        root.textContent = '';
        createJoinView({ root, t, transport, storage, onJoined: (session) => navigate(`/game/${session.gameCode}`) }).start(
          locator
        );
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
      renderPlaceholder(root, 'scaffold.ready');
      return;
    }
    createJoinView({
      root,
      t,
      transport,
      storage,
      onJoined: (session) => navigate(`/game/${session.gameCode}`),
    }).start(locator);
    return;
  }

  // 'lobby' | 'gameplay' | 'scoreboard' | 'podium' | 'unknown': schermen van
  // UI2-UI5, nog niet gebouwd.
  renderPlaceholder(root, 'scaffold.ready');
}

function main() {
  applyI18n();
  render();
  window.addEventListener('popstate', render);
  console.log('[frontend] UI1 home + join screens wired up.');
}

main();
