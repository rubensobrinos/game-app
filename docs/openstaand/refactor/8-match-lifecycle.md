# 8 — `match-lifecycle.mjs` opsplitsen (1764 regels)

**Als laatste van de acht. Geen gedragsverandering.**

## Waarom dit de gevaarlijkste is

Hier zitten de fases, de rondes, de scoring, de pauze en het herstel na een
serverherstart in elkaar. Twaalf exports, 22 functies, en een testbestand van
2315 regels eromheen. Dit is het bestand waar een verhuizing stil iets kan
breken zonder dat één test rood wordt — dat is hier eerder gebeurd, en de mock
verborg het maandenlang.

Doe deze pas als de andere zeven klaar zijn.

## Wat je opsplitst

| Nieuw bestand | Exports |
| --- | --- |
| `match/fases.mjs` | `resolveNextPhase`, `advancePhase`, en de fasehulpjes (`phaseDurationMs`, `phaseEndsAt`, `hostActionPhase`) |
| `match/rondes.mjs` | `startRound`, `endRound`, `submitAnswer`, `resolveEligibleFromRound` |
| `match/verloop.mjs` | `startMatch`, `finishMatch`, `rematch` |
| `match/stand.mjs` | `getScoreboard`, `buildRankedTop` |
| `match/snapshot.mjs` | `buildSnapshot` |
| `match/herstel.mjs` | `recoverActiveRooms` |

## De vier plekken waar het misgaat als je niet oplet

1. **`resolveNextPhase` is geen tweede fasetabel.** `state-machine.js` bepaalt
   wat mag; deze functie kiest alleen de bestemming, omdat de reducer
   `roundIndex`/`totalRounds`/`scoreboardFrequency` bewust niet kent. Houd dat
   onderscheid intact.

2. **`phaseEndsAt` is vluchtig en wordt nooit opgeslagen** (besluit 16). Een
   verhuizing die het per ongeluk in de opgeslagen state trekt, breekt het
   herstel na een serverherstart.

3. **De hervattijd na een pauze.** `resumeDeadlineFor` berekent de nieuwe
   deadline uit de resterende tijd. Dit was een echte bug: de deadline schoof
   niet op, de gepauzeerde seconden gingen verloren én de match bleef hangen.
   De mock deed het wél goed, waardoor 3000 tests groen bleven. Raak deze
   berekening niet aan.

4. **`buildRankedTop` is de enige plek waar een positie bepaald wordt.** Geen
   enkele andere module — en geen enkele client — mag `index + 1` gebruiken.
   Die regel staat in `STATUS.md` en er zit een contracttest op bij een echte
   gelijke stand.

## Hoe je oplevert

De volledige suite groen, inclusief:

- de Redis-varianten (`REDIS_URL=redis://127.0.0.1:6380`),
- de integratietests in `tests/integration/`,
- de AOF-herstarttest, die het herstel na een serverherstart bewijst.

En daarnaast een handmatige partij in een browser: lobby → spel → pauze →
hervatten → uitslag → podium. Juist het pauzeren, want dat is waar het eerder
misging.

## Niet doen

- `state-machine.js` aanraken.
- De scoringregels wijzigen, ook niet cosmetisch.
- Twee verhuizingen in één commit.

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/refactor/8-match-lifecycle.md` helemaal vóór je begint — dit is de gevaarlijkste van de acht refactors. Splits `server/composition/match-lifecycle.mjs` op, zonder gedragsverandering; de twaalf exports blijven exact gelijk. In het document staan vier plekken die stil kunnen breken zonder dat een test rood wordt: de scheiding met `state-machine.js`, het vluchtige `phaseEndsAt`, de hervattijd na een pauze, en `buildRankedTop` als enige plek waar een positie bepaald wordt. Draai de volledige suite, de Redis-varianten met `REDIS_URL=redis://127.0.0.1:6380`, de integratietests en de AOF-herstarttest. Speel daarnaast handmatig een partij in een browser mét pauzeren en hervatten. Blijf uit `server/architecture/state-machine.js`. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
