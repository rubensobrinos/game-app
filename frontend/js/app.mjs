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
//
// SOLOMODUS (besluit C-1, 5 aug 2026): "Alleen spelen" op het homescherm is
// dezelfde mocktransport, maar dan als PRODUCT in plaats van als
// ontwikkelhulpmiddel. Solo is geen tweede app meer (zie
// docs/PLAN-CONVERGENTIE.md deel B): je speelt dezelfde schermen, dezelfde
// games en hetzelfde ontwerp, in een kamer met één speler. Er gaat geen enkel
// verzoek naar de server.
//
// Overleeft solo een herlaadbeurt? (Ronde 3 fase 3, besluit M5 uit
// PLAN-OPENSTAAND.md.) Sinds 6 aug 2026: ja. De mockroom zelf is nog steeds
// puur in-memory (geen server, geen netwerk) — wat hier bijkomt is dat elke
// gebeurtenis die de speler ook echt te zien krijgt (`transport-mock.mjs`'s
// `onStateChange`) meteen naar `sessionStorage` gaat (`client/flow/
// solo-store.mjs`), en dat `render()` hieronder bij een `game`/`host`-route
// zonder actieve solopagina eerst probeert te herstellen vóór hij opgeeft.
// `sessionStorage` en niet `localStorage`: een solopartij is het geheugen van
// één tabblad — dat moet een herlaadbeurt overleven (waar dit voor gebouwd
// is), maar niet voor onbepaalde tijd blijven rondslingeren na het sluiten
// ervan, en zeker niet meebloeden naar een nieuw tabblad.

import { applyI18n, t, tCount, setLang, getLang } from './i18n.mjs';
import { loadLang, saveLang, loadTheme, saveTheme } from './preferences.mjs';
import { createAppMenu } from './app-menu.mjs';
import { resolveRoute } from '../../client/flow/route-resolver.mjs';
import { joinSourceFor } from '../../client/flow/share-actions.mjs';
import { clearSession, loadSession, saveSession } from '../../client/flow/session-store.mjs';
import { saveSoloState, loadSoloState, clearSoloState } from '../../client/flow/solo-store.mjs';
import { createTransport } from './transport.mjs';
import { createMockTransport } from './transport-mock.mjs';
import { createHomeView } from './views/home.mjs';
import { createJoinView } from './views/join.mjs';
import { createSessionShell } from './session-shell.mjs';

const ROOT_ID = 'app-root';
const HEADER_ID = 'app-header';
const mockMode = new URLSearchParams(window.location.search).has('mock');
/**
 * De actieve transportlaag. Geen `const` meer: "Alleen spelen" wisselt hem
 * voor deze pagina om naar de mock (zie `startSolo`). De echte transport komt
 * nooit terug zonder herlaadbeurt — dat hoeft ook niet, want een solopartij
 * eindigt op het podium of bij het verlaten van de pagina.
 */
let transport = mockMode ? createMockTransport() : createTransport();
/** Draait deze pagina een solopartij? (Bepaalt of een sessie herstelbaar is.) */
let soloMode = mockMode;
if (mockMode) {
  console.warn('[frontend] MOCKMODUS actief (?mock=1): geen server, alles lokaal gesimuleerd.');
}
const storage = window.localStorage;
/** Alleen voor de mockroomstate van een solopartij, zie de moduledoc hierboven. */
const soloStorage = window.sessionStorage;

/**
 * Bouwt de mocktransport voor een solopartij, met persistentie aangehaakt:
 * elke state die de speler te zien krijgt gaat naar `sessionStorage`, onder
 * de gamecode uit diezelfde state (dus zonder dat de aanroeper 'm al hoeft te
 * kennen — handig in `startSolo()`, waar de gamecode pas na `createGame()`
 * bekend is).
 * @param {object} [restoreState]
 */
function createPersistedSoloTransport(restoreState) {
  return createMockTransport({
    restoreState,
    onStateChange: (state) => saveSoloState(soloStorage, state.gameCode, state),
  });
}

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
    tCount,
    transport,
    storage,
    onJoined: (session) => navigate(`/game/${session.gameCode}`),
    onLeaveHome: () => navigate('/'),
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
      onSolo: startSolo,
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
    if (session !== null && session.solo === true && !soloMode) {
      // Een solosessie uit een vórige pagelaad: de mockkamer zelf bestond
      // alleen in het geheugen van díe pagina, maar `sessionStorage` kan de
      // laatst gemelde state ervan nog hebben (zie createPersistedSoloTransport
      // hierboven) — probeer daarmee verder te spelen vóór we opgeven.
      const restoreState = loadSoloState(soloStorage, route.code);
      const restoredTransport = restoreState === null ? null : tryRestoreSoloTransport(restoreState);
      if (restoredTransport === null) {
        // Niets (bruikbaars) gevonden: liever meteen terug naar huis dan een
        // scherm dat op een niet-bestaande kamer wacht.
        clearSession(storage, route.code);
        clearSoloState(soloStorage, route.code);
        navigate('/');
        return;
      }
      transport = restoredTransport;
      soloMode = true;
    }
    if (session !== null) {
      currentScreen = createSessionShell({
        root,
        headerRoot: document.getElementById(HEADER_ID),
        t,
        tCount,
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

/**
 * Probeert een opgeslagen solostate om te zetten in een werkende transport.
 * Faalt (en levert `null`) bij een corrupte waarde, een verlopen contentversie
 * na een deploy tussen opslaan en herladen, of iets anders onvoorziens —
 * `deserializeRoomState` (transport-mock.mjs) gooit in al die gevallen, dit is
 * de enige plek die dat mag opvangen in plaats van de hele pagina te breken.
 * @param {object} restoreState
 * @returns {ReturnType<typeof createMockTransport> | null}
 */
function tryRestoreSoloTransport(restoreState) {
  try {
    return createPersistedSoloTransport(restoreState);
  } catch (error) {
    console.warn('[frontend] solopartij herstellen na herlaadbeurt mislukt', error);
    return null;
  }
}

/**
 * Start een solopartij: dezelfde app, dezelfde schermen, één speler.
 *
 * Bewust geen eigen route (`/solo` is nog de oude singleplayer-app, en een
 * nieuwe toplevel-route vraagt een Caddy-regel): een solopartij loopt over
 * `/host/{code}` net als elke andere, alleen dan tegen de mocktransport.
 */
async function startSolo() {
  transport = createPersistedSoloTransport();
  soloMode = true;
  try {
    const response = await transport.createGame({
      config: {},
      hostParticipates: true,
      displayName: null,
    });
    saveSession(storage, {
      sessionToken: response.sessionToken,
      roomCode: response.gameCode,
      playerId: response.playerId,
      savedAt: Date.now(),
      solo: true,
    });
    navigate(`/host/${response.gameCode}`);
  } catch (error) {
    // De mock werpt hier in de praktijk niet; valt hij toch om, dan blijft de
    // gebruiker gewoon op het homescherm staan met de echte transport terug.
    console.error('[frontend] solopartij starten mislukt', error);
    transport = mockMode ? transport : createTransport();
    soloMode = mockMode;
  }
}

function initialTheme() {
  const stored = loadTheme(storage);
  if (stored !== null) {
    return stored;
  }
  // 1c is donker-eerst (producteigenaar, 4 aug: "waarom is de achtergrond
  // wit?"): het systeemthema wordt NIET meer gevolgd — donker is de
  // merkstand, licht is een bewuste keuze via het menu (en die onthouden we).
  return 'dark';
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
