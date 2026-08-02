// server/index.mjs — FASE 1-PLACEHOLDER, bewust dependency-vrij (node:http).
//
// Dit is NIET de game-server uit ARCHITECTURE.md. Dit proces bestaat zodat de
// fase 1-containerstack (compose + Caddy + healthchecks) volledig kan draaien
// en getest kan worden vóórdat de echte server (AR5/AR6: Fastify + Socket.IO,
// rooms, state machine, scoring) er is. Zodra die er is vervangt hij dit
// bestand; het HTTP-contract hieronder (/healthz, /readyz, /api/v1/time) is
// alvast conform DEPLOYMENT-AND-TESTING.md en PROTOCOL.md.
//
// Wat dit bewust WEL doet:
//   - /healthz     → 200 zolang het proces leeft (voor compose/Caddy-checks);
//   - /readyz      → 503 met reden: Redis/DB-checks bestaan nog niet;
//   - /api/v1/time → { serverTime } in epoch-ms (PROTOCOL.md, tijdsync);
//   - overige /api/* en /socket.io/* → 501 NOT_IMPLEMENTED, JSON-foutvorm
//     conform PROTOCOL.md (foutcode + veilige metadata, geen stacktraces).
//
// Wat dit bewust NIET doet: rooms, sessies, sockets, state. Geen logging van
// IP's of namen (DATA-MODEL.md, privacyduiding).

import http from 'node:http';

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);

/** Gestructureerde JSON-logregel zonder persoonsgegevens. */
function log(level, msg, extra = {}) {
  process.stdout.write(`${JSON.stringify({ t: Date.now(), level, msg, ...extra })}\n`);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'x-content-type-options': 'nosniff',
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://internal');

  if (url.pathname === '/healthz') {
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === '/readyz') {
    // Eerlijk 503: er is nog geen Redis- of databaseverbinding om te checken.
    return sendJson(res, 503, { ok: false, reason: 'placeholder: game-server (AR5/AR6) nog niet gebouwd' });
  }

  if (url.pathname === '/api/v1/time') {
    return sendJson(res, 200, { serverTime: Date.now() });
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return sendJson(res, 501, { code: 'NOT_IMPLEMENTED', meta: { hint: 'game-server volgt in AR5/AR6' } });
  }

  return sendJson(res, 404, { code: 'GAME_NOT_FOUND', meta: {} });
});

server.listen(PORT, () => log('info', 'placeholder-game-server gestart', { port: PORT }));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    log('info', 'afsluiten', { signal });
    server.close(() => process.exit(0));
  });
}
