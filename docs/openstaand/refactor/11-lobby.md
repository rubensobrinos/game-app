# 11 — `frontend/js/views/lobby.mjs` opsplitsen (1090 regels)

**Geen gedragsverandering.**

## Waarom

De lobby stond niet in de oorspronkelijke acht: hij was 912 regels. Door het
continentfilter is hij over de 1000 gegaan, en er komen nog drie klussen aan
die hier moeten zijn — typed answers, de donut-gamekeuze en de
spelersidentiteit. Dat is precies één bestand waar drie mensen tegelijk in
willen.

## Wat je opsplitst

De lobby is in feite vier schermen op één pagina, en het bestand zegt dat zelf
al in zijn kopjes:

| Nieuw bestand | Wat erin hoort |
| --- | --- |
| `lobby/spelers.mjs` | de spelerslijst, het ⋯-menu per speler, verwijderen, hernoemen en verkleuren door de host |
| `lobby/zelf.mjs` | "Zo heet je vanavond" — je eigen naam en kleur (scherm 3, besluit 40B) |
| `lobby/instellingen.mjs` | de in-/uitklapbare hostinstellingen (scherm 2, besluit 40): rondes, moeilijkheid, taal, toggles, en "Meer instellingen" met het continentfilter |
| `lobby/gamekeuze.mjs` | de carrousel: kaart, pijlen, vegen, de BINNENKORT-staat |
| `lobby/delen.mjs` | de deelacties en de uitnodiging |

Wat overblijft in `lobby.mjs` is het samenstellen en `update()` — de ene
functie die de serverstand naar al die onderdelen doorgeeft.

## Vier dingen die vastliggen

1. **Wat speelbaar is bepaalt dit scherm niet.** `shared/content/game-catalog.mjs`
   is de enige bron. Op 4 augustus zette deze lijst zelf een game op speelbaar
   terwijl de contentbron hem niet kon bouwen — starten liet de room stil in
   COUNTDOWN staan. Die regel staat als commentaar in het bestand en die blijft.

2. **De serverstand is de waarheid.** Draaien aan de carrousel of een
   instelling stuurt `game:update-config`; wat je daarna ziet komt terug via
   `room:config-changed`. Niet lokaal vooruitlopen.

3. **De warm-up blijft opengeklapt** (besluit producteigenaar). De lobby is het
   enige scherm dat bewust niet in één viewport past; alles wat je nodig hebt
   staat boven de vouw. Meet met `node tools/meet.mjs past lobby` en zorg dat
   die uitkomst niet verandert.

4. **De startknop is sticky en dat is een productbesluit**, geen bug —
   `sticky-start.test.mjs` bewaakt het. Ook de `scroll-padding-bottom` op
   `html` hoort te blijven: de pagina is hier de scroller, dus die regel op een
   binnenelement zetten doet niets.

## Hoe je oplevert

`npm test` groen, plus in een browser: een room aanmaken, je naam en kleur
wijzigen, een instelling verzetten, door de games draaien, en `node
tools/meet.mjs past lobby` met dezelfde uitkomst als vóór je begon.

## Niet doen

- `session-shell.mjs` aanraken — dat is een andere opdracht.
- Onderdelen "vereenvoudigen" of samenvoegen omdat ze op elkaar lijken.
- De volgorde van de secties op het scherm wijzigen.

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/refactor/11-lobby.md` en voer dat uit: `frontend/js/views/lobby.mjs` opsplitsen per onderdeel, zonder gedragsverandering. In het document staan vier dingen die vastliggen — de gamecatalogus als enige bron van wat speelbaar is, de serverstand als waarheid, de opengeklapte warm-up en de sticky startknop. Controleer naast `npm test` in een browser: naam en kleur wijzigen, een instelling verzetten, door de games draaien, en `node tools/meet.mjs past lobby` met dezelfde uitkomst als vooraf. Blijf uit `frontend/js/session-shell.mjs` en `frontend/js/views/` daarbuiten. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. Draait er een rode test die niet van jou is, dan telt die niet mee. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
