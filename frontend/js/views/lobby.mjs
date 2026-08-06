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

import { GAME_CATALOG, isPlayableGameType } from '../../../shared/content/game-catalog.mjs';
import { shareActionsFor, shareUrlsFor } from '../../../client/flow/share-actions.mjs';
import { participantPresentationFor } from './participant-presentation.mjs';
import { createPlayerChip, SERVER_KLEUREN } from '../player-chip.mjs';
import { createRoundaFlagView } from './rounda-flag.mjs';

// T5-9: hoeveel van de meest recente joins zichtbaar blijven in de
// samengevouwen 'aggregate'-weergave (36+ spelers) vóórdat "Bekijk alle
// spelers" wordt gebruikt.
const RECENT_JOINS_COUNT = 5;

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
  // Zichtbaar voor iedereen MET een spelersrol (ook de meespelende host,
  // feedback 4 aug); update() zet dit op basis van selfIsPlayer.
  selfSection.hidden = true;
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
  // C2 (punten 19/20/21, R2-6): het kleurvlakje ís de knop. De acht kleuren
  // stonden altijd uitgeklapt onder je naam — twee rijen, ~96px, voor een
  // keuze die je één keer maakt. Nu zit de kleur naast de naam in dezelfde
  // rij en verschijnt het palet pas na een tik erop.
  //
  // Bewust de interactie en niet een groter palet: de server kent precies
  // acht kleuren (gesloten enum, `client-events-dispatch.mjs`), dus 36 is
  // protocolwerk. Als dat er komt, groeit alléén `SERVER_KLEUREN` — de
  // opening, het sluiten en de toegankelijkheid staan hier al.
  const selfSwatch = document.createElement('button');
  selfSwatch.type = 'button';
  selfSwatch.className = 'lobby-self-swatch';
  selfSwatch.setAttribute('aria-expanded', 'false');
  let colorsOpen = false;
  selfSwatch.addEventListener('click', () => {
    colorsOpen = !colorsOpen;
    renderSelfSection();
  });
  selfRow.append(selfSwatch, selfName, renameButton, renameInput, renameSave);
  // Feedback punt 13: kleurkiezer — acht tikbare stippen, serverpalet.
  const colorRow = el('div', 'lobby-self-colors');
  colorRow.setAttribute('role', 'group');
  colorRow.hidden = true;
  const colorButtons = new Map();
  for (const [colorName, hex] of Object.entries(SERVER_KLEUREN)) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'lobby-self-color';
    dot.style.backgroundColor = hex;
    dot.addEventListener('click', async () => {
      // Meteen dicht: gekozen is gekozen, en het palet mag de rest van de
      // lobby niet blijven wegduwen. De stand komt van de server terug.
      colorsOpen = false;
      renderSelfSection();
      try {
        await onRecolor?.(colorName);
      } catch {
        // kleurwissel is nice-to-have: fout stil laten, stand blijft server-waarheid
      }
    });
    colorButtons.set(colorName, dot);
    colorRow.appendChild(dot);
  }
  // ── SCHERM 2 (besluit 40): host-instellingen ÍN de lobby — in/uitklapbaar,
  // aangesloten op game:update-config. Mix/Typen en de game-carrousel staan
  // zichtbaar maar uitgeschakeld tot de features bestaan (besluit 40D). ──
  const settingsSection = el('section', 'lobby-settings');
  settingsSection.hidden = !isHost;
  const settingsHeader = document.createElement('button');
  settingsHeader.type = 'button';
  settingsHeader.className = 'lobby-settings-header';
  settingsHeader.setAttribute('aria-expanded', 'true');
  const settingsHeaderLabel = el('span', 'lobby-settings-title');
  const settingsHeaderChevron = el('span', 'lobby-settings-chevron');
  settingsHeaderChevron.textContent = '⌃';
  settingsHeader.append(settingsHeaderLabel, settingsHeaderChevron);
  const settingsBody = el('div', 'lobby-settings-body');
  settingsHeader.addEventListener('click', () => {
    const open = settingsHeader.getAttribute('aria-expanded') === 'true';
    settingsHeader.setAttribute('aria-expanded', String(!open));
    settingsBody.hidden = open;
    settingsHeaderChevron.textContent = open ? '⌄' : '⌃';
  });

  function settingsLabel(className) {
    return el('p', `lobby-settings-label ${className}`);
  }
  function segGroup() {
    const group = el('div', 'lobby-seg');
    return group;
  }
  function segButton(group, { onPick = null, disabled = false } = {}) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lobby-seg-option';
    if (disabled) {
      btn.disabled = true;
      btn.classList.add('is-soon');
    } else if (onPick !== null) {
      btn.addEventListener('click', onPick);
    }
    group.appendChild(btn);
    return btn;
  }
  async function pushConfig(patch) {
    try {
      await onConfigChange?.(patch);
    } catch {
      // room:config-changed blijft uit → de volgende update() zet de knoppen
      // gewoon terug naar de serverstand; geen eigen foutkanaal nodig.
    }
  }

  // Punt 6+7 (feedbackronde 2): geen "GAME"-label, wél de vier wereldgames
  // als draaibare carrousel (DOELBEELD §1). Wat speelbaar is, bepaalt dit
  // scherm NIET zelf (5 aug, PLAN-CONVERGENTIE §A0): op 4 aug zette deze
  // lijst `real_or_fake_flag` op speelbaar terwijl de contentbron hem niet kon
  // bouwen — starten liet de room stil in COUNTDOWN staan. `game-catalog.mjs`
  // is nu de enige bron, gedeeld met de protocolvalidatie. Draaien naar een
  // speelbare game stuurt game:update-config; de serverstand (config.gameTypes)
  // blijft de waarheid.
  const GAMES = GAME_CATALOG.map((game) => ({
    key: game.key,
    gameType: game.gameType,
    speelbaar: isPlayableGameType(game.gameType),
  }));
  let gameIndex = 0;
  /** De laatst van de server ontvangen gameType — zie update(). */
  let renderedServerGameType = null;
  const gameRow = el('div', 'lobby-gamerow');
  const gamePrev = document.createElement('button');
  gamePrev.type = 'button';
  gamePrev.className = 'lobby-gamearrow';
  gamePrev.textContent = '‹';
  const gameNext = document.createElement('button');
  gameNext.type = 'button';
  gameNext.className = 'lobby-gamearrow';
  gameNext.textContent = '›';
  const gameCard = el('div', 'lobby-gamecard');
  const gameCardTitle = el('b', 'lobby-gamecard-title');
  gameCard.appendChild(gameCardTitle);
  gameRow.append(gamePrev, gameCard, gameNext);
  const gameCardSub = el('div', 'lobby-gamecard-sub');
  const gameCardDesc = el('span', 'lobby-gamecard-desc');
  const gameCardSoon = el('span', 'lobby-gamecard-soon');
  gameCardSub.append(gameCardDesc, gameCardSoon);
  function renderGameCard() {
    const game = GAMES[gameIndex];
    gameCardTitle.textContent = t(`lobby.game_${game.key}`);
    gameCardDesc.textContent = t(`lobby.game_${game.key}_desc`);
    gameCard.classList.toggle('is-soon', !game.speelbaar);
    gameCardSoon.textContent = game.speelbaar ? '' : t('lobby.gameSoonStart');
  }
  function turnGame(step) {
    gameIndex = (gameIndex + step + GAMES.length) % GAMES.length;
    renderGameCard();
    const game = GAMES[gameIndex];
    if (game.speelbaar && game.gameType !== null) {
      pushConfig({ gameTypes: [game.gameType] });
    }
  }
  gamePrev.addEventListener('click', () => turnGame(-1));
  gameNext.addEventListener('click', () => turnGame(1));

  // Punt 23: met de duim over de kaart vegen draait dezelfde carrousel als de
  // pijlen. Pointer-events en geen `scroll-snap`-strip: de kaart toont bewust
  // één game — de serverstand is de waarheid (§A5) — en een strip zou vier
  // kaarten tonen waarvan er drie niet gekozen zijn. `touch-action: pan-y`
  // (CSS) laat verticaal scrollen ongemoeid.
  const VEEG_DREMPEL = 40; // px; hieronder is het een tik, geen veeg
  let veegStartX = null;
  gameCard.addEventListener('pointerdown', (event) => {
    veegStartX = typeof event?.clientX === 'number' ? event.clientX : null;
  });
  gameCard.addEventListener('pointerup', (event) => {
    if (veegStartX === null) return;
    const verschil = (typeof event?.clientX === 'number' ? event.clientX : veegStartX) - veegStartX;
    veegStartX = null;
    if (Math.abs(verschil) < VEEG_DREMPEL) return;
    // Naar links vegen brengt de vólgende kaart in beeld, zoals elke carrousel.
    turnGame(verschil < 0 ? 1 : -1);
  });
  gameCard.addEventListener('pointercancel', () => { veegStartX = null; });

  // ANTWOORDEN: Kiezen actief; Mix/Typen disabled (40D)
  const answersLabel = settingsLabel('lobby-settings-answers-label');
  const answersGroup = segGroup();
  // Punt 25 (5 aug): "Kiezen" was een klasse zonder handler — je kon erop
  // tikken en er gebeurde niets, wat het hele rijtje dood liet voelen. Er is
  // vandaag maar één antwoordvorm, dus de klik bevestigt alleen; zodra Mix en
  // Typen bestaan (besluit 40D) hangt hier dezelfde `pushConfig` als bij de
  // andere instellingen.
  const answersChoose = segButton(answersGroup, { onPick: () => bevestigAntwoordvorm() });
  answersChoose.classList.add('is-active');
  answersChoose.setAttribute('aria-pressed', 'true');
  const answersMix = segButton(answersGroup, { disabled: true });
  const answersType = segButton(answersGroup, { disabled: true });

  // NIVEAU → difficulty (Easy→easy, Medium→normal, Hard→hard)
  const levelLabel = settingsLabel('lobby-settings-level-label');
  const levelGroup = segGroup();
  const levelButtons = new Map();
  for (const [key, difficulty] of [['easy', 'easy'], ['medium', 'normal'], ['hard', 'hard']]) {
    levelButtons.set(difficulty, segButton(levelGroup, { onPick: () => pushConfig({ difficulty }) }));
    levelButtons.get(difficulty).dataset.levelKey = key;
  }

  // VRAGEN → totalRounds
  const questionsLabel = settingsLabel('lobby-settings-questions-label');
  const questionsGroup = segGroup();
  const questionButtons = new Map();
  for (const n of [5, 10, 15]) {
    const btn = segButton(questionsGroup, { onPick: () => pushConfig({ totalRounds: n }) });
    btn.textContent = String(n);
    questionButtons.set(n, btn);
  }

  // Toggle: automatisch volgende vraag (aan = pacing auto, uit = host)
  const autoNextRow = el('div', 'lobby-toggle-row');
  const autoNextLabel = el('span', 'lobby-toggle-label');
  const autoNextToggle = document.createElement('button');
  autoNextToggle.type = 'button';
  autoNextToggle.className = 'lobby-toggle';
  autoNextToggle.setAttribute('role', 'switch');
  const autoNextKnob = el('i', '');
  autoNextToggle.appendChild(autoNextKnob);
  let currentPacing = 'auto';
  autoNextToggle.addEventListener('click', () => {
    pushConfig({ pacing: currentPacing === 'auto' ? 'host' : 'auto' });
  });
  autoNextRow.append(autoNextLabel, autoNextToggle);

  // Toggle: antwoord automatisch tonen (besluit 51, fase 4). Stond hier tot
  // 6 aug 2026 als BINNENKORT-rij zonder besturingselement; het veld en de
  // hostactie (`game:reveal`) bestaan nu, dus gewone toggle — zelfde vorm als
  // "Automatisch volgende vraag" hierboven.
  const autoRevealRow = el('div', 'lobby-toggle-row');
  const autoRevealLabel = el('span', 'lobby-toggle-label');
  const autoRevealToggle = document.createElement('button');
  autoRevealToggle.type = 'button';
  autoRevealToggle.className = 'lobby-toggle';
  autoRevealToggle.setAttribute('role', 'switch');
  const autoRevealKnob = el('i', '');
  autoRevealToggle.appendChild(autoRevealKnob);
  let currentAutoReveal = true;
  autoRevealToggle.addEventListener('click', () => {
    pushConfig({ autoReveal: !currentAutoReveal });
  });
  autoRevealRow.append(autoRevealLabel, autoRevealToggle);

  const moreToggle = document.createElement('button');
  moreToggle.type = 'button';
  moreToggle.className = 'btn-quiet lobby-settings-more';
  moreToggle.setAttribute('aria-expanded', 'false');
  const moreBody = el('div', 'lobby-settings-morebody');
  moreBody.hidden = true;
  moreToggle.addEventListener('click', () => {
    const open = moreToggle.getAttribute('aria-expanded') === 'true';
    moreToggle.setAttribute('aria-expanded', String(!open));
    moreBody.hidden = open;
  });

  // Vraagtaal (in Meer instellingen)
  const qLangLabel = settingsLabel('lobby-settings-qlang-label');
  const qLangGroup = segGroup();
  const qLangButtons = new Map();
  for (const lang of ['nl', 'en', 'es']) {
    const btn = segButton(qLangGroup, { onPick: () => pushConfig({ language: lang }) });
    btn.textContent = lang.toUpperCase();
    qLangButtons.set(lang, btn);
  }
  // Snelheidsbonus + late join (in Meer instellingen)
  const bonusRow = el('div', 'lobby-toggle-row');
  const bonusLabel = el('span', 'lobby-toggle-label');
  const bonusToggle = document.createElement('button');
  bonusToggle.type = 'button';
  bonusToggle.className = 'lobby-toggle';
  bonusToggle.setAttribute('role', 'switch');
  bonusToggle.appendChild(el('i', ''));
  let currentBonus = true;
  bonusToggle.addEventListener('click', () => pushConfig({ speedBonus: !currentBonus }));
  bonusRow.append(bonusLabel, bonusToggle);
  const lateRow = el('div', 'lobby-toggle-row');
  const lateLabel = el('span', 'lobby-toggle-label');
  const lateToggle = document.createElement('button');
  lateToggle.type = 'button';
  lateToggle.className = 'lobby-toggle';
  lateToggle.setAttribute('role', 'switch');
  lateToggle.appendChild(el('i', ''));
  let currentLate = true;
  lateToggle.addEventListener('click', () => pushConfig({ allowLateJoin: !currentLate }));
  lateRow.append(lateLabel, lateToggle);
  moreBody.append(questionsLabel, questionsGroup, qLangLabel, qLangGroup, bonusRow, lateRow);

  settingsBody.append(
    gameRow, gameCardSub,
    answersLabel, answersGroup,
    levelLabel, levelGroup,
    autoNextRow, autoRevealRow,
    moreToggle, moreBody,
  );
  settingsSection.append(settingsHeader, settingsBody);

  const readyButton = document.createElement('button');
  readyButton.type = 'button';
  readyButton.className = 'btn-primary lobby-ready';
  const readyPill = el('div', 'lobby-ready-pill');
  readyPill.hidden = true;
  const readyPillDot = el('span', 'lobby-ready-dot');
  const readyPillText = el('span', 'lobby-ready-text');
  const readyPillName = el('span', 'lobby-ready-name');
  readyPill.append(readyPillDot, readyPillText, readyPillName);
  selfSection.append(selfLead, selfRow, colorRow, renameError, readyButton, readyPill);

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

  let selfIsPlayer = false;

  function renderSelfSection() {
    selfSection.hidden = !selfIsPlayer;
    if (!selfIsPlayer) {
      return;
    }
    selfLead.textContent = t('lobby.selfNameLead');
    colorRow.setAttribute('aria-label', t('lobby.colorLabel'));
    // Het vlakje draagt zijn eigen label: zonder tekst erin is "kleur kiezen"
    // het enige wat een screenreader hier kan aankondigen.
    selfSwatch.setAttribute('aria-label', t('lobby.colorLabel'));
    selfSwatch.setAttribute('aria-expanded', String(colorsOpen));
    for (const [colorName, dot] of colorButtons) {
      dot.setAttribute('aria-label', `${t('lobby.colorLabel')}: ${colorName}`);
    }
    renameButton.textContent = t('lobby.selfRename');
    renameSave.textContent = t('lobby.selfRenameSave');
    readyButton.textContent = t('lobby.ready');
    readyPillText.textContent = t('lobby.playerWaitingForHost');
    readyPillName.textContent = selfName.textContent;
    // Klaar-stand: naamregels weg, wachtpil ervoor in de plaats. De host
    // wacht niet op zichzelf: geen klaar-knop en geen wachtpil (die start).
    selfLead.hidden = isReady;
    selfRow.hidden = isReady;
    colorRow.hidden = isReady || !colorsOpen;
    readyButton.hidden = isHost || isReady;
    readyPill.hidden = isHost || !isReady;
    renameButton.hidden = isReady || renameUsed || !renameInput.hidden;
  }
  // Mock-review 3 aug (#3): dit is spelers-copy — de host "wacht" niet op
  // zichzelf. Spelers hebben bovendien `playerWaitingForHost` hierboven al,
  // dus deze regel zou daar dubbelen; alleen tonen als playerStatus verborgen
  // is (defensief: zou niet voorkomen, maar dan is er tenminste één wachttekst).
  const waiting = el('p', 'lobby-waiting');
  waiting.hidden = isHost || !playerStatus.hidden;
  // C0 (punt 10): "1 SPELER" stond als eigen regel mét ruimte erboven én
  // eronder boven de lijst die datzelfde aantal al toont — dubbele informatie
  // voor ~40px op het smalste scherm. De regel verdwijnt visueel, maar niet
  // uit de toegankelijkheidsboom: wie de lijst niet ziet, hoort het aantal
  // hier, en `aria-live` meldt voortaan iedere join — dat is precies wat de
  // (nu onzichtbare) puls hieronder visueel deed.
  const countLine = el('p', 'lobby-count sr-only');
  countLine.setAttribute('aria-live', 'polite');
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
  mainColumn.append(title, lockedNotice, playerStatus, waiting, countLine, recentJoinsLabel, list, viewAllButton, emptyState, selfSection, settingsSection);
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
    settingsHeaderLabel.textContent = t('lobby.settings');
    renderGameCard();
    gamePrev.setAttribute('aria-label', t('lobby.gameTurn'));
    gameNext.setAttribute('aria-label', t('lobby.gameTurn'));
    autoRevealLabel.textContent = t('lobby.autoReveal');
    moreToggle.textContent = t('lobby.moreSettings');
    qLangLabel.textContent = t('lobby.questionLanguage');
    bonusLabel.textContent = t('lobby.speedBonus');
    lateLabel.textContent = t('lobby.lateJoin');
    answersLabel.textContent = t('lobby.answers');
    answersChoose.textContent = t('lobby.answersChoose');
    // Een `title` is op een telefoon onzichtbaar: de speler zag drie dode
    // knoppen zonder reden. Het label staat nu ín de knop, zoals bij
    // "Antwoord automatisch tonen".
    zetSoonLabel(answersMix, t('lobby.answersMix'), t('lobby.soon'));
    zetSoonLabel(answersType, t('lobby.answersType'), t('lobby.soon'));
    levelLabel.textContent = t('lobby.level');
    for (const [difficulty, btn] of levelButtons) {
      btn.textContent = t(`lobby.level_${btn.dataset.levelKey}`);
    }
    questionsLabel.textContent = t('lobby.questions');
    autoNextLabel.textContent = t('lobby.autoNext');
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

    // Scherm 3 (40B) + feedback 4 aug: het JIJ-blok is de plek voor naam,
    // kleur en wachtstand — voor iedereen mét spelersrol, ook de meespelende
    // host. De oude losse regels blijven verborgen (dubbeling).
    playerSelf.hidden = true;
    playerWaitingForHost.hidden = true;
    selfIsPlayer = model.selfIsPlayer === true;
    selfName.textContent = model.selfName ?? '';
    const selfHex = model.selfColor && model.selfColor in SERVER_KLEUREN ? SERVER_KLEUREN[model.selfColor] : null;
    selfSwatch.style.backgroundColor = selfHex ?? 'transparent';
    // Blijft staan zonder kleur: het vlakje is sinds C2 de enige ingang naar
    // het palet, dus wegstoppen zou juist de mensen zonder kleur buitensluiten.
    selfSwatch.classList.toggle('is-leeg', selfHex === null);
    for (const [colorName, dot] of colorButtons) {
      dot.classList.toggle('is-active', colorName === model.selfColor);
    }
    renderSelfSection();

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
        const chip = createPlayerChip({ name, playerId, color: model.participantColors?.get(playerId) ?? null });
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
          const rowMenu = el('div', 'lobby-player-menu-panel');
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
          const recolorColorsRow = el('div', 'lobby-player-colors');
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
      // Scherm 2: de serverconfig is de waarheid voor de instelknoppen.
      const config = model.config ?? {};
      // De serverstand is de waarheid, maar mag de host niet uit een
      // BINNENKORT-kaart wegtrekken bij élke update() (die draait ook als er
      // gewoon iemand binnenkomt). Daarom alleen bijsturen als de SERVER iets
      // anders zegt dan de vorige keer — dan is er echt een keuze gewijzigd,
      // hier of op een ander apparaat.
      const serverGameType = Array.isArray(config.gameTypes) ? config.gameTypes[0] : null;
      if (serverGameType !== null && serverGameType !== renderedServerGameType) {
        renderedServerGameType = serverGameType;
        const idx = GAMES.findIndex((game) => game.gameType === serverGameType);
        if (idx >= 0 && idx !== gameIndex) {
          gameIndex = idx;
          renderGameCard();
        }
      }
      for (const [difficulty, btn] of levelButtons) {
        btn.classList.toggle('is-active', config.difficulty === difficulty);
      }
      for (const [n, btn] of questionButtons) {
        btn.classList.toggle('is-active', config.totalRounds === n);
      }
      currentPacing = config.pacing === 'host' ? 'host' : 'auto';
      autoNextToggle.classList.toggle('is-on', currentPacing === 'auto');
      autoNextToggle.setAttribute('aria-checked', String(currentPacing === 'auto'));
      autoNextToggle.setAttribute('aria-label', t('lobby.autoNext'));
      currentAutoReveal = config.autoReveal !== false;
      autoRevealToggle.classList.toggle('is-on', currentAutoReveal);
      autoRevealToggle.setAttribute('aria-checked', String(currentAutoReveal));
      autoRevealToggle.setAttribute('aria-label', t('lobby.autoReveal'));
      for (const [lang, btn] of qLangButtons) {
        btn.classList.toggle('is-active', config.language === lang);
      }
      currentBonus = config.speedBonus !== false;
      bonusToggle.classList.toggle('is-on', currentBonus);
      bonusToggle.setAttribute('aria-checked', String(currentBonus));
      bonusToggle.setAttribute('aria-label', t('lobby.speedBonus'));
      currentLate = config.allowLateJoin !== false;
      lateToggle.classList.toggle('is-on', currentLate);
      lateToggle.setAttribute('aria-checked', String(currentLate));
      lateToggle.setAttribute('aria-label', t('lobby.lateJoin'));
    }
  }

  /**
   * Punt 25: de enige antwoordvorm die vandaag bestaat is "Kiezen", dus er is
   * niets te wisselen. Wat er wél moet gebeuren is bevestigen dat de tik is
   * aangekomen — anders voelt de knop kapot.
   */
  function bevestigAntwoordvorm() {
    answersChoose.classList.remove('is-tik');
    void answersChoose.offsetWidth;
    answersChoose.classList.add('is-tik');
  }

  /** Knoplabel + een klein, zichtbaar BINNENKORT eronder. */
  function zetSoonLabel(knop, label, soon) {
    knop.textContent = '';
    const tekst = document.createElement('span');
    tekst.textContent = label;
    const badge = el('span', 'lobby-seg-soon');
    badge.textContent = soon;
    knop.append(tekst, badge);
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
