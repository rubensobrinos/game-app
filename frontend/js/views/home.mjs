// views/home.mjs — UI1. DOM + bedrading van scherm 1 (Home). `host-setup-
// state.mjs` (client/flow) draagt de kernflow quick-start default
// (DECISIONS.md #35: alléén flags_mc); dit bestand dispatcht erop en roept
// ná SUBMIT `transport.createGame` aan. Geavanceerde instellingen
// ("Game instellen") blijven in UI1a ingeklapt — de default werkt zonder ze
// te openen (UI1-home-and-join.md).
//
// Code-invoer slaat scherm 2's preview-stap over (PROTOCOL.md's
// previewendpoint is invite-only) en gaat direct naar het naamveld — dat is
// hetzelfde scherm als een invite-URL zou tonen, dus deze module roept
// `onCodeLocator(locator)` aan in plaats van zelf een naamveld te bouwen; de
// aanroeper (app.mjs) mount daarvoor `views/join.mjs`.

import { initialHostSetupState, transition, createRequestFor } from '../../../client/flow/host-setup-state.mjs';
import { saveSession } from '../../../client/flow/session-store.mjs';
import { messageForErrorCode } from '../../../client/flow/edge-case-messaging.mjs';
import { resolveRoute } from '../../../client/flow/route-resolver.mjs';
import { createHostSetupView } from './host-setup.mjs';
import { setButtonLoading } from '../button-loading.mjs';

const CODE_FORMAT = /^[0-9]{6}$/;

export function createHomeView({ root, t, transport, storage, onNavigate, onCodeLocator, onSolo = null }) {
  root.textContent = '';

  const screen = el('div', 'screen home-screen');
  const logo = el('div', 'app-logo');
  logo.textContent = '🌍';
  // `brand-title`: het homescherm toont de productnaam zelf, en dat is het
  // enige element dat de gradient nog mag dragen (D-017).
  const title = el('h1', 'home-title brand-title');
  const promise = el('p', 'home-promise');
  const quickStartButton = document.createElement('button');
  quickStartButton.type = 'button';
  quickStartButton.className = 'home-quick-start btn-primary';
  // BOUWSPRINT (rounda-1c): mockup toont "START" + een kleine sublabel
  // "JE BENT LEIDER" (`home.quickStartSub`) — wie op déze knop drukt is
  // altijd meteen host (`hostParticipates` default), dus dat klopt hier
  // onvoorwaardelijk. Aparte `[data-button-loading-label]`-span zodat
  // `setButtonLoading` (button-loading.mjs) alleen dát label wisselt tijdens
  // "Potje maken…" — de sublabel blijft ongemoeid staan.
  const quickStartLabel = el('span', 'home-quick-start-label');
  quickStartLabel.dataset.buttonLoadingLabel = '';
  const quickStartSub = el('span', 'home-quick-start-sub');
  quickStartButton.append(quickStartLabel, quickStartSub);
  const quickStartError = el('p', 'home-quick-start-error field-error');
  // M6/E02: `setButtonLoading` (thema 2, T2-2) is de gedeelde laadstaat-
  // mechanisme voor precies dit moment — label, spinner, breedte-lock,
  // `aria-busy` en `disabled` in één aanroep. `quickStartStatus` blijft
  // uitsluitend de aria-live-aankondiging (sr-only, geen zichtbare
  // tekstverdubbeling met de knop).
  const quickStartStatus = el('p', 'home-quick-start-status sr-only');
  quickStartStatus.setAttribute('aria-live', 'polite');

  const divider = el('p', 'home-divider');
  divider.textContent = t('home.divider');

  // BOUWSPRINT 1c-transplantatie: zes losse cellen i.p.v. één tekstveld met
  // live formattering ("123 456") — `rounda-1c.css`'s `.home-code-input`
  // is geschreven voor per-cijfer cellen (mono, brede letter-spacing), niet
  // voor één doorlopend veld. Eén label kan semantisch niet zes inputs
  // tegelijk targeten (`for`/`id` is 1:1) — daarom `role="group"` +
  // `aria-labelledby` op de celcontainer i.p.v. een `<label>`-wrapper.
  const CODE_LENGTH = 6;
  const codeSection = el('div', 'home-code-label field-label');
  const codeLabelText = el('span', 'field-label-text');
  codeLabelText.id = 'home-code-label-text';
  const codeCells = el('div', 'home-code-cells');
  codeCells.setAttribute('role', 'group');
  codeCells.setAttribute('aria-labelledby', codeLabelText.id);
  const codeCellInputs = [];
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.inputMode = 'numeric';
    cell.autocomplete = 'off';
    cell.maxLength = 1;
    cell.className = 'home-code-input field-input';
    codeCellInputs.push(cell);
    codeCells.appendChild(cell);
  }
  codeSection.append(codeLabelText, codeCells);
  const codeError = el('p', 'home-code-error field-error');
  const codeSubmitButton = document.createElement('button');
  codeSubmitButton.type = 'button';
  codeSubmitButton.className = 'home-code-submit btn-secondary';

  // S01 inhoudshiërarchie punt 6 ("aanpaslink"): tertiair, na het codeveld —
  // nooit even dominant als de primaire quick-start-knop.
  const hostSetupLink = document.createElement('button');
  hostSetupLink.type = 'button';
  hostSetupLink.className = 'home-host-setup-link btn-quiet';
  hostSetupLink.addEventListener('click', () => dispatch({ type: 'OPEN_ADVANCED' }));

  // ── SOLO (besluit C-1, 5 aug 2026): alleen spelen is geen tweede app meer
  // maar dezelfde app op de mocktransport — één kamer, één speler. Tertiair,
  // onder het codeveld: samen spelen is de belofte van dit scherm, solo is de
  // uitwijk voor wie nu niemand bij zich heeft.
  const soloButton = document.createElement('button');
  soloButton.type = 'button';
  soloButton.className = 'home-solo-link btn-quiet';
  soloButton.hidden = onSolo === null;
  soloButton.addEventListener('click', () => {
    if (onSolo === null) return;
    onSolo();
  });

  // Feedbackronde 2 (4 aug, punt 1+2): "Spel aanpassen" is hier weg — je
  // stelt een spel pas in als er een lobby ís (scherm 2). De hostSetup-flow
  // blijft in de code bestaan maar heeft geen ingang meer.
  const quickStartGroup = [logo, title, promise, quickStartButton, quickStartStatus, quickStartError, divider, codeSection, codeError, codeSubmitButton, soloButton];
  screen.append(...quickStartGroup);

  // S02: los scherm, hergebruikt dezelfde HostSetupState-instantie (geen
  // eigen URL-route, alleen `state.mode` bepaalt wat zichtbaar is).
  const hostSetupRoot = document.createElement('div');
  hostSetupRoot.hidden = true;
  const hostSetupView = createHostSetupView({
    root: hostSetupRoot,
    t,
    onSetField: (key, value) => dispatch({ type: 'SET_FIELD', key, value }),
    onToggleHostParticipates: () => dispatch({ type: 'TOGGLE_HOST_PARTICIPATES' }),
    onStart: () => {
      dispatch({ type: 'SUBMIT' });
      runCreate();
    },
    onReset: () => {
      // "Herstel standaardinstellingen": alleen ná expliciete keuze van de
      // gebruiker verliezen wijzigingen betekenis — `state.mode` blijft
      // 'advanced' zodat de gebruiker niet stilzwijgend terugvalt naar
      // quick-start (prompt 09's Aanpak punt 3).
      state = { ...initialHostSetupState(), mode: 'advanced' };
      render();
    },
    onBack: () => dispatch({ type: 'CLOSE_ADVANCED' }),
  });
  screen.appendChild(hostSetupRoot);
  root.append(screen);

  let state = initialHostSetupState();

  quickStartButton.addEventListener('click', () => {
    if (state.status === 'error') {
      dispatch({ type: 'RETRY' });
    }
    if (state.status !== 'editing') {
      return;
    }
    dispatch({ type: 'SUBMIT' });
    runCreate();
  });

  // Zes cellen, één logische waarde: elke cel houdt precies 0 of 1 cijfer.
  // Getypt cijfer -> volgende cel krijgt focus (S03's oude auto-doorschuif-
  // gedrag, nu per cel i.p.v. via `formatCode()`'s live spatie-opmaak).
  codeCellInputs.forEach((cell, index) => {
    cell.addEventListener('input', () => {
      const digit = cell.value.replace(/\D/g, '').slice(-1);
      cell.value = digit;
      if (digit !== '' && index < CODE_LENGTH - 1) {
        codeCellInputs[index + 1].focus();
      }
    });

    // Backspace op een lege cel springt terug en wist de vorige — hetzelfde
    // gedrag als elke bekende OTP-celinvoer (geen aparte spec hiervoor,
    // dit is de gangbare verwachting).
    cell.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && cell.value === '' && index > 0) {
        event.preventDefault();
        codeCellInputs[index - 1].value = '';
        codeCellInputs[index - 1].focus();
      } else if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        codeCellInputs[index - 1].focus();
      } else if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
        event.preventDefault();
        codeCellInputs[index + 1].focus();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        codeSubmitButton.click();
      }
    });

    // S03: een geplakte volledige join-URL (`/j/{inviteId}`) is geen
    // 6-cijferige code om te "extraheren" (die twee vormen zijn niet
    // compatibel, zie 06-start-en-join-polish.md) — een herkende invite-link
    // schakelt rechtstreeks door naar die flow. Een geplakte cijferreeks
    // (bv. "482917" of "482 917") verdeelt zich over de zes cellen vanaf de
    // huidige cel — "Plakken werkt" bleef zo, alleen nu per cel i.p.v. één veld.
    cell.addEventListener('paste', (event) => {
      const pasted = event.clipboardData?.getData('text') ?? '';
      try {
        const pathname = new URL(pasted.trim()).pathname;
        const route = resolveRoute(pathname);
        if (route.route === 'join') {
          event.preventDefault();
          onNavigate(`/j/${route.inviteId}`);
          return;
        }
      } catch {
        // geen volledige URL geplakt — val door naar cijfers-over-cellen-verdelen
      }
      const digits = pasted.replace(/\D/g, '').slice(0, CODE_LENGTH - index);
      if (digits === '') {
        return;
      }
      event.preventDefault();
      for (let i = 0; i < digits.length; i += 1) {
        codeCellInputs[index + i].value = digits[i];
      }
      const nextEmpty = Math.min(index + digits.length, CODE_LENGTH - 1);
      codeCellInputs[nextEmpty].focus();
    });
  });

  codeSubmitButton.addEventListener('click', () => {
    const code = codeCellInputs.map((cell) => cell.value).join('');
    if (!CODE_FORMAT.test(code)) {
      codeError.textContent = t('home.codeInvalid');
      return;
    }
    codeError.textContent = '';
    onCodeLocator({ type: 'code', code });
  });

  function dispatch(event) {
    state = transition(state, event);
    render();
  }

  async function runCreate() {
    const request = createRequestFor(state);
    if (request === null) {
      return;
    }
    try {
      const response = await transport.createGame(request);
      saveSession(storage, {
        sessionToken: response.sessionToken,
        roomCode: response.gameCode,
        playerId: response.playerId,
        savedAt: Date.now(),
      });
      dispatch({ type: 'CREATE_SUCCEEDED' });
      onNavigate(`/host/${response.gameCode}`);
    } catch (err) {
      dispatch({ type: 'CREATE_FAILED', errorCode: err?.code });
    }
  }

  function render() {
    const advanced = state.mode === 'advanced';
    for (const node of quickStartGroup) {
      node.hidden = advanced;
    }
    hostSetupRoot.hidden = !advanced;

    if (advanced) {
      hostSetupView.update(state);
      return;
    }

    title.textContent = t('home.title');
    promise.textContent = t('home.promise');
    codeLabelText.textContent = t('home.codeLabel');
    // M6/E02: `setButtonLoading` verzorgt label, spinner, breedte-lock,
    // `aria-busy` en `disabled` in één aanroep (checklist C: "Verandert de
    // knop direct naar `Potje maken…`?"). Idle-label eerst zetten zodat
    // `loading: false` altijd iets zinnigs heeft om op terug te vallen.
    quickStartLabel.textContent = t('home.quickStart');
    quickStartSub.textContent = t('home.quickStartSub');
    setButtonLoading(quickStartButton, { loading: state.status === 'creating', label: state.status === 'creating' ? t('home.creating') : null });
    divider.hidden = state.status === 'creating';
    codeSection.hidden = state.status === 'creating';
    codeSubmitButton.hidden = state.status === 'creating';
    codeSubmitButton.textContent = t('home.codeSubmit');
    soloButton.textContent = t('home.soloStart');
    // Na de groepslus: zonder `onSolo` bestaat er geen solomodus en mag de
    // knop nooit zichtbaar worden, ook niet in quick-start-weergave.
    soloButton.hidden = onSolo === null || state.status === 'creating';
    hostSetupLink.textContent = t('home.hostSetupLink');
    hostSetupLink.hidden = true; // punt 1+2: geen instellingen-ingang zonder lobby
    quickStartStatus.textContent = state.status === 'creating' ? t('home.creating') : '';
    quickStartError.textContent = state.status === 'error' ? t(`error.${messageForErrorCode(state.errorCode)}`) : '';
  }

  render();

  return { render };
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
