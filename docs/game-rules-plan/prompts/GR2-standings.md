# Prompt — GR2: Standings

> **Verhuisd + bevestigd (5 aug 2026, PLAN-CONVERGENTIE §A3).** De
> implementatie staat niet meer in `server/rules/standings.js` maar in
> `shared/rules/ranking.mjs` — ESM, zodat ook de browserkant (de mocktransport)
> dezelfde functie gebruikt in plaats van een eigen sortering. De
> competitierangschikking is door de producteigenaar bevestigd als spelregel;
> `scoreboard:updated`, de reconnect-snapshot en `game:finished` dragen sindsdien
> allemaal dezelfde waarde.


Onderdeel van [`docs/game-rules-plan/README.md`](../README.md), fase GR2.

**Bijgewerkt na [`REVIEW-GR2-GR3.md`](REVIEW-GR2-GR3.md).** Verwerkt bevindingen
2, 3, 4 en 6 volledig. Bevinding 5 (GR1-afhankelijkheid) is gesloten:
`accumulateCorrectResponseTime` valideert nu zelf (zie `GR1-scoring.md`), 32/32
tests groen. Bevinding 1 (competitierangschikking) is expliciet voorgelegd en
**bevestigd** — zie ontwerpbeslissing 1. De foutafhandeling bij een throw
tijdens een live game (genoemd onder "buiten scope") heeft nu ook een
aanbevolen beleid, als hand-off richting `server/architecture/` — zie
[`HANDOFF.md`](../HANDOFF.md).

Vereist dat GR1 is afgerond én geverifieerd (is het geval).

## Brondocument

[`docs/multiplayer/GAME-RULES.md`](../../multiplayer/GAME-RULES.md), sectie
"Gelijke eindscore":

```text
Volgorde:
1. hoogste totaalscore;
2. meeste correcte antwoorden;
3. laagste totale responstijd over correcte antwoorden;
4. gedeelde positie.

Daarom bewaart de speler correctResponseTimeMsTotal, niet alleen het tijdstip
van het laatste juiste antwoord.
```

Relevante velden uit
[`DATA-MODEL.md`](../../multiplayer/DATA-MODEL.md#player), Player:
`score`, `correctCount`, `correctResponseTimeMsTotal`.

## Ontwerpbeslissingen

1. **Competitierangschikking (`1,1,3,4`) — BEVESTIGD.** `REVIEW-GR2-GR3.md`
   bevinding 1 merkte terecht op dat dit zichtbaar productgedrag is (verschijnt
   in snapshots/UI), geen intern sorteerdetail. Expliciet voorgelegd; mens heeft
   competitierangschikking gekozen boven dense ranking (`1,1,2,3`). Geen open
   punt meer.
2. **Score, `correctCount` en `correctResponseTimeMsTotal` moeten
   niet-negatieve integers zijn.** `REVIEW-GR2-GR3.md` bevinding 3 liet dit
   bewust open ("de huidige modellen suggereren dat wel"). Dit document
   beslist: ja, integer. `GR1-scoring.md`s `computeScore()` produceert altijd
   `Math.round(...)`-gebaseerde gehele punten, en `correctResponseTimeMsTotal`
   is een som van epoch-ms-verschillen — beide horen dus altijd geheel en
   niet-negatief te zijn. Een fractie of negatief getal wijst op datacorruptie
   stroomopwaarts en moet zichtbaar breken, niet stil een ranglijst vormen.
3. **Ranggelijkheid (`position`) en lijstvolgorde zijn losgekoppeld.**
   `compareForRanking() === 0` betekent "gedeelde positie", niet "willekeurige
   volgorde is prima documentatie-technisch, maar wel reproduceerbaar nodig".
   `rankPlayers()` gebruikt `id` (oplopend, string-vergelijking) als pure
   presentatie-tiebreak ná de drie spelregelvelden. Die `id`-volgorde wijst
   geen winnaar aan en heft de gedeelde `position` niet op — twee spelers met
   dezelfde `position` blijven gelijk, ongeacht hun volgorde in de array.
4. **Validatie gebeurt twee keer, bewust.** `compareForRanking()` blijft zelf
   fail-loud voor los gebruik (roept `assertValidPlayerForRanking` op beide
   argumenten aan). `rankPlayers()` valideert daarnaast de **hele lijst** één
   keer vóór `sort()` (`assertValidPlayerList`), zodat een ongeldig record
   altijd deterministisch breekt — niet afhankelijk van welke paren de
   sorteeralgoritme toevallig vergelijkt. (Reviewbevinding 4.)

## Nadrukkelijk buiten scope

- **"Top 5" selecteren voor de client**, en hoe grenswaarde-gelijkspel bij
  plek 5 wordt afgekapt — `public_api`-beslissing (`PROTOCOL.md`, ADR-plichtig).
  Deze module levert de volledige gerangschikte lijst.
- **Wat te doen als `rankPlayers()` gooit tijdens een live game** — deze module
  blijft zelf fail-loud (pure functie, geen logging/fallback-logica hier). Het
  **beleid** is inmiddels wel bepaald: fail-soft richting spelers (opvangen,
  terugvallen op de laatst bekende geldige stand), fail-loud richting
  monitoring/logs (hard alarmeren, niet stil negeren). Implementatie daarvan
  hoort bij wie de state machine/broadcast-laag bouwt — zie
  [`HANDOFF.md`](../HANDOFF.md).
- **Het optellen van rondepunten bij `Player.score`** — triviale optelling bij
  de aanroeper, geen functie hier nodig.

## Te bouwen functies

Bestand: `server/rules/standings.js`, plus `server/rules/standings.test.js` met
`node:test` + `node:assert`.

```js
/**
 * Werpt TypeError/RangeError als player niet voldoet aan: id is een
 * niet-lege string; score, correctCount en correctResponseTimeMsTotal zijn
 * niet-negatieve integers.
 * @param {object} player
 */
function assertValidPlayerForRanking(player) {}

/**
 * Valideert een hele lijst in één keer, vóór sortering: elk record via
 * assertValidPlayerForRanking, plus uniciteit van id over de lijst. Werpt bij
 * de eerste schending.
 * @param {Array<object>} players
 */
function assertValidPlayerList(players) {}

/**
 * Vergelijkt twee spelers voor ranking (score desc, correctCount desc,
 * correctResponseTimeMsTotal asc). 0 bij volledige gelijkstand — bepaalt GEEN
 * lijstvolgorde, zie rankPlayers() voor de presentatie-tiebreak op id.
 * Werpt via assertValidPlayerForRanking bij een ongeldig record.
 * @param {{ id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number }} a
 * @param {{ id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number }} b
 * @returns {number}
 */
function compareForRanking(a, b) {}

/**
 * Sorteert spelers en kent een 1-indexed `position` toe volgens
 * competitierangschikking (bevestigd, zie ontwerpbeslissing 1). Gelijke
 * spelers delen `position`; hun onderlinge volgorde in de teruggegeven array
 * is deterministisch via `id` oplopend (presentatie, geen ranginformatie).
 * Valideert de volledige lijst vóór sortering. Muteert `players` niet.
 * @param {Array<{ id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number }>} players
 * @returns {Array<{ id: string, score: number, correctCount: number, correctResponseTimeMsTotal: number, position: number }>}
 */
function rankPlayers(players) {}

module.exports = { compareForRanking, rankPlayers };
```

`assertValidPlayerForRanking` en `assertValidPlayerList` blijven intern
(niet in `module.exports`) — alleen de twee functies die iets doen naast
valideren zijn publiek.

## Verplichte testgevallen

### Validatie van één record (indirect via `compareForRanking`)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `score = -1` | throw |
| 2 | `score = 10.5` (niet-integer) | throw |
| 3 | `correctCount = -1` | throw |
| 4 | `correctCount = 2.5` | throw |
| 5 | `correctResponseTimeMsTotal = -1` | throw |
| 6 | `correctResponseTimeMsTotal = 10.5` | throw |
| 7 | `id = ""` | throw |
| 8 | `id` ontbreekt of is geen string | throw |
| 9 | Alle velden geldig | geen throw |

### `compareForRanking` — volgorde

| # | Scenario | Verwacht |
| --- | --- | --- |
| 10 | Verschillende score | hogere score wint |
| 11 | Gelijke score, verschillende `correctCount` | hogere `correctCount` wint |
| 12 | Gelijke score en `correctCount`, verschillende responstijd | lagere `correctResponseTimeMsTotal` wint |
| 13 | Alle drie gelijk | `0` |

### `rankPlayers` — validatie van de hele lijst vóór sortering

| # | Scenario | Verwacht |
| --- | --- | --- |
| 14 | Twee spelers met dezelfde `id` | throw, vóór enige output |
| 15 | Eén ongeldig record ergens middenin een verder geldige lijst van 10 | throw, ongeacht positie (bewijs: niet sorteeralgoritme-afhankelijk) |

### `rankPlayers` — positienummering (competition ranking, bevestigd)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 16 | 4 spelers, elk strikt verschillend | posities `1,2,3,4` |
| 17 | Twee gelijk op de kop, twee eronder verschillend | posities `1,1,3,4` (niet `1,1,2,3`) |
| 18 | Drievoudige gelijkstand op de kop, één eronder | posities `1,1,1,4` |
| 19 | Eén speler | `position: 1` |
| 20 | Lege lijst | `[]`, geen throw |

### `rankPlayers` — deterministische presentatievolgorde bij gedeelde positie

| # | Scenario | Verwacht |
| --- | --- | --- |
| 21 | Twee volledig gelijke spelers, verschillende `id`; twee aanroepen met dezelfde input | zelfde `position` voor beiden; lijstvolgorde bepaald door `id` oplopend; identiek resultaat bij herhaling |

### `rankPlayers` — overig

| # | Scenario | Verwacht |
| --- | --- | --- |
| 22 | Input-array en -objects na aanroep | ongewijzigd; resultaat is een nieuwe array/nieuwe objects |
| 23 | Gemengde dataset: 5 spelers, tiebreak nodig op minstens 2 velden, plus één volledige gelijkstand ergens in het midden | exacte eindvolgorde + posities kloppen end-to-end |

## Definition of done

- Alle 23 testgevallen slagen via
  `node --test 'server/rules/**/*.test.js'`. (Niet `node --test server/rules/`
  — directoryargumenten falen op deze Node-versie, zie `REVIEW-GR2-GR3.md`
  bevinding 6.)
- Geen mutatie van input, geen `Date.now()`, geen afhankelijkheid van Redis,
  sockets of het volledige `Player`-schema uit `DATA-MODEL.md`.

**Status: uitgevoerd, geverifieerd, en beide openstaande punten gesloten.**
Competitierangschikking is bevestigd (ontwerpbeslissing 1); het foutbeleid bij
een throw is bepaald en overgedragen aan `server/architecture/` via
[`HANDOFF.md`](../HANDOFF.md). Niets blokkeert nog het aanhaken van deze module
aan een echte state machine, behalve dat die state machine zelf nog gebouwd
moet worden.
