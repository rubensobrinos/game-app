# Review — GR4 vraagselectie en rematch-exclusie

## Oordeel

**Nog niet uitvoeren.** Het dataonderzoek en de dependency-injectie zijn sterk, maar
de prompt bevat twee blockers en enkele ontwerpkeuzes die niet rechtstreeks uit de
brondocumenten volgen. Die moeten eerst expliciet worden gemaakt.

## Bevindingen

### 1. Blocker — Echt-of-Nep mist verplichte renderdata

GR4 stelt dat alleen `real/generated` plus een seed wordt gekozen en dat
renderparameters buiten scope blijven. `GAME-RULES.md` zegt juist expliciet dat een
gegenereerde ronde een seed, **genormaliseerde renderparameters** en
`rendererVersion` bevat, zodat alle clients dezelfde specificatie renderen.

De bestaande singleplayerfunctie `generateFakeParams()` gebruikt bovendien zelf
`Math.random()` en is niet seed-deterministisch. Alleen een seed produceren maakt de
multiplayerregel dus nog niet waar. Er moet vóór GR4 één van deze grenzen vastliggen:

- GR4 krijgt een geïnjecteerde, versiegebonden `generateFlagSpec(seed, difficulty)`
  en neemt parameters plus `rendererVersion` op in de ronde;
- of een benoemde content-/renderadapter verrijkt GR4-output vóór Round wordt
  opgeslagen, met een expliciet contract en eigenaar.

Dit hoort ook in `HANDOFF.md`; “bestaande singleplayer-logica hergebruiken” is zonder
extractie en determinisme nog geen opgeloste afhankelijkheid.

### 2. Blocker — het publieke resultaatcontract is niet gedefinieerd

`buildMatchQuestionPlan()` retourneert `{ gameType, questionKey, spec: object }`, maar
de vorm van `spec` ontbreekt volledig. Daardoor is niet toetsbaar of de selector de
velden levert die de rest nodig heeft:

- `Round.publicQuestionPayload` en `Round.correctAnswer`;
- vier stabiele option IDs en hun vaste volgorde voor vlaggen/hoofdsteden;
- `validOptionIds` voor GR3;
- beide metriekwaarden en de correcte `side` voor Hoger/Lager;
- kaartvolgorde, `cardIndex` en beide continenten voor Buitenbeentje;
- seed, renderparameters en rendererVersion voor Echt-of-Nep.

De voorgestelde `ContentEntry` bevat voor Hoofdsteden alleen `hasCapital`, niet de
hoofdstad of gelokaliseerde weergavegegevens. De prompt kan dus uit zijn eigen input
geen complete vraag bouwen. Definieer per spelvorm een discriminated outputvorm en
maak duidelijk wat GR4 produceert versus wat een contentadapter later verrijkt.

### 3. Hoog — 50/50 per match is niet hetzelfde als per ronde opgooien

`GAME-RULES.md` zegt “per match ongeveer 50/50”. Een onafhankelijke
`random() < 0.5` per ronde kan bij kleine matches gemakkelijk alle rondes echt of
allemaal gegenereerd maken. Bouw eerst een matchverdeling met aantallen die hooguit
één verschillen en randomiseer eventueel daarna de posities met de geïnjecteerde
randombron. Voeg tests toe voor even en oneven aantallen.

### 4. Hoog — de Hoger/Lager-sleutel mist de metriek

`higher_lower:de-fr` behandelt hetzelfde landenpaar op inwoners en BBP als dezelfde
vraag, terwijl prompt en scherminhoud wezenlijk verschillen. Neem de metriek op,
bijvoorbeeld `higher_lower:gdp:de-fr`, tenzij DATA-MODEL/GR7 bewust een andere
identiteitsregel bevestigt. Test ook dat hetzelfde paar bij twee metriekwaarden twee
verschillende keys krijgt.

### 5. Hoog — de rematch-capaciteitsregel werkt niet uniform voor alle spelvormen

“Resterende pool kleiner dan het benodigde aantal rondes” werkt voor spelvormen waar
één doelland één sleutel oplevert. Hoger/Lager gebruikt geldige paren, Buitenbeentje
geldige vierlingcombinaties en gegenereerde vlaggen seeds. Hun capaciteit is niet
gelijk aan `pool.length`.

Definieer fallback op basis van het aantal **constructeerbare unieke questionKeys**
per spelvorm, of laat een begrensde planner eerst met uitsluiting proberen en daarna
alleen voor die spelvorm opnieuw plannen zonder vorige-matchkeys. Vermijd onbeperkt
retryen met random sampling; een vaste mockrandom of dunne pool mag nooit een
oneindige lus veroorzaken.

### 6. Hoog — round-robin in opgegeven volgorde is een nieuwe presentatiekeuze

De bron eist alleen een zo gelijkmatig mogelijke verdeling. Zij bepaalt niet dat
spelvormen strikt afwisselen of dat de door de host aangeleverde lijst ook de
presentatievolgorde is. Round-robin is een goed voorstel, maar volgens de huidige
policy een designkeuze, geen automatisch gevolg. Markeer dit als voorgestelde default
of laat de product/flow-eigenaar het bevestigen.

### 7. Middel — validatie en determinisme zijn onvoldoende afgedekt

Voeg tests en expliciete fouten toe voor ten minste:

- lege of dubbele `gameTypes`, onbekende types en `totalRounds <= 0`;
- onbekende difficulty/metricMode;
- duplicate/ongeldige `iso2` en incomplete contententries;
- `random()` dat `1`, een negatief getal, `NaN` of `Infinity` retourneert;
- inputarrays en entries die na de aanroep ongewijzigd blijven;
- identieke input plus identieke randomreeks die exact hetzelfde volledige plan en
  dezelfde optievolgorde geeft.

### 8. Middel — afleiderfallback kan nog steeds geen vier opties garanderen

De zachte continentfallback is een redelijke uitwerking van “waar mogelijk”. Leg wel
expliciet vast dat na de globale fallback nog steeds drie unieke afleiders op dezelfde
moeilijkheid nodig zijn en anders een `RangeError` volgt. Test dat afzonderlijk voor
Vlaggen én Hoofdsteden.

## Wat al goed staat

- Geen intern `Math.random()` en een geïnjecteerde randombron is de juiste basis voor
  reproduceerbare selectie.
- De echte vier difficultywaarden en GDP-gelijkstanden zijn correct uit de huidige
  content afgeleid.
- De contentdata niet rechtstreeks vanuit `server/rules` laden houdt de module puur.
- Per-spelvorm terugvallen minimaliseert onnodige herhaling beter dan één globale
  fallback; behoud dit als expliciet beschreven planningsbeleid.
- “Geen dubbele vraag binnen de huidige match” blijft terecht een harde regel.

## Aanbevolen volgorde

1. Definieer de volledige outputvormen en de grens met de gedeelde contentadapter.
2. Regel de deterministische Echt-of-Nep-renderer en `rendererVersion` in de handoff.
3. Bevestig round-robin als presentatiebeleid.
4. Herwerk 50/50, questionKeys en rematch-capaciteit.
5. Breid de testtabel uit en voer GR4 daarna pas uit.
