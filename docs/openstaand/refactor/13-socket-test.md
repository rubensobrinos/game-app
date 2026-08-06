# 13 — `socket.test.mjs` opsplitsen (1158 regels)

**Doe deze ná opdracht 6** (de bron zelf).

**Geen enkele test mag verdwijnen of soepeler worden.**

## Wat je opsplitst

34 tests, en de titels wijzen vier groepen aan die precies samenvallen met de
sectiekoppen van `socket.mjs`:

| Nieuw bestand | Tests over |
| --- | --- |
| `socket-handshake.test.mjs` | geldig token, onbekend token, ingetrokken sessie, verkeerde protocolversie |
| `socket-clientevents.test.mjs` | acks, rolcontrole (`NOT_HOST`), onbekende events, idempotentie op `actionId` |
| `socket-broadcast.test.mjs` | matrixrij 11 (twee rooms lekken niet), matrixrij 13 (throttling van `round:progress`), `room:state` |
| `socket-fouten.test.mjs` | `toPublicErrorCode`, en dat een interne foutcode nooit bij een client aankomt |

## Twee dingen die je niet mag verliezen

**De volgorde-eis.** Matrixrij 13 test dat de server zijn ack vóór de
broadcast stuurt. Die test heeft een eigen, oorzakelijke barrière
(`waitForCount`) die er staat omdat de vorige aanpak — wachten op de ack van
een volgend event — ongeveer één op de tien keer faalde onder Redis. De
kopnotitie van die test legt dat uit; die notitie verhuist mee.

**De lekcontrole.** Matrixrij 11 bewijst dat twee gelijktijdige rooms geen
events naar elkaar lekken. Dat is een beveiligingseigenschap, geen
functionaliteit. Zorg dat hij in één stuk blijft.

## Hoe je oplevert

`npm test` met hetzelfde aantal tests als vóór je begon, plus de
integratietests met `REDIS_URL=redis://127.0.0.1:6380` — juist matrixrij 13
gedraagt zich anders tegen een echte Redis dan in het geheugen.

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait en noteer het aantal tests. Lees `docs/openstaand/refactor/13-socket-test.md` en voer dat uit: `server/transport/socket.test.mjs` opsplitsen langs de vier groepen die de testtitels aanwijzen. Geen enkele test mag verdwijnen of soepeler worden, geen enkele assertie wijzigen — zet het aantal tests vóór en ná in je oplevering. Twee dingen mogen niet sneuvelen: de kopnotitie bij matrixrij 13 over waarom die test een eigen barrière gebruikt, en matrixrij 11 (twee rooms lekken geen events naar elkaar) als één geheel. Blijf uit `server/transport/socket.mjs` zelf. Draai ook `REDIS_URL=redis://127.0.0.1:6380`. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. Draait er een rode test die niet van jou is, dan telt die niet mee. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
