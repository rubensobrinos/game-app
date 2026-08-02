# Onafhankelijke review — GF0 scaffold en GF1 route-resolver

Reviewdatum: 2026-08-02

Deze review vult de bestaande [`REVIEW.md`](REVIEW.md) aan en laat die zelfreview
ongewijzigd.

## Conclusie

De route-resolver is klein, goed afgebakend en bewaakt terecht dat een host-URL geen
hostautorisatie verleent. GF0 en GF1 zijn nog niet uitvoeringsklaar. De scaffold heeft
een intern tegenstrijdige definition of done, het moduleformaat werkt niet direct in
de huidige browserapp, en de resolver maakt nog geen onderscheid tussen een bestaand
roomlookup en de syntactische geldigheid van een routeparameter.

## Bevindingen

### 1. Hoog — GF0 kan volgens zijn eigen stappen niet zelfstandig worden afgerond

Stap 2 zegt alleen de map te maken. Stap 3 wacht bewust tot GF1 een testbestand heeft.
De definition of done eist echter dat de map al minstens één werkend testbestand
bevat. Daarmee is GF0 óf afhankelijk van uitvoering van GF1, óf bouwt GF0 toch een deel
van GF1. Een lege directory wordt bovendien niet door Git vastgelegd.

**Voorstel:** laat GF0 na locatiebevestiging alleen `client/flow/.gitkeep` maken en
verifieer het bestaan van de map. Verplaats testrunner en testbestand volledig naar
GF1. Als GF0 en GF1 bewust in één actie worden uitgevoerd, noem het dan één gecombineerde
fase en behoud de locatiepauze vóór die actie.

### 2. Hoog — CommonJS lost Node-testbaarheid op maar niet browserbruikbaarheid

`route-resolver` is clientcode voor een app die losse scripts zonder bundler laadt.
Een bestand met `module.exports` kan niet rechtstreeks door die browserapp worden
geïmporteerd. De prompt noemt dit "consistent met de andere modules", maar servercode
en browsercode hebben hier verschillende runtimevoorwaarden. Zo ontstaat geteste
code die de bedoelde client niet kan gebruiken.

**Voorstel:** bevestig bij de gezamenlijke layoutbeslissing ook het moduleformaat.
Een dependency-vrije ES-module (`.mjs` of een overeengekomen browser-ESM-structuur)
kan door Node én moderne browsers worden geladen. Een UMD/global-wrapper kan bij de
huidige scripts passen, maar is een bewust architectuurcontract. Voeg geen bundler
toe zonder afzonderlijke goedkeuring.

### 3. Hoog — ongeldige codes worden als geldige routes geclassificeerd

De specificatie noemt een gamecode expliciet zescijferig. Toch verwacht test 10 dat
`/game/..%2Fhost%2F482917` een `game`-route met een willekeurige codewaarde oplevert.
Ook ontbreken tests voor `/game/foo`, `/game/12345`, `/game/1234567`, extra
padsegmenten en encoded separators. Bestaanscontrole hoort inderdaad bij de server,
maar syntactische routeherkenning kan zonder netwerk en voorkomt dat willekeurige
URL-input als een geldig gamescherm wordt behandeld.

**Voorstel:** accepteer voor `game`, `host` en `screen` uitsluitend exact zes ASCII-
cijfers. Laat alle andere waarden `unknown` retourneren. Valideer een `inviteId` als
één niet-leeg, URL-veilig segment volgens het bevestigde inviteformaat; decodeer niet
en voer nooit een tweede resolve uit. Vervang test 10 dus door een afwijzingstest.

### 4. Hoog — test 7 gebruikt de functiesignatuur niet eenduidig

De API neemt `pathname` en optioneel `search` als twee argumenten. Test 7 toont
`/game/482917?utm_source=whatsapp` als één input en zegt dat `search` wordt genegeerd.
Als die volledige string werkelijk als `pathname` wordt doorgegeven, maakt de query
deel uit van de code of moet de functie onverwacht zelf een URL gaan parsen.

**Voorstel:** schrijf de fixture exact als
`resolveRoute('/game/482917', '?utm_source=whatsapp')`. Of verwijder `search` volledig
uit de API als de resolver alleen `location.pathname` nodig heeft. Leg vast dat een
fragment nooit onderdeel van `pathname` is.

### 5. Middel — routecanonicalisatie introduceert onbesproken gedrag

Een trailing slash accepteren, routes hoofdlettergevoelig maken en onbekende
queryparameters negeren zijn redelijke keuzes, maar ze staan niet expliciet in
`GAME-FLOW.md`. Dit zijn zichtbare navigatieregels en dus geen letterlijke vertaling
van de bron. Ook is niet vastgelegd wat gebeurt bij dubbele slashes, extra segmenten,
een lege string, `null` of een volledig absolute URL.

**Voorstel:** benoem deze regels als een klein canonicalisatievoorstel dat bij GF0/GF1
wordt bevestigd. Definieer het invoercontract als een pathname dat met `/` begint en
laat malformed/non-string input deterministisch `unknown` retourneren zonder throw.
Voeg vaste tests toe voor extra segmenten en dubbele slashes.

### 6. Middel — het testcommando met een directory blijft onbetrouwbaar

De definition of done gebruikt `node --test client/flow/`. Zoals in de eerdere
reviews vastgesteld, behandelt de lokaal aanwezige Node.js `v24.16.0` een expliciet
directorypad niet als recursieve discoveryroot. Dat probleem verdwijnt niet zodra
er ergens in de directory een testbestand staat.

**Voorstel:** voer het concrete bestand uit:
`node --test client/flow/route-resolver.test.js` (of de bevestigde locatie en
extensie). Voeg later een canoniek projectbreed testcommando toe wanneer de repo een
runnerconventie heeft.

### 7. Middel — een inviteId is wel degelijk een gevoelige capability

De prompt benadrukt correct dat een inviteId geen hostrechten bevat. Het is volgens
`DATA-MODEL.md` en `ARCHITECTURE.md` echter wel een publieke, tijdelijke
joincapability. De rauwe waarde retourneren is functioneel nodig, maar mag niet in
analytics, foutmeldingen of logs terechtkomen. Alleen waarschuwen tegen `innerHTML`
dekt die tweede veiligheidsgrens niet.

**Voorstel:** voeg aan het contract toe dat de resolver niet logt en dat consumers
de inviteId alleen voor de joinaanroep bewaren/gebruiken. Geen persistentie of
telemetrie vanuit deze helper.

### 8. Laag — test 12 bewijst slechts de outputshape

Een exacte sleuteltoets voorkomt dat deze functie toevallig `role` of `isHost`
retourneert, wat nuttig is. Ze bewijst niet dat de applicatie later geen hostrechten
uit `{ route: 'host' }` afleidt. Dat echte beveiligingscontract hoort bij sessie- en
integratietests.

**Voorstel:** behoud test 12, maar beschrijf hem als lokale shape-invariant. Voeg
later een integratietest toe waarin `/host/{code}` zonder geldige hostsessie geen
hostactie kan uitvoeren.

## Wat al goed staat

- De bestaande zelfreview signaleert terecht de gezamenlijke repo-layoutbeslissing.
- De resolver doet geen roomlookup, navigatie, DOM-rendering of sessieautorisatie.
- Routes zijn volledig geankerd; prefix-fuzzy matching wordt expliciet getest.
- Een encoded separator wordt niet gedecodeerd en opnieuw geïnterpreteerd.
- Alle identifierloze routevarianten krijgen afzonderlijke aandacht.
- De optionele spectatorroute wordt alleen herkend; GF1 implementeert nog geen
  spectatorervaring.
- GF2–GF8 krijgen terecht pas later een actuele prompt.

## Advies vóór uitvoering

Regisseer eerst één gezamenlijke keuze voor `server/`, `client/` versus `frontend/`,
`shared/`, `tests/` en het moduleformaat. Maak GF0 daarna een echte, afzonderlijk
afsluitbare scaffoldfase. Leg voor GF1 syntactische identifierregels en het exacte
pathnamecontract vast, corrigeer de queryfixture en gebruik een expliciet testbestand
in het Node-commando. Daarna kan de resolver zonder verborgen routing- of buildkeuzes
worden uitgevoerd.
