# ARCHITECTURE.md — Hoe zit het systeem in elkaar?

## Overzicht

```text
Mobiele webclients
    │ HTTPS / WebSocket
    ▼
play.aseso.nl
    │
    ▼
Edge/tunnel of router
    │
    ▼
Reverse proxy
    ├── frontend
    ├── game-server
    ├── Redis
    └── PostgreSQL
             │
             ▼
         NAS-back-up
```

## Fysieke omgeving

- **Applicatieserver:** Mac Studio, 64 GB RAM, 1 TB SSD.
- **Container-runtime:** OrbStack, Docker Desktop of Colima; één keuze per omgeving.
- **NAS:** back-ups en herstelkopieën, niet publiek bereikbaar voor de game.
- **Publieke route:** Cloudflare Tunnel of port forwarding naar uitsluitend HTTPS.
- **Statische assets:** initieel via de frontendcontainer; later optioneel via CDN.

De Mac Studio is de applicatieserver. De NAS is geen vereiste voor realtime gameverkeer.

## Belangrijk concept: rooms zijn geen containers

De MVP draait ongeveer vijf kerncontainers, onafhankelijk van het aantal rooms.

```text
één game-server
├── room 482917
├── room 194026
├── room 771302
└── ...
```

Een room is state in Redis plus actieve socketverbindingen. Er wordt nooit één container,
VM of OS-proces per game gestart.

## Componenten

| Component | Verantwoordelijkheid |
| --- | --- |
| `reverse-proxy` | TLS, routing, WebSocket-upgrade, security headers, rate limiting |
| `frontend` | HTML/CSS/JS, mobiele UI, statische assets, lokale rendering |
| `game-server` | REST, sockets, state machine, vraagselectie, scoring, roomrechten |
| `redis` | actieve rooms, sessies, antwoorden, scoreboards, TTL en pub/sub |
| `postgres` | geaggregeerde anonieme product- en contentstatistieken |
| `backup-job` | database- en configuratieback-up naar NAS |

## Architectuurprincipes

### 1. Server-authoritative

De server bepaalt:

- roomfase;
- vraag;
- juiste antwoord;
- start- en eindtijd;
- acceptatie van antwoorden;
- punten;
- scoreboard;
- rematch.

De client toont state en verstuurt intenties.

### 2. Eén timeline per room

De server plant absolute tijden. Clients renderen een lokale timer op basis van
`startsAt`, `endsAt` en een gemeten serveroffset. Er bestaan geen timer-ticks per seconde.

### 3. Snapshot boven event replay

Events houden clients snel bij. Bij refresh, reconnect of twijfel vraagt de client een
volledige snapshot op. De snapshot is altijd leidend.

### 4. Tijdelijke sessies, geen accounts

Elke browser krijgt een cryptografisch willekeurige bearer token voor één room. De token
verwijst naar een tijdelijke `Session` met rollen:

- `host`;
- `player`;
- of beide.

Tokens worden alleen gehasht in Redis opgeslagen en vervallen met de room.

### 5. QR en deel-link zijn publieke joincapaciteiten

De room heeft:

- een menselijke zescijferige `code`;
- een high-entropy `inviteId` voor QR en link.

De QR bevat `/j/{inviteId}` en nooit de hostsessie. Alle deelnemers mogen dezelfde
invite tonen.

### 6. Gedeelde contentmodule

Client en server gebruiken één versieerbare contentmodule voor:

- landen en hoofdsteden;
- moeilijkheidsindeling;
- vertaalde antwoorden en aliassen;
- vraagpools;
- correcte antwoorden;
- renderparameters voor gegenereerde content.

Iedere match pint:

- `contentVersion`;
- `rendererVersion`.

Hierdoor kan een deploy tijdens een bestaande room niet stilzwijgend een andere vraag of
rendering veroorzaken.

### 7. Deterministische gegenereerde content

De server maakt seed en render-specificatie. De client rendert alleen. Bij afwijkingen
tussen browsers wordt een canonieke SVG of afbeelding gebruikt.

### 8. Assets agressief cachen

- fingerprinted filenames;
- lange immutable cacheheaders;
- compacte WebP/AVIF/SVG-assets;
- preload van de volgende ronde;
- service worker pas toevoegen wanneer cache-invalidatie aantoonbaar goed werkt.

### 9. Async analytics

Geen databasewrite in het kritieke antwoordpad. Events worden in-memory of via Redis
gebufferd en in batches geaggregeerd.

### 10. Herstelbaarheid

Redis is de bron voor actieve state. Voor de launchconfiguratie gebruikt Redis AOF met
`appendfsync everysec`, zodat een Redis- of hostprocesrestart niet standaard alle rooms
verwijdert.

Na game-serverherstart:

- actieve rooms worden gevonden via een room-index;
- sockets reconnecten;
- room gaat tijdelijk naar `PAUSED`;
- actuele ronde en geaccepteerde antwoorden blijven staan;
- hervatten gebeurt met een nieuwe korte countdown.

## Containers

| Container | Basis | Initiële schaal |
| --- | --- | ---: |
| `reverse-proxy` | Caddy 2 | 1 |
| `frontend` | Nginx Alpine | 1 |
| `game-server` | Node.js 22 + TypeScript + Fastify + Socket.IO | 1 |
| `redis` | Redis 7 Alpine + AOF | 1 |
| `postgres` | PostgreSQL 16 | 1 |
| `cloudflared` | optioneel bij tunnel | 1 |
| `backup-job` | cron/sidecar of hosttaak | 1 |

## Routing

```text
/                    → frontend
/j/*                 → frontend
/game/*              → frontend
/host/*              → frontend
/screen/*            → frontend
/assets/*             → frontend
/api/*                → game-server
/socket.io/*          → game-server
```

## Socketstrategie

Voor de MVP:

- Socket.IO met WebSocket als voorkeurs- en standaardtransport;
- reconnect met exponential backoff;
- server-side roomchannels;
- Redis adapter pas vereist bij meer dan één game-serverinstance.

Bij horizontaal schalen:

- minimaal twee game-serverinstances;
- Redis pub/sub-adapter;
- WebSocket-only kan zonder sticky application state;
- als long-polling fallback wordt aangezet, sticky sessions expliciet configureren en
  testen.

## State machine

```text
LOBBY
→ COUNTDOWN
→ ROUND_ACTIVE
→ ROUND_RESULT
→ SCOREBOARD
→ COUNTDOWN / ROUND_ACTIVE
→ FINISHED
```

`PAUSED` bewaart:

- vorige fase;
- resterende tijd;
- reden;
- pauzetijdstip.

Iedere transitie heeft precies één eigenaar: server-timer of geautoriseerde hostactie.

## Join-code en inviteId

### Code

- zes cijfers;
- cryptografisch random;
- uniek onder actieve rooms;
- nooit oplopend;
- rate-limited bij handmatige pogingen.

### inviteId

- minimaal 96 bits entropie;
- base64url of vergelijkbaar URL-veilig formaat;
- tijdelijk aanwezig in Room-state zodat iedere deelnemer de QR opnieuw kan tonen;
- lookup via een hashindex;
- direct intrekbaar of roteerbaar;
- blijft bij rematch gelijk, tenzij host uitnodiging roteert.

De code is gebruiksgemak. De inviteId is de primaire, moeilijk te raden toegang.

## Redisstructuur en schaal

Redis bewaart:

- roomconfig;
- matchstate;
- sessies;
- spelers;
- rondes;
- antwoorden;
- sorted scoreboard;
- room-index;
- geblokkeerde sessies.

Scoring gebeurt atomair via Lua of een transactioneel commando. De game-server sorteert
niet bij ieder antwoord de volledige spelerslijst in applicatiegeheugen.

## Schaalpad

### Fase 0 — lokale pilot

- één game-server;
- Redis verplicht of tijdelijk in-memory;
- SQLite toegestaan;
- maximaal enkele echte rooms.

### Fase 1 — launch

- volledige Compose-stack;
- Redis als bron van waarheid;
- PostgreSQL of SQLite voor analytics;
- 100 spelers per room;
- echte loadtest via publieke route.

### Fase 2 — groei

- assets naar CDN;
- tweede game-serverinstance;
- Redis adapter;
- PostgreSQL tuning;
- centrale monitoring;
- gecontroleerde loadtests tot duizenden gelijktijdige spelers.

### Fase 3 — commerciële betrouwbaarheid

- cloud- of colocated tweede locatie;
- failover;
- managed database of replicatie;
- formele SLO's;
- geen afhankelijkheid van één woning, router of stroomaansluiting.

## Niet-functionele uitgangspunten

- honderd spelers in één room is de launchnorm;
- duizend gelijktijdige spelers is een loadtestdoel, geen marketingbelofte;
- duizend rooms betekent niet duizend containers;
- de Mac Studio heeft ruim voldoende compute voor de MVP;
- netwerk, assetdelivery, reconnectgedrag en applicatielogica zullen eerder knellen dan
  64 GB RAM.
