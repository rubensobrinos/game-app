# rounda — architectuur

Rounda is een party-quiz over de wereld die je met je telefoon speelt: iemand maakt een game, de rest doet mee via QR, link of code, zonder account, en de server is de enige die de waarheid kent. Dit document beschrijft de hele repo: de multiplayer (game-server, frontend, opslag), de oude solo-app in de wortel en de uitrol. Het ontwerp van alleen de multiplayer, zoals het in augustus is vastgelegd, staat in [multiplayer/ARCHITECTURE.md](multiplayer/ARCHITECTURE.md).

> Stand: 2026-09-30, gecontroleerd tegen `main` (commit `024740e`). Het multiplayer-ontwerp blijft de bron voor het waarom; dit document zegt wat er nu staat. Waar ze verschillen staat het onder Bekende gaten.

## In één zin

Rounda laat een groep met hun telefoon dezelfde quizvragen over landen beantwoorden (vlaggen, contouren, hoofdsteden, hoger of lager, zes games in totaal, één per match), met een server die fase, vraag, antwoord en stand bepaalt. Het is uitdrukkelijk geen app die je installeert en geen platform met accounts: een sessie leeft zolang de room leeft.

## Plaats in het landschap

```text
 telefoons (browser)
      │ HTTPS · WebSocket
      ▼
 Cloudflare (TLS aan de rand) ─► cloudflared ─► reverse-proxy (Caddy) ─┬─► game-server (Node 22, Fastify, Socket.IO, :3000) ─► redis (AOF)
                                                                       │
                                                                       └─► frontend (nginx: oude solo-app, vlaggen, data)

 postgres staat in de stack (analytics-schema), maar de game-server gebruikt hem nu niet.
 Alles draait op één Mac, als compose-project aseso-game (productie) en rounda-test (test).
```

- **Gebruikt:** Redis als bron voor alle actieve state (rooms, sessies, spelers, rondes, antwoorden); Cloudflare Tunnel voor de publieke route; een eigen Postgres voor analytics, zie Bekende gaten. Geen andere repo's of diensten: `server/`, `frontend/`, `shared/` en de deploymap verwijzen niet naar db-gateway of llm-gateway.
- **Gebruikt door:** spelers en hosts in de browser van hun telefoon op rounda.io, en op play.aseso.nl, dat in de Caddyfile blijft werken zodat bestaande QR-codes en links niet breken. Niets anders roept de game-server aan.
- **Draait:** op één Mac (het ontwerp noemt een Mac Studio). Productie is het compose-project `aseso-game`, test het compose-project `rounda-test` met eigen volumes en database (volgens `deploy/README.md` en `compose.testsite.override.yml`). De NAS komt in de stack niet voor; het ontwerp noemt hem voor back-ups.

## Systeemstroom

1. **Binnenkomst** — een HTTPS-verzoek komt via Cloudflare Tunnel bij Caddy, dat API, sockets, deep links en multiplayer-assets naar de game-server stuurt en de solo-app naar nginx.
2. **Aanmaken** — een host maakt een room met `POST /api/v1/games`: een zescijferige code, een `inviteId` voor QR en deellink, en een host-sessietoken waarvan alleen de hash wordt bewaard.
3. **Meedoen** — spelers openen QR of link, zien een preview en joinen met `POST /api/v1/games/join`; elke browser krijgt een eigen sessietoken voor één room.
4. **Verbinden** — de client opent een Socket.IO-verbinding met dat token en haalt een snapshot op; na de handshake draagt geen enkel event nog een token, en bij twijfel of herverbinden is de snapshot leidend boven events.
5. **Ronde** — de server zet de room door de fases en stuurt alleen absolute tijdstippen; de vraag komt uit de gedeelde landenpool en de client tekent de timer zelf.
6. **Antwoorden** — `round:answer` wordt gevalideerd en atomair opgeslagen, één antwoord per speler per ronde en idempotent op `actionId`; het juiste antwoord van een actieve ronde staat nooit in een snapshot.
7. **Stand** — scoring en één rangschikker geven de tussenstand en het podium; daarna eindigt de match of start een rematch.

## Componenten

### Binnenkomst

- **Cloudflare Tunnel** — `cloudflared` (profiel `tunnel`, token uit de omgeving) geeft verkeer als HTTP door aan Caddy; TLS ligt bij Cloudflare en `compose.tunnel.override.yml` sluit de poorten 80 en 443. Bestanden: `docker-compose.yml`, `compose.tunnel.override.yml`
- **Reverse proxy (Caddy)** — stuurt `/api/*`, `/socket.io/*`, `/j/*`, `/game/*`, `/host/*`, `/samen`, `/` en de assets van de multiplayer-frontend naar de game-server, `/solo` en al het overige naar nginx; bedient rounda.io, www.rounda.io, play.aseso.nl en localhost; zet security-headers, HSTS en een bodylimiet van 64 KB. Bestanden: `caddy/Caddyfile`, `caddy/Caddyfile.test`, `caddy/Dockerfile`
- **Frontend-container (nginx)** — serveert de statische solo-app met vlaggen, logo's en data uit een eigen image, plus het voortgangsoverzicht onder `/progress`; al het andere onder `/docs/` geeft 404. Bestanden: `nginx/default.conf`, `nginx/Dockerfile`
- **Game-server** — Node 22 met Fastify 5 en Socket.IO, poort 3000 op het interne netwerk. `buildServer` bouwt hem zonder een poort te binden (zodat tests hem kunnen bevragen), hij serveert `client/`, `shared/`, `flags/` en `frontend/` statisch, biedt `/healthz`, `/readyz` (meldt of de store bereikbaar is) en, met een secret, `/metrics`, en leest de omgeving op één plek. Bestanden: `server/index.mjs`, `server/environment.mjs`, `server/static-files.mjs`, `server/Dockerfile`

### Aanmaken

- **REST-laag** — de routes onder `/api/v1`: `POST /games`, `POST /games/join`, `GET /games/preview`, `GET /games/:code/state`, `POST /games/:code/leave` en `GET /time`. Hij vertaalt HTTP naar een compositie-aanroep en foutcodes naar statuscodes en bevat zelf geen spelregel. Bestanden: `server/transport/rest.mjs`, `server/protocol/rest-games-create-join.mjs`, `server/protocol/rest-games-session.mjs`
- **Room en locators** — code (cryptografisch random, uniek onder actieve rooms) en `inviteId` (minstens 96 bits) zijn via atomaire locators op te zoeken; de QR bevat `/j/{inviteId}` en nooit een hostsessie. Bestanden: `server/architecture/room-codes.js`, `server/composition/room/aanmaken.mjs`
- **Sessietokens** — een willekeurig bearer-token per browser en room, gehasht met een versieerbare pepper (HMAC-SHA256) en constant-time vergeleken; alleen de hash wordt bewaard. Bestanden: `server/protocol/auth-session.mjs`, `server/composition/room/sessie.mjs`

### Meedoen

- **Join-flow** — eerst een preview, dan joinen met invite of code (de code is de terugval), met naamverwerking, late join, kick en leave. Bestanden: `server/composition/room/deelnemers.mjs`, `server/protocol/preview-endpoint.mjs`, `client/flow/join-state.mjs`, `frontend/js/views/join.mjs`
- **Spelersidentiteit** — een gegenereerde naam uit land en speels woord in bijvoeglijke vorm, met de vlag, in lobby, tussenstand en podium. Bestanden: `shared/rules/identity-processing.mjs`, `shared/content/identity-word-lists.mjs`, `server/data/name-processing.js`

### Verbinden

- **Socket-laag** — Socket.IO aan de HTTP-server; de handshake valideert het token en zet room en sessie op `socket.data`. Events lopen langs het protocol (`ALL_CLIENT_EVENT_NAMES` en `ALL_SERVER_EVENT_NAMES` zijn de lijsten) en een ack gaat altijd vóór de broadcast. Bestanden: `server/transport/socket.mjs`, `server/transport/socket/handshake.mjs`, `server/transport/socket/clientevents.mjs`, `server/transport/socket/publiceren.mjs`, `server/protocol/envelope.mjs`
- **Snapshot** — de volledige momentopname via `GET /api/v1/games/{code}/state`; wat vluchtig is (zoals `phaseEndsAt`) staat nooit in een opgeslagen document, en de client volgt de voorrangsregel van de snapshot. Bestanden: `server/composition/match/snapshot.mjs`, `server/protocol/snapshot-shape.mjs`, `shared/protocol/snapshot-precedence.mjs`, `frontend/js/transport/precedentie.mjs`
- **Client-verbinding** — REST plus websocket in de browser, met herverbinden op een oplopende backoff (1, 2, 4, 8, 16 en 30 seconden) en signalering om een snapshot te vragen. Bestanden: `frontend/js/transport/verbinding.mjs`, `client/flow/reconnect-state.mjs`

### Ronde

- **Faseautomaat** — `LOBBY`, `COUNTDOWN`, `ROUND_ACTIVE`, `ROUND_RESULT`, `SCOREBOARD` en `FINISHED`, met `PAUSED` ernaast. Bij auto-tempo loopt de server door op timers; bij host-tempo kost elke ronde precies één hostactie (Volgende, in de fase `SCOREBOARD`). Dit is de enige fasetabel. Bestanden: `server/architecture/state-machine.js`, `server/composition/match/fases.mjs`
- **Fasepomp** — de servertimers: één compositie-aanroep per overgang, tijden als absolute tijdstippen en geen ticks over de lijn. Bestanden: `server/transport/socket/fasepomp.mjs`, `server/architecture/server-time.js`
- **Lobby en hostbediening** — de host kiest één gameType per match en de tijd per vraag (25, 15 of 10 seconden) met `game:update-config`, sluit de lobby, kickt en start; welke hostactie nu geldig is volgt uit de fase. Bestanden: `server/composition/room/configuratie.mjs`, `client/flow/host-controls-state.mjs`, `frontend/js/views/lobby.mjs`, `frontend/js/views/host-setup.mjs`
- **Gamecatalogus** — de enige lijst van wat een host kan spelen: `flags_mc`, `real_or_fake_flag`, `odd_one_out`, `country_shape_mc`, `capitals_mc` en `higher_lower`. Een gameType staat er pas in als vraagselectie, contentbron, spelscherm, uitslag en mock het alle vijf aankunnen. Bestanden: `shared/content/game-catalog.mjs`
- **Vraagbron** — kiest en bouwt de vraag van een ronde uit de gedeelde landenpool, deterministisch en met uitsluiting bij een rematch; een gameType dat de keten niet aankan weigert bij het laden van de module. Bestanden: `server/composition/content-source.mjs`, `server/rules/question-selection.js`
- **Gedeelde content** — landen in drie talen met moeilijkheid en aliassen, contouren en versieerbare contentregistratie; elke match pint zijn `contentVersion`. Bestanden: `shared/content/index.mjs`, `shared/content/countries.data.mjs`, `shared/content/shapes.data.mjs`
- **Schermen in de browser** — home, lobby, spel, uitslag en podium zonder framework of bouwstap; de timer wordt lokaal getekend uit absolute servertijden en een gemeten klokverschil. Bestanden: `frontend/js/app.mjs`, `frontend/js/views/gameplay.mjs`, `frontend/js/timer-bar.mjs`, `frontend/js/server-time.mjs`

### Antwoorden

- **Antwoordvalidatie** — `round:answer` heeft per spelvorm een eigen vorm die wordt gevalideerd voor hij de regellaag bereikt, plus de regels voor wie mag antwoorden en wanneer. Bestanden: `server/protocol/client-events-round-answer-variants.mjs`, `server/rules/validators.js`, `server/rules/eligibility.js`
- **Atomair opslaan** — één antwoord per speler per ronde en idempotent op `actionId`, in één atomaire schrijfpoort (een Lua-script in Redis); een tweede poging of een herhaalde actie verandert niets. Bestanden: `server/data/adapters/redis/scripts.mjs`, `server/data/adapters/redis/answer-methods.mjs`, `server/data/answer-flow.js`, `server/protocol/idempotency.mjs`
- **Voortgang** — `round:progress` met een throttle, zodat de host ziet hoeveel spelers hebben geantwoord zonder een bericht per antwoord. Bestanden: `server/protocol/throttle-round-progress.mjs`

### Stand

- **Scoring en rangschikking** — punten met optionele snelheidsbonus, en één rangschikker voor tussenstand, snapshot, eindstand én mock; een client rekent een positie nooit zelf uit. Bestanden: `server/rules/scoring.js`, `shared/rules/ranking.mjs`, `server/composition/match/stand.mjs`
- **Uitslag en podium** — uitslagscherm per ronde, tussenstand en podium; een rematch start een nieuwe match in dezelfde room. Bestanden: `frontend/js/views/reveal-model.mjs`, `frontend/js/views/scoreboard.mjs`, `frontend/js/views/podium.mjs`, `server/composition/match/verloop.mjs`

### Opslag en herstel

- **Opslagpoort en adapters** — de compositielaag kent alleen de DataStore-poort. `REDIS_URL` gezet geeft de Redis-adapter, anders de in-memory store voor ontwikkeling; in productie is `REDIS_URL` verplicht. Bestanden: `server/data/repository.js`, `server/store-handle.mjs`, `server/data/in-memory-store.js`, `server/data/adapters/redis/data-store.mjs`
- **Herstel na herstart** — bij het opstarten zet `recoverActiveRooms` rooms die midden in een potje zaten op `PAUSED` met reden `server_recovery`, en de host hervat met een nieuwe aftelling. Redis draait met AOF en `appendfsync everysec`; een room leeft 14400 seconden (4 uur) na de laatste activiteit. Bestanden: `server/composition/match/herstel.mjs`, `server/data/ttl.js`, `docker-compose.yml`
- **Analytics-adapter** — een gebufferde writer naar Postgres met alleen aggregaten, een allowlist per tabel en nooit een databasewrite in het antwoordpad; het schema staat in de migratie. Hij is niet aangesloten op de server, zie Bekende gaten. Bestanden: `server/data/adapters/postgres/analytics.mjs`, `server/data/privacy-guard.js`, `migrations/001-analytics.sql`

### Meten en loggen

- **Privacy in logs en metrics** — de veilige logger schrijft nooit een token, naam of IP-adres; `/metrics` bestaat alleen met `METRICS_SECRET` (minstens 16 tekens, constant-time vergeleken) en geeft anders 404. Bestanden: `server/transport/safe-logger.mjs`, `server/transport/metrics.mjs`, `server/environment.mjs`

### Solo en mock

- **Oude solo-app** — de oorspronkelijke singleplayer-quiz in de repo-wortel: zonder server speelbaar, door nginx geserveerd op `/solo`, en nog bron van contentdata en vlaggen voor de nieuwe app. Bestanden: `index.html`, `app.js`, `style.css`, `data/`, `flags/`
- **Mock-transport** — `?mock=1` bootst de hele multiplayer-keten na in de browser, en "Alleen spelen" draait erop. Het is een tweede implementatie van het protocol, dus wijzigt het gedrag van de server, dan moet de mock mee. Bestanden: `frontend/js/transport-mock.mjs`, `frontend/js/mock/`

### Tests en tooling

- **Tests** — `npm test` draait `node --test` over `server`, `client`, `shared`, `frontend` en `tests`: unittests naast elke module, integratietests over echte HTTP en websockets in `tests/integration/`, en contracttests op het protocol. De Redis-adaptertests slaan over zonder de wegwerpcontainers uit `compose.test.yml`. Bestanden: `package.json`, `tests/integration/`, `tests/contract/`, `compose.test.yml`
- **Meten op telefoonformaat** — `tools/meet.mjs` meet of een scherm past binnen 390 × 650; het draait niet mee in de suite. Bestanden: `tools/meet.mjs`, `tools/README.md`
- **CI** — een GitHub Actions-workflow op push en pull request: `node --check server/index.mjs`, gitleaks en `npm test` op Node 22. Bestanden: `.github/workflows/ci.yml`, `.devkit.yaml`

## Draaien en uitrollen

```text
npm install
npm start          # node server/index.mjs op :3000, frontend erbij; zonder REDIS_URL met de in-memory store
npm test           # de volledige suite

# productie (compose-project aseso-game), met de tunnel:
docker compose -f docker-compose.yml -f compose.tunnel.override.yml --profile tunnel up -d --build
```

- **Lokaal:** `npm start` start de game-server op poort 3000 (`PORT`); zonder `PUBLIC_APP_URL` valt hij terug op localhost, zonder `TOKEN_PEPPER` krijgt hij een vluchtige pepper (sessietokens overleven dan geen herstart). Zonder server kan ook: `/samen?mock=1`.
- **Productie:** het compose-project `aseso-game` op de Mac met zes diensten: `reverse-proxy` (Caddy 2), `frontend` (nginx), `game-server`, `redis` (7, AOF), `postgres` (16, schema uit `migrations/`) en `cloudflared`. Alleen de proxy en de tunnel hangen aan het netwerk `edge`; de rest zit op `internal`, dat niet naar buiten gaat. Sinds kaart #100796 bouwen `game-server`, `frontend` en `reverse-proxy` elk een eigen image vanuit de repo-wortel (geen bind mounts meer), dus een wijziging komt pas live met een nieuwe build.
- **Uitrollen naar productie:** met de hand (`docker compose ... up -d`), niet via `deploy/release.sh`: `POORT_PRODUCTIE` is leeg in `deploy/omgeving.conf`, dus dat script weigert. `omgeving.conf` kent wel de releasevorm `compose` met de drie diensten, voor `devkit release-site rounda`.
- **Test:** het compose-project `rounda-test` uit de worktree `~/.devkit/sites/rounda/test` op `127.0.0.1:8140`, met `compose.testsite.override.yml`, eigen volumes en database `gamestats_test`. launchd (`nl.aseso.rounda.test`) houdt het in de lucht en `nl.aseso.rounda.uitrol-test` zet elke commit op `main` erop (`deploy/uitrol-wachter.sh`, `deploy/uitrollen-test.sh`). `deploy/start.sh` weigert te starten als `PUBLIC_APP_URL` niet `https://test.rounda.io` is of als er een tunneltoken in het test-env-bestand staat.
- **Secrets:** productie leest `.env` naast de compose (`POSTGRES_PASSWORD`, `DATABASE_URL`, `TOKEN_PEPPER`, `PUBLIC_APP_URL`, `CLOUDFLARE_TUNNEL_TOKEN`; `.env.example` noemt alleen de namen). Test leest `~/.config/rounda/test.env`, mode 600 en buiten git.
- **Controles:** `npm test` lokaal en de CI-workflow; na een release of testbuild doet `deploy/` een rookproef op `/`, `/solo` en `/style.css` en rolt terug als die faalt.

## Bekende gaten

- **Postgres wordt niet gebruikt:** de analytics-adapter is gebouwd en getest, maar niets buiten `server/data/adapters/postgres/` importeert hem en de server leest `DATABASE_URL` niet. De Postgres-container draait wel mee en krijgt het schema uit `migrations/001-analytics.sql`.
- **`/metrics` kan met de compose niet aan:** de server leest `METRICS_SECRET`, maar `docker-compose.yml` geeft die niet door aan `game-server`, dus een waarde in `.env` bereikt de container niet. `docs/STATUS.md` zegt dat hij in `.env` moet.
- **Compose-variabelen die de server niet leest:** `MAX_PLAYERS_PER_GAME`, `GAME_TTL_SECONDS`, `LOG_LEVEL` en `CONTENT_VERSION` staan in `docker-compose.yml`, maar de limiet van 100 spelers (`server/composition/room/configuratie.mjs`) en de TTL (`server/data/ttl.js`) zijn constanten en de contentversie komt bewust uit `shared/content/index.mjs`.
- **Applicatielogs staan uit:** REST en sockets loggen via `fastify.log`, en `start()` in `server/index.mjs` bouwt de server zonder logger-optie (standaard uit). Alleen de opstart- en afsluitregels van `start()` worden geschreven; dit is met een proefaanroep vastgesteld.
- **Geen rate limiting:** de foutcodes `CODE_RATE_LIMITED` en `RATE_LIMITED` bestaan, maar niets levert ze, en de Caddyfile heeft alleen een bodylimiet; `docs/archief/fase1-runbook.md` noemt het als openstaand punt.
- **Geen back-up:** het ontwerp noemt een `backup-job` naar de NAS; in de compose en in `deploy/` bestaat die niet.
- **Productie-uitrol niet gelijkgetrokken:** `deploy/README.md` (stand 27 september) beschrijft productie als handmatig beheerd en noemt een fout waarbij `/solo` en `/flags/` 404 gaven omdat de containers bestanden mountten uit een map die niet meer bestaat. De compose bouwt sindsdien eigen images; of productie daarmee opnieuw is aangemaakt, staat niet in de repo. Ook het tunnelrecord voor `test.rounda.io` was in die stand nog een handmatige stap.
- **Logo's in een publiek image:** `nginx/Dockerfile` bakt merk- en clublogo's (`logos/`, `football/`) in het image dat de frontend publiek serveert, terwijl `docs/multiplayer/PRODUCT.md` logo's achter een server-side feature flag zet en vrijgave vraagt voor publiek gebruik. De LET OP in `nginx/Dockerfile` noemt het als open punt vóór de publieke launch.
- **Eén host, geen failover:** alles draait op één Mac; de schaalfases 2 en 3 uit het ontwerp (tweede instantie, CDN, tweede locatie) zijn niet gebouwd.
- **Documentatie loopt achter:** `docs/multiplayer/ARCHITECTURE.md` noemt TypeScript, play.aseso.nl als hoofdadres en een `backup-job`, terwijl de code JavaScript is en Caddy rounda.io en play.aseso.nl allebei bedient. `docs/STATUS.md` is voor het laatst geverifieerd op 5 augustus en noemt drie van vier games, waar de catalogus er zes kent. `tests/README.md` zegt dat er geen loadscript is, maar `tests/load/` heeft er twee. De README van de repo en `docs/README.md` verwijzen niet naar dit document.
- **Geen E2E en geen chaostests in code:** `tests/e2e/` en `tests/chaos/` bevatten alleen een README. Volgens `docs/README.md` is de groepspilot nog niet gedraaid: alles is getest, niets met echte mensen gespeeld.
- **CommonJS naast ESM:** `server/architecture/`, `server/data/` en `server/rules/` zijn CommonJS (`.js`), de rest ESM (`.mjs`); de repo noemt dit zelf een bekende mix die niet is opgelost.

## Verder lezen

- [multiplayer/ARCHITECTURE.md](multiplayer/ARCHITECTURE.md) — het multiplayer-ontwerp: principes, containers, schaalpad.
- [multiplayer/DECISIONS.md](multiplayer/DECISIONS.md), [multiplayer/PROTOCOL.md](multiplayer/PROTOCOL.md) en [multiplayer/DATA-MODEL.md](multiplayer/DATA-MODEL.md) — bindende besluiten, events en foutcodes, documenten en sleutels.
- [README.md](README.md) en [STATUS.md](STATUS.md) — waar welke documentatie staat en de stand van zaken.
- [../deploy/README.md](../deploy/README.md) — de omgevingen lokaal, test en productie.
