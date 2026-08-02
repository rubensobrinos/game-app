# Review — GR0 scaffold en GR1 scoring

Reviewdatum: 2026-08-02

## Conclusie

De fasering, scopegrenzen en herleidbaarheid naar `GAME-RULES.md` zijn helder.
GR0 kan na twee kleine correcties worden gebruikt. GR1 heeft eerst een aanscherping
van het functiecontract en de tests nodig; anders kan een ongeldige grace-configuratie
of een te laat antwoord toch punten opleveren.

## Bevindingen

### 1. Hoog — de maximale grace van 250 ms wordt niet afgedwongen

`GR1-scoring.md` noemt de limiet, maar test 8 en 9 gebruiken alleen een geldige
`deadlineGraceMs = 250`. Geen test bepaalt wat bij `251`, een negatieve waarde,
`NaN` of een ontbrekende waarde moet gebeuren. Daardoor kan een implementatie
zonder 250 ms-cap alle twaalf beschreven scenario's doorstaan.

**Voorstel:** kies en documenteer één contract: ongeldige configuratie werpt een
`RangeError` (voorkeur, omdat dit configuratiefouten zichtbaar maakt), of de waarde
wordt expliciet naar `0..250` geclamped. Voeg ten minste tests toe voor `0`, `250`,
`251` en een negatieve waarde.

### 2. Hoog — acceptatie en scoring kunnen uit elkaar lopen

`isAnswerAcceptable()` bepaalt of een antwoord meetelt, terwijl `computeScore()`
zelf geen acceptatiestatus kent. Met `correct: true` levert een antwoord buiten de
grace nog steeds 100 basispunten op, tenzij iedere aanroeper vooraf correct filtert.
Dat is een kwetsbaar server-authoritative contract.

**Voorstel:** maak de koppeling expliciet en testbaar. Bijvoorbeeld één publieke
`scoreAnswer()` die eerst acceptatie bepaalt en voor een niet-geaccepteerd antwoord
`{ bonus: 0, points: 0 }` retourneert, met de twee pure helpers intern. Als de losse
functies bewust publiek blijven, leg dan als harde preconditie vast dat
`computeScore()` uitsluitend geaccepteerde antwoorden ontvangt en voeg een
integratietest van acceptatie + score toe.

Voor test 8 hoort bovendien het volledige verwachte resultaat te staan:
`bonus = 0`, `points = 100` voor een correct, geaccepteerd antwoord binnen grace.
Zo wordt de subtiele regel ondubbelzinnig: grace behoudt basispunten, maar geeft
nooit bonus.

### 3. Middel — test 10 bewijst niet dat grace gelijk is voor alle spelers

Een JavaScript-signatuur- of typetoets kan niet aantonen dat configuratie op
roomniveau wordt beheerd. Destructuring negeert bovendien onbekende velden, dus
een test op een `playerDeadlineGraceMs`-veld zegt weinig. Gelijkheid voor alle
spelers is primair een configuratie-/aanroepverantwoordelijkheid buiten deze helper.

**Voorstel:** vervang test 10 door een concrete grenswaardetest voor de 250 ms-cap.
Leg in GR1 vast dat `deadlineGraceMs` roomconfiguratie is; toets de gelijke toepassing
later waar roomconfiguratie aan antwoordverwerking wordt gekoppeld.

### 4. Middel — gedrag bij ongeldige tijdwaarden is niet gespecificeerd

Bij `endsAt <= startsAt` deelt de formule door nul of een negatieve duur. Bij een
niet-beantwoord antwoord ontbreekt `receivedAt`; zonder vroege return kan de helper
een `NaN`-bonus teruggeven, terwijl het returncontract een getal belooft. Ook is niet
vastgelegd wat vóór `startsAt` gebeurt (de formule clamped dit logisch naar bonus
100, maar een expliciete test voorkomt interpretatieverschil).

**Voorstel:** eis eindige getallen en `endsAt > startsAt`, met een gedocumenteerde
foutstrategie. Eis voor fout/niet-beantwoord altijd exact
`{ bonus: 0, points: 0 }`. Voeg grensgevallen toe voor ontbrekende `receivedAt`,
een timestamp vóór `startsAt`, en een duur van nul.

### 5. Middel — de GR0-verificatie met een lege map klopt niet

Op de lokaal aanwezige Node.js `v24.16.0` faalt `node --test <lege-map>`: Node
probeert de map als module te laden en meldt `MODULE_NOT_FOUND`. Een lege run met
exitcode 0 is hier dus geen geldig bewijs. Daarnaast wordt een lege map niet door
Git vastgelegd zonder `.gitkeep`.

**Voorstel:** laat GR0 alleen de bevestigde map met `.gitkeep` maken en beperk de
verificatie tot bestaan + geen dependencies. Verplaats de echte
`node --test server/rules/`-controle naar GR1, zodra `scoring.test.js` bestaat.

### 6. Laag — `willekeurige geldige combinaties` is niet reproduceerbaar genoeg

Test 11 schrijft willekeur voor zonder seed of vaste tabel. Dat kan flaky tests of
een niet-reproduceerbare fout opleveren.

**Voorstel:** gebruik een vaste tabel met representatieve grenswaarden, of een
deterministische generator met een vaste seed (zonder nieuwe dependency).

### 7. Laag — maak het resultaat van uitgeschakelde snelheidspunten exact

Tests 6 en 7 zeggen dat de bonus wordt genegeerd, maar niet welke `bonus` de
geretourneerde structuur bevat.

**Voorstel:** verwacht bij `speedBonusEnabled = false` altijd `bonus = 0`, zodat
logging en latere consumers geen berekende maar niet-toegepaste bonus zien.

## Wat al goed staat

- GR0 pauzeert terecht vóór een architectuurkeuze buiten `docs/`.
- Er worden geen dependencies toegevoegd en de bestands-/regelgrenzen zijn helder.
- `questionDuration = endsAt - startsAt` voorkomt twee conflicterende bronnen.
- De grace-window wordt conceptueel correct gescheiden van de bonus-window.
- De opbouw van `correctResponseTimeMsTotal` is terecht losgetrokken van GR2.
- De README in `docs/game-rules-plan/` verwijst kort naar alleen GR0 en GR1; GR2–GR7
  worden niet voortijdig uitgewerkt.

## Advies vóór uitvoering

Pas GR0-bevinding 5 aan. Werk voor GR1 minimaal bevindingen 1–4 uit en maak de
verwachtingen in 6–7 exact. Daarna zijn de prompts voldoende scherp om GR0 en GR1
zonder verborgen beleidskeuzes uit te voeren.
