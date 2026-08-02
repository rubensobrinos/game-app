# Review — DM2a tot en met DM9

## Oordeel

De prompts zijn veel concreter geworden en DM9 is correct op de echte consument
`rankPlayers()` gericht. **De keten is echter nog niet uitvoerbaar.** DM6–DM8 bevatten
vier blockers rond lookup, idempotentie, informatiel ek en analyticsafleiding;
DM2–DM5 hebben daarnaast enkele contract- en eigenaarschapsproblemen.

## Bevindingen

### 1. Blocker — DM7 controleert idempotentie te laat

De voorgestelde volgorde controleert deadline en actieve ronde vóór de action-cache.
Een eerder geaccepteerde actie die met hetzelfde `actionId` na de deadline of na een
faseovergang opnieuw wordt verzonden, moet volgens `PROTOCOL.md` dezelfde logische
ack terugkrijgen. DM7 zou nu `DEADLINE_PASSED` of `ROUND_NOT_ACTIVE` retourneren.

Controleer na authenticatie/roombinding eerst de action-cache. Een cachehit moet vóór
ronde-, deadline- en existing-answerchecks terugkeren. Voeg expliciete tests toe voor
een replay ná deadline en ná faseovergang.

### 2. Blocker — de ack lekt de scorebeslissing vóór ronde-einde

DM7 bouwt:

```js
payload: { roundId: round.id, correct, points }
```

`PROTOCOL.md` basisregel 4 verbiedt dat een correct antwoord **of scorebeslissing** de
server verlaat vóór de ronde is afgelopen. `correct` en `points` verraden precies
die beslissing. De bestaande servereventtabel noemt voor
`round:answer-accepted` alleen `roundId`.

Beperk de vroege ack tot acceptatiegegevens, bijvoorbeeld `{ roundId }`. Correctheid
en punten horen pas in `round:ended`.

### 3. Blocker — een semantisch ongeldig antwoord wordt als fout antwoord opgeslagen

`validateAnswer()` onderscheidt `{ valid: false, correct: false }` van een geldig maar
onjuist antwoord. DM7 verwerkt `valid: false` desondanks als een geaccepteerd antwoord
met nul punten. Een onbekende optionId of ongeldige cardIndex wordt dan permanent als
Answer opgeslagen en verhindert een volgende geldige poging via
`ALREADY_ANSWERED`.

Retourneer bij `valid === false` `INVALID_ANSWER_FORMAT` zonder writes. Een algemene
schema-gate vóór DM7 vervangt deze check niet: GR3 valideert ook inhoudelijke waarden
zoals lidmaatschap van `validOptionIds`.

### 4. Blocker — DM6 kan `loadRoomByInviteHash` niet implementeren

`saveRoom(room)` ontvangt een Room met `inviteId`, geen `inviteHash`. Toch moet de
fake daarna `loadRoomByInviteHash(inviteHash)` ondersteunen. Zonder hashfunctie of
expliciete mapping kan `saveRoom` die index niet opbouwen; het hashalgoritme is juist
nog een open auth/databasebesluit.

Maak de mapping een expliciete domeinoperatie, bijvoorbeeld
`saveRoomInviteLookup(inviteHash, roomId)`, of geef de hash als apart, reeds berekend
argument bij roomcreatie. Laat de data-adapter hem niet zelf verzinnen.

### 5. Hoog — DM6 en DM7 spreken elkaar tegen over de atomaire operatie

DM6 definieert `saveAcceptedAnswerAtomically` voor Answer, Player en scoreboard
(stappen 7–9). DM7 voegt daar later “klein” de action-cache/ack aan toe, terwijl stap
10 volgens de fundamentele docs in dezelfde alles-of-niets-mutatie hoort. Dit is geen
optionele uitbreiding maar onderdeel van het kerncontract.

Definieer de volledige operatie al in DM6. Maak ook duidelijk of de parameter een
delta of nieuwe absolute stats bevat; hij heet nu `playerScoreDelta`, terwijl DM7
absolute eindwaarden retourneert.

### 6. Hoog — DM7 verwacht een niet-bestaande vraagpayloadvorm

DM7 leidt `validOptionIds` af uit
`round.publicQuestionPayload.options[].optionId`. De herziene GR4-prompt levert voor
flags/capitals juist `optionIso2s` en daarnaast een losse `validOptionIds` in
`SelectedQuestion`. DM3's Round bewaart die losse lijst niet.

Reconcileer dit vóór uitvoering: leg één Round-/payloadvorm vast en test GR4-output
rechtstreeks door DM3 en DM7 naar `validateAnswer()`.

### 7. Hoog — de vermeende vijf gesloten enums zijn niet werkelijk gesloten

DM2a noemt `gameTypes` een gesloten Golf-1-enum, maar verlangt tegelijk dat iedere
onbekende niet-lege toekomstige string wordt geaccepteerd. Dat is een open string,
geen gesloten enum, en botst met `DATA-MODEL.md`: “vrije strings zijn niet
toegestaan”. Kies expliciet één model: Golf-1-only gesloten enum nu, of een
versiegebonden feature-gat dat eerst moet worden opgelost.

Daarnaast exporteert `state-machine.js` momenteel `PACING` niet. De waarden zijn er
wel intern, maar DM2a kan ze niet als gedeeld contract importeren zoals de tekst
suggereert.

### 8. Hoog — `tokenHash` met verplichte `sha256:`-prefix legt een open authkeuze vast

De prefix staat in één voorbeeld, terwijl README/checkpoint 10 het hashmechanisme
expliciet als ADR-plichtig open laat. Een runtimevalidator die alleen `sha256:`
accepteert maakt die voorbeeldwaarde feitelijk bindend.

Valideer voorlopig alleen een niet-lege opaque string, of blokkeer de specifieke
prefixcheck tot de auth-ADR. Een voorbeeld is hier onvoldoende als normatieve enum.

### 9. Hoog — een bewust onvolledige Room mag niet `Room` heten

`DATA-MODEL.md` bevat `contentVersion` en `rendererVersion` als Room-velden. DM2b
laat ze uit typedef en validator weg, maar noemt het resultaat toch `Room` en laat
objecten mét die velden ongemerkt door. Daardoor bewijst `assertRoomShape` niet dat
een echte Room compleet is.

Blokkeer de definitieve Room tot checkpoint 4, of noem de tijdelijke vorm expliciet
`RoomCore`/`UnversionedRoomDraft`. Een shape-check van het canonieke type hoort alle
canonieke velden te controleren.

### 10. Hoog — directe afhankelijkheid data → architecture is de verkeerde gedeelde bron

Eén faselijst is goed; `server/data` laten importeren uit de volledige
state-machine-implementatie maakt de datalaag echter afhankelijk van een hogere
gedragslaag en vergroot de kans op cirkels zodra architecture repositories gaat
gebruiken. Hetzelfde geldt conceptueel voor pacing.

Verplaats gedeelde enums naar een neutrale contractmodule of laat zowel data als
architecture uit één gedeeld bestand importeren. “Geen externe dependency” betekent
niet automatisch dat iedere interne dependencyrichting gezond is.

### 11. Hoog — DM8 implementeert onbevestigde analyticsdefaults

DM8 noemt zes vragen open, maar wil hun voorgestelde defaults toch in
`aggregate.js` bouwen en testen, waaronder native share als link tellen. Dat maakt
een voorstel feitelijk runtimegedrag vóór product/data-review. Dit botst met de
`design`/`database_schema`-grens.

Laat DM8 eerst uitsluitend het voorstel en de traceabilitymatrix produceren. Bouw
aggregatiecode pas voor bevestigde regels; voorgestelde defaults horen niet als
groene runtimeasserties te landen.

### 12. Hoog — DM8 kan zijn eigen `game_sessions`-rij niet volledig afleiden

De events leveren geen bevestigde bron voor onder meer `id`, de hashing van
`room_id_hash` en een echte piekmeting voor `max_player_count`. Alleen join-events
tellen is niet genoeg wanneer spelers vertrekken en later anderen joinen. De
voorgestelde functie kan dus niet alle niet-nullkolommen eerlijk vullen.

Markeer deze velden als geblokkeerd op ID/hash- en player-count-contracten, of voeg
bevestigde bron-events toe voordat `buildGameSessionRow` wordt gebouwd.

### 13. Middel — DM5 telt de kolommen verkeerd

De comment noemt 20 kolommen voor `game_sessions`; de opgesomde tabel heeft er 21.
Dit soort handmatige duplicatie is precies waar een allowlist ongemerkt een geldig
veld kan verliezen. Voeg een test met de exacte verwachte kolomnamen en aantallen toe
of genereer de constanten uit één lokaal bronregister.

### 14. Middel — DM4 introduceert productcontent zonder review

Placeholder-profanitylijsten en 8–10 adjectieven/dieren per taal zijn redactionele
productcontent. “Eenvoudig en onschuldig” maakt dat geen zelfstandig technisch
besluit. Injecteer woordenlijsten/profanitycheck in de pure mechaniek of vraag een
contentreview voordat lijsten als runtimecontent landen.

### 15. Middel — `toActiveRoundSnapshot` controleert niet dat de ronde actief is

De functie heet expliciet “Active”, maar `Round.status` is een vrije niet-lege string
en de projectie accepteert iedere status. Eis `status === 'ACTIVE'` voor deze
projectie, of hernoem haar naar een generieke publieke projectie en laat de aanroeper
de fasevoorwaarde bewaken.

## Wat goed staat

- DM9 projecteert nu exact de vier velden die `rankPlayers()` werkelijk consumeert.
- GR5/GR6-projecties worden terecht niet vooruit ontworpen.
- DM7 probeert scoring en validatie te hergebruiken in plaats van na te bouwen.
- DM5 kiest terecht allowlisting boven een fragiele privacydenylist.
- DM6 houdt Redis-primitieven uit de domeinpoort en overschat de in-memory fake niet.
- De actieve-rondeprojectie gebruikt een expliciete outputallowlist.

## Aanbevolen volgorde

1. Herstel DM2a/DM2b: enums, tokenHash, Room-volledigheid en neutrale gedeelde
   constants.
2. Reconcileer GR4 → Round → DM7 → GR3 als één contracttestketen.
3. Definieer DM6's volledige atomische operatie en invite-hashmapping.
4. Herorden DM7, verwijder vroege scorelekken en wijs `valid:false` af.
5. Beperk DM8 tot een voorstel totdat de open analyticsbesluiten bevestigd zijn.
6. Voer daarna pas DM2–DM9 uit; DM9 zelf kan inhoudelijk vrijwel ongewijzigd blijven.
