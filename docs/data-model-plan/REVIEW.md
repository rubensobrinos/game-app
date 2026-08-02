# Review — realisatieplan DATA-MODEL.md

Reviewdatum: 2026-08-02

## Conclusie

Het plan is grondig, benoemt veel echte beslismomenten correct en heeft de grenzen
met auth, dependencies en productie beter uitgewerkt dan de meeste zusterplannen.
DM0–DM9 zijn nog niet uitvoeringsklaar. De centrale (a)/(b)-indeling classificeert
enkele voorbeeldvormen en open semantiek ten onrechte als reeds bindend. Daardoor
zouden DM1–DM8 alsnog schema-, architectuur- en productkeuzes in code vastleggen vóór
de bijbehorende ADR of eigenaarsreview.

## Blokkerende bevindingen

### 1. Blocker — de action-cache-sleutel wijkt af van `DATA-MODEL.md`

Het brondocument definieert:

```text
room:{roomId}:action-cache
```

Het plan noemt in DM1:

```text
room:{roomId}:match:{matchId}:action-cache
```

Dat is geen transcriptie maar een andere keyspace en retentie-/rematchsemantiek.

**Voorstel:** herstel DM1 naar de letterlijk gedocumenteerde roomsleutel. Als een
match-scoped action-cache beter wordt gevonden, behandel dat als een expliciete
`database_schema`-wijziging met ADR en werk daarna `DATA-MODEL.md` eerst bij.

### 2. Blocker — voorbeelden worden behandeld als volledige schemas en enumlijsten

De JSON-blokken in `DATA-MODEL.md` tonen concrete voorbeelden, maar specificeren
niet voor ieder veld required/optional, onbekende velden, nullability of alle
toegestane enumwaarden. Voor `preset`, `difficulty`, `scoreboardFrequency`, `mode`,
`metricMode` en meerdere andere velden staat slechts één voorbeeldwaarde. De zin
"Enums worden in implementatie en protocolschema gedeeld" zegt dát er gesloten enums
moeten komen, niet welke volledige lijsten ze bevatten.

DM2/DM3 willen hiervan runtime-`assertShape()`-checks en vaste waardenlijsten maken.
Die checks zouden daardoor zelf het bindende schema ontwerpen.

**Voorstel:** splits iedere entiteit eerst in een traceability-tabel:
gedocumenteerd veld, voorbeeldwaarde, expliciete invariant en nog open schemaregel.
JSDoc mag de zekere velden beschrijven, maar activeer required/optional/nullability,
extra-propertybeleid en volledige enums pas na review/ADR door de schema- en
protocoleigenaren.

## Hoge bevindingen

### 3. Hoog — de TTL-refreshset ligt niet volledig vast

`DATA-MODEL.md` zegt dat TTL via een pipeline wordt ververst op roomkern, indexes en
"relevante matchkeys". Het document somt de keyspace op, maar bepaalt niet bij iedere
activiteit exact welke bestaande match-, round-, answer-, scoreboard-, sessie- en
lookupkeys moeten worden ververst. DM1 kan daarom niet zonder ontwerpbesluit één
autoritatieve functie voor "welke sleutels verversen" leveren.

**Voorstel:** laat DM1 wel de letterlijke key-builders en `ROOM_TTL_SECONDS` leveren,
maar maak de refreshmatrix eerst een voorstel met operatie/activiteit × sleutelsoort.
Laat repository/architectuur die matrix bevestigen voordat ze runtimebeleid wordt.
Neem ook expliciet op of oude matchkeys bij rematches dezelfde TTL blijven krijgen.

### 4. Hoog — content- en rendererversie zijn cross-document inconsistent

`DATA-MODEL.md` bewaart `contentVersion` en `rendererVersion` op `Room`.
`GAME-RULES.md` zegt dat de room één `contentVersion` voor de volledige match pint.
`ARCHITECTURE.md` zegt daarentegen dat iedere match zowel `contentVersion` als
`rendererVersion` pint. `Match` bevat die velden niet. Het plan kiest Room als
definitieve locatie en wil onveranderlijkheid tijdens een actieve match testen, maar
lost de betekenis bij rematch en deploy niet op.

**Voorstel:** markeer dit als een echte reconciliatie vóór DM2/DM6. Beslis of de room
de actuele pin projecteert, of iedere Match zijn eigen versies moet bewaren. Een
shapecheck in DM2 kan temporele onveranderlijkheid sowieso niet bewijzen; dat hoort bij
een bevestigde repositoryoperatie en integratietest.

### 5. Hoog — `toPublicRound()` heeft onvoldoende fase-/doelcontext

Een functie die altijd `correctAnswer` verwijdert is geschikt voor een actieve
snapshot, maar niet automatisch voor `round:ended`, waar de correcte oplossing juist
naar clients moet. "Public" is dus te breed: dezelfde Round heeft per fase en event
een andere veilige projectie. Bovendien kan het domweg verspreiden van
`publicQuestionPayload` alsnog servervelden lekken als de rondebouwer die payload
verkeerd vult.

**Voorstel:** noem de functie bijvoorbeeld `toActiveRoundSnapshot()` en geef haar
een expliciet allowlist-outputcontract. Ontwerp een afzonderlijke ended-resultaatvorm
bij de protocollaag. Test niet alleen dat `correctAnswer` ontbreekt, maar ook dat geen
onbekende servervelden via objectspread of `publicQuestionPayload` meekomen.

### 6. Hoog — naamverwerking bevat meerdere onbesliste algoritmes

De bron noemt zeven stappen, maar legt niet vast:

- wat een "zichtbaar teken" is (Unicode code point versus grapheme cluster);
- welke Unicode control/format-karakters worden verwijderd;
- case-/accentgevoeligheid bij uniciteit;
- suffixformaat en gedrag wanneer het suffix de limiet overschrijdt;
- de profanitylijsten en matchstrategie;
- de woordenlijsten en random-/uniciteitsstrategie voor gegenereerde namen.

DM4 behandelt alleen de profanitybron als checkpoint en zou de overige keuzes
stilzwijgend implementeren. Een pure Node-test kan bovendien niet bewijzen dat
`<script>` nooit wordt uitgevoerd; dat is een renderlaagtest.

**Voorstel:** splits DM4 in reeds bepaalde normalisatiestappen en een beslismatrix
voor de open semantiek. Test in deze module alleen stringtransformaties. Verplaats de
tekstnode/geen-`innerHTML`-garantie naar client- of E2E-tests.

### 7. Hoog — de repositorypoort is niet client- of mechanisme-neutraal

Een `Store` met `hGet`, `hSet`, `sAdd`, `zAdd`, `zRange`, `expire` en `multi` legt
Redisdatastructuren en een MULTI-achtig uitvoeringsmodel al vast. Dat botst met de
open hash-versus-JSON- en Lua-versus-MULTI-keuzes. De in-memory fake kan bovendien
wel atomair lijken zonder de concurrency- en foutmodi van Redis te modelleren.

**Voorstel:** wacht met de low-level `Store`-poort tot de ADR. Als eerder een poort
nodig is, definieer domeinoperaties zoals `loadRoom`, `saveAcceptedAnswerAtomically`
en `setRoomAndMatchPhaseAtomically`, zonder Redisprimitieven in het publieke
contract. Gebruik de fake alleen voor domeinsemantiek; claim geen bewijs van echte
Redisatomiciteit.

### 8. Hoog — DM7 kan "geen half verwerkte score" niet bewijzen

Een pure functie die een bundel voorgenomen writes teruggeeft kan aantonen dat de
write-set compleet is, maar niet dat opslag alles-of-niets uitvoert. Juist dat laatste
is de normatieve eis. Daarnaast verwijst DM7 naar `scoring.computeScore`, terwijl de
huidige DM1-implementatie `scoreAnswer()` als enige aanbevolen serveringang heeft om
acceptatie en score niet uiteen te laten lopen.

**Voorstel:** hernoem het bewijs naar "complete command/write-set" en reserveer
atomiciteit voor adapter-/integratietests na de Lua/MULTI-ADR. Laat DM7 via één
geïnjecteerde rules-ingang valideren én scoren, bij voorkeur het bevestigde
`validateAnswer()` + `scoreAnswer()`-pad. Leg vast hoe dezelfde `actionId` exact
dezelfde eerdere ack terugkrijgt zonder opnieuw rules-logica uit te voeren.

### 9. Hoog — analyticsaggregatie veronderstelt ongedocumenteerde events

`DATA-MODEL.md` definieert doeltabellen, maar geen analytics-eventschema of volledige
aggregatieregels. Het is bijvoorbeeld niet vastgelegd wanneer een gamesessie als
finished telt, hoe maxima en gemiddelden worden berekend, hoe reconnects/joinmethodes
worden gededupliceerd of hoe daily metrics over tijdzones lopen. DM8 kan dus niet
alleen uit de gegeven kolommen een correcte `aggregate.js` afleiden.

**Voorstel:** houd DM8 eerst bij een kolomtraceability- en privacy-matrix. Ontwerp het
analytics-eventcontract en aggregatiesemantiek als afzonderlijk voorstel met
product/data-review. Plaats `schema.sql` tot de engine-/schema-ADR bij voorkeur onder
`docs/` en noem het geen uitvoerbaar schema; een `.sql`-bestand in runtimecode kan
gemakkelijk als goedgekeurde migratie worden aangezien.

### 10. Hoog — een denylist-privacyguard geeft geen sterke privacygarantie

Controleren op bekende veldnamen mist aliassen, geneste objecten en nieuwe velden.
Een payload met bijvoorbeeld `participant`, `rawSession` of geneste antwoorddata kan
passeren zonder letterlijk `playerId` of `answer` te heten. Tegelijk zijn sommige
toegestane analyticsvelden, zoals `room_id_hash`, bewust identifiers en vragen ze om
exacte semantiek.

**Voorstel:** valideer analyticsrecords met een strikte allowlist per doeltabel en
wijs onbekende velden af. Combineer dit later met integratietests op de echte
persistente output. Houd logprivacy afzonderlijk, zoals het plan terecht al doet.

## Middelhoge bevindingen

### 11. Middel — DM9 legt een nieuwe subset vast vóór consumerreconciliatie

De acht velden van `toScoringPlayerView()` zijn niet allemaal nodig voor scoring en
standings; `eligibleFromRound`, `connected`, `left` en `kicked` bedienen latere
eligibility-/disconnectlogica. Tegelijk ontbreekt `teamId`, hoewel het
GAME-RULES-plan teams vóór zijn eigen GR7-interfacefase plaatst. De gekozen subset is
daarmee een nieuw intern contract, geen letterlijke JSON-transcriptie.

**Voorstel:** definieer kleine use-caseprojecties (`toStandingPlayerView`,
`toEligibilityPlayerView`, later `toTeamPlayerView`) samen met de consumer. Laat DM9
het reconciliatiemoment zijn vóórdat deze projecties als runtimeexports landen, niet
erna.

### 12. Middel — typebestanden per entiteit voorkomen serialisatiekoppeling niet

Veel losse `types/*.js`-bestanden kunnen onderhoud en imports versnipperen zonder dat
ze een latere serialisatie-ADR werkelijk isoleren; die isolatie hoort bij repository-
adapters en mappingfuncties. Ook is JSDoc zonder een typechecker vooral documentatie,
terwijl runtime-shapechecks een apart schema-oppervlak vormen.

**Voorstel:** kies de bestandsgranulariteit bij de gezamenlijke serverlayout. Maak
duidelijk onderscheid tussen typedefs, runtimevalidators en opslagmappers. Voeg geen
runtimevalidator toe alleen omdat er een entiteitsbestand bestaat.

### 13. Middel — keybuilders hebben invoervalidatie en key-injectionbeleid nodig

De patronen liggen grotendeels vast, maar niet of builders willekeurige strings,
dubbele scheidingstekens of Redis-globtekens accepteren. Een reeds berekende
`inviteHash` en IDs komen uit vertrouwde generators, maar die preconditie moet worden
vastgelegd om keyspaceverwarring te voorkomen.

**Voorstel:** laat builders alleen bevestigde canonieke identifierformaten accepteren
of documenteer dat validatie vóór de keylaag plaatsvindt. Voeg tests toe voor lege en
ongeldige segmenten. Los ook de ambiguïteit van `answers:{id}` op: documenteer
expliciet dat `{id}` het ronde-ID is als dat de bedoeling is.

### 14. Middel — DM0 herhaalt het bekende onjuiste Node-directorygedrag

`node --test server/data/` draait niet als succesvolle lege testdiscoverycheck op de
lokaal aanwezige Node.js. Een lege map wordt evenmin door Git bewaard.

**Voorstel:** maak na gezamenlijke locatiegoedkeuring alleen `.gitkeep` en verifieer
structuur. Voer vanaf DM1 expliciete testbestanden uit.

### 15. Vervallen — oude globale autonomielimiet

Deze bevinding was gebaseerd op de inmiddels vervangen globale Devkit-default. De
repo-eigen override staat grotere, samenhangende wijzigingen toe; 461 documentatieregels
vormen daarom geen beleidsprobleem en hoeven niet kunstmatig te worden opgesplitst.

### 16. Middel — fasen en commits worden door elkaar gebruikt

DM2 en DM3 zeggen dat ze over meerdere commits worden gesplitst. Een commit is echter
een repositoryhandeling en niet automatisch toegestaan door een implementatieprompt;
de relevante policygrens geldt per actie. Bovendien kan iedere deelactie afzonderlijk
getest en gereviewd moeten worden.

**Voorstel:** beschrijf subfasen of acties (`DM3a`, `DM3b`, `DM3c`) met eigen definition
of done, in plaats van commits voor te schrijven.

## Wat al goed staat

- Open keuzes rond Redisclients, serialisatie, hashing, auth, migrations en echte
  productieacties zijn expliciet achter checkpoints geplaatst.
- De lokale clientsessielaag is nu bewust toegewezen in plaats van vergeten.
- `Room.phase`/`Match.phase`-consistentie heeft terecht een eigen beslismoment.
- De grens tussen server-side naamnormalisatie en veilige clientrendering is in proza
  goed onderkend.
- Concrete Redisadapters en migratie-uitvoering blijven buiten de vroege fasen.
- De afhankelijkheid tussen answer-flow en game-rules is zichtbaar gemaakt.
- De correct-answer-lekregel en analyticsprivacy krijgen expliciete aandacht.
- De fasering signaleert bestandsaantallen in plaats van de autonomielimiet te negeren.

## Advies vóór DM0

Neem `server/data/` niet als losstaand vierde scaffoldbesluit. Leg eerst de gezamenlijke
server-/client-/shared-/tests-layout en het moduleformaat vast, zoals uit de eerdere
reviews naar voren kwam. Corrigeer daarna de action-cachekey en verplaats shape/enums,
TTL-refreshbeleid, repositoryprimitieven en analyticssemantiek van categorie (a) naar
een voorstel- of ADR-stap. Maak DM0 vervolgens een runnerneutrale `.gitkeep`-scaffold.
Daarna kan DM1 veilig beginnen met uitsluitend de werkelijk letterlijke keybuilders en
TTL-constante.
