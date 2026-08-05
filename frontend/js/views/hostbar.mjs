// views/hostbar.mjs — UI5. De hostbalk: pauzeren/hervatten (al bestond,
// hierheen verplaatst), vergrendelen, spelers verwijderen, en — bij
// hostgestuurde pacing — handmatig naar de volgende ronde. Zelfde
// DOM-in/callbacks-uit-patroon als de andere schermmodules: dit bestand kent
// geen transport, `session-shell.mjs` vertaalt elke `onAction` naar een
// `hostActionRequest()`-aanroep.
//
// Zichtbaarheid per knop volgt rechtstreeks uit
// `host-controls-state.availableHostActions()` — geen eigen aanname over
// wanneer wat mag, dat blijft die ene plek.
//
// Bewust met `window.confirm()` voor de twee onomkeerbare acties (beëindigen,
// verwijderen): een native dialoog is toegankelijk zonder eigen werk, en
// past bij hoe weinig chroom de rest van UI1a al heeft.

export function createHostBar({ root, t, onAction }) {
  root.textContent = '';

  // Feedbackronde 4 aug (punt 2): geen woordenbrij meer. Zichtbaar zijn
  // hooguit twee dingen: een pauze-ICOON en (bij host-tempo) "Volgende".
  // Al het andere (vergrendelen, beëindigen, de spelerslijst met verwijderen)
  // zit ingeklapt achter één ⋯-knop.
  const bar = el('div', 'session-hostbar');
  bar.hidden = true;

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.className = 'btn-secondary session-hostbar-pause session-hostbar-icon';
  pauseButton.hidden = true;

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'btn-secondary session-hostbar-next';
  nextButton.hidden = true;
  nextButton.addEventListener('click', () => onAction('next'));

  const moreButton = document.createElement('button');
  moreButton.type = 'button';
  moreButton.className = 'btn-secondary session-hostbar-more session-hostbar-icon';
  moreButton.textContent = '⋯';
  moreButton.hidden = true;
  moreButton.setAttribute('aria-haspopup', 'true');
  moreButton.setAttribute('aria-expanded', 'false');

  const morePanel = el('div', 'session-hostbar-panel');
  morePanel.hidden = true;

  moreButton.addEventListener('click', () => {
    const expanded = moreButton.getAttribute('aria-expanded') === 'true';
    moreButton.setAttribute('aria-expanded', String(!expanded));
    morePanel.hidden = expanded;
  });


  // Destructive, niet secondary: een game beëindigen is onomkeerbaar voor
  // iedereen in de room (05 §4.5 — nooit visueel gelijk aan een gewone actie).
  const finishButton = document.createElement('button');
  finishButton.type = 'button';
  finishButton.className = 'btn-destructive session-hostbar-finish';
  finishButton.hidden = true;
  finishButton.addEventListener('click', () => {
    if (window.confirm(t('hostbar.finishConfirm'))) {
      onAction('finish');
    }
  });

  const playersList = document.createElement('ul');
  playersList.className = 'session-hostbar-players';
  playersList.hidden = true;

  morePanel.append(finishButton, playersList);
  bar.append(pauseButton, nextButton, moreButton, morePanel);
  root.appendChild(bar);

  let pauseAction = null;

  pauseButton.addEventListener('click', () => {
    if (pauseAction !== null) {
      onAction(pauseAction);
    }
  });

  /**
   * @param {{ isHost: boolean, availableActions: string[], participants: Map<string,string>, phase: string }} model
   */
  function update({ isHost, availableActions, participants, phase }) {
    bar.hidden = !isHost;
    if (!isHost) {
      return;
    }

    pauseAction = availableActions.includes('resume') ? 'resume' : availableActions.includes('pause') ? 'pause' : null;
    pauseButton.hidden = pauseAction === null;
    // Punt 2: icoon i.p.v. het woord — de betekenis zit in het aria-label.
    pauseButton.textContent = pauseAction === 'resume' ? '▶' : '⏸';
    pauseButton.setAttribute('aria-label', pauseAction === 'resume' ? t('session.resume') : t('session.pause'));

    nextButton.hidden = !availableActions.includes('next');
    nextButton.textContent = t('hostbar.next');

    finishButton.hidden = !availableActions.includes('finish');
    finishButton.textContent = t('hostbar.finish');

    // S17: tijdens LOBBY toont lobby.mjs's eigen lijst de deelnemers al, mét
    // inline verwijderknoppen — de lijst hier verschijnt pas in de fases
    // daarna (gameplay, scoreboard, podium).
    const canKick = availableActions.includes('kick') && participants.size > 0 && phase !== 'LOBBY';
    playersList.hidden = !canKick;

    // De ⋯-knop bestaat alleen als er iets in het paneel zit; dichtklappen
    // zodra alles eruit verdwijnt.
    const hasMore = !finishButton.hidden || canKick;
    moreButton.hidden = !hasMore;
    moreButton.setAttribute('aria-label', t('hostbar.more'));
    if (!hasMore) {
      morePanel.hidden = true;
      moreButton.setAttribute('aria-expanded', 'false');
    }

    playersList.textContent = '';
    for (const [playerId, name] of participants) {
      // Feedbackronde 2 (punt 5/14): geen kale verwijderknop naast elke naam
      // — een klein ⋯ per rij, verwijderen zit daarachter (met confirm).
      const item = document.createElement('li');
      item.className = 'session-hostbar-player';
      const label = document.createElement('span');
      label.textContent = name;
      const rowMenuButton = document.createElement('button');
      rowMenuButton.type = 'button';
      rowMenuButton.className = 'btn-secondary session-hostbar-player-menu';
      rowMenuButton.textContent = '⋯';
      rowMenuButton.setAttribute('aria-expanded', 'false');
      rowMenuButton.setAttribute('aria-label', `${t('lobby.playerOptions')} ${name}`);
      const kickButton = document.createElement('button');
      kickButton.type = 'button';
      kickButton.className = 'btn-destructive session-hostbar-kick';
      kickButton.textContent = t('hostbar.kick');
      kickButton.hidden = true;
      kickButton.addEventListener('click', () => {
        if (window.confirm(`${t('hostbar.kickConfirmPrefix')} ${name}`)) {
          onAction('kick', { playerId });
        }
      });
      rowMenuButton.addEventListener('click', () => {
        const open = rowMenuButton.getAttribute('aria-expanded') === 'true';
        rowMenuButton.setAttribute('aria-expanded', String(!open));
        kickButton.hidden = open;
      });
      item.append(label, rowMenuButton, kickButton);
      playersList.appendChild(item);
    }
  }

  return {
    update,
    // Voor de pauze-overlay (session-shell.mjs): focus terug naar de knop die
    // pauzeren/hervatten regelt, ná het sluiten van die overlay.
    focusPause() {
      pauseButton.focus();
    },
    // A3 (#7/#8/#46): het ⋯-paneel hierboven is niet langer een eigen
    // zwevend menu — session-shell.mjs hangt het ín het gedeelde
    // voorkeurenmenu, zodat er één ⋯ in de chrome staat in plaats van twee
    // identieke naast elkaar. Wat hier gebouwd wordt verandert daar niet
    // door; alleen wáár het hangt. `menuButton` blijft de bron voor "is er
    // iets te tonen" (`hasMore` hierboven) — de sectie in het menu volgt die.
    menuPanel: morePanel,
    menuButton: moreButton,
  };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
