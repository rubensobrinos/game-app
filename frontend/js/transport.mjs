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
// Contract: docs/frontend-plan/prompts/UI0-scaffold.md §Transport-interfacecontract.

/**
 * @typedef {{
 *   createGame: (config: object) => Promise<object>,
 *   previewInvite: (inviteId: string) => Promise<object>,
 *   joinGame: (request: object) => Promise<object>,
 *   fetchState: (code: string, sessionToken: string) => Promise<object>,
 *   leaveGame: (code: string, sessionToken: string) => Promise<void>,
 *   fetchServerTime: () => Promise<{ serverTime: number }>,
 *   connect: (sessionToken: string, onEvent: (envelope: object) => void) => { send: (event: string, actionId: string, payload: object) => Promise<object>, close: () => void },
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
