# INT4b — metrics: counters, histogrammen en een afgeschermd `/metrics`

Tweede van twee observability-prompts.

**⛔ Niet uitvoeren zonder expliciet akkoord op de afscherming van `/metrics`.**
Dat raakt secrets en deployment, en de uitvoerder mag daar geen eigen
securitymodel voor kiezen. Zie §Afscherming: de vorm ligt hieronder vast, maar het
akkoord op een aparte metrics-secret moet er zijn vóór de eerste regel code.

Volgt ná [`INT4a-traceerbaarheid.md`](INT4a-traceerbaarheid.md), maar **er is geen
runtime-afhankelijkheid**. De volgorde is er zodat logging en metrics dezelfde
naamgeving en reviewdiscipline delen. Correlatie-ID's zijn voor metrics juist
irrelevant en zelfs gevaarlijk — zie §Labels.

**Overweeg eerst of dit nu moet.** Tellers zonder dashboard, alert of vaste kijker
zijn decoratie: ze geven het gevoel van grip zonder de grip. De traceerbaarheid uit
INT4a betaalt zichzelf terug op de eerste avond dat er iets misgaat, ook als
niemand meekijkt. Metrics doen dat pas als iemand ze bekijkt.

---

## Prompt

Je werkt in de repo `game-app` als INT-A. Deze opdracht bouwt het
`/metrics`-endpoint en de tellers eromheen.

Wijzig `server/transport/rest.mjs`, `server/transport/socket.mjs`,
`server/index.mjs`, een nieuw `server/transport/metrics.mjs`, en hun tests. Raak
`server/composition/`, `server/data/`, `server/protocol/`, `client/`, `shared/` en
`frontend/` niet aan. Commit niets.

### Lees eerst

- `docs/multiplayer/DEPLOYMENT-AND-TESTING.md` §Observability — het endpoint en de
  kernmetrics-lijst.
- `docs/multiplayer/ARCHITECTURE.md` principe 9 (geen write in het kritieke
  antwoordpad) en §Slagingscriteria L1 in `DEPLOYMENT-AND-TESTING.md`:
  antwoordpieken van honderd spelers binnen twee seconden verwerkt.
- `server/transport/safe-logger.mjs` uit INT4a — dezelfde allowlist-filosofie
  geldt voor labels, strenger nog.

### Metrictypes — dit is waar het eerste ontwerp fout zat

**Bouw cumulatieve counters, geen per-seconde-gauges.** Een
"events per seconde"-gauge hangt af van interne intervallen en reset bij een
herstart, waardoor de betekenis van de meting afhangt van de meter. Prometheus
rekent zelf `rate(...[1m])` uit.

Dus:

```text
rounda_socket_events_total{event="round:answer"}   1234
rounda_answers_total{outcome="accepted"}            940
```

Niet: `events_per_second`, `answers_per_second`.

**Bereken p50/p95/p99 niet zelf in-process.** Een lijst met alle metingen
bijhouden geeft onbegrensd geheugen, sorteerkosten, onduidelijke resetsemantiek,
en quantielen die niet over processen aggregeren. Gebruik een histogram met vaste
buckets:

```text
rounda_event_duration_seconds_bucket{event="round:answer", le="0.01"} 42
```

Buckets in seconden: `0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2`.
De quantielen komen later uit `histogram_quantile()`.

Geen dependency: schrijf de tekstuele Prometheus-uitvoer met de hand. Een
client-library toevoegen is een `deps`-beslissing die niet genomen is.

### Gauges — definieer de levenscyclus, anders is de meting onbruikbaar

"Actieve room" kan vier dingen betekenen. Leg vast:

| Metric | Definitie |
| --- | --- |
| `rounda_active_rooms` | rooms met minstens één actieve socket |
| `rounda_active_sockets` | actuele Socket.IO-verbindingen |
| `rounda_connected_player_sockets` | actieve sockets met een spelerrol |

De derde heet bewust `..._sockets` en niet `..._players`: bij twee browsertabs
telt hij twee verbindingen, geen twee spelers. Rooms die alleen nog in de store
bestaan horen bij storemetrics en dus bij INT-B, niet bij deze transportlaag.

**Handmatig op- en aftellen bij join, leave, kick en disconnect is foutgevoelig.**
Eén gemiste callback laat een gauge permanent verkeerd staan. Lees daarom bij
scrape-time uit de bestaande Socket.IO-adapterstate, of onderhoud één expliciete
registratieset waarvan disconnect gegarandeerd verwijdert. Test:

- normale connect en disconnect;
- twee sockets voor dezelfde sessie;
- kick;
- `fastify.close()`;
- een mislukte handshake telt niet als actief;
- meerdere rooms tegelijk;
- een eventhandler die werpt laat de tellers consistent achter.

### Reconnects — noem het niet zo

Een nieuwe verbinding met hetzelfde sessietoken kán een reconnect zijn, maar net
zo goed een tweede tab, een ander toestel of een dubbele verbinding. De
transportlaag kan dat niet betrouwbaar onderscheiden.

Bouw daarom:

```text
rounda_socket_connections_total
rounda_socket_disconnects_total{reason="..."}
rounda_session_duplicate_connections_total   (alleen als betrouwbaar detecteerbaar)
```

Noem iets pas `reconnects_total` wanneer het systeem het werkelijk onderscheidt.

### Labels — hier zit het grootste risico

**Nooit als label:** `roomId`, `sessionId`, `playerId`, `actionId`, `eventId`.
Elke room zou een eigen tijdreeks worden, en die blijven bestaan lang nadat de
room weg is. Dit is meteen de reden dat de correlatievelden uit INT4a hier juist
niet thuishoren.

**Nooit als label, om privacy:** `gameCode`, `inviteId`, displaynaam, IP. Metrics
worden langer bewaard en breder gedeeld dan logs, dus de regel is strenger.

**Wel veilig:** eventnaam en foutcode — maar alleen omdat het gesloten
verzamelingen uit `PROTOCOL.md` zijn. Normaliseer ze tegen die allowlist: een
willekeurige exceptioncode mag nooit ongefilterd een labelwaarde worden.

**"Spelers per room" botst met dit verbod** en moet dus anders. Publiceer geen
reeks per room maar een verdeling:

```text
rounda_room_size_bucket{le="5"}  4
rounda_room_size_bucket{le="10"} 7
```

Bouw een expliciete allowlist van toegestane labelnamen, in dezelfde vorm als de
logger uit INT4a.

### Event-loop lag — met levenscyclusbeheer

Gebruik `monitorEventLoopDelay()` uit `node:perf_hooks`. Leg vast: één monitor per
proces, de gekozen resolutie, de resetsemantiek, en dat de monitor bij
`fastify.close()` wordt uitgeschakeld. Een timer die blijft lopen houdt de
testrun of de shutdown open — en die shutdown is net gerepareerd, dus breek hem
niet opnieuw. Converteer naar seconden.

### Afscherming van `/metrics` — dit ligt vast, kies niet zelf

- Registreer het endpoint **alleen** wanneer een aparte metrics-secret
  geconfigureerd is. Ontbreekt die, dan bestaat het endpoint niet en geeft het
  pad een **404** — geen onbeveiligd endpoint.
- Authenticatie met een eigen bearer secret, constant-time vergeleken.
- **Nooit** hergebruik van speler- of hostsessietokens.
- De reverse proxy blokkeert publiek verkeer naar `/metrics` daarnaast; de server
  vertrouwt daar niet op.

### Kosten in het antwoordpad

`submitAnswer` is de heetste weg in het systeem. Een teller ophogen is goedkoop;
een label samenstellen uit strings of een histogram bijwerken is dat minder. Meet
het, en meld wat je hebt gemeten.

### Tests

- Per metric: hij loopt op door de handeling die hij meet, écht uitgevoerd. Een
  teller die je rechtstreeks ophoogt bewijst niets over de bedrading.
- `/metrics` geeft 404 zonder geconfigureerde secret, en 401 met een verkeerde.
- **Kardinaliteit:** parse de metricsuitvoer, controleer dat alleen toegestane
  labelnamen voorkomen, dat geen enkele reeks een `roomId`, `sessionId`,
  `playerId`, `actionId`, `eventId`, `gameCode` of `inviteId` bevat, en maak
  vervolgens vijftig rooms aan om te bewijzen dat het aantal reeksen gelijk blijft.
- **Privacy:** doe een echt verzoek met een `gameCode` en een displaynaam, haal
  `/metrics` op, en controleer dat die **waarden** er niet in staan.

Assert in elke test eerst dat de opzet gelukt is — dat de room bestaat, dat het
antwoord geaccepteerd is — vóór je de teller controleert.

### Grenzen

Geen nieuwe dependencies. Leg de testbaseline vast bij aanvang en eindig met
minstens hetzelfde aantal groene bestaande tests; pin geen vast getal.

### Opleveren

Return value voor een orchestrator. Geef: welke metrics je hebt gebouwd en welke
je bewust hebt overgeslagen met de reden, de precieze definitie per gauge, hoe je
de gauges consistent houdt bij disconnect en kick, de labelallowlist met per label
waarom hij veilig en laag-kardinaal is, hoe `/metrics` is afgeschermd, wat je hebt
gemeten in het antwoordpad, en de baseline vóór en ná.
