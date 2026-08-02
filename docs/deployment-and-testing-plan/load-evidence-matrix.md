# Evidence-matrix — loadtestlaag (DT5, Deel 1)

Onderdeel van [`README.md`](README.md), fase DT5, Deel 1, uitgevoerd volgens
[`prompts/DT5-loadtests.md`](prompts/DT5-loadtests.md). Bron:
[`docs/multiplayer/DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md)
§Testlagen → 6. Loadtests (regels 331–341) en §Slagingscriteria L1 (regels 343–354).

Dit is **geen uitvoerbare code** en bevat **geen k6-script**. Dit is de stap die
[`prompts/REVIEW.md`](prompts/REVIEW.md) #8 en #10 vragen: eerst per criterium
vastleggen welke runner het daadwerkelijk kan bewijzen, vóórdat er een regel
loadtestcode wordt geschreven. De reden is simpel — k6 (of een vergelijkbare
Socket.IO-loadclient) genereert verkeer en meet doorvoer/latency/foutthresholds,
maar heeft geen browser, geen visuele weergave en geen zicht op servergeheugen over
tijd. Overal "k6" invullen zou, zoals REVIEW.md #8 opmerkt, een vals bewijs
suggereren voor criteria die het niet kan leveren. Deze matrix wijst daarom per
criterium de kleinst mogelijke, eerlijke combinatie van runners aan; Deel 2 (k6-
scripts, pas na `deps`-akkoord) mag alleen scripts schrijven voor de rijen waar k6
hieronder daadwerkelijk (mede) als bewijs staat.

Runnercategorieën, zoals gevraagd door de prompt: **k6** (of een gelijkwaardige
loadclient — de bron noemt zelf ook Artillery of een eigen Socket.IO-loadclient,
regel 333), **integratietest (DT3)** ([`integration-matrix.md`](integration-matrix.md)),
**observability-metric** (§Observability, regels 201–223), **E2E (DT4)**
([`prompts/DT4a-playwright-e2e.md`](prompts/DT4a-playwright-e2e.md) /
[`prompts/DT4b-device-matrix.md`](prompts/DT4b-device-matrix.md)) en **handmatige
pilot** (§Handmatige pilots, regels 356–384, of een losse visuele controlesessie voor
L0 die niet dezelfde omvang heeft als Pilot A/B).

| # | Criterium (niveau) | Bronregel(s) | Runner/methode die het daadwerkelijk bewijst | Waarom die en niet (alleen) k6 |
| --- | --- | --- | --- | --- |
| 1 | L0 — 1 room × 20 echte/virtuele spelers, "functioneel en visueel". | DEPLOYMENT-AND-TESTING.md:338. | E2E (DT4a) voor het automatiseerbare functionele deel + handmatige visuele controle (DT4b-achtige sessie, kleiner dan Pilot A/B). | De bron eist letterlijk "visueel", niet alleen functioneel. k6 stuurt en ontvangt protocolberichten maar rendert niets — het kan niet beoordelen of het scoreboard, de timer of de rondeovergang er correct uitzien op 20 (virtuele) clients. Dat vereist een mens of een browser-gestuurde check die het scherm daadwerkelijk bekijkt, zoals REVIEW.md #7/#10 en README.md §DT4b al vaststellen voor vergelijkbare visuele/echte-toestel-criteria. |
| 2 | L1 — geen desynchronisatie. | DEPLOYMENT-AND-TESTING.md:345. | Integratietest (DT3), zie [`integration-matrix.md`](integration-matrix.md) rijen 7, 11, 13, 14 (state-machine, multi-room isolatie, snapshotproducer). | Desync is een inhoudelijke state-invariant: bewijzen dat alle clients dezelfde ronde/score/state zien vereist het vergelijken van serverstate en snapshots tegen verwachte overgangen, niet het meten van doorvoer. k6 ziet dat een bericht aankomt, niet of de inhoud voor alle 100 spelers consistent is. Onder load specifiek zou dit een domeinbewuste loadclient vereisen die per virtuele speler ontvangen state vergelijkt (functionele assertie), geen generieke k6-threshold — of die vorm nodig/haalbaar is, is een Deel 2-beslissing, niet Deel 1. |
| 3 | L1 — geen dubbele antwoorden of scores. | DEPLOYMENT-AND-TESTING.md:346. | Integratietest (DT3), zie [`integration-matrix.md`](integration-matrix.md) rij 12 (idempotente `actionId`-verwerking). | Dit is een idempotentie-/opslaginvariant (dedupe op `actionId`, score wijzigt nooit tweemaal), aantoonbaar door na een retry-scenario de opgeslagen state te inspecteren — niet door een pass/fail-threshold in een loadscript. Onder load moet dezelfde assertie herhaald worden met veel gelijktijdige dubbele pogingen; dat is nog steeds een functionele storage-check, geen doorvoermeting, ook als k6 de belasting genereert. |
| 4 | L1 — p95 realtime-eventlatency onder 300 ms via gecontroleerde publieke route. | DEPLOYMENT-AND-TESTING.md:347. | k6 (of een eigen Socket.IO-loadclient). | Dit is letterlijk een doorvoer-/latencymetric — precies waarvoor k6 gebouwd is en waarvoor de bron zelf k6/Artillery/eigen loadclient noemt (regel 333). Let op: de eis geldt expliciet "via gecontroleerde publieke route" — het schríjven van de k6-check hoort bij Deel 2, maar het dáárop uitvoeren tegen enige publieke/tunnel-route blijft, ongeacht hoe simpel het threshold is, onderdeel van het Deel 3-checkpoint (README.md §Checkpoints: "extra nadrukkelijk voordat er ooit via de publieke route wordt getest"). |
| 5 | L1 — antwoordpieken van 100 spelers binnen twee seconden verwerkt. | DEPLOYMENT-AND-TESTING.md:348. | k6 (of een eigen Socket.IO-loadclient). | Ook dit is een timing-/doorvoermetric: de loadgenerator kan zelf timestampen wanneer een piek van 100 gelijktijdige antwoorden verstuurd is en wanneer alle bijbehorende acks/broadcasts terug zijn. Geen visuele, state- of geheugeninspectie nodig — dit past bij wat k6/Artillery/een eigen Socket.IO-loadclient rechtstreeks meet. |
| 6 | L1 — reconnectsnapshot correct. | DEPLOYMENT-AND-TESTING.md:349. | Integratietest (DT3), zie [`integration-matrix.md`](integration-matrix.md) rij 14 (snapshotproducer bevat geen `correctAnswer`); inhoudelijk verwant aan §Restart- en chaostests ("snapshot herstelt zonder dubbele punten", regel 329 — DT6, apart getraceerd, hier niet als runner meegeteld). | "Correct" is een inhoudscheck (juiste ronde, juiste score, geen dubbele punten, geen lekken van het juiste antwoord), geen doorvoercijfer. k6 kan een disconnect/reconnect onder load wél *veroorzaken*, maar het bewijs dat de teruggekregen snapshot inhoudelijk klopt vereist assertions tegen de snapshotstructuur/servertoestand zoals DT3 die al specificeert — dat is een integratie-/contractcheck, geen k6-threshold. |
| 7 | L1 — geen blijvende geheugengroei na room-TTL. | DEPLOYMENT-AND-TESTING.md:350. | Observability-metric (§Observability, regels 201–223: `/metrics`, actieve rooms/sockets, event-loop lag). | Dit vereist het volgen van procesgeheugen (RSS/heap) over tijd, van vóór tot ruim ná meerdere room-TTL-cycli — een tijdreeks die je afleest uit metrics/dashboards, niet een pass/fail binnen één k6-scriptrun. k6 meet event-/requestlatency tijdens de run, niet het geheugenprofiel van het serverproces erna. |
| 8 | L1 — frontend-assets laden acceptabel op echte mobiele verbindingen. | DEPLOYMENT-AND-TESTING.md:351. | E2E (DT4a, trage-4G-emulatie als geautomatiseerde steekproef) + handmatige pilot/DT4b (echt toestel, echte mobiele verbinding). | Zoals REVIEW.md #7 al vaststelt: emulatie is niet gelijk aan een echte Safari/iPhone op een echte mobiele verbinding. "Acceptabel laden" is bovendien een UX-oordeel, geen protocolmetric. k6 test alleen backend-/socketverkeer, niet het laden van frontend-assets in een browser. |
| 9 | L2 — 20 rooms × 50 spelers, doel "1.000 gelijktijdige spelers". | DEPLOYMENT-AND-TESTING.md:340. | k6 (of eigen loadclient) voor de ruwe schaal-/foutthresholds + observability-metric (actieve rooms/sockets, event-loop lag, Redislatency) om te zien *of* en *waar* het knelt. | Het aantal gelijktijdige spelers halen zónder foutthresholds te overschrijden is een doorvoeroefening (k6-terrein), maar "1.000 gelijktijdige spelers" zonder degradatie aantonen vereist ook dat de kernmetrics (event-loop lag, Redislatency, foutcodes) binnen bereik blijven — dat lees je af in observability, niet in de k6-samenvatting alleen. |
| 10 | L3 — 200 rooms × 50 spelers, doel "knelpuntanalyse na CDN/schaalwerk". | DEPLOYMENT-AND-TESTING.md:341. | k6 (of eigen loadclient) als lastgenerator + observability-metric als eigenlijke analyse-uitkomst. | Het doel is hier expliciet "knelpuntanalyse", geen pass/fail-getal: k6 levert de belasting, maar het knelpunt zélf (waar loopt event-loop lag op, waar loopt Redislatency op, welke foutcodes verschijnen) wordt zichtbaar via de kernmetrics uit §Observability, niet via een k6-threshold-uitslag. |

## L2/L3: expliciete omgeving-/providercheck vóór uitvoering

De bron zegt dit letterlijk (DEPLOYMENT-AND-TESTING.md:353–354): "L2 en L3 worden
eerst lokaal/LAN uitgevoerd. Grote tests via tunnel of publieke infrastructuur alleen
gecontroleerd en conform providerlimieten." Dat betekent dat rijen 9 en 10 hierboven,
zelfs ná een `deps`-akkoord voor k6 (Deel 2) en een uitvoeringsakkoord (Deel 3), niet
zomaar tegen de Mac Studio/Cloudflare Tunnel-opstelling mogen draaien: eerst
lokaal/LAN, en pas daarna — expliciet gecontroleerd en binnen de limieten van de
gebruikte provider — eventueel via tunnel of publieke infrastructuur. Dit is dezelfde
scheiding die `prompts/DT5-loadtests.md` Deel 3 en `README.md` §Checkpoints al
vastleggen ("extra nadrukkelijk voordat er ooit via de publieke route... wordt
getest"); deze matrix voegt er alleen aan toe dat die omgeving-/providercheck voor
L2/L3 nog vóór de gewone Deel 3-uitvoeringsvraag moet zijn beantwoord, niet
gelijktijdig ermee.
