# Prompt — PR6: Reconnect-acceptatieregels

Dekt fase **PR6** uit [`../README.md`](../README.md#fasering). Vereist dat PR1
(`envelope`/`idempotency`, al aanwezig in `server/protocol/`) is afgerond, en dat PR3
(`auth-shape`) bestaat vóórdat de socketauth-hergebruikfunctie hieronder echt
geïmplementeerd wordt — zie de aparte notitie daarover verderop. Kopieer alles onder
**Prompt** naar een nieuwe sessie/agent-aanroep. Dit bestand is zelfstandig leesbaar,
zonder kennis van enig eerder gesprek.

---

## Prompt

Je werkt in de repo `game-app`. Lees, voordat je iets bouwt:

- [`docs/multiplayer/PROTOCOL.md`](../../multiplayer/PROTOCOL.md), sectie
  **Reconnect** en **Socket-auth**.
- [`docs/multiplayer/ARCHITECTURE.md`](../../multiplayer/ARCHITECTURE.md), §2
  ("Eén timeline per room") en §3 ("Snapshot boven event replay").
- [`docs/architecture-plan/README.md`](../../architecture-plan/README.md), de
  modulestabel-rijen `server-time`/`snapshot-precedence` en fasen **AR3**/**AR4**.
- [`../README.md`](../README.md), modulestabel-rij `reconnect` en fase **PR6**.
- `server/protocol/envelope.mjs` en `server/protocol/idempotency.mjs` (bestaande PR1-code
  — geeft de stijl/conventie: platte `.mjs`, JSDoc, functies die nooit gooien, altijd
  `{ ok: true, ... } | { ok: false, reason }`).

### Brondocument

`PROTOCOL.md`, sectie **Reconnect**, letterlijk:

> 1. Socket valt weg.
> 2. Client toont niet-blokkerende reconnectstatus.
> 3. Backoff: 1, 2, 4, 8, 16, maximaal 30 seconden.
> 4. Socketauth gebruikt dezelfde sessietoken.
> 5. Na verbinding vraagt client altijd een snapshot.
> 6. Snapshot vervangt lokale fase, score en antwoordstatus.
> 7. Een reeds geaccepteerd antwoord wordt niet opnieuw verzonden, behalve als de
>    client geen ack heeft en dezelfde `actionId` kan herhalen.

`PROTOCOL.md`, Basisregel 6: "Snapshots zijn leidend boven eerder ontvangen events."

`PROTOCOL.md`, sectie **Socket-auth**:

```json
{
  "auth": {
    "sessionToken": "<token>",
    "protocolVersion": "v1"
  }
}
```

`../README.md`, fase PR6, letterlijk:

> Dit dupliceert bewust **niet** `architecture-plan`'s AR3 (`snapshot-precedence`) of
> AR4 (`server-time`) — die bouwstenen worden hier alleen aangeroepen/gerefereerd. Wat
> hier wél nieuw is: de PROTOCOL-specifieke regel dat een reeds geaccepteerd antwoord
> niet opnieuw wordt verzonden, tenzij de client geen ack ontving en dezelfde
> `actionId` herhaalt. Socketauth bij reconnect hergebruikt exact hetzelfde
> `auth-shape`-schema (`{sessionToken, protocolVersion}`) als de eerste handshake
> (PROTOCOL.md, Reconnect-stap 4: "Socketauth gebruikt dezelfde sessietoken.") — geen
> apart reconnect-specifiek authschema, alleen een expliciete verwijzing hierheen.

`architecture-plan/README.md`, fasen AR3/AR4, letterlijk:

> ### AR3 — Snapshot-precedence
> Pure functie die bepaalt of een binnenkomende snapshot lokale/eventgebaseerde state
> moet overschrijven. Dekt zowel `ARCHITECTURE.md` §3 als de PROTOCOL.md-regel
> "Snapshots zijn leidend boven eerder ontvangen events" — gedeeld hulpmiddel, geen
> ADR namens `PROTOCOL.md`.
>
> ### AR4 — Server-time
> Midpoint-berekening uit meerdere round-trip-samples, exact zoals `PROTOCOL.md`
> `/api/v1/time` beschrijft, als pure functie met samples in, offset-schatting uit.

**Wat dit betekent voor deze module:** dit bestand implementeert géén eigen versie van
snapshot-precedence of server-time-offsetberekening. Reconnect-stappen 5–6 (snapshot
opvragen, snapshot laat lokale fase/score/antwoordstatus overschrijven) worden door de
aanroepende laag afgehandeld via `architecture-plan`'s AR3- en AR4-functies — deze module
levert alleen de drie stukken die daar niet al bestaan: de backoff-reeks, de
niet-herverzenden-regel, en de socketauth-hergebruikwrapper.

### Locatie en moduleformaat

Zelfde plek/stijl als PR1: `server/protocol/reconnect.mjs` +
`server/protocol/reconnect.test.mjs`. Platte JavaScript, JSDoc, `node --test` tegen een
expliciet bestand, geen nieuwe dependency.

### Te bouwen functies

#### 1. Backoff-reeks (pure generator)

```js
/**
 * @file Reconnect-acceptatieregels — realiseert PROTOCOL.md §Reconnect.
 * @see docs/multiplayer/PROTOCOL.md — sectie "Reconnect", Basisregel 6.
 *
 * Pure functies/generator only: geen setTimeout, geen echte socket-events,
 * geen Date.now()/Math.random() binnen de module. Eén generatorinstantie
 * representeert precies één aaneengesloten disconnect-episode; na een
 * geslaagde reconnect maakt de aanroeper een nieuwe instantie aan (de
 * volgende disconnect begint dus weer bij 1 seconde, niet waar de vorige
 * episode bleef steken).
 */

/**
 * Genereert de backoff-vertraging (in hele seconden) voor opeenvolgende
 * reconnectpogingen binnen één disconnect-episode: 1, 2, 4, 8, 16, en
 * daarna oneindig 30 — exact PROTOCOL.md §Reconnect stap 3 ("Backoff: 1, 2,
 * 4, 8, 16, maximaal 30 seconden.").
 *
 * @returns {Generator<number, never, void>} nooit `done: true`
 */
export function* backoffDelaySeconds() {
  /* ... */
}
```

#### 2. Niet-herverzenden van geaccepteerde antwoorden

```js
/**
 * @typedef {{ actionId: string, ackReceived: boolean }} PendingAnswerAction
 */

/**
 * Beslist of een `round:answer`-actie na reconnect opnieuw verzonden mag
 * worden — PROTOCOL.md §Reconnect stap 7: "Een reeds geaccepteerd antwoord
 * wordt niet opnieuw verzonden, behalve als de client geen ack heeft en
 * dezelfde `actionId` kan herhalen." Er is bewust geen los
 * `candidateActionId`-argument: de enige toegestane `actionId` bij een
 * resend is die van `pendingAnswer` zelf, nooit een nieuw gegenereerde —
 * dat maakt "dezelfde actionId herhalen" een structurele garantie in plaats
 * van een aparte check.
 *
 * @param {PendingAnswerAction | null} pendingAnswer - de laatst verzonden
 *   `round:answer`-actie voor de huidige ronde, of `null` als er nog niets
 *   verstuurd is voor deze ronde
 * @returns {{ ok: true, resend: false }
 *   | { ok: true, resend: true, actionId: string }
 *   | { ok: false, reason: string }}
 */
export function resolveReconnectResend(pendingAnswer) {
  /* ... */
}
```

#### 3. Hergebruik van het `auth-shape`-handshakeschema

```js
/**
 * @typedef {{ sessionToken: string, protocolVersion: string }} SocketAuthPayload
 */

/**
 * Bouwt en valideert de socket-handshake-payload bij reconnect. Dit is
 * bewust een dunne wrapper: de vormvalidatie zelf leeft in PR3's
 * `auth-shape`-module (`server/protocol/auth-shape.mjs`, zodra die bestaat —
 * zie `../README.md` fase PR3) en wordt hier via dependency injection
 * aangeroepen, nooit lokaal opnieuw geïmplementeerd. PROTOCOL.md
 * §Reconnect stap 4 ("Socketauth gebruikt dezelfde sessietoken.") vraagt
 * expliciet om hetzelfde schema als de eerste handshake — dus geen
 * reconnect-specifieke variant van de validatieregels, alleen van de
 * aanroep hier.
 *
 * Als `server/protocol/auth-shape.mjs` nog niet bestaat op het moment dat
 * je dit uitvoert: bouw eerst PR3 (zie `../README.md`) en importeer de
 * daadwerkelijke functienaam die dat oplevert. Schrijf in dit bestand geen
 * eigen `protocolVersion === 'v1'`-check of bearer-tokenvorm-validatie als
 * vervanging — dat zou de duplicatie zijn die `../README.md` fase PR6
 * expliciet uitsluit.
 *
 * @param {string} sessionToken
 * @param {(payload: unknown) => { ok: true, payload: SocketAuthPayload }
 *   | { ok: false, reason: string }} validateSocketAuthPayload - PR3's
 *   auth-shape-validator, geïnjecteerd zodat dit bestand 'm aanroept in
 *   plaats van herbouwt
 * @returns {{ ok: true, payload: SocketAuthPayload } | { ok: false, reason: string }}
 */
export function buildReconnectSocketAuth(sessionToken, validateSocketAuthPayload) {
  /* ... */
}
```

### Verplichte testgevallen

| # | Functie | Scenario | Verwacht |
| --- | --- | --- | --- |
| 1 | `backoffDelaySeconds` | eerste 5 waarden van een verse generator | `[1, 2, 4, 8, 16]` |
| 2 | `backoffDelaySeconds` | 6e, 7e en 10e waarde van dezelfde generator | telkens `30` |
| 3 | `backoffDelaySeconds` | twee onafhankelijke generatorinstanties tegelijk laten lopen | elke instantie begint zelf bij `1`, geen gedeelde/module-brede state |
| 4 | `backoffDelaySeconds` | 50 achtereenvolgende `.next()`-aanroepen | nooit `{ done: true }`, elke `value` is een eindig getal |
| 5 | `resolveReconnectResend` | `pendingAnswer = null` | `{ ok: true, resend: false }` |
| 6 | `resolveReconnectResend` | `{ actionId: 'act_1', ackReceived: true }` | `{ ok: true, resend: false }` — reeds geaccepteerd, niet opnieuw verzenden |
| 7 | `resolveReconnectResend` | `{ actionId: 'act_1', ackReceived: false }` | `{ ok: true, resend: true, actionId: 'act_1' }` |
| 8 | `resolveReconnectResend` | ongeldige invoer: `pendingAnswer` is een string, een getal, of een object zonder `actionId`/`ackReceived` | `{ ok: false, reason: '...' }`, nooit een throw |
| 9 | `resolveReconnectResend` | shape-toets: bij `resend: true` is `actionId` altijd exact gelijk aan `pendingAnswer.actionId`, over minstens 10 willekeurige actionId-waarden | geen enkel geval produceert een andere/nieuwe `actionId` |
| 10 | `buildReconnectSocketAuth` | geldige `sessionToken`, een fake `validateSocketAuthPayload` die de payload teruggeeft als `{ ok: true, payload }` | payload bevat exact `{ sessionToken, protocolVersion: 'v1' }`, geen extra reconnect-specifieke velden |
| 11 | `buildReconnectSocketAuth` | fake `validateSocketAuthPayload` die `{ ok: false, reason: 'TOKEN_INVALID' }` teruggeeft | resultaat is exact die afwijzing, ongewijzigd doorgegeven — bewijst dat deze functie zelf geen validatielogica bevat |
| 12 | `buildReconnectSocketAuth` | injectie-toets: twee verschillende fake-validators voor dezelfde `sessionToken` | het resultaat volgt telkens de geïnjecteerde validator, nooit een hardgecodeerd eigen oordeel |

Reken de varianten in rij 8 en 9 door op minstens 15 losse `node:test`-cases.

### Niet in scope voor PR6

- Herbouwen van `architecture-plan`'s AR3 (`snapshot-precedence`) of AR4
  (`server-time`) — deze module roept ze aan via de aanroepende laag, ze worden hier
  niet opnieuw gedefinieerd.
- Herbouwen van PR3's `auth-shape`-vormvalidatie — alleen importeren/injecteren, nooit
  lokaal een eigen `protocolVersion`- of tokenprefix-check toevoegen.
- Echte Socket.IO-reconnectlogica, echte `setTimeout`/timers, en de
  niet-blokkerende reconnect-UI (PROTOCOL.md §Reconnect stap 2) — dat hoort bij het
  latere serverproces resp. `game-flow-plan`, niet bij deze pure module.
- Tokenvernieuwing of de betekenis van `TOKEN_EXPIRED`/`SESSION_REVOKED` bij reconnect
  — foutcode-afhandeling zit al bij `error-codes` (PR2); deze module oordeelt niet over
  tokengeldigheid, ze bouwt alleen de handshake-payload en roept de validator aan.
- PR8's sessie/tokengeneratie — reconnect hergebruikt een bestaande `sessionToken`,
  genereert er nooit één.
- Het daadwerkelijk opvragen van de snapshot na reconnect (stap 5) en het toepassen
  ervan (stap 6) — dat is de aanroepende laag die AR3 aanroept, niet deze module.

### Definition of done

- Alle 12 rijen uit de testtabel slagen, inclusief de uitgebreide varianten van rij 8
  en 9.
- `backoffDelaySeconds`, `resolveReconnectResend` en `buildReconnectSocketAuth` zijn
  puur: geen `Date.now()`, `Math.random()`, module-brede mutable state, I/O, of
  afhankelijkheid van een echte `auth-shape`-implementatie (die wordt altijd
  geïnjecteerd/geïmporteerd, nooit gedupliceerd).
- Code review toont aantoonbaar geen herimplementatie van AR3/AR4 of van PR3's
  vormvalidatie binnen dit bestand — alleen aanroepen/verwijzingen.
- Getest met een expliciet bestand: `node --test server/protocol/reconnect.test.mjs`.
- Past binnen de autonomiegrens uit `CLAUDE.md` (≤15 bestanden, ≤5.000 regels per actie);
  dit is één ongesplitste fase, dus één actie moet volstaan.
