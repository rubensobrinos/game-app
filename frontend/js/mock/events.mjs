// mock/events.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK uit transport-mock.mjs's "Broadcast / events"-kopje
// (plus `emit`, dat er hier al vlak boven stond). Geen gedragsverandering.
//
// `emit` sloot in het bronbestand rechtstreeks over de instantie-eigen
// `room`/`onStateChange` (via de geneste `persist()`) — dat kán hier niet
// meer, want dit bestand kent geen eigen mock-instantie (`createMockTransport()`
// maakt er per aanroep één). In plaats daarvan krijgt elke functie hier een
// `ctx` mee: hetzelfde, door transport-mock.mjs éénmalig opgebouwde object
// (`{ randomId, persist, ... }`) dat ook de andere mock/*.mjs-bestanden
// gebruiken om terug "naar buiten" te broadcasten of te persisteren, zonder
// dat dit bestand iets hoeft te importeren van sessie.mjs of transport-
// mock.mjs zelf (dat zou een kringverwijzing zijn — sessie.mjs's `connect`
// gebruikt namelijk júist deze `emit`). `ctx.persist` en `ctx.randomId` staan
// er al vóórdat er ooit een echte actie binnenkomt, dus deze late binding is
// geen gedragsverandering — zie transport-mock.mjs se opbouwvolgorde.

function emit(listener, event, payload, ctx) {
  listener.onEvent({
    event,
    eventId: ctx.randomId('evt'),
    serverTime: Date.now(),
    payload,
  });
  // Elke gebeurtenis die hier binnenkomt is een moment waarop een verbonden
  // speler ook echt iets nieuws ziet — precies de momenten waarop een
  // solopartij zijn voortgang niet mag kwijtraken bij een reload.
  ctx.persist(ctx);
}

export function broadcast(target, event, payload, ctx) {
  for (const listener of target.listeners.values()) {
    emit(listener, event, payload, ctx);
  }
}

export function broadcastPersonalized(target, event, buildPayloadForPlayerId, ctx) {
  for (const [sessionToken, listener] of target.listeners) {
    const session = target.sessions.get(sessionToken);
    const playerId = session?.playerId ?? null;
    emit(listener, event, buildPayloadForPlayerId(playerId), ctx);
  }
}

export function emitToSession(target, playerId, event, payload, ctx) {
  for (const [sessionToken, session] of target.sessions) {
    if (session.playerId === playerId) {
      emitToSessionToken(target, sessionToken, event, payload, ctx);
    }
  }
}

export function emitToSessionToken(target, sessionToken, event, payload, ctx) {
  const listener = target.listeners.get(sessionToken);
  if (listener !== undefined) {
    emit(listener, event, payload, ctx);
  }
}

// `connect()` in mock/sessie.mjs stuurt de eerste snapshot rechtstreeks naar
// één luisteraar (nog vóór die in `target.listeners` staat), dus buiten
// broadcast/emitToSession(Token) om — vandaar dat `emit` zelf ook geëxporteerd is.
export { emit };
