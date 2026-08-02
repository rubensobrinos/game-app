# Review — DT3b tot en met DT7

## Oordeel

De vijf documentatieleveringen zijn nuttig en grotendeels zorgvuldig afgebakend,
maar de samenvatting overschat de uitvoerbaarheid. **DT7 is nog niet klaar voor
activatie**, DT-PROGRESS is niet bijgewerkt en meerdere fasen wachten op meer dan
alleen een generiek `deps/prod`-akkoord.

Noem de huidige opbrengst daarom: *vijf voorbereidingsartefacten geschreven* — niet
“vijf uitvoerbare delen gebouwd en geverifieerd”. Er is nog geen nieuwe E2E-, load-,
chaos-, integratie- of CI-test daadwerkelijk uitgevoerd.

## Bevindingen

### 1. Blocker — DT7 slaat vrijwel alle ESM-tests over

De voorgestelde unitjob zoekt uitsluitend naar:

```bash
files=(${{ matrix.module }}/*.test.js)
```

Daardoor worden de bestaande `.test.mjs`-suites in `server/protocol/` en
`client/flow/` als “leeg” overgeslagen. `shared/product/` ontbreekt bovendien geheel
uit de matrix. Juist die drie bomen vertegenwoordigen een groot deel van de huidige
tests.

Laat de workflow zowel `*.test.js` als `*.test.mjs` verzamelen en voeg
`shared/product` toe. Test de exacte shellsnippet lokaal tegen alle matrixpaden en
vergelijk het gevonden aantal bestanden met de repository.

### 2. Blocker — een tweede workflow repareert de bestaande kapotte CI niet

De bestaande, managed `ci.yml` draait nog steeds `npm ci`, ESLint en Jest, terwijl
de repository geen `package.json` heeft. Een nieuwe `tests-node.yml` kan groen zijn,
maar de oorspronkelijke workflow blijft op dezelfde pushes en pull requests falen.
Daarmee is de “CI-kloof” niet opgelost.

Het voorstel moet een migratiepad bevatten: óf het Devkit-profiel/managed CI wordt
gecorrigeerd of vervangen, óf de ongeldige jobs worden bewust uitgefaseerd. Alleen
een parallelle workflow toevoegen is onvoldoende. Dit vereist inderdaad expliciet
architecture/deps-goedkeuring.

### 3. Hoog — DT-PROGRESS weerspiegelt de nieuwe stand niet

`DT-PROGRESS.md` zegt nog dat DT4a/DT4b, DT5, DT6 en DT7 niet zijn gestart en dat
DT3b–DT7 allemaal nog geen uitvoering kennen. Dat botst rechtstreeks met de gemelde
oplevering en maakt het centrale voortgangsoverzicht onbetrouwbaar.

Werk de statussen bij met een onderscheid tussen:

- voorbereidingsdocument klaar;
- uitvoerbare testcode klaar;
- daadwerkelijk uitgevoerd en geslaagd;
- geblokkeerd op implementatie, dependency, omgeving of autorisatie.

### 4. Hoog — “de rest wacht alleen op deps/prod-akkoord” is onjuist

De resterende voorwaarden zijn verschillend:

- **DT4a:** Playwright-akkoord én een daadwerkelijk bestuurbare UI/testharness;
- **DT4b:** echte toestellen, een draaiende app/server en handmatige uitvoering —
  geen Playwright-dependency;
- **DT5:** loadtooling, draaiende server, observability, geschikte omgeving,
  providercheck en apart uitvoeringsakkoord;
- **DT6:** een bestaande Compose-stack en scenario-voor-scenario autorisatie;
- **DT7:** architecture/CI-activatie en een oplossing voor de bestaande managed CI;
- **DT3b:** echte serverintegratiepunten.

Er is dus niet één resterend akkoord dat alles ontgrendelt.

### 5. Hoog — DT4b is een complete matrix, geen voltooide testfase

Alle tien rijen hebben lege velden voor “laatst uitgevoerd” en “uitkomst”. Dat is
correct voor een nieuw runbook, maar betekent dat geen enkel devicecriterium bewezen
is. Formuleer de status als **runbook klaar, 0/10 uitgevoerd**, niet “volledig klaar”
zonder kwalificatie.

### 6. Hoog — DT4a-pseudocode veronderstelt nog niet bestaande product-UI

De scenario's zijn bruikbaar als toekomstige acceptatiespecificatie, maar vragen
onder meer een volledige host/player-kernflow, timer, scoreboard, podium,
hostbedieningsbalk en navigatie. Die geïntegreerde UI bestaat nog niet. Een
Playwright-installatie alleen maakt de scenario's daarom nog niet uitvoerbaar.

Voeg per scenario een implementatieprerequisite toe, vergelijkbaar met de
activatiecriteria in DT3a.

### 7. Middel — DT3b combineert `test.skip` met een tegenstrijdige Definition of Done

De prompt zegt dat code pas wordt geschreven als het activatiecriterium al gehaald
is, maar vraagt dan eerst `test.skip(...)`; de Definition of Done verlangt vervolgens
een niet-skippende test. Als de echte implementatie al bestaat, is er weinig reden
om de nieuwe test eerst geskipt te landen.

Kies één model:

- vóór implementatie: pending spec met eigenaar/vervaldatum;
- ná activatiecriterium: direct een actieve integratietest.

De huidige tussenvorm voegt administratie toe zonder extra bewijs.

### 8. Middel — loadmatrix is bewijsroutering, nog geen loadtestresultaat

De verdeling van criteria over k6, integratie, observability, E2E en handmatige
controle is inhoudelijk sterk. Maar geen van de tien criteria heeft nu meetdata of een
uitslag. Rapporteer dit als **10/10 criteria toegewezen aan een bewijsmethode, 0/10
uitgevoerd**, niet als een geverifieerde loadfase.

### 9. Middel — chaosrunbook vereist eerst validatie tegen de echte stack

De zes scenario's zijn helder en de gefaseerde autorisatie is goed. Container-namen,
healthchecks, AOF-instellingen, herstelvensters en observatiepunten zijn voorlopig
echter documentaannames zolang de Compose-stack niet bestaat. Voeg vóór uitvoering
een read-only preflight toe die elk commando en elke verwachte service tegen de
uiteindelijke stack valideert.

## Wat goed staat

- DT3b weigert terecht fictieve integratietests te schrijven zonder echte server.
- DT4a scheidt browseremulatie eerlijk van echte devicechecks.
- DT4b dekt precies de handmatige aspecten die Playwright niet betrouwbaar bewijst.
- DT5 voorkomt terecht dat k6 als universeel bewijs voor visuele/statecriteria wordt
  gebruikt.
- DT6 houdt schrijven, opstarten/resetten en destructieve uitvoering gescheiden.
- DT7 raakt het managed CI-bestand niet zonder goedkeuring.

## Aanbevolen vervolg

1. Corrigeer DT7 voor `.js` én `.mjs`, `shared/product` en de bestaande falende CI.
2. Werk `DT-PROGRESS.md` bij met bewijsniveaus in plaats van alleen “klaar”.
3. Voeg prerequisites toe aan elk DT4a-scenario en een stack-preflight aan DT6.
4. Vereenvoudig DT3b naar pending-vóór-implementatie of actief-na-implementatie.
5. Vraag dependency-/uitvoeringsakkoorden pas wanneer de bijbehorende runtime ook
   werkelijk bestaat; Playwright of k6 nu installeren levert nog geen uitvoerbare
   end-to-endtest op.
