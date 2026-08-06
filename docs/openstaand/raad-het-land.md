# Bouwplan — "Raad het land" (de vierde game)

**Besluit C-2**, producteigenaar 5 aug 2026: de vier games uit doelbeeld v2.
Drie staan; deze resteert. **Eigenaar van dit plan:** regie. **Peildatum:**
5 aug 2026.

Je ziet de contour van een land en kiest uit vier namen. Het is de enige game
die niet op bestaande motoronderdelen meelift — de andere drie zijn varianten
op vlaggen.

---

## De koppeling is gemeten, niet geschat

`PLAN-CONVERGENTIE` noemde de naam→iso2-koppeling de eerste échte taak: de
contourdata (`data/geo-countries.js`, 257 landen) is gesleuteld op **Engelse
naam**, de pool (`shared/content/countries.data.mjs`, 230 landen) op **iso2**.

Die koppeling is nu gedraaid. Genormaliseerd matchen op de Engelse naam plus de
Engelse aliassen uit de pool:

| | Aantal |
| --- | --- |
| Automatisch gematcht | **220 van 230** |
| Na vijf handmatige aliassen | **225 van 230** |
| Contouren zonder tegenhanger in de pool | 37 |

De vijf handmatige aliassen zijn allemaal een formele staatsnaam of een
S.A.R.-notatie: *Republic of Serbia* → `rs`, *United Republic of Tanzania* →
`tz`, *Republic of the Congo* → `cg`, *Hong Kong S.A.R.* → `hk`, *Macao S.A.R*
→ `mo`.

**Wat er daarna nog mist, mist terecht:** Réunion, Mayotte, Martinique,
Guadeloupe en Frans-Guyana. Allemaal Franse overzeese gebieden zonder eigen
contour in de brondata, en allemaal `extreme` in de pool. Geen speler mist ze.

De 37 contouren zonder pool-tegenhanger zijn gebiedsdelen en betwiste
gebieden — *Bir Tawil*, *Spratly Islands*, *Siachen Glacier*, *US Naval Base
Guantanamo Bay*. Die horen niet in een quiz en vallen bewust af. **Ze vallen
niet stilzwijgend af: de migratie schrijft de lijst weg**, zodat de keuze
zichtbaar blijft.

Daarmee is stap 1 uit PLAN-CONVERGENTIE geen risico meer, maar routinewerk.

## Gewicht — hier zit de echte beslissing

De paden zijn samen 229 KB rauw, 80 KB gzip. Dat is geen ramp, maar het is wel
**tien keer de rest van de contentpool** en het moet nooit meeliften met een
potje "Raad de vlag".

| Selectie | Rauw | Gzip |
| --- | --- | --- |
| Alle 225 | 229 KB | 80 KB |
| Alleen easy + medium (96 landen) | 108 KB | 38 KB |

Twee regels die niet mogen sneuvelen:

1. **De server heeft de paden niet nodig.** Die kiest een land en drie
   afleiders; de tekening gebeurt in de client. De contouren horen dus níét in
   `shared/content/index.mjs`, want dat bestand laadt de server ook.
2. **De client laadt ze alleen als de game gekozen is** — dynamische import,
   niet in de hoofdbundel.

Met die twee is 80 KB acceptabel en hoeft er niets gesplitst te worden. Kiest
iemand later toch voor een lichtere start: easy+medium halveert het.

## Wat er al staat (6 aug 2026)

Stap 1 t/m 3 zijn gebouwd en gecommit:

| Wat | Waar |
| --- | --- |
| Contourdata, 225 landen gekoppeld op iso2 | `shared/content/shapes.data.mjs` (234 KB) |
| Alleen de landcodes, voor de server | `shared/content/shapes-index.mjs` (2 KB) |
| Generator die de koppeling reproduceert | `shared/content/build-shapes.mjs` |
| GameType `country_shape_mc` in protocol en validatie | `server/data/types/round.js` |
| Vraagselectie: target + drie afleiders | `server/rules/question-selection.js` |

Daarom staat "Raad het land" in de lobby als BINNENKORT: je kunt hem zien maar
niet kiezen. Dat is expres — de contentbron weigert hem, dus een host kan de
room er niet op laten vastlopen.

## Wat er nog moet gebeuren

| # | Wat | Waar | Maat |
| --- | --- | --- | --- |
| 1 | De contourvraag bouwen: welk land wordt het, welke drie afleiders komen erbij | `server/composition/content-source.mjs` | S |
| 2 | De tekenaar: de contour op het scherm zetten, dynamisch geladen | `frontend/js/views/shape-renderer.mjs` (nieuw) | L |
| 3 | Spelscherm: een rendertak voor de contour naast die voor de vlag | `frontend/js/views/gameplay.mjs` | S |
| 4 | Uitslagscherm: het goede antwoord mét contour | `frontend/js/views/scoreboard.mjs`, `round-model.mjs` | S |
| 5 | Mock: dezelfde vraag nabouwen, anders is hij solo niet te spelen | `frontend/js/mock/questions.mjs` | S |
| 6 | Verticale ketentest, daarna pas in `PLAYABLE_GAME_TYPES` | `shared/content/game-catalog.mjs` | S |

**Alleen stap 2 is echt nieuw werk.** De rest volgt het pad dat `odd_one_out`,
`capitals_mc` en `higher_lower` al hebben uitgesleten.

### Twee dingen die de tekenaar bijzonder maken

**Het gewicht.** De contouren zijn 234 KB rauw, 85 KB gzip — tien keer de rest
van de contentpool. Die mogen nooit meeliften met een gewoon potje "Raad de
vlag". Dus: dynamisch importeren, alleen als deze game gekozen is.

**De server hoeft de tekening helemaal niet.** Die kiest een land en drie
afleiders; het tekenen gebeurt op de telefoon van de speler. Daarom ligt er
naast `shapes.data.mjs` een `shapes-index.mjs` van twee kilobyte met alleen de
landcodes — dat is wat de server nodig heeft, en de paden blijven uit zijn
geheugen.

**Het model om naar te bouwen** is `frontend/js/views/flag-renderer.mjs`: 180
regels, en hij doet voor vlaggen precies wat de contourtekenaar voor vormen
moet doen. Lees hem eerst.

### Wat dit oplevert naast de game zelf

Zodra de tekenaar bestaat, is het **paspoort** (besluit 53) bijna gratis: een
wereldkaart waarin de landen die je gezien hebt ingekleurd staan, is dezelfde
module 47 keer aangeroepen met een andere kleur. Zonder de tekenaar blijft het
paspoort een rij vlaggen — wat werkt, maar de kaart is het plaatje dat mensen
aan elkaar laten zien.

## De regel die je niet mag overslaan

`PLAYABLE_GAME_TYPES` in `shared/content/game-catalog.mjs` is een
**ketenuitspraak**, geen wens. Een gameType mag daar pas in als vraagselectie,
contentbron, spelscherm, revealscherm én mock hem aankunnen. Precies dit ging
mis bij `real_or_fake_flag`: de carrousel bood hem aan, de contentbron kon hem
niet bouwen, en de room bleef stil in COUNTDOWN staan.

De contentbron gooit sinds die reparatie een fout bij module-load als de
catalogus meer belooft dan er gevuld is. Zet stap 6 dus niet vóór stap 5.

## Wat dit niet is

Geen kaart, geen zoomen, geen slepen. Eén contour, vier namen, dezelfde
rondestructuur als de andere drie games. De solo-versie (`btn-geo`) blijft
staan zoals hij is; deze game is de multiplayerversie ernaast, niet een
vervanging.

---

# De vier opdrachten

De zes stappen hierboven zijn opgeknipt in vier opdrachten die elk op zichzelf
iets opleveren dat werkt en te controleren is. **A en B kunnen tegelijk** — ze
delen geen bestand. C wacht op allebei, D op C.

| | Opdracht | Bestanden | Maat |
| --- | --- | --- | --- |
| **A** | De contourvraag bouwen | `content-source.mjs` | S |
| **B** | De tekenaar | `shape-renderer.mjs` (nieuw) | L |
| **C** | Spelscherm en uitslag | `gameplay.mjs`, `scoreboard.mjs`, `round-model.mjs` | M |
| **D** | Mock, ketentest, aanzetten | `mock/questions.mjs`, `game-catalog.mjs` | M |

---

## A — De contourvraag bouwen (server)

`server/composition/content-source.mjs` weigert `country_shape_mc` op dit
moment bewust: hij staat niet in `FILLED_GAME_TYPES`. Dat is het slot dat
voorkomt dat een host een game kiest die daarna vastloopt.

Jij maakt dat de contentbron de vraag écht kan bouwen. De vraagselectie bestaat
al (`selectCountryShapeQuestion` in `server/rules/question-selection.js`); die
verwacht een `hasShape(iso2)`-functie waarmee hij bepaalt welke landen als
vraag mogen dienen — niet elk land heeft een contour.

**Gebruik `shared/content/shapes-index.mjs`, niet `shapes.data.mjs`.** Die
eerste is twee kilobyte met alleen de landcodes. De tweede is 234 KB aan
tekenpaden en die hoort nooit in het geheugen van de server: die kiest een land,
hij tekent niets.

Klaar als: de contentbron een geldige contourvraag oplevert met een target en
drie afleiders, met tests. `country_shape_mc` gaat nog **niet** in
`PLAYABLE_GAME_TYPES` — dat is opdracht D.

> **Prompt A** — Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/raad-het-land.md`, opdracht A. Zorg dat `server/composition/content-source.mjs` een `country_shape_mc`-vraag kan bouwen: `FILLED_GAME_TYPES` uitbreiden en `buildQuestion` de contourvraag laten maken via de bestaande `selectCountryShapeQuestion`. Gebruik `shared/content/shapes-index.mjs` (2 KB, alleen landcodes) — `shapes.data.mjs` (234 KB tekenpaden) hoort nooit in het geheugen van de server. Zet `country_shape_mc` NIET in `PLAYABLE_GAME_TYPES`; dat gebeurt pas als de hele keten er is. Blijf uit `frontend/`. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.

---

## B — De tekenaar (client)

Het enige echt nieuwe werk. Een module die een landcontour op het scherm zet.

**Lees eerst `frontend/js/views/flag-renderer.mjs`** — 180 regels, en hij doet
voor vlaggen precies wat jij voor vormen moet doen. Eén export, canvas, geen
state. Bouw zijn tegenhanger, geen afwijkend eigen ding.

De data staat in `shared/content/shapes.data.mjs`: per iso2 een SVG-pad in een
100×100-coördinatenstelsel.

**Het gewicht is de hele reden dat dit een eigen opdracht is.** 234 KB rauw,
85 KB gzip — tien keer de rest van de contentpool. Dat mag nooit meeliften met
een gewoon potje "Raad de vlag". Dus: dynamisch importeren, alleen wanneer deze
game gekozen is. Laat in je oplevering zien dat een potje flags_mc die 234 KB
niet ophaalt.

Klaar als: je een testpagina hebt waarop tien landen herkenbaar getekend staan,
met een schermafdruk erbij, en de import aantoonbaar pas gebeurt als je hem
nodig hebt.

> **Prompt B** — Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/raad-het-land.md`, opdracht B, en bouw `frontend/js/views/shape-renderer.mjs`: een module die een landcontour uit `shared/content/shapes.data.mjs` tekent. Lees eerst `frontend/js/views/flag-renderer.mjs` — dat is het model, bouw zijn tegenhanger. De 234 KB contourdata moet dynamisch geladen worden en mag nooit meeliften met een gewoon potje; toon in je oplevering dat een potje `flags_mc` die data niet ophaalt. Lever een schermafdruk waarop tien landen herkenbaar getekend staan. Raak `gameplay.mjs`, `scoreboard.mjs` en `server/` niet aan — dat is een volgende opdracht. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.

---

## C — Spelscherm en uitslag

**Pas beginnen als A en B klaar zijn.**

De contour moet nu op het spelscherm verschijnen met vier landnamen eronder, en
op het uitslagscherm bij het goede antwoord. Beide schermen hebben al een tak
voor vlaggen; dit is er een naast.

Let op het ruimtebudget: het spelscherm past nu precies binnen 390×650. Een
contour is vierkanter dan een vlag, dus dat gaat niet vanzelf goed. Meet met
`node tools/meet.mjs past spel`.

Klaar als: je in de mock een contourvraag ziet, kunt antwoorden, en op het
uitslagscherm het goede antwoord mét contour terugkrijgt — zonder dat het
scherm gaat scrollen.

> **Prompt C** — Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/raad-het-land.md`, opdracht C. Voeg in `frontend/js/views/gameplay.mjs` een rendertak toe voor `country_shape_mc` (contour boven, vier landnamen eronder) en in `frontend/js/views/scoreboard.mjs` plus `round-model.mjs` de uitslagkant. Gebruik `shape-renderer.mjs` uit opdracht B; bouw geen tweede tekenaar. Het spelscherm past nu precies binnen 390×650 en een contour is vierkanter dan een vlag — meet met `node tools/meet.mjs past spel` en zorg dat het blijft passen. Blijf uit `server/` en `frontend/js/mock/`. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.

---

## D — Mock, ketentest en aanzetten

**Pas beginnen als C klaar is.** Dit is de opdracht die de game daadwerkelijk
speelbaar maakt.

De mock (`frontend/js/mock/questions.mjs`) moet dezelfde contourvraag kunnen
bouwen als de server, anders is de game solo niet te spelen en niet te
demonstreren.

Daarna de ketentest: speel een volledige partij met alleen deze game, van lobby
tot podium, in de mock én tegen de echte server. Pas als dat werkt gaat
`country_shape_mc` in `PLAYABLE_GAME_TYPES` en verdwijnt BINNENKORT uit de
carrousel.

**Die volgorde is niet vrijblijvend.** Op 4 augustus zette de lobbylijst een
game op speelbaar terwijl de contentbron hem niet kon bouwen: starten liet de
room stil in COUNTDOWN staan, zonder foutmelding, tot de TTL verliep. Dat is de
reden dat `game-catalog.mjs` als laatste aan de beurt is en niet als eerste.

Klaar als: je "Raad het land" in de carrousel kunt kiezen, een partij van vijf
rondes uitspeelt, en op het podium eindigt — zowel solo als met twee browsers
tegen de echte server.

> **Prompt D** — Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/raad-het-land.md`, opdracht D. Laat `frontend/js/mock/questions.mjs` dezelfde contourvraag bouwen als de server, speel daarna een volledige partij met alleen `country_shape_mc` — solo in de mock én met twee browsers tegen de echte server — en zet hem pas dán in `PLAYABLE_GAME_TYPES` in `shared/content/game-catalog.mjs`. Die volgorde is niet vrijblijvend: op 4 augustus stond een game op speelbaar terwijl de contentbron hem niet kon bouwen, en toen bleef de room stil in COUNTDOWN hangen tot de TTL verliep. Lever de partij op met schermafdrukken van lobby, spelscherm, uitslag en podium. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.

