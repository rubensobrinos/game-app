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
import { createErrorState } from './state-message.mjs';
import { shareOpenedMethodFor } from '../../client/flow/share-actions.mjs';
import { viewFor } from './view-switcher.mjs';
import { estimateServerOffset, secondsRemaining } from './server-time.mjs';
import {
  initialRoundModel,
  applyRoundStarted,
  hydrateFromSnapshot,
  selectOption,
  selectChoice,
  selectSide,
  answerPayloadFor,
  applyAnswerAccepted,
  applyAnswerRejected,
  applyProgress,
  applyRoundEnded,
} from './views/round-model.mjs';
import { standingsFrom, rankMovementFrom } from './views/standings-model.mjs';
import { createRoomHeader } from './views/room-header.mjs';
import { createLobbyView } from './views/lobby.mjs';
import { createGameplayView } from './views/gameplay.mjs';
import { createScoreboardView } from './views/scoreboard.mjs';
import { createPodiumView } from './views/podium.mjs';
import { createHostBar } from './views/hostbar.mjs';
import { createRondoView } from './views/rondo.mjs';

const GAMEPLAY_TICK_MS = 250;
const RECOVERED_MESSAGE_MS = 3000;
// S19: hoelang onafgebroken disconnected/reconnecting vóór de terugvalknop
// verschijnt. Geen brondocumentwaarde hiervoor — 8-10s uit de prompt, 9s als
// middelste keuze.
const RECONNECT_FALLBACK_MS = 9000;
// T5-9: venster waarbinnen opeenvolgende room:player-changed-deltas worden
// samengevoegd tot één render. `07` §9's eigen suggestie ("bv. 500 ms").
const PLAYER_CHANGED_BATCH_MS = 500;

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

  // BOUWSPRINT/Rondo: "overal waar je wacht" — de statustekst blijft de
  // aria-live-bron (niet vervangen, alleen aangevuld), Rondo geeft de
  // wachttijd tijdens een reconnect iets om naar te kijken. Decoratief:
  // geen eigen aankondiging, `banner` draagt de tekst al.
  const reconnectRondoRoot = document.createElement('div');
  reconnectRondoRoot.className = 'session-reconnect-rondo';
  reconnectRondoRoot.hidden = true;
  reconnectRondoRoot.setAttribute('aria-hidden', 'true');
  let reconnectRondoView = null;

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
  const hostBar = createHostBar({
    root: hostBarRoot,
    t,
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
  // BOUWSPRINT/Rondo: "zelfde dode moment, zelfde oplossing" — alleen voor
  // de speler (de host heeft de hostbalk in dit overlay, geen leeg wachten).
  const pauseRondoRoot = document.createElement('div');
  pauseRondoRoot.className = 'session-pause-rondo';
  pauseRondoRoot.hidden = true;
  let pauseRondoView = null;
  pauseCardWrap.append(pauseCard, pauseRondoRoot);
  pauseOverlay.appendChild(pauseCardWrap);
  pauseOverlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isHost()) {
      event.stopPropagation();
      sendHostAction('resume');
      hostBar.focusPause();
    }
  });

  root.append(banner, reconnectRondoRoot, answerSavedNote, duplicateTabNotice, reconnectFallbackButton, hostBarRoot, phaseContainer, pauseOverlay);

  let matchPhase = initialMatchPhaseState();
  let reconnect = initialReconnectState();
  let roundModel = initialRoundModel();
  let countdownEndsAt = null; // S07: alleen relevant tijdens matchPhase.phase === 'COUNTDOWN'
  let standingsPayload = null;
  // S15/prompt 08: vorige `standingsFrom()`-uitkomst, voor `rankMovementFrom()`
  // (gedeeld met 07-reveal-en-sociale-headline.md's comeback-detectie, zelfde
  // vorige-versus-huidige-vergelijking). `null` tot de tweede stand binnenkomt.
  let previousStandings = null;
  let participants = new Map();
  let playerCount = 0;
  let locked = false;
  let pacing = 'auto';
  let selfInfo = null; // { roles, playerId, effectiveName } uit room:state
  let joinUrl = '';
  let offsetMs = 0;
  let mountedViewName = null;
  let mountedView = null;
  let gameplayTimer = null;
  let terminated = false;
  // Vóór `transport.connect()` gedeclareerd, niet verderop bij
  // `showRecoveredMessage`: de mock roept `onStatus('connecting')` al
  // synchroon aan tijdens `connect()` zelf, dus `renderBanner()` (via
  // `handleStatus`) leest deze twee al vóórdat de rest van dit bestand is
  // uitgevoerd — anders een TDZ-`ReferenceError`.
  let recoveredMessageTimer = null;
  let showingRecoveredMessage = false;
  let reconnectFallbackTimer = null;
  let reconnectFallbackVisible = false;

  const capabilities = { nativeShareAvailable: typeof navigator !== 'undefined' && 'share' in navigator };

  measureOffset();
  const socket = transport.connect(session.sessionToken, {
    onEvent: handleEvent,
    onStatus: handleStatus,
  });
  // EERSTE VERBINDING (fix 3 aug 2026, live-test producteigenaar): de
  // reconnect-machine start als `connected` zonder `pendingSnapshotRequest`,
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
    // Vóór de transitie vastleggen: `reconnect.status` ná de transitie is bij
    // 'connected' altijd 'connected', dus dat vertelt niet meer of dit de
    // állereerste verbinding was of een herstel ná een echte disconnect.
    const wasDown = reconnect.status === 'disconnected' || reconnect.status === 'reconnecting';

    if (status === 'connecting') {
      reconnect = reconnectTransition(reconnect, { type: 'RECONNECT_ATTEMPT_STARTED' });
    } else if (status === 'connected') {
      reconnect = reconnectTransition(reconnect, { type: 'RECONNECT_SUCCEEDED' });
      if (wasDown) {
        showRecoveredMessage();
      }
    } else if (status === 'disconnected') {
      reconnect = reconnectTransition(reconnect, { type: 'DISCONNECTED' });
      // Een nieuwe disconnect wint altijd van een nog zichtbare
      // hersteld-melding van een vorige, kortstondige reconnect.
      cancelRecoveredMessage();
    }

    // S19: terugvalroute. Start de klok zodra we niet (meer) `connected` zijn
    // en er nog geen klok loopt of knop zichtbaar is; annuleer 'm zodra we
    // weer `connected` zijn. Forceert zelf niets — de transportlaag blijft
    // zelf de enige die opnieuw `connect()` aanroept.
    if (reconnect.status === 'connected') {
      cancelReconnectFallback();
    } else if (reconnectFallbackTimer === null && !reconnectFallbackVisible) {
      scheduleReconnectFallback();
    }

    renderBanner();

    const action = reconnectNextAction(reconnect);
    if (action?.type === 'request-snapshot') {
      reconnect = reconnectTransition(reconnect, { type: 'SNAPSHOT_REQUEST_SENT' });
      requestFreshSnapshot();
    }
  }

  function scheduleReconnectFallback() {
    reconnectFallbackTimer = setTimeout(() => {
      reconnectFallbackTimer = null;
      reconnectFallbackVisible = true;
      renderBanner();
    }, RECONNECT_FALLBACK_MS);
  }

  function cancelReconnectFallback() {
    clearTimeout(reconnectFallbackTimer);
    reconnectFallbackTimer = null;
    reconnectFallbackVisible = false;
  }

  // "We zijn weer verbonden." — alleen ná een écht herstel (nooit bij de
  // allereerste verbinding), 3s zichtbaar, en een lopende timer wordt altijd
  // eerst geannuleerd i.p.v. gestapeld (reviewfeedback T4-2 punt 5). State
  // hierboven bij de andere `let`s gedeclareerd (TDZ, zie die toelichting).
  function showRecoveredMessage() {
    clearTimeout(recoveredMessageTimer);
    showingRecoveredMessage = true;
    renderBanner();
    recoveredMessageTimer = setTimeout(() => {
      recoveredMessageTimer = null;
      showingRecoveredMessage = false;
      renderBanner();
    }, RECOVERED_MESSAGE_MS);
  }

  function cancelRecoveredMessage() {
    clearTimeout(recoveredMessageTimer);
    recoveredMessageTimer = null;
    showingRecoveredMessage = false;
  }

  async function requestFreshSnapshot() {
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
      // dat herstelt zichzelf via de eerstvolgende serverevent of reconnect.
      if (TERMINAL_SNAPSHOT_ERROR_CODES.has(err?.code)) {
        terminate(t(`error.${messageForErrorCode(err.code)}`));
      }
    }
  }

  function renderBanner() {
    if (showingRecoveredMessage) {
      banner.hidden = false;
      banner.classList.remove('is-disconnected');
      // M2/E15: korte, stille successtransitie i.p.v. een instante
      // kleurwissel — "successcue klein", geen viering (06 §4 E15).
      banner.classList.add('session-banner-success');
      banner.textContent = t('connection.connected');
    } else {
      const key = messageForConnectionStatus(reconnect.status);
      banner.hidden = key === null;
      banner.classList.toggle('is-disconnected', reconnect.status === 'disconnected');
      banner.classList.remove('session-banner-success');
      if (key !== null) {
        // M2/E15: voortgang tonen tijdens reconnecting — `reconnect.attempt`
        // bestond al (reconnect-state.mjs) maar werd nergens getoond.
        // Nieuwe, aparte sleutel (niet `connection.reconnecting` zelf
        // gewijzigd, die is al door thema 4 uitgevoerd) — coördinatiepunt,
        // zie PROGRESS.md.
        banner.textContent =
          reconnect.status === 'reconnecting' && reconnect.attempt >= 1
            ? tCount('connection.reconnectingAttempt', reconnect.attempt)
            : t(key);
      }
    }

    // Geruststelling naast (niet in plaats van) de disconnected-tekst — en
    // alleen als er ook echt een geaccepteerd antwoord is, niet zomaar op
    // basis van de fase (reviewfeedback T4-2 punt 3: fase alleen bewijst
    // niet dat dít antwoord is aangekomen).
    answerSavedNote.hidden = !(reconnect.status === 'disconnected' && roundModel.answerStatus === 'accepted');
    if (!answerSavedNote.hidden) {
      answerSavedNote.textContent = t('connection.answerSaved');
    }

    // BOUWSPRINT/Rondo: reconnect is per definitie een wachtmoment, nooit
    // tegelijk met een actieve ronde-interactie — mount/unmount lazily,
    // de statustekst hierboven blijft de aria-live-bron.
    const showReconnectRondo = !showingRecoveredMessage && (reconnect.status === 'disconnected' || reconnect.status === 'reconnecting');
    reconnectRondoRoot.hidden = !showReconnectRondo;
    if (showReconnectRondo && reconnectRondoView === null) {
      reconnectRondoView = createRondoView({ root: reconnectRondoRoot });
    } else if (!showReconnectRondo && reconnectRondoView !== null) {
      reconnectRondoView.destroy();
      reconnectRondoView = null;
      reconnectRondoRoot.textContent = '';
    }

    // S19: pas tonen als de klok echt is afgelopen (`reconnectFallbackVisible`)
    // én we nog steeds niet verbonden zijn — een ondertussen geslaagd herstel
    // annuleert de klok al in `handleStatus`, maar dit is de render-kant van
    // diezelfde voorwaarde.
    reconnectFallbackButton.hidden = !(reconnectFallbackVisible && reconnect.status !== 'connected');
    if (!reconnectFallbackButton.hidden) {
      reconnectFallbackButton.textContent = t('join.retry');
    }
  }

  function renderPauseOverlay() {
    if (matchPhase.phase !== 'PAUSED') {
      pauseOverlay.hidden = true;
      restoreHostBarPosition();
      if (pauseRondoView !== null) {
        pauseRondoView.destroy();
        pauseRondoView = null;
        pauseRondoRoot.textContent = '';
      }
      return;
    }
    const wasHidden = pauseOverlay.hidden;
    const reasonText = t(messageForPauseReason(matchPhase.pausedState?.reason));
    pauseOverlay.hidden = false;
    // Host ziet een stempel i.p.v. de kalme spelerszin — geen aparte staat om
    // te bouwen, alleen andere tekst op hetzelfde element (T4-5).
    const hostText = t('pause.hostStamp');
    const cardText = isHost() ? hostText : reasonText;
    pauseOverlay.setAttribute('aria-label', cardText);
    pauseCard.textContent = cardText;
    pauseCard.classList.toggle('session-pause-card-host-stamp', isHost());
    // BOUWSPRINT/Rondo: alleen voor de speler — de host heeft de hostbalk
    // hier (zie hieronder), geen leeg wachtmoment.
    pauseRondoRoot.hidden = isHost();
    if (!isHost() && pauseRondoView === null) {
      pauseRondoView = createRondoView({ root: pauseRondoRoot });
    } else if (isHost() && pauseRondoView !== null) {
      pauseRondoView.destroy();
      pauseRondoView = null;
      pauseRondoRoot.textContent = '';
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

  // hostBarRoot's vaste plek is vóór `phaseContainer`, ná `answerSavedNote`
  // (zie de `root.append(...)` verderop) — hier expliciet terugzetten zodra
  // de pauze-overlay niet (meer) actief is voor deze speler.
  function restoreHostBarPosition() {
    if (hostBarRoot.nextSibling !== phaseContainer) {
      root.insertBefore(hostBarRoot, phaseContainer);
    }
  }

  function buildHostContext() {
    return { phase: matchPhase.phase, pacing, playerCount, locked };
  }

  function renderHostBar() {
    hostBar.update({
      isHost: isHost(),
      availableActions: availableHostActions(buildHostContext()),
      participants,
      phase: matchPhase.phase,
    });
  }

  function handleEvent(envelope) {
    if (terminated) {
      return;
    }

    matchPhase = applyServerEvent(matchPhase, envelope);

    // T5-9: bij een snelle reeks joins/leaves (bulktoetreding, of testen met
    // veel spelers) zou elke losse `room:player-changed` anders zijn eigen
    // volledige lobby-re-render triggeren — N events, N DOM-mutaties. Eerste
    // wijziging in een rustig venster rendert meteen (geen kunstmatige
    // vertraging voor de normale, geïsoleerde join); wat daarna binnen
    // `PLAYER_CHANGED_BATCH_MS` bijkomt wordt samengevoegd tot één render aan
    // het eind van het venster.
    if (envelope.event === 'room:player-changed') {
      applyPlayerChanged(envelope.payload);
      scheduleBatchedRender();
      return;
    }

    switch (envelope.event) {
      case 'room:state':
        applyRoomState(envelope.payload);
        break;
      case 'room:lock-changed':
        locked = envelope.payload?.locked === true;
        break;
      case 'game:started':
        // S07: `countdownEndsAt` is de enige plek waar dit tijdstip binnenkomt
        // — `match-phase-state.mjs` bewaart 'm bewust niet (net als rondedata),
        // dus hier lokaal bijhouden, zelfde patroon als `roundModel`.
        countdownEndsAt = typeof envelope.payload?.countdownEndsAt === 'number' ? envelope.payload.countdownEndsAt : null;
        break;
      case 'round:started':
        countdownEndsAt = null;
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
        // S15: de OUDE stand snapshotten vóórdat 'ie overschreven wordt —
        // zo is er bij de volgende render iets om de nieuwe stand mee te
        // vergelijken (`rankMovementFrom`). Bij de eerste stand ooit blijft
        // `previousStandings` bewust `null` (niets om mee te vergelijken).
        if (standingsPayload !== null) {
          previousStandings = standingsFrom(standingsPayload);
        }
        standingsPayload = envelope.payload;
        break;
      case 'game:finished':
        // S21 (gereproduceerd tegen transport-mock.mjs: `game:finish` vanuit
        // een lege LOBBY levert `{podium: [], self: null}` op): een podium
        // zonder één deelnemer is geen zinnig scherm — terug naar start
        // i.p.v. dat leeg podium te mounten. Geen eigen S21-scherm nodig,
        // dit dekt alleen dat ene randgeval.
        if (isEmptyFinish(envelope.payload)) {
          onLeaveHome();
          return;
        }
        if (standingsPayload !== null) {
          previousStandings = standingsFrom(standingsPayload);
        }
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

    renderAfterEvent();
  }

  function renderAfterEvent() {
    renderBanner();
    renderPauseOverlay();
    renderHostBar();
    routeToView();
  }

  let playerChangedBatchWindowOpen = false;
  let playerChangedRenderPending = false;

  function scheduleBatchedRender() {
    if (!playerChangedBatchWindowOpen) {
      playerChangedBatchWindowOpen = true;
      renderAfterEvent();
      setTimeout(() => {
        playerChangedBatchWindowOpen = false;
        if (playerChangedRenderPending) {
          playerChangedRenderPending = false;
          renderAfterEvent();
        }
      }, PLAYER_CHANGED_BATCH_MS);
    } else {
      playerChangedRenderPending = true;
    }
  }

  function applyRoomState(payload) {
    const room = payload?.room ?? {};
    playerCount = typeof room.playerCount === 'number' ? room.playerCount : playerCount;
    joinUrl = typeof room.joinUrl === 'string' ? room.joinUrl : joinUrl;
    roomHeader.setJoinUrl(joinUrl);
    locked = typeof room.locked === 'boolean' ? room.locked : locked;
    pacing = room.config?.pacing === 'host' ? 'host' : 'auto';
    // `room:state` komt alleen bij de eerste verbinding en ná een reconnect
    // binnen (nooit tussendoor tijdens een stabiele sessie) — hydrateer
    // `roundModel` daarom telkens opnieuw vanuit de snapshot. Zonder dit
    // bleef een herladen/herverbonden client op `initialRoundModel()` staan
    // terwijl er allang een ronde liep, en was `answerStatus` na een
    // reconnect altijd `'idle'` ook als de server al een antwoord had
    // geaccepteerd (reviewfeedback T4-3).
    roundModel = hydrateFromSnapshot(payload?.currentRound, payload?.self?.answeredCurrentRound === true);
    // Zelfde reden als hierboven: `room:state` draagt `scoreboard: { top,
    // self }` (PROTOCOL.md), maar dat werd tot nu toe genegeerd — een reload
    // tijdens SCOREBOARD/FINISHED liet de tussenstand/eindstand dus leeg
    // achter i.p.v. hem uit de snapshot te herstellen (T5-3, gemeten via
    // Playwright tegen de echte server: eindstand verdween volledig ná reload).
    if (payload?.scoreboard) {
      standingsPayload = payload.scoreboard;
    }
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
    cancelRecoveredMessage();
    cancelReconnectFallback();
    tabChannel?.close();
    socket.close();
    clearSession(storage, code);
    // D-018: code/QR verdwijnen pas als de sessie eindigt — dit IS dat moment.
    roomHeader.destroy();
    roomHeaderRoot.remove();
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
    // T5-7/T5-8: lobby/tussenstand/podium krijgen op tabletbreedte (T5-7,
    // 768px) en op desktop/tv-breedte (T5-8, 1200px, zie base.css) meer
    // ruimte (`#app-root`'s `max-width` wordt hierdoor NIET globaal
    // verruimd, zie base.css's `.app-root-wide`) — home/join/gameplay
    // blijven altijd op de compacte 480px-kolom. Podium zat tot T5-8 niet in
    // deze lijst (T5-7 liet 'm bewust ongewijzigd, "large/podium" was toen
    // nog niveau 0) — nu wel, zelfde databron als scoreboard.
    root.classList.toggle('app-root-wide', viewName === 'lobby' || viewName === 'scoreboard' || viewName === 'podium');

    if (viewName === 'lobby') {
      mountedView = createLobbyView({
        root: phaseContainer,
        t,
        tCount,
        isHost: isHost(),
        onStart: () => sendHostAction('start'),
        onShareAction: (action) => sendShareOpened(action),
        onKickPlayer: (playerId) => sendHostAction('kick', { playerId }),
      });
      return;
    }
    if (viewName === 'gameplay') {
      mountedView = createGameplayView({ root: phaseContainer, t, onAnswer: sendAnswer });
      startGameplayTicker();
      return;
    }
    if (viewName === 'scoreboard') {
      mountedView = createScoreboardView({ root: phaseContainer, t, tCount });
      return;
    }
    if (viewName === 'podium') {
      mountedView = createPodiumView({
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
      mountedView.update({
        playerCount,
        participants,
        canStart: availableHostActions(buildHostContext()).includes('start'),
        canKick: availableHostActions(buildHostContext()).includes('kick'),
        locked,
        selfName: selfInfo?.effectiveName ?? null,
        capabilities,
        joinUrl,
      });
      return;
    }
    if (viewName === 'gameplay') {
      mountedView.update(roundModel, gameplayUpdateOptions());
      return;
    }
    if (viewName === 'scoreboard') {
      const currentStandings = standingsFrom(standingsPayload ?? {});
      mountedView.update(currentStandings, {
        movement: rankMovementFrom(previousStandings, currentStandings),
        participants,
      });
      return;
    }
    if (viewName === 'podium') {
      mountedView.update(standingsFrom(standingsPayload ?? {}));
    }
  }

  // S07: tijdens `COUNTDOWN` heeft `gameplay.mjs` de fase nodig (roundModel is
  // dan nog leeg) plus het afgeteld-getal, berekend uit `countdownEndsAt` —
  // zelfde patroon (`secondsRemaining()` + `offsetMs`) als de rondetimer.
  function gameplayUpdateOptions() {
    return {
      secondsLeft: secondsRemaining(roundModel.startsAt, roundModel.endsAt, offsetMs),
      phase: matchPhase.phase,
      countdownSecondsLeft: countdownEndsAt === null ? null : secondsRemaining(0, countdownEndsAt, offsetMs),
    };
  }

  function startGameplayTicker() {
    stopGameplayTicker();
    gameplayTimer = setInterval(() => {
      if (mountedViewName === 'gameplay' && mountedView !== null) {
        mountedView.update(roundModel, gameplayUpdateOptions());
      }
    }, GAMEPLAY_TICK_MS);
  }

  function stopGameplayTicker() {
    if (gameplayTimer !== null) {
      clearInterval(gameplayTimer);
      gameplayTimer = null;
    }
  }

  // 14-S09-S10: `value` is de iso2 (flags_mc), 'real'/'fake'
  // (real_or_fake_flag) of 0/1 (higher_lower) — welke van de drie hangt af
  // van `roundModel.gameType`, dezelfde bron die `answerPayloadFor` leest.
  // gameplay.mjs kent die vorm zelf niet, roept alleen `onAnswer(value)` aan.
  async function sendAnswer(value) {
    if (roundModel.gameType === 'real_or_fake_flag') {
      roundModel = selectChoice(roundModel, value);
    } else if (roundModel.gameType === 'higher_lower') {
      roundModel = selectSide(roundModel, value);
    } else {
      roundModel = selectOption(roundModel, value);
    }
    updateMountedView('gameplay');
    const answer = answerPayloadFor(roundModel);
    if (answer === null) {
      return; // ongeldige/no-op selectie (round-model.mjs wees 'm al af)
    }
    try {
      await socket.send('round:answer', randomActionId(), {
        roundId: roundModel.roundId,
        answer,
        clientAnsweredAt: Date.now(),
      });
      // Acceptatie komt via het `round:answer-accepted`-event (handleEvent),
      // niet hier — dat voorkomt dat twee plekken dezelfde overgang doen.
    } catch (err) {
      roundModel = applyAnswerRejected(roundModel, err?.code ?? messageForErrorCode(err?.code));
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
    socket.send('share:opened', randomActionId(), { method }).catch(() => {});
  }

  return {
    render() {
      renderBanner();
      renderPauseOverlay();
      renderHostBar();
      if (mountedViewName !== null) {
        mountView(mountedViewName);
        updateMountedView(mountedViewName);
      }
    },
    destroy() {
      terminated = true;
      stopGameplayTicker();
      cancelRecoveredMessage();
      cancelReconnectFallback();
      tabChannel?.close();
      socket.close();
      // D-018: verlaat de route (app.mjs mount een andere screen) → sessie
      // is voorbij voor déze client, dus ook de headercode verdwijnt.
      roomHeader.destroy();
      roomHeaderRoot.remove();
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
