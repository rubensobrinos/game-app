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

## Wat er gebouwd moet worden

| Stap | Wat | Duur |
| --- | --- | --- |
| 1 | Migratie: `shared/content/shapes.data.mjs`, gesleuteld op iso2, met de vijf aliassen en een weggeschreven lijst van wat afvalt. Generator ernaast, net als `build-content.mjs` | halve dag |
| 2 | GameType `country_shape_mc`: `game-catalog.mjs`, `GOLF_1_GAME_TYPES`, protocolvalidatie | halve dag |
| 3 | Vraagselectie: target + drie afleiders met dezelfde continentvoorkeur als `flags_mc`; `assertRoundShape` met verplichte `validOptionIds` | halve dag |
| 4 | `shape-renderer.mjs` in de client, naar het model van `flag-renderer.mjs`. Dynamische import | 1 dag |
| 5 | Mock, spelscherm, revealscherm | 1 dag |
| 6 | Verticale ketentest, daarna pas in `PLAYABLE_GAME_TYPES` | halve dag |

**Vier dagen**, waarvan stap 4 het enige echt nieuwe werk is. De rest volgt het
pad dat `odd_one_out` en `real_or_fake_flag` al hebben uitgesleten.

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
