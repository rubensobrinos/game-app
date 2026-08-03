// views/host-setup.mjs — UI1. DOM-laag van scherm S02 ("Spel aanpassen").
// `client/flow/host-setup-state.mjs` draagt alle flowlogica (SET_FIELD,
// TOGGLE_HOST_PARTICIPATES, OPEN_ADVANCED/CLOSE_ADVANCED, SUBMIT) — dit
// bestand rendert alleen en vertaalt tikken naar callbacks, zelfde patroon
// als lobby.mjs/join.mjs. Gemount door home.mjs zodra `state.mode ===
// 'advanced'`, in plaats van zichzelf (geen eigen URL-route, zie
// 09-S02-spel-aanpassen.md).
//
// Twee scope-beperkingen, bewust GEEN interactieve controls voor (zelfde
// document): "Spelvorm" toont alleen de vaste, huidige waarde
// (`gameTypes` kent vandaag precies één optie, DECISIONS.md #31/#32/#35) en
// "Teams of individuele modus" toont alleen dat individuele modus de enige
// bestaande waarde is (`config.mode` kent geen teamwaarde in het datamodel)
// — beide met een `HANDOFF`-verwijzing in de tekst zelf, niet als schijnkeuze
// gebouwd.
//
// Progressief onthuld (04's acceptatiecriterium): elke groep is een
// `<details>` met de huidige waarde al zichtbaar in de `<summary>` — geen
// eigen open/dicht-state nodig, dat is precies wat `<details>` al doet.

const DIFFICULTY_OPTIONS = ['easy', 'normal', 'hard', 'extreme'];
const LANGUAGE_OPTIONS = ['nl', 'en', 'es'];
const MIN_ROUNDS = 3;
const MAX_ROUNDS = 30;

export function createHostSetupView({ root, t, onSetField, onToggleHostParticipates, onStart, onReset, onBack }) {
  root.textContent = '';

  const screen = el('div', 'host-setup-screen');

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'host-setup-back btn-quiet';
  backButton.addEventListener('click', () => onBack());

  const title = el('h1', 'host-setup-title');

  // Groep 1 — Spelvorm: vaste waarde, geen schijpkeuze (scope-beperking 1).
  const gameTypeGroup = buildStaticGroup('host-setup-game-type');

  // Groep 2 — Moeilijkheid en taal.
  const difficultyField = buildSelectField(
    'host-setup-difficulty',
    DIFFICULTY_OPTIONS,
    (value) => onSetField('difficulty', value),
    (value) => t(`hostSetup.difficulty.${value}`),
  );
  const languageField = buildSelectField(
    'host-setup-language',
    LANGUAGE_OPTIONS,
    (value) => onSetField('language', value),
    (value) => t(`hostSetup.language.${value}`),
  );
  const contentGroup = buildGroup('host-setup-content', [difficultyField.wrap, languageField.wrap]);

  // Groep 3 — Aantal rondes.
  const roundsInput = document.createElement('input');
  roundsInput.type = 'number';
  roundsInput.min = String(MIN_ROUNDS);
  roundsInput.max = String(MAX_ROUNDS);
  roundsInput.className = 'field-input host-setup-rounds-input';
  roundsInput.addEventListener('change', () => {
    const value = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Number(roundsInput.value) || MIN_ROUNDS));
    roundsInput.value = String(value);
    onSetField('totalRounds', value);
  });
  const roundsLabel = el('label', 'host-setup-rounds-label field-label');
  const roundsLabelText = el('span', 'field-label-text');
  roundsLabel.append(roundsLabelText, roundsInput);
  const roundsGroup = buildGroup('host-setup-rounds', [roundsLabel]);

  // Groep 4 — Teams of individuele modus: vaste waarde (scope-beperking 2).
  const modeGroup = buildStaticGroup('host-setup-mode');

  // Groep 5 — Aanvullende regels.
  const pacingField = buildSelectField(
    'host-setup-pacing',
    ['auto', 'host'],
    (value) => onSetField('pacing', value),
    (value) => t(`hostSetup.pacing.${value}`),
  );
  const speedBonusToggle = buildCheckboxField('host-setup-speed-bonus', (checked) => onSetField('speedBonus', checked));
  const allowLateJoinToggle = buildCheckboxField('host-setup-allow-late-join', (checked) =>
    onSetField('allowLateJoin', checked),
  );
  const hostParticipatesToggle = buildCheckboxField('host-setup-host-participates', () => onToggleHostParticipates());
  const rulesGroup = buildGroup('host-setup-rules', [
    pacingField.wrap,
    speedBonusToggle.wrap,
    allowLateJoinToggle.wrap,
    hostParticipatesToggle.wrap,
  ]);

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'host-setup-start btn-primary';
  startButton.addEventListener('click', () => onStart());

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'host-setup-reset btn-secondary';
  resetButton.addEventListener('click', () => onReset());

  screen.append(
    backButton,
    title,
    gameTypeGroup.details,
    contentGroup.details,
    roundsGroup.details,
    modeGroup.details,
    rulesGroup.details,
    startButton,
    resetButton,
  );
  root.appendChild(screen);

  function update(state) {
    backButton.textContent = t('hostSetup.back');
    title.textContent = t('hostSetup.title');
    startButton.textContent = t('hostSetup.start');
    resetButton.textContent = t('hostSetup.reset');

    gameTypeGroup.summary.textContent = t('hostSetup.gameTypeGroup');
    // Scope-beperking 1: `gameTypes` heeft vandaag precies één mogelijke
    // waarde — geen dropdown die niets doet, alleen tonen wat al vaststaat.
    gameTypeGroup.detail.textContent = t('hostSetup.gameTypeFixed');

    contentGroup.summary.textContent = `${t('hostSetup.contentGroup')}: ${t(`hostSetup.difficulty.${state.config.difficulty}`)}, ${t(`hostSetup.language.${state.config.language}`)}`;
    difficultyField.labelText.textContent = t('hostSetup.difficultyLabel');
    difficultyField.setValue(state.config.difficulty);
    languageField.labelText.textContent = t('hostSetup.languageLabel');
    languageField.setValue(state.config.language);

    roundsGroup.summary.textContent = `${t('hostSetup.roundsGroup')}: ${state.config.totalRounds}`;
    roundsLabelText.textContent = t('hostSetup.roundsLabel');
    roundsInput.value = String(state.config.totalRounds);

    modeGroup.summary.textContent = t('hostSetup.modeGroup');
    // Scope-beperking 2: `config.mode` kent geen teamwaarde in het datamodel
    // (HANDOFF aan client/flow's eigenaar als teams alsnog gewenst zijn) —
    // geen UI voor een waarde die de reducer niet kent.
    modeGroup.detail.textContent = t('hostSetup.modeFixed');

    rulesGroup.summary.textContent = t('hostSetup.rulesGroup');
    pacingField.labelText.textContent = t('hostSetup.pacingLabel');
    pacingField.setValue(state.config.pacing);
    speedBonusToggle.labelText.textContent = t('hostSetup.speedBonusLabel');
    speedBonusToggle.setChecked(state.config.speedBonus);
    allowLateJoinToggle.labelText.textContent = t('hostSetup.allowLateJoinLabel');
    allowLateJoinToggle.setChecked(state.config.allowLateJoin);
    hostParticipatesToggle.labelText.textContent = t('hostSetup.hostParticipatesLabel');
    hostParticipatesToggle.setChecked(state.hostParticipates);

    startButton.disabled = state.status !== 'editing';
  }

  return { update };
}

function buildGroup(className, children) {
  const details = document.createElement('details');
  details.className = className;
  const summary = document.createElement('summary');
  details.appendChild(summary);
  for (const child of children) {
    details.appendChild(child);
  }
  return { details, summary };
}

function buildStaticGroup(className) {
  const detail = el('p', `${className}-detail`);
  const group = buildGroup(className, [detail]);
  return { ...group, detail };
}

function buildSelectField(className, values, onChange, labelFor) {
  const wrap = el('label', `${className}-field field-label`);
  const labelText = el('span', 'field-label-text');
  const select = document.createElement('select');
  select.className = 'field-input';
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.dataset.value = value;
    select.appendChild(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  wrap.append(labelText, select);
  return {
    wrap,
    labelText,
    setValue(value) {
      for (const option of select.options) {
        option.textContent = labelFor(option.dataset.value);
      }
      select.value = value;
    },
  };
}

function buildCheckboxField(className, onChange) {
  const wrap = el('label', `${className}-field host-setup-checkbox-field`);
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.addEventListener('change', () => onChange(checkbox.checked));
  const labelText = el('span', 'field-label-text');
  wrap.append(checkbox, labelText);
  return {
    wrap,
    labelText,
    setChecked(value) {
      checkbox.checked = value === true;
    },
  };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
