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

  const bar = el('div', 'session-hostbar');
  bar.hidden = true;

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.className = 'btn-secondary session-hostbar-pause';
  pauseButton.hidden = true;

  const lockButton = document.createElement('button');
  lockButton.type = 'button';
  lockButton.className = 'btn-secondary session-hostbar-lock';
  lockButton.hidden = true;

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'btn-secondary session-hostbar-next';
  nextButton.hidden = true;
  nextButton.addEventListener('click', () => onAction('next'));

  const finishButton = document.createElement('button');
  finishButton.type = 'button';
  finishButton.className = 'btn-secondary session-hostbar-finish';
  finishButton.hidden = true;
  finishButton.addEventListener('click', () => {
    if (window.confirm(t('hostbar.finishConfirm'))) {
      onAction('finish');
    }
  });

  const playersToggle = document.createElement('button');
  playersToggle.type = 'button';
  playersToggle.className = 'btn-secondary session-hostbar-players-toggle';
  playersToggle.hidden = true;
  playersToggle.setAttribute('aria-expanded', 'false');
  const playersList = document.createElement('ul');
  playersList.className = 'session-hostbar-players';
  playersList.hidden = true;

  playersToggle.addEventListener('click', () => {
    const expanded = playersToggle.getAttribute('aria-expanded') === 'true';
    playersToggle.setAttribute('aria-expanded', String(!expanded));
    playersList.hidden = expanded;
  });

  bar.append(pauseButton, lockButton, nextButton, finishButton, playersToggle, playersList);
  root.appendChild(bar);

  let pauseAction = null;
  let lockAction = null;

  pauseButton.addEventListener('click', () => {
    if (pauseAction !== null) {
      onAction(pauseAction);
    }
  });
  lockButton.addEventListener('click', () => {
    if (lockAction !== null) {
      onAction(lockAction);
    }
  });

  /**
   * @param {{ isHost: boolean, availableActions: string[], participants: Map<string,string> }} model
   */
  function update({ isHost, availableActions, participants }) {
    bar.hidden = !isHost;
    if (!isHost) {
      return;
    }

    pauseAction = availableActions.includes('resume') ? 'resume' : availableActions.includes('pause') ? 'pause' : null;
    pauseButton.hidden = pauseAction === null;
    pauseButton.textContent = pauseAction === 'resume' ? t('session.resume') : t('session.pause');

    lockAction = availableActions.includes('unlock') ? 'unlock' : availableActions.includes('lock') ? 'lock' : null;
    lockButton.hidden = lockAction === null;
    lockButton.textContent = lockAction === 'unlock' ? t('hostbar.unlock') : t('hostbar.lock');

    nextButton.hidden = !availableActions.includes('next');
    nextButton.textContent = t('hostbar.next');

    finishButton.hidden = !availableActions.includes('finish');
    finishButton.textContent = t('hostbar.finish');

    const canKick = availableActions.includes('kick') && participants.size > 0;
    playersToggle.hidden = !canKick;
    playersToggle.textContent = t('hostbar.players');
    if (!canKick) {
      playersList.hidden = true;
      playersToggle.setAttribute('aria-expanded', 'false');
    }

    playersList.textContent = '';
    for (const [playerId, name] of participants) {
      const item = document.createElement('li');
      item.className = 'session-hostbar-player';
      const label = document.createElement('span');
      label.textContent = name;
      const kickButton = document.createElement('button');
      kickButton.type = 'button';
      kickButton.className = 'btn-secondary session-hostbar-kick';
      kickButton.textContent = t('hostbar.kick');
      kickButton.setAttribute('aria-label', `${t('hostbar.kick')} ${name}`);
      kickButton.addEventListener('click', () => {
        if (window.confirm(`${t('hostbar.kickConfirmPrefix')} ${name}`)) {
          onAction('kick', { playerId });
        }
      });
      item.append(label, kickButton);
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
  };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
