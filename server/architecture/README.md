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
| `state-machine.js` | AR1 | Faseovergangen `LOBBY → ... → FINISHED`, `PAUSED`-bookkeeping (`transition()`) | ✅ Klaar — 160/160 tests groen |
| `room-codes.js` | AR2 | Zescijferige join-code (crypto-random, `isTaken`-hook) + `inviteId` (≥96 bits, base64url) + invite-hashindex | ✅ Klaar — 25/25 tests groen |
| `server-time.js` | AR4 | Midpoint-offsetschatting tussen client- en serverklok uit round-trip-samples (`/api/v1/time`) | ✅ Klaar — 205/205 tests groen |

Elke module heeft een eigen `*.test.js` ernaast. Totaal:
**390/390 tests groen** (`node --test server/architecture/*.test.js`, laatst
geverifieerd 2026-08-02). AR3 telt daar niet meer in mee — zie hieronder.

### Verhuisd: AR3 staat niet meer in deze map

| Module | Fase | Nieuwe plek | Status |
| --- | --- | --- | --- |
| `snapshot-precedence.mjs` | AR3 | [`shared/protocol/snapshot-precedence.mjs`](../../shared/protocol/snapshot-precedence.mjs) | ✅ Klaar — 100/100 tests groen |

**Waaróm hij is verhuisd.** AR3 is de enige AR-module die niet alleen de server
maar ook de CLIENT nodig heeft: `frontend/js/transport.mjs` dwingt er
"snapshot boven events" (`PROTOCOL.md` basisregel 6) mee af, en dat gebeurt in
een browser. Op deze plek was hij daar om twee onafhankelijke redenen
onbereikbaar:

1. `server/index.mjs` mount alleen `/client/*`, `/shared/*` en `frontend/`
   statisch — `/server/architecture/snapshot-precedence.js` gaf dus een 404;
2. hij was CommonJS (`module.exports`), en dat laadt sowieso niet als ES-module
   in een browser.

Een kopie aan clientkant maken was geen optie: twee implementaties van precies
deze ordeningsregel is hoe server- en clientstate stilzwijgend uiteen gaan
lopen. `shared/` is de afgesproken plek voor modules die beide kanten delen
(`DECISIONS.md` #29, dezelfde reden als de contentmodule). De regel zelf is
ongewijzigd meeverhuisd — alleen locatie en modulesysteem zijn veranderd, en
alle 100 tests bleven groen. Er staat bewust **geen re-export-shim** achter in
deze map: één module, één plek.

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
