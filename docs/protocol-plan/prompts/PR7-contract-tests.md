# Prompt — PR7: Contracttest-suite tegen fake transport

Dekt fase **PR7** uit [`../README.md`](../README.md#fasering), inclusief de
sub-batchindeling **PR7a–PR7e** exact zoals daar beschreven. Vereist PR1 (afgerond,
`server/protocol/envelope.mjs` + `idempotency.mjs`) en idealiter PR2–PR6; waar een van
die modules nog niet bestaat op het moment van uitvoeren, geldt per batch hieronder
een expliciete "bouw eerst..."-instructie in plaats van een aanname. Kopieer alles
onder **Prompt** naar een nieuwe sessie/agent-aanroep. Dit bestand is zelfstandig
leesbaar, zonder kennis van enig eerder gesprek.

---

## Prompt

Je werkt in de repo `game-app`. Lees, voordat je begint:

- [`docs/multiplayer/PROTOCOL.md`](../../multiplayer/PROTOCOL.md), volledig (dit is
  het contract dat getoetst wordt).
- [`docs/multiplayer/DEPLOYMENT-AND-TESTING.md`](../../multiplayer/DEPLOYMENT-AND-TESTING.md),
  sectie **Testlagen**, punt 2 ("Contracttests").
- [`docs/multiplayer/ARCHITECTURE.md`](../../multiplayer/ARCHITECTURE.md), §10
  ("Herstelbaarheid").
- [`docs/multiplayer/GAME-FLOW.md`](../../multiplayer/GAME-FLOW.md), edge case 14
  ("Serverproces herstart").
- [`../README.md`](../README.md), fase **PR7** en **Open vragen §2**.
- `server/protocol/envelope.mjs`, `server/protocol/idempotency.mjs` (bestaande PR1-code
  — stijl/conventie: platte `.mjs`, JSDoc, functies die nooit gooien).

### Brondocument

`DEPLOYMENT-AND-TESTING.md`, sectie **Testlagen**, punt 2, letterlijk:

> ### 2. Contracttests
>
> - alle REST-schema's;
> - alle socketevents;
> - protocolversie;
> - foutcodes;
> - snapshot bevat geen correct antwoord van actieve ronde;
> - client en server delen dezelfde contentVersion.

`../README.md`, fase PR7, letterlijk (de vijf sub-batches):

> - **PR7a** — harnas-scaffold: de fake-transportlaag zelf (event-emitter +
>   request/response-stubs), zonder nog een scenario te draaien.
> - **PR7b** — envelope/idempotentie-scenario (create → join → dubbele `actionId` →
>   idempotente ack) tegen PR1/PR2.
> - **PR7c** — REST-scenario (de 5 endpoints, inclusief de `auth-shape`-header) tegen
>   PR3.
> - **PR7d** — client-/server-eventscenario (inclusief de snapshot-invariant en de
>   `round:progress`-throttle) tegen PR4/PR5.
> - **PR7e** — reconnect-scenario (backoff, niet-herverzenden van geaccepteerde
>   antwoorden, socketauth-hergebruik) tegen PR6, plus een scenario voor
>   pauze-op-recovery → hervatten-met-nieuwe-countdown na een serverherstart (zie
>   Open vragen §2), met verwijzing naar `architecture-plan`'s
>   Redis-restart-afhandeling in plaats van die te herbouwen.

`ARCHITECTURE.md` §10, letterlijk:

> Na game-serverherstart:
>
> - actieve rooms worden gevonden via een room-index;
> - sockets reconnecten;
> - room gaat tijdelijk naar `PAUSED`;
> - actuele ronde en geaccepteerde antwoorden blijven staan;
> - hervatten gebeurt met een nieuwe korte countdown.

`GAME-FLOW.md`, edge case 14, letterlijk:

> - Redis bewaart de state;
> - actieve rooms worden bij herstel gepauzeerd;
> - clients rejoinen via snapshot;
> - de server hervat met een korte nieuwe countdown, niet door stilletjes meerdere
>   fases over te slaan.

`../README.md`, Open vragen §2 (relevant fragment), letterlijk:

> Voor dit vierde geval is bovendien onduidelijk of de pauze als live
> `game:paused`-broadcast reist (er kan op het moment van de crash niemand
> verbonden zijn) of uitsluitend zichtbaar wordt via `room.phase` in de
> post-reconnect snapshot — die ambiguïteit stond nergens anders in dit plan.

**Wat dit betekent voor PR7e:** de restart-scenario-test toetst wat ondubbelzinnig
vaststaat (room → `PAUSED` → reconnect via snapshot → hervatten met nieuwe korte
countdown, nooit stilzwijgend fases overslaan), en toetst expliciet **niet** bindend
of er ook een live `game:paused`-broadcast reist — dat blijft open totdat de
`PROTOCOL.md`-eigenaar die vraag beantwoordt.

### Locatie (bevestig vóór aanmaken)

Voorstel: `tests/contract/protocol/` — de repo heeft al een lege
`tests/contract/.gitkeep` die precies op deze testlaag anticipeert
(`DEPLOYMENT-AND-TESTING.md` §Testlagen punt 2). Dit is een nieuwe map buiten
`server/protocol/`; meld dit voorstel en wacht op bevestiging vóór je er bestanden in
aanmaakt, zoals ook bij GR0/AR0/GF0 in de zusterplannen gebeurt voor nieuwe locaties.
Moduleformaat: platte `.mjs`, JSDoc, `node --test` tegen expliciete bestanden, geen
nieuwe dependency.

### Te bouwen functies, per sub-batch

#### PR7a — harnas-scaffold

Een handgerold, dependency-vrij fake-Fastify + fake-Socket.IO-harnas. Geen scenario
draait hier al; dit levert alleen de bouwstenen voor PR7b–PR7e.

```js
/**
 * @file Fake-Fastify-stub voor contracttests. Bewust dezelfde
 * request/response-vorm als Fastify's eigen `.inject()`-testhelper, zodat een
 * latere overstap naar echte Fastify (na het `deps`-akkoord uit
 * `architecture-plan`) geen wijziging aan testcode vereist.
 */

/**
 * @typedef {{ method: 'GET' | 'POST', url: string, headers?: Record<string, string>, payload?: unknown }} FakeInjectRequest
 * @typedef {{ statusCode: number, json: () => unknown }} FakeInjectResponse
 */

/**
 * @returns {{
 *   route: (method: 'GET' | 'POST', url: string, handler: (req: FakeInjectRequest) => { statusCode: number, payload: unknown }) => void,
 *   inject: (req: FakeInjectRequest) => FakeInjectResponse,
 * }}
 */
export function createFakeFastify() {
  /* ... */
}

/**
 * @typedef {{
 *   id: string,
 *   emit: (event: string, actionId: string, payload: object, onAck?: (ack: unknown) => void) => void,
 *   on: (event: string, handler: (payload: unknown) => void) => void,
 *   disconnect: () => void,
 * }} FakeClientSocket
 */

/**
 * Fake Socket.IO-server: in-memory event-routing, geen netwerk, geen timers.
 * `restart()` simuleert een serverherstart (PR7e): alle in-memory
 * verbindingen/rooms worden weggegooid, alsof het proces net is herstart —
 * wat wél/niet aan geaccepteerde antwoorden en roomfase overleeft, bepaalt de
 * aanroepende testscenario expliciet via de meegegeven fake-Redis-achtige
 * stand-in, niet dit harnas zelf.
 *
 * @returns {{
 *   onConnection: (handler: (socket: FakeClientSocket, authPayload: unknown) => void) => void,
 *   connect: (authPayload: object) => FakeClientSocket,
 *   toRoom: (roomId: string) => { emit: (event: string, payload: object) => void },
 *   restart: () => void,
 * }}
 */
export function createFakeSocketServer() {
  /* ... */
}

/**
 * In-memory `ActionStore` die exact het interfacecontract van
 * `server/protocol/idempotency.mjs` implementeert (`get`/`set`), voor
 * hergebruik in PR7b–PR7e — geen nieuwe idempotentielogica, alleen een fake
 * bewaarplaats.
 *
 * @returns {{ get: (actionId: string) => (unknown | undefined), set: (actionId: string, ack: unknown) => void }}
 */
export function createInMemoryActionStore() {
  /* ... */
}
```

#### PR7b — envelope/idempotentie-scenario (tegen PR1/PR2)

```js
/**
 * Draait create → join → `round:answer` met dubbele `actionId` →
 * idempotente ack, tegen de fake-transportlaag (PR7a) en de échte PR1-code
 * (`parseClientEnvelope`, `buildAck`, `resolveDuplicateAction` uit
 * `server/protocol/envelope.mjs`/`idempotency.mjs`). Als
 * `server/protocol/error-codes.mjs` (PR2) nog niet bestaat op het moment van
 * uitvoeren: bouw eerst PR2 (zie `../README.md`) voor de `ALREADY_ANSWERED`-
 * foutcode-mapping — implementeer 'm niet losstaand hier.
 *
 * @param {ReturnType<typeof createFakeSocketServer>} socketServer
 * @param {ReturnType<typeof createInMemoryActionStore>} actionStore
 * @param {{ parseClientEnvelope: Function, buildAck: Function, resolveDuplicateAction: Function }} m1
 * @returns {{ firstAck: unknown, retryAck: unknown, mutationCount: number }}
 */
export function runEnvelopeIdempotencyScenario(socketServer, actionStore, m1) {
  /* ... */
}
```

#### PR7c — REST-scenario (tegen PR3)

```js
/**
 * Draait de 5 REST-endpointscenario's (create, join, state, leave, time)
 * tegen de fake-Fastify-stub (PR7a) en PR3's schema's/validators
 * (`server/protocol/rest-games.mjs`, `auth-shape.mjs`, `input-safety.mjs`).
 * De exacte exportnamen van PR3 zijn op het moment van schrijven van dit
 * prompt nog niet vastgelegd — gebruik de daadwerkelijke namen zoals PR3 die
 * oplevert; bouw PR3 eerst als het nog niet bestaat.
 *
 * @param {ReturnType<typeof createFakeFastify>} fastify
 * @param {Record<string, Function>} restGamesModule - PR3's exports
 * @returns {Array<{ endpoint: string, statusCode: number, ok: boolean }>}
 */
export function runRestEndpointScenario(fastify, restGamesModule) {
  /* ... */
}
```

#### PR7d — client-/server-eventscenario (tegen PR4/PR5)

```js
/**
 * Toetst: onbekend event-type → `UNSUPPORTED_EVENT` (via PR4's
 * `resolveEventValidator`), de snapshot-invariant ("geen correct antwoord
 * van een actieve ronde", PR5d), en de `round:progress`-throttle (PR5e,
 * `throttleRoundProgress`, max 2x/seconde). Bouw PR4/PR5 eerst als de
 * betreffende module nog niet bestaat.
 *
 * @param {ReturnType<typeof createFakeSocketServer>} socketServer
 * @param {{ resolveEventValidator: Function, throttleRoundProgress: Function, snapshotHasNoActiveAnswer: Function }} deps
 * @returns {{ scenarios: Array<{ name: string, passed: boolean }> }}
 */
export function runEventAndSnapshotScenario(socketServer, deps) {
  /* ... */
}
```

#### PR7e — reconnect-scenario + pauze-op-recovery (tegen PR6)

```js
/**
 * Toetst de backoff-reeks, de niet-herverzenden-regel en de
 * socketauth-hergebruikwrapper uit PR6 (`server/protocol/reconnect.mjs`),
 * plús het restart-scenario: `socketServer.restart()` tijdens
 * `ROUND_ACTIVE` → room naar `PAUSED` → reconnect via snapshot → hervatten
 * met nieuwe korte countdown (ARCHITECTURE.md §10, GAME-FLOW.md edge case
 * 14) — `architecture-plan` heeft hiervoor nog geen eigen fase/bouwsteen
 * (alleen ARCHITECTURE.md §10 beschrijft dit gedrag in proza, als
 * brontekst); dit scenario bouwt daarom voorlopig een eigen fake-Redis-
 * stand-in (geen echte Redis), in afwachting van die fase, in plaats van
 * iets bestaands in `architecture-plan` aan te roepen of na te bouwen.
 *
 * @param {ReturnType<typeof createFakeSocketServer>} socketServer
 * @param {{ backoffDelaySeconds: Function, resolveReconnectResend: Function, buildReconnectSocketAuth: Function }} m6
 * @returns {{ reconnectOk: boolean, pauseOnRecoveryOk: boolean }}
 */
export function runReconnectScenario(socketServer, m6) {
  /* ... */
}
```

### Verplichte testgevallen

| # | Batch | Scenario | Verwacht |
| --- | --- | --- | --- |
| 1 | PR7a | `createFakeFastify().route(...)` + `.inject(...)` voor een simpele GET | `statusCode`/`payload` komen ongewijzigd terug, geen netwerkcode aangesproken |
| 2 | PR7a | `createFakeSocketServer().connect(authPayload)` + `onConnection`-handler | server ontvangt exact dezelfde `authPayload` als de client verstuurde |
| 3 | PR7a | `toRoom(id).emit(...)` met twee sockets in room A en één in room B | alleen de twee A-sockets ontvangen het event |
| 4 | PR7a | `createInMemoryActionStore()` tegen PR1's echte `resolveDuplicateAction` | werkt zonder aanpassing — bewijst dat de fake store het `ActionStore`-contract correct implementeert |
| 5 | PR7a | `socketServer.restart()` | alle bestaande verbindingen/rooms zijn weg; een nieuwe `connect()` na restart werkt weer normaal |
| 6 | PR7b | create → join → `round:answer` (actionId A) → ack | `ok: true`, `mutationCount === 1` |
| 7 | PR7b | retry met dezelfde actionId A | identieke ack als in rij 6, `mutationCount` blijft `1` |
| 8 | PR7b | nieuwe actionId B, zelfde antwoordinhoud, ná acceptatie | `ALREADY_ANSWERED`, `mutationCount` blijft `1` |
| 9 | PR7b | nieuwe actionId C, ánder antwoord, ná acceptatie | `ALREADY_ANSWERED`, `mutationCount` blijft `1` |
| 10 | PR7b | payload groter dan de afgesproken limiet, vóór envelope-parse | geweigerd door `assertPayloadSize`, `parseClientEnvelope` wordt niet aangeroepen |
| 11 | PR7c | `POST /api/v1/games` met een geldig voorbeeldpayload uit `PROTOCOL.md` | 2xx, responsvorm exact zoals het `PROTOCOL.md`-voorbeeld |
| 12 | PR7c | `POST /api/v1/games/join` met zowel `inviteId` als `gameCode` tegelijk | validatiefout — "precies één locator" wordt geschonden |
| 13 | PR7c | `GET /api/v1/games/{code}/state` zonder `Authorization`-header | `auth-shape`-afwijzing (bijv. `TOKEN_INVALID`), geen 5xx |
| 14 | PR7c | `GET /api/v1/time` | responsvorm `{ serverTime: number }` |
| 15 | PR7c | `POST /api/v1/games/{code}/leave` met een hostsessie zonder spelerrol | `NOT_PLAYER`-achtige afwijzing |
| 16 | PR7d | onbekend event-type naar de socketserver | `UNSUPPORTED_EVENT` via `resolveEventValidator` |
| 17 | PR7d | snapshot direct na join tijdens `ROUND_ACTIVE` | bevat geen correct antwoord van de actieve ronde (snapshot-invariant) |
| 18 | PR7d | 5 aanroepen van de `round:progress`-broadcastpoging binnen 1 seconde, zelfde ronde | `throttleRoundProgress` staat maximaal 2 emissies toe |
| 19 | PR7d | `round:answer`-payload met een `sessionToken`-achtig veld erin | geweigerd (cross-cutting negatieve test uit PR4, Basisregel 3) |
| 20 | PR7e | socket valt weg, client doet 6 reconnectpogingen | vertragingen exact `[1, 2, 4, 8, 16, 30]` volgens PR6's `backoffDelaySeconds` |
| 21 | PR7e | reconnect terwijl het laatste antwoord al een ack had | niet opnieuw verzonden (`resolveReconnectResend` → `resend: false`) |
| 22 | PR7e | reconnect zonder ontvangen ack op het laatste antwoord | exact dezelfde `actionId` herhaald, nooit een nieuwe |
| 23 | PR7e | `socketServer.restart()` midden in `ROUND_ACTIVE` | room-fase wordt `PAUSED`; na reconnect + snapshot toont de client `PAUSED` gevolgd door hervatten met een nieuwe, kortere countdown — geen fase wordt stilzwijgend overgeslagen |
| 24 | PR7e | reconnect-handshake ná een restart | `buildReconnectSocketAuth` gebruikt exact hetzelfde `{sessionToken, protocolVersion}`-schema als de eerste handshake, geen apart schema |

### Niet in scope voor PR7

- Een echt draaiend Fastify- of Socket.IO-proces, een echte Redis-verbinding — het
  harnas blijft volledig in-memory en dependency-vrij; dat is precies het punt.
- Herimplementeren van PR1–PR6's eigen logica binnen dit harnas — de scenario's roepen
  de echte modules aan (of, als een module nog niet bestaat, wordt die eerst gebouwd
  volgens zijn eigen faseprompt) in plaats van een kopie te maken.
- Een echte Redis-herstelimplementatie bouwen: `architecture-plan` kent hiervoor nog
  geen eigen fase/bouwsteen (alleen ARCHITECTURE.md §10 beschrijft het gedrag in
  proza, als brontekst) — PR7e bouwt daarom voorlopig een eigen fake-stand-in in
  afwachting van die fase, in plaats van iets bestaands in `architecture-plan` na te
  bouwen.
- Daadwerkelijk procesbeheer (pm2, systemd, health checks) rond een echt
  serverproces — dat is `DEPLOYMENT-AND-TESTING.md`/`prod`.
- Load- en chaostests (`tests/load`, `tests/chaos`) — andere testlagen, buiten dit
  plan.
- Het bindend beslissen of de pauze-op-recovery als live `game:paused`-broadcast
  reist — dat blijft Open vraag §2, hier alleen getoetst voor zover ondubbelzinnig.

### Definition of done

- Alle 24 rijen uit de testtabel slagen.
- Het fake-Fastify-harnas heeft dezelfde `inject()`-vorm als echte Fastify (route +
  request/response met `statusCode`/`json()`), zodat een latere vervanging door de
  echte library geen testcode-wijziging vereist.
- Nul nieuwe dependencies; alles draait via `node --test` tegen expliciete bestanden.
- Elke sub-batch (PR7a–PR7e) is een eigen actie/commit binnen de autonomiegrens uit
  `CLAUDE.md` (≤15 bestanden, ≤5.000 regels); geen enkele batch overschrijdt dat budget.
- Waar een afhankelijke module (PR2–PR6) nog niet bestond bij aanvang van een batch, is
  die eerst gebouwd volgens zijn eigen faseprompt — niet lokaal binnen dit harnas
  nagebootst met een permanent karakter (tijdelijke fakes voor PR7a zelf, zoals de
  in-memory action store, zijn wel toegestaan; die vervangen geen protocol-logica,
  alleen opslag).
