// views/lobby.mjs — UI2. DOM-laag van scherm 3 (Lobby). Alle deelnemers- en
// deellogica komt van buiten (session-shell.mjs, UI0's orchestratiepatroon):
// dit bestand rendert alleen en vertaalt tikken naar callbacks.
//
// Deelnemerslijst: `match-phase-state` bewaart bewust geen spelerscount/-lijst
// (GF-HANDOFF-TO-INT-A.md), dus de aanroeper houdt die lokaal bij uit
// `room:state`'s `room.playerCount` (altijd betrouwbaar) en
// `room:player-changed`'s deltas (namen, alleen vanaf het moment van
// verbinden — een joiner ziet dus geen namen van spelers die er al eerder
// waren, alleen het aantal; zie HANDOFF-UI voor de reden).
//
// Delen: `show-qr`/`show-code` uit `share-actions.shareActionsFor(capabilities)`
// worden hier bewust NIET getoond (02-S05-permanente-qr-code.md, D-018/D-019):
// `room-header.mjs` toont code + QR nu permanent in de appheader, voor
// iedereen, de hele sessie lang — een tweede ingang hier zou D-018's "geen
// dubbele ingang" schenden (zie ook prompt 01's S17-punt over dubbele
// deelnemersweergave, hetzelfde patroon). Alleen `native-share`/`copy-link`
// blijven staan: die dienen een ander doel (de OS-deelsheet, het klembord)
// dan wat de header al permanent toont.

import { shareActionsFor, shareUrlsFor } from '../../../client/flow/share-actions.mjs';
import { participantPresentationFor } from './participant-presentation.mjs';

// T5-9: hoeveel van de meest recente joins zichtbaar blijven in de
// samengevouwen 'aggregate'-weergave (36+ spelers) vóórdat "Bekijk alle
// spelers" wordt gebruikt.
const RECENT_JOINS_COUNT = 5;

export function createLobbyView({ root, t, tCount, isHost, onStart, onShareAction, onKickPlayer }) {
  root.textContent = '';

  // Geen eigen `.screen`-klasse: de aanroeper (session-shell.mjs) mount dit in
  // een container die dat al levert (consistent met hoe gameplay.mjs/
  // scoreboard.mjs/podium.mjs geen eigen layout-wrapper hebben).
  const screen = el('div', 'lobby-screen');
  const title = el('h2', 'lobby-title');
  const lockedNotice = el('p', 'lobby-locked');
  lockedNotice.hidden = true;
  // Spelerslobby-copy (09 §6) — additief naast de host-kant hieronder, geen
  // vervanging: alleen zichtbaar voor een niet-host (T4-5).
  const playerStatus = el('div', 'lobby-player-status');
  playerStatus.hidden = isHost;
  const playerJoined = el('p', 'lobby-player-joined');
  const playerWaitingForHost = el('p', 'lobby-player-waiting-for-host');
  const playerInviteHint = el('p', 'lobby-player-invite-hint');
  const playerSelf = el('p', 'lobby-player-self');
  playerStatus.append(playerJoined, playerWaitingForHost, playerInviteHint, playerSelf);
  const waiting = el('p', 'lobby-waiting');
  const countLine = el('p', 'lobby-count');
  const list = document.createElement('ul');
  list.className = 'lobby-players';
  // T5-9: 36+ spelers toont alleen de recente joins + dit totaal; de
  // volledige lijst blijft opvraagbaar (07 §9 verbiedt een permanente
  // namenmuur, niet dat de data ooit zichtbaar mag worden).
  const recentJoinsLabel = el('p', 'lobby-recent-joins-label');
  recentJoinsLabel.hidden = true;
  const viewAllButton = document.createElement('button');
  viewAllButton.type = 'button';
  viewAllButton.className = 'btn-quiet lobby-view-all';
  viewAllButton.hidden = true;
  viewAllButton.addEventListener('click', () => {
    showAllPlayers = !showAllPlayers;
    if (lastModel !== null) {
      update(lastModel);
    }
  });
  // Lege staat i.p.v. "0 spelers" + een lege lijst — alleen mogelijk vóór
  // de host zelf meedoet, of héél even bij het allereerste render-moment.
  const emptyState = el('div', 'lobby-empty');
  emptyState.hidden = true;
  const emptyTitle = el('p', 'lobby-empty-title');
  const emptyHint = el('p', 'lobby-empty-hint');
  emptyState.append(emptyTitle, emptyHint);

  // De vier deelacties als één omkaderde groep met een kop, in plaats van vier
  // losse knoppen tussen de rest van het scherm. `lobby.share` ("Uitnodigen")
  // bestond al in alle drie de locales maar werd nergens getoond.
  const shareSection = el('section', 'lobby-share');
  const shareTitle = el('h3', 'lobby-share-title');
  const shareRow = el('div', 'lobby-share-row');
  const shareButtons = new Map();
  for (const action of ['native-share', 'copy-link']) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-secondary lobby-share-${action}`;
    btn.hidden = true;
    btn.addEventListener('click', () => handleShareAction(action));
    shareButtons.set(action, btn);
    shareRow.appendChild(btn);
  }

  const feedback = el('p', 'lobby-share-feedback');
  feedback.setAttribute('aria-live', 'polite');
  const linkFallback = document.createElement('input');
  linkFallback.type = 'text';
  linkFallback.readOnly = true;
  linkFallback.className = 'field-input lobby-link-fallback';
  linkFallback.hidden = true;
  linkFallback.addEventListener('focus', () => linkFallback.select());

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'btn-primary lobby-start';
  startButton.hidden = !isHost;
  startButton.addEventListener('click', () => {
    if (!startButton.disabled) {
      onStart();
    }
  });

  // Feedback en link horen bij het deelblok — die stonden eerder los onder de
  // knoppen, waardoor "Gekopieerd!" losgezongen van zijn actie verscheen.
  shareSection.append(shareTitle, shareRow, feedback, linkFallback);
  // T5-7: vanaf tabletbreedte staat de deelsectie náást i.p.v. onder de
  // spelerslijst (`07` §6) — pure groepering, geen herordening: dezelfde drie
  // stukken in dezelfde DOM-volgorde als voorheen (lijst, delen, startknop),
  // nu alleen zodat CSS Grid-areas ze kan plaatsen zonder de leesvolgorde
  // voor toetsenbord/screenreader te wijzigen.
  const mainColumn = el('div', 'lobby-main-column');
  mainColumn.append(title, lockedNotice, playerStatus, waiting, countLine, recentJoinsLabel, list, viewAllButton, emptyState);
  screen.append(mainColumn, shareSection, startButton);
  root.appendChild(screen);

  let availableActions = [];
  let shareUrls = { qrUrl: '', copyUrl: '' };
  let feedbackTimer = null;
  let unlockedTimer = null;
  // null = nog geen snapshot gezien — voorkomt dat de eerste update() na het
  // mounten (locked: false) al een "ontgrendeld"-flits toont; die hoort
  // alleen bij een échte overgang van vergrendeld naar ontgrendeld.
  let previousLocked = null;
  // M7/E03: bestaande rijen per playerId, zodat een nieuwe join alleen die
  // ene rij toevoegt i.p.v. de hele lijst te herbouwen (dat zou élke
  // bestaande rij opnieuw laten fade-in'en bij elke join — precies de ruis
  // die 06 §2/§7 willen vermijden).
  const renderedRows = new Map();
  // null = nog geen telling gezien — voorkomt een puls bij het allereerste
  // render-moment (dat is geen "join", dat is de startstand).
  let lastPulsedCount = null;
  let pulseTimer = null;
  // T5-9: laatst ontvangen model, puur om de "Bekijk alle spelers"-toggle
  // een re-render te kunnen triggeren zonder dat de aanroeper opnieuw
  // update() hoeft aan te roepen voor een zuiver lokale UI-actie.
  let lastModel = null;
  let showAllPlayers = false;

  async function handleShareAction(action) {
    onShareAction(action);
    feedback.textContent = '';

    if (action === 'native-share') {
      try {
        await navigator.share({ url: shareUrls.copyUrl });
      } catch {
        // Geannuleerd of geweigerd door de gebruiker/OS — geen foutmelding,
        // dit is een normale uitkomst van de native deelsheet.
      }
      return;
    }

    if (action === 'copy-link') {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrls.copyUrl);
          showFeedback(t('lobby.copied'));
          return;
        } catch {
          // valt door naar de zichtbare fallback hieronder
        }
      }
      linkFallback.value = shareUrls.copyUrl;
      linkFallback.hidden = false;
      linkFallback.focus();
      showFeedback(t('lobby.copyFailed'));
    }
  }

  function showFeedback(message) {
    feedback.textContent = message;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      feedback.textContent = '';
    }, 3000);
  }

  const SHARE_LABEL_KEYS = {
    'native-share': 'lobby.shareNative',
    'copy-link': 'lobby.shareCopy',
  };

  function renderStatic() {
    title.textContent = t('lobby.title');
    waiting.textContent = t('lobby.waiting');
    shareTitle.textContent = t('lobby.share');
    startButton.textContent = t('lobby.start');
    linkFallback.setAttribute('aria-label', t('lobby.shareCopy'));
    emptyTitle.textContent = t('lobby.emptyTitle');
    emptyHint.textContent = t('lobby.emptyHint');
    playerJoined.textContent = t('lobby.playerJoined');
    playerWaitingForHost.textContent = t('lobby.playerWaitingForHost');
    playerInviteHint.textContent = t('lobby.playerInviteHint');
    recentJoinsLabel.textContent = t('lobby.recentJoins');
    viewAllButton.textContent = showAllPlayers ? t('lobby.viewAllHide') : t('lobby.viewAllShow');
    for (const [action, btn] of shareButtons) {
      btn.textContent = t(SHARE_LABEL_KEYS[action]);
      btn.hidden = !availableActions.includes(action);
    }
  }

  renderStatic();

  /**
   * @param {{ playerCount: number, participants: Map<string,string>, canStart: boolean, locked: boolean, selfName: string | null, capabilities: {nativeShareAvailable:boolean}, joinUrl: string }} model
   */
  function update(model) {
    lastModel = model;
    availableActions = shareActionsFor(model.capabilities);
    shareUrls = shareUrlsFor(model.joinUrl);
    renderStatic();

    if (!isHost) {
      playerSelf.textContent = model.selfName ? t('lobby.playerSelf').replace('{naam}', model.selfName) : '';
    }

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

    const empty = model.playerCount === 0;
    const presentation = participantPresentationFor(model.playerCount);
    emptyState.hidden = !empty;
    countLine.hidden = empty;
    list.hidden = empty;
    // T5-9: 9–35 spelers krijgt een compact grid i.p.v. de ruime rijenlijst;
    // hergebruikt dezelfde `.lobby-player`-rijen, alleen de layout wijzigt.
    list.classList.toggle('lobby-players-grid', presentation === 'grid');
    viewAllButton.hidden = presentation !== 'aggregate';
    recentJoinsLabel.hidden = presentation !== 'aggregate' || showAllPlayers;

    if (!empty) {
      // `tCount` en niet `${n} ${t(...)}`: dat laatste gaf "1 spelers". De
      // tekst zelf is altijd meteen up-to-date — alleen de puls (decoratief)
      // is hieronder gedebouncet, niet de data.
      countLine.textContent = tCount('lobby.playerCount', model.playerCount);
      if (lastPulsedCount === null) {
        lastPulsedCount = model.playerCount;
      } else if (model.playerCount !== lastPulsedCount) {
        // M7/E03: "teller pulseert één keer" — bij een snelle reeks joins
        // (bulkjoin) pulseert de teller dus één keer ná de rustmoment, niet
        // eenmaal per join. Geluid-clustering (06 §2) is hier niet van
        // toepassing: er is nog geen join-cue om te clusteren (geparkeerd op
        // `O-008`, zie `M4`) — alleen deze visuele puls wordt gedebouncet.
        clearTimeout(pulseTimer);
        pulseTimer = setTimeout(() => {
          countLine.classList.remove('lobby-count-pulse');
          void countLine.offsetWidth; // forceer reflow, anders herstart de animatie niet
          countLine.classList.add('lobby-count-pulse');
          lastPulsedCount = model.playerCount;
        }, 300);
      }

      // M7/E03: reconciliatie i.p.v. volledige herbouw — bestaande rijen
      // blijven hun eigen DOM-node houden (geen hertriggerde animatie),
      // alleen écht nieuwe `playerId`'s krijgen een nieuwe, geanimeerde rij.
      const currentIds = new Set(model.participants.keys());
      for (const [playerId, entry] of renderedRows) {
        if (!currentIds.has(playerId)) {
          entry.item.remove();
          renderedRows.delete(playerId);
        }
      }
      for (const [playerId, name] of model.participants) {
        const existing = renderedRows.get(playerId);
        if (existing !== undefined) {
          // Rename-delta: naam (en kickknop-label) bijwerken zonder de rij
          // opnieuw te animeren.
          existing.label.textContent = name;
          existing.kickButton?.setAttribute('aria-label', `${t('hostbar.kick')} ${name}`);
          continue;
        }
        const item = document.createElement('li');
        item.className = 'lobby-player lobby-player-enter';
        const label = document.createElement('span');
        label.textContent = name;
        item.appendChild(label);
        let kickButton;
        // S17: dit is nu de enige plek die deelnemersnamen toont tijdens
        // LOBBY (hostbar.mjs's eigen lijst blijft daar bewust verborgen) —
        // de host krijgt de verwijderknop daarom hier, inline, niet in een
        // tweede lijst elders.
        if (isHost && model.canKick) {
          kickButton = document.createElement('button');
          kickButton.type = 'button';
          kickButton.className = 'btn-secondary lobby-player-kick';
          kickButton.textContent = t('hostbar.kick');
          kickButton.setAttribute('aria-label', `${t('hostbar.kick')} ${name}`);
          kickButton.addEventListener('click', () => {
            if (window.confirm(`${t('hostbar.kickConfirmPrefix')} ${name}`)) {
              onKickPlayer(playerId);
            }
          });
          item.appendChild(kickButton);
        }
        list.appendChild(item);
        renderedRows.set(playerId, { item, label, kickButton });
      }

      // T5-9: in de samengevouwen 'aggregate'-weergave alleen de meest
      // recente `RECENT_JOINS_COUNT` rijen tonen — de rest bestaat al in de
      // DOM (reconciliatie hierboven raakt ze niet aan) maar blijft
      // `hidden` tot "Bekijk alle spelers". Geen aparte animatie/re-render
      // nodig om ze weer te tonen, en een echt vertrokken speler is hier
      // sowieso al verwijderd door de reconciliatie hierboven.
      const collapsed = presentation === 'aggregate' && !showAllPlayers;
      const visibleIds = collapsed
        ? new Set([...model.participants.keys()].slice(-RECENT_JOINS_COUNT))
        : null;
      for (const [playerId, entry] of renderedRows) {
        entry.item.hidden = visibleIds !== null && !visibleIds.has(playerId);
      }
    }

    if (isHost) {
      startButton.hidden = false;
      startButton.disabled = !model.canStart;
    }
  }

  return { update, render: renderStatic };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
