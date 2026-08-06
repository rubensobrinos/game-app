// views/lobby/spelers.mjs — UI2, uit lobby.mjs gesplitst (docs/openstaand/
// refactor/11-lobby.md). De spelerslijst, het ⋯-menu per speler, verwijderen,
// hernoemen en verkleuren door de host.
//
// `match-phase-state` bewaart bewust geen spelerscount/-lijst
// (GF-HANDOFF-TO-INT-A.md), dus de aanroeper (session-shell.mjs, via
// lobby.mjs) houdt die lokaal bij uit `room:state`'s `room.playerCount`
// (altijd betrouwbaar) en `room:player-changed`'s deltas (namen, alleen
// vanaf het moment van verbinden — zie HANDOFF-UI voor de reden).
//
// Geen eigen root/mount: `countLine`/`recentJoinsLabel`/`list`/
// `viewAllButton`/`emptyState` zijn DIRECTE kinderen van `.lobby-main-column`
// (CSS-gap-ritme, `lobby.css`) — de aanroeper (lobby.mjs) plakt ze op hun
// plek, deze module wrapt ze niet in nog een element.

import { participantPresentationFor } from '../participant-presentation.mjs';
import { createPlayerChip, SERVER_KLEUREN } from '../../player-chip.mjs';
import { identityText, identityFlagUrl } from '../identity-display.mjs';

// T5-9: hoeveel van de meest recente joins zichtbaar blijven in de
// samengevouwen 'aggregate'-weergave (36+ spelers) vóórdat "Bekijk alle
// spelers" wordt gebruikt.
const RECENT_JOINS_COUNT = 5;

export function createSpelersView({ t, tCount, isHost, onKickPlayer, onHostRenamePlayer, onHostRecolorPlayer }) {
  // C0 (punt 10): "1 SPELER" stond als eigen regel mét ruimte erboven én
  // eronder boven de lijst die datzelfde aantal al toont — dubbele informatie
  // voor ~40px op het smalste scherm. De regel verdwijnt visueel, maar niet
  // uit de toegankelijkheidsboom: wie de lijst niet ziet, hoort het aantal
  // hier, en `aria-live` meldt voortaan iedere join — dat is precies wat de
  // (nu onzichtbare) puls hieronder visueel deed.
  const countLine = document.createElement('p');
  countLine.className = 'lobby-count sr-only';
  countLine.setAttribute('aria-live', 'polite');
  const list = document.createElement('ul');
  list.className = 'lobby-players';
  // T5-9: 36+ spelers toont alleen de recente joins + dit totaal; de
  // volledige lijst blijft opvraagbaar (07 §9 verbiedt een permanente
  // namenmuur, niet dat de data ooit zichtbaar mag worden).
  const recentJoinsLabel = document.createElement('p');
  recentJoinsLabel.className = 'lobby-recent-joins-label';
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
  const emptyState = document.createElement('div');
  emptyState.className = 'lobby-empty';
  emptyState.hidden = true;
  const emptyTitle = document.createElement('p');
  emptyTitle.className = 'lobby-empty-title';
  const emptyHint = document.createElement('p');
  emptyHint.className = 'lobby-empty-hint';
  emptyState.append(emptyTitle, emptyHint);

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

  function render() {
    recentJoinsLabel.textContent = t('lobby.recentJoins');
    if (showAllPlayers) {
      viewAllButton.textContent = t('lobby.viewAllHide');
    } else {
      // BOUWSPRINT ("+N meer"): alleen zinvol als er ook daadwerkelijk een
      // aantal is om te tonen — vóór de eerste `update()` is `lastModel` nog
      // niet gezet.
      const hiddenCount = lastModel ? Math.max(0, lastModel.playerCount - RECENT_JOINS_COUNT) : 0;
      const moreCount = hiddenCount > 0 ? ` (${t('lobby.moreCount').replace('{n}', String(hiddenCount))})` : '';
      viewAllButton.textContent = `${t('lobby.viewAllShow')}${moreCount}`;
    }
    emptyTitle.textContent = t('lobby.emptyTitle');
    emptyHint.textContent = t('lobby.emptyHint');
  }

  render();

  /** @param {{ playerCount: number, participants: Map<string,string>, canKick?: boolean, participantColors?: Map<string,string>, participantIdentities?: Map<string,{country:string,word:string}|null>, lang?: string }} model */
  function update(model) {
    lastModel = model;
    render();

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

    if (empty) {
      return;
    }

    // `tCount` en niet `${n} ${t(...)}`: dat laatste gaf "1 spelers". De
    // tekst zelf is altijd meteen up-to-date — alleen de puls (decoratief)
    // is hieronder gedebouncet, niet de data.
    countLine.textContent = tCount('lobby.playerCount', model.playerCount);
    if (lastPulsedCount === null) {
      lastPulsedCount = model.playerCount;
    } else if (model.playerCount !== lastPulsedCount) {
      // C0: sinds de teller `sr-only` is, is deze puls visueel inert; hij
      // blijft staan omdat de debounce-regel (M7/E03) bij een zichtbare
      // teller weer nodig is, en `aria-live` intussen dezelfde
      // wijziging hoorbaar maakt.
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
      // spelersidentiteit.md, stap 5: `identity` (paar) wint van de kale
      // naam, gerenderd in de eigen apptaal — `null` (zelfgekozen naam, of
      // een speler van vóór stap 6) valt terug op `name`.
      const identity = model.participantIdentities?.get(playerId) ?? null;
      const displayName = identityText(identity, model.lang ?? 'nl') ?? name;
      const flagSrc = identityFlagUrl(identity);
      const existing = renderedRows.get(playerId);
      if (existing !== undefined && existing.hasFlag === (flagSrc !== null)) {
        // Rename-delta: naam (en kickknop-label) bijwerken zonder de rij
        // opnieuw te animeren.
        existing.label.textContent = displayName;
        existing.kickButton?.setAttribute('aria-label', `${t('hostbar.kick')} ${displayName}`);
        continue;
      }
      if (existing !== undefined) {
        // player:rename wist een eerder toegekende identiteit altijd (nooit
        // andersom, zie de toelichting bij `finalizeIdentity` in het
        // servercompositie- en mockpad) — de rij heeft dan een vlag-DOM-node
        // die niet meer klopt. Dat gebeurt hooguit één keer per speler, dus
        // eenvoudiger om de rij opnieuw op te bouwen dan losse insert/remove-
        // logica voor een overgang die maar één kant op gaat.
        existing.item.remove();
        renderedRows.delete(playerId);
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
      const chip = createPlayerChip({
        name: displayName,
        playerId,
        color: model.participantColors?.get(playerId) ?? null,
        flagUrl: flagSrc,
      });
      const label = chip.querySelector('.player-chip-name');
      item.appendChild(chip);
      let kickButton;
      // Feedbackronde 2 (punt 5): NOOIT een kale verwijderknop in de rij —
      // een klein ⋯-menu per speler. docs/openstaand/host-wijzigt-naam-en-
      // kleur.md dicht het "vergt serverwerk"-ticket hieronder: hernoemen
      // en herkleuren van een ándere speler kunnen nu ook, naast Verwijderen
      // — alle drie alleen zichtbaar zolang dit scherm draait, en dat is
      // per constructie alleen tijdens LOBBY (session-shell.mjs mount deze
      // view nergens anders), dus geen aparte fasecheck hier nodig.
      if (isHost && model.canKick) {
        const rowMenuButton = document.createElement('button');
        rowMenuButton.type = 'button';
        rowMenuButton.className = 'btn-secondary lobby-player-menu';
        rowMenuButton.textContent = '⋯';
        rowMenuButton.setAttribute('aria-haspopup', 'true');
        rowMenuButton.setAttribute('aria-expanded', 'false');
        rowMenuButton.setAttribute('aria-label', `${t('lobby.playerOptions')} ${name}`);
        const rowMenu = document.createElement('div');
        rowMenu.className = 'lobby-player-menu-panel';
        rowMenu.hidden = true;

        const renameButtonRow = document.createElement('button');
        renameButtonRow.type = 'button';
        renameButtonRow.className = 'btn-secondary lobby-player-rename';
        renameButtonRow.textContent = t('hostbar.renamePlayer');
        const renameInputRow = document.createElement('input');
        renameInputRow.type = 'text';
        renameInputRow.className = 'field-input lobby-player-rename-input';
        renameInputRow.maxLength = 60;
        renameInputRow.hidden = true;
        renameInputRow.setAttribute('aria-label', `${t('hostbar.renamePlayer')} ${name}`);
        const renameSaveRow = document.createElement('button');
        renameSaveRow.type = 'button';
        renameSaveRow.className = 'btn-secondary lobby-player-rename-save';
        renameSaveRow.textContent = t('lobby.selfRenameSave');
        renameSaveRow.hidden = true;
        const closeRename = () => {
          renameInputRow.hidden = true;
          renameSaveRow.hidden = true;
          renameButtonRow.hidden = false;
        };
        renameButtonRow.addEventListener('click', () => {
          renameButtonRow.hidden = true;
          renameInputRow.hidden = false;
          renameSaveRow.hidden = false;
          renameInputRow.value = name;
          renameInputRow.focus();
          renameInputRow.select?.();
        });
        renameInputRow.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') renameSaveRow.click();
          if (event.key === 'Escape') closeRename();
        });
        renameSaveRow.addEventListener('click', async () => {
          const value = renameInputRow.value.trim();
          closeRename();
          if (value === '' || value === name) return;
          try {
            await onHostRenamePlayer?.(playerId, value);
          } catch {
            // serverstand blijft de waarheid; de volgende update() toont 'm
          }
        });

        const recolorButtonRow = document.createElement('button');
        recolorButtonRow.type = 'button';
        recolorButtonRow.className = 'btn-secondary lobby-player-recolor';
        recolorButtonRow.textContent = t('hostbar.recolorPlayer');
        recolorButtonRow.setAttribute('aria-expanded', 'false');
        const recolorColorsRow = document.createElement('div');
        recolorColorsRow.className = 'lobby-player-colors';
        recolorColorsRow.setAttribute('role', 'group');
        recolorColorsRow.hidden = true;
        for (const [colorName, hex] of Object.entries(SERVER_KLEUREN)) {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'lobby-player-color';
          dot.style.backgroundColor = hex;
          dot.setAttribute('aria-label', colorName);
          dot.addEventListener('click', async () => {
            recolorColorsRow.hidden = true;
            recolorButtonRow.setAttribute('aria-expanded', 'false');
            try {
              await onHostRecolorPlayer?.(playerId, colorName);
            } catch {
              // idem: geen eigen foutkanaal, serverstand corrigeert zichtbaar
            }
          });
          recolorColorsRow.appendChild(dot);
        }
        recolorButtonRow.addEventListener('click', () => {
          const open = recolorButtonRow.getAttribute('aria-expanded') === 'true';
          recolorButtonRow.setAttribute('aria-expanded', String(!open));
          recolorColorsRow.hidden = open;
        });

        kickButton = document.createElement('button');
        kickButton.type = 'button';
        kickButton.className = 'btn-destructive lobby-player-kick';
        kickButton.textContent = t('hostbar.kick');
        kickButton.addEventListener('click', () => {
          if (window.confirm(`${t('hostbar.kickConfirmPrefix')} ${name}`)) {
            onKickPlayer(playerId);
          }
        });
        rowMenu.append(renameButtonRow, renameInputRow, renameSaveRow, recolorButtonRow, recolorColorsRow, kickButton);
        rowMenuButton.addEventListener('click', () => {
          const open = rowMenuButton.getAttribute('aria-expanded') === 'true';
          rowMenuButton.setAttribute('aria-expanded', String(!open));
          rowMenu.hidden = open;
          if (open) {
            closeRename();
            recolorColorsRow.hidden = true;
            recolorButtonRow.setAttribute('aria-expanded', 'false');
          }
        });
        item.append(rowMenuButton, rowMenu);
      }
      list.appendChild(item);
      renderedRows.set(playerId, { item, label, kickButton, hasFlag: flagSrc !== null });
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

  return { countLine, recentJoinsLabel, list, viewAllButton, emptyState, update, render };
}
