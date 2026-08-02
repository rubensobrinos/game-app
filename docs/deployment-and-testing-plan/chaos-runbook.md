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

   Voor scenario's die de tunnel raken komt daar het `tunnel`-profiel bij:

   ```
   docker compose -p aseso-game-chaos -f docker-compose.yml --profile tunnel up -d
   ```

2. **Resetten naar een schone teststand** — volumes van de vorige run weg,
   daarna opnieuw op, zodat elk scenario met bekende, lege Redis-/
   PostgreSQL-state begint:

   ```
   docker compose -p aseso-game-chaos down -v
   docker compose -p aseso-game-chaos up -d
   ```

3. **Preflight tegen de échte stack** — vóórdat een scenario's opdracht wordt
   gegeven, controleren dat de aannames in dit runbook nog kloppen tegen wat er
   daadwerkelijk draait: bestaat de containernaam exact zo (`docker compose -p
   aseso-game-chaos ps`)? Rapporteert de healthcheck het interval/retries zoals
   hieronder aangenomen (`docker inspect --format '{{json .State.Health}}'
   <container>`)? Draait Redis daadwerkelijk met `--appendonly yes
   --appendfsync everysec` (`docker compose -p aseso-game-chaos exec redis
   redis-cli config get appendonly` / `appendfsync`)? Dit runbook is geschreven
   vóórdat de Compose-stack en de servercontainers echt bestonden
   ([`REVIEW-DT3B-DT7.md`](prompts/REVIEW-DT3B-DT7.md) #9); containernamen,
   healthchecks, AOF-instellingen en hersteltijdvensters hieronder zijn
   documentaannames op basis van `ARCHITECTURE.md`/`DEPLOYMENT-AND-TESTING.md`,
   niet geverifieerd gedrag. Wijkt de preflight af van wat een sectie hieronder
   aanneemt, corrigeer eerst deze sectie's aanname vóórdat het scenario wordt
   uitgevoerd — voer nooit een scenario uit tegen een aanname waarvan de preflight
   al liet zien dat die niet klopt.
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
- geen `ports`-mapping naar 80/443 op de hostmachine tenzij het scenario dat
  specifiek vereist (tunnel-reconnect); waar mogelijk alleen via het interne
  Compose-netwerk of `docker compose exec` benaderen;
- na afloop van een testsessie: `docker compose -p aseso-game-chaos down -v` om
  geen chaos-testdata te laten rondslingeren.

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
docker compose -p aseso-game-chaos --profile tunnel restart cloudflared
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
