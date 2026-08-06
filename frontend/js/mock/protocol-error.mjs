// mock/protocol-error.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK uit transport-mock.mjs. Geen gedragsverandering.
// Elk van de andere mock/*.mjs-bestanden gooit deze fout bij een protocolschending
// (verkeerde fase, onbekende speler, ontbrekende rol, ...) — dezelfde vorm die
// `handleSend` in transport-mock.mjs al ving en als ack-fout doorgaf.

export class ProtocolError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.name = 'ProtocolError';
    this.code = code;
  }
}
