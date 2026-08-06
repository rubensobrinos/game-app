// transport.mjs — INT-A stap 2. De ECHTE `Transport`: HTTP tegen
// `server/transport/rest.mjs` en een Socket.IO-verbinding tegen
// `server/transport/socket.mjs`.
//
// Spiegelt de vorm van `transport-mock.mjs` exact, zodat de swap mock → echt
// één import is (`createMockTransport()` → `createTransport({ baseUrl })`).
// Contract: `docs/integration-plan/transport-contract-response.md` (de vier
// bevestigde correcties op `docs/frontend-plan/HANDOFF-UI.md` UI-1) en
// `docs/multiplayer/PROTOCOL.md`. Waar dit document en de server van elkaar
// afwijken wint de server; die afwijkingen staan bij de submodules benoemd.
//
// ─────────────────────────────────────────────────────────────────────────────
// WAT DIT BESTAND WEL EN NIET DOET
//
// WEL: HTTP-vorm, socket-wireformaat, ack-correlatie, backoff, en het
//      TOEPASSEN van de snapshot-precedentieregel op binnenkomende state.
// NIET: domeinlogica, protocolvalidatie van payloads, foutcode-vertaling
//      (dat is `client/flow/edge-case-messaging.mjs`), en vooral: geen tweede
//      implementatie van de precedentieregel of van de backoff-formule.
//      Beide worden geïmporteerd:
//        - `shouldApplySnapshot` / `shouldApplyEvent`
//          ← `shared/protocol/snapshot-precedence.mjs` (via transport/precedentie.mjs)
//        - `backoffDelayMs` / `transition` / `nextActionFor`
//          ← `client/flow/reconnect-state.mjs` (via transport/verbinding.mjs)
//
// ─────────────────────────────────────────────────────────────────────────────
// REFACTOR 9 (docs/openstaand/refactor/9-transport-client.md, geen
// gedragsverandering): dit bestand was 978 regels — REST, socket,
// herverbinden, de precedentiepoort en de foutklasse allemaal in één. Het is
// nu een re-exporterende facade langs zijn eigen kopjes, zodat er weer maar
// één ding per bestand verandert:
//
//   transport/protocol.mjs      → PROTOCOL_VERSION, TRANSPORT_ERROR_CODES,
//                                  ProtocolError. Ook de "één foutpad"-regel:
//                                  elke afwijzing wordt hier, en alleen hier,
//                                  een ProtocolError.
//   transport/verbinding.mjs    → createTransport (REST + de socket). Ook de
//                                  twee andere vastliggende regels: geen
//                                  socket.io-client als dependency, en het
//                                  sessietoken nooit in een URL.
//   transport/precedentie.mjs   → createSnapshotPrecedenceGate — DE POORT die
//                                  bepaalt of een snapshot of een event de
//                                  waarheid is. Letterlijk verplaatst, de
//                                  volgorde van de afwegingen is ongewijzigd.
//   transport/helpers.mjs       → normalizeBaseUrl, safeJsonParse,
//                                  readHandshakeErrorCode (en readObject/
//                                  readString) — puur intern, hieronder niet
//                                  opnieuw geëxporteerd.
//
// De regels staan nu bij de submodule die ze afdwingt, niet hier herhaald —
// twee versies van dezelfde regel is precies wat dit soort opsplitsingen wil
// voorkomen. De publieke exports blijven exact gelijk, ook voor wie ze uit
// transport.mjs blijft importeren (`app.mjs`, `transport.test.mjs`).

/** @typedef {import('./transport/verbinding.mjs').Transport} Transport */

export { PROTOCOL_VERSION, TRANSPORT_ERROR_CODES, ProtocolError } from './transport/protocol.mjs';
export { createTransport } from './transport/verbinding.mjs';
export { createSnapshotPrecedenceGate } from './transport/precedentie.mjs';
