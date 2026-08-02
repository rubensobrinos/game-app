// session-shell.mjs — UI1b-kern. Eigenaar van de socketverbinding en alle
// reducers die een lopende sessie (`/host/{code}`, `/game/{code}`) nodig
// heeft: `match-phase-state` (fase), `reconnect-state` (verbindingsstatus),
// en `round-model` (rondedata, UI3, lokaal — bewust geen client/flow). Mount/
// unmount zelf de faseafhankelijke schermmodule (lobby/gameplay/scoreboard/
// podium, via `view-switcher.viewFor()`) en tekent daar twee dingen overheen
// die geen eigen route hebben: de reconnect-statusbalk en de pauze-overlay
// met reden (HANDOFF-UI UI-2, DECISIONS.md #11).
//
// Deelnemerslijst (lobby): `match-phase-state` bewaart bewust geen spelers-
// lijst. `room:state` geeft alleen `self` + `playerCount`; namen van andere
// spelers komen pas binnen via `room:player-changed`-deltas ná het moment van
// verbinden. Een joiner die een lobby met bestaande spelers binnenkomt ziet
// dus wél het juiste aantal, maar niet meteen ieders naam — dat is een
// PROTOCOL.md-gat, geen bug hier (zie HANDOFF-UI).
//
// Reconnect: de transportlaag doet zelf de backoff en meldt alleen de status
// (transport-contract-response.md, correctie 2) — dit bestand roept dus NOOIT
// zelf opnieuw `transport.connect()` aan na een disconnect. `reconnect-state`
// wordt hier uitsluitend gebruikt om 1) de statusbalk te vullen
// (`messageForConnectionStatus`) en 2) te weten wanneer een verse snapshot
// opgevraagd moet worden ná een geslaagde reconnect (`nextActionFor` →
// `request-snapshot`, PROTOCOL.md §Reconnect punt 5 — snapshot boven events).

import { initialMatchPhaseState, applyServerEvent } from '../../client/flow/match-phase-state.mjs';
import {
  initialReconnectState,
  transition as reconnectTransition,
  nextActionFor as reconnectNextAction,
} from '../../client/flow/reconnect-state.mjs';
import { availableHostActions, hostActionRequest } from '../../client/flow/host-controls-state.mjs';
import {
  messageForConnectionStatus,
  messageForPauseReason,
  messageForSessionTermination,
  messageForErrorCode,
} from '../../client/flow/edge-case-messaging.mjs';
import { clearSession } from '../../client/flow/session-store.mjs';
import { shareOpenedMethodFor } from '../../client/flow/share-actions.mjs';
import { viewFor } from './view-switcher.mjs';
import { estimateServerOffset, secondsRemaining } from './server-time.mjs';
import {
  initialRoundModel,
  applyRoundStarted,
  selectOption,
  applyAnswerAccepted,
  applyAnswerRejected,
  applyProgress,
  applyRoundEnded,
} from './views/round-model.mjs';
import { standingsFrom } from './views/standings-model.mjs';
import { createLobbyView } from './views/lobby.mjs';
import { createGameplayView } from './views/gameplay.mjs';
import { createScoreboardView } from './views/scoreboard.mjs';
import { createPodiumView } from './views/podium.mjs';

const GAMEPLAY_TICK_MS = 250;

export function createSessionShell({ root, t, transport, storage, code, isHostRoute, session, onLeaveHome }) {
  root.textContent = '';

  const banner = document.createElement('p');
  banner.className = 'session-banner';
  banner.hidden = true;
  banner.setAttribute('aria-live', 'assertive');
  banner.setAttribute('aria-atomic', 'true');

  // Minimale hosttoggle, vooruitlopend op UI5's volledige hostbalk (lock/kick/
  // finish/next): zonder dít bestaat er geen enkele weg om de pauze-overlay
  // (hieronder) ooit te bereiken. Bewust alleen pause/resume, niets anders —
  // de rest blijft UI5-werk.
  const hostPauseButton = document.createElement('button');
  hostPauseButton.type = 'button';
  hostPauseButton.className = 'btn-secondary session-host-pause';
  hostPauseButton.hidden = true;
  hostPauseButton.addEventListener('click', () => {
    const action = pausableAction();
    if (action !== null) {
      sendHostAction(action);
    }
  });

  // `.screen` hier en niet in gameplay.mjs/scoreboard.mjs/podium.mjs zelf: die
  // schrijven puur naar de `root` die ze krijgen (UI3/UI4-patroon), dus de
  // layout (padding/centrering, UI-5's visuele eenheid) hoort bij wie mount,
  // niet bij elke view apart.
  const phaseContainer = document.createElement('div');
  phaseContainer.className = 'screen screen-top';

  const pauseOverlay = document.createElement('div');
  pauseOverlay.className = 'session-pause-overlay';
  pauseOverlay.hidden = true;
  // Modale dialoog, zelfde discipline als app-menu.mjs's paneel en
  // lobby.mjs's QR-overlay: rol + label voor een screenreader, en Escape
  // sluit 'm — maar alleen voor de host, want alleen de host kán hervatten.
  // Een niet-host ziet dezelfde overlay zonder ontsnapping (moet wachten),
  // dus daar doet Escape bewust niets.
  pauseOverlay.setAttribute('role', 'dialog');
  pauseOverlay.setAttribute('aria-modal', 'true');
  const pauseCardWrap = document.createElement('div');
  pauseCardWrap.className = 'session-pause-card';
  pauseCardWrap.tabIndex = -1; // focustarget voor een niet-host (geen knop om op te focussen)
  const pauseCard = document.createElement('p');
  // De overlay dekt het hele scherm (position: fixed, inset: 0) en zit vóór
  // `hostPauseButton` in de DOM — die knop is dus onbereikbaar zolang de
  // overlay open is. De host hervat daarom vanuit de overlay zelf, niet door
  // "erlangs" te klikken op de knop erachter.
  const pauseResumeButton = document.createElement('button');
  pauseResumeButton.type = 'button';
  pauseResumeButton.className = 'btn-primary session-pause-resume';
  pauseResumeButton.hidden = true;
  pauseResumeButton.addEventListener('click', () => {
    sendHostAction('resume');
    hostPauseButton.focus();
  });
  pauseCardWrap.append(pauseCard, pauseResumeButton);
  pauseOverlay.appendChild(pauseCardWrap);
  pauseOverlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isHost()) {
      event.stopPropagation();
      sendHostAction('resume');
      hostPauseButton.focus();
    }
  });

  root.append(banner, hostPauseButton, phaseContainer, pauseOverlay);

  let matchPhase = initialMatchPhaseState();
  let reconnect = initialReconnectState();
  let roundModel = initialRoundModel();
  let standingsPayload = null;
  let participants = new Map();
  let playerCount = 0;
  let selfInfo = null; // { roles, playerId, effectiveName } uit room:state
  let joinUrl = '';
  let offsetMs = 0;
  let mountedViewName = null;
  let mountedView = null;
  let gameplayTimer = null;
  let terminated = false;

  const capabilities = { nativeShareAvailable: typeof navigator !== 'undefined' && 'share' in navigator };

  measureOffset();
  const socket = transport.connect(session.sessionToken, {
    onEvent: handleEvent,
    onStatus: handleStatus,
  });

  async function measureOffset() {
    const samples = [];
    for (let i = 0; i < 3; i += 1) {
      const requestSentAt = Date.now();
      try {
        const { serverTime } = await transport.fetchServerTime();
        samples.push({ requestSentAt, serverTime, responseReceivedAt: Date.now() });
      } catch {
        // Servertijd is best-effort (server-time.mjs) — een mislukte meting
        // laat offsetMs gewoon op zijn vorige (of standaard 0) waarde staan.
      }
    }
    if (samples.length > 0) {
      offsetMs = estimateServerOffset(samples);
    }
  }

  function isHost() {
    return selfInfo?.roles?.includes('host') === true;
  }

  function handleStatus(status) {
    if (status === 'connecting') {
      reconnect = reconnectTransition(reconnect, { type: 'RECONNECT_ATTEMPT_STARTED' });
    } else if (status === 'connected') {
      reconnect = reconnectTransition(reconnect, { type: 'RECONNECT_SUCCEEDED' });
    } else if (status === 'disconnected') {
      reconnect = reconnectTransition(reconnect, { type: 'DISCONNECTED' });
    }
    renderBanner();

    const action = reconnectNextAction(reconnect);
    if (action?.type === 'request-snapshot') {
      reconnect = reconnectTransition(reconnect, { type: 'SNAPSHOT_REQUEST_SENT' });
      requestFreshSnapshot();
    }
  }

  async function requestFreshSnapshot() {
    try {
      const snapshot = await transport.fetchState(code, session.sessionToken);
      handleEvent({ event: 'room:state', payload: snapshot });
    } catch {
      // Een mislukte snapshotaanvraag blokkeert de rest van de UI niet — de
      // eerstvolgende serverevent of hertoegang herstelt vanzelf.
    }
  }

  function renderBanner() {
    const key = messageForConnectionStatus(reconnect.status);
    banner.hidden = key === null;
    banner.classList.toggle('is-disconnected', reconnect.status === 'disconnected');
    if (key !== null) {
      banner.textContent = t(key);
    }
  }

  function renderPauseOverlay() {
    if (matchPhase.phase !== 'PAUSED') {
      pauseOverlay.hidden = true;
      return;
    }
    const wasHidden = pauseOverlay.hidden;
    const reasonText = t(messageForPauseReason(matchPhase.pausedState?.reason));
    pauseOverlay.hidden = false;
    pauseOverlay.setAttribute('aria-label', reasonText);
    pauseCard.textContent = reasonText;
    // De overlay dekt het scherm, dus `hostPauseButton` (erachter) is nu
    // onbereikbaar — de host hervat vanuit de overlay zelf.
    pauseResumeButton.hidden = !isHost();
    pauseResumeButton.textContent = t('session.resume');
    // Alleen bij het daadwerkelijk openen focus verplaatsen, niet bij elke
    // her-render terwijl 'm al open staat (bv. een taalwissel tijdens pauze
    // zou anders de focus steeds wegkapen).
    if (wasHidden) {
      (isHost() ? pauseResumeButton : pauseCardWrap).focus();
    }
  }

  function pausableAction() {
    if (!isHost() || matchPhase.phase === 'PAUSED') {
      return null;
    }
    const context = { phase: matchPhase.phase, pacing: pacingFor(), playerCount, locked: false };
    return availableHostActions(context).includes('pause') ? 'pause' : null;
  }

  function renderHostPauseButton() {
    const action = pausableAction();
    hostPauseButton.hidden = action === null;
    if (action !== null) {
      hostPauseButton.textContent = t('session.pause');
    }
  }

  function handleEvent(envelope) {
    if (terminated) {
      return;
    }

    matchPhase = applyServerEvent(matchPhase, envelope);

    switch (envelope.event) {
      case 'room:state':
        applyRoomState(envelope.payload);
        break;
      case 'room:player-changed':
        applyPlayerChanged(envelope.payload);
        break;
      case 'round:started':
        roundModel = applyRoundStarted(envelope.payload);
        break;
      case 'round:answer-accepted':
        roundModel = applyAnswerAccepted(roundModel, envelope.payload);
        break;
      case 'round:progress':
        roundModel = applyProgress(roundModel, envelope.payload);
        break;
      case 'round:ended':
        roundModel = applyRoundEnded(roundModel, envelope.payload);
        break;
      case 'scoreboard:updated':
      case 'game:finished':
        standingsPayload = envelope.payload;
        break;
      case 'session:kicked':
        terminate(messageForSessionTermination('kicked', envelope.payload?.reason));
        return;
      case 'session:revoked':
        terminate(messageForSessionTermination('revoked', envelope.payload?.reason));
        return;
      default:
        break;
    }

    renderPauseOverlay();
    renderHostPauseButton();
    routeToView();
  }

  function applyRoomState(payload) {
    const room = payload?.room ?? {};
    playerCount = typeof room.playerCount === 'number' ? room.playerCount : playerCount;
    joinUrl = typeof room.joinUrl === 'string' ? room.joinUrl : joinUrl;
    if (payload?.self && typeof payload.self.playerId === 'string') {
      selfInfo = payload.self;
      participants.set(payload.self.playerId, payload.self.effectiveName ?? '');
    } else if (payload?.self) {
      selfInfo = payload.self; // host zonder spelersrol: roles wel bekend, playerId null
    }
  }

  function applyPlayerChanged(payload) {
    if (typeof payload?.playerCount === 'number') {
      playerCount = payload.playerCount;
    }
    const delta = payload?.delta;
    if (delta === null || typeof delta !== 'object') {
      return;
    }
    if (delta.type === 'join' || delta.type === 'rename') {
      if (typeof delta.playerId === 'string') {
        participants.set(delta.playerId, delta.effectiveName ?? '');
      }
    } else if (delta.type === 'leave' || delta.type === 'kick') {
      if (typeof delta.playerId === 'string') {
        participants.delete(delta.playerId);
      }
    }
  }

  function terminate(message) {
    terminated = true;
    stopGameplayTicker();
    socket.close();
    clearSession(storage, code);
    root.textContent = '';
    const screen = document.createElement('div');
    screen.className = 'screen session-terminated';
    const text = document.createElement('p');
    text.textContent = message;
    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'btn-primary';
    backButton.textContent = t('join.retry');
    backButton.addEventListener('click', onLeaveHome);
    screen.append(text, backButton);
    root.appendChild(screen);
  }

  function routeToView() {
    if (terminated) {
      return;
    }
    const viewName = viewFor({
      route: isHostRoute ? 'host' : 'game',
      phase: matchPhase.phase,
      pausedState: matchPhase.pausedState,
    });

    if (viewName !== mountedViewName) {
      mountView(viewName);
    }
    updateMountedView(viewName);
  }

  function mountView(viewName) {
    stopGameplayTicker();
    phaseContainer.textContent = '';
    mountedViewName = viewName;

    if (viewName === 'lobby') {
      mountedView = createLobbyView({
        root: phaseContainer,
        t,
        isHost: isHost(),
        gameCode: code,
        onStart: () => sendHostAction('start'),
        onShareAction: (action) => sendShareOpened(action),
      });
      return;
    }
    if (viewName === 'gameplay') {
      mountedView = createGameplayView({ root: phaseContainer, t, onAnswer: sendAnswer });
      startGameplayTicker();
      return;
    }
    if (viewName === 'scoreboard') {
      mountedView = createScoreboardView({ root: phaseContainer, t });
      return;
    }
    if (viewName === 'podium') {
      mountedView = createPodiumView({
        root: phaseContainer,
        t,
        isHost: isHost(),
        onRematch: () => sendHostAction('rematch'),
      });
      return;
    }
    mountedView = null;
    const placeholder = document.createElement('p');
    placeholder.dataset.i18n = 'scaffold.ready';
    placeholder.textContent = t('scaffold.ready');
    phaseContainer.appendChild(placeholder);
  }

  function updateMountedView(viewName) {
    if (mountedView === null) {
      return;
    }
    if (viewName === 'lobby') {
      const context = { phase: matchPhase.phase, pacing: pacingFor(), playerCount, locked: false };
      mountedView.update({
        playerCount,
        participants,
        canStart: availableHostActions(context).includes('start'),
        capabilities,
        joinUrl,
      });
      return;
    }
    if (viewName === 'gameplay') {
      mountedView.update(roundModel, { secondsLeft: secondsRemaining(roundModel.startsAt, roundModel.endsAt, offsetMs) });
      return;
    }
    if (viewName === 'scoreboard' || viewName === 'podium') {
      mountedView.update(standingsFrom(standingsPayload ?? {}));
    }
  }

  function pacingFor() {
    // room.config wordt niet los bewaard door match-phase-state (bewust, zie
    // module-comment); voor de enige plek die pacing nodig heeft (de
    // start-knop bestaat sowieso al in LOBBY, dus pacing doet er dan nog niet
    // toe) volstaat 'auto' als neutrale default.
    return 'auto';
  }

  function startGameplayTicker() {
    stopGameplayTicker();
    gameplayTimer = setInterval(() => {
      if (mountedViewName === 'gameplay' && mountedView !== null) {
        mountedView.update(roundModel, { secondsLeft: secondsRemaining(roundModel.startsAt, roundModel.endsAt, offsetMs) });
      }
    }, GAMEPLAY_TICK_MS);
  }

  function stopGameplayTicker() {
    if (gameplayTimer !== null) {
      clearInterval(gameplayTimer);
      gameplayTimer = null;
    }
  }

  async function sendAnswer(optionId) {
    roundModel = selectOption(roundModel, optionId);
    updateMountedView('gameplay');
    try {
      await socket.send('round:answer', randomActionId(), {
        roundId: roundModel.roundId,
        answer: { optionId },
        clientAnsweredAt: Date.now(),
      });
      // Acceptatie komt via het `round:answer-accepted`-event (handleEvent),
      // niet hier — dat voorkomt dat twee plekken dezelfde overgang doen.
    } catch (err) {
      roundModel = applyAnswerRejected(roundModel, err?.code ?? messageForErrorCode(err?.code));
      updateMountedView('gameplay');
    }
  }

  async function sendHostAction(action) {
    const context = { phase: matchPhase.phase, pacing: pacingFor(), playerCount, locked: false };
    const request = hostActionRequest(action, context);
    if (request === null) {
      return;
    }
    try {
      await socket.send(request.event, randomActionId(), request.payload);
    } catch {
      // Geen host-foutkanaal in UI2/UI1b-scope; de eerstvolgende serverevent
      // (of het uitblijven van de faseovergang) is hier het enige signaal.
      // Een expliciete foutmelding voor hostacties is UI5-werk (hostbalk).
    }
  }

  function sendShareOpened(action) {
    const method = shareOpenedMethodFor(action);
    if (method === null) {
      return;
    }
    // Analytics-only (PROTOCOL.md): mag falen zonder UX-effect, dus geen catch-UI nodig.
    socket.send('share:opened', randomActionId(), { method }).catch(() => {});
  }

  return {
    render() {
      renderBanner();
      renderPauseOverlay();
      renderHostPauseButton();
      if (mountedViewName !== null) {
        mountView(mountedViewName);
        updateMountedView(mountedViewName);
      }
    },
    destroy() {
      terminated = true;
      stopGameplayTicker();
      socket.close();
    },
  };
}

function randomActionId() {
  return globalThis.crypto.randomUUID();
}

// Zelfde vier waarden als `share-actions.shareOpenedMethodFor` — hier
// herhaald zou dubbele logica zijn; in plaats daarvan hergebruikt via een
// kleine lokale import om `lobby.mjs`'s callback (de kale actie-naam) te
// vertalen zonder dat session-shell zelf de deel-UI kent.
import { shareOpenedMethodFor as shareOpenedMethodForAction } from '../../client/flow/share-actions.mjs';
