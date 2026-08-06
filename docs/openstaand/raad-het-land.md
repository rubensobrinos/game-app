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

Daarmee is stap 1 uit PLAN-CONVERGENTIE geen risico meer, maar een uurtje werk.

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

## Wat er nog moet gebeuren — twee en een halve dag

| # | Wat | Waar | Duur |
| --- | --- | --- | --- |
| 1 | De contourvraag bouwen: welk land wordt het, welke drie afleiders komen erbij | `server/composition/content-source.mjs` | 2 uur |
| 2 | De tekenaar: de contour op het scherm zetten, dynamisch geladen | `frontend/js/views/shape-renderer.mjs` (nieuw) | 1 dag |
| 3 | Spelscherm: een rendertak voor de contour naast die voor de vlag | `frontend/js/views/gameplay.mjs` | 3 uur |
| 4 | Uitslagscherm: het goede antwoord mét contour | `frontend/js/views/scoreboard.mjs`, `round-model.mjs` | 2 uur |
| 5 | Mock: dezelfde vraag nabouwen, anders is hij solo niet te spelen | `frontend/js/mock/questions.mjs` | 3 uur |
| 6 | Verticale ketentest, daarna pas in `PLAYABLE_GAME_TYPES` | `shared/content/game-catalog.mjs` | 2 uur |

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
