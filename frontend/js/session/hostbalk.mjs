import { availableHostActions } from '../../../client/flow/host-controls-state.mjs';
import { secondsRemaining } from '../server-time.mjs';
import { hostActionSlot } from '../app-menu.mjs';

export function createHostBarController({ state, root, headerRoot, phaseContainer, roomHeaderRoot, hostBarRoot, hostBar, isHost }) {
  function restoreHostBarPosition() {
  if (headerRoot != null) {
    if (hostBarRoot.previousSibling !== roomHeaderRoot) {
      headerRoot.insertBefore(hostBarRoot, roomHeaderRoot.nextSibling);
    }
    return;
  }
  if (hostBarRoot.nextSibling !== phaseContainer) {
    root.insertBefore(hostBarRoot, phaseContainer);
  }
}



  function buildHostContext() {
  return {
    phase: state.matchPhase.phase,
    pacing: state.pacing,
    autoReveal: state.roomConfig?.autoReveal,
    // Fase 4 (autoReveal, besluit 51): puur lokaal — de server stuurt bij
    // autoReveal:false bewust GEEN fasewissel zodra de tijd om is (dat is
    // precies de fix), dus dit is het enige signaal dat "Toon antwoord" kan
    // laten verschijnen. `renderHostBar()` moet daarom ook op de
    // gameplay-ticker meelopen, niet alleen op serverevents (zie daar).
    roundExpired: state.roundModel.endsAt !== null && secondsRemaining(state.roundModel.startsAt, state.roundModel.endsAt, state.offsetMs) === 0,
    playerCount: state.playerCount,
    locked: state.locked,
  };
}



  function renderHostBar() {
  hostBar.update({
    isHost: isHost(),
    availableActions: availableHostActions(buildHostContext()),
    participants: state.participants,
    phase: state.matchPhase.phase,
  });
  plaatsHostmenu();
}



  function plaatsHostmenu() {
  const slot = hostActionSlot();
  if (slot === null) {
    return; // geen appheader (test, of een pagina zonder menu) — niets te doen
  }
  if (hostBar.menuPanel.parentNode !== slot) {
    slot.appendChild(hostBar.menuPanel);
  }
  const heeftHostmenu = isHost() && !hostBar.menuButton.hidden;
  hostBar.menuPanel.hidden = !heeftHostmenu;
  slot.hidden = !heeftHostmenu;
}



  function ruimHostmenuOp() {
  // D3: de hostbalk kijkt mee of het voorkeurenmenu sluit (om een half
  // ingezette bevestiging terug te zetten). Die waarnemer hangt aan het
  // menu, dat élke sessie overleeft — dus hier expliciet afkoppelen.
  hostBar.destroy();
  hostBar.menuPanel.remove();
  const slot = hostActionSlot();
  if (slot !== null) {
    slot.hidden = true;
  }
}



  return { restoreHostBarPosition, buildHostContext, renderHostBar, plaatsHostmenu, ruimHostmenuOp };
}
