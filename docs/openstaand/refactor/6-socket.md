# 6 — `socket.mjs` opsplitsen (1399 regels)

**Geen gedragsverandering.**

## Waarom

De hele socketlaag zit in één bestand: handshake, authenticatie, de
clientevents, de fasepomp met timers, het publiceren naar de room, de
snapshot, metrics en het afsluiten. Elke serverklus die iets over de lijn
stuurt, moet hierin.

## Wat je opsplitst

Het bestand heeft zijn eigen sectiekoppen al, en die zijn de naad:

| Nieuw bestand | Sectie |
| --- | --- |
| `socket/handshake.mjs` | Handshake, authenticatie, sessieherstel |
| `socket/publiceren.mjs` | Server → client: `publish`, gepersonaliseerde payloads |
| `socket/fasepomp.mjs` | Servertimers en `onPhaseEntered` — de overgangen |
| `socket/clientevents.mjs` | Client → server: de grote schakelaar |
| `socket/snapshot.mjs` | Snapshot en afgeleide gegevens |

`createSocketLayer` (of hoe de hoofdexport ook heet) blijft de plek die alles
bedraadt, en de zeven exports blijven exact gelijk.

## Let op

**"Servertimers — absolute tijdstippen, nooit ticks over de socket."** Die
regel staat er niet voor niets en is een besluit: de client krijgt een
tijdstip, geen aftelling. Verplaats de timerlogica zonder dat te veranderen.

**De volgorde van ack en broadcast is bewust.** De server stuurt de
bevestiging van `round:answer` vóór de `after`-hook die `round:progress`
uitzendt, zodat een client zijn eigen ack nooit ná de bijbehorende broadcast
ziet. Dat is precies onderzocht bij een flaky test; draai het niet om.

**De fasepomp is één compositie-aanroep per overgang.** Er mag geen tweede
fasetabel ontstaan in de transportlaag — dat is de reden dat deze code hier zo
dun is en `match-lifecycle.mjs` zo dik.

## Hoe je oplevert

`npm test` groen, inclusief de integratietests met een echte socket
(`tests/integration/`), en de Redis-varianten met
`REDIS_URL=redis://127.0.0.1:6380`.

## Niet doen

- `server/composition/` aanraken.
- Timing, volgorde of payloadvorm wijzigen.
- Nieuwe logica toevoegen in de transportlaag, hoe klein ook.

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/refactor/6-socket.md` en voer dat uit: `server/transport/socket.mjs` opsplitsen langs zijn eigen sectiekoppen, zonder gedragsverandering. De zeven exports blijven exact gelijk. Let op de drie regels in het document: absolute tijdstippen in plaats van ticks, de bewuste volgorde van ack vóór broadcast, en geen tweede fasetabel in de transportlaag. Draai naast `npm test` ook de integratietests met `REDIS_URL=redis://127.0.0.1:6380`. Blijf uit `server/composition/`. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
