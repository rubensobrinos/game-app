# Review — GR2 standings en GR3 validators

Reviewdatum: 2026-08-02

## Conclusie

Beide prompts hebben een goede modulegrens en zijn terecht als voorlopig gemarkeerd.
GR2 vertaalt de tiebreakvolgorde correct, en GR3 houdt contentberekening terecht buiten
de antwoordvalidatie. Voor uitvoering moeten vooral ranggelijkheid versus stabiele
volgorde, de status van competitierangschikking als productkeuze en het onderscheid
tussen ongeldige clientinput en ongeldige servercontext worden aangescherpt.

## GR2 — Standings

### 1. Hoog — competitierangschikking is een zichtbare productkeuze

`GAME-RULES.md` schrijft gedeelde positie voor, maar niet of de volgende positie
`1-1-3` (competition ranking) of `1-1-2` (dense ranking) wordt. De prompt noemt
`1-1-3` lokaal en zonder ADR beslisbaar. Het positienummer verschijnt echter in
snapshots en de UI en is daarmee zichtbaar productgedrag, niet alleen een intern
sorteerdetail.

**Voorstel:** behoud competition ranking als duidelijk voorstel, maar vereis
expliciete menselijke/productgoedkeuring vóór uitvoering. Een aparte ADR is mogelijk
niet nodig, maar goedkeuring van GR2 moet deze keuze expliciet noemen. Voeg zowel
`1-1-3` als het in de samenvatting genoemde `1-2-2-4` als tests toe, zodat de regel
op verschillende posities bewezen wordt.

### 2. Hoog — gedeelde positie geeft nog geen deterministische volgorde

`compareForRanking()` retourneert `0` bij volledige gelijkstand. De uiteindelijke
volgorde van zulke spelers volgt dan de invoervolgorde. Als die uit Redis of een
andere niet-canonieke bron komt, kunnen twee snapshots dezelfde gedeelde posities
maar een andere lijstvolgorde hebben. Dat wordt belangrijk bij podiumweergave en
later bij een top-5-grens.

**Voorstel:** scheid ranggelijkheid van presentatiesortering. Bepaal `position` alleen
op de drie spelregelvelden, maar gebruik daarna een stabiele, niet-rangbepalende
fallback zoals `id` voor reproduceerbare output. Documenteer nadrukkelijk dat die
fallback geen winnaar aanwijst en geen gedeelde positie opheft. Als zelfs de volgorde
van gedeelde spelers bewust onbepaald moet blijven, leg dat als contract vast en laat
de public-api-laag nooit willekeurig één van hen afkappen.

### 3. Hoog — alleen `Number.isFinite` laat onmogelijke standen toe

Negatieve scores, negatieve responstijden en negatieve of fractionele
`correctCount`-waarden zijn eindig en zouden dus worden geaccepteerd. Ook valideert
`rankPlayers()` geen ontbrekend/ongeldig of dubbel `id`. Daardoor kan upstream
datacorruptie alsnog een ogenschijnlijk geldige ranglijst opleveren.

**Voorstel:** eis voor alle drie de sorteervelden niet-negatieve getallen en voor
`correctCount` een integer. Beslis of score en responstijd gehele milliseconden moeten
zijn; de huidige modellen suggereren dat wel. Eis unieke, niet-lege string-ID's in
`rankPlayers()`. Voeg tests toe voor negatieve waarden, fracties en dubbele ID's.

### 4. Middel — comparatorvalidatie en lijstsvalidatie zijn vermengd

Een comparator die bij iedere vergelijking opnieuw alle velden valideert kan tijdens
`sort()` herhaaldelijk en pas halverwege falen. De input wordt vermoedelijk niet
gemuteerd door eerst te kopiëren, maar foutgedrag en kosten hangen dan af van het
sorteeralgoritme.

**Voorstel:** laat `rankPlayers()` de hele invoer één keer vóór sortering valideren.
Houd `compareForRanking()` desgewenst fail-loud voor los gebruik, maar test dat een
ongeldige lijst vóór enige outputvorming wordt afgewezen.

### 5. Middel — de GR1-afhankelijkheid is nog niet inhoudelijk gesloten

De huidige GR1-implementatie telt bij `correct: true` iedere `responseTimeMs` op zonder
te controleren of `currentTotalMs` en `responseTimeMs` eindige, niet-negatieve waarden
zijn. GR2 kan de uiteindelijke totalen wel afwijzen, maar dan ontstaat de fout pas bij
scoreboardopbouw in plaats van bij de bron.

**Voorstel:** laat de aangekondigde GR1-review eerst het accumulatiecontract sluiten.
GR2 mag daarna aannemen dat persisted totalen geldig zijn, terwijl het zelf defensief
blijft valideren.

### 6. Middel — `node --test server/rules/` blijft een onjuist verificatiecommando

Een directoryargument wordt lokaal niet als recursieve testdiscoveryroot behandeld.

**Voorstel:** gebruik expliciet
`node --test server/rules/scoring.test.js server/rules/standings.test.js`, of leg een
canoniek glob-/projectcommando vast zodra de repo daar een conventie voor heeft.

## GR3 — Validators

### 7. Hoog — clientfouten en serverfouten hebben nog hetzelfde impliciete pad

Een malformed `answer` is onbetrouwbare clientinput en hoort `{ valid: false,
correct: false }` te geven. Een malformed `correctAnswer`, ontbrekende
`validOptionIds` of ongeldige `optionCount` is daarentegen een server-/rondebouwfout
en moet luid falen. De prompt specificeert dit onderscheid niet. Bij `answer = null`
kan destructuring bovendien onbedoeld throwen in plaats van netjes afwijzen.

**Voorstel:** leg twee categorieën vast:

- client `answer`: iedere waarde toegestaan als invoer; malformed resulteert altijd
  deterministisch in `{ valid: false, correct: false }` zonder throw;
- vertrouwde servercontext (`correctAnswer`, `roundContext`): vooraf volledig
  valideren en bij inconsistentie een `TypeError`/`RangeError` werpen.

Voeg tests toe voor `null`, arrays, primitives en ontbrekende context.

### 8. Hoog — de vorm van `Round.correctAnswer` is nog geen volledig contract

`DATA-MODEL.md` toont alleen een voorbeeld met `{ choice: "fake" }`. De aanname dat
`correctAnswer` voor iedere spelvorm exact dezelfde vorm heeft als de client-
`answer` is logisch, maar niet voor alle vijf typen normatief vastgelegd. Door dit nu
te coderen ontstaat feitelijk een data-/protocolinterface vóór review door de
contracteigenaren.

**Voorstel:** markeer de vijf `correctAnswer`-vormen expliciet als interfacevoorstel
en laat de `DATA-MODEL.md`-/`PROTOCOL.md`-eigenaren ze bevestigen vóór GR3 wordt
uitgevoerd. Dat hoeft de validatorlogica niet te wijzigen, maar voorkomt dat tests
de voorbeeldvorm stilzwijgend tot schema verheffen.

### 9. Hoog — servercontext-invarianten ontbreken

Voor meerkeuze moet worden bewezen dat `validOptionIds` vier unieke, niet-lege
strings bevat en dat `correctAnswer.optionId` ertussen staat. Voor Buitenbeentje
moet `optionCount` in Golf 1 exact 4 zijn en moet de correcte index binnen bereik
liggen. Voor binair en hoger/lager moet ook het server-side correcte antwoord tot de
toegestane enum behoren. Zonder die checks kan een geldige clientpayload ten onrechte
altijd incorrect of zelfs structureel geldig worden verklaard bij een kapotte ronde.

**Voorstel:** valideer deze invarianten één keer als servercontext en werp bij een
schending. Voeg per mechanisme minstens één kapotte-contexttest toe.

### 10. Middel — "juiste velden" laat extra properties onbeslist

De prompt zegt dat `valid` ook de juiste velden toetst, maar specificeert niet of
`{ optionId: "opt_2", role: "host" }` geldig is. Hetzelfde geldt voor inherited
properties, arrays met toevallig een veld en objecten met getters. Voor een
protocolvalidator moet exact duidelijk zijn of onbekende velden worden genegeerd of
afgewezen.

**Voorstel:** kies samen met de protocollaag een strikt beleid. Mijn voorkeur voor
deze kleine answer-objecten is: plain object, exact één toegestane own property,
geen extra velden. Als envelopvalidatie onbekende velden al afwijst, mag deze module
bewust alleen het inhoudelijke veld bekijken—but documenteer die preconditie dan.

### 11. Middel — dispatcher-uitkomsten zijn nog niet volledig exact getest

Tests 6–24 noemen vaak alleen `correct: true`, `correct: false` of `valid: false`,
terwijl het contract altijd beide booleans retourneert. Een implementatie met
`valid: undefined` kan daardoor mogelijk aan te losse assertions ontsnappen.

**Voorstel:** verwacht in iedere rij exact het volledige object
`{ valid: boolean, correct: boolean }`. Test via de dispatcher per gameType zowel
een correct, incorrect als malformed antwoord, niet alleen dat er naar ongeveer het
juiste gedrag wordt gerouteerd.

### 12. Middel — publieke helpers en "alleen dispatcher gebruiken" botsen

De losse validators worden geëxporteerd, maar servercode zou uitsluitend
`validateAnswer()` mogen aanroepen. Een codecomment is geen afdwingbare modulegrens;
exports zijn in CommonJS voor iedere consumer gelijk publiek.

**Voorstel:** exporteer alleen `validateAnswer()` uit productiecode en test helpers
indirect met tabelgedreven dispatchertests. Als gerichte helperexports echt gewenst
zijn, behandel ze als ondersteund intern API-oppervlak en valideer hun volledige
contract.

### 13. Middel — ook GR3 gebruikt het onjuiste directorycommando

**Voorstel:** gebruik expliciete bestanden, bijvoorbeeld
`node --test server/rules/scoring.test.js server/rules/validators.test.js`, totdat
een projectbreed testcommando is vastgesteld.

### 14. Laag — kleine redactionele punten

- Corrigeer `metrie-vergelijking` naar `metriekvergelijking`.
- `flags_mc` en `capitals_mc` delen hetzelfde antwoordmechanisme volgens
  `PROTOCOL.md`; `GAME-RULES.md` beschrijft de antwoordpayload zelf niet exact.
- "Golf 2 na juridische vrijgave" geldt specifiek voor logo-/clubcontent. Typen-
  invoer is Golf 2, maar heeft niet dezelfde juridische vrijgavevoorwaarde.
- Een onbekende `gameType` is niet noodzakelijk alleen een fout in GR4; het kan ook
  versie-/feature-gated drift tussen dispatcher en roomconfig zijn.

## Wat al goed staat

- Beide prompts zijn duidelijk als voorlopig gemarkeerd en blokkeren uitvoering tot
  na GR1-review.
- GR2 volgt de drie tiebreakvelden exact in de voorgeschreven volgorde.
- Niet-muteren en minimale Player-input zijn goede grenzen.
- Top-5-redactie en live-foutafhandeling blijven terecht open voor hun eigenaren.
- GR3 deelt validators per mechanisme in plaats van duplicatie per spelnaam.
- Hoger-of-Lager-metriekberekening hoort terecht bij rondeconstructie, niet bij de
  validatie van een ontvangen `side`.
- De validators raadplegen geen contentdata, opslag, transport of klok.
- Onbekende speltypen worden niet stilzwijgend als incorrect antwoord behandeld.

## Advies vóór uitvoering

Laat eerst de GR1-review het accumulatiecontract afronden. Bevestig vervolgens de
competition-rankingkeuze en de vijf server-side `correctAnswer`-vormen. Splits in GR2
rang-equivalentie van deterministische presentatiesortering. Maak in GR3 malformed
clientinput altijd een normaal invalid-resultaat en kapotte servercontext altijd een
throw, met volledige-objectasserties in alle tests. Daarna zijn beide prompts scherp
genoeg voor uitvoering.
