// views/lobby.mjs — UI2. DOM-laag van scherm 3 (Lobby). Alle deelnemers- en
// deellogica komt van buiten (session-shell.mjs, UI0's orchestratiepatroon):
// dit bestand rendert alleen en vertaalt tikken naar callbacks.
//
// Opgesplitst (docs/openstaand/refactor/11-lobby.md, 6 aug 2026): de lobby is
// in feite vier schermen op één pagina, en dit bestand zei dat zelf al in
// zijn kopjes. Wat overblijft is het samenstellen en `update()` — de ene
// functie die de serverstand naar de vijf `lobby/*.mjs`-onderdelen doorgeeft.
// GEEN gedragsverandering bij die splitsing: elk onderdeel bouwt precies
// dezelfde DOM-knopen als voorheen, en dit bestand plakt ze in dezelfde
// platte volgorde terug onder `.lobby-main-column`/`.lobby-screen` —
// bewust GEEN extra wrapper-divs, want `lobby.css`/`1c-licht.css` stylen
// sommige van die knopen via `.lobby-main-column > .lobby-self` e.d.
// (flex-`gap`-ritme + margin-reset op directe kinderen); een tussenlaag zou
// dat ritme stilzwijgend verschuiven.
//
// Vier dingen die vastliggen (11-lobby.md) — zie de submodules voor de
// details, dit bestand raakt ze zelf niet meer aan:
//  1. Wat speelbaar is: `shared/content/game-catalog.mjs`, alleen gebruikt in
//     `lobby/gamekeuze.mjs`.
//  2. De serverstand is de waarheid: elke submodule zet zijn `is-active`/
//     `is-on`-klassen alleen in zijn eigen `update(model)`, nooit bij de klik.
//  3. De warm-up (Rounda-Flag) blijft opengeklapt — blijft hieronder staan,
//     ongewijzigd.
//  4. De startknop is sticky (CSS, `sticky-start.test.mjs`) — blijft
//     hieronder staan, ongewijzigd.

import { createRoundaFlagView } from './rounda-flag.mjs';
import { createSpelersView } from './lobby/spelers.mjs';
import { createZelfView } from './lobby/zelf.mjs';
import { createGamekeuzeView } from './lobby/gamekeuze.mjs';
import { createInstellingenView } from './lobby/instellingen.mjs';
import { createDelenView } from './lobby/delen.mjs';

export function createLobbyView({
  root,
  t,
  tCount,
  isHost,
  onStart,
  onShareAction,
  onKickPlayer,
  onRename,
  onRecolor,
  onConfigChange,
  // docs/openstaand/host-wijzigt-naam-en-kleur.md: hostvariant van
  // onRename/onRecolor hierboven — zelfde LOBBY-only regels, maar de host
  // kiest de doelspeler en de eenmaal-limiet van onRename geldt niet voor
  // hem. Optioneel (`?.()` hieronder) zolang de aanroeper deze twee nog niet
  // meegeeft — de knoppen verschijnen dan gewoon, maar doen niets.
  onHostRenamePlayer,
  onHostRecolorPlayer,
}) {
  root.textContent = '';

  // Geen eigen `.screen`-klasse: de aanroeper (session-shell.mjs) mount dit in
  // een container die dat al levert (consistent met hoe gameplay.mjs/
  // scoreboard.mjs/podium.mjs geen eigen layout-wrapper hebben).
  const screen = el('div', 'lobby-screen');
  // C0 (punt 9): de zichtbare titel "Lobby" vertelde niemand iets wat het
  // scherm niet al toont, en kostte bovenaan een telefoonscherm meer ruimte
  // dan de spelerslijst eronder. Screenreaders hebben bij een schermwissel
  // wél een aankondigingspunt nodig, dus dezelfde constructie als
  // gameplay.mjs' `screenTitle`: een `sr-only`-kop, visueel niets. Absoluut
  // gepositioneerd (`.sr-only`), dus geen flex-item en dus ook geen `gap`.
  const title = el('h2', 'sr-only');
  const lockedNotice = el('p', 'lobby-locked');
  lockedNotice.hidden = true;

  const spelersView = createSpelersView({ t, tCount, isHost, onKickPlayer, onHostRenamePlayer, onHostRecolorPlayer });
  const zelfView = createZelfView({ t, isHost, onRename, onRecolor });
  const gamekeuzeView = createGamekeuzeView({ t, onConfigChange });
  const instellingenView = createInstellingenView({
    t,
    isHost,
    onConfigChange,
    gamekeuzeElements: [gamekeuzeView.gameRow, gamekeuzeView.gameCardSub],
  });
  const delenView = createDelenView({ t, onShareAction });

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'btn-primary lobby-start';
  startButton.hidden = !isHost;
  startButton.addEventListener('click', () => {
    if (!startButton.disabled) {
      onStart();
    }
  });
  // BOUWSPRINT: subregel onder de knoplabel, zelfde patroon als home.mjs's
  // quickStartLabel/-Sub — twee spans in één knop i.p.v. een los element,
  // zodat er geen tweede grid-area-toewijzing nodig is voor T5-7's
  // tabletlayout (`.lobby-start` blijft het enige grid-item).
  const startButtonLabel = el('span', 'lobby-start-label');
  const startButtonSub = el('span', 'lobby-start-sub');
  startButton.append(startButtonLabel, startButtonSub);

  // T5-7: vanaf tabletbreedte staat de deelsectie náást i.p.v. onder de
  // spelerslijst (`07` §6) — pure groepering, geen herordening: dezelfde drie
  // stukken in dezelfde DOM-volgorde als voorheen (lijst, delen, startknop),
  // nu alleen zodat CSS Grid-areas ze kan plaatsen zonder de leesvolgorde
  // voor toetsenbord/screenreader te wijzigen.
  const mainColumn = el('div', 'lobby-main-column');
  mainColumn.append(
    title, lockedNotice,
    zelfView.playerStatus, zelfView.waiting,
    spelersView.countLine, spelersView.recentJoinsLabel, spelersView.list, spelersView.viewAllButton, spelersView.emptyState,
    zelfView.selfSection,
    instellingenView.settingsSection,
  );
  // De lobby-warm-up is sinds 3 aug de Rounda-Flag ("Wave Run") van de
  // producteigenaar — spring over de vlaggen, score telt, record blijft
  // lokaal bewaard. De rad-warm-up (rounda.mjs) blijft de vulling voor de
  // kleine wachtmomenten (reconnect/pauze, session-shell.mjs).
  const roundaGameRoot = el('div', 'lobby-rounda');
  const roundaGame = createRoundaFlagView({ root: roundaGameRoot, t });
  mainColumn.append(roundaGameRoot);

  screen.append(mainColumn, delenView.shareSection, startButton);
  root.appendChild(screen);

  let unlockedTimer = null;
  // null = nog geen snapshot gezien — voorkomt dat de eerste update() na het
  // mounten (locked: false) al een "ontgrendeld"-flits toont; die hoort
  // alleen bij een échte overgang van vergrendeld naar ontgrendeld.
  let previousLocked = null;

  function renderStatic() {
    title.textContent = t('lobby.title');
    startButtonLabel.textContent = t('lobby.start');
    startButtonSub.textContent = t('lobby.startSub');
  }

  renderStatic();

  /**
   * @param {{ playerCount: number, participants: Map<string,string>, canStart: boolean, locked: boolean, selfName: string | null, capabilities: {nativeShareAvailable:boolean}, joinUrl: string }} model
   */
  function update(model) {
    spelersView.update(model);
    zelfView.update(model);

    if (model.locked === true) {
      clearTimeout(unlockedTimer);
      lockedNotice.hidden = false;
      lockedNotice.textContent = t('lobby.locked');
    } else if (previousLocked === true) {
      // Échte overgang vergrendeld → ontgrendeld: kort tonen, dan stil —
      // zelfde 3s-patroon als session-shell.mjs's connection.connected (T4-2a).
      lockedNotice.hidden = false;
      lockedNotice.textContent = t('lobby.unlocked');
      clearTimeout(unlockedTimer);
      unlockedTimer = setTimeout(() => {
        lockedNotice.hidden = true;
      }, 3000);
    }
    previousLocked = model.locked === true;

    delenView.update(model);

    if (isHost) {
      startButton.hidden = false;
      startButton.disabled = !model.canStart;
      gamekeuzeView.update(model);
      instellingenView.update(model);
    }
  }

  return {
    update,
    render() {
      renderStatic();
      spelersView.render();
      zelfView.render();
      gamekeuzeView.render();
      instellingenView.render();
      delenView.render();
    },
    // Ruimt de minigame-timers/listeners op bij fase-/schermwissel
    // (session-shell roept destroy?.() al optioneel aan).
    destroy() {
      roundaGame?.destroy?.();
    },
  };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
