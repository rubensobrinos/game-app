# DEPLOYMENT-AND-TESTING.md — Hoe draaien en bewijzen we het?

## Doelomgeving

- **Applicatieserver:** Mac Studio, 64 GB RAM, 1 TB SSD.
- **NAS:** back-updoel.
- **Domein:** `play.aseso.nl`.
- **OS:** macOS met één gekozen container-runtime.
- **Runtime:** bij voorkeur OrbStack, Docker Desktop of Colima; niet meerdere tegelijk.

## Mac Studio als 24/7 pilotserver

Voor live gebruik:

- slaapstand uit;
- automatische herstart na stroomuitval aan waar macOS/hardware dat ondersteunt;
- container-runtime automatisch starten;
- voldoende vrije SSD-ruimte bewaken;
- macOS-updates niet automatisch tijdens een gepland evenement installeren;
- bij belangrijke avonden bij voorkeur UPS voor Mac, router en modem;
- development en production in gescheiden Compose-projecten en poorten.

## Referentie Docker Compose

```yaml
name: aseso-game

services:
  reverse-proxy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      frontend:
        condition: service_healthy
      game-server:
        condition: service_healthy
    networks: [edge, internal]

  frontend:
    image: nginx:alpine
    restart: unless-stopped
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/"]
      interval: 15s
      timeout: 3s
      retries: 5
    networks: [internal]

  game-server:
    build:
      context: ./server
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: "3000"
      REDIS_URL: redis://redis:6379
      DATABASE_URL: ${DATABASE_URL}
      TOKEN_PEPPER: ${TOKEN_PEPPER}
      MAX_PLAYERS_PER_GAME: "100"
      GAME_TTL_SECONDS: "14400"
      CONTENT_VERSION: ${CONTENT_VERSION}
      LOG_LEVEL: info
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 3s
      retries: 5
    networks: [internal]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command:
      - redis-server
      - --appendonly
      - "yes"
      - --appendfsync
      - everysec
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks: [internal]

  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: gamestats
      POSTGRES_USER: gameapp
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gameapp -d gamestats"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [internal]

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    profiles: ["tunnel"]
    depends_on:
      reverse-proxy:
        condition: service_started
    networks: [edge]

networks:
  edge:
  internal:
    internal: true

volumes:
  caddy-data:
  caddy-config:
  redis-data:
  pg-data:
```

Dit is een referentie, geen geheimenbestand. `.env` staat nooit in git;
`.env.example` bevat alleen sleutelnamen.

De getoonde `ports`-mapping hoort bij directe exposure/port forwarding. Bij
Cloudflare Tunnel wordt die mapping in een Compose override verwijderd en gebruikt
`cloudflared` uitsluitend het interne `edge`-netwerk. Zo staan niet alsnog onbedoeld
poort 80 en 443 op de Mac open terwijl de tunnel actief is.

## Bereikbaarheid

### Voorkeur MVP: Cloudflare Tunnel

Voordelen:

- geen inbound poort naar thuisnetwerk nodig;
- publiek IP blijft verborgen;
- TLS aan de edge;
- WebSocketondersteuning;
- eenvoudige intrekking.

De tunnel routeert alleen naar de reverse proxy. Redis en PostgreSQL blijven op het
interne netwerk.

### Alternatief: port forwarding

- uitsluitend TCP 443 naar Caddy;
- poort 80 alleen voor redirect/certificaat indien nodig;
- vast lokaal IP voor Mac Studio;
- routerfirewall actief;
- geen NAS-, Redis-, Postgres- of managementpoort extern;
- dynamic DNS indien publiek IP wisselt.

Kies één route en leg die vast. Niet beide onnodig tegelijk openzetten.

## Reverse-proxy en browsersecurity

Minimaal:

- HTTPS-only;
- HSTS na succesvolle test;
- Content-Security-Policy;
- `X-Content-Type-Options: nosniff`;
- strikte `Referrer-Policy`;
- permissies beperken via `Permissions-Policy`;
- request-bodylimieten;
- rate limiting op create/join;
- WebSocket originvalidatie;
- tokens nooit in URL of logs;
- gebruikersnamen altijd escaped als tekst.

## Assets

- WebP/AVIF/SVG waar passend;
- richtwaarde maximaal 30 kB per regulier quizbeeld;
- fingerprinted filenames;
- `Cache-Control: public, max-age=31536000, immutable`;
- HTML en manifest kort cachen;
- volgende ronde preladen tijdens uitslag;
- QR lokaal in de browser genereren uit de joinUrl, zodat geen externe QR-dienst nodig is.

## Observability

### Endpoints

- `/healthz`: proces leeft; geen gevoelige details;
- `/readyz`: Redis en database bereikbaar; intern of afgeschermd;
- `/metrics`: alleen intern of beveiligd.

### Kernmetrics

- actieve rooms;
- actieve sockets;
- spelers per room;
- events per seconde;
- antwoorden per seconde;
- p50/p95/p99 eventlatency;
- event-loop lag;
- Redislatency;
- reconnects;
- foutcodes;
- roomstartpercentage;
- rematchpercentage;
- joinmethode QR/link/code.

### Logging

- gestructureerde JSON-logregels;
- geen displaynamen;
- geen tokens;
- geen volledige antwoordpayloads;
- geen IP in applicatielogs;
- proxy-IP-logs uit, gemaskeerd of korte retentie;
- Docker-logrotatie verplicht.

### Alerting

Externe uptimecheck op de publieke homepage en `/healthz`, plus melding bij:

- downtime;
- hoge foutfrequentie;
- SSD bijna vol;
- container restartloop.

## Back-ups

### PostgreSQL

- nachtelijke `pg_dump`;
- versleuteld naar NAS;
- 30 dagen retentie;
- maandelijkse hersteltest tijdens pilot, later minimaal per kwartaal.

### Configuratie

Wekelijks:

- Compose-bestanden;
- Caddyconfig;
- migrations;
- `.env` uitsluitend versleuteld;
- gebruikte image-tags en git-SHA.

### Redis

Redis AOF staat op lokaal volume voor korte operationele continuïteit. Redis is geen
langetermijnback-up en wordt niet naar NAS gearchiveerd als productdata.

## Testlagen

### 1. Unit

- puntenformule en deadline-grace;
- alle spelvormvalidators;
- vraagselectie en rematchuitsluiting;
- naamnormalisatie en XSS-achtige input;
- code- en inviteId-generatie;
- sessionrollen;
- state-machine-transities;
- tokenhashing en revocation;
- teamformule wanneer teams worden gebouwd.

### 2. Contracttests

- alle REST-schema's;
- alle socketevents;
- protocolversie;
- foutcodes;
- snapshot bevat geen correct antwoord van actieve ronde;
- client en server delen dezelfde contentVersion.

### 3. Integratie

- create zonder hostdeelname;
- create met hostdeelname;
- join via QR/inviteId;
- join via code;
- optionele naam en gegenereerde naam;
- iedere speler kan share-QR openen;
- start → rondes → finish → rematch;
- lock/unlock;
- late join;
- kick en sessierevocation;
- twee rooms lekken geen state;
- duplicate actionId is idempotent.

### 4. Browser/E2E

Minimaal Chrome Android-emulatie, Safari/iPhone en echte toestellen:

- QR-link opent juiste room;
- naam overslaan werkt;
- app switch en schermlock;
- refresh;
- native share en link copy;
- portrait en landscape;
- trage 4G;
- kleine schermen;
- host speelt mee zonder bedieningsoverlap;
- geen centraal scherm aanwezig.

### 5. Restart- en chaostests

- game-server restart midden in ronde;
- Redis restart met AOF;
- PostgreSQL tijdelijk weg;
- tunnel reconnect;
- host offline;
- 10% spelers disconnect/reconnect;
- snapshot herstelt zonder dubbele punten.

### 6. Loadtests

Gebruik k6, Artillery of een eigen Socket.IO-loadclient. De loadgenerator draait niet op
dezelfde Mac als de server bij serieuze metingen.

| Niveau | Scenario | Doel |
| --- | --- | --- |
| L0 | 1 room × 20 echte/virtuele spelers | functioneel en visueel |
| L1 | 1 room × 100 spelers, 20 rondes | launchnorm |
| L2 | 20 rooms × 50 spelers | 1.000 gelijktijdige spelers |
| L3 | 200 rooms × 50 spelers | knelpuntanalyse na CDN/schaalwerk |

### Slagingscriteria L1

- geen desynchronisatie;
- geen dubbele antwoorden of scores;
- p95 realtime-eventlatency onder 300 ms via gecontroleerde publieke route;
- antwoordpieken van 100 spelers binnen twee seconden verwerkt;
- reconnectsnapshot correct;
- geen blijvende geheugengroei na room-TTL;
- frontend-assets laden acceptabel op echte mobiele verbindingen.

L2 en L3 worden eerst lokaal/LAN uitgevoerd. Grote tests via tunnel of publieke
infrastructuur alleen gecontroleerd en conform providerlimieten.

## Handmatige pilots vóór launch

### Pilot A — neef/studentengroep

- minimaal 8–15 spelers;
- iedereen uitsluitend telefoon;
- QR door spelers onderling doorgeven;
- host speelt mee;
- observeer tijd tot eerste vraag;
- observeer spontane rematch en doorsturen.

### Pilot B — werkborrel

- andere leeftijd/context;
- minimaal één gebruiker die niets uitgelegd krijgt;
- test of die zelfstandig een nieuwe room kan hosten.

### Te observeren

- scansnelheid;
- waar iemand twijfelt;
- naam overslaan;
- leesbaarheid;
- timer;
- plezier en discussie;
- behoefte aan revanche;
- of deelnemers zelf de QR openen;
- of iemand vanuit de eindstand een nieuwe game start.

## Release

- images taggen met git-SHA;
- migrations vooraf backwards-compatible;
- smoke test op staging;
- release buiten actieve pilot;
- drainmodus bij latere productie: geen nieuwe rooms, bestaande afronden;
- changelog bij iedere release.

## Rollback

- vorige image-tags opnieuw activeren;
- databasewijzigingen backwards-compatible houden;
- Redisstate blijft bij game-serverrollback behouden;
- clients halen na reconnect een snapshot op;
- bij protocolbreuk weigert server expliciet een niet-ondersteunde versie.

## Definition of Done — MVP

1. Harde productregels uit `PRODUCT.md` zijn aantoonbaar intact.
2. Host kan zonder account in één flow een room starten.
3. Speler kan via QR zonder account en zonder typen joinen.
4. Iedere deelnemer kan dezelfde QR opnieuw tonen.
5. Host kan wel of niet meespelen.
6. Alle Golf 1-spelvormen werken server-authoritative.
7. Unit-, contract-, integratie- en kern-E2E-tests zijn groen.
8. L1 is gehaald op de Mac Studio via de daadwerkelijke publieke route.
9. Minimaal twee echte pilots zijn uitgevoerd.
10. Restarttest game-server + reconnectsnapshot is geslaagd.
11. Back-up en restore van PostgreSQL zijn getest.
12. Geen naam, token of IP staat in persistente analytics.
13. Groepsvlag/badge, accounts, betaling en spectator-scherm zijn geen launchdependency.
