// transport.mjs — UI0. Vastlegging van het `Transport`-interfacecontract dat
// UI1–UI5 tegen programmeren. Bevat GEEN implementatie: dit bestand is een
// placeholder tot INT-A's stap 2 (de echte transportlaag, over HTTPS/
// Socket.IO tegen een draaiende server) hier landt. Tot dan levert
// `transport-mock.mjs` een in-memory fake met exact dezelfde vorm.
//
// Elke functie geeft de payload/response terug **exact zoals PROTOCOL.md ze
// beschrijft** (`POST /api/v1/games`, `GET /api/v1/games/preview`
// (invite-only), `POST /api/v1/games/join`, `GET /api/v1/games/{code}/state`,
// `POST /api/v1/games/{code}/leave`, `GET /api/v1/time`, en de socket-envelope
// voor client<->server events). Foutresponses gooien een `Error` met `.code`
// gezet op de PROTOCOL.md-foutcode, zodat een aanroeper
// `edge-case-messaging.messageForErrorCode(err.code)` direct kan gebruiken.
//
// Contract: docs/frontend-plan/prompts/UI0-scaffold.md §Transport-interfacecontract,
// bijgesteld met de vier correcties uit INT-A's antwoord op HANDOFF-UI.md UI-1
// (docs/integration-plan/transport-contract-response.md):
//   1. createGame(request) i.p.v. createGame(config) -- request bevat
//      { config, hostParticipates, displayName }, symmetrisch met joinGame.
//   2. connect() krijgt een handlers-object met zowel onEvent als onStatus
//      ('connecting'|'connected'|'disconnected') -- reconnect-state.mjs moet
//      dit voeden. De transportlaag doet zelf de backoff; de UI vraagt zelf
//      een snapshot op na een herverbinding (snapshot boven events).
//   3. send() verwerpt ook bij een formele { ok: false }-ack, met dezelfde
//      Error+.code-vorm als de REST-functies -- één foutmechanisme, geen
//      apart ok-veld dat elk aanroeppunt ook nog moet checken.
//   4. actionId blijft van de UI (bevestigd, geen interfacewijziging): bij een
//      retry na een weggevallen ack hoort dezelfde actionId hergebruikt te
//      worden, nooit een nieuwe (anders ALREADY_ANSWERED i.p.v. de
//      oorspronkelijke ack). Zie ook HANDOFF.md INT-14 (een bekend, apart
//      poortprobleem -- niet iets om in de UI omheen te bouwen).

/**
 * @typedef {{
 *   createGame: (request: { config: object, hostParticipates: boolean, displayName: string | null }) => Promise<object>,
 *   previewInvite: (inviteId: string) => Promise<object>,
 *   joinGame: (request: object) => Promise<object>,
 *   fetchState: (code: string, sessionToken: string) => Promise<object>,
 *   leaveGame: (code: string, sessionToken: string) => Promise<void>,
 *   fetchServerTime: () => Promise<{ serverTime: number }>,
 *   connect: (sessionToken: string, handlers: {
 *     onEvent: (envelope: object) => void,
 *     onStatus: (status: 'connecting' | 'connected' | 'disconnected') => void,
 *   }) => { send: (event: string, actionId: string, payload: object) => Promise<object>, close: () => void },
 * }} Transport
 */

/**
 * Placeholder-factory. Dit bestand levert bewust geen werkende `Transport` —
 * roep in plaats daarvan `createMockTransport()` uit `transport-mock.mjs` aan
 * voor lokale ontwikkeling, of wacht op INT-A's echte implementatie die deze
 * functie hier vervangt.
 *
 * @returns {Transport}
 */
export function createTransport() {
  throw new Error(
    'transport.mjs is a placeholder — no real Transport implementation exists yet ' +
      '(lands here once INT-A\'s stap 2 is done). Use createMockTransport() from ' +
      './transport-mock.mjs for local development.'
  );
}
