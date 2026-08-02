# Prompt — GR5: Late join & disconnect-accounting

Onderdeel van [`docs/game-rules-plan/README.md`](../README.md), fase GR5.
Vereist dat GR0–GR4 zijn afgerond (is het geval).

## Brondocument

[`docs/multiplayer/GAME-RULES.md`](../../multiplayer/GAME-RULES.md), secties
"Late join" en "Speler verlaat of disconnect":

```text
Een late joiner:
- krijgt geen punten voor gemiste rondes;
- telt pas mee in playerCount voor antwoordvoortgang vanaf de eerstvolgende
  volledig nieuwe ronde;
- kan wel de huidige uitslag en tussenstand bekijken;
- wordt in de eindstand desgewenst gemarkeerd met "vanaf ronde {n}".

- tijdelijk disconnected blijft maximaal gedurende de room-TTL herstelbaar;
- disconnected spelers tellen na een korte graceperiode niet mee in de noemer
  van antwoordvoortgang;
- reeds behaalde punten blijven staan;
- vrijwillig vertrokken spelers tellen niet mee in volgende rondes.
```

Plus [`GAME-FLOW.md`](../../multiplayer/GAME-FLOW.md) §Randgevallen 3 ("speler
komt binnen na de start"): een late joiner "kan pas antwoorden vanaf een
volledig nieuwe actieve ronde als de huidige vraag bijna is afgelopen" — bij
voldoende resterende tijd mag de speler dus alsnog de lopende ronde meedoen.

En [`docs/multiplayer/DECISIONS.md`](../../multiplayer/DECISIONS.md):

- #3: de client krijgt `eligibleFromRound` proactief te zien; servervalidatie
  blijft leidend (deze module ís die servervalidatie).
- #4: vrijwillig verlaten zet `left: true`, trekt het sessietoken niet in.
- #5: een speler met `left: true` telt niet automatisch mee in een rematch.

## Ontwerpbeslissingen

1. **`eligibleFromRound`-toekenning bij late join is tijdsafhankelijk, met een
   expliciete, aanpasbare drempel.** "Bijna afgelopen" staat niet als getal in
   de spec. Deze module neemt een `remainingFraction` (0–1, resterend deel van
   het tijdvenster) en een `nearEndThreshold` als parameters — de aanroeper
   berekent `remainingFraction` (zelfde soort berekening als GR1's
   bonusformule, met `startsAt`/`endsAt`/`nowMs`), deze module vergelijkt hem
   alleen. Bij `remainingFraction` onbekend (`null`) wordt conservatief
   aangenomen dat de ronde bijna voorbij is (geen huidige ronde toegekend) —
   veiliger dan het omgekeerde bij ontbrekende informatie.
2. **`countsTowardAnswerDenominator` combineert late-join- en disconnect-
   gating in één functie**, omdat `GAME-RULES.md` "de noemer van
   antwoordvoortgang" voor beide gebruikt en een speler aan beide voorwaarden
   tegelijk moet voldoen (niet vertrokken/gekickt, al toegetreden voor deze
   ronde, en verbonden of nog binnen de disconnect-grace).
3. **Disconnect-grace komt als parameter binnen (`graceMs`), geen hardgecodeerde
   waarde.** `GAME-RULES.md` noemt alleen "een korte graceperiode" zonder
   getal — anders dan de expliciete 250 ms uit `GAME-RULES.md`s
   deadline-grace (GR1). De aanroeper (state machine/architecture) bepaalt de
   waarde.
4. **`disconnectedSinceMs` is verplicht wanneer `connected: false`.** Een
   speler als disconnected markeren zonder tijdstip is een aanroepersfout —
   zelfde "fail loud, niet stil aannemen"-principe als de rest van deze
   modulefamilie. Geen impliciete "net nu"-aanname.
5. **`left`/`kicked` wegen zwaarder dan connectiviteit of eligibility.** Een
   vertrokken of gekickte speler telt nooit mee, ongeacht `eligibleFromRound`
   of `connected`-status — geen combinatie van velden kan dat overrulen.
6. **Late-join-markering in de eindstand levert gestructureerde data, geen
   tekst.** `"vanaf ronde {n}"` is weergavetekst (i18n-laag); deze module
   geeft `{ isLateJoin, eligibleFromRound }` terug, niet de Nederlandse zin
   zelf — zelfde grens als GR4's iso2-in-plaats-van-vertaalde-naam.

## Nadrukkelijk buiten scope

- **Detecteren van een socket-disconnect of het bijhouden van
  `disconnectedSinceMs`** — transportlaag (`server/protocol/`), niet deze
  module. Deze module consumeert die status, produceert hem niet.
- **"Drie volledig onbeantwoorde rondes achter elkaar" tellen en daarop
  pauzeren** (`GAME-FLOW.md` §Randgevallen 6) — het túrellen over meerdere
  rondes is state-machine-geheugen, geen pure berekening per ronde. Of één
  ronde volledig onbeantwoord was, is triviaal (`answeredCount === 0`) en
  behoeft geen functie hier.
- **Spelerreset bij rematch** (welke velden wel/niet resetten) — al
  beantwoord door `docs/data-model-plan/HANDOFF.md` §3, niet hier dupliceren.
- **`Player.score` ongemoeid laten bij disconnect/vertrek** — vereist geen
  functie; simpelweg geen enkele functie hier raakt `score` aan.

## Te bouwen functies

Bestand: `server/rules/eligibility.js`, plus
`server/rules/eligibility.test.js`.

```js
/**
 * Bepaalt vanaf welke ronde een net toegetreden speler mag meetellen/
 * antwoorden. Werpt RangeError bij een onbekende `phase`, een
 * `remainingFraction` buiten [0,1] (en niet null), of een niet-positieve
 * `currentRoundNumber`/ongeldige `nearEndThreshold`.
 * @param {{
 *   currentRoundNumber: number,
 *   phase: "LOBBY"|"COUNTDOWN"|"ROUND_ACTIVE"|"ROUND_RESULT"|"SCOREBOARD"|"PAUSED"|"FINISHED",
 *   remainingFraction: number | null,
 *   nearEndThreshold: number,
 * }} p
 * @returns {number}
 */
function computeEligibleFromRound(p) {}

/**
 * @param {number} eligibleFromRound
 * @param {number} roundNumber
 * @returns {boolean}
 */
function isEligibleForRound(eligibleFromRound, roundNumber) {}

/**
 * Werpt RangeError bij een niet-positieve integer.
 * @param {number} eligibleFromRound
 * @returns {{ isLateJoin: boolean, eligibleFromRound: number }}
 */
function describeLateJoin(eligibleFromRound) {}

/**
 * Bepaalt of een speler meetelt in de noemer van antwoordvoortgang voor
 * `roundNumber`. Werpt RangeError als `connected: false` zonder geldige
 * `disconnectedSinceMs`, of bij een negatieve `graceMs`.
 * @param {{ left: boolean, kicked: boolean, eligibleFromRound: number, connected: boolean, disconnectedSinceMs: number | null }} player
 * @param {{ roundNumber: number, nowMs: number, graceMs: number }} context
 * @returns {boolean}
 */
function countsTowardAnswerDenominator(player, context) {}

module.exports = {
  computeEligibleFromRound,
  isEligibleForRound,
  describeLateJoin,
  countsTowardAnswerDenominator,
};
```

Alle vier zijn publiek — het zijn onafhankelijk bruikbare, kleine predicaten/
berekeningen, geen laag-met-interne-helpers zoals GR3/GR4.

## Verplichte testgevallen

### `computeEligibleFromRound`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `ROUND_ACTIVE`, `remainingFraction >= nearEndThreshold` | `currentRoundNumber` (mag nog meedoen) |
| 2 | `ROUND_ACTIVE`, `remainingFraction < nearEndThreshold` | `currentRoundNumber + 1` |
| 3 | `ROUND_ACTIVE`, `remainingFraction === null` | `currentRoundNumber + 1` (conservatief) |
| 4 | `ROUND_RESULT` | `currentRoundNumber + 1` |
| 5 | `SCOREBOARD` | `currentRoundNumber + 1` |
| 6 | `PAUSED` | `currentRoundNumber + 1` |
| 7 | Onbekende `phase` | `RangeError` |
| 8 | `remainingFraction = 1.5` of `-0.1` (niet null, buiten bereik) | `RangeError` |
| 9 | `currentRoundNumber = 0` of niet-integer | `RangeError` |

### `isEligibleForRound`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 10 | `roundNumber > eligibleFromRound` | `true` |
| 11 | `roundNumber === eligibleFromRound` (grens) | `true` |
| 12 | `roundNumber < eligibleFromRound` | `false` |

### `describeLateJoin`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 13 | `eligibleFromRound === 1` | `{ isLateJoin: false, eligibleFromRound: 1 }` |
| 14 | `eligibleFromRound === 4` | `{ isLateJoin: true, eligibleFromRound: 4 }` |
| 15 | `eligibleFromRound === 0` of `2.5` | `RangeError` |

### `countsTowardAnswerDenominator`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 16 | `left: true`, verder alles geldig | `false` |
| 17 | `kicked: true`, verder alles geldig | `false` |
| 18 | `roundNumber < eligibleFromRound` | `false` |
| 19 | `connected: true`, niet vertrokken/gekickt, al eligible | `true` |
| 20 | `connected: false`, `disconnectedForMs < graceMs` | `true` |
| 21 | `connected: false`, `disconnectedForMs === graceMs` (grens) | `false` |
| 22 | `connected: false`, `disconnectedForMs > graceMs` | `false` |
| 23 | `connected: false` zonder geldige `disconnectedSinceMs` | `RangeError` |
| 24 | `graceMs < 0` | `RangeError` |
| 25 | `left: true` én lang disconnected tegelijk | `false` (bewijst dat `left` niet pas als laatste gecontroleerd hoeft te worden om correct te zijn) |

## Definition of done

- Alle 25 testgevallen slagen via `node --test 'server/rules/**/*.test.js'`.
- Geen enkele functie raakt Redis, sockets, bestanden, de klok
  (`nowMs`/tijden komen altijd als parameter binnen) of `Player.score`.
- Alle vier functies staan in `module.exports`.
