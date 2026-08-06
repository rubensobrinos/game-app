import { applyServerEvent } from '../../../client/flow/match-phase-state.mjs';
import {
  applyRoundStarted,
  applyRoundResumed,
  hydrateFromSnapshot,
  applyAnswerAccepted,
  applyProgress,
  applyRoundEnded,
} from '../views/round-model.mjs';
import { applyRoundResult as applyStreakResult } from '../views/streak-model.mjs';
import { standingsFrom } from '../views/standings-model.mjs';
import { messageForSessionTermination } from '../../../client/flow/edge-case-messaging.mjs';

// T5-9: venster waarbinnen opeenvolgende room:player-changed-deltas worden
// samengevoegd tot één render. `07` §9's eigen suggestie ("bv. 500 ms").
const PLAYER_CHANGED_BATCH_MS = 500;

export function createEventController({ state, roomHeader, renderBanner, renderPauseOverlay, renderHostBar, routeToView, onLeaveHome, terminate, isEmptyFinish }) {
  let playerChangedBatchWindowOpen = false;
  let playerChangedRenderPending = false;
  let playerChangedBatchTimer = null;

  function handleEvent(envelope) {
  if (state.terminated) {
    return;
  }

  state.matchPhase = applyServerEvent(state.matchPhase, envelope);

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
      state.locked = envelope.payload?.locked === true;
      break;
    case 'room:config-changed':
      // Besluit 40 (scherm 2): iedereen hoort de nieuwe instellingen; de
      // state.pacing-afgeleide blijft dezelfde bron gebruiken als room:state.
      if (envelope.payload?.config && typeof envelope.payload.config === 'object') {
        state.roomConfig = envelope.payload.config;
        state.pacing = state.roomConfig.pacing === 'host' ? 'host' : 'auto';
      }
      break;
    case 'game:started':
      // S07: `state.countdownEndsAt` is de enige plek waar dit tijdstip binnenkomt
      // — `match-phase-state.mjs` bewaart 'm bewust niet (net als rondedata),
      // dus hier lokaal bijhouden, zelfde patroon als `state.roundModel`.
      state.countdownEndsAt = typeof envelope.payload?.countdownEndsAt === 'number' ? envelope.payload.countdownEndsAt : null;
      break;
    case 'round:started':
      state.countdownEndsAt = null;
      state.roundModel = applyRoundStarted(envelope.payload);
      break;
    case 'game:resumed':
      // R2-7: de server schuift de rondedeadline op met de pauzeduur. Zonder
      // dit telt deze client door naar de oude tijd en staat de timer na het
      // hervatten meteen op nul, terwijl er nog geantwoord kan worden.
      state.roundModel = applyRoundResumed(state.roundModel, envelope.payload);
      break;
    case 'round:answer-accepted':
      state.roundModel = applyAnswerAccepted(state.roundModel, envelope.payload);
      break;
    case 'round:progress':
      state.roundModel = applyProgress(state.roundModel, envelope.payload);
      break;
    case 'round:ended':
      state.roundModel = applyRoundEnded(state.roundModel, envelope.payload);
      // 11-verzoek (BOUWSPRINT doel 4): op sessieniveau bijgehouden, niet in
      // gameplay.mjs's eigen closure — die wordt elke ronde herbouwd zodra
      // de tussenstand-fase ertussen zit (mountView()), en zou een lokale
      // teller dus elke ronde verliezen. Precies één keer per round:ended,
      // niet bij elke render.
      state.streakModel = applyStreakResult(state.streakModel, state.roundModel.result?.selfCorrect === true);
      break;
    case 'scoreboard:updated':
      // S15: de OUDE stand snapshotten vóórdat 'ie overschreven wordt —
      // zo is er bij de volgende render iets om de nieuwe stand mee te
      // vergelijken (`rankMovementFrom`). Bij de eerste stand ooit blijft
      // `state.previousStandings` bewust `null` (niets om mee te vergelijken).
      if (state.standingsPayload !== null) {
        state.previousStandings = standingsFrom(state.standingsPayload);
      }
      state.standingsPayload = envelope.payload;
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
      if (state.standingsPayload !== null) {
        state.previousStandings = standingsFrom(state.standingsPayload);
      }
      state.standingsPayload = envelope.payload;
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



  function scheduleBatchedRender() {
  if (!playerChangedBatchWindowOpen) {
    playerChangedBatchWindowOpen = true;
    renderAfterEvent();
    playerChangedBatchTimer = setTimeout(() => {
      playerChangedBatchTimer = null;
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
  state.playerCount = typeof room.playerCount === 'number' ? room.playerCount : state.playerCount;
  state.joinUrl = typeof room.joinUrl === 'string' ? room.joinUrl : state.joinUrl;
  roomHeader.setJoinUrl(state.joinUrl);
  state.locked = typeof room.locked === 'boolean' ? room.locked : state.locked;
  state.pacing = room.config?.pacing === 'host' ? 'host' : 'auto';
  if (room.config && typeof room.config === 'object') {
    state.roomConfig = room.config;
  }
  // `room:state` komt alleen bij de eerste verbinding en ná een state.reconnect
  // binnen (nooit tussendoor tijdens een stabiele sessie) — hydrateer
  // `state.roundModel` daarom telkens opnieuw vanuit de snapshot. Zonder dit
  // bleef een herladen/herverbonden client op `initialRoundModel()` staan
  // terwijl er allang een ronde liep, en was `answerStatus` na een
  // state.reconnect altijd `'idle'` ook als de server al een antwoord had
  // geaccepteerd (reviewfeedback T4-3).
  // `self.answeredValue` bestaat niet in PROTOCOL.md (de echte server kent
  // het niet) — alleen transport-mock.mjs stuurt het mee, voor solo na een
  // herlaadbeurt (docs/openstaand/solo-antwoordvolgorde.md, punt 2). Een
  // state.reconnect tegen de echte server geeft hier gewoon `undefined` -> `null`,
  // hydrateFromSnapshot's ongewijzigde oude gedrag.
  state.roundModel = hydrateFromSnapshot(
    payload?.currentRound,
    payload?.self?.answeredCurrentRound === true,
    typeof payload?.self?.answeredValue === 'string' ? payload.self.answeredValue : null,
  );
  // Zelfde reden als hierboven: `room:state` draagt `scoreboard: { top,
  // self }` (PROTOCOL.md), maar dat werd tot nu toe genegeerd — een reload
  // tijdens SCOREBOARD/FINISHED liet de tussenstand/eindstand dus leeg
  // achter i.p.v. hem uit de snapshot te herstellen (T5-3, gemeten via
  // Playwright tegen de echte server: eindstand verdween volledig ná reload).
  if (payload?.scoreboard) {
    state.standingsPayload = payload.scoreboard;
  }
  if (payload?.self && typeof payload.self.playerId === 'string') {
    state.selfInfo = payload.self;
    state.participants.set(payload.self.playerId, payload.self.effectiveName ?? '');
    if (typeof payload.self.color === 'string') {
      state.participantColors.set(payload.self.playerId, payload.self.color);
    }
    // spelersidentiteit.md, stap 5: `identity` reist mee als apart veld naast
    // `effectiveName` (zelfde patroon als `participantColors` hierboven) —
    // de view rendert 'm zelf in de apptaal (identity-display.mjs), leest
    // hier dus nooit gerenderde tekst.
    state.participantIdentities.set(payload.self.playerId, payload.self.identity ?? null);
  } else if (payload?.self) {
    state.selfInfo = payload.self; // host zonder spelersrol: roles wel bekend, playerId null
  }
}



  function applyPlayerChanged(payload) {
  if (typeof payload?.playerCount === 'number') {
    state.playerCount = payload.playerCount;
  }
  const delta = payload?.delta;
  if (delta === null || typeof delta !== 'object') {
    return;
  }
  if (delta.type === 'recolor') {
    if (typeof delta.playerId === 'string' && typeof delta.color === 'string') {
      state.participantColors.set(delta.playerId, delta.color);
      if (state.selfInfo?.playerId === delta.playerId) {
        state.selfInfo = { ...state.selfInfo, color: delta.color };
      }
    }
  } else if (delta.type === 'join' || delta.type === 'rename') {
    if (typeof delta.playerId === 'string') {
      state.participants.set(delta.playerId, delta.effectiveName ?? '');
      if (typeof delta.color === 'string') {
        state.participantColors.set(delta.playerId, delta.color);
      }
      // spelersidentiteit.md, stap 5: `identity` mee met dezelfde twee delta's
      // als de naam hierboven — een rename wist 'm altijd (`delta.identity`
      // is dan al `null`, server bepaalt dat), een join zet 'm.
      state.participantIdentities.set(delta.playerId, delta.identity ?? null);
      // Scherm 3 (40B): een rename van jezélf moet ook `state.selfInfo` verversen
      // — daar leest de lobby (`selfName`) uit, en die werd tot nu toe
      // alleen bij `room:state` gezet.
      if (delta.type === 'rename' && state.selfInfo?.playerId === delta.playerId) {
        state.selfInfo = { ...state.selfInfo, effectiveName: delta.effectiveName ?? state.selfInfo.effectiveName, identity: delta.identity ?? null };
      }
    }
  } else if (delta.type === 'leave' || delta.type === 'kick') {
    if (typeof delta.playerId === 'string') {
      state.participants.delete(delta.playerId);
      state.participantColors.delete(delta.playerId);
      state.participantIdentities.delete(delta.playerId);
    }
  }
}

  function destroy() {
    clearTimeout(playerChangedBatchTimer);
    playerChangedBatchTimer = null;
    playerChangedBatchWindowOpen = false;
    playerChangedRenderPending = false;
  }

  return { handleEvent, renderAfterEvent, destroy };
}
