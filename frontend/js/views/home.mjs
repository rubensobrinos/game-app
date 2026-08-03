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
import { formatCode } from './room-header.mjs';
import { createHostSetupView } from './host-setup.mjs';
import { setButtonLoading } from '../button-loading.mjs';

const CODE_FORMAT = /^[0-9]{6}$/;

export function createHomeView({ root, t, transport, storage, onNavigate, onCodeLocator }) {
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

  const codeLabel = el('label', 'home-code-label field-label');
  const codeLabelText = el('span', 'field-label-text');
  const codeInput = document.createElement('input');
  codeInput.type = 'text';
  codeInput.inputMode = 'numeric';
  // 7, niet 6: de zichtbare, geformatteerde waarde ("123 456") heeft een
  // spatie extra — de onderliggende cijferwaarde blijft door de
  // input-handler hieronder zelf op 6 cijfers begrensd.
  codeInput.maxLength = 7;
  codeInput.placeholder = t('home.codePlaceholder');
  codeInput.className = 'home-code-input field-input';
  codeLabel.append(codeLabelText, codeInput);
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

  const quickStartGroup = [logo, title, promise, quickStartButton, quickStartStatus, quickStartError, divider, codeLabel, codeError, codeSubmitButton, hostSetupLink];
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

  // S03: visuele codeformattering ("123 456") terwijl de onderliggende
  // waarde schoon blijft — zelfde patroon als `room-header.mjs`'s
  // `formatCode()` (hergebruikt, niet gedupliceerd). Alleen cijfers, max 6.
  codeInput.addEventListener('input', () => {
    const digits = codeInput.value.replace(/\D/g, '').slice(0, 6);
    codeInput.value = formatCode(digits);
  });

  // Enter submit't, zelfde als een form-submit — er was nog geen handler.
  codeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      codeSubmitButton.click();
    }
  });

  // S03: een geplakte volledige join-URL (`/j/{inviteId}`) is geen 6-cijferige
  // code om te "extraheren" (die twee vormen zijn niet compatibel, zie de
  // toelichting in 06-start-en-join-polish.md) — bewuste keuze (a): een
  // herkende invite-link schakelt rechtstreeks door naar die flow in plaats
  // van te proberen er een code uit te lezen.
  codeInput.addEventListener('paste', (event) => {
    const pasted = event.clipboardData?.getData('text') ?? '';
    let pathname = null;
    try {
      pathname = new URL(pasted.trim()).pathname;
    } catch {
      return; // geen volledige URL geplakt — normale paste-afhandeling doet de rest
    }
    const route = resolveRoute(pathname);
    if (route.route === 'join') {
      event.preventDefault();
      onNavigate(`/j/${route.inviteId}`);
    }
  });

  codeSubmitButton.addEventListener('click', () => {
    const code = codeInput.value.replace(/\D/g, '');
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
    quickStartButton.textContent = t('home.quickStart');
    setButtonLoading(quickStartButton, { loading: state.status === 'creating', label: state.status === 'creating' ? t('home.creating') : null });
    divider.hidden = state.status === 'creating';
    codeLabel.hidden = state.status === 'creating';
    codeSubmitButton.hidden = state.status === 'creating';
    codeSubmitButton.textContent = t('home.codeSubmit');
    hostSetupLink.textContent = t('home.hostSetupLink');
    hostSetupLink.hidden = state.status === 'creating';
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
