# 12 — `match-lifecycle.test.mjs` opsplitsen (2337 regels)

**Doe deze ná opdracht 8** (de bron zelf). Anders verhuizen twee mensen
tegelijk aan weerszijden van dezelfde muur.

**Geen enkele test mag verdwijnen of soepeler worden.**

## Waarom

Het grootste bestand van de repo, groter dan welk productiebestand dan ook, en
elke agent die aan de spelregels werkt moet erin. 52 tests over de hele
matchcyclus.

## Wat je opsplitst

De testtitels wijzen de groepen aan. Ze verwijzen bovendien naar matrixrijen
uit de testmatrix — houd die verwijzingen intact, ze zijn de brug naar de
documentatie:

| Nieuw bestand | Tests over |
| --- | --- |
| `match-cyclus.test.mjs` | matrixrij 7: start, tien rondes, einde, rematch |
| `match-deelnemers.test.mjs` | matrixrij 9: late joiners, `allowLateJoin` |
| `match-idempotentie.test.mjs` | matrixrij 12: dezelfde `actionId`, gewijzigde inhoud, de ack ná de write |
| `match-snapshot.test.mjs` | matrixrij 14 en besluit 20: wat een snapshot wel en niet draagt |
| `match-antwoorden.test.mjs` | besluit 13 (de 250 ms grace), scoring, de antwoordverdeling |
| `match-pauze.test.mjs` | pauzeren, hervatten, `pausedState`, herstel na serverherstart |

Laat de titels de indeling bepalen, niet je eigen smaak. Dan is later vindbaar
waar iets hoort.

## De regels

1. **Aantal tests vóór en ná is gelijk.** Zet dat aantal in je oplevering.
2. **Geen enkele assertie wijzigen.** Ook geen tikfout in een testnaam
   herstellen — die namen worden elders geciteerd.
3. **Gedeelde opzet mag naar één hulpbestand**, maar alleen letterlijk. Zie je
   dat twee tests hun opzet nét anders doen, dan is dat waarschijnlijk met
   opzet. Niet gladstrijken, wél melden.
4. **De matrixrij-verwijzingen blijven staan.** Ze koppelen deze tests aan
   `docs/deployment-and-testing-plan/`.

## Waar je extra op let

Dit bestand test de vier dingen die stil kunnen breken: de scheiding met
`state-machine.js`, het vluchtige `phaseEndsAt`, de hervattijd na een pauze, en
`buildRankedTop` als enige plek waar een positie bepaald wordt. Raakt jouw
splitsing die tests, controleer dan dat ze nog steeds falen als je de bron
tijdelijk kapotmaakt — een test die je per ongeluk hebt losgekoppeld ziet er
groen uit maar bewijst niets.

## Hoe je oplevert

`npm test` met hetzelfde aantal tests als vóór je begon, plus de
Redis-varianten (`REDIS_URL=redis://127.0.0.1:6380`).

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait en noteer het aantal tests. Lees `docs/openstaand/refactor/12-match-lifecycle-test.md` en voer dat uit: `server/composition/match-lifecycle.test.mjs` opsplitsen langs de groepen die de testtitels aanwijzen. Geen enkele test mag verdwijnen of soepeler worden, geen enkele assertie wijzigen, en de matrixrij-verwijzingen in de namen blijven staan — zet het aantal tests vóór en ná in je oplevering. Controleer bij de tests die de vier gevoelige plekken dekken (state-machine-scheiding, vluchtige `phaseEndsAt`, hervattijd na pauze, `buildRankedTop`) dat ze nog steeds falen als je de bron tijdelijk kapotmaakt. Blijf uit `server/composition/match-lifecycle.mjs` zelf. Draai ook `REDIS_URL=redis://127.0.0.1:6380`. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. Draait er een rode test die niet van jou is, dan telt die niet mee. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
