# Review — productplan, PD0 en PD1

Reviewdatum: 2026-08-02

## Conclusie

Het plan bewaakt de grenzen met de andere specificaties goed en stelt terecht geen
nieuwe productbeslissingen voor. PD0 en PD1 zijn nog niet uitvoeringsklaar. Er staat
een concrete telfout in de scope-lijst, het voorgestelde gedeelde moduleformaat past
niet zonder meer bij de huidige browserapp, en de guard biedt met vrije string-ID's
minder bescherming dan zijn naam suggereert.

## Bevindingen

### 1. Hoog — `PRODUCT.md` bevat 12 uitsluitingen, niet 11

Het plan en PD1 spreken herhaaldelijk over 11 items. De bron bevat er 12:

1. accounts/profielen/e-mail/wachtwoorden;
2. native apps;
3. globaal leaderboard;
4. vriendenlijsten/chat;
5. verplichte avatars;
6. co-host-/moderatorrollen;
7. user-generated quizsets;
8. betalingen/premium;
9. uitgebreide groepshistorie;
10. spectator-scherm als vereiste;
11. permanente opslag van spelersnamen;
12. één container/proces per game.

De voorbeeldconstante bevat overigens wél 12 ID's. Daardoor spreken bron,
omschrijving en test 6 elkaar tegen.

**Voorstel:** wijzig overal `11` in `12` en laat test 6 vergelijken met een vaste
verwachte lijst van alle twaalf canonieke items.

### 2. Hoog — CommonJS onder `shared/` is niet automatisch bruikbaar in de browser

Het plan motiveert `shared/product/` doordat client en server dezelfde waarden nodig
hebben. De huidige app draait echter rechtstreeks in de browser zonder buildstap,
terwijl de voorbeelden `module.exports` gebruiken. Zo'n CommonJS-module kan de
browser niet rechtstreeks laden. Alleen de locatie delen maakt de code dus nog niet
werkelijk gedeeld.

**Voorstel:** laat PD0 naast de map ook het moduleformaat expliciet bevestigen. Kies
bijvoorbeeld browsergeschikte ES-modules met `.mjs`, of beperk PD1 eerlijk tot een
Node-side beleidsregister totdat de architecture-eigenaar een gedeelde modulevorm
heeft vastgesteld. Voeg geen bundler of `package.json` toe zonder de vereiste
goedkeuring.

### 3. Hoog — de scope-guard kan alleen exacte, zelfbedachte ID's herkennen

`assertNotInMvpScope(featureIds)` accepteert vrije strings. Daardoor passeren
bijvoorbeeld `premium`, `email_accounts`, `moderator` of een typefout ongemerkt,
hoewel ze onder een uitsluiting vallen. De ID-taxonomie staat niet in `PRODUCT.md`
en is dus zelf een nieuw intern contract. Dat maakt de functie geen betrouwbare
scopebewaker voor andere modules.

**Voorstel:** presenteer PD1 primair als een canoniek beleidsregister en bied een
eerlijke lookup aan, bijvoorbeeld `isExplicitlyExcluded(id)`. Als echte enforcement
gewenst is, moet eerst een gesloten, gedeelde feature-ID-enum met de betrokken
eigenaren worden afgesproken. Tot dat moment mag een onbekende ID niet als bewijs
gelden dat iets binnen de MVP valt.

### 4. Middel — belangrijke kwalificaties verdwijnen in de platte ID-lijst

Niet ieder bronitem verbiedt een volledige feature. `spectator-scherm als vereiste`
sluit een verplicht scherm uit, terwijl `PRODUCT.md` een optionele spectatorroute
juist als latere uitbreiding noemt. Ook zijn `betalingen of premium` en
`accounts, profielen, e-mail, wachtwoorden` samengestelde beleidsregels. Een enkel
ID kan die betekenis verliezen wanneer consumers het als algemene featureban lezen.

**Voorstel:** modelleer ieder item als `{ id, text }` en bewaar de volledige
brontekst als autoritatieve betekenis. Gebruik bijvoorbeeld
`spectator-screen-required`, niet een breed `spectator-screen`. Documenteer dat de
registry uitspraken over MVP-scope bevat en geen algemeen verbod voor latere fasen.

### 5. Middel — de tests bewijzen de inhoud van de drie harde regels niet

Test 1 controleert alleen het aantal en de drie zelfgekozen ID's. Een lege of foutieve
`text` zou nog steeds slagen. Dat botst met het doel om juist de productregels
machine-leesbaar en traceerbaar te maken. De prompt noemt de regels bovendien
"letterlijk, ingekort" en de voorbeeldteksten zijn parafrases; dat is traceerbaar,
maar niet letterlijk.

**Voorstel:** neem de volledige normatieve tekst uit `PRODUCT.md` over en vergelijk
in tests zowel `id` als `text` met een vaste verwachte tabel. Vervang "letterlijke
overname" door "één-op-één traceerbare representatie" als redactionele verkorting
bewust toegestaan blijft.

### 6. Middel — `node --test <map>` is geen geldige map-discoverycheck

PD0 stelt dat `node --test shared/product/` op een lege map succesvol hoort te zijn.
Op de lokaal aanwezige Node.js `v24.16.0` wordt een opgegeven map als testmodule
behandeld en faalt een lege map met `MODULE_NOT_FOUND`. Dezelfde mapaanroep in de
PD1-definition-of-done is daardoor ook geen betrouwbare testopdracht.

**Voorstel:** maak in PD0 alleen de bevestigde map met `.gitkeep` en verifieer het
bestaan ervan. Voer vanaf PD1 expliciete testbestanden uit, bijvoorbeeld:
`node --test shared/product/hard-rules.test.js shared/product/mvp-scope-guard.test.js`.

### 7. Middel — het guardcontract specificeert invoer- en foutgedrag niet

Bij `null`, een string in plaats van een array, dubbele overtredingen of niet-string
items ontstaat toevallig JavaScript-gedrag in plaats van een afgesproken resultaat.
Ook wordt niet vastgelegd of de volgorde van overtredingen stabiel moet blijven en
welk fouttype consumers mogen verwachten.

**Voorstel:** kies een klein expliciet contract. Voor een publieke assert-helper:
valideer een array van canonieke string-ID's, gebruik een benoemde foutcode of
foutklasse en test meerdere overtredingen plus duplicaten. Voor alleen een registry
kan de assert-helper beter vervallen; dat vermijdt een voortijdig API-contract.

### 8. Laag — enkele planclaims verdienen aanscherping

- `shared/product/` sorteert wel degelijk voor op een top-level mapstructuur, ook al
  heet die voorlopig. Dat is precies waarom PD0-goedkeuring nodig is; formuleer het
  niet als architectuurneutraal.
- Een uitsluitingslijst is niet automatisch nodig in zowel UI als servervalidatie.
  Defaults en featurebeschikbaarheid zijn deelbare runtimegegevens; veel negatieve
  scopebesluiten zijn beter traceability-/testdata dan productiecode.
- PD4 kan niet eisen dat latere uitbreidingen niet overlappen met PD1: een optionele
  spectatorroute en betaald white-label liggen inhoudelijk juist naast de
  gekwalificeerde uitsluitingen "spectator als vereiste" en "betalingen/premium in
  de MVP". Een simpele ID-disjointness-test zou betekenisvolle overlap verwarren
  met tegenspraak.

## Wat al goed staat

- Het plan maakt helder onderscheid tussen bestaand productbeleid en nieuwe
  designbeslissingen.
- De grenzen met `DATA-MODEL.md`, `PROTOCOL.md`, `GAME-FLOW.md` en `GAME-RULES.md`
  zijn expliciet.
- PD0 vraagt terecht toestemming voordat een nieuwe top-level code-indeling ontstaat.
- PD1 blijft dependency-vrij en probeert geen enforcement in modules van andere
  eigenaren te injecteren.
- Presets, feature-gates en acceptance-traceability zijn logisch in afzonderlijke
  fasen geplaatst.
- PD2–PD6 krijgen terecht pas vlak voor uitvoering een eigen prompt.

## Advies vóór uitvoering

Corrigeer eerst de telling naar 12. Beslis bij PD0 samen met de architecture-eigenaar
of dit werkelijk gedeelde browser/servercode wordt en welk dependency-vrij
moduleformaat daarbij hoort. Maak PD1 vervolgens een exact beleidsregister met
volledige teksten; voeg alleen een assert-helper toe als er ook een gesloten,
gedeeld feature-ID-contract is. Daarna zijn de tests concreet en is duidelijk wat
de scope-guard wel en niet garandeert.
