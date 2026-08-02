# Restart- en chaos-runbook (DT6, Deel 1)

Onderdeel van [`README.md`](README.md), fase DT6, geschreven volgens
[`prompts/DT6-chaostests.md`](prompts/DT6-chaostests.md). Bron:
[`docs/multiplayer/DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md)
§Testlagen → 5. Restart- en chaostests (regels 321–329), aangevuld met de
onderliggende gedragsbeschrijvingen in
[`ARCHITECTURE.md`](../multiplayer/ARCHITECTURE.md) §10 Herstelbaarheid,
[`GAME-FLOW.md`](../multiplayer/GAME-FLOW.md) §14 en §Randgevallen 1,
[`PROTOCOL.md`](../multiplayer/PROTOCOL.md) §Reconnect en de eventtabel, en
[`GAME-RULES.md`](../multiplayer/GAME-RULES.md) §Speler verlaat of disconnect.

**Dit is een runbook, geen uitvoerbare code, en wordt hier ook niet uitgevoerd.**
Zelfs een lokale Compose-restart verandert externe proces- en datastate; daarom
bevat dit document alleen tekst — commando's zoals hieronder getoond zijn de
opdrachten die *later*, na aparte autorisatie, gegeven zouden worden. Er is tijdens
het schrijven van dit bestand geen enkel commando uitgevoerd.

## Vergelijking tegen het echte `docker-compose.yml` (DT-R2)

[`REVIEW-DT3B-DT7.md`](prompts/REVIEW-DT3B-DT7.md) #9 signaleerde dat de
aannames hieronder "documentaannames [zijn] zolang de Compose-stack niet
bestaat" en vroeg een read-only preflight vóór uitvoering. Die Compose-stack
bestaat inmiddels (`docker-compose.yml` + `compose.tunnel.override.yml` in de
repo-root). Dit is die read-only vergelijking: regel voor regel tegen de
échte bestanden, aangevuld met de output van `docker compose -f
docker-compose.yml -f compose.tunnel.override.yml config` (en dezelfde met
`--profile tunnel`) om ook de env-interpolatie en de override-merge te zien —
zonder dat de stack gestart is. Per punt: **bevestigd** (klopt met het echte
bestand) of **gecorrigeerd** (klopte niet, en is hieronder/hierboven
aangepast).

- **Servicenamen** — bevestigd. `docker-compose.yml` definieert exact
  `reverse-proxy`, `frontend`, `game-server`, `redis`, `postgres` en
  `cloudflared` (regels 24, 41, 64, 91, 109, 126), geen naam ontbreekt of wijkt
  af.
- **`restart: unless-stopped`** — bevestigd voor alle zes services (o.a.
  gebruikt in scenario 1's "de `game-server`-container zelf herstart vrijwel
  direct"); elke service in `docker-compose.yml` heeft `restart:
  unless-stopped`.
- **`game-server`-healthcheck** — bevestigd: `interval: 15s`, `retries: 5`
  (`docker-compose.yml` regels 86–88), zoals aangenomen in scenario 1.
- **`redis`-healthcheck** — bevestigd: `interval: 10s`, `retries: 5`
  (regels 104–106), zoals aangenomen in scenario 2.
- **`postgres`-healthcheck** — bevestigd: `pg_isready`, `interval: 10s`,
  `retries: 10` (regels 119–123), zoals aangenomen in scenario 3.
- **`cloudflared` zonder eigen healthcheck** — bevestigd: er staat geen
  `healthcheck`-blok op de `cloudflared`-service (regels 126–134), zoals
  scenario 4 aanneemt.
- **Redis AOF-vlaggen** — bevestigd: `command: [redis-server, --appendonly,
  "yes", --appendfsync, everysec]` en volume `redis-data:/data` (regels
  94–101), exact zoals scenario 2 aanneemt ("`--appendonly yes --appendfsync
  everysec`, volume `redis-data` gekoppeld").
- **Interne netwerkisolatie van Redis/PostgreSQL** — bevestigd: `redis`
  (regel 107) en `postgres` (regel 124) zitten alleen op het
  `internal`-netwerk, dat zelf `internal: true` heeft (regels 136–139);
  `cloudflared` zit alleen op `edge` (regel 134) en heeft geen route naar
  `internal`. Dit onderbouwt
  scenario 4's controlepunt "de tunnel routeert alleen naar de reverse proxy;
  Redis en PostgreSQL blijven op het interne netwerk".
- **`tunnel`-profiel** — deels gecorrigeerd. Het profiel zelf klopt
  (`profiles: ["tunnel"]` op `cloudflared`, regel 130), maar twee aannames
  eromheen waren fout en zijn hieronder/hierboven aangepast:
  - De opstartcommando's voor tunnel-scenario's (stap 1 hieronder en scenario
    4) noemden alleen `-f docker-compose.yml --profile tunnel`, zonder `-f
    compose.tunnel.override.yml`. Zonder die override blijft de
    `ports`-mapping `80:80`/`443:443` van `reverse-proxy` gewoon staan — precies
    wat `compose.tunnel.override.yml` juist moet voorkomen (`ports: !reset
    []`, bevestigd via `docker compose ... --profile tunnel config`: met de
    override heeft `reverse-proxy` in de samengevoegde config geen enkele
    `ports`-sleutel meer). Beide commando's zijn gecorrigeerd om de override
    expliciet mee te geven, in lijn met `docker-compose.yml`'s eigen
    kopcommentaar (regels 16–19).
  - De gedeelde randvoorwaarde hieronder stelde dat 80/443-portmapping wél
    nodig is "tenzij het scenario dat specifiek vereist (tunnel-reconnect)" —
    dat stond andersom: juist het tunnel-scenario is degene die de override
    gebruikt die de portmapping wégneemt, dus juist géén hostportmapping
    nodig heeft. Deze bullet is gecorrigeerd.
- **"Preflight tegen de échte stack" (stap 3 hieronder)** — was een abstracte
  verwijzing naar "de échte stack"; gecorrigeerd naar een concrete verwijzing
  naar `docker-compose.yml` (zie hieronder).

Niet eerder in dit runbook genoemd (geen bestaande aanname om te bevestigen of
corrigeren, dus hier apart benoemd in plaats van genegeerd):

- **`frontend`-mounts** — `frontend` (nginx:alpine) mount 11 losse
  read-only bestanden/mappen uit de repo-root (`index.html`, `style.css`,
  `app.js`, `hint.js`, `flaginfo.js`, `geo.js`, `geo-facts.js`, `data/`,
  `flags/`, `logos/`, `football/`) plus `nginx/default.conf` (regels 44–56).
  Geen enkel scenario hieronder oefent een `frontend`-restart uit; deze
  mounts zijn dus nooit geraakt door een chaostest in dit document.
- **`frontend`-healthcheck** — `frontend` heeft wél een healthcheck
  (`wget --spider http://localhost/`, `interval: 15s`, `retries: 5`, regels
  57–61), maar die wordt door geen enkel scenario hierboven gebruikt.
- **`reverse-proxy` heeft géén healthcheck** — in tegenstelling tot de andere
  vier services heeft `reverse-proxy` (Caddy) geen `healthcheck`-blok. Het
  hangt zelf af van `frontend` en `game-server` via `condition:
  service_healthy` (regels 34–38), maar niemand controleert `reverse-proxy`
  zelf op gezondheid. Geen scenario hierboven test een `reverse-proxy`-restart.
- **`cloudflared` start op `condition: service_started`, niet
  `service_healthy`** — `cloudflared` wacht alleen tot `reverse-proxy` gestart
  is (regels 131–133), niet tot die gezond is — logisch omdat `reverse-proxy`
  geen healthcheck heeft, maar relevant als een toekomstig scenario ooit een
  koude start van de hele stack met tunnel test.
- **Openstaand juridisch punt in `docker-compose.yml`'s kopcommentaar** —
  de `logos/`- en `football/`-mounts op `frontend` staan er "omdat de
  singleplayer-UI ze verwacht", met een expliciete TODO om ze vóór publieke
  launch uit te schakelen (`docker-compose.yml` regels 11–14, verwijst naar
  `docs/fase1-runbook.md` open punt 1). Raakt geen chaos-scenario direct, maar
  is een bestaande aantekening in het bestand dat dit runbook nu als bron
  gebruikt, dus hier niet genegeerd.

## Status (2026-08-02, tweede update): scenario 1 herhaald, nu écht "midden in een ronde"

De socketlaag bestond bij de eerste run nog niet, dus scenario 1 kon toen
alleen zijn REST-realiseerbare deel doorlopen. Op verzoek herhaald zodra de
socketlaag er was, mét Redis in de stack — in de verwachting dat de
roomstate dit keer de restart zou overleven. Vóór uitvoering bleek dat
"stap 3" (Redis daadwerkelijk aan de server gekoppeld, `INT-PROGRESS.md`)
nog niet bestaat; na overleg is toch doorgezet, als formele herbevestiging.
**Uitkomst: roomstate overleeft de restart nog steeds niet — nu wél met een
volledig gerealiseerde "midden in een ronde"-voorwaarde, en nu met een
eenduidige, geverifieerde oorzaak** (`redis-cli dbsize` blijft `0`, ook na
een room/match/antwoord die er wél zijn geweest). Zie scenario 1's tweede
"Uitkomst"-sectie hieronder voor de volledige tabel.

## Status (2026-08-02, eerste update): stap 1 én scenario 1 uitgevoerd, geautoriseerd

De `aseso-game-chaos`-stack is opgestart en gezond
(`docker compose -p aseso-game-chaos -f docker-compose.yml -f
compose.chaos.override.yml up -d`), met expliciet akkoord vooraf. Nieuw
bestand [`compose.chaos.override.yml`](../../compose.chaos.override.yml)
reset `reverse-proxy`'s ports naar `127.0.0.1:8080`/`127.0.0.1:8443` (via
`!override`, niet `!reset` — zie dat bestand voor waarom), omdat poort
80/443 al bezet zijn door de echte, draaiende `aseso-game`-stack. Beide
stacks draaien nu tegelijk, volledig geïsoleerd (aparte projectnaam →
aparte volumes/netwerken, aparte hostpoorten).

**Live preflight tegen de daadwerkelijk draaiende containers** (niet alleen
de statische configvergelijking van DT-R2 hierboven): alle vijf services
`healthy` (`docker compose -p aseso-game-chaos ps`); Redis draait
daadwerkelijk met `appendonly yes` / `appendfsync everysec`
(`redis-cli config get`, niet alleen het compose-bestand gelezen);
`frontend` antwoordt `200` op `http://127.0.0.1:8080/`.

**Sindsdien ook uitgevoerd (expliciet akkoord van de producteigenaar,
2026-08-02):** `server/Dockerfile` bleek stale (bouwde zonder dependencies,
zonder `shared/`/`frontend/`) en is gefixt vóór de rebuild — zonder die fix
kon scenario 1 niet eens starten. Scenario 1 (game-server restart) is
uitgevoerd voor het REST-realiseerbare deel; zie "Uitkomst" onder scenario 1
hieronder voor de volledige tabel, inclusief een onverwachte, reproduceerbare
`500 INTERNAL_ERROR`-bevinding op `GET /api/v1/games/{code}/state` die los
staat van chaos/restart.

**Nog niet gedaan, blijft apart geautoriseerd:** resetten naar een schone
teststand, en elk vólgend destructief scenario (2 t/m 6) — elk vereist een
nieuwe, aparte autorisatie.

## Volgorde die voor élk scenario geldt

Per [`README.md`](README.md) §DT6 en §Checkpoints geldt voor ieder scenario
hieronder dezelfde drieledige volgorde, en elke stap heeft een eigen, aparte
autorisatie nodig (Deel 2 van [`DT6-chaostests.md`](prompts/DT6-chaostests.md)):

1. **Stack installeren/opstarten** — op een dedicated Compose-projectnaam en
   -netwerk, nooit op het project/netwerk van een echte (pilot- of
   productie-)omgeving. Bijvoorbeeld:

   ```
   docker compose -p aseso-game-chaos -f docker-compose.yml up -d
   ```

   Voor scenario's die de tunnel raken komt daar het `tunnel`-profiel bij, mét
   de override die de host-portmapping sluit (zie "Vergelijking tegen het
   echte `docker-compose.yml`" hierboven — dit was eerder fout genoteerd
   zonder de override):

   ```
   docker compose -p aseso-game-chaos -f docker-compose.yml -f compose.tunnel.override.yml --profile tunnel up -d
   ```

2. **Resetten naar een schone teststand** — volumes van de vorige run weg,
   daarna opnieuw op, zodat elk scenario met bekende, lege Redis-/
   PostgreSQL-state begint:

   ```
   docker compose -p aseso-game-chaos down -v
   docker compose -p aseso-game-chaos up -d
   ```

3. **Preflight tegen de échte stack** — vóórdat een scenario's opdracht wordt
   gegeven, controleren dat de aannames in dit runbook nog kloppen tegen het
   daadwerkelijke `docker-compose.yml` (en, voor tunnel-scenario's,
   `compose.tunnel.override.yml`) in de repo-root, en tegen wat er
   daadwerkelijk draait op basis van dát bestand: bestaat de containernaam
   exact zo (`docker compose -p aseso-game-chaos ps`)? Rapporteert de
   healthcheck het interval/retries zoals in `docker-compose.yml` gedefinieerd
   en hieronder aangenomen (`docker inspect --format '{{json .State.Health}}'
   <container>`)? Draait Redis daadwerkelijk met de vlaggen uit
   `docker-compose.yml`'s `command:`-blok voor de `redis`-service
   (`--appendonly yes --appendfsync everysec`, `docker compose -p
   aseso-game-chaos exec redis redis-cli config get appendonly` /
   `appendfsync`)? Dit runbook is geschreven vóórdat de Compose-stack en de
   servercontainers echt bestonden ([`REVIEW-DT3B-DT7.md`](prompts/REVIEW-DT3B-DT7.md)
   #9); een statische, read-only vergelijking tussen dit runbook en het
   inmiddels bestaande `docker-compose.yml` + `compose.tunnel.override.yml` is
   uitgevoerd en gedocumenteerd in "Vergelijking tegen het echte
   `docker-compose.yml` (DT-R2)" hierboven — dat dekt de tekst van het bestand,
   niet het daadwerkelijke runtimegedrag van draaiende containers. Deze
   stap-3-preflight blijft daarom nodig als laatste, runtime-check vóórdat een
   scenario uitgevoerd wordt, ook al zijn de documentaannames zelf al
   geverifieerd. Wijkt de preflight af van wat een sectie hieronder aanneemt,
   corrigeer eerst deze sectie's aanname vóórdat het scenario wordt uitgevoerd
   — voer nooit een scenario uit tegen een aanname waarvan de preflight al liet
   zien dat die niet klopt.
4. **Het scenario zelf uitvoeren** — het scenario-specifieke commando uit de
   betreffende sectie hieronder, per scenario apart geautoriseerd (niet één keer
   voor alle zes tegelijk), en pas ná een preflight die geen afwijking vond.

Gedeelde randvoorwaarden voor alle zes scenario's:

- projectnaam `aseso-game-chaos` (nooit de naam `aseso-game` uit de
  referentie-Compose in `DEPLOYMENT-AND-TESTING.md`, om verwarring met een echte
  omgeving uit te sluiten);
- eigen `.env` voor deze teststack, met eigen testwaarden — nooit de echte
  `TOKEN_PEPPER`/`POSTGRES_PASSWORD`/`CLOUDFLARE_TUNNEL_TOKEN` uit een pilot- of
  productieomgeving hergebruiken;
- geen `ports`-mapping naar 80/443 op de hostmachine bij tunnel-scenario's
  (gecorrigeerd: dit stond hier eerder andersom, alsof tunnel-reconnect júist
  wél portmapping nodig zou hebben — het is precies omgekeerd. Draai
  tunnel-scenario's altijd mét `-f compose.tunnel.override.yml`, dat
  `reverse-proxy`'s `ports` volledig verwijdert; `docker compose ...
  --profile tunnel config` bevestigt dat er dan geen `ports`-sleutel meer
  overblijft. Alleen bij een niet-tunnel scenario dat bewust directe
  hostexposure test, is portmapping naar 80/443 relevant); waar mogelijk
  alleen via het interne Compose-netwerk of `docker compose exec` benaderen;
- na afloop van een testsessie: `docker compose -p aseso-game-chaos down -v` om
  geen chaos-testdata te laten rondslingeren.

**Omgevingschecklist (2026-08-02, bijgewerkt nu `server/index.mjs` de échte
server is — niet meer de placeholder):**

- `readConfigFromEnvironment()` (`server/index.mjs`) eist in productie
  (`NODE_ENV=production`, wat `docker-compose.yml` zet) hard: `TOKEN_PEPPER` óf
  `TOKEN_PEPPERS`, en `PUBLIC_APP_URL`. Ontbreken ze, dan start de server
  helemaal niet (`throw`), niet met een stille fallback — bevestig dit vooraf in
  de `.env` van de chaos-stack, niet pas bij een falende opstart ontdekken.
- `TOKEN_PEPPER_VERSION` is optioneel (default `v1`); `TOKEN_PEPPERS` (JSON
  `{"v1": "...", ...}`) heeft voorrang boven het enkelvoudige `TOKEN_PEPPER` als
  beide gezet zijn.
- `/readyz` heeft nu échte semantiek, geen placeholder-503 meer: hij blijft
  bewust `503` totdat er een Redis-verbinding onder hangt ("stap 3", nog niet
  gebouwd) — een preflight die `/readyz` als groen verwacht, redeneert dus
  achter de feiten aan. Gebruik `/healthz` (altijd `200` zolang het proces
  leeft) voor de gewone opstart-/hersteltoets, niet `/readyz`.
- `/healthz`/`/readyz` zijn **niet** bereikbaar via de publieke Caddy-route
  (alleen `/api/*`, `/socket.io/*` en statische paden worden gerouteerd) —
  test ze rechtstreeks tegen de container (`docker compose exec game-server
  node -e "fetch('http://localhost:3000/healthz')..."`, exact wat de
  Compose-healthcheck zelf ook doet), niet via `127.0.0.1:8080`.
- `server/Dockerfile` kopieert sinds vandaag ook `client/`, `shared/` en
  `frontend/`, en draait `npm ci --omit=dev` — een chaos-stack die vóór deze
  wijziging is gebouwd, draait nog de kapotte, dependency-loze placeholder-
  image. Draai bij twijfel altijd met `--build`, niet aannemen dat een
  bestaand image nog actueel is.

Elke sectie hieronder documenteert alleen stap 3 (het scenario zelf); stappen 1 en
2 zijn hierboven al generiek beschreven en gelden ongewijzigd per scenario.

---

## 1. Game-server restart midden in een ronde

**Voorwaarde:** stack draait volledig (stap 1+2 hierboven doorlopen); er is een
actieve room in fase `ROUND_ACTIVE` met minstens één verbonden client die al een
`room:state`-snapshot heeft ontvangen, en minstens één geaccepteerd antwoord in
die ronde.

**Opdracht(en):**

```
docker compose -p aseso-game-chaos restart game-server
```

**Verwacht hersteltijdvenster:** de `game-server`-container zelf herstart vrijwel
direct (`restart: unless-stopped`, geen langlopende migratie in het opstartpad);
de Compose-healthcheck (`interval: 15s`, `retries: 5`) markeert de container
binnen maximaal ~75 s als weer gezond. Clientzijdig reconnecten clients volgens de
Socket.IO-backoff uit `PROTOCOL.md` §Reconnect (1, 2, 4, 8, 16, maximaal 30
seconden), dus de kamer hoort binnen die 30 s-marge weer zichtbaar te herstellen
met een nieuwe korte countdown.

**Controlepunt (bron):**

- "Redis is de bron voor actieve state" en "een Redis- of hostprocesrestart niet
  standaard alle rooms verwijdert" (`ARCHITECTURE.md` §10, regels 146–150);
- na herstart: "actieve rooms worden gevonden via een room-index; sockets
  reconnecten; room gaat tijdelijk naar `PAUSED`; actuele ronde en geaccepteerde
  antwoorden blijven staan" (`ARCHITECTURE.md` §10, regels 152–158);
- "clients rejoinen via snapshot" en "de server hervat met een korte nieuwe
  countdown, niet door stilletjes meerdere fases over te slaan" (`GAME-FLOW.md`
  §14 Serverproces herstart, regels 247–251);
- events `game:paused` (reden, vorige fase) gevolgd door `game:resumed` (nieuwe
  countdown/tijden) zijn zichtbaar in de socket-log (`PROTOCOL.md` eventtabel,
  regels 327–328);
- het reeds vóór de restart geaccepteerde antwoord telt niet dubbel na de
  snapshot-rehydratie — "snapshot herstelt zonder dubbele punten"
  (`DEPLOYMENT-AND-TESTING.md` §5, laatste bullet, regel 329).

### Uitkomst (2026-08-02, geautoriseerd door de producteigenaar)

**Uitgevoerd tegen `aseso-game-chaos`** met de échte server-image
(`server/index.mjs`, na een Dockerfile-fix — zie hieronder). De volledige
"midden in een ronde"-voorwaarde is **niet realiseerbaar**: er bestaat geen
`server/transport/socket.mjs`, en `game:start`/`round:answer` zijn uitsluitend
socket-events (`PROTOCOL.md`), niet via REST bereikbaar. Uitgevoerd deel: LOBBY-
state via de échte REST-laag.

| Verwachting | Uitkomst | Verklaring |
| --- | --- | --- |
| Container herstart binnen `restart: unless-stopped` | ✅ | `docker compose restart game-server` herstartte zonder handmatig ingrijpen |
| Healthcheck weer `healthy` binnen ~75 s | ✅, sneller | ~50 s (`interval: 15s`, `retries: 5`, in de praktijk 5 pogingen × ~5–7 s) |
| `/api/v1/time` werkt na herstel | ✅ | `200 {"serverTime": ...}` vóór én ná herstart |
| Roomstate overleeft de restart | ❌, **verwacht** | Room + sessietoken zijn na herstart onbereikbaar (`401 TOKEN_INVALID`) — de server gebruikt nu nog `createInMemoryStore()` als standaard, geen Redis-koppeling. Dit is géén regressie van dit scenario maar het gedocumenteerde ontbreken van "stap 3" (`INT-PROGRESS.md`); `ARCHITECTURE.md`'s garantie ("Redis is de bron voor actieve state... niet standaard alle rooms verwijdert") geldt dus nog niet. |
| `game:paused`/`game:resumed`, socket-reconnect, "geen dubbele punten" | niet getest | vereist de socketlaag (INT-3-geblokkeerd) |

**Onverwachte, reproduceerbare bevinding (los van chaos, ook vóór de restart al
aanwezig):** `GET /api/v1/games/{code}/state` met een geldig, zojuist ontvangen
`sessionToken` geeft **`500 INTERNAL_ERROR`** op elke room die nog in `LOBBY`
staat. **Oorzaak gevonden** (stond al als commentaar in
`server/transport/rest.mjs` zelf, niet geraden): `validateSnapshotShape` eist
een niet-lege `matchId` en `matchSequence >= 1`, die vóór de eerste match niet
bestaan — bewust nog niet omheen gebouwd, in afwachting van een handoff-item.
Dit raakt het hele reconnectpad tijdens de lobbyfase. Volledige repro +
impact: [`bug-report-snapshot-500-on-lobby.md`](bug-report-snapshot-500-on-lobby.md).
Niet zelf gefixt — `server/transport/rest.mjs` is niet mijn module.

**Bijvangst:** `server/Dockerfile` bouwde tot dusver zonder `npm ci` en zonder
`shared/`/`frontend/` te kopiëren (stale sinds de placeholder-fase — het
containerimage kon dus nooit de échte server draaien). Bijgewerkt: `npm ci
--omit=dev` + `COPY client/ shared/ frontend/`. Zonder die fix faalt dit
scenario al bij het opstarten, niet pas bij de restart.

### Herhaling 2026-08-02 — nu écht "midden in een ronde", op verzoek na een expliciet, apart akkoord

**Aanleiding:** de eerste uitvoering hierboven kon de kernvoorwaarde van dit
scenario niet realiseren (geen socketlaag). Die laag bestaat nu wel
(`server/transport/socket.mjs`, geland sinds de eerste run). Vóór uitvoering
gecontroleerd of ook "stap 3" (Redis daadwerkelijk gekoppeld aan de server, de
reden waarom een herhaling met Redis iets nieuws zou bewijzen) al bestaat:
**nee** — `server/index.mjs` bevat geen enkele referentie naar
`REDIS_URL`/`server/data/adapters/redis/`, bevestigd zowel in de broncode als
rechtstreeks in de gebouwde containerimage (`docker compose exec game-server
grep -c "adapters/redis\|REDIS_URL" server/index.mjs` → `0`).
`docs/integration-plan/INT-PROGRESS.md` bevestigt dit zelf: stap 3 ("echte
adapters — INT-B") staat op ⏸️. Dit is voorgelegd en er is expliciet gekozen
om toch door te zetten, als formele herbevestiging in plaats van als
voortgangsmeting.

**Uitgevoerd:** stack volledig gereset (`down -v`) en herbouwd (`--build`,
huidige `main` inclusief alle fixes van vandaag) tegen `aseso-game-chaos`,
geïsoleerd van de live `aseso-game`-stack (aparte projectnaam, bevestigd via
`docker compose -p aseso-game ps` vóór aanvang — geen wijziging daaraan).

1. Preflight: alle vijf services `healthy`; Redis draait met `appendonly yes`
   / `appendfsync everysec` (rechtstreeks bevraagd, niet aangenomen);
   `/healthz` → `200`; `/readyz` → `503` (verwacht, zie omgevingschecklist).
2. Room aangemaakt over de echte loopback-route (`127.0.0.1:8080`), host +
   speler gejoined, `game:start` over een echte socket, `round:started`
   ontvangen, speler heeft echt geantwoord (`round:answer`, ack `ok: true`).
   Snapshot vóór de restart bevestigd: `200`, `phase: "ROUND_ACTIVE"`,
   `matchId` en `matchSequence: 1` gezet — de voorwaarde van dit scenario is
   nu, in tegenstelling tot de vorige run, écht gerealiseerd.
3. `docker compose -p aseso-game-chaos restart game-server` uitgevoerd.

| Verwachting | Uitkomst | Verklaring |
| --- | --- | --- |
| Container herstart binnen `restart: unless-stopped` | ✅ | herstartte zonder handmatig ingrijpen |
| Healthcheck weer `healthy` binnen ~75 s | ✅, sneller | ~19 s |
| `/api/v1/time` werkt na herstel | ✅ | `200 {"serverTime": ...}` |
| Roomstate overleeft de restart, mét Redis draaiend | ❌, **verwacht, zelfde reden als de eerste run** | `401 TOKEN_INVALID` op het sessietoken van vóór de restart, ondanks een gezonde, draaiende Redis met AOF. **Geen regressie van dit scenario en geen inconsistentie met de eerste run** — Redis draait wel, maar de server praat er nog niet mee: `redis-cli dbsize` na de restart geeft `0`, terwijl de room/match/antwoord daarvóór wel degelijk zijn aangemaakt. Bevestigt rechtstreeks dat "stap 3" niet bestaat, niet alleen via broncode-inspectie maar via het daadwerkelijke gedrag. |
| `game:paused`/`game:resumed`, socket-reconnect, "geen dubbele punten" | niet getest | vereist een nog bereikbare sessie ná herstart — juist wat hierboven ontbreekt |

**Wat dit scenario dus wél nieuw bewijst t.o.v. de eerste run:** de
"midden-in-een-ronde"-voorwaarde is nu echt gerealiseerd (was de vorige keer
niet mogelijk), en de negatieve uitkomst is nu eenduidig toe te schrijven aan
één concrete, geverifieerde oorzaak (geen Redis-koppeling in
`server/index.mjs`) in plaats van aan "geen socketlaag" zoals de vorige keer.
Zodra INT-B stap 3 landt, is dit scenario direct opnieuw uit te voeren zonder
verdere voorbereiding — de rest van de opzet (stack, override, preflight,
scenario-drijfscript) staat al.

**Chaos-stack blijft draaiend** (`aseso-game-chaos`, niet afgebroken) voor een
eventuele volgende scenario-run, zoals ook na de eerste uitvoering.

---

## 2. Redis restart met AOF

**Voorwaarde:** stack draait; Redis is gestart met de referentieconfiguratie
(`--appendonly yes --appendfsync everysec`, volume `redis-data` gekoppeld); er is
al een room met spelers en minstens één afgeronde ronde vóór de restart, zodat er
daadwerkelijk state is die moet overleven.

**Opdracht(en):**

```
docker compose -p aseso-game-chaos restart redis
```

**Verwacht hersteltijdvenster:** Redis zelf is binnen enkele seconden weer
beschikbaar (AOF-replay van een klein testdataset is snel); de Compose-
healthcheck (`interval: 10s`, `retries: 5`) markeert Redis binnen maximaal ~50 s
als gezond. `game-server` heeft een lopende Redis-verbinding en hoeft zelf niet te
herstarten — de eigen Redis-client reconnecteert; er is geen client-zichtbare
downtime van de kamer verwacht zolang de Redis-restart kort genoeg is.

**Controlepunt (bron):**

- "Redis AOF staat op lokaal volume voor korte operationele continuïteit"
  (`DEPLOYMENT-AND-TESTING.md` §Back-ups → Redis, regels 263–266) — geverifieerd
  door te controleren dat room-, speler- en scorestate ná de Redis-restart nog
  aanwezig is, niet leeg;
- `appendfsync everysec` betekent maximaal ~1 s aan schrijfacties die potentieel
  verloren kunnen gaan bij een harde crash — bij een nette `restart` (geen
  `kill -9`) hoort dat verlies niet op te treden; noteer expliciet of dit scenario
  een nette restart of een hard gedode container test, want dat verandert de
  verwachting;
- dezelfde room-hervattingsmechaniek als scenario 1 geldt ook hier zodra
  `game-server` de heropgestarte Redis weer bereikt: room naar `PAUSED`,
  daarna hervatten met nieuwe korte countdown (`ARCHITECTURE.md` §10, regels
  152–158).

---

## 3. PostgreSQL tijdelijk weg

**Voorwaarde:** stack draait; er loopt een actieve room met spelers die actief
antwoorden geven, zodat het kritieke antwoordpad daadwerkelijk belast wordt
terwijl PostgreSQL weg is.

**Opdracht(en):**

```
docker compose -p aseso-game-chaos stop postgres
# … observatieperiode tijdens actief spel …
docker compose -p aseso-game-chaos start postgres
```

**Verwacht hersteltijdvenster:** voor het spelverloop zelf hoort er geen
merkbare hersteltijd te zijn — het kritieke antwoordpad schrijft niet naar
PostgreSQL. Voor PostgreSQL zelf: de healthcheck (`pg_isready`, `interval: 10s`,
`retries: 10`) markeert de container binnen maximaal ~150 s als weer gezond
zodra hij herstart is; gebufferde analytics-events horen kort daarna alsnog
weggeschreven te worden.

**Controlepunt (bron):**

- "Geen databasewrite in het kritieke antwoordpad. Events worden in-memory of
  via Redis gebufferd en in batches geaggregeerd" (`ARCHITECTURE.md` §9 Async
  analytics, regels 141–144) — geverifieerd door tijdens de PostgreSQL-downtime
  te bevestigen dat joinen, antwoorden geven, scoreboard en rondeverloop gewoon
  doorgaan zonder fouten aan de speler;
- ná het herstarten van PostgreSQL: de tijdens de downtime gebufferde
  analytics-events komen alsnog in de database terecht (batch-flush), zonder dat
  de game-server een crash-loop vertoont door de tijdelijke
  verbindingsfouten — dit is het equivalent van "en dan werkt het weer" maar dan
  specifiek voor de asynchrone laag, niet voor het speelpad zelf.

---

## 4. Tunnel-reconnect

**Voorwaarde:** stack draait met het `tunnel`-profiel actief
(`--profile tunnel`); minstens één client is verbonden via het publieke
tunnel-hostname (niet rechtstreeks via localhost/interne poort, want dit
scenario test specifiek het tunnelpad); er is een actieve room.

**Opdracht(en):**

```
docker compose -p aseso-game-chaos -f docker-compose.yml -f compose.tunnel.override.yml --profile tunnel restart cloudflared
```

**Verwacht hersteltijdvenster:** `cloudflared` heeft in de referentie-Compose
geen eigen healthcheck; het herstel hangt af van hoe snel de Cloudflare-edge de
tunnelverbinding herkent als hersteld nadat de container weer draait — doorgaans
enkele seconden. Clientzijdig geldt dezelfde Socket.IO-reconnectbackoff als in
scenario 1 (1, 2, 4, 8, 16, maximaal 30 s), dus het venster is opgeteld: enkele
seconden tunnelherstel + maximaal 30 s clientbackoff.

**Controlepunt (bron):**

- "De tunnel routeert alleen naar de reverse proxy. Redis en PostgreSQL blijven
  op het interne netwerk" (`DEPLOYMENT-AND-TESTING.md` §Bereikbaarheid, regels
  161–162) — geverifieerd door te bevestigen dat een tunnel-restart geen
  zichtbaar effect heeft op Redis/PostgreSQL-connectiviteit van `game-server`
  zelf, alleen op de publieke bereikbaarheid;
- reconnect met exponential backoff (`ARCHITECTURE.md` §Socketstrategie, regel
  190; concrete stappen in `PROTOCOL.md` §Reconnect, regel 438: "Backoff: 1, 2,
  4, 8, 16, maximaal 30 seconden");
- "Na verbinding vraagt client altijd een snapshot" en "Snapshot vervangt lokale
  fase, score en antwoordstatus" (`PROTOCOL.md` §Reconnect, regels 440–441) —
  geverifieerd door te controleren dat de client na tunnelherstel weer exact de
  serverstate toont, niet een verouderde lokale state;
- een reeds geaccepteerd antwoord van vóór de tunnelonderbreking wordt niet
  opnieuw verwerkt na reconnect (idempotentie via `actionId`, `PROTOCOL.md`
  regels 442–443).

---

## 5. Host offline

**Voorwaarde:** stack draait; er is een actieve room, geconfigureerd in
host-tempo (niet auto-tempo — in auto-tempo heeft dit scenario per definitie
geen effect, zie controlepunt hieronder); de host is verbonden en de game is
onderweg (bijv. in `ROUND_ACTIVE` of `SCOREBOARD`).

**Opdracht(en):** dit scenario is geen containeractie maar een clienthandeling —
er is geen server-/infracommando voor. Concreet: sluit de browsertab/PWA van de
host, of schakel netwerkconnectiviteit uit op het hosttoestel, tijdens de actieve
fase, en laat die daarna weer aan (host rejoint via sessietoken) of laat de
timeout aflopen zonder de host terug te laten keren, afhankelijk van wat het
scenario test.

**Verwacht hersteltijdvenster:** bij host-tempo wacht de game maximaal 60
seconden op de hostactie voordat de server automatisch overschakelt naar
auto-tempo of pauzeert (afhankelijk van configuratie). Keert de host binnen die
60 s terug, dan is er geen zichtbare onderbreking voor de spelers buiten de
korte statusmelding.

**Controlepunt (bron):**

- "auto-tempo loopt server-side door" — in auto-tempo modus hoort host offline
  geen effect te hebben op het rondeverloop (`GAME-FLOW.md` §Randgevallen 1,
  regel 159);
- "host kan via de sessietoken rejoinen" (regel 160);
- "bij host-tempo wacht de game maximaal 60 seconden" (regel 161);
- "daarna schakelt de server over naar auto-tempo of pauzeert volgens
  configuratie" (regel 162);
- "spelers krijgen een korte statusmelding" (regel 163) — geverifieerd door te
  bevestigen dat spelers een zichtbare, niet-blokkerende melding krijgen, geen
  stilzwijgende bevriezing van de UI;
- gerelateerd, apart te documenteren als de test lang genoeg doorloopt: als de
  host offline blijft over drie volledig onbeantwoorde rondes heen, "eindigt de
  game na een aanvullende timeout" (`GAME-FLOW.md` §Randgevallen 6, regel 199) —
  dit is een net iets andere trigger (drie onbeantwoorde rondes, niet enkel
  "host weg") en verdient een eigen observatie in het testverslag.

---

## 6. 10% spelers disconnect/reconnect

**Voorwaarde:** stack draait; er is een actieve room met een representatief
aantal verbonden testspelers (bijv. 10, zodat "10%" een concreet, telbaar getal
is: 1 speler), midden in een ronde of tussen rondes.

**Opdracht(en):** ook dit scenario is een clienthandeling, geen Compose-commando
— er wordt hier geen nieuwe loadtool geïntroduceerd (dat is DT5-gebied en apart
`deps`-geautoriseerd). Concreet: verbreek op ~10% van de verbonden testclients de
verbinding (netwerk uitschakelen op dat toestel/die emulator, of het tabblad
korter dan de graceperiode inactief laten) en laat ze daarna weer verbinden.

**Verwacht hersteltijdvenster:** reconnect binnen de Socket.IO-backoff-marge
(maximaal 30 s, zelfde reeks als scenario 1/4). De bron kwantificeert de
"korte graceperiode" voor uitsluiting uit de antwoordvoortgang-noemer niet in
een exact getal — dat is een gat in de brondocumentatie, geen aanname die dit
runbook zelf mag invullen; de daadwerkelijke uitvoering (Deel 2) moet die waarde
observeren en vastleggen, niet vooraf verzinnen.

**Controlepunt (bron):**

- "tijdelijk disconnected blijft maximaal gedurende de room-TTL herstelbaar"
  (`GAME-RULES.md` §Speler verlaat of disconnect, regel 164);
- "disconnected spelers tellen na een korte graceperiode niet mee in de noemer
  van antwoordvoortgang" (regel 165) — geverifieerd door te bevestigen dat de
  ronde niet blijft wachten op de disconnected 10% nadat die graceperiode
  verstreken is;
- "reeds behaalde punten blijven staan" (regel 167);
- "vrijwillig vertrokken spelers tellen niet mee in volgende rondes" (regel
  168) — expliciet te onderscheiden van een tijdelijke disconnect/reconnect in
  dit scenario;
- bij reconnect: "Snapshot vervangt lokale fase, score en antwoordstatus"
  (`PROTOCOL.md` §Reconnect, regel 441) zonder dat een reeds geaccepteerd
  antwoord opnieuw verwerkt wordt — "snapshot herstelt zonder dubbele punten"
  (`DEPLOYMENT-AND-TESTING.md` §5, regel 329);
- "één sessie mag meerdere sockets hebben tijdens een korte reconnectoverlap;
  na stabilisatie blijft de nieuwste socket leidend" (`DATA-MODEL.md` §Session,
  regels 90–91) — geverifieerd door te controleren dat er na stabilisatie geen
  duplicate/verweesde socketverbindingen voor dezelfde speler overblijven.

---

## Buiten scope van dit document

- Daadwerkelijke uitvoering van bovenstaande commando's (Deel 2) — die wacht op
  drie losse autorisaties per README.md §Checkpoints: stack
  installeren/opstarten, resetten, en per scenario apart het scenario zelf
  uitvoeren.
- Het daadwerkelijk aanmaken van een `docker-compose.chaos.yml`-override of
  `.env`-testbestand voor de dedicated projectnaam — dat is zelf al een
  infra-wijziging en valt onder dezelfde Deel 2-autorisatie als "stack
  installeren/opstarten".
- Loadtests (DT5, `k6`/Artillery) — dit runbook gaat over restart-/
  faalscenario's bij normale spelersaantallen, niet over belasting.
- De Mac Studio als 24/7-pilotserver of enige productieomgeving — expliciet
  `prod` en buiten scope van dit hele testplan.
