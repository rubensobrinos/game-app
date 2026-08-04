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
import { createPlayerChip } from '../player-chip.mjs';
import { createRoundaFlagView } from './rounda-flag.mjs';

// T5-9: hoeveel van de meest recente joins zichtbaar blijven in de
// samengevouwen 'aggregate'-weergave (36+ spelers) vóórdat "Bekijk alle
// spelers" wordt gebruikt.
const RECENT_JOINS_COUNT = 5;

export function createLobbyView({ root, t, tCount, isHost, onStart, onShareAction, onKickPlayer, onRename }) {
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

  // ── SCHERM 3 (besluit 40B): "Zo heet je vanavond" — naam kiezen gebeurt
  // hier, niet meer vóór het joinen. `player:rename` mag alleen in LOBBY en
  // max. één keer (protocol) — na een geslaagde rename verdwijnt de knop.
  // "IK BEN KLAAR" is puur client-side bevestigen (40B): naamblok klapt om
  // naar de wachtstand, er gaat níéts over de lijn. ──
  const selfSection = el('section', 'lobby-self');
  selfSection.hidden = isHost;
  const selfLead = el('p', 'lobby-self-lead');
  const selfRow = el('div', 'lobby-self-row');
  const selfName = el('span', 'lobby-self-name');
  const renameButton = document.createElement('button');
  renameButton.type = 'button';
  renameButton.className = 'btn-secondary lobby-self-rename';
  const renameInput = document.createElement('input');
  renameInput.type = 'text';
  renameInput.className = 'field-input lobby-self-input';
  renameInput.maxLength = 60;
  renameInput.hidden = true;
  const renameSave = document.createElement('button');
  renameSave.type = 'button';
  renameSave.className = 'btn-secondary lobby-self-save';
  renameSave.hidden = true;
  const renameError = el('p', 'lobby-self-error field-error');
  selfRow.append(selfName, renameButton, renameInput, renameSave);
  const readyButton = document.createElement('button');
  readyButton.type = 'button';
  readyButton.className = 'btn-primary lobby-ready';
  const readyPill = el('div', 'lobby-ready-pill');
  readyPill.hidden = true;
  const readyPillDot = el('span', 'lobby-ready-dot');
  const readyPillText = el('span', 'lobby-ready-text');
  const readyPillName = el('span', 'lobby-ready-name');
  readyPill.append(readyPillDot, readyPillText, readyPillName);
  selfSection.append(selfLead, selfRow, renameError, readyButton, readyPill);

  let renameUsed = false; // protocol: player:rename max één keer
  let renameBusy = false;
  let isReady = false; // client-side (40B)

  renameButton.addEventListener('click', () => {
    renameInput.hidden = false;
    renameSave.hidden = false;
    renameButton.hidden = true;
    renameInput.value = selfName.textContent;
    renameInput.focus();
    renameInput.select();
  });
  renameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      renameSave.click();
    }
  });
  renameSave.addEventListener('click', async () => {
    const value = renameInput.value.trim();
    if (renameBusy || value === '' || value === selfName.textContent) {
      closeRenameEditor();
      return;
    }
    renameBusy = true;
    renameError.textContent = '';
    try {
      await onRename?.(value);
      renameUsed = true; // gelukt → protocol staat geen tweede toe
      closeRenameEditor();
    } catch (err) {
      renameError.textContent = t(`error.${err?.code ?? 'UNKNOWN_ERROR'}`);
      // Live-audit 4 aug: de echte server kent `player:rename` nog niet
      // (UNSUPPORTED_EVENT — protocol-pad bestaat, composition mist; zie
      // serverticket). Dan is opnieuw proberen zinloos: editor dicht, knop
      // weg — geen dode belofte laten staan.
      if (err?.code === 'UNSUPPORTED_EVENT') {
        renameUsed = true;
        closeRenameEditor();
      }
      renameBusy = false;
      return;
    }
    renameBusy = false;
  });
  function closeRenameEditor() {
    renameInput.hidden = true;
    renameSave.hidden = true;
    renameButton.hidden = renameUsed;
  }
  readyButton.addEventListener('click', () => {
    isReady = true;
    renameError.textContent = ''; // een hangende rename-fout hoort niet boven de wachtpil
    renderSelfSection();
  });

  function renderSelfSection() {
    if (isHost) {
      return;
    }
    selfLead.textContent = t('lobby.selfNameLead');
    renameButton.textContent = t('lobby.selfRename');
    renameSave.textContent = t('lobby.selfRenameSave');
    readyButton.textContent = t('lobby.ready');
    readyPillText.textContent = t('lobby.playerWaitingForHost');
    readyPillName.textContent = selfName.textContent;
    // Klaar-stand: naamregels weg, wachtpil ervoor in de plaats.
    selfLead.hidden = isReady;
    selfRow.hidden = isReady;
    readyButton.hidden = isReady;
    readyPill.hidden = !isReady;
    renameButton.hidden = isReady || renameUsed || !renameInput.hidden;
  }
  // Mock-review 3 aug (#3): dit is spelers-copy — de host "wacht" niet op
  // zichzelf. Spelers hebben bovendien `playerWaitingForHost` hierboven al,
  // dus deze regel zou daar dubbelen; alleen tonen als playerStatus verborgen
  // is (defensief: zou niet voorkomen, maar dan is er tenminste één wachttekst).
  const waiting = el('p', 'lobby-waiting');
  waiting.hidden = isHost || !playerStatus.hidden;
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
  // BOUWSPRINT: subregel onder de knoplabel, zelfde patroon als home.mjs's
  // quickStartLabel/-Sub — twee spans in één knop i.p.v. een los element,
  // zodat er geen tweede grid-area-toewijzing nodig is voor T5-7's
  // tabletlayout (`.lobby-start` blijft het enige grid-item).
  const startButtonLabel = el('span', 'lobby-start-label');
  const startButtonSub = el('span', 'lobby-start-sub');
  startButton.append(startButtonLabel, startButtonSub);

  // Feedback en link horen bij het deelblok — die stonden eerder los onder de
  // knoppen, waardoor "Gekopieerd!" losgezongen van zijn actie verscheen.
  shareSection.append(shareTitle, shareRow, feedback, linkFallback);
  // T5-7: vanaf tabletbreedte staat de deelsectie náást i.p.v. onder de
  // spelerslijst (`07` §6) — pure groepering, geen herordening: dezelfde drie
  // stukken in dezelfde DOM-volgorde als voorheen (lijst, delen, startknop),
  // nu alleen zodat CSS Grid-areas ze kan plaatsen zonder de leesvolgorde
  // voor toetsenbord/screenreader te wijzigen.
  const mainColumn = el('div', 'lobby-main-column');
  mainColumn.append(title, lockedNotice, playerStatus, waiting, countLine, recentJoinsLabel, list, viewAllButton, emptyState, selfSection);
  // De lobby-warm-up is sinds 3 aug de Rounda-Flag ("Wave Run") van de
  // producteigenaar — spring over de vlaggen, score telt, record blijft
  // lokaal bewaard. De rad-warm-up (rounda.mjs) blijft de vulling voor de
  // kleine wachtmomenten (reconnect/pauze, session-shell.mjs).
  const roundaGameRoot = el('div', 'lobby-rounda');
  const roundaGame = createRoundaFlagView({ root: roundaGameRoot, t });
  mainColumn.append(roundaGameRoot);

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
    startButtonLabel.textContent = t('lobby.start');
    startButtonSub.textContent = t('lobby.startSub');
    linkFallback.setAttribute('aria-label', t('lobby.shareCopy'));
    emptyTitle.textContent = t('lobby.emptyTitle');
    emptyHint.textContent = t('lobby.emptyHint');
    playerJoined.textContent = t('lobby.playerJoined');
    playerWaitingForHost.textContent = t('lobby.playerWaitingForHost');
    playerInviteHint.textContent = t('lobby.playerInviteHint');
    recentJoinsLabel.textContent = t('lobby.recentJoins');
    if (showAllPlayers) {
      viewAllButton.textContent = t('lobby.viewAllHide');
    } else {
      // BOUWSPRINT ("+N meer"): alleen zinvol als er ook daadwerkelijk een
      // aantal is om te tonen — vóór de eerste `update()` (init-aanroep van
      // `renderStatic()`) is `lastModel` nog niet gezet.
      const hiddenCount = lastModel ? Math.max(0, lastModel.playerCount - RECENT_JOINS_COUNT) : 0;
      const moreCount = hiddenCount > 0 ? ` (${t('lobby.moreCount').replace('{n}', String(hiddenCount))})` : '';
      viewAllButton.textContent = `${t('lobby.viewAllShow')}${moreCount}`;
    }
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
      // Scherm 3 (40B): het JIJ-blok is nu de plek voor naam + wachtstand —
      // de oude losse regels hieronder blijven verborgen om dubbeling te
      // voorkomen (playerJoined + inviteHint blijven wél staan).
      playerSelf.hidden = true;
      playerWaitingForHost.hidden = true;
      selfName.textContent = model.selfName ?? '';
      renderSelfSection();
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
        // D-022: naam plus een tijdelijke kleur/symboolidentiteit, berekend uit
        // de playerId (thema 2's `player-chip.mjs`). Zonder dat is dit een
        // lijst namen; mét is het een groepje mensen — `05` §8, en `04` S06
        // vereist die identiteit expliciet in de spelerslobby.
        // Bewust zonder `isSelf`: het model kent hier alleen `selfName`, en
        // namen kunnen dubbel zijn. Wie jij bent staat al in de eigen regel
        // ("Je speelt als …") — een tweede markering op naam zou de verkeerde
        // rij kunnen raken.
        const chip = createPlayerChip({ name, playerId });
        const label = chip.querySelector('.player-chip-name');
        item.appendChild(chip);
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

  return {
    update,
    render: renderStatic,
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
