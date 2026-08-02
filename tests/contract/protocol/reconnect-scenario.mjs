/**
 * @file PR7e — reconnect-scenario tegen de fake-transportlaag (PR7a) en de
 *   échte PR6-code, plus het restart-scenario voor pauze-op-recovery.
 * @see docs/protocol-plan/prompts/PR7-contract-tests.md — sub-batch PR7e.
 * @see server/protocol/reconnect.mjs (PR6), server/protocol/auth-shape.mjs (PR3).
 * @see docs/multiplayer/ARCHITECTURE.md §10 ("Herstelbaarheid"),
 *   docs/multiplayer/GAME-FLOW.md edge case 14 ("Serverproces herstart").
 *
 * Toetst de backoff-reeks, de niet-herverzenden-regel en de
 * socketauth-hergebruikwrapper uit PR6, plús: `socketServer.restart()`
 * tijdens `ROUND_ACTIVE` -> room naar `PAUSED` -> reconnect via snapshot ->
 * hervatten met nieuwe korte countdown.
 *
 * `architecture-plan` heeft voor de restart/pauze-afhandeling nog geen eigen
 * fase/bouwsteen (alleen ARCHITECTURE.md §10 beschrijft dit gedrag in proza,
 * als brontekst) — dit bestand bouwt daarom een eigen, lokale fake-Redis-
 * stand-in (`createFakeRedisRoomStore` hieronder), uitsluitend voor dit
 * scenario, in plaats van iets bestaands na te bouwen of te herbouwen. Dit is
 * geen protocollogica: het is een tijdelijke, in-memory stand-in voor
 * "actuele ronde en geaccepteerde antwoorden blijven staan" (ARCHITECTURE.md
 * §10), puur om het scenario testbaar te maken.
 *
 * Expliciet NIET bindend beslist (zie ../../../docs/protocol-plan/README.md,
 * Open vraag §2): of de pauze ook als live `game:paused`-broadcast reist.
 * Dit scenario stuurt de PAUSED-fase daarom uitsluitend via de post-
 * reconnect-snapshot, nooit als "bewezen" live broadcast.
 */

/**
 * Minimale, lokale fake-Redis-achtige stand-in: bewaart alleen roomfase,
 * de actieve `roundId`/`matchId` en de countdown — precies genoeg om
 * ARCHITECTURE.md §10's "actuele ronde en geaccepteerde antwoorden blijven
 * staan" te modelleren. Geen echte Redis, geen persistente opslag.
 * @param {{ phase: string, roundId: string, matchId: string }} initialRoom
 */
function createFakeRedisRoomStore(initialRoom) {
  let room = { ...initialRoom, countdownEndsAt: null };
  return {
    getRoom: () => ({ ...room }),
    setPhase(phase) {
      room = { ...room, phase };
    },
    setCountdown(countdownEndsAt) {
      room = { ...room, countdownEndsAt };
    },
  };
}

/**
 * Modelleert ARCHITECTURE.md §10's eerste stap ná een game-serverherstart:
 * "actieve rooms worden gevonden via een room-index; room gaat tijdelijk naar
 * `PAUSED`". `roundId`/`matchId` blijven ongewijzigd — geen stilzwijgend
 * overslaan van fases (GAME-FLOW.md edge case 14).
 * @param {ReturnType<typeof createFakeRedisRoomStore>} redisStore
 */
function pauseActiveRoomsAfterRestart(redisStore) {
  const room = redisStore.getRoom();
  if (room.phase === 'ROUND_ACTIVE') {
    redisStore.setPhase('PAUSED');
  }
}

/**
 * Modelleert het hervatten ná pauze-op-recovery: "hervatten gebeurt met een
 * nieuwe korte countdown" (ARCHITECTURE.md §10) — dezelfde `roundId`, een
 * nieuwe `countdownEndsAt`.
 * @param {ReturnType<typeof createFakeRedisRoomStore>} redisStore
 * @param {number} newCountdownEndsAt
 */
function resumeWithNewCountdown(redisStore, newCountdownEndsAt) {
  redisStore.setPhase('ROUND_ACTIVE');
  redisStore.setCountdown(newCountdownEndsAt);
}

/**
 * Past m6's `buildReconnectSocketAuth`-validator-argument (dat
 * `{ ok, payload } | { ok, reason }` verwacht) aan op PR3's
 * `parseSocketAuthPayload` (dat `{ ok, sessionToken, protocolVersion } |
 * { ok, code }` teruggeeft) — pure adaptatie van vorm, geen nieuwe
 * validatielogica.
 * @param {Function} parseSocketAuthPayload
 * @returns {(payload: unknown) => { ok: true, payload: object } | { ok: false, reason: string }}
 */
function adaptSocketAuthValidator(parseSocketAuthPayload) {
  return (payload) => {
    const result = parseSocketAuthPayload(payload);
    if (result.ok) {
      return { ok: true, payload: { sessionToken: result.sessionToken, protocolVersion: result.protocolVersion } };
    }
    return { ok: false, reason: result.code };
  };
}

/**
 * @param {ReturnType<typeof import('./fake-transport.mjs').createFakeSocketServer>} socketServer
 * @param {{ backoffDelaySeconds: Function, resolveReconnectResend: Function, buildReconnectSocketAuth: Function }} m6
 * @param {Function} parseSocketAuthPayload - PR3's `auth-shape.mjs`-export,
 *   hergebruikt via `buildReconnectSocketAuth` (PROTOCOL.md §Reconnect stap
 *   4: "Socketauth gebruikt dezelfde sessietoken" — geen apart schema).
 * @returns {{
 *   reconnectOk: boolean,
 *   pauseOnRecoveryOk: boolean,
 *   backoffDelays: number[],
 *   resendAfterAck: unknown,
 *   resendWithoutAck: unknown,
 *   handshakeAfterRestart: unknown,
 *   phaseSequenceObservedByClient: string[],
 *   roundIdConsistentAcrossRestart: boolean,
 * }}
 */
export function runReconnectScenario(socketServer, m6, parseSocketAuthPayload) {
  const { backoffDelaySeconds, resolveReconnectResend, buildReconnectSocketAuth } = m6;

  // Rij 20 — 6 opeenvolgende reconnectpogingen -> vertragingen [1,2,4,8,16,30].
  const backoffGenerator = backoffDelaySeconds();
  const backoffDelays = [];
  for (let i = 0; i < 6; i += 1) {
    backoffDelays.push(backoffGenerator.next().value);
  }

  // Rij 21 — reconnect terwijl het laatste antwoord al een ack had -> niet
  // opnieuw verzonden.
  const resendAfterAck = resolveReconnectResend({ actionId: 'act_last', ackReceived: true });

  // Rij 22 — reconnect zonder ontvangen ack -> exact dezelfde actionId herhaald.
  const resendWithoutAck = resolveReconnectResend({ actionId: 'act_last', ackReceived: false });

  // Rijen 23/24 — restart-scenario: room ROUND_ACTIVE -> PAUSED -> reconnect
  // via snapshot -> hervatten met nieuwe korte countdown, plus dat de
  // reconnect-handshake exact hetzelfde schema hergebruikt.
  const redisStore = createFakeRedisRoomStore({
    phase: 'ROUND_ACTIVE',
    roundId: 'round_07',
    matchId: 'match_01J',
  });

  const phaseSequenceObservedByClient = [];
  const roundIdsObservedByClient = [];

  function sendSnapshotTo(socket) {
    const room = redisStore.getRoom();
    socket.emit('room:state', {
      protocolVersion: 'v1',
      serverTime: 1785623412000,
      room: {
        code: '482917',
        phase: room.phase,
        locked: false,
        allowLateJoin: true,
        joinUrl: 'https://play.aseso.nl/j/N4x7pQm2K8tW',
        playerCount: 1,
        config: {},
        matchId: room.matchId,
      },
      self: { roles: ['player'], playerId: 'p_8f42d1', effectiveName: 'Ruben', score: 0, position: 1, answeredCurrentRound: false },
      currentRound: { roundId: room.roundId, countdownEndsAt: room.countdownEndsAt },
      scoreboard: { top: [], self: {} },
    });
  }

  // PROTOCOL.md §Reconnect stap 5: "Na verbinding vraagt client altijd een
  // snapshot." — gemodelleerd als een expliciet client->server event, in
  // plaats van de server de snapshot synchroon tijdens `connect()` te laten
  // pushen (dat zou vóór de client's `on('room:state', ...)`-registratie
  // aankomen — de fake transportlaag heeft geen wachtrij/microtask-uitstel,
  // zie `./fake-transport.mjs`).
  socketServer.onConnection((socket) => {
    socket.join('room_01J');
    socket.on('client:request-snapshot', ({ ack }) => {
      sendSnapshotTo(socket);
      if (ack) ack({ ok: true });
    });
  });

  const sessionToken = 'tok_player1';
  const firstConnectionAuth = { sessionToken, protocolVersion: 'v1' };
  const clientBeforeCrash = socketServer.connect(firstConnectionAuth);
  clientBeforeCrash.on('room:state', (snapshot) => {
    phaseSequenceObservedByClient.push(snapshot.room.phase);
    roundIdsObservedByClient.push(snapshot.currentRound.roundId);
  });
  clientBeforeCrash.emit('client:request-snapshot', 'act_snapshot_before_crash', {}, () => {});

  // Simuleer de crash: alle in-memory verbindingen/rooms van de fake
  // transportlaag verdwijnen. De fake-Redis-stand-in (los van dit harnas)
  // overleeft, exact zoals ARCHITECTURE.md §10 beschrijft.
  socketServer.restart();

  // Modelleert ARCHITECTURE.md §10's eerste stap ná herstel: actieve rooms
  // worden gevonden en tijdelijk gepauzeerd — vóórdat enige client
  // gereconnect is.
  pauseActiveRoomsAfterRestart(redisStore);

  // Reconnect-handshake: hergebruikt exact hetzelfde
  // { sessionToken, protocolVersion }-schema als de eerste handshake.
  const validateSocketAuthPayload = adaptSocketAuthValidator(parseSocketAuthPayload);
  const handshakeAfterRestart = buildReconnectSocketAuth(sessionToken, validateSocketAuthPayload);

  const clientAfterReconnect = socketServer.connect(handshakeAfterRestart.ok ? handshakeAfterRestart.payload : firstConnectionAuth);
  clientAfterReconnect.on('room:state', (snapshot) => {
    phaseSequenceObservedByClient.push(snapshot.room.phase);
    roundIdsObservedByClient.push(snapshot.currentRound.roundId);
  });
  clientAfterReconnect.emit('client:request-snapshot', 'act_snapshot_after_reconnect', {}, () => {});

  // Hervatten met een nieuwe, kortere countdown — zelfde roundId, geen fase
  // stilzwijgend overgeslagen.
  resumeWithNewCountdown(redisStore, 1785623412000 + 5_000);
  socketServer.toRoom('room_01J').emit('room:state', {
    protocolVersion: 'v1',
    serverTime: 1785623412000 + 5_000,
    room: {
      code: '482917',
      phase: redisStore.getRoom().phase,
      locked: false,
      allowLateJoin: true,
      joinUrl: 'https://play.aseso.nl/j/N4x7pQm2K8tW',
      playerCount: 1,
      config: {},
      matchId: redisStore.getRoom().matchId,
    },
    self: { roles: ['player'], playerId: 'p_8f42d1', effectiveName: 'Ruben', score: 0, position: 1, answeredCurrentRound: false },
    currentRound: { roundId: redisStore.getRoom().roundId, countdownEndsAt: redisStore.getRoom().countdownEndsAt },
    scoreboard: { top: [], self: {} },
  });

  const roundIdConsistentAcrossRestart = roundIdsObservedByClient.every((id) => id === 'round_07');
  const pauseOnRecoveryOk =
    phaseSequenceObservedByClient[1] === 'PAUSED' &&
    phaseSequenceObservedByClient[2] === 'ROUND_ACTIVE' &&
    roundIdConsistentAcrossRestart;

  const reconnectOk =
    handshakeAfterRestart.ok === true &&
    resendAfterAck.ok === true &&
    resendAfterAck.resend === false &&
    resendWithoutAck.ok === true &&
    resendWithoutAck.resend === true &&
    resendWithoutAck.actionId === 'act_last';

  return {
    reconnectOk,
    pauseOnRecoveryOk,
    backoffDelays,
    resendAfterAck,
    resendWithoutAck,
    handshakeAfterRestart,
    phaseSequenceObservedByClient,
    roundIdConsistentAcrossRestart,
  };
}
