// views/lobby/instellingen.mjs — UI2, uit lobby.mjs gesplitst (docs/
// openstaand/refactor/11-lobby.md). De in-/uitklapbare hostinstellingen
// (scherm 2, besluit 40): rondes, moeilijkheid, taal, toggles, en "Meer
// instellingen" met het continentfilter.
//
// VASTLIGGENDE REGEL #2 (11-lobby.md): de serverstand is de waarheid. Draaien
// aan een instelling stuurt game:update-config; wat je daarna ziet komt
// terug via room:config-changed. Niet lokaal vooruitlopen — vandaar dat elke
// knop hieronder zijn `is-active`/`is-on`-klasse alleen in `update(model)`
// zet, nooit meteen bij de klik zelf.
//
// De gamecarrousel (kaart, pijlen, vegen) is een LOS bestand
// (`gamekeuze.mjs`, vastliggende regel #1: game-catalog.mjs is de enige bron
// van wat speelbaar is) — deze module ontvangt zijn twee wortelelementen als
// parameter en plakt ze vóór zijn eigen rijen in `settingsBody`, want in het
// ongesplitste bestand stonden ze daar ook als eerste.
//
// Geen eigen root/mount voor `settingsSection` zelf: dat is een DIRECTE kind
// van `.lobby-main-column` (CSS-gap-ritme, `lobby.css`) — de aanroeper
// (lobby.mjs) plakt 'm op zijn plek.

// Punt 7 (continentfilter.md): dezelfde zes waarden als CONTINENT_VALUES in
// server/data/types/game-configuration.js, hier lokaal getranscribeerd — de
// frontend importeert niets uit server/ (zelfde afweging als PACING_VALUES
// daar).
const CONTINENTS = Object.freeze(['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania']);

function continentLocaleKey(continent) {
  return `lobby.continent_${continent.toLowerCase().replace(/ /g, '_')}`;
}

export function createInstellingenView({ t, isHost, onConfigChange, gamekeuzeElements }) {
  async function pushConfig(patch) {
    try {
      await onConfigChange?.(patch);
    } catch {
      // room:config-changed blijft uit → de volgende update() zet de knoppen
      // gewoon terug naar de serverstand; geen eigen foutkanaal nodig.
    }
  }

  // ── SCHERM 2 (besluit 40): host-instellingen ÍN de lobby — in/uitklapbaar,
  // aangesloten op game:update-config. Mix/Typen en de game-carrousel staan
  // zichtbaar maar uitgeschakeld tot de features bestaan (besluit 40D). ──
  const settingsSection = document.createElement('section');
  settingsSection.className = 'lobby-settings';
  settingsSection.hidden = !isHost;
  const settingsHeader = document.createElement('button');
  settingsHeader.type = 'button';
  settingsHeader.className = 'lobby-settings-header';
  settingsHeader.setAttribute('aria-expanded', 'true');
  const settingsHeaderLabel = document.createElement('span');
  settingsHeaderLabel.className = 'lobby-settings-title';
  const settingsHeaderChevron = document.createElement('span');
  settingsHeaderChevron.className = 'lobby-settings-chevron';
  settingsHeaderChevron.textContent = '⌃';
  settingsHeader.append(settingsHeaderLabel, settingsHeaderChevron);
  const settingsBody = document.createElement('div');
  settingsBody.className = 'lobby-settings-body';
  settingsHeader.addEventListener('click', () => {
    const open = settingsHeader.getAttribute('aria-expanded') === 'true';
    settingsHeader.setAttribute('aria-expanded', String(!open));
    settingsBody.hidden = open;
    settingsHeaderChevron.textContent = open ? '⌄' : '⌃';
  });

  function settingsLabel(className) {
    const p = document.createElement('p');
    p.className = `lobby-settings-label ${className}`;
    return p;
  }
  function segGroup() {
    const group = document.createElement('div');
    group.className = 'lobby-seg';
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

  // TIJD PER VRAAG → questionSeconds (besluit 55). Zelfde vorm als het
  // niveau: drie knoppen in plaats van een getal, zodat niemand hoeft te
  // typen en de standaard blijft wat hij was.
  const tijdLabel = settingsLabel('lobby-settings-time-label');
  const tijdGroup = segGroup();
  const tijdButtons = new Map();
  for (const [sleutel, seconden] of [['calm', 25], ['normal', 15], ['fast', 10]]) {
    const btn = segButton(tijdGroup, { onPick: () => pushConfig({ questionSeconds: seconden }) });
    btn.dataset.timeKey = sleutel;
    tijdButtons.set(seconden, btn);
  }

  // Toggle: automatisch volgende vraag (aan = pacing auto, uit = host)
  const autoNextRow = document.createElement('div');
  autoNextRow.className = 'lobby-toggle-row';
  const autoNextLabel = document.createElement('span');
  autoNextLabel.className = 'lobby-toggle-label';
  const autoNextToggle = document.createElement('button');
  autoNextToggle.type = 'button';
  autoNextToggle.className = 'lobby-toggle';
  autoNextToggle.setAttribute('role', 'switch');
  const autoNextKnob = document.createElement('i');
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
  const autoRevealRow = document.createElement('div');
  autoRevealRow.className = 'lobby-toggle-row';
  const autoRevealLabel = document.createElement('span');
  autoRevealLabel.className = 'lobby-toggle-label';
  const autoRevealToggle = document.createElement('button');
  autoRevealToggle.type = 'button';
  autoRevealToggle.className = 'lobby-toggle';
  autoRevealToggle.setAttribute('role', 'switch');
  const autoRevealKnob = document.createElement('i');
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
  const moreBody = document.createElement('div');
  moreBody.className = 'lobby-settings-morebody';
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
  const bonusRow = document.createElement('div');
  bonusRow.className = 'lobby-toggle-row';
  const bonusLabel = document.createElement('span');
  bonusLabel.className = 'lobby-toggle-label';
  const bonusToggle = document.createElement('button');
  bonusToggle.type = 'button';
  bonusToggle.className = 'lobby-toggle';
  bonusToggle.setAttribute('role', 'switch');
  bonusToggle.appendChild(document.createElement('i'));
  let currentBonus = true;
  bonusToggle.addEventListener('click', () => pushConfig({ speedBonus: !currentBonus }));
  bonusRow.append(bonusLabel, bonusToggle);
  const lateRow = document.createElement('div');
  lateRow.className = 'lobby-toggle-row';
  const lateLabel = document.createElement('span');
  lateLabel.className = 'lobby-toggle-label';
  const lateToggle = document.createElement('button');
  lateToggle.type = 'button';
  lateToggle.className = 'lobby-toggle';
  lateToggle.setAttribute('role', 'switch');
  lateToggle.appendChild(document.createElement('i'));
  let currentLate = true;
  lateToggle.addEventListener('click', () => pushConfig({ allowLateJoin: !currentLate }));
  lateRow.append(lateLabel, lateToggle);

  // Continenten (punt 7, docs/openstaand/continentfilter.md, besluit 52):
  // geen aparte landenkeuze, alleen aan-/uitzetten per werelddeel. Standaard
  // alle zes aan (serverdefault). Multi-select, dus GEEN segButton-exclusiviteit
  // — elke knop toggelt zijn eigen lidmaatschap in `currentContinents`.
  //
  // Create-only (besluit 52): `continents` staat nog niet in
  // `UPDATABLE_CONFIG_KEYS` (server/protocol/client-events-dispatch.mjs),
  // dus deze rij werkt vandaag alleen tegen de mock. `pushConfig` slikt de
  // afwijzing van een echte server stil — precies zoals elke andere toggle
  // hier al doet als een update niet doorkomt.
  const continentsLabel = settingsLabel('lobby-settings-continents-label');
  const continentsGroup = segGroup();
  const continentButtons = new Map();
  let currentContinents = new Set(CONTINENTS);
  for (const continent of CONTINENTS) {
    const btn = segButton(continentsGroup, {
      onPick: () => {
        const volgende = new Set(currentContinents);
        if (volgende.has(continent)) {
          // Nooit de laatste overblijvende continent uitzetten (game-configuration.js
          // eist minstens één) — geen rondje naar de server voor iets wat daar
          // toch RangeError zou geven.
          if (volgende.size <= 1) return;
          volgende.delete(continent);
        } else {
          volgende.add(continent);
        }
        currentContinents = volgende;
        for (const [c, b] of continentButtons) {
          b.classList.toggle('is-active', volgende.has(c));
        }
        pushConfig({ continents: CONTINENTS.filter((c) => volgende.has(c)) });
      },
    });
    continentButtons.set(continent, btn);
  }
  moreBody.append(questionsLabel, questionsGroup, qLangLabel, qLangGroup, bonusRow, lateRow, continentsLabel, continentsGroup);

  settingsBody.append(
    ...gamekeuzeElements,
    answersLabel, answersGroup,
    levelLabel, levelGroup,
    tijdLabel, tijdGroup,
    autoNextRow, autoRevealRow,
    moreToggle, moreBody,
  );
  settingsSection.append(settingsHeader, settingsBody);

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
    const badge = document.createElement('span');
    badge.className = 'lobby-seg-soon';
    badge.textContent = soon;
    knop.append(tekst, badge);
  }

  function render() {
    settingsHeaderLabel.textContent = t('lobby.settings');
    autoRevealLabel.textContent = t('lobby.autoReveal');
    moreToggle.textContent = t('lobby.moreSettings');
    qLangLabel.textContent = t('lobby.questionLanguage');
    bonusLabel.textContent = t('lobby.speedBonus');
    lateLabel.textContent = t('lobby.lateJoin');
    continentsLabel.textContent = t('lobby.continents');
    for (const [continent, btn] of continentButtons) {
      btn.textContent = t(continentLocaleKey(continent));
    }
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
    tijdLabel.textContent = t('lobby.questionTime');
    for (const [, btn] of tijdButtons) {
      btn.textContent = t(`lobby.questionTime_${btn.dataset.timeKey}`);
    }
    autoNextLabel.textContent = t('lobby.autoNext');
  }

  render();

  /**
   * Alleen aangeroepen door lobby.mjs als `isHost` — precies zoals in het
   * ongesplitste bestand, waar dit hele blok binnen `if (isHost) {...}` stond.
   * @param {{ config?: object }} model
   */
  function update(model) {
    // Scherm 2: de serverconfig is de waarheid voor de instelknoppen.
    const config = model.config ?? {};
    for (const [difficulty, btn] of levelButtons) {
      btn.classList.toggle('is-active', config.difficulty === difficulty);
    }
    for (const [n, btn] of questionButtons) {
      btn.classList.toggle('is-active', config.totalRounds === n);
    }
    for (const [seconden, btn] of tijdButtons) {
      btn.classList.toggle('is-active', config.questionSeconds === seconden);
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
    // Ontbreekt config.continents (nog geen server geweest) dan is de
    // serverdefault "alle zes" — zelfde als QUICK_START_CONFIG.
    currentContinents = Array.isArray(config.continents) && config.continents.length > 0
      ? new Set(config.continents)
      : new Set(CONTINENTS);
    for (const [continent, btn] of continentButtons) {
      btn.classList.toggle('is-active', currentContinents.has(continent));
    }
  }

  return { settingsSection, update, render };
}
