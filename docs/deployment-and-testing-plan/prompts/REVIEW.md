# Review — deployment- en testingplan plus T0

Reviewdatum: 2026-08-02

## Conclusie

De scheiding tussen zelfstandig testwerk en goedkeuringsplichtige productiehandelingen
is sterk. Het plan dekt bovendien vrijwel alle testlagen uit de bron. T0 is nog niet
uitvoerbaar zoals geschreven: de fase overschrijdt haar eigen bestandslimiet en de
gekozen Node-opdracht ontdekt een map niet op de veronderstelde manier. Voor T1 en
verder moeten testlaag, runner en bewijssoort scherper uit elkaar worden gehouden.

## Bevindingen

### 1. Hoog — T0 wijzigt minimaal 6 bestanden bij een limiet van 5

Stap 2 vraagt één placeholdertest in elk van vijf mappen. Stap 4 wijzigt daarnaast
`docs/deployment-and-testing-plan/README.md`. Dat zijn zes bestanden, terwijl de
harde grens maximaal vijf bestanden per actie toestaat.

**Voorstel:** maak in T0 alleen vijf `.gitkeep`-bestanden en laat de README-update
achterwege, of maak één centrale smoke-test plus placeholders. Nog eenvoudiger:
maak alleen de mapstructuur met `.gitkeep` en verplaats iedere runnercheck naar de
fase waarin die runner werkelijk wordt gebruikt. Als de README-update verplicht
blijft, splits die expliciet af als een volgende actie.

### 2. Hoog — `node --test tests/` ontdekt de testboom niet zoals aangenomen

Een expliciet meegegeven directory wordt door de lokaal aanwezige Node.js
`v24.16.0` als testmodule behandeld. Een lege map faalt met `MODULE_NOT_FOUND`; de
opdracht is geen algemene recursieve directory-discoverycheck. Daarmee bewijst een
placeholder per submap ook niet dat latere Playwright-, k6- of chaostests door hun
eigen runner worden opgepakt.

**Voorstel:** verifieer T0 alleen op map-/placeholderbestaan. Gebruik vanaf T1
expliciete Node-testbestanden, bijvoorbeeld `node --test tests/contract/*.test.js`.
Definieer per latere laag een eigen commando zodra de bijbehorende runner is gekozen.

### 3. Hoog — vijf groene placeholders geven een misleidend testsignaal

Een triviale `node:test` onder `e2e/`, `load/` of `chaos/` bewijst niets over
Playwright, k6, echte browsers of een Compose-omgeving. De placeholders worden wel
als groene tests geteld en kunnen daardoor de indruk wekken dat een laag aanwezig of
uitvoerbaar is.

**Voorstel:** gebruik `.gitkeep` of een korte `README.md` met runner/status per map,
geen triviale groene tests. Reserveer een groene test uitsluitend voor daadwerkelijk
getoetst gedrag.

### 4. Hoog — T1 mengt contract-, integratie- en gedragstests

Structurele payloadvalidatie past bij contracttests. De volgende geplande checks
vallen daar niet allemaal onder:

- `round:progress` maximaal 2× per seconde is temporeel servergedrag;
- duplicate `actionId`-idempotentie vereist verwerking en opslagstate;
- afwezigheid van `correctAnswer` in een actieve snapshot moet uiteindelijk tegen
  de echte snapshotproducer worden bewezen.

Handgeschreven assertions op voorbeeld-JSON kunnen die eigenschappen niet bewijzen.
Ze bewijzen hoogstens dat het eigen fixture overeenkomt met de eigen afleiding van
de documentatie.

**Voorstel:** beperk T1 tot statische vorm, enums en verboden velden op fixtures én
later echte produceroutput. Verplaats rate limiting en idempotentie naar integratie.
Markeer snapshotgeheimhouding als contractregel met een actieve integratietest zodra
de snapshotproducer bestaat.

### 5. Hoog — afgeleide schema's worden feitelijk een protocolcontract

Het plan noemt de schema's een voorstel, maar andere tests en fixtures zullen er
direct van afhankelijk worden. Zonder review van de `PROTOCOL.md`- en
`DATA-MODEL.md`-eigenaren kunnen handgeschreven schemas zo alsnog de feitelijke
publieke API of datavorm vastleggen. Bovendien is een verzameling ad-hoc assertions
niet hetzelfde als een volledig JSON Schema: required/optional, extra properties,
unions en versiecompatibiliteit blijven anders snel impliciet.

**Voorstel:** maak T1 eerst een traceability-matrix van gedocumenteerd payloadveld
naar bronregel en open beslispunt. Activeer contractcode pas nadat de contracteigenaar
de vorm heeft bevestigd. Kies vervolgens bewust tussen echte JSON Schema's (met een
dependencycheckpoint voor validatie) en een klein, expliciet JSDoc-validatorcontract.

### 6. Middel — onbeperkte `test.skip`-specs kunnen permanent groen blijven

Pending tests leggen intentie vast, maar `test.skip` telt niet als bewijs en maakt
de suite niet rood wanneer implementatie landt zonder dat iemand de skip verwijdert.
Omdat interfaces nog kunnen wijzigen, kunnen vroeg geschreven executable specs ook
al verouderd zijn voordat ze voor het eerst draaien.

**Voorstel:** leg nog niet uitvoerbare scenario's eerst vast in een genummerde
testmatrix met eigenaar, prerequisite en activatiecriterium. Als skips worden
gebruikt, voeg metadata of een aparte controle toe die onverwachte/overdatum skips
rapporteert en laat CI aantallen actieve, skipped en pending tests zichtbaar maken.

### 7. Middel — T4 overschat wat Playwright zelfstandig kan bewijzen

Playwright kan Chromium/WebKit en device-emulatie uitvoeren, maar dat is niet gelijk
aan Safari op een echte iPhone. App-switch, schermlock, native share sheets en echte
mobiele netwerkcondities zijn bovendien niet volledig betrouwbaar als gewone
Playwright-specs te automatiseren. De bron eist zowel emulatie als echte toestellen.

**Voorstel:** splits T4 in automatiseerbare browser-E2E en een expliciete echte-
device-/handmatige matrix. Gebruik Playwright voor routes, refresh, responsive
viewports en waar mogelijk browser-API-fallbacks; reserveer schermlock, native share,
echte Safari en fysieke netwerkproeven voor een device-runbook of aparte tooling.

### 8. Middel — T5 kan niet alle L0/L1-criteria alleen in k6 bewijzen

L0 is volgens de bron "functioneel en visueel"; een k6-script levert geen visuele
browsercontrole. Voor L1 vereisen blijvende geheugengroei na room-TTL, dubbele scores,
assetervaring op echte mobiele verbindingen en desynchronisatie aanvullende
servermetrics, state-inspectie of browserchecks. Alleen thresholds in het loadscript
zijn daarvoor onvoldoende. Ook is k6 doorgaans een aparte executable/tool, niet
zonder meer een projectdependency zoals Playwright of Artillery.

**Voorstel:** maak per criterium expliciet welk bewijs en welke runner nodig zijn.
Laat k6 alleen load en meetbare latency/error-thresholds leveren; koppel state-
invarianten aan integratiechecks, geheugen aan observability en visuele/mobiele
ervaring aan E2E of pilots. Houd installatie én uitvoering van k6 als afzonderlijke
checkpoints.

### 9. Middel — de scaffold sluit nog niet aan op de bestaande CI

De huidige managed workflow draait `npm ci`, ESLint en Jest, terwijl de repo geen
`package.json` heeft en dit plan `node:test` gebruikt. Een nieuwe `tests/`-boom wordt
daarmee niet automatisch uitgevoerd. T7 behandelt CI pas als laatste fase, zodat T1–T3
lang groen kunnen zijn zonder CI-borging.

**Voorstel:** documenteer al bij T0/T1 het lokale canonieke testcommando en de huidige
CI-kloof. Maak vóór inhoudelijke contracttests een apart, goedgekeurd CI-wiringvoorstel
of accepteer expliciet dat de tests tijdelijk alleen lokaal draaien. Wijzig het
Devkit-managed blok niet handmatig.

### 10. Laag — enkele scope- en eigenaarschapsclaims kunnen preciezer

- Contracttests zijn niet vanzelf eigendom van deze laag; contractproducent en
  consumer moeten de verwachtingen gezamenlijk bevestigen.
- Een lokale Compose-restart is weliswaar geen productieactie, maar verandert externe
  proces- en datastate. T6 moet installatie, opstarten, resetten en restartervaring
  afzonderlijk autoriseren en testdata-isolatie eisen.
- "k6-scripts voor L0–L3 exact" is te sterk: L0 vraagt echte/virtuele spelers én
  visuele beoordeling, en L2/L3 hebben een expliciete omgeving- en providercheck nodig.
- Het plan noemt Playwright-specs "geschreven maar niet-uitvoerbaar" vóór installatie.
  Zonder parser/linter kunnen syntax- en API-fouten dan niet worden gevalideerd;
  documentatie/pseudocode is eerlijker tot de runner is goedgekeurd.

## Wat al goed staat

- Productie, secrets, deployment en echte infrastructuur blijven duidelijk achter
  checkpoints.
- Co-located unittests van andere module-eigenaren worden niet gedupliceerd.
- De testlagen uit `DEPLOYMENT-AND-TESTING.md` zijn vrijwel volledig terug te vinden.
- Playwright en loadtooling worden terecht niet zonder dependencygoedkeuring
  geïnstalleerd.
- Load-/chaosuitvoering via publieke infrastructuur wordt terecht apart behandeld.
- Verboden deploymentpaden en het managed CI-bestand worden expliciet gerespecteerd.
- Latere prompts worden pas geschreven wanneer hun afhankelijkheden concreter zijn.

## Advies vóór uitvoering

Maak T0 runnerneutraal: alleen bevestigde mappen met placeholders die niet als groene
tests meetellen, binnen maximaal vijf bestanden. Corrigeer het verificatiecommando en
documenteer de CI-kloof. Splits daarna T1 strikt in statisch contractbewijs versus
integratiegedrag en laat de contracteigenaren de afgeleide vormen bevestigen. Werk voor
T4–T6 per criterium uit welke runner, omgeving en goedkeuring daadwerkelijk bewijs kan
leveren.
