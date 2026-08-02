# DT — hervat na uitvoeringsakkoord

Lees eerst `docs/multiplayer/DECISIONS.md`, vooral §Uitvoeringsakkoord.

## Bevestigd akkoord

De producteigenaar heeft akkoord gegeven om serverintegratie, Playwright,
loadtests, chaos/restarttests, devicechecks, CI en benodigde dependencies te
realiseren. Vraag niet opnieuw om hetzelfde generieke dependency- of
uitvoeringsakkoord.

Het akkoord is geen reden om ontbrekende prerequisites te negeren en geen
toestemming voor destructieve productieproeven. Een test wordt pas actief als de
benodigde server, UI, Compose-stack of aangewezen testomgeving werkelijk bestaat.

## Opdracht

1. Inventariseer opnieuw welke DT3b- en DT4a-scenario's door de huidige repository
   inmiddels uitvoerbaar zijn; activeer alleen die scenario's.
2. Sluit aan op de bestaande servercomposition en `package.json`; voeg geen tweede,
   concurrerende teststack toe.
3. Voeg Playwright- en loadtesttooling toe wanneer hun concrete targets bestaan.
4. Los CI als één samenhangende workflowstrategie op; creëer niet bewust een groene
   workflow naast een blijvend kapotte verplichte workflow.
5. Voer lokale, geïsoleerde tests uit. Gebruik voor chaos een unieke
   Compose-projectnaam en controleer targets vóór reset/stop-acties.
6. Voer niets destructiefs tegen productie, publieke data of secrets uit.
7. Werk DT-PROGRESS.md bij met onderscheid tussen uitgevoerd, technisch geblokkeerd
   en alleen handmatig verifieerbaar.
8. Rapporteer dependencies, uitgevoerde tests, gemeten resultaten en resterende
   technische blockers.

