import { transition as reconnectTransition, nextActionFor as reconnectNextAction } from '../../../client/flow/reconnect-state.mjs';
import { messageForConnectionStatus } from '../../../client/flow/edge-case-messaging.mjs';
import { createRoundaView } from '../views/rounda.mjs';

const RECOVERED_MESSAGE_MS = 3000;
// S19: hoelang onafgebroken disconnected/reconnecting vóór de terugvalknop
// verschijnt. Geen brondocumentwaarde hiervoor — 8-10s uit de prompt, 9s als
// middelste keuze.
const RECONNECT_FALLBACK_MS = 9000;

export function createConnectionController({ state, banner, answerSavedNote, reconnectRoundaRoot, reconnectFallbackButton, t, tCount, requestFreshSnapshot }) {
  let reconnectRoundaView = null;

  function handleStatus(status) {
  // Vóór de transitie vastleggen: `state.reconnect.status` ná de transitie is bij
  // 'connected' altijd 'connected', dus dat vertelt niet meer of dit de
  // állereerste verbinding was of een herstel ná een echte disconnect.
  const wasDown = state.reconnect.status === 'disconnected' || state.reconnect.status === 'reconnecting';

  if (status === 'connecting') {
    state.reconnect = reconnectTransition(state.reconnect, { type: 'RECONNECT_ATTEMPT_STARTED' });
  } else if (status === 'connected') {
    state.reconnect = reconnectTransition(state.reconnect, { type: 'RECONNECT_SUCCEEDED' });
    if (wasDown) {
      showRecoveredMessage();
    }
  } else if (status === 'disconnected') {
    state.reconnect = reconnectTransition(state.reconnect, { type: 'DISCONNECTED' });
    // Een nieuwe disconnect wint altijd van een nog zichtbare
    // hersteld-melding van een vorige, kortstondige state.reconnect.
    cancelRecoveredMessage();
  }

  // S19: terugvalroute. Start de klok zodra we niet (meer) `connected` zijn
  // en er nog geen klok loopt of knop zichtbaar is; annuleer 'm zodra we
  // weer `connected` zijn. Forceert zelf niets — de transportlaag blijft
  // zelf de enige die opnieuw `connect()` aanroept.
  if (state.reconnect.status === 'connected') {
    cancelReconnectFallback();
  } else if (state.reconnectFallbackTimer === null && !state.reconnectFallbackVisible) {
    scheduleReconnectFallback();
  }

  renderBanner();

  const action = reconnectNextAction(state.reconnect);
  if (action?.type === 'request-snapshot') {
    state.reconnect = reconnectTransition(state.reconnect, { type: 'SNAPSHOT_REQUEST_SENT' });
    requestFreshSnapshot();
  }
}



  function scheduleReconnectFallback() {
  state.reconnectFallbackTimer = setTimeout(() => {
    state.reconnectFallbackTimer = null;
    state.reconnectFallbackVisible = true;
    renderBanner();
  }, RECONNECT_FALLBACK_MS);
}



  function cancelReconnectFallback() {
  clearTimeout(state.reconnectFallbackTimer);
  state.reconnectFallbackTimer = null;
  state.reconnectFallbackVisible = false;
}



  function showRecoveredMessage() {
  clearTimeout(state.recoveredMessageTimer);
  state.showingRecoveredMessage = true;
  renderBanner();
  state.recoveredMessageTimer = setTimeout(() => {
    state.recoveredMessageTimer = null;
    state.showingRecoveredMessage = false;
    renderBanner();
  }, RECOVERED_MESSAGE_MS);
}



  function cancelRecoveredMessage() {
  clearTimeout(state.recoveredMessageTimer);
  state.recoveredMessageTimer = null;
  state.showingRecoveredMessage = false;
}



  function renderBanner() {
  if (state.showingRecoveredMessage) {
    banner.hidden = false;
    banner.classList.remove('is-disconnected');
    // M2/E15: korte, stille successtransitie i.p.v. een instante
    // kleurwissel — "successcue klein", geen viering (06 §4 E15).
    banner.classList.add('session-banner-success');
    banner.textContent = t('connection.connected');
  } else {
    const key = messageForConnectionStatus(state.reconnect.status);
    banner.hidden = key === null;
    banner.classList.toggle('is-disconnected', state.reconnect.status === 'disconnected');
    banner.classList.remove('session-banner-success');
    if (key !== null) {
      // M2/E15: voortgang tonen tijdens reconnecting — `state.reconnect.attempt`
      // bestond al (state.reconnect-state.mjs) maar werd nergens getoond.
      // Nieuwe, aparte sleutel (niet `connection.reconnecting` zelf
      // gewijzigd, die is al door thema 4 uitgevoerd) — coördinatiepunt,
      // zie PROGRESS.md.
      banner.textContent =
        state.reconnect.status === 'reconnecting' && state.reconnect.attempt >= 1
          ? tCount('connection.reconnectingAttempt', state.reconnect.attempt)
          : t(key);
    }
  }

  // Geruststelling naast (niet in plaats van) de disconnected-tekst — en
  // alleen als er ook echt een geaccepteerd antwoord is, niet zomaar op
  // basis van de fase (reviewfeedback T4-2 punt 3: fase alleen bewijst
  // niet dat dít antwoord is aangekomen).
  answerSavedNote.hidden = !(state.reconnect.status === 'disconnected' && state.roundModel.answerStatus === 'accepted');
  if (!answerSavedNote.hidden) {
    answerSavedNote.textContent = t('connection.answerSaved');
  }

  // BOUWSPRINT/Rounda: state.reconnect is per definitie een wachtmoment, nooit
  // tegelijk met een actieve ronde-interactie — mount/unmount lazily,
  // de statustekst hierboven blijft de aria-live-bron.
  const showReconnectRounda = !state.showingRecoveredMessage && (state.reconnect.status === 'disconnected' || state.reconnect.status === 'reconnecting');
  reconnectRoundaRoot.hidden = !showReconnectRounda;
  if (showReconnectRounda && reconnectRoundaView === null) {
    reconnectRoundaView = createRoundaView({ root: reconnectRoundaRoot });
  } else if (!showReconnectRounda && reconnectRoundaView !== null) {
    reconnectRoundaView.destroy();
    reconnectRoundaView = null;
    reconnectRoundaRoot.textContent = '';
  }

  // S19: pas tonen als de klok echt is afgelopen (`state.reconnectFallbackVisible`)
  // én we nog steeds niet verbonden zijn — een ondertussen geslaagd herstel
  // annuleert de klok al in `handleStatus`, maar dit is de render-kant van
  // diezelfde voorwaarde.
  reconnectFallbackButton.hidden = !(state.reconnectFallbackVisible && state.reconnect.status !== 'connected');
  if (!reconnectFallbackButton.hidden) {
    reconnectFallbackButton.textContent = t('join.retry');
  }
}



  function destroy() {
    cancelRecoveredMessage();
    cancelReconnectFallback();
    if (reconnectRoundaView !== null) {
      reconnectRoundaView.destroy();
      reconnectRoundaView = null;
      reconnectRoundaRoot.textContent = '';
    }
  }

  return { handleStatus, renderBanner, cancelRecoveredMessage, cancelReconnectFallback, destroy };
}
