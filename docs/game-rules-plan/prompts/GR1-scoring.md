# Prompt — GR1: Scoring

Onderdeel van [`docs/game-rules-plan/README.md`](../README.md), fase GR1. Vereist
dat GR0 is afgerond (`server/rules/.gitkeep` bestaat, geen dependencies). Doel: de
puntenformule uit `GAME-RULES.md` implementeren als pure, geteste functies.

**Bijgewerkt na review** — zie [`REVIEW.md`](REVIEW.md). Deze versie verwerkt
bevindingen 1–4, 6 en 7. Bevinding 5 (GR0-verificatie) is verwerkt in
`GR0-scaffold.md`.

**Nogmaals bijgewerkt na [`REVIEW-GR2-GR3.md`](REVIEW-GR2-GR3.md), bevinding 5.**
GR1 was al geïmplementeerd en getest (27/27 groen) toen die review een gat
blootlegde: `accumulateCorrectResponseTime` accepteerde een niet-eindig of
negatief `currentTotalMs`/`responseTimeMs` stilzwijgend, wat een corrupte
`correctResponseTimeMsTotal` in de GR2-tiebreak had kunnen opleveren. Dit
document én de al geïmplementeerde `server/rules/scoring.js` /
`scoring.test.js` zijn met terugwerkende kracht gecorrigeerd (testgevallen
28–32 toegevoegd); huidige status: **32/32 groen**, geverifieerd.

## Brondocument

[`docs/multiplayer/GAME-RULES.md`](../../multiplayer/GAME-RULES.md), sectie
"Puntentelling":

```text
goed antwoord: 100 basispunten
snelheidsbonus: 0–100 punten
fout of niet geantwoord: 0 punten
maximaal: 200 punten per ronde

bonus = round(100 × clamp((endsAt - receivedAt) / questionDuration, 0, 1))
punten = correct ? 100 + bonus : 0

Wanneer snelheidspunten uitstaan: goed = 100, fout/geen antwoord = 0.
```

Plus de deadline-grace-regel:

```text
maximaal 250 ms
gelijk voor alle spelers
niet meetellen als extra snelheidsbonus
expliciet configureerbaar en getest
```

En, voor de tiebreak in een latere fase (GR2) alvast gevoed door dit werk: de
speler bewaart `correctResponseTimeMsTotal`.

## Ontwerpbeslissingen die deze versie toevoegt

Deze staan niet letterlijk in `GAME-RULES.md`, maar zijn nodig om de formule
ondubbelzinnig te implementeren. Ze zijn lokaal aan deze module — geen ADR nodig.

1. **Ongeldige configuratie werpt, in plaats van stil te clampen.**
   `deadlineGraceMs` buiten `0..250`, of niet-eindige tijdwaarden, geven een
   `RangeError`. Een verkeerd geconfigureerde room moet zichtbaar breken in
   tests en logs, niet stilzwijgend een andere grace toepassen dan de spec
   toestaat. (Reviewbevinding 1.)
2. **`scoreAnswer()` is de aanbevolen ingang voor servercode.** Die combineert
   acceptatie en score, zodat een te laat antwoord nooit basispunten kan
   krijgen — ook niet als een aanroeper per ongeluk `correct: true` doorgeeft
   voor een geweigerd antwoord. `isAnswerAcceptable()` en `computeScore()`
   blijven apart geëxporteerd voor gerichte unit tests, maar `computeScore()`
   documenteert een harde precondition: alleen aanroepen met een reeds
   geaccepteerd antwoord. (Reviewbevinding 2.)
3. **`correct: false` kortsluit vóór elke tijdberekening.** Een niet-beantwoorde
   ronde (`receivedAt` ontbreekt) geeft daardoor nooit een `NaN`-bonus.
   `correct: true` zonder eindige `receivedAt` is een aanroepersfout — die
   combinatie zou nooit mogen voorkomen — en werpt een `RangeError`.
   (Reviewbevinding 4.)
4. **`accumulateCorrectResponseTime` valideert zijn eigen invoer even streng
   als de rest van de module.** `currentTotalMs` moet altijd een eindig,
   niet-negatief getal zijn (ongeacht `correct`, zelfde volgorde-principe als
   de `endsAt`/`startsAt`-check in `computeScore`); `responseTimeMs` moet
   eindig en niet-negatief zijn wanneer `correct: true`. Dit voorkomt dat een
   corrupt of ontbrekend responstijdveld stilzwijgend
   `correctResponseTimeMsTotal` besmet — een veld waar GR2 (standings) direct op
   leunt voor een eerlijke tiebreak. (`REVIEW-GR2-GR3.md`, bevinding 5.)

## Te bouwen functies

Bestand: `server/rules/scoring.js` (of de door GR0 bevestigde locatie), plus
`server/rules/scoring.test.js` met `node:test` + `node:assert`.

```js
const MAX_DEADLINE_GRACE_MS = 250;

/**
 * Werpt RangeError als deadlineGraceMs geen eindig getal in [0, 250] is.
 * @param {number} deadlineGraceMs
 */
function assertValidGrace(deadlineGraceMs) {}

/**
 * Bepaalt of een antwoord nog geaccepteerd wordt. Werpt RangeError bij een
 * ongeldige deadlineGraceMs of niet-eindige receivedAt/endsAt.
 * @param {{ receivedAt: number, endsAt: number, deadlineGraceMs: number }} p
 * @returns {boolean}
 */
function isAnswerAcceptable({ receivedAt, endsAt, deadlineGraceMs }) {}

/**
 * Berekent bonus en punten. PRECONDITIE: alleen aanroepen met een antwoord
 * waarvoor isAnswerAcceptable() al true retourneerde — roep in servercode niet
 * rechtstreeks aan, gebruik scoreAnswer(). Werpt RangeError bij
 * endsAt <= startsAt, of bij correct=true zonder eindige receivedAt.
 * @param {{
 *   correct: boolean,
 *   receivedAt: number | undefined,
 *   startsAt: number,
 *   endsAt: number,
 *   speedBonusEnabled: boolean,
 * }} p
 * @returns {{ bonus: number, points: number }}
 */
function computeScore({ correct, receivedAt, startsAt, endsAt, speedBonusEnabled }) {}

/**
 * Aanbevolen ingang voor servercode: combineert acceptatie en score zodat een
 * te laat antwoord nooit basispunten kan opleveren, ongeacht wat de aanroeper
 * als `correct` doorgeeft.
 * @param {{
 *   correct: boolean,
 *   receivedAt: number,
 *   startsAt: number,
 *   endsAt: number,
 *   deadlineGraceMs: number,
 *   speedBonusEnabled: boolean,
 * }} p
 * @returns {{ accepted: boolean, bonus: number, points: number }}
 */
function scoreAnswer(p) {}

/**
 * Telt de responstijd van een correct antwoord op bij het lopende totaal.
 * Incorrecte of niet-gegeven antwoorden veranderen het totaal niet. Werpt
 * RangeError bij een niet-eindig/negatief currentTotalMs (altijd
 * gecontroleerd), of bij een niet-eindig/negatief responseTimeMs wanneer
 * correct=true.
 * @param {number} currentTotalMs
 * @param {{ correct: boolean, responseTimeMs: number }} answer
 * @returns {number}
 */
function accumulateCorrectResponseTime(currentTotalMs, answer) {}

module.exports = {
  isAnswerAcceptable,
  computeScore,
  scoreAnswer,
  accumulateCorrectResponseTime,
};
```

`questionDuration` uit de formule = `endsAt - startsAt`, berekend binnen
`computeScore()` — geen aparte parameter, om twee inconsistente bronnen voor
dezelfde waarde te voorkomen.

## Verplichte testgevallen

### Grace-validatie (`assertValidGrace` / `isAnswerAcceptable`)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `deadlineGraceMs = 0` | geldig, geen throw |
| 2 | `deadlineGraceMs = 250` | geldig, geen throw (bovengrens) |
| 3 | `deadlineGraceMs = 251` | `RangeError` |
| 4 | `deadlineGraceMs = -1` | `RangeError` |
| 5 | `deadlineGraceMs = NaN` | `RangeError` |

### Acceptatie (`isAnswerAcceptable`)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 6 | `receivedAt = endsAt`, grace = 0 | `true` |
| 7 | `receivedAt = endsAt + 100`, grace = 250 | `true` |
| 8 | `receivedAt = endsAt + 250`, grace = 250 (exact op grens) | `true` |
| 9 | `receivedAt = endsAt + 251`, grace = 250 | `false` |
| 10 | `receivedAt = endsAt + 300`, grace = 250 | `false` |

### Tijdvalidatie en kortsluiting (`computeScore`)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 11 | `endsAt = startsAt` | `RangeError` |
| 12 | `endsAt < startsAt` | `RangeError` |
| 13 | `correct = false`, `receivedAt` ontbreekt (niet beantwoord) | `{ bonus: 0, points: 0 }`, geen throw |
| 14 | `correct = false`, geldige `receivedAt` (fout antwoord) | `{ bonus: 0, points: 0 }` |
| 15 | `correct = true`, `receivedAt` ontbreekt | `RangeError` (aanroepersfout) |
| 16 | `correct = true`, `speedBonusEnabled = false` | exact `{ bonus: 0, points: 100 }` |
| 17 | `correct = false`, `speedBonusEnabled = false` | `{ bonus: 0, points: 0 }` |

### Bonusformule — vaste tabel, geen willekeur (`computeScore`, `correct = true`)

| # | `receivedAt` t.o.v. venster | Verwacht |
| --- | --- | --- |
| 18 | op `startsAt` (100% resterend) | `bonus = 100`, `points = 200` |
| 19 | 25% van de duur verstreken | `bonus = 75`, `points = 175` |
| 20 | 50% van de duur verstreken | `bonus = 50`, `points = 150` |
| 21 | 75% van de duur verstreken | `bonus = 25`, `points = 125` |
| 22 | op `endsAt` (0% resterend) | `bonus = 0`, `points = 100` |
| 23 | 50 ms vóór `startsAt` (klokdrift) | `bonus = 100`, `points = 200` (clamp naar boven) |

Elke rij in deze tabel dient ook als cap-bewijs: geen enkele `points`-waarde mag
`< 0` of `> 200` zijn. Dit vervangt de eerder voorgestelde willekeurige
combinaties (reviewbevinding 6) met een vaste, reproduceerbare tabel.

### Integratie (`scoreAnswer`)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 24 | Te laat (`receivedAt = endsAt + 300`, grace = 250) én `correct = true` | `{ accepted: false, bonus: 0, points: 0 }` — ondanks `correct: true` |
| 25 | Binnen grace (`receivedAt = endsAt + 100`, grace = 250), `correct = true` | `{ accepted: true, bonus: 0, points: 100 }` |
| 26 | Op tijd (`receivedAt = startsAt`), `correct = true` | `{ accepted: true, bonus: 100, points: 200 }` |

Test 24 is het directe bewijs dat reviewbevinding 2 is opgelost: acceptatie en
score kunnen niet meer uit elkaar lopen via het aanbevolen pad. Test 25 maakt
expliciet wat eerder impliciet was: grace behoudt basispunten maar geeft nooit
bonus (reviewbevinding 2, tweede deel).

### Accumulatie (`accumulateCorrectResponseTime`)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 27 | Afwisselend `correct: true` / `correct: false` door een reeks antwoorden | totaal stijgt alleen bij `correct: true`, blijft gelijk bij `correct: false` |

### Accumulatie — validatie (`accumulateCorrectResponseTime`), toegevoegd na `REVIEW-GR2-GR3.md`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 28 | `currentTotalMs = -1` | `RangeError` |
| 29 | `currentTotalMs = NaN` | `RangeError` |
| 30 | `correct = true`, `responseTimeMs = -1` | `RangeError` |
| 31 | `correct = true`, `responseTimeMs = NaN` | `RangeError` |
| 32 | `correct = false`, `responseTimeMs = NaN` | geen throw, totaal ongewijzigd (kortsluit vóór de `responseTimeMs`-check) |

## Niet in scope voor GR1

- Tiebreak-sortering (`standings`) — dat is GR2, hier alleen de bouwsteen
  (`correctResponseTimeMsTotal`) leveren.
- Spelvorm-specifieke correctheidsbepaling (was het antwoord zelf goed) — dat
  zijn de validators in GR3. `computeScore`/`scoreAnswer` nemen `correct: boolean`
  als gegeven aan, ze bepalen niet zelf of een antwoord inhoudelijk klopt.
- Opslag, idempotentie, `actionId`-afhandeling — dat is `DATA-MODEL.md` /
  `PROTOCOL.md`-terrein.
- Dat `deadlineGraceMs` voor alle spelers in een room gelijk is — dat is een
  configuratieverantwoordelijkheid van de aanroeper (één roomconfigwaarde,
  altijd doorgegeven aan elke aanroep), niet iets wat deze module zelf kan
  afdwingen of zinvol unit-testen (reviewbevinding 3). Deze module toetst alleen
  dat een gegeven waarde binnen `0..250` valt.

## Definition of done

- Alle 32 testgevallen hierboven staan als losse `node:test`-cases en slagen.
- `node --test 'server/rules/**/*.test.js'` is groen. (Niet
  `node --test server/rules/` — een directoryargument wordt op deze Node-versie
  niet als recursieve testdiscoveryroot behandeld en faalt met
  `MODULE_NOT_FOUND`; dit is bevestigd door de GR1-uitvoering zelf én door
  `REVIEW-GR2-GR3.md` bevinding 6/13.)
- Geen enkele functie raakt Redis, sockets, bestanden of de klok
  (`Date.now()` mag niet in deze module voorkomen — tijden komen altijd binnen
  als parameter).
- `isAnswerAcceptable` en `computeScore` blijven geëxporteerd voor unit tests,
  maar de exportregel documenteert in een code-comment dat servercode buiten
  deze module uitsluitend `scoreAnswer()` hoort aan te roepen.

**Status: uitgevoerd.** `server/rules/scoring.js` (153 regels) en
`server/rules/scoring.test.js` (254 regels na de aanvulling) bestaan, 32/32
tests groen, onafhankelijk geverifieerd. Geen dependencies toegevoegd.
