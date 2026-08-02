# Prompt — GR4: Vraagselectie & rematch-exclusie

Onderdeel van [`docs/game-rules-plan/README.md`](../README.md), fase GR4.
Vereist dat GR0–GR3 zijn afgerond (is het geval).

**Volledig herzien na [`REVIEW-GR4.md`](REVIEW-GR4.md).** De vorige versie had
twee blockers (geen renderdata voor Echt-of-Nep, geen gedefinieerd
outputcontract) en zes verdere bevindingen; alle acht zijn verwerkt.

**Daarna nogmaals vereenvoudigd op expliciete instructie:** één match heeft
**één `gameType`**, geen mix. Wil een host een andere spelvorm, dan start die
een nieuwe game. Dit maakt de hele round-robin-/verdelingsvraag (het punt
waarvoor ik om bevestiging vroeg) overbodig in plaats van beantwoord — er is
nu niets meer te verdelen of te ordenen tussen spelvormen binnen één match.
Zie ontwerpbeslissing 9 voor wat dit concreet schrapt, en de kanttekening
onderaan "Nadrukkelijk buiten scope" over de spanning met `PRODUCT.md`'s eigen
preset-tekst.

## Brondocument

[`docs/multiplayer/GAME-RULES.md`](../../multiplayer/GAME-RULES.md), secties
"Vraagselectie" en "Spelvormen" (Golf 1, types 1–5) — ongewijzigd t.o.v. de
vorige versie.

## Onderzoek naar de bestaande content

Ongewijzigd: 230 landen, sleutel `iso2`, vier moeilijkheidsniveaus
(`easy/medium/hard/extreme`), `continent`/`population`/`area`/`gdp` in
`country-facts.js`, `gdp` met zware clustering, hoofdstad-coverage 230/230.

**Uit `REVIEW-GR4.md`:** de bestaande singleplayer-generator
`generateFakeParams()` gebruikt zelf `Math.random()` en is **niet
seed-deterministisch** — zie ontwerpbeslissing 2 en
[`HANDOFF.md`](../HANDOFF.md) punt 3b.

## Outputcontract (lost blocker 2 op)

`buildMatchQuestionPlan()` retourneert `SelectedQuestion[]`:

```js
/**
 * @typedef {{
 *   gameType: string,
 *   questionKey: string,
 *   publicQuestionPayload: object,   // veilig vóór het antwoorden, vorm per gameType hieronder
 *   correctAnswer: object,           // NOOIT vóór round:ended verzenden — vorm volgt het GR3/HANDOFF-voorstel, nog niet extern bevestigd
 *   validOptionIds?: string[],       // alleen flags_mc/capitals_mc, direct bruikbaar door GR3
 *   resultDetails?: object,          // NOOIT vóór round:ended verzenden — data die de uitslag nodig heeft maar die de vraag zelf zou verklappen
 * }} SelectedQuestion
 */
```

**Waarom `resultDetails` apart van `publicQuestionPayload` staat:** `GAME-RULES.md`
eist dat de uitslag van Hoger/Lager "beide waarden" toont en die van
Buitenbeentje "beide continenten" benoemt. Die van tevoren al in de vraag zelf
zetten verklapt het antwoord (bij Hoger/Lager triviaal). Alles in
`publicQuestionPayload` is veilig bij `round:started`; `correctAnswer` én
`resultDetails` volgen dezelfde regel als de rest van deze module — pas
beschikbaar na `round:ended` (`PROTOCOL.md` Basisregel 4).

### Per spelvorm

**`flags_mc` / `capitals_mc`:**
```js
publicQuestionPayload: { targetIso2: string, optionIso2s: string[4] }  // gerandomiseerde volgorde, incl. target
correctAnswer: { optionId: string }   // === targetIso2, zie ontwerpbeslissing 3
validOptionIds: string[]              // === optionIso2s
```

**`real_or_fake_flag`:**
```js
publicQuestionPayload:
  // real:
  { kind: 'real', iso2: string }
  // generated:
  { kind: 'generated', seed: string, rendererVersion: string, spec: object }  // spec/rendererVersion van geïnjecteerde generateFlagSpec()
correctAnswer: { choice: 'real' | 'fake' }
```

**`higher_lower`:**
```js
publicQuestionPayload: { metric: 'population'|'area'|'gdp', sides: [{ side: 0, iso2 }, { side: 1, iso2 }] }  // gerandomiseerde volgorde, GEEN waarden
correctAnswer: { side: 0 | 1 }
resultDetails: { values: [{ side: 0, value: number }, { side: 1, value: number }] }
```

**`odd_one_out`:**
```js
publicQuestionPayload: { cards: [{ cardIndex: 0, iso2 }, ..., { cardIndex: 3, iso2 }] }  // gerandomiseerde volgorde, GEEN continent-labels
correctAnswer: { cardIndex: number }
resultDetails: { majorityContinent: string, minorityContinent: string }
```

`ContentEntry` (herzien — `hasCapital: boolean` vervangen door de echte
hoofdstaddata):

```js
/**
 * @typedef {{
 *   iso2: string,
 *   difficulty: string,
 *   continent: string,
 *   name: { nl: string, en: string, es: string },
 *   capital: { nl: string, en: string, es: string } | null,  // null = geen geldige hoofdstad
 *   population: number | null,
 *   area: number | null,
 *   gdp: number | null,
 * }} ContentEntry
 */
```

## Ontwerpbeslissingen

1. **Geen `Math.random()` intern; elke `random`-call loopt via een
   gevalideerde wrapper.** `nextRandom(random)` werpt bij een niet-eindig
   getal of een waarde buiten `[0, 1)` — vangt het `NaN`/`Infinity`/`1`/
   negatief-randgeval op één plek af.
2. **`generateFlagSpec` wordt geïnjecteerd, niet zelf gebouwd of aangenomen.**
   Signatuur: `(seed: string) => { pattern, palette, ..., rendererVersion:
   string }`. Deze module test met een mock; de **echte,
   seed-deterministische implementatie bestaat nog niet** — hand-off, zie
   `HANDOFF.md` punt 3b.
3. **`iso2` is de `optionId` voor `flags_mc`/`capitals_mc`.** Geen aparte
   `opt_N`-indirectie — `PROTOCOL.md`'s eigen voorbeeld voor het binaire geval
   gebruikt ook al semantische ids. "Niet afleidbaar" wordt gewaarborgd door de
   **volgorde** te randomiseren, niet door de id's te versluieren.
4. **`questionKey` bevat de metriek voor Hoger/Lager.**
   `higher_lower:<metric>:<iso2a>-<iso2b>`, iso2's alfabetisch gesorteerd.
   Zelfde paar, andere metriek = andere vraag, dus andere key.
5. **Kandidaten eerst volledig en zuiver berekenen, dán pas willekeur
   toepassen — nooit "genereer-en-controleer-en-herhaal".** Voor
   `flags_mc`/`capitals_mc`/`higher_lower` is de kandidatenlijst goedkoop
   volledig op te bouwen; `random` kiest daarna alleen een index uit een
   al-geldige lijst. Voor `odd_one_out` is volledige opsomming van alle
   4-sets duur; daar geldt een **begrensde herhaling (max. 50 pogingen)** bij
   toevallige sleutelbotsing. Blijft de pool na 50 pogingen te dun, dan telt
   dat als "onvoldoende content" (ontwerpbeslissing 8), geen aparte foutmodus.
6. **Rematch-uitsluiting: eerst proberen mét uitsluiting, dan herproberen
   zonder.** Bouw eerst de kandidatenlijst met `previousMatchQuestionKeys`
   verwijderd; is die kleiner dan het benodigde aantal, bouw 'm opnieuw
   zónder die uitsluiting. Faalt dat ook, dan is de pool structureel te klein
   → `RangeError`. Werkt identiek voor landen, paren en (begrensd herhaalde)
   4-sets — geen aparte capaciteitsformule per mechanisme nodig.
7. **Echt/Nep 50/50 wordt per match gebalanceerd, niet per ronde opgegooid.**
   `buildMatchQuestionPlan` bepaalt éénmalig, voor het totale aantal rondes in
   déze match (bij `gameType: 'real_or_fake_flag'` is dat gewoon
   `totalRounds`), een verdeling die hooguit 1 verschilt, shuffelt de volgorde
   met dezelfde randombron, en geeft elke ronde een al-besliste `isReal:
   boolean` mee. `selectRealOrFakeFlagQuestion` gooit zelf geen munt meer.
8. **Onvoldoende content → altijd `RangeError`, nooit een stillere match.**
9. **Geen mix van spelvormen binnen één match — geschrapt op instructie, niet
   stilzwijgend of als GAME-RULES.md-eis.** `GAME-RULES.md` en `PRODUCT.md`
   beschrijven wél een mix als reguliere optie (de "Groepsbattle"-preset in
   `PRODUCT.md` noemt zelfs standaard 4 spelvormen samen). Voor nu is expliciet
   gekozen: `buildMatchQuestionPlan` neemt één `gameType: string` aan, niet een
   lijst; wil een host andere spelvormen spelen, dan start die een nieuwe game.
   Dit maakt de round-robin-/verdelingsvraag uit de vorige versie
   (ontwerpbeslissing 9 daar) overbodig — er is niets meer te ordenen tussen
   spelvormen. Zie de kanttekening bij "Nadrukkelijk buiten scope" hieronder.

## Nadrukkelijk buiten scope

- **Mixgames (meerdere spelvormen binnen één match).** Zie ontwerpbeslissing 9.
  **Kanttekening:** dit staat in spanning met `PRODUCT.md`'s eigen
  standaardpreset-tekst ("spelvormen: vlaggen, echt/nep, hoger/lager en
  buitenbeentje" als één preset). Niet nu opgelost of genegeerd — gewoon
  zichtbaar gemaakt, zodat het niet stil een mismatch wordt tussen wat
  `PRODUCT.md` beschrijft en wat GR4 bouwt.
- **Het laden/normaliseren van `data/`-bestanden naar `ContentEntry[]`** —
  `ARCHITECTURE.md` #6, nog niemands eigendom (`HANDOFF.md` punt 3a).
- **De daadwerkelijke, seed-deterministische implementatie van
  `generateFlagSpec`** — hand-off, `HANDOFF.md` punt 3b.
- **`contentVersion`/`rendererVersion` toekennen op roomniveau** —
  `DATA-MODEL.md` `Room.contentVersion`.
- **Vlag↔land-richtingvariant** ("landnaam → kies vlag") — alleen de
  standaardrichting (vlag → kies land) is gebouwd.
- **Golf 2** — ongewijzigd buiten scope.

## Te bouwen functies

Bestand: `server/rules/question-selection.js`, plus
`server/rules/question-selection.test.js`.

```js
function nextRandom(random) {}                       // gevalideerde random()-wrapper
function pickUniqueIndices(random, length, count) {}  // begrensd, geen herhaling

function buildCandidatePool(pool, difficulty, requireCapital) {}
function buildHigherLowerCandidatePairs(pool, difficulty, metric) {}  // volledige, gefilterde paarlijst

function selectFlagsMcQuestion(pool, difficulty, excludedKeys, random) {}
function selectCapitalsMcQuestion(pool, difficulty, excludedKeys, random) {}
function selectRealOrFakeFlagQuestion(pool, difficulty, isReal, excludedKeys, random, generateFlagSpec) {}
function selectHigherLowerQuestion(pool, difficulty, metric, excludedKeys, random) {}
function selectOddOneOutQuestion(pool, difficulty, excludedKeys, random) {}

function buildRealOrFakeAssignment(count, random) {}  // boolean[], hooguit 1 verschil, geshuffled

/**
 * @param {{
 *   pool: ContentEntry[], gameType: string, totalRounds: number,
 *   difficulty: string, metricMode: string,
 *   previousMatchQuestionKeys: string[], random: () => number,
 *   generateFlagSpec?: (seed: string) => object,
 * }} params
 * @returns {SelectedQuestion[]}
 */
function buildMatchQuestionPlan(params) {}

module.exports = { buildMatchQuestionPlan };
```

Alleen `buildMatchQuestionPlan` is publiek; de rest zijn interne bouwstenen.

## Verplichte testgevallen

Kleine handgeschreven fixture-pool (10–15 landen, ≥ 2 continenten,
≥ 2 moeilijkheden, ≥ 1 `gdp`-gelijkstand, ≥ 1 land met `capital: null`).

### Inputvalidatie

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `gameType` ontbreekt of is onbekend | `RangeError` |
| 2 | `totalRounds <= 0` of niet-integer | `RangeError` |
| 3 | Onbekende `difficulty` | `RangeError` |
| 4 | Onbekende `metricMode` | `RangeError` |
| 5 | Twee entries met hetzelfde `iso2` in `pool` | `RangeError` |
| 6 | `random()` retourneert `1`, een negatief getal, `NaN` of `Infinity` | `RangeError` (via `nextRandom`) |

### Outputcontract per spelvorm

| # | Scenario | Verwacht |
| --- | --- | --- |
| 7 | `flags_mc`-resultaat | `publicQuestionPayload.optionIso2s` bevat exact 4 unieke iso2's incl. target; `correctAnswer.optionId === targetIso2`; `validOptionIds` === die 4 |
| 8 | `capitals_mc` met een land met `capital: null` in de pool | dat land nooit als target of afleider |
| 9 | `real_or_fake_flag`, generated-tak | `publicQuestionPayload` bevat `seed`, `rendererVersion`, `spec` — alle drie afkomstig van de geïnjecteerde `generateFlagSpec` |
| 10 | `higher_lower`-resultaat | `publicQuestionPayload.sides` bevat GEEN `value`-veld; `resultDetails.values` wel, voor beide `side`s |
| 11 | `odd_one_out`-resultaat | `publicQuestionPayload.cards` bevat GEEN continent-label; `resultDetails` wel, voor meerderheids- én minderheidscontinent |
| 12 | `questionKey` voor `higher_lower` | bevat de metriek; zelfde paar + andere metriek ⇒ andere key |

### Echt/Nep-balancering

| # | Scenario | Verwacht |
| --- | --- | --- |
| 13 | `gameType: 'real_or_fake_flag'`, `totalRounds: 6` | exact 3 `real` + 3 `generated` |
| 14 | `totalRounds: 5` | 3/2 of 2/3 — nooit 5/0, 0/5 |
| 15 | Vaste mock-`random` die bij een onafhankelijke per-ronde opgooi altijd `real` zou geven | balancering corrigeert dit alsnog naar hooguit 1 verschil |

### Afleider-fallback

| # | Scenario | Verwacht |
| --- | --- | --- |
| 16 | Doelcontinent heeft < 3 andere landen op de moeilijkheid, rest van de pool vult aan tot 3 | 3 unieke afleiders, geen throw |
| 17 | Volledige pool op die moeilijkheid heeft < 4 landen totaal | `RangeError`, apart getest voor `flags_mc` én `capitals_mc` |

### Rematch-exclusie met fallback

| # | Scenario | Verwacht |
| --- | --- | --- |
| 18 | `previousMatchQuestionKeys` sluit bijna de hele pool uit, ruim genoeg over | uitsluiting blijft actief, geen herhaalde keys |
| 19 | `previousMatchQuestionKeys` sluit zoveel uit dat er te weinig overblijft | uitsluiting vervalt, match wordt toch volledig gevuld |
| 20 | Zelfde patroon voor `odd_one_out` (begrensde herhaling i.p.v. volledige opsomming) | zelfde gedrag: fallback ná onvoldoende kandidaten binnen de pogingslimiet |

### Geen dubbele vraag binnen de match

| # | Scenario | Verwacht |
| --- | --- | --- |
| 21 | Genoeg pool | alle `questionKey`'s uniek |
| 22 | Pool net genoeg voor het gevraagde aantal unieke vragen | slaagt, geen herhaling |
| 23 | Pool te klein | `RangeError` |

### Immutability en volledig determinisme

| # | Scenario | Verwacht |
| --- | --- | --- |
| 24 | `pool`/`previousMatchQuestionKeys`-arrays en hun entries na aanroep | ongewijzigd |
| 25 | Twee aanroepen, identieke input + identieke (teller-gebaseerde) mock-`random`-reeks | byte-voor-byte identiek volledig plan, inclusief optie-/kaartvolgorde |
| 26 | `gameType` is één van de vijf Golf 1-types, alle geretourneerde rondes | hebben exact dat ene `gameType` — geen mengeling |

## Definition of done

- Alle 26 testgevallen slagen via `node --test 'server/rules/**/*.test.js'`.
- Geen enkele functie raadpleegt `data/`, Redis, sockets, de klok, of roept
  `Math.random()`/`Date.now()` intern aan.
- Alleen `buildMatchQuestionPlan` staat in `module.exports`.
- Geen onbegrensde retry-/while-lus — de enige begrensde herhaling is
  `odd_one_out`'s botsingscontrole (max. 50 pogingen).
- Geen verdelings-/ordeningslogica tussen spelvormen (ontwerpbeslissing 9) —
  dat hoeft niet meer bevestigd te worden, het is geschrapt.
