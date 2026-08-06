// transport/protocol.mjs — refactor 9 (docs/openstaand/refactor/9-transport-client.md).
// `PROTOCOL_VERSION`, `TRANSPORT_ERROR_CODES` en `ProtocolError` — verplaatst
// LETTERLIJK uit `transport.mjs`, dat nu een re-exporterende facade is (zie
// dat bestand). Geen gedragsverandering.
//
// ─────────────────────────────────────────────────────────────────────────────
// FOUTMECHANISME — ÉÉN PAD
//
// Elke afwijzing, van REST én van `send()` (transport/verbinding.mjs), wordt
// een `ProtocolError` met `.code` gezet op de `PROTOCOL.md`-foutcode, zodat
// `messageForErrorCode(err.code)` er direct op kan (correctie 3). Twee codes
// zijn TRANSPORTcodes en staan bewust NIET in `PROTOCOL.md`:
//
//   `NETWORK_ERROR`  — de request/socket kwam niet bij de server aan;
//   `NOT_CONNECTED`  — `send()` terwijl er geen open socket is.
//
// Allebei vallen ze in `messageForErrorCode` op `UNKNOWN_ERROR` terug, wat de
// bedoeling is: de UI heeft er geen eigen tekst voor. Hetzelfde geldt voor de
// `INTERNAL_ERROR`-marker die `rest.mjs` bij een 500 stuurt — die wordt
// ongewijzigd doorgegeven en is dus ook `UNKNOWN_ERROR`.
//
// Dit is de ENIGE plek die `TRANSPORT_ERROR_CODES` en `ProtocolError` kent —
// `transport/verbinding.mjs` importeert ze hiervandaan in plaats van een
// eigen foutklasse te bouwen. Niet twee soorten fouten laten ontstaan door ze
// over bestanden te verdelen.

export const PROTOCOL_VERSION = 'v1';

/**
 * Transportcodes. Bewust géén `PROTOCOL.md`-codes: ze staan niet in
 * `KNOWN_ERROR_CODES` en vallen dus in `messageForErrorCode` terug op
 * `UNKNOWN_ERROR`.
 */
export const TRANSPORT_ERROR_CODES = Object.freeze({
  NETWORK: 'NETWORK_ERROR',
  NOT_CONNECTED: 'NOT_CONNECTED',
});

/**
 * Fout met een `PROTOCOL.md`-foutcode op `.code`.
 * `messageForErrorCode(err.code)` kan er direct op.
 */
export class ProtocolError extends Error {
  /**
   * @param {string} code
   * @param {string} [message]
   * @param {Record<string, unknown>} [meta]
   */
  constructor(code, message, meta = {}) {
    super(message ?? code);
    this.name = 'ProtocolError';
    this.code = code;
    this.meta = meta;
  }
}
