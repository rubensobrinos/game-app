// views/hostbar.mjs — UI5. De hostbediening: pauzeren/hervatten en (bij
// hostgestuurde pacing) "Volgende" in de chromerij, al het andere in het
// ⋯-menu. Zelfde DOM-in/callbacks-uit-patroon als de andere schermmodules:
// dit bestand kent geen transport, `session-shell.mjs` vertaalt elke
// `onAction` naar een `hostActionRequest()`-aanroep.
//
// Zichtbaarheid per knop volgt rechtstreeks uit
// `host-controls-state.availableHostActions()` — geen eigen aanname over
// wanneer wat mag, dat blijft die ene plek.
//
// ── D3 (5 aug 2026): de volgorde in het menu is een veiligheidsmaatregel ──
//
// Besluit producteigenaar, letterlijk: "Beëindigen moet in de
// hostinstellingen verstopt zijn. Als je verkeerd klikt moet je weer opnieuw
// beginnen." Tot D3 was "Game beëindigen" het BOVENSTE en meest opvallende
// wat een host zag als hij het menu opende — rood omkaderd, volle breedte,
// één tik van een onomkeerbare actie af (gemeten: paneel 415 px hoog, finish
// als eerste knop). Dat is de omgekeerde hiërarchie.
//
// Nu, van boven naar beneden:
//   1. Room vergrendelen/ontgrendelen — omkeerbaar, dus bovenaan.
//   2. Spelers beheren — ingeklapt; verwijderen zit twee tikken diep.
//   3. Meer instellingen — ingeklapt; game beëindigen zit dáár in, als
//      stille regel, met een bevestiging die het aantal spelers noemt.
//
// Beide destructieve acties gebruiken dezelfde tweetrapsvorm ín het paneel,
// niet `window.confirm()`. Drie redenen, in volgorde van gewicht:
//   - een native dialoog is het meest dominante element dat een pagina kan
//     tonen; punt 49 vraagt juist om het tegenovergestelde;
//   - de bevestiging kan hier de vraag stellen mét het aantal spelers erin;
//   - het menu sluit zichzelf (klik buiten, Escape, keuze) en dan valt alles
//     terug naar stap 0 — precies "dan moet je weer opnieuw beginnen".

export function createHostBar({ root, t, tCount = null, onAction }) {
  root.textContent = '';

  // Feedbackronde 4 aug (punt 2): geen woordenbrij meer. Zichtbaar zijn
  // hooguit twee dingen: een pauze-ICOON en (bij host-tempo) "Volgende".
  // Al het andere zit ingeklapt achter één ⋯-knop.
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

  // ── Niveau 1 ────────────────────────────────────────────────────────────

  // Bevinding 53c van pakket B: `lock`/`unlock` staat in
  // `availableHostActions()` en heeft vertalingen, maar had nergens een knop.
  // Keuze: knop, niet schrappen. Het is de enige omkeerbare hostactie tijdens
  // een potje ("er mag niemand meer bij") en daarmee precies wat punt 48
  // vraagt — een menu dat niet alleen uit noodgrepen bestaat.
  const lockButton = document.createElement('button');
  lockButton.type = 'button';
  lockButton.className = 'btn-secondary session-hostbar-lock';
  lockButton.hidden = true;
  lockButton.addEventListener('click', () => onAction(lockAction ?? 'lock'));

  const playersToggle = document.createElement('button');
  playersToggle.type = 'button';
  playersToggle.className = 'btn-secondary session-hostbar-players-toggle';
  playersToggle.hidden = true;
  playersToggle.setAttribute('aria-expanded', 'false');

  const playersList = document.createElement('ul');
  playersList.className = 'session-hostbar-players';
  playersList.hidden = true;

  const settingsToggle = document.createElement('button');
  settingsToggle.type = 'button';
  settingsToggle.className = 'btn-secondary session-hostbar-settings-toggle';
  settingsToggle.hidden = true;
  settingsToggle.setAttribute('aria-expanded', 'false');

  // ── Niveau 2: achter "Meer instellingen" ────────────────────────────────

  const settingsBox = el('div', 'session-hostbar-settings');
  settingsBox.hidden = true;

  // Stil, niet rood omkaderd (punt 49): de INGANG is een gewone regel, pas de
  // bevestiging eronder is destructief van vorm.
  const finishButton = document.createElement('button');
  finishButton.type = 'button';
  finishButton.className = 'session-hostbar-finish';
  finishButton.hidden = true;

  const finishConfirm = el('div', 'session-hostbar-confirm');
  finishConfirm.hidden = true;
  const finishQuestion = el('p', 'session-hostbar-confirm-question');
  const finishYes = document.createElement('button');
  finishYes.type = 'button';
  finishYes.className = 'btn-destructive session-hostbar-finish-yes';
  const finishNo = document.createElement('button');
  finishNo.type = 'button';
  finishNo.className = 'btn-secondary session-hostbar-finish-no';
  finishConfirm.append(finishQuestion, finishYes, finishNo);
  settingsBox.append(finishButton, finishConfirm);

  morePanel.append(lockButton, playersToggle, playersList, settingsToggle, settingsBox);
  bar.append(pauseButton, nextButton, moreButton, morePanel);
  root.appendChild(bar);

  let lockAction = null;
  let pauseAction = null;
  /** Laatst gerenderde fase — zie punt 53 in `update()`. */
  let gerenderdeFase = null;
  /** Het aantal spelers dat in de bevestigingsvraag komt te staan. */
  let spelersInRoom = 0;
  /** Staat `finish` in de beschikbare acties? Stuurt beide finish-knoppen. */
  let finishBeschikbaar = false;
  /** Resetters van de per-speler-rijen (punt 53). */
  const rijResetters = [];
  /** Zie `volgMenuSluiting()`. */
  let menuWaarnemer = null;

  /**
   * Alles binnen het paneel terug naar stap 0: beide laden dicht, geen half
   * ingezette bevestiging, geen opengeklapte spelerrij.
   *
   * Bewust los van `sluitPaneel()`. `morePanel.hidden` is sinds A3 niet meer
   * van dit bestand — `plaatsHostmenu()` in session-shell.mjs zet 'm bij elke
   * render, en de ⋯ hier is `display: none`. Zou de menuwaarnemer hieronder
   * `sluitPaneel()` aanroepen, dan bleef de hostsectie leeg tot het volgende
   * event; tussen twee rondes kan dat seconden duren.
   */
  function resetMenuStanden() {
    zetSectieOpen(playersToggle, playersList, false);
    zetSectieOpen(settingsToggle, settingsBox, false);
    zetFinishBevestiging(false);
    for (const reset of rijResetters) {
      reset();
    }
  }

  /** Idem, plus het paneel zelf dicht (faseovergang, of geen hostbalk meer). */
  function sluitPaneel() {
    moreButton.setAttribute('aria-expanded', 'false');
    morePanel.hidden = true;
    resetMenuStanden();
  }

  function zetSectieOpen(knop, doos, open) {
    knop.setAttribute('aria-expanded', String(open));
    doos.hidden = !open;
  }

  /** Stap 1 → stap 2 van beëindigen (en terug). */
  function zetFinishBevestiging(open) {
    finishConfirm.hidden = !open;
    finishButton.hidden = open || !finishBeschikbaar;
  }

  /**
   * "Als je verkeerd klikt moet je weer opnieuw beginnen" — dus een half
   * ingezette bevestiging mag een menusluiting niet overleven.
   *
   * Sinds A3 hangt dit paneel ín het voorkeurenmenu en sluit dát menu zichzelf
   * (klik buiten, Escape, keuze). Er is geen callback voor dat moment, en A's
   * bestand is niet van dit pakket — dus kijken we naar het enige signaal dat
   * er wél is: het `hidden`-attribuut van het menupaneel eromheen. Vindt hij
   * dat paneel niet (test-DOM, pagina zonder menu), dan blijft de reset over
   * die er al was: elke faseovergang.
   */
  function volgMenuSluiting() {
    if (menuWaarnemer !== null || typeof MutationObserver !== 'function') {
      return;
    }
    const menu = typeof morePanel.closest === 'function' ? morePanel.closest('.app-menu') : null;
    if (menu === null || menu === undefined) {
      return;
    }
    menuWaarnemer = new MutationObserver(() => {
      if (menu.hidden === true) {
        resetMenuStanden();
      }
    });
    menuWaarnemer.observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  }

  moreButton.addEventListener('click', () => {
    if (moreButton.getAttribute('aria-expanded') === 'true') {
      sluitPaneel();
      return;
    }
    moreButton.setAttribute('aria-expanded', 'true');
    morePanel.hidden = false;
  });

  playersToggle.addEventListener('click', () => {
    const open = playersToggle.getAttribute('aria-expanded') !== 'true';
    zetSectieOpen(playersToggle, playersList, open);
    if (!open) {
      for (const reset of rijResetters) {
        reset();
      }
    }
  });

  settingsToggle.addEventListener('click', () => {
    const open = settingsToggle.getAttribute('aria-expanded') !== 'true';
    zetSectieOpen(settingsToggle, settingsBox, open);
    // Dichtklappen zet ook een half ingezette bevestiging terug: anders staat
    // "Ja, beëindigen" er bij heropenen nog, zonder de vraag ervoor.
    if (!open) {
      zetFinishBevestiging(false);
    }
  });

  // GEMETEN, niet bedacht: stap 1 verbergt de knop waar de vinger/focus op
  // stond, dus viel de focus terug naar `body` — buiten het menu, waardoor
  // Escape het menu niet meer sloot en een toetsenbordgebruiker zijn plek
  // kwijt was. De focus gaat naar de UITWEG, niet naar de rode knop: twee keer
  // Enter mag nooit een potje beëindigen.
  finishButton.addEventListener('click', () => {
    zetFinishBevestiging(true);
    finishNo.focus();
  });
  finishNo.addEventListener('click', () => zetFinishBevestiging(false));
  finishYes.addEventListener('click', () => {
    zetFinishBevestiging(false);
    onAction('finish');
  });

  pauseButton.addEventListener('click', () => {
    if (pauseAction !== null) {
      onAction(pauseAction);
    }
  });

  /**
   * @param {{ isHost: boolean, availableActions: string[], participants: Map<string,string>, phase: string }} model
   */
  function update({ isHost, availableActions, participants, phase }) {
    // Punt 53, oorzaak b: in de LOBBY verbergt `rounda-1c.css` de hele balk
    // (feedbackronde 4 aug #8+#9 — start en verwijderen zitten dáár al in het
    // scherm zelf), terwijl deze module hem gewoon opbouwde. Twee bronnen die
    // iets anders zeggen over hetzelfde element. Nu beslist één regel het.
    bar.hidden = !isHost || phase === 'LOBBY';
    if (bar.hidden) {
      // Óók de ⋯-vlag omlaag, niet alleen het paneel. `session-shell.mjs`
      // leest `menuButton.hidden` om te bepalen of de hostsectie in het
      // voorkeurenmenu bestaat; bleef die op `false` staan van een vorige
      // fase, dan zag een host ná een revanche in de LOBBY nog steeds zijn
      // hostacties — inclusief beëindigen — terwijl de lobby daar zijn eigen
      // instellingen en spelerslijst voor heeft.
      moreButton.hidden = true;
      sluitPaneel();
      return;
    }

    // Punt 53, oorzaak a: de paneelinhoud verschilt per fase. Wát erin hoort
    // is menu-inhoud — maar de inhoud mag nooit ONDER de vinger van de host
    // omwisselen. Bij elke faseovergang gaat het paneel daarom dicht.
    if (phase !== gerenderdeFase) {
      gerenderdeFase = phase;
      sluitPaneel();
    }

    pauseAction = availableActions.includes('resume') ? 'resume' : availableActions.includes('pause') ? 'pause' : null;
    pauseButton.hidden = pauseAction === null;
    // Punt 2: icoon i.p.v. het woord — de betekenis zit in het aria-label.
    pauseButton.textContent = pauseAction === 'resume' ? '▶' : '⏸';
    pauseButton.setAttribute('aria-label', pauseAction === 'resume' ? t('session.resume') : t('session.pause'));

    nextButton.hidden = !availableActions.includes('next');
    nextButton.textContent = t('hostbar.next');

    lockAction = availableActions.includes('unlock') ? 'unlock' : availableActions.includes('lock') ? 'lock' : null;
    lockButton.hidden = lockAction === null;
    lockButton.textContent = t(lockAction === 'unlock' ? 'hostbar.unlock' : 'hostbar.lock');

    // S17: tijdens LOBBY toont lobby.mjs's eigen lijst de deelnemers al, mét
    // inline verwijderknoppen — de lijst hier verschijnt pas in de fases
    // daarna (gameplay, scoreboard, podium).
    const canKick = availableActions.includes('kick') && participants.size > 0 && phase !== 'LOBBY';
    playersToggle.hidden = !canKick;
    playersToggle.textContent = `${t('hostbar.players')} (${participants.size})`;
    if (!canKick) {
      zetSectieOpen(playersToggle, playersList, false);
    }

    spelersInRoom = participants.size;
    finishBeschikbaar = availableActions.includes('finish');
    settingsToggle.hidden = !finishBeschikbaar;
    settingsToggle.textContent = t('hostbar.settings');
    finishButton.textContent = t('hostbar.finish');
    finishQuestion.textContent = bevestigingsvraag(spelersInRoom);
    finishYes.textContent = t('hostbar.finishYes');
    finishNo.textContent = t('hostbar.cancel');
    // Valt `finish` weg (de match liep af), dan mag er geen half ingezette
    // bevestiging blijven staan. Anders houdt een openstaande stap 2 zijn
    // eigen stand: `update()` draait bij elk event, en die mag niet onder de
    // vinger van de host wegklappen.
    if (!finishBeschikbaar) {
      zetSectieOpen(settingsToggle, settingsBox, false);
      zetFinishBevestiging(false);
    } else {
      finishButton.hidden = !finishConfirm.hidden;
    }

    // De ⋯-knop bestaat alleen als er iets in het paneel zit. Voor een host is
    // dat sinds de lockknop altijd zo — maar de regel blijft staan: hij is de
    // enige bron voor "is er iets te tonen" (session-shell leest 'm).
    const hasMore = !lockButton.hidden || !playersToggle.hidden || !settingsToggle.hidden;
    moreButton.hidden = !hasMore;
    moreButton.setAttribute('aria-label', t('hostbar.more'));
    if (!hasMore) {
      sluitPaneel();
    }

    rijResetters.length = 0;
    playersList.textContent = '';
    for (const [playerId, name] of participants) {
      playersList.appendChild(spelerRij(playerId, name));
    }

    volgMenuSluiting();
  }

  /**
   * Eén rij in "Spelers beheren": naam + ⋯, daarachter Verwijder, en dáárachter
   * pas de bevestiging. Drie tikken tot een speler eruit ligt, en elke stap
   * heeft een weg terug.
   */
  function spelerRij(playerId, name) {
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
    kickButton.className = 'session-hostbar-kick';
    kickButton.textContent = t('hostbar.kick');
    kickButton.hidden = true;

    const kickConfirm = el('div', 'session-hostbar-confirm session-hostbar-confirm-row');
    kickConfirm.hidden = true;
    const kickQuestion = el('p', 'session-hostbar-confirm-question');
    kickQuestion.textContent = `${t('hostbar.kickConfirmPrefix')} ${name}`;
    const kickYes = document.createElement('button');
    kickYes.type = 'button';
    kickYes.className = 'btn-destructive session-hostbar-kick-yes';
    kickYes.textContent = t('hostbar.kickYes');
    const kickNo = document.createElement('button');
    kickNo.type = 'button';
    kickNo.className = 'btn-secondary session-hostbar-kick-no';
    kickNo.textContent = t('hostbar.cancel');
    kickConfirm.append(kickQuestion, kickYes, kickNo);

    // Punt 52: de ⋯-toggle bleef staan zodra Verwijder verscheen — een
    // omkaderde 44×44-knop met alléén puntjes erin, pal naast de knop die hij
    // net onthuld had (IMG_0294). Toggle en actie wisselen elkaar dus af.
    const zetRijOpen = (open, bevestigen = false) => {
      rowMenuButton.setAttribute('aria-expanded', String(open));
      rowMenuButton.hidden = open;
      kickButton.hidden = !open || bevestigen;
      kickConfirm.hidden = !bevestigen;
      label.hidden = bevestigen;
    };
    // Zelfde reden als bij beëindigen: de knop die zojuist geklikt is
    // verdwijnt, dus de focus moet mee naar de uitweg.
    kickButton.addEventListener('click', () => {
      zetRijOpen(true, true);
      kickNo.focus();
    });
    kickNo.addEventListener('click', () => zetRijOpen(false));
    kickYes.addEventListener('click', () => {
      zetRijOpen(false);
      onAction('kick', { playerId });
    });
    rowMenuButton.addEventListener('click', () => {
      zetRijOpen(rowMenuButton.getAttribute('aria-expanded') !== 'true');
    });
    rijResetters.push(() => zetRijOpen(false));

    item.append(label, rowMenuButton, kickButton, kickConfirm);
    return item;
  }

  /**
   * "Game beëindigen voor 8 spelers?" — het aantal hoort in de vraag, want
   * dát is wat de host op het spel zet. Zonder `tCount` (of zonder telling)
   * valt hij terug op de bestaande, telloze zin: liever een vraag zonder
   * getal dan "1 spelers".
   */
  function bevestigingsvraag(aantal) {
    if (tCount === null || aantal <= 0) {
      return t('hostbar.finishConfirm');
    }
    return tCount('hostbar.finishConfirmCount', aantal);
  }

  return {
    update,
    // Voor de pauze-overlay (session-shell.mjs): focus terug naar de knop die
    // pauzeren/hervatten regelt, ná het sluiten van die overlay.
    focusPause() {
      pauseButton.focus();
    },
    /** Hoort bij `volgMenuSluiting()`: het menu overleeft elke sessie, de waarnemer niet. */
    destroy() {
      if (menuWaarnemer !== null) {
        menuWaarnemer.disconnect();
        menuWaarnemer = null;
      }
    },
    // A3 (#7/#8/#46): het ⋯-paneel hierboven is niet langer een eigen zwevend
    // menu — session-shell.mjs hangt het ín het gedeelde voorkeurenmenu, zodat
    // er één ⋯ in de chrome staat in plaats van twee identieke naast elkaar.
    // `menuButton` blijft de bron voor "is er iets te tonen".
    menuPanel: morePanel,
    menuButton: moreButton,
  };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
