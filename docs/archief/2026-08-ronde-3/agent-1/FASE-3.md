# Agent 1 — fase 3: de room mag niet doodgaan tijdens het spelen

**Dit blokkeert de pilot.** Lees ook `../FEEDBACK-ronde-3.md` (F1 en F2): de
producteigenaar verloor een room en kreeg "Deze game bestaat niet (meer)".

## Wat er aan de hand is

De room-TTL is vier uur (`ROOM_TTL_SECONDS = 14400`). `touchRoom()` verlengt
hem, en dat gebeurt netjes bij lobby-acties: joinen, vergrendelen, hernoemen,
verkleuren, kicken, instellingen wijzigen, en sinds jouw fase 2 ook bij
vertrekken.

**Maar tijdens het spelen gebeurt het nooit.** In `match-lifecycle.mjs` staat
geen enkele `touchRoom`. Een ronde starten, antwoorden, een ronde afsluiten,
pauzeren, hervatten, een rematch — geen daarvan verlengt iets.

Gevolg: een room gaat exact vier uur na het **aanmaken** dood, hoe druk er ook
gespeeld wordt. Een avond die om 20:00 begint, is om 24:00 weg — midden in een
potje, zonder waarschuwing.

`ttl.js` zegt hier zelf al iets over: de "refreshmatrix" staat bovenaan als
bewust openstaand punt. Dit is het moment om hem in te vullen.

## Wat je bouwt

**1. Verlengen tijdens het spelen.** Bepaal welke momenten activiteit zijn en
verleng daar. Denk in ieder geval aan: ronde starten, ronde afsluiten,
fase-overgangen, pauzeren/hervatten, rematch. Een antwoord van een speler is
óók activiteit, maar let op dat je niet bij elk antwoord van elke speler een
schrijfactie doet — dat is honderd keer per ronde. Kies iets verdedigbaars en
schrijf op waarom.

**2. Een eerlijke foutmelding.** Nu zijn "de room bestaat niet", "de room is
verlopen" en "je verbinding is weg" alle drie `GAME_NOT_FOUND` → *"Deze game
bestaat niet (meer)"*. Een host die zijn verbinding kwijtraakt, leest dus dat
zijn game vernietigd is. Zorg dat een verlopen of onbereikbare room te
onderscheiden is van een code die nooit bestond, en dat de client iets toont
waar je iets mee kunt.

**3. Logging.** De server logde in een hele container **één** regel. Daardoor
was de melding van de producteigenaar niet na te trekken. Log op `info` in elk
geval: room aangemaakt, speler joint, room verlopen, en elke geweigerde
hostactie — zonder tokens of persoonsgegevens (`safe-logger.mjs` bestaat al).

## Waar je vanaf blijft

`autoReveal` en het onthullen. Dat is jouw fase 4 en staat in `FASE-4.md`.

## Hoe je oplevert

Een test die faalt zónder je fix. Voor de TTL kun je de klok in de tests
vooruitzetten: room aanmaken, drieënhalf uur spelen, en aantonen dat de room er
daarna nog is. Zonder zo'n test is dit niet aantoonbaar gerepareerd.
