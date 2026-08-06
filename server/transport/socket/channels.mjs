// server/transport/socket/channels.mjs — refactor 6 (docs/openstaand/refactor/6-socket.md).
// Verplaatst LETTERLIJK uit socket.mjs. Geen gedragsverandering.
// Twee van de zeven publieke exports van socket.mjs (dat bestand re-exporteert
// ze); daarnaast gebruikt door handshake.mjs, publiceren.mjs en
// clientevents.mjs — vandaar hier en niet in socket.mjs zelf, dat zou een
// kringverwijzing zijn (socket.mjs importeert immers de functies van díe
// bestanden).

/** Socket.IO-roomnaam per game-room. Prefix zodat hij nooit botst met socket.id. */
export function roomChannel(roomId) {
  return `room:${roomId}`;
}

/** Socket.IO-roomnaam per sessie — de drager van `single_session`-events. */
export function sessionChannel(sessionId) {
  return `sess:${sessionId}`;
}
