# 10 — `server/transport/rest.test.mjs` opsplitsen (1120 regels)

**Geen enkele test mag verdwijnen of soepeler worden.**

## Waarom

Dit testbestand is groter dan de code die het test. 49 tests in één bestand,
over vier verschillende onderwerpen. Wie er één moet aanpassen, scrollt door
duizend regels van iemand anders.

Dit is de eerste van de grote testbestanden. Doe je het hier goed, dan is het
patroon er voor `match-lifecycle.test.mjs` (2337) en de rest.

## Wat je opsplitst

De testtitels wijzen de groepen zelf aan:

| Nieuw bestand | Tests over |
| --- | --- |
| `rest-games-aanmaken.test.mjs` | `POST /api/v1/games` — happy path, validatie, te lange naam, onparseerbare JSON |
| `rest-games-join.test.mjs` | `POST /api/v1/games/join` en `/leave` |
| `rest-store-handle.test.mjs` | het handle dat per request wordt opgevraagd, en wat er gebeurt als de socketlaag werpt |
| `rest-overig.test.mjs` | wat na de drie groepen overblijft — en als dat niets is, bestaat dit bestand niet |

Deel niet op naar smaak: laat de titels de indeling bepalen, dan is later
vindbaar waar iets hoort.

## De regels

1. **Aantal tests vóór en ná is gelijk.** Zet dat aantal in je oplevering.
2. **Geen enkele assertie wijzigen.** Ook niet "even opschonen" of een
   duidelijke tikfout in een testnaam herstellen.
3. **Gedeelde opzet mag naar een hulpbestand**, maar alleen letterlijk. Zie je
   dat twee tests hun opzet nét anders doen, dan is dat waarschijnlijk met
   opzet — niet gladstrijken, wél melden.

## Hoe je oplevert

`npm test` groen met hetzelfde aantal tests als vóór je begon. Draai ook de
Redis-varianten (`REDIS_URL=redis://127.0.0.1:6380`) als deze tests die raken.

## Niet doen

- `server/transport/rest.mjs` zelf aanraken.
- Tests samenvoegen omdat ze op elkaar lijken.
- Een test overslaan of markeren als todo om groen te worden.

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait en noteer het aantal tests. Lees `docs/openstaand/refactor/10-rest-test.md` en voer dat uit: `server/transport/rest.test.mjs` opsplitsen langs de onderwerpen die de testtitels aanwijzen. Geen enkele test mag verdwijnen of soepeler worden, geen enkele assertie wijzigen — zet het aantal tests vóór en ná in je oplevering. Blijf uit `server/transport/rest.mjs` zelf. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. Draait er een rode test die niet van jou is, dan telt die niet mee — die komt van ander lopend werk. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
