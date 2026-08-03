# INT4b — metrics: `/metrics` en de kerntellers

Tweede van twee observability-prompts. Kopieer alles onder **Prompt** naar een
nieuwe agent-aanroep.

**Voer deze niet uit vóór [`INT4a-traceerbaarheid.md`](INT4a-traceerbaarheid.md).**
Zonder de correlatie en de allowlist daaruit kunnen de labels niet fatsoenlijk
worden gekozen, en een verkeerd label in een metric is moeilijker terug te
draaien dan in een logregel: metrics gaan doorgaans naar een systeem dat langer
bewaart en breder deelt.

**Overweeg eerst of dit nu moet.** Dertien tellers zonder dashboard, alert of
vaste kijker zijn decoratie — ze geven het gevoel van grip zonder de grip. De
traceerbaarheid uit INT4a betaalt zichzelf terug op de eerste avond dat er iets
misgaat, ook als niemand meekijkt. Metrics doen dat pas als iemand ze bekijkt.
Is dat nog niet geregeld, wacht dan.

---

## Prompt

Je werkt in de repo `game-app` als INT-A (integrator, vóór de repository-poort).
Deze opdracht bouwt het `/metrics`-endpoint en de tellers eromheen.

Wijzig `server/transport/rest.mjs`, `server/transport/socket.mjs`,
`server/index.mjs` en hun tests, plus een nieuw
`server/transport/metrics.mjs`. Raak `server/composition/`, `server/data/`,
`server/protocol/`, `client/`, `shared/` en `frontend/` niet aan. Commit niets.

### Lees eerst

- `docs/multiplayer/DEPLOYMENT-AND-TESTING.md` §Observability. Daar staat het
  endpoint (`/metrics`: alleen intern of beveiligd) en de kernmetrics-lijst.
- `docs/multiplayer/ARCHITECTURE.md` principe 9: geen databasewrite in het
  kritieke antwoordpad. Dat geldt in de geest ook hier — een teller mag het
  antwoordpad niet meetbaar vertragen.
- `server/transport/socket.mjs`, `logSafe()` en zijn `LOGGABLE_FIELDS`. Dezelfde
  privacyredenering geldt voor labels.
- `server/index.mjs`, `/healthz` en `/readyz` — die zijn af en blijven zoals ze
  zijn.

### Wat je bouwt

**Een `metrics.mjs` met tellers, in-process, geen dependency.** Een
Prometheus-client toevoegen is een `deps`-beslissing die niet is genomen; een
handgerolde teller met een tekstuele uitvoer in Prometheus-formaat volstaat en
houdt de keuze open.

**Het endpoint.** `/metrics`, en het mag **niet** publiek zijn. `ARCHITECTURE.md`
§Routing stuurt `/api/*` en `/socket.io/*` naar de game-server en de rest naar de
frontend; `/metrics` hoort in geen van beide. Kies een afscherming die niet op
security-by-obscurity leunt en motiveer hem — de reverse proxy is uiteindelijk de
juiste plek, maar de server moet zichzelf niet blootgeven als die er niet staat.

**De metrics uit de spec**, voor zover ze in deze laag bestaan:

- actieve rooms, actieve sockets, spelers per room;
- events per seconde, antwoorden per seconde;
- p50/p95/p99 eventlatency;
- event-loop lag;
- reconnects;
- foutcodes per eventtype;
- joinmethode (`qr` / `shared_link` / `code`).

Redislatency hoort bij de store en dus bij INT-B; roomstart- en
rematchpercentage zijn productcijfers die uit de analyticsweg komen, niet uit een
runtimeteller. Bouw die niet hier — meld ze als handoff als je vindt dat ze
ontbreken.

### Labels — hier zit het risico

Een label met hoge kardinaliteit (`roomId`, `sessionId`, `playerId`) laat de
metricopslag ontploffen: elke room wordt een eigen tijdreeks, en die blijven
bestaan lang nadat de room weg is. Gebruik ze **niet** als label.

En dezelfde privacyregel als bij logs, maar strenger, omdat metrics langer
bewaard worden en breder gedeeld: geen `gameCode`, geen `inviteId`, geen
displaynaam, geen IP. Foutcodes en eventnamen zijn veilig — dat zijn gesloten
verzamelingen uit `PROTOCOL.md`.

Bouw een expliciete allowlist van toegestane labelnamen, in dezelfde vorm als
`LOGGABLE_FIELDS`. Bij `logSafe()` bleek eerder dat een comment dat iets belooft
zonder het af te dwingen precies zolang standhoudt tot iemand er een veld bij
gooit.

### Wat een teller niet mag

Het antwoordpad vertragen. `submitAnswer` is de heetste weg in het systeem: bij
honderd spelers komen daar antwoordpieken binnen die volgens
`DEPLOYMENT-AND-TESTING.md` §Slagingscriteria L1 binnen twee seconden verwerkt
moeten zijn. Een teller ophogen is goedkoop, maar een histogram bijwerken of een
label samenstellen uit strings is dat minder. Meet het als je twijfelt.

### Tests

- Per metric een test dat hij daadwerkelijk oploopt bij de handeling die hij
  meet. Voer die handeling écht uit — een teller die je rechtstreeks ophoogt
  bewijst niets over de bedrading.
- Een test dat `/metrics` niet zomaar publiek bereikbaar is.
- Een test per verboden label: doe een echt verzoek met een `gameCode` en een
  displaynaam, haal `/metrics` op, en controleer dat geen van beide waardes
  erin voorkomt. Zoek op de **waarde**, niet op de labelnaam.
- Een test dat de kardinaliteit begrensd is: maak een aantal rooms aan en toon
  aan dat het aantal tijdreeksen niet meegroeit.

Assert in elke test eerst dat de opzet is gelukt — dat de room is aangemaakt, dat
het antwoord is geaccepteerd — vóór je de teller controleert. In dit repo zijn
vier keer verificaties groen geworden omdat het positieve geval nooit
plaatsvond.

### Grenzen

Geen nieuwe dependencies. Draai `npm test` in zijn geheel en meld het totaal.

### Opleveren

Return value voor een orchestrator. Geef: welke metrics je hebt gebouwd en welke
je bewust hebt overgeslagen met de reden, hoe `/metrics` is afgeschermd, de
labelallowlist met per label waarom hij veilig en laag-kardinaal is, wat je hebt
gemeten over de kosten in het antwoordpad, en het testresultaat.
