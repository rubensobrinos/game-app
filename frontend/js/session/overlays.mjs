import { messageForPauseReason } from '../../../client/flow/edge-case-messaging.mjs';
import { createRoundaView } from '../views/rounda.mjs';

export function createOverlayController({ state, pauseOverlay, pauseCardWrap, pauseCard, pauseRoundaRoot, hostBarRoot, hostBar, t, isHost, restoreHostBarPosition }) {
  let pauseRoundaView = null;

  function renderPauseOverlay() {
  if (state.matchPhase.phase !== 'PAUSED') {
    pauseOverlay.hidden = true;
    restoreHostBarPosition();
    if (pauseRoundaView !== null) {
      pauseRoundaView.destroy();
      pauseRoundaView = null;
      pauseRoundaRoot.textContent = '';
    }
    return;
  }
  const wasHidden = pauseOverlay.hidden;
  const reasonText = t(messageForPauseReason(state.matchPhase.pausedState?.reason));
  pauseOverlay.hidden = false;
  // Host ziet een stempel i.p.v. de kalme spelerszin — geen aparte staat om
  // te bouwen, alleen andere tekst op hetzelfde element (T4-5).
  const hostText = t('pause.hostStamp');
  const cardText = isHost() ? hostText : reasonText;
  pauseOverlay.setAttribute('aria-label', cardText);
  pauseCard.textContent = cardText;
  pauseCard.classList.toggle('session-pause-card-host-stamp', isHost());
  // BOUWSPRINT/Rounda: alleen voor de speler — de host heeft de hostbalk
  // hier (zie hieronder), geen leeg wachtmoment.
  pauseRoundaRoot.hidden = isHost();
  if (!isHost() && pauseRoundaView === null) {
    pauseRoundaView = createRoundaView({ root: pauseRoundaRoot });
  } else if (isHost() && pauseRoundaView !== null) {
    pauseRoundaView.destroy();
    pauseRoundaView = null;
    pauseRoundaRoot.textContent = '';
  }
  // S16: de overlay dekt het scherm (position: fixed, inset: 0) en zit vóór
  // de hostbalk in de DOM — die is dus onbereikbaar zolang de overlay open
  // is. In plaats van losse duplicaatknoppen voor lock/kick/finish (zoals
  // eerder alleen voor hervatten) verplaatsen we de bestaande hostBar-node
  // zelf ín de overlay: de host kan zo alles (pauzeren/hervatten,
  // vergrendelen, verwijderen, beëindigen) blijven doen zonder eerst te
  // hervatten. Een niet-host heeft sowieso geen hostbalk (bar.hidden), dus
  // voor hen verandert er niets zichtbaars.
  if (isHost()) {
    pauseCardWrap.appendChild(hostBarRoot);
  } else {
    restoreHostBarPosition();
  }
  // Alleen bij het daadwerkelijk openen focus verplaatsen, niet bij elke
  // her-render terwijl 'm al open staat (bv. een taalwissel tijdens pauze
  // zou anders de focus steeds wegkapen).
  if (wasHidden) {
    pauseCardWrap.focus();
  }
}



  function destroy() {
    if (pauseRoundaView !== null) {
      pauseRoundaView.destroy();
      pauseRoundaView = null;
      pauseRoundaRoot.textContent = '';
    }
  }

  return { renderPauseOverlay, destroy };
}
