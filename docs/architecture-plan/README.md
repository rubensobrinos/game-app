# Realisatieplan — ARCHITECTURE.md

Dit is het uitvoeringsplan voor het onderdeel waar ik verantwoordelijkheid voor heb
genomen: [`docs/multiplayer/ARCHITECTURE.md`](../multiplayer/ARCHITECTURE.md). Dit
document zelf verandert niets aan de specificatie — het beschrijft hoe ik die
specificatie omzet in geteste code, in welke volgorde, en waar ik moet stoppen om
goedkeuring te vragen.

Zie ook [`docs/multiplayer/README.md`](../multiplayer/README.md) voor de rolverdeling,
en [`docs/game-rules-plan/README.md`](../game-rules-plan/README.md) voor het plan van
de eigenaar van `GAME-RULES.md` — dezelfde aanpak (pure logica eerst, dependencies pas
na akkoord) gebruik ik hier bewust ook, zodat de losse plannen straks zonder wrijving
samenkomen. `DATA-MODEL.md` en `PROTOCOL.md` hebben eigen eigenaren; ik consumeer hun
vormen, ik bepaal ze niet.

## Uitgangspunten

1. **`architecture` is zelf een always_ask + ADR-plichtige categorie.** `devkit
   policy --json` zet `architecture` op `always_ask` en in
   `autonomy.require_adr_for`. Dat geldt ook al ben ík de gekozen eigenaar: dit plan
   is een voorstel voor uitvoering, geen vrijbrief om in één keer een draaiende
   server neer te zetten. `ARCHITECTURE.md` is de inhoudelijke basis (de architectuur
   is al vastgelegd door een mens), maar het daadwerkelijk optuigen van proces,
   dependencies en mapstructuur blijft iets waar ik expliciet voor terugkom.
2. **Grens met de drie al belegde documenten.** Waar `ARCHITECTURE.md` al details
   noemt die op het terrein van `DATA-MODEL.md` (Redis-sleutels) of `PROTOCOL.md`
   (event-namen, snapshotvorm) lijken te liggen, lever ik een voorstel ter review —
   geen bindende ADR namens die eigenaren.
3. **Geen nieuwe dependencies om te beginnen.** Net als bij `GAME-RULES.md`: er is
   nergens in deze repo een `package.json`. Zolang een bouwsteen een pure functie is
   (state-transities, code-generatie, tijdsync-berekening), bouw ik met Node's
   ingebouwde `node:test`, `node:assert` en `node:crypto` — geen `deps`-goedkeuring
   nodig. Fastify, Socket.IO, TypeScript en een Redis-client komen pas ter sprake bij
   de stap die ze daadwerkelijk nodig heeft (zie Fasering, AR6).
4. **Autonomie-limieten blijven gelden.** Max 15 bestanden en 5.000 regels per actie
   (CLAUDE.md). Elke fase hieronder past daar bewust binnen; grotere fases worden
   gesplitst.
5. **`DEPLOYMENT-AND-TESTING.md` is niet mijn terrein.** Containers, Compose,
   Mac Studio, Cloudflare Tunnel en secrets vallen onder `prod`. Ik bouw de code die
   ooit in de `game-server`-container zou draaien, niet de container, het netwerk of
   de productie-omgeving zelf.

## Bouwstenen

| Bouwsteen | Verantwoordelijkheid | Bron in ARCHITECTURE.md |
| --- | --- | --- |
| `state-machine` | Faseovergangen `LOBBY → ... → FINISHED`, `PAUSED`-bookkeeping, precies één eigenaar per transitie | §State machine |
| `room-codes` | zescijferige code (crypto-random, niet oplopend, uniekheids-hook) + `inviteId` (≥96 bits, base64url) | §Join-code en inviteId |
| `server-time` | midpoint-berekening voor tijdsoffset, gedeeld met `/api/v1/time` uit `PROTOCOL.md` | §2 Eén timeline per room |
| `snapshot-precedence` | pure beslisregel wanneer een snapshot lokale state mag overschrijven | §3 Snapshot boven event replay |
| `redis-keyspace` (voorstel) | key-builder-functies die de sleutelnaamgeving volgen, ter review bij de `DATA-MODEL.md`-eigenaar | §Redisstructuur en schaal |
| `server-skeleton` (voorstel) | mapindeling + interfaces waarmee `game-server` de modules van de andere eigenaren aanroept | §Componenten, §Containers |

Elke bouwsteen is een eigen bestand met eigen unit tests.

## Fasering

### AR0 — Scope-check
- Voordat ik iets buiten `docs/` aanmaak: bevestigen dat pure-logica bouwstenen
  zonder dependencies onder een voorstelmap (bijv. `server/architecture/`) mogen,
  vooruitlopend op geen enkele bindende structuurkeuze.

### AR1 — State machine
- `transition(state, event) → nextState` als pure reducer.
- `PAUSED` bewaart `previousPhase`, `remainingMs`, `reason`, `pausedAt`.
- Weigert een transitie zonder geldige trigger (bewaakt "precies één eigenaar per
  transitie").

### AR2 — Room-codes
- Zescijferige code: generator + uniekheidscontract (uniekheidscheck als
  parameter — geen Redis-afhankelijkheid in de module zelf).
- `inviteId`: ≥96 bits entropie via `node:crypto`, base64url.
- Tests op formaat, entropie en botsingsgedrag, niet op opslag.

### AR3 — Snapshot-precedence
- Pure functie die bepaalt of een binnenkomende snapshot lokale/eventgebaseerde
  state moet overschrijven. Dekt zowel `ARCHITECTURE.md` §3 als de PROTOCOL.md-regel
  "Snapshots zijn leidend boven eerder ontvangen events" — gedeeld hulpmiddel, geen
  ADR namens `PROTOCOL.md`.

### AR4 — Server-time
- Midpoint-berekening uit meerdere round-trip-samples, exact zoals `PROTOCOL.md`
  `/api/v1/time` beschrijft, als pure functie met samples in, offset-schatting uit.

### AR5 — Voorstel: server-skeleton
- Geen draaiende code — een concreet, review-baar voorstel voor mapindeling en
  interfaces waarmee een toekomstige `game-server` de modules van `GAME-RULES.md`,
  `DATA-MODEL.md` en `PROTOCOL.md` aanroept. Input voor overleg, geen fait accompli.

### AR6 — Checkpoint vóór proces-skeleton
- Pas ná akkoord op AR5 én op het toevoegen van dependencies (TypeScript, Fastify,
  Socket.IO, Redis-client) bouw ik het daadwerkelijke serverproces dat deze
  bouwstenen aan elkaar knoopt.

### AR7 — Schaalpad (na Fase 1, niet nu)
- Redis pub/sub-adapter, tweede `game-server`-instance, CDN — pas relevant ná een
  werkende Fase 0/1 en expliciet overleg. Geen launch-prioriteit.

## Openstaande besluiten

Vastgelegd tijdens de bouw van AR1. Deze staan ook als comment in
`server/architecture/state-machine.js`, maar horen hier omdat ze andere
documenteigenaren raken.

| # | Onderwerp | Status | Bij wie |
| --- | --- | --- | --- |
| 1 | `INVALID_PAUSE_STATE` blijft intern en mag niet ongefilterd naar de wire. | bevestigd | producteigenaar; zie `docs/multiplayer/DECISIONS.md` #12 |
| 2 | `PROTOCOL.md` definieert `game:pause` als `{ reason?: string }`; de reducer vereist een reden. Opgelost als aanroepercontract: de protocol-adapter (AR5/AR6) vult een ontbrekende reden in. De reducer verzint geen protocol-defaults. | belegd bij AR5/AR6 | architectuur (hier) |
| 3 | Host-tempo gebruikt één hostactie per ronde; `ROUND_RESULT` loopt op timer door naar `SCOREBOARD`. | bevestigd en geïmplementeerd | producteigenaar; zie `docs/multiplayer/DECISIONS.md` #1 |

Punt 3 is geïmplementeerd: `ROUND_RESULT` accepteert bij `pacing: "host"`
`TIMER_ELAPSED` uitsluitend richting `SCOREBOARD`; de fixtures dekken dit pad.

Daarnaast één bekende beperking, geen besluit: een property-getter die zelf werpt
propageert naar buiten. De reducer werpt nooit op platte data. Omdat de aanroeper
schema-gevalideerde payloads levert, is dat pad geen onderdeel van het contract;
het staat als zodanig in de modulekop.

## Testplan

Dekt direct de volgende punten uit de "Unit"-laag van
[`DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md#testlagen):

- state-machine-transities (AR1);
- code- en inviteId-generatie (AR2).

Elke bouwsteen krijgt tests vóór of samen met de implementatie, nooit erna.

## Wat hier expliciet buiten valt

- Docker Compose, containerbuild, Mac Studio, Cloudflare Tunnel — dat is
  `DEPLOYMENT-AND-TESTING.md`, `prod`.
- Bindende Redis-schema- of REST/socket-contractbeslissingen — dat blijft bij de
  eigenaren van `DATA-MODEL.md` en `PROTOCOL.md`; ik lever hoogstens een voorstel.
- Horizontaal schalen, CDN, tweede instance (schaalpad Fase 2/3).
- Alles wat `TOKEN_PEPPER`, `.env` of productie-secrets raakt.

## Checkpoints die ik niet zelfstandig neem

- Nieuwe dependencies toevoegen (TypeScript, Fastify, Socket.IO, Redis-client) —
  `deps`, always_ask.
- De definitieve mapindeling/serverstructuur vastleggen — `architecture`, ook al ben
  ik de eigenaar; het voorstel in AR5 is input, geen besluit.
- Redis-sleutels of protocolvormen bindend maken namens de andere eigenaren —
  `database_schema` / `public_api`, ADR-plichtig bij hen.
- Alles binnen `infra/prod/**` of `.github/workflows/deploy.yml` — verboden pad.

Ik werk dus door tot en met AR5 als losstaande, geteste bouwstenen plus een
reviewbaar voorstel, en leg bij AR0 en AR6 expliciet een vraag neer in plaats van door
te bouwen op een aanname.
