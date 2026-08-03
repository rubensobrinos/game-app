# Professionaliseringsadvies — productiegedrag en observeerbaarheid

## Doel

Dit document beschrijft hoe de applicatie kan doorgroeien van “werkt in tests”
naar “gedraagt zich voorspelbaar tijdens een echt evenement en is beheersbaar als
de omgeving tegenzit”.

De doelomgeving — één Mac Studio, containers, Cloudflare Tunnel, Redis AOF,
PostgreSQL en NAS-back-ups — is voor pilots goed verdedigbaar. Professionalisering
betekent hier niet meteen Kubernetes of een groot platform. Het betekent:

- duidelijke servicecontracten;
- meetbare gebruikerskwaliteit;
- gecontroleerde degradatie;
- geoefend herstel;
- reproduceerbare releases;
- een operator die binnen minuten begrijpt wat er gebeurt.

## 1. Formuleer service-level objectives vanuit de spelervaring

Technische metrics krijgen pas betekenis wanneer ze aan gebruikersmomenten zijn
gekoppeld.

Aanbevolen pilot-SLI's:

| Gebruikersmoment | SLI | Voorlopig doel |
| --- | --- | --- |
| Homepage openen | succesvolle responses / totaal | ≥ 99,9% tijdens evenementvenster |
| Room creëren | succesvolle creates | ≥ 99% |
| Joinen | succesvolle joins zonder gebruikersfout | ≥ 99% |
| Actie-ack | p95 serverlatency | < 250 ms lokaal serverpad |
| Antwoord accepteren | p95 end-to-end ack | < 500 ms bij normale verbinding |
| Snapshotherstel | p95 reconnect tot bruikbare state | < 5 s |
| Fasebroadcast | p95 serverdispatch na transitie | < 250 ms |
| Procesrestart | room weer herstelbaar | < 60 s |
| Dataverlies | bevestigde antwoorden na crash | begrensd door expliciete AOF-belofte |

Deze waarden zijn startpunten, geen beloften. Meet ze tijdens pilots en stel ze
daarna bij. Publiceer voorlopig geen extern SLA; gebruik een intern SLO om
engineeringkeuzes te sturen.

## 2. Scheid health, readiness en functionele kwaliteit

Gebruik drie verschillende signalen:

### Liveness — `/healthz`

Beantwoordt alleen: leeft het proces en kan de eventloop nog reageren?

- geen databasequeries;
- geen secrets of versiedetails;
- snel en stabiel;
- geschikt voor containerrestartbeleid.

### Readiness — `/readyz`

Beantwoordt: kan deze instance veilig nieuw verkeer aannemen?

Controleer minimaal:

- configuratie geldig;
- Redisverbinding ready wanneer Redis vereist is;
- Lua-scripts geladen of laadbaar;
- PostgreSQL alleen wanneer het requestpad ervan afhankelijk is;
- content- en protocolversie beschikbaar;
- shutdown nog niet begonnen.

Geef intern componentstatus terug, maar publiek alleen ready/not-ready.

### Synthetic gameplay check

Een aparte periodieke check doorloopt een minimale roomflow met synthetische
identiteiten. Dit detecteert problemen die healthchecks missen: routing,
authenticatie, opslag, sockets en snapshots kunnen elk afzonderlijk “healthy”
zijn terwijl de keten niet speelbaar is.

## 3. Maak de runtimeconfiguratie expliciet en valideerbaar

Definieer één configuratieschema dat bij startup volledig wordt gevalideerd.

Categorieën:

- netwerk: host, port, publieke URL, trusted proxy;
- opslag: Redis/PostgreSQL-URL's, timeouts, vereiste modus;
- security: actieve pepperversies, originallowlist, limieten;
- product: maximale spelers, TTL, defaultconfig;
- observability: loglevel, metricsadres, release-id;
- shutdown/recovery: drain- en connectietimeouts.

Principes:

- productie mag niet stil terugvallen op in-memory als Redis ontbreekt;
- onbekende configuratiesleutels geven een waarschuwing of fout;
- secrets worden nooit in configdump of foutmelding opgenomen;
- defaults zijn geschikt voor development, expliciete waarden voor productie;
- `/readyz` reflecteert de gekozen modus.

Voeg een `config doctor` of droge startupmodus toe waarmee Compose en secrets
vóór een evenement kunnen worden gevalideerd zonder publieke serverstart.

## 4. Ontwerp graceful shutdown als protocolgebeurtenis

Een professionele shutdown is meer dan sockets sluiten.

Aanbevolen volgorde:

1. readiness op false;
2. nieuwe roomcreates en joins stoppen;
3. bestaande hostacties/antwoorden kort laten uitdruipen;
4. lopende rooms indien nodig naar herstelbare pauzestatus brengen;
5. laatste atomaire writes afronden;
6. clients een reconnectbaar shutdownsignaal sturen;
7. socketacceptatie stoppen;
8. Redis/PostgreSQL-verbindingen sluiten;
9. proces beëindigen vóór de containerdeadline.

Definieer één totaalbudget, bijvoorbeeld 20–30 seconden, met kortere budgetten
per stap. Iedere stap moet idempotent zijn; een tweede `SIGTERM` mag het proces
versneld maar gecontroleerd beëindigen.

Test dit met actieve rooms en antwoorden die precies tijdens shutdown aankomen.

## 5. Maak herstel een productpad

Herstelbaarheid hoort niet alleen in Redis/AOF-tests te bestaan. Bouw een
periodiek bewezen scenario:

```text
room + actieve ronde
→ antwoorden geaccepteerd
→ serverproces stopt abrupt
→ server start opnieuw
→ actieve-roomindex wordt geladen
→ room wordt herstelbaar gepauzeerd
→ clients reconnecten
→ snapshot wordt toegepast
→ korte countdown
→ spel gaat verder
```

Leg daarbij expliciet vast:

- welke data maximaal verloren mag gaan onder `appendfsync everysec`;
- hoe een mogelijk bevestigde maar nog niet gefsyncte actie wordt behandeld;
- of clients dezelfde `actionId` veilig opnieuw sturen;
- hoe timers na downtime worden herberekend;
- welke operatoractie nodig is wanneer automatisch herstel niet lukt.

Voer dit scenario vóór iedere pilotrelease uit tegen dezelfde Composevorm als
productie.

## 6. Bouw observeerbaarheid rond één causaliteitscontext

Gebruik op ieder request/event een context met uitsluitend niet-geheime ids:

```text
requestId
eventId
actionId
roomInternalId
matchId
roundId
sessionInternalId
releaseId
```

Roomcode, inviteId, token, displaynaam en antwoordinhoud horen niet in de context.
Gebruik interne willekeurige ids, en hash alleen wanneer correlatie buiten de
primaire store noodzakelijk is.

### Gestructureerde events

Log semantische gebeurtenissen in plaats van losse teksten:

```json
{
  "level": "info",
  "event": "round.phase_changed",
  "roomId": "room_…",
  "matchId": "match_…",
  "from": "ROUND_ACTIVE",
  "to": "ROUND_RESULT",
  "durationMs": 3,
  "releaseId": "…"
}
```

Maak een centrale allowlist per eventtype. Daarmee blijft privacycontrole
structureel en worden dashboards stabieler dan bij vrije logobjecten.

## 7. Kies metrics op besliswaarde en begrens cardinaliteit

### RED-metrics per ingang

- Rate: requests/events per type;
- Errors: foutcodes per type;
- Duration: p50/p95/p99.

### USE-metrics per resource

- utilization: CPU, geheugen, eventloop, Redisconnecties;
- saturation: eventlooplag, socketqueue, Redislatency, diskruimte;
- errors: reconnects, timeouts, AOF-/databasefouten.

### Domeinmetrics

- actieve rooms en sockets;
- roomcreatie-, join- en startpercentage;
- spelers per room als histogram;
- antwoorden per ronde;
- reconnect- en herstelduur;
- faseverblijftijd;
- rematchpercentage;
- action-id replays en CAS-conflicten;
- aantal rooms in `PAUSED` door recovery.

Gebruik nooit roomId, sessionId of playerId als permanent metricslabel. Dat maakt
de cardinaliteit onbegrensd. Zulke ids horen in logs/traces; metrics gebruiken
lage-cardinaliteitslabels zoals eventtype, fase, foutcode en release.

## 8. Voeg tracing selectief toe

Volledige distributed tracing is voor één serverinstance niet noodzakelijk.
Een lichte tracecontext is wel nuttig voor verticale paden:

```text
HTTP/socket ontvangst
→ authlookup
→ protocolvalidatie
→ compositie
→ Redis/Lua
→ broadcast/ack
```

Begin met handmatige durationvelden en request/actioncorrelatie. Introduceer
OpenTelemetry pas wanneer logs en metrics onvoldoende antwoord geven of wanneer
meerdere serverinstances ontstaan. Zo blijft de operationele complexiteit
proportioneel.

## 9. Definieer gecontroleerde degradatie

Niet iedere afhankelijkheidsfout hoeft hetzelfde effect te hebben.

| Situatie | Gewenst gedrag |
| --- | --- |
| Redis tijdelijk weg | geen nieuwe mutaties bevestigen; reconnect en readiness false |
| PostgreSQL analytics weg | gameplay blijft werken; buffer begrensd; verlies zichtbaar |
| Tunnel/edge weg | lokale services blijven gezond; externe check alarmeert |
| Contentversie ontbreekt | geen nieuwe match starten; bestaande gepinde match behouden |
| Metricsbackend weg | gameplay blijft werken; metrics worden begrensd gedropt |
| Disk bijna vol | alert; nieuwe zware writes/rooms gecontroleerd beperken |

Leg per afhankelijkheid vast of het systeem fail-open of fail-closed is. Voor
authoritative gameplaymutaties is fail-closed meestal juist; voor analytics en
telemetrie meestal fail-open met zichtbare degradatie.

## 10. Professionaliseer releases zonder zwaar platform

Aanbevolen releaseartefacten:

- immutable image-tag plus digest;
- gitcommit/release-id in logs en metrics;
- gegenereerde SBOM;
- database-/configcompatibiliteitscheck;
- testoverzicht;
- bekende risico's en rollbackinstructie;
- contentVersion en rendererVersion.

Releasevolgorde:

1. configuratie en back-up controleren;
2. image bouwen en smoke-testen;
3. migraties apart en expliciet uitvoeren;
4. server starten zonder publiek verkeer;
5. readiness en synthetic flow controleren;
6. verkeer openen;
7. kernmetrics gedurende vast observatievenster volgen;
8. release bevestigen of terugrollen.

Voor één Mac Studio is blue/green mogelijk met twee Compose-projecten op
verschillende interne poorten en één omschakeling in Caddy. Dat geeft een veel
veiliger releasepad zonder orchestrationplatform.

## 11. Maak back-upherstel bewijsbaar

Een back-up telt pas als hij teruggezet kan worden.

### PostgreSQL

- versleutelde dagelijkse dump;
- retentiebeleid;
- checksum;
- maandelijkse automatische restore naar een geïsoleerde database;
- privacyretentie ook in back-ups toepassen.

### Redis

Redis bevat actieve, tijdelijke state. Behandel AOF primair als
crashherstelmechanisme, niet als langetermijnarchief.

- bewaak AOF-fouten en rewrite;
- test herstel met echte rooms;
- maak vóór risicovolle hostwerkzaamheden een gecontroleerde snapshot indien
  operationeel nuttig;
- verwijder verlopen rooms ook uit herstelde state.

### Configuratie en secrets

- Compose, proxyconfig en migraties in git;
- secrets apart versleuteld back-uppen;
- herstelprocedure bevat ook DNS/tunnel en niet alleen databases.

Definieer eenvoudige doelen:

- RPO: hoeveel gegevensverlies maximaal acceptabel is;
- RTO: hoe lang herstel maximaal mag duren.

## 12. Werk met pilot-evidence

Maak van iedere pilot een gecontroleerde leerloop:

### Vooraf

- release-id vastleggen;
- synthetic match groen;
- capaciteit, disk en back-up controleren;
- dashboard en alerts testen;
- rollback en contactpersoon bevestigen.

### Tijdens

- aantal rooms/spelers;
- join- en antwoordlatency;
- foutcodes;
- reconnects;
- eventloop- en Redislatency;
- operatornotities met timestamps.

### Achteraf

- technische metrics naast gebruikersfeedback leggen;
- afwijkingen verklaren;
- maximaal drie verbeteracties prioriteren;
- SLO's bijstellen op bewijs;
- data volgens retentiebeleid opruimen.

Dit voorkomt dat pilots alleen “het voelde goed” opleveren en houdt tegelijk de
hoeveelheid proces beheersbaar.

## Gefaseerde route

### Nu — betrouwbare pilotruntime

1. Productieconfigschema en harde storemodus.
2. Health/readiness/synthetic-check scheiden.
3. Graceful-shutdownpad met vaste budgetten.
4. Eén restart/recoverytest door de volledige applicatieketen.
5. Kernlogs en RED/USE-metrics met release-id.
6. Pilotdashboard en drie urgente alerts: downtime, foutpiek, diskruimte.

### Daarna — herhaalbare operatie

1. Blue/green- of equivalent veilig releasepad.
2. Geautomatiseerde PostgreSQL-restoretest.
3. SLO-rapport per pilot.
4. Gecontroleerde degradatietests per afhankelijkheid.
5. Loadprofielen voor 1×100, meerdere middelgrote rooms en reconnectstorm.

### Later — groei

1. Tweede game-serverinstance en Redis Socket.IO-adapter.
2. Instance-onafhankelijke roomrouting.
3. OpenTelemetry indien meerdere processen diagnose moeilijk maken.
4. Capaciteitsmodel en automatische waarschuwing vóór verzadiging.
5. Gescheiden stagingomgeving die productieconfiguratie nauwkeurig spiegelt.

## Meetbare kwaliteitsdoelen

- Iedere release heeft een immutable id en reproduceerbaar artefact.
- Productie valt nooit stil terug op in-memory-opslag.
- `/healthz`, `/readyz` en synthetic gameplay meten drie verschillende dingen.
- Graceful shutdown sluit binnen het gekozen budget zonder nieuwe mutaties te
  bevestigen nadat draining begon.
- Een procesrestart met actieve room is periodiek end-to-end bewezen.
- Dashboardlabels hebben begrensde cardinaliteit en bevatten geen persoonsgegevens.
- Back-uprestore is minstens maandelijks aantoonbaar uitgevoerd.
- Iedere pilot levert latency-, fout-, reconnect- en herstelbewijs op.

## Besluiten die hiervoor nuttig zijn

1. Welke RPO en RTO zijn acceptabel voor pilots?
2. Moeten bestaande rooms tijdens een deploy uitspelen, worden gepauzeerd of
   mogen ze gecontroleerd vervallen?
3. Welke drie SLO's bepalen als eerste of een pilot geslaagd is?
4. Is blue/green op dezelfde Mac Studio gewenst vóór Pilot B, of volstaat een
   kort onderhoudsvenster?

