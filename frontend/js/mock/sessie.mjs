// mock/sessie.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK: `connect` en de "Fake socket"-toegangscontrole
// (`requireSession`, `requireRole`) uit transport-mock.mjs, plus `persist`
// (stond bovenaan `createMockTransport`, vlak bij `rearmTimer`). Geen
// gedragsverandering.
//
// Deze functies lazen in het bronbestand rechtstreeks de instantie-eigen
// `room`/`onStateChange` uit de sluiting van `createMockTransport`. Dat kan
// hier niet meer (geen eigen mock-instantie), dus krijgen ze een `ctx` mee:
// hetzelfde, éénmalig door transport-mock.mjs opgebouwde object dat ook
// mock/events.mjs gebruikt. `persist`/`buildSnapshot`/`handleSend` staan er
// als vaste velden op zodat dit bestand ze niet hoeft te importeren uit
// transport-mock.mjs zelf (dat zou een kringverwijzing zijn: transport-
// mock.mjs importeert juist `connect` van hier).
import { emit } from './events.mjs';
import { ProtocolError } from './protocol-error.mjs';

/** Bewaart de huidige room, als er een is en er iets luistert. */
export function persist(ctx) {
  if (ctx.room !== null && typeof ctx.onStateChange === 'function') {
    ctx.onStateChange(ctx.serializeRoomState(ctx.room));
  }
}

export function requireSession(code, sessionToken, ctx) {
  if (ctx.room === null || ctx.room.gameCode !== code) {
    throw new ProtocolError('GAME_NOT_FOUND', 'No room for this code.');
  }
  const session = ctx.room.sessions.get(sessionToken);
  if (session === undefined) {
    throw new ProtocolError('TOKEN_INVALID', 'Unknown sessionToken.');
  }
  return { targetRoom: ctx.room, session };
}

export function requireRole(hasRole, code) {
  if (!hasRole) {
    throw new ProtocolError(code, `Action not permitted for this session (${code}).`);
  }
}

// Correctie 2 (transport-contract-response.md): `connect` neemt nu een
// `handlers`-object (`onEvent` + `onStatus`) i.p.v. kaal `onEvent`.
// `reconnect-state.mjs` heeft `onStatus` nodig om connecting/connected/
// disconnected te kunnen tonen. Dit is een single-process mock zonder echt
// netwerk om te laten falen, dus er is geen backoff te simuleren — wél de
// normale status-overgangen bij verbinden/sluiten, synchroon genoeg om
// `reconnect-state`'s conventie (dispatch eerst, vraag dan pas iets op) te
// kunnen testen.
export function connect(sessionToken, handlers, ctx) {
  const safeHandlers = handlers !== null && typeof handlers === 'object' ? handlers : {};
  const onEvent = typeof safeHandlers.onEvent === 'function' ? safeHandlers.onEvent : () => {};
  const onStatus = typeof safeHandlers.onStatus === 'function' ? safeHandlers.onStatus : () => {};

  if (ctx.room === null || !ctx.room.sessions.has(sessionToken)) {
    // Geen geldige sessie om aan te koppelen: lever een inert paar functies
    // terug in plaats van te gooien — `connect()` zelf is synchroon en
    // heeft in het echte contract geen foutpad; elke `send()` op deze
    // connectie faalt alsnog met TOKEN_INVALID.
    onStatus('disconnected');
    return {
      send: async () => {
        throw new ProtocolError('TOKEN_INVALID', 'connect() called with an unknown sessionToken.');
      },
      close() {},
    };
  }

  onStatus('connecting');

  const listener = { onEvent };
  ctx.room.listeners.set(sessionToken, listener);

  // Zelfde gewoonte als een reconnect (PROTOCOL.md §Reconnect, punt 5): de
  // net verbonden sessie krijgt meteen een volledige snapshot, in plaats
  // van te wachten op de eerstvolgende faseovergang.
  queueMicrotask(() => {
    if (ctx.room !== null && ctx.room.listeners.get(sessionToken) === listener) {
      onStatus('connected');
      emit(listener, 'room:state', ctx.buildSnapshot(ctx.room, sessionToken), ctx);
    }
  });

  return {
    send: (event, actionId, payload) => ctx.handleSend(sessionToken, event, actionId, payload),
    close() {
      if (ctx.room !== null) {
        ctx.room.listeners.delete(sessionToken);
      }
      onStatus('disconnected');
    },
  };
}
