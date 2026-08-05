# 4 — `transport-mock.mjs` opsplitsen (1548 regels)

**Geen gedragsverandering.** De mock moet zich precies zo blijven gedragen als
nu, want hij is de enige manier om solo te spelen en om de keten te
demonstreren zonder server.

## Waarom

67 functies achter 2 exports. Het is in feite een complete nagebouwde server in
één bestand: rooms, matches, rondes, antwoorden, fases, timers, events, opslag.

## Wat je opsplitst

De functienamen wijzen de naad zelf aan:

| Nieuw bestand | Functies |
| --- | --- |
| `mock/room.mjs` | `buildRoom`, `resolveRoomLocator`, `setLocked`, `kickPlayer`, `renamePlayer`, `recolorPlayer`, `updateRoomConfig` |
| `mock/match.mjs` | `startGame`, `startRound`, `endRound`, `showScoreboard`, `finishGame`, `rematch` |
| `mock/pacing.mjs` | `advanceOnHostCue`, `advanceFromScoreboard`, `revealAnswer`, `pauseGame`, `resumeGame`, `rearmTimer` |
| `mock/answers.mjs` | `submitAnswer` |
| `mock/events.mjs` | `broadcast`, `broadcastPersonalized`, `emitToSession`, `emitToSessionToken` |
| `mock/sessie.mjs` | `connect`, `requireSession`, `requireRole`, `persist` |

De twee bestaande exports blijven exact zoals ze zijn: wie de mock gebruikt,
merkt niets.

## Let op

**De mock is niet zomaar een testdubbel — hij is een tweede implementatie van
het protocol.** Eerder is een echte bug maandenlang onzichtbaar gebleven omdat
de mock het gedrag correcter nabootste dan de server: de mock schoof zijn
deadline netjes op na een pauze, de server niet. Alle 3000 tests bleven groen.

Verander dus niets aan wat de mock stuurt of wanneer, hoe verleidelijk ook.

**`persist` en de solo-opslag.** Sinds kort overleeft een solopartij een
herlaadbeurt (`client/flow/solo-store.mjs`). Wat er in `sessionStorage` gaat en
hoe het teruggezet wordt, moet exact hetzelfde blijven — een oude opgeslagen
partij van vóór jouw wijziging hoort nog steeds te laden.

## Hoe je oplevert

`npm test` groen, plus een handmatige controle in een echte browser: solo
starten, een ronde spelen, verversen, en zien dat de partij doorloopt met
dezelfde vraag en dezelfde antwoordvolgorde.

## Niet doen

- Gedrag, timing of eventvolgorde wijzigen.
- De echte transport (`frontend/js/transport.mjs`) aanraken.
- Ontbrekende functionaliteit "even" toevoegen omdat je ziet dat de mock iets
  niet kan. Melden.

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/refactor/4-transport-mock.md` en voer dat uit: `frontend/js/transport-mock.mjs` opsplitsen, zonder enige gedragsverandering — de mock is een tweede implementatie van het protocol, geen testdubbel. De twee bestaande exports blijven exact gelijk. Controleer naast `npm test` handmatig in een browser dat een solopartij een herlaadbeurt overleeft. Blijf uit `frontend/js/transport.mjs`. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
