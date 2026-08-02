# `server/architecture/`

Deze map realiseert [`docs/multiplayer/ARCHITECTURE.md`](../../docs/multiplayer/ARCHITECTURE.md)
volgens het uitvoeringsplan in
[`docs/architecture-plan/README.md`](../../docs/architecture-plan/README.md). Zie
[`docs/architecture-plan/AR-PROGRESS.md`](../../docs/architecture-plan/AR-PROGRESS.md)
voor de actuele voortgang per fase en per sectie van `ARCHITECTURE.md`.

## Locatie: voorlopig

Deze plek staat naast `server/rules/` (game-rules-plan) en `server/protocol/`
(protocol-plan) en is **niet definitief**. Ze kan verschuiven zodra dit eigen
AR5/AR6-voorstel voor een serverskeleton landt en een bindende mapindeling
oplevert (`architecture`-checkpoint, always_ask — zie
[`docs/architecture-plan/README.md`](../../docs/architecture-plan/README.md#uitgangspunten)).

## Moduleformaat

- Platte JavaScript, CommonJS (`.js`, `require`/`module.exports`) — anders dan
  `server/protocol/` en `client/flow/`, die `.mjs` gebruiken. Zie de audit
  (`docs/STATUS-AUDIT-2026-08-02.md`, §2.8): dit is een bekende ESM/CJS-mix in
  de repo, nog niet opgelost.
- Typering via JSDoc, geen TypeScript.
- Testrunner: Node's ingebouwde `node --test`, altijd tegen een expliciet
  bestand, bijv. `node --test server/architecture/room-codes.test.js` — nooit
  tegen een directorypad.
- Geen `package.json`, geen enkele nieuwe dependency (alleen Node-builtins,
  met name `node:crypto`).
- Pure functies/reducers: geen Redis, sockets, HTTP, filesystem, timers of
  klok in de module zelf — alles wat de module niet zelf kan weten (tijd,
  uniciteitscontroles, pepper) komt als expliciet argument binnen.

## Modules

| Module | Fase | Verantwoordelijkheid | Status |
| --- | --- | --- | --- |
| `state-machine.js` | AR1 | Faseovergangen `LOBBY → ... → FINISHED`, `PAUSED`-bookkeeping (`transition()`) | ✅ Klaar — 132/132 tests groen |
| `room-codes.js` | AR2 | Zescijferige join-code (crypto-random, `isTaken`-hook) + `inviteId` (≥96 bits, base64url) + invite-hashindex | ✅ Klaar — 17/17 tests groen |
| `snapshot-precedence.js` | AR3 | Pure beslisregel wanneer een snapshot lokale/eventgebaseerde state mag overschrijven | ✅ Klaar — 84/84 tests groen |
| `server-time.js` | AR4 | Midpoint-offsetschatting tussen client- en serverklok uit round-trip-samples (`/api/v1/time`) | ✅ Klaar — 193/193 tests groen |

Elke module heeft een eigen `*.test.js` ernaast. Totaal:
**426/426 tests groen** (`node --test server/architecture/*.test.js`, laatst
geverifieerd 2026-08-02).

### Nog ontbrekende fases

Uit het plan ([`docs/architecture-plan/README.md`](../../docs/architecture-plan/README.md#fasering)):

| Fase | Omschrijving | Status |
| --- | --- | --- |
| AR0 | Scope-check (deze map mag bestaan) | ✅ Klaar |
| AR5 | Voorstel: server-skeleton (mapindeling + interfaces, geen draaiende code) | ⬜ Niet begonnen |
| AR6 | Proces-skeleton (echt serverproces) | ⏸️ Geblokkeerd — wacht op akkoord AR5 én op een dependency-akkoord (Fastify/Socket.IO/Redis-client, `deps`, always_ask) |
| AR7 | Schaalpad (Redis pub/sub-adapter, tweede instance, CDN) | ⏸️ Later — expliciet pas ná een werkende Fase 0/1 |

Daarnaast staat `redis-keyspace` wel in de bouwstenentabel van
`docs/architecture-plan/README.md`, maar heeft het (nog) geen eigen AR-fasenummer
gekregen — zie de openstaande actiepunten in
[`AR-PROGRESS.md`](../../docs/architecture-plan/AR-PROGRESS.md).

## Openstaande contractvragen

AR1–AR4 leggen een aantal keuzes vast die formeel bij andere document-eigenaren
liggen (bijv. `INVALID_PAUSE_STATE` niet in `PROTOCOL.md`'s foutcodelijst,
host-tempo bij `pacing: "host"`). Zie de tabel "Openstaande besluiten" in
[`docs/architecture-plan/README.md`](../../docs/architecture-plan/README.md#openstaande-besluiten)
voor de volledige lijst en wie erover gaat.
