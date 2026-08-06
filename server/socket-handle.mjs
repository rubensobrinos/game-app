// ─────────────────────────────────────────────────────────────────────────────
// Socketlaag — gebouwd door een andere agent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   close: () => Promise<void>,
 *   broadcastPlayerChanged?: (roomId: string, delta: { type: string, playerId: string }) => Promise<void>,
 *   sendSnapshot?: (roomId: string, sessionId: string) => Promise<{ ok: boolean }>,
 * }} SocketHandle
 */

/**
 * Haakt `server/transport/socket.mjs` aan wanneer dat bestand bestaat.
 *
 * Gereserveerde vorm (afgesproken met de socket-agent):
 *
 *   attachSocketServer(httpServer, { context, config }) → { close(): Promise<void> }
 *
 * Bestaat het bestand nog niet, dan gebeurt er niets — de REST-laag draait
 * zelfstandig. Alleen een ontbrekende module wordt geslikt; een module die
 * bestaat maar bij het laden stukgaat moet zichtbaar falen.
 *
 * @param {import('node:http').Server} httpServer
 * @param {{ context: object, config: object }} params
 * @returns {Promise<SocketHandle | null>}
 */
export async function attachSocketsIfAvailable(httpServer, { context, config }) {
  let module;
  try {
    module = await import('./transport/socket.mjs');
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      return null;
    }
    throw error;
  }
  if (typeof module.attachSocketServer !== 'function') {
    throw new TypeError('server/transport/socket.mjs bestaat maar exporteert geen attachSocketServer(httpServer, { context, config }).');
  }
  return module.attachSocketServer(httpServer, { context, config });
}


