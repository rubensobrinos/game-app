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

import { initialMatchPhaseState } from '../../client/flow/match-phase-state.mjs';
import { initialReconnectState } from '../../client/flow/reconnect-state.mjs';
import { availableHostActions, hostActionRequest } from '../../client/flow/host-controls-state.mjs';
import { messageForErrorCode } from '../../client/flow/edge-case-messaging.mjs';
import { clearSession } from '../../client/flow/session-store.mjs';
import { createErrorState } from './state-message.mjs';
import { shareOpenedMethodFor } from '../../client/flow/share-actions.mjs';
import { viewFor } from './view-switcher.mjs';
import { estimateServerOffset, secondsRemaining } from './server-time.mjs';
import { initialRoundModel, selectOption, selectChoice, selectSide, selectCard, answerPayloadFor, applyAnswerRejected } from './views/round-model.mjs';
import { initialStreakModel } from './views/streak-model.mjs';
import { loadReactionsEnabled } from './preferences.mjs';
import { getLang } from './i18n.mjs';
import { standingsFrom, rankMovementFrom } from './views/standings-model.mjs';
import { createRoomHeader } from './views/room-header.mjs';
import { createLobbyView } from './views/lobby.mjs';
import { createGameplayView } from './views/gameplay.mjs';
import { createScoreboardView } from './views/scoreboard.mjs';
import { createPodiumView } from './views/podium.mjs';
import { createHostBar } from './views/hostbar.mjs';
import { createConnectionController } from './session/verbinding.mjs';
import { createHostBarController } from './session/hostbalk.mjs';
import { createOverlayController } from './session/overlays.mjs';
import { createEventController } from './session/events.mjs';

const GAMEPLAY_TICK_MS = 250;
// Fase 3 (agent 1, F1/F2): begrensde retry voor `requestFreshSnapshot()` bij
// een niet-terminale fout (vrijwel altijd `NETWORK_ERROR` — zie de toelichting
// daar). Zonder deze retry liet één netwerkhapering op precies déze aanroep
// het scherm permanent leeg staan: de socket zelf verbond soms gewoon in één
// keer, dus `reconnect.status` bleef 'connected' en er kwam nooit een nieuwe
// aanleiding om het opnieuw te proberen.
const SNAPSHOT_RETRY_DELAYS_MS = [1000, 2000, 4000];

// Codes waarbij een opgeslagen sessie principieel niet meer bruikbaar is —
// verder proberen (reconnect, opnieuw snapshot ophalen) heeft geen zin, de
// enige zinvolle actie is terug naar start. Zie 08 §6 "roomfouten": elke rij
// in die tabel heeft precies deze twee eigenschappen (specifieke tekst +
// terugkeeractie), wat hier voor de verbindings-/sessiekant van die tabel
// geldt (ROOM_LOCKED/GAME_FULL/LATE_JOIN_DISABLED horen niet hier: die zijn
// alleen relevant bij een póging tot join, niet bij een al bestaande sessie).
const TERMINAL_SNAPSHOT_ERROR_CODES = new Set([
  'GAME_NOT_FOUND',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'SESSION_REVOKED',
]);

export function createSessionShell({ root, headerRoot, t, tCount, transport, storage, code, isHostRoute, session, onLeaveHome }) {
  root.textContent = '';

  // S05/D-018/D-019: de code + QR staan permanent in `#app-header` (buiten
  // `#app-root`, overleeft dus geen route-wissel vanzelf) zolang déze sessie
  // loopt — session-shell.mjs mount daarom zijn eigen kindnode in de
  // meegegeven `headerRoot`, net zoals het al `hostBarRoot` binnen `root`
  // doet, en ruimt 'm zelf weer op (`destroy()`/`terminate()`). Geen
  // `headerRoot` (bv. in een test zonder appheader) is geen fout — gewoon
  // niets te mounten.
  const roomHeaderRoot = document.createElement('div');
  roomHeaderRoot.className = 'room-header-slot';
  const roomHeader = createRoomHeader({
    root: roomHeaderRoot,
    t,
    gameCode: code,
    joinUrl: '',
    onShareAction: (action) => sendShareOpened(action),
  });
  if (headerRoot != null) {
    headerRoot.insertBefore(roomHeaderRoot, headerRoot.firstChild);
  }

  const banner = document.createElement('p');
  banner.className = 'session-banner';
  banner.hidden = true;
  banner.setAttribute('aria-live', 'assertive');
  banner.setAttribute('aria-atomic', 'true');

  // BOUWSPRINT/Rounda: "overal waar je wacht" — de statustekst blijft de
  // aria-live-bron (niet vervangen, alleen aangevuld), Rounda geeft de
  // wachttijd tijdens een reconnect iets om naar te kijken. Decoratief:
  // geen eigen aankondiging, `banner` draagt de tekst al.
  const reconnectRoundaRoot = document.createElement('div');
  reconnectRoundaRoot.className = 'session-reconnect-rounda';
  reconnectRoundaRoot.hidden = true;
  reconnectRoundaRoot.setAttribute('aria-hidden', 'true');

  // Geruststelling naast (nooit in plaats van) de disconnected-tekst — eigen
  // element, want de twee kunnen tegelijk zichtbaar zijn.
  const answerSavedNote = document.createElement('p');
  answerSavedNote.className = 'session-answer-saved';
  answerSavedNote.hidden = true;

  // S19: geen nieuwe reconnectpoging forceren (de transportlaag doet dat al
  // zelf, HANDOFF-afspraak) — alleen een terugvalroute als het écht te lang
  // duurt. Zelfde knop/actie als `terminate()`'s `join.retry`-knop hieronder:
  // "terug naar start" via `onLeaveHome`, niet een letterlijke retry.
  const reconnectFallbackButton = document.createElement('button');
  reconnectFallbackButton.type = 'button';
  reconnectFallbackButton.className = 'btn-secondary session-reconnect-fallback';
  reconnectFallbackButton.hidden = true;
  reconnectFallbackButton.addEventListener('click', onLeaveHome);

  // Randgeval "dubbele tab" (03 §7, prompt 05): gereproduceerd tegen
  // transport-mock.mjs — een tweede `connect()` met dezelfde sessionToken
  // overschrijft stilzwijgend de listener-entry van de eerste tab
  // (`room.listeners.set(sessionToken, ...)`), waardoor de EERSTE tab nooit
  // meer een event ontvangt zonder dat 'ie dat zelf weet. Er is geen
  // betrouwbare manier om dit client-side te detecteren zonder een
  // cross-tab-mechanisme — dit is een VOORSTEL (00-DESIGN-INDEX.md §6 punt 9),
  // geen stilzwijgend besluit: `BroadcastChannel` (browser-native, geen
  // nieuwe dependency) laat elke tab zijn opening aankondigen; een tab die
  // een latere aankondiging voor dezelfde sessie ziet, toont deze banner
  // i.p.v. stil door te blijven draaien alsof niets gebeurd is. Lost de
  // onderliggende Map-overschrijving niet op (dat is transportlaag-gedrag,
  // niet aanraken) — maakt 'm alleen zichtbaar voor wie het overkomt.
  const duplicateTabNotice = document.createElement('p');
  duplicateTabNotice.className = 'session-duplicate-tab';
  duplicateTabNotice.hidden = true;
  duplicateTabNotice.setAttribute('role', 'status');
  const tabId = globalThis.crypto.randomUUID();
  const tabClaimedAt = Date.now();
  const tabChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`rounda-session-${code}`) : null;
  tabChannel?.addEventListener('message', (event) => {
    const claim = event.data;
    if (
      claim !== null &&
      typeof claim === 'object' &&
      claim.tabId !== tabId &&
      typeof claim.claimedAt === 'number' &&
      claim.claimedAt > tabClaimedAt
    ) {
      duplicateTabNotice.hidden = false;
      duplicateTabNotice.textContent = t('session.duplicateTab');
    }
  });
  tabChannel?.postMessage({ tabId, claimedAt: tabClaimedAt });

  // UI5: de hostbalk (pauzeren/hervatten, vergrendelen, spelers verwijderen,
  // handmatig volgende ronde bij hostgestuurde pacing). Vervangt de eerdere
  // minimale pauze-only-knop die er stond vooruitlopend op dit werk.
  const hostBarRoot = document.createElement('div');
  // A1 (#45/#46): de hostknoppen stonden op een eigen rij ín het scherm — die
  // rij kostte ~72 px vóór de vraag begon en liet de pauzeknop los boven de
  // inhoud zweven. De mount blijft hier (deze `createHostBar`-aanroep en
  // `sendHostAction` zijn ongewijzigd); alleen de plek in de DOM verhuist naar
  // de chromerij, zie `restoreHostBarPosition()`. `display: contents` op deze
  // wrapper zodat `.session-hostbar` zelf een flex-item van de chrome wordt.
  hostBarRoot.className = 'session-hostbar-slot';
  const hostBar = createHostBar({
    root: hostBarRoot,
    t,
    // D3: de bevestiging van "Game beëindigen" noemt het aantal spelers, en
    // dat aantal is telbaar ("1 speler" / "8 spelers").
    tCount,
    onAction: (action, params) => sendHostAction(action, params),
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
  // BOUWSPRINT/Rounda: "zelfde dode moment, zelfde oplossing" — alleen voor
  // de speler (de host heeft de hostbalk in dit overlay, geen leeg wachten).
  const pauseRoundaRoot = document.createElement('div');
  pauseRoundaRoot.className = 'session-pause-rounda';
  pauseRoundaRoot.hidden = true;
  pauseCardWrap.append(pauseCard, pauseRoundaRoot);
  pauseOverlay.appendChild(pauseCardWrap);
  pauseOverlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isHost()) {
      event.stopPropagation();
      sendHostAction('resume');
      hostBar.focusPause();
    }
  });

  root.append(banner, reconnectRoundaRoot, answerSavedNote, duplicateTabNotice, reconnectFallbackButton, phaseContainer, pauseOverlay);

  const state = {
    matchPhase: initialMatchPhaseState(),
    reconnect: initialReconnectState(),
    roundModel: initialRoundModel(),
    // 11-verzoek (BOUWSPRINT doel 4): sessieniveau, zie de toelichting bij
    // `round:ended` hieronder voor waarom dit niet in gameplay.mjs zelf kan.
    streakModel: initialStreakModel(),
    countdownEndsAt: null, // S07: alleen relevant tijdens matchPhase.phase === 'COUNTDOWN'
    standingsPayload: null,
    // S15/prompt 08: vorige `standingsFrom()`-uitkomst, voor `rankMovementFrom()`
    // (gedeeld met 07-reveal-en-sociale-headline.md's comeback-detectie, zelfde
    // vorige-versus-huidige-vergelijking). `null` tot de tweede stand binnenkomt.
    previousStandings: null,
    participants: new Map(),
    // Feedbackronde 4 aug: serverkleur per speler (join/recolor-delta's +
    // snapshot); aparte Map naast de namen zodat bestaande afnemers van
    // `participants` (hostbar, scoreboard) ongewijzigd blijven.
    participantColors: new Map(),
    // spelersidentiteit.md, stap 5: `{country, word}` per playerId, of `null`
    // voor een zelfgekozen naam — parallelle Map naast `participantColors`,
    // zelfde reden (bestaande afnemers van `participants` ongewijzigd).
    participantIdentities: new Map(),
    // Besluit 40 (scherm 2): de volledige actuele config — gevoed door
    // room:state en room:config-changed; de lobby-instellingen lezen hieruit.
    roomConfig: null,
    playerCount: 0,
    locked: false,
    pacing: 'auto',
    selfInfo: null, // { roles, playerId, effectiveName } uit room:state
    joinUrl: '',
    offsetMs: 0,
    mountedViewName: null,
    mountedView: null,
    gameplayTimer: null,
    terminated: false,
    // Vóór `transport.connect()` gedeclareerd, niet verderop bij
    // `showRecoveredMessage`: de mock roept `onStatus('connecting')` al
    // synchroon aan tijdens `connect()` zelf, dus `renderBanner()` (via
    // `handleStatus`) leest deze twee al vóórdat de rest van dit bestand is
    // uitgevoerd — anders een TDZ-`ReferenceError`.
    recoveredMessageTimer: null,
    showingRecoveredMessage: false,
    reconnectFallbackTimer: null,
    reconnectFallbackVisible: false,
  };

  const capabilities = { nativeShareAvailable: typeof navigator !== 'undefined' && 'share' in navigator };
  let socket = null;

  const hostBarController = createHostBarController({
    state,
    root,
    headerRoot,
    phaseContainer,
    roomHeaderRoot,
    hostBarRoot,
    hostBar,
    isHost,
  });
  const { restoreHostBarPosition, buildHostContext, renderHostBar, ruimHostmenuOp } = hostBarController;
  restoreHostBarPosition();

  const overlayController = createOverlayController({
    state,
    pauseOverlay,
    pauseCardWrap,
    pauseCard,
    pauseRoundaRoot,
    hostBarRoot,
    hostBar,
    t,
    isHost,
    restoreHostBarPosition,
  });
  const { renderPauseOverlay } = overlayController;

  const connectionController = createConnectionController({
    state,
    banner,
    answerSavedNote,
    reconnectRoundaRoot,
    reconnectFallbackButton,
    t,
    tCount,
    requestFreshSnapshot,
  });
  const { handleStatus, renderBanner, cancelRecoveredMessage, cancelReconnectFallback } = connectionController;

  const eventController = createEventController({
    state,
    roomHeader,
    renderBanner,
    renderPauseOverlay,
    renderHostBar,
    routeToView,
    onLeaveHome,
    terminate,
    isEmptyFinish,
  });
  const { handleEvent } = eventController;

  measureOffset();
  socket = transport.connect(session.sessionToken, {
    onEvent: handleEvent,
    onStatus: handleStatus,
  });
  // EERSTE VERBINDING (fix 3 aug 2026, live-test producteigenaar): de
  // state.reconnect-machine start als `connected` zonder `pendingSnapshotRequest`,
  // dus `nextActionFor` vraagt bij de allereerste verbinding NOOIT een
  // snapshot aan — die regel dekt alleen HER-verbindingen (PROTOCOL.md
  // §Reconnect stap 5). De server pusht ook geen snapshot bij connect, en de
  // create-/join-respons met `state` wordt door home/join alleen bij de
  // precedentiepoort geregistreerd, niet aan deze shell gegeven. Netto bleef
  // elk scherm `hidden` tot het eerste latere event. Daarom hier expliciet de
  // eerste paint laden; de precedentiepoort ordent 'm zoals elke snapshot.
  requestFreshSnapshot();

  async function measureOffset() {
    const samples = [];
    for (let i = 0; i < 3; i += 1) {
      const requestSentAt = Date.now();
      try {
        const { serverTime } = await transport.fetchServerTime();
        samples.push({ requestSentAt, serverTime, responseReceivedAt: Date.now() });
      } catch {
        // Servertijd is best-effort (server-time.mjs) — een mislukte meting
        // laat state.offsetMs gewoon op zijn vorige (of standaard 0) waarde staan.
      }
    }
    if (samples.length > 0) {
      state.offsetMs = estimateServerOffset(samples);
    }
  }

  function isHost() {
    return state.selfInfo?.roles?.includes('host') === true;
  }

  // "We zijn weer verbonden." — alleen ná een écht herstel (nooit bij de
  // allereerste verbinding), 3s zichtbaar, en een lopende timer wordt altijd
  // eerst geannuleerd i.p.v. gestapeld (reviewfeedback T4-2 punt 5). State
  // hierboven bij de andere `let`s gedeclareerd (TDZ, zie die toelichting).
  async function requestFreshSnapshot(attempt = 0) {
    try {
      const snapshot = await transport.fetchState(code, session.sessionToken);
      handleEvent({ event: 'room:state', payload: snapshot });
    } catch (err) {
      // Thema 5-bevinding: dit ving vroeger élke fout stil af — ook een
      // room die niet meer bestaat (verlopen, verwijderd) of een sessie die
      // niet meer geldig is (verlopen token, elders ingetrokken). Een
      // opgeslagen sessie die naar zo'n room wijst laadde dan in een
      // permanent lege, onverklaarde staat: geen fout, geen weg terug (08 §6
      // "roomfouten", ontbrekend `S21`-scherm). Terminale codes krijgen nu
      // wél een bestemming; alles anders (netwerkhapering) blijft stil, want
      // dat herstelt zichzelf via de eerstvolgende serverevent of state.reconnect.
      if (TERMINAL_SNAPSHOT_ERROR_CODES.has(err?.code)) {
        terminate(t(`error.${messageForErrorCode(err.code)}`));
        return;
      }
      // Fase 3 (agent 1, F1/F2): "stil, want dat herstelt zichzelf" klopte
      // niet voor DEZE aanroep — dit is de allereerste `fetchState()` na
      // mount (zie de aanroep verderop), vóór er ooit een socketverbinding
      // heeft gestaan. Eén `NETWORK_ERROR` hier (bv. de server herstartte net
      // op het moment van F5) liet het scherm zonder enige nieuwe aanleiding
      // permanent leeg staan. Begrensde retry i.p.v. één poging; blijft de
      // fout hangen, dan lost een latere, écht geslaagde (re)connect het via
      // `handleStatus` alsnog op — precies zoals de bovenstaande aanname al
      // veronderstelde.
      if (state.terminated || attempt >= SNAPSHOT_RETRY_DELAYS_MS.length) {
        return;
      }
      setTimeout(() => {
        if (!state.terminated) {
          requestFreshSnapshot(attempt + 1);
        }
      }, SNAPSHOT_RETRY_DELAYS_MS[attempt]);
    }
  }

  function terminate(message) {
    state.terminated = true;
    stopGameplayTicker();
    cancelRecoveredMessage();
    cancelReconnectFallback();
    tabChannel?.close();
    socket?.close();
    clearSession(storage, code);
    // D-018: code/QR verdwijnen pas als de sessie eindigt — dit IS dat moment.
    roomHeader.destroy();
    roomHeaderRoot.remove();
    hostBarRoot.remove(); // staat sinds A1 in de appheader, niet in `root`
    delete document.body.dataset.roundaFase; // A2: geen sessie, geen fase
    connectionController.destroy();
    overlayController.destroy();
    eventController.destroy();
    ruimHostmenuOp(); // A3: het hostpaneel hangt buiten deze sessie, in het menu
    root.textContent = '';
    const screen = document.createElement('div');
    screen.className = 'screen session-terminated';
    root.appendChild(screen);
    // UI-21/regel 0: dit is de paginafout uit `state-message.mjs` — dezelfde
    // vorm als elke andere fout in de app in plaats van een vijfde eigen
    // opbouw. Levert bovendien twee dingen op die deze hand-gebouwde versie
    // miste: `role="alert"` (het scherm wordt vervángen, dus zonder dat hoort
    // een screenreader niet dát er iets is misgegaan) en styling — de
    // `.session-terminated*`-klassen kwamen in geen enkel CSS-bestand voor.
    createErrorState({
      root: screen,
      variant: 'page',
      title: t('session.terminatedTitle'),
      message,
      action: { label: t('session.backToStart'), onClick: onLeaveHome },
    });
  }

  function routeToView() {
    if (state.terminated) {
      return;
    }
    const viewName = viewFor({
      route: isHostRoute ? 'host' : 'game',
      phase: state.matchPhase.phase,
      pausedState: state.matchPhase.pausedState,
    });

    if (viewName !== state.mountedViewName) {
      mountView(viewName);
    }
    updateMountedView(viewName);
  }

  function mountView(viewName) {
    stopGameplayTicker();
    phaseContainer.textContent = '';
    state.mountedViewName = viewName;
    // T5-7/T5-8: lobby/tussenstand/podium krijgen op tabletbreedte (T5-7,
    // 768px) en op desktop/tv-breedte (T5-8, 1200px, zie base.css) meer
    // ruimte (`#app-root`'s `max-width` wordt hierdoor NIET globaal
    // verruimd, zie base.css's `.app-root-wide`) — home/join/gameplay
    // blijven altijd op de compacte 480px-kolom. Podium zat tot T5-8 niet in
    // deze lijst (T5-7 liet 'm bewust ongewijzigd, "large/podium" was toen
    // nog niveau 0) — nu wel, zelfde databron als scoreboard.
    root.classList.toggle('app-root-wide', viewName === 'lobby' || viewName === 'scoreboard' || viewName === 'podium');

    // A2: de chrome moet zich per fase anders gedragen (#18 compact tijdens
    // het spel, #35 secundair naast de vraag, #56/A-x2 weg op het eindscherm).
    // Tot nu toe raadde de CSS de fase met `body:has(.gameplay-flag)` en
    // `body:has(.scoreboard-list)` — een gok op een klasse die van het
    // speltype afhangt en die dus stilzwijgend stopt met werken zodra er een
    // ronde zonder vlag bestaat. Dit is de enige plek die de fase écht weet,
    // dus staat het hier. Op `body` en niet op `#app-root`, want `#app-header`
    // staat buiten `#app-root`. Wordt bij `destroy()`/`terminate()` gewist.
    document.body.dataset.roundaFase = viewName;

    if (viewName === 'lobby') {
      state.mountedView = createLobbyView({
        root: phaseContainer,
        t,
        tCount,
        isHost: isHost(),
        onStart: () => sendHostAction('start'),
        onShareAction: (action) => sendShareOpened(action),
        onKickPlayer: (playerId) => sendHostAction('kick', { playerId }),
        // Scherm 3 (besluit 40B): naam kiezen ín de lobby. Gooit door bij een
        // protocolfout (NAME_TOO_LONG, INVALID_PHASE, …) — de lobby toont die.
        onRename: (displayName) => socket.send('player:rename', randomActionId(), { displayName }),
        // Feedbackronde punt 13: kleurkeuze — server broadcast de recolor-delta.
        onRecolor: (color) => socket.send('player:recolor', randomActionId(), { color }),
        // De host mag ook een ánder hernoemen of verkleuren. Bewust NIET via
        // `sendHostAction`: die slikt fouten, en juist hier moet de host de
        // reden zien (te lange naam, verkeerde fase) — net als bij zijn eigen
        // naam hierboven. `hostActionRequest` blijft wel de poortwachter: hij
        // levert `null` als je geen host bent of de fase het niet toestaat.
        onHostRenamePlayer: async (playerId, displayName) => {
          const request = hostActionRequest('rename-player', buildHostContext(), { playerId, displayName });
          if (request === null) return;
          await socket.send(request.event, randomActionId(), request.payload);
        },
        onHostRecolorPlayer: async (playerId, color) => {
          const request = hostActionRequest('recolor-player', buildHostContext(), { playerId, color });
          if (request === null) return;
          await socket.send(request.event, randomActionId(), request.payload);
        },
        // Besluit 40 (scherm 2): host stelt bij; room:config-changed komt terug.
        onConfigChange: (patch) => socket.send('game:update-config', randomActionId(), patch),
      });
      return;
    }
    if (viewName === 'gameplay') {
      state.mountedView = createGameplayView({ root: phaseContainer, t, tCount, onAnswer: sendAnswer });
      startGameplayTicker();
      return;
    }
    if (viewName === 'scoreboard') {
      state.mountedView = createScoreboardView({ root: phaseContainer, t, tCount });
      return;
    }
    if (viewName === 'podium') {
      state.mountedView = createPodiumView({
        root: phaseContainer,
        t,
        isHost: isHost(),
        capabilities,
        onRematch: () => sendHostAction('rematch'),
        onNewGame: onLeaveHome,
        onClose: onLeaveHome,
      });
      return;
    }
    state.mountedView = null;
    const placeholder = document.createElement('p');
    placeholder.dataset.i18n = 'scaffold.ready';
    placeholder.textContent = t('scaffold.ready');
    phaseContainer.appendChild(placeholder);
  }

  function updateMountedView(viewName) {
    if (state.mountedView === null) {
      return;
    }
    if (viewName === 'lobby') {
      state.mountedView.update({
        playerCount: state.playerCount,
        participants: state.participants,
        canStart: availableHostActions(buildHostContext()).includes('start'),
        canKick: availableHostActions(buildHostContext()).includes('kick'),
        locked: state.locked,
        selfName: state.selfInfo?.effectiveName ?? null,
        selfColor: state.selfInfo?.color ?? null,
        selfIsPlayer: typeof state.selfInfo?.playerId === 'string',
        participantColors: state.participantColors,
        // spelersidentiteit.md, stap 5: paar + apptaal, niet gerenderde tekst
        // — spelers.mjs/zelf.mjs roepen zelf identityText()/identityFlagUrl()
        // aan (identity-display.mjs), zodat elke client zijn eigen taal toont.
        participantIdentities: state.participantIdentities,
        selfIdentity: state.selfInfo?.identity ?? null,
        lang: getLang(),
        config: state.roomConfig,
        capabilities,
        joinUrl: state.joinUrl,
      });
      return;
    }
    if (viewName === 'gameplay') {
      state.mountedView.update(state.roundModel, gameplayUpdateOptions());
      return;
    }
    if (viewName === 'scoreboard') {
      const currentStandings = standingsFrom(state.standingsPayload ?? {});
      state.mountedView.update(currentStandings, {
        movement: rankMovementFrom(state.previousStandings, currentStandings),
        participants: state.participants,
        // Scherm 5 (besluit 40): de reveal-kaart bovenop de tussenstand leest
        // het result van de zojuist geëindigde ronde. `state.roundModel` is hier
        // nog niet gereset (dat gebeurt pas bij de volgende round:started),
        // dus dit is precies de uitslag die bij deze stand hoort.
        round: state.roundModel,
        lang: getLang(),
        pacing: state.pacing,
        // Beat 1/2 (besluit 40): ROUND_RESULT toont alleen de reveal,
        // SCOREBOARD voegt de (dan pas kloppende) tussenstand toe.
        phase: state.matchPhase.phase,
        scoreboardSeconds: typeof state.roomConfig?.scoreboardSeconds === 'number' ? state.roomConfig.scoreboardSeconds : null,
        // Punt 40 (B2): de aftelbalk op scherm 5 loopt over BEIDE beats, dus
        // heeft hij ook de duur van beat 1 nodig — zonder dit kon scoreboard.mjs
        // alleen de helft van de wachttijd tekenen.
        resultSeconds: typeof state.roomConfig?.resultSeconds === 'number' ? state.roomConfig.resultSeconds : null,
        // 11-verzoek (BOUWSPRINT doel 4), hersteld na B3: de streakreactie
        // stond in gameplay.mjs's uitslagblok en was daarmee onzichtbaar sinds
        // besluit 40 de reveal naar dit scherm verhuisde. `state.streakModel` is bij
        // `round:ended` al bijgewerkt, dus dit getal hoort bij déze ronde.
        //
        // Live gelezen (niet gesnapshot bij mount): het voorkeurenpaneel is op
        // elk scherm bereikbaar en kan dus mid-match om. `0` i.p.v. het echte
        // getal bij uitgezet — scoreboard.mjs hoeft de voorkeur niet te kennen,
        // alleen het getal dat 'm al dan niet over de drempel tilt.
        streak: (loadReactionsEnabled(storage) ?? true) ? state.streakModel.current : 0,
      });
      return;
    }
    if (viewName === 'podium') {
      state.mountedView.update(standingsFrom(state.standingsPayload ?? {}), { lang: getLang() });
    }
  }

  // S07: tijdens `COUNTDOWN` heeft `gameplay.mjs` de fase nodig (state.roundModel is
  // dan nog leeg) plus het afgeteld-getal, berekend uit `state.countdownEndsAt` —
  // zelfde patroon (`secondsRemaining()` + `state.offsetMs`) als de rondetimer.
  function gameplayUpdateOptions() {
    return {
      secondsLeft: secondsRemaining(state.roundModel.startsAt, state.roundModel.endsAt, state.offsetMs),
      phase: state.matchPhase.phase,
      countdownSecondsLeft: state.countdownEndsAt === null ? null : secondsRemaining(0, state.countdownEndsAt, state.offsetMs),
      // De streak zat hier ook, maar gameplay.mjs toont sinds besluit 40 geen
      // uitslag meer en las 'm dus nergens. Hij gaat nu mee naar scherm 5 —
      // zie de `scoreboard`-tak van `updateMountedView()`.
      //
      // R2-8: het aftelscherm zegt wél hoeveel spelers er meedoen ("5 spelers
      // klaar"). Dezelfde teller die de lobby al toont — `game:started` en
      // elke `room:state` houden 'm bij, dus hier alleen doorgeven.
      playerCount: state.playerCount,
    };
  }

  function startGameplayTicker() {
    stopGameplayTicker();
    state.gameplayTimer = setInterval(() => {
      if (state.mountedViewName === 'gameplay' && state.mountedView !== null) {
        state.mountedView.update(state.roundModel, gameplayUpdateOptions());
        // Fase 4 (autoReveal, besluit 51): "Toon antwoord" moet verschijnen
        // zodra de LOKALE timer 0 bereikt, niet pas bij het eerstvolgende
        // serverevent — bij autoReveal:false komt dat event immers pas ná de
        // hosttik. `renderHostBar()` liep hiervoor alleen op discrete
        // servergebeurtenissen; die dekking blijft bestaan, dit is ernaast.
        renderHostBar();
      }
    }, GAMEPLAY_TICK_MS);
  }

  function stopGameplayTicker() {
    if (state.gameplayTimer !== null) {
      clearInterval(state.gameplayTimer);
      state.gameplayTimer = null;
    }
  }

  // 14-S09-S10 + C-2: `value` is de iso2 (flags_mc), 'real'/'fake'
  // (real_or_fake_flag), 0/1 (higher_lower) of een kaartindex (odd_one_out) —
  // welke van de vier hangt af van `state.roundModel.gameType`, dezelfde bron die
  // `answerPayloadFor` leest. gameplay.mjs kent die vorm zelf niet, roept
  // alleen `onAnswer(value)` aan.
  async function sendAnswer(value) {
    if (state.roundModel.gameType === 'real_or_fake_flag') {
      state.roundModel = selectChoice(state.roundModel, value);
    } else if (state.roundModel.gameType === 'higher_lower') {
      state.roundModel = selectSide(state.roundModel, value);
    } else if (state.roundModel.gameType === 'odd_one_out') {
      state.roundModel = selectCard(state.roundModel, value);
    } else {
      state.roundModel = selectOption(state.roundModel, value);
    }
    updateMountedView('gameplay');
    const answer = answerPayloadFor(state.roundModel);
    if (answer === null) {
      return; // ongeldige/no-op selectie (round-model.mjs wees 'm al af)
    }
    try {
      await socket.send('round:answer', randomActionId(), {
        roundId: state.roundModel.roundId,
        answer,
        clientAnsweredAt: Date.now(),
      });
      // Acceptatie komt via het `round:answer-accepted`-event (handleEvent),
      // niet hier — dat voorkomt dat twee plekken dezelfde overgang doen.
    } catch (err) {
      state.roundModel = applyAnswerRejected(state.roundModel, err?.code ?? messageForErrorCode(err?.code));
      updateMountedView('gameplay');
    }
  }

  async function sendHostAction(action, params) {
    const request = hostActionRequest(action, buildHostContext(), params);
    if (request === null) {
      return;
    }
    try {
      await socket.send(request.event, randomActionId(), request.payload);
    } catch {
      // Geen apart host-foutkanaal: de eerstvolgende serverevent (of het
      // uitblijven van de faseovergang) is hier het enige signaal. Elke
      // hostactie hieronder is al idempotent-veilig op protocolniveau
      // (herhaalde pause/lock/kick op een reeds-zo-staande room is een no-op
      // of een dezelfde, herbruikbare fout — geen dubbele mutatie).
    }
  }

  function sendShareOpened(action) {
    const method = shareOpenedMethodFor(action);
    if (method === null) {
      return;
    }
    // Analytics-only (PROTOCOL.md): mag falen zonder UX-effect, dus geen catch-UI nodig.
    socket?.send('share:opened', randomActionId(), { method }).catch(() => {});
  }

  return {
    render() {
      renderBanner();
      renderPauseOverlay();
      renderHostBar();
      if (state.mountedViewName !== null) {
        mountView(state.mountedViewName);
        updateMountedView(state.mountedViewName);
      }
    },
    destroy() {
      state.terminated = true;
      stopGameplayTicker();
      cancelRecoveredMessage();
      cancelReconnectFallback();
      tabChannel?.close();
      socket?.close();
      // D-018: verlaat de route (app.mjs mount een andere screen) → sessie
      // is voorbij voor déze client, dus ook de headercode verdwijnt.
      roomHeader.destroy();
      roomHeaderRoot.remove();
      hostBarRoot.remove(); // idem: buiten `root`, dus expliciet opruimen
      delete document.body.dataset.roundaFase;
      connectionController.destroy();
      overlayController.destroy();
      eventController.destroy();
      ruimHostmenuOp();
    },
  };
}

function randomActionId() {
  return globalThis.crypto.randomUUID();
}

// S21: `game:finished`'s payload voor een room zonder één deelnemer
// (transport-mock.mjs's `finishGame`, `rankPlayers` op een lege `players`-Map).
function isEmptyFinish(payload) {
  return Array.isArray(payload?.podium) && payload.podium.length === 0 && payload?.self === null;
}
