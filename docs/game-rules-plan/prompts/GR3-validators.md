# Prompt — GR3: Spelvormvalidators (Golf 1)

Onderdeel van [`docs/game-rules-plan/README.md`](../README.md), fase GR3.

**Bijgewerkt na [`REVIEW-GR2-GR3.md`](REVIEW-GR2-GR3.md).** Verwerkt bevindingen 7,
9, 10, 11, 12, 13 en 14 volledig. Bevinding 8 (de vijf `correctAnswer`-vormen)
is expliciet voorgelegd — de mens koos **wachten op bevestiging door het
protocol-team**, niet doorgaan op de aanname. Zie ontwerpbeslissing 2 en
[`HANDOFF.md`](../HANDOFF.md).

**Statuswaarschuwing:** de code hieronder is al gebouwd en getest (39/39 groen,
zie README) — dat is niet teruggedraaid, want dat zou het werk weggooien. Maar
behandel de vijf `correctAnswer`-vormen als **niet-definitief**. Bouw hier geen
verdere fases (GR4+) bovenop die deze exacte vorm aannemen totdat het
protocol-team bevestigt of corrigeert via `HANDOFF.md`.

Vereist dat GR1 is afgerond én geverifieerd (is het geval). Onafhankelijk van GR2.

## Brondocument

[`docs/multiplayer/GAME-RULES.md`](../../multiplayer/GAME-RULES.md), sectie
"Spelvormen", Golf 1 (types 1–5). De exacte `answer`-payloadvorm per spelvorm
komt niet uit `GAME-RULES.md` zelf maar uit
[`PROTOCOL.md`](../../multiplayer/PROTOCOL.md#roundanswer) (reviewbevinding
14) — het "juiste optie niet afleidbaar"-principe staat ook daar.

| Spelvorm | `gameType` | `answer`-vorm (bron: `PROTOCOL.md`) |
| --- | --- | --- |
| Vlaggen Quiz | `flags_mc` | `{ optionId: string }` |
| Hoofdsteden Quiz | `capitals_mc` | `{ optionId: string }` |
| Echt of Nep? — vlaggen | `real_or_fake_flag` | `{ choice: "real" \| "fake" }` |
| Hoger of Lager | `higher_lower` | `{ side: 0 \| 1 }` |
| Buitenbeentje | `odd_one_out` | `{ cardIndex: number }` |

## Ontwerpbeslissingen

1. **Twee categorieën input, twee foutstrategieën.** (Reviewbevinding 7.)
   - **Client-`answer`**: onvertrouwd. Elke waarde is toegestane invoer — ook
     `null`, een array, een primitive, of een object met verkeerde/extra
     velden. Malformed geeft altijd deterministisch
     `{ valid: false, correct: false }`, **nooit** een throw.
   - **Servercontext** (`correctAnswer`, `validOptionIds`, `optionCount`):
     vertrouwd maar moet intern consistent zijn. Een schending (bv.
     `correctAnswer.optionId` dat niet in `validOptionIds` voorkomt) betekent
     een kapotte ronde en werpt een `TypeError`/`RangeError`.
2. **De vijf `correctAnswer`-vormen zijn een INTERFACEVOORSTEL, GEBLOKKEERD
   op bevestiging.** (Reviewbevinding 8.) `DATA-MODEL.md` toont alleen één
   voorbeeld (`{ choice: "fake" }`); dat `correctAnswer` verder exact de
   `answer`-vorm spiegelt per type is een aanname van dit document, niet iets
   dat alle vijf typen normatief vastlegt. Expliciet voorgelegd — de mens koos
   **wachten op het protocol-team** (`server/protocol/`) in plaats van
   doorbouwen op de aanname. De code hieronder bestaat al (gebouwd vóór deze
   keuze) en wordt niet teruggedraaid, maar geldt vanaf nu als **voorstel ter
   bevestiging**, niet als vastgesteld contract. Zie
   [`HANDOFF.md`](../HANDOFF.md) voor de concrete vraag aan het protocol-team.
3. **`flags_mc` en `capitals_mc` delen één validator**, omdat `PROTOCOL.md`
   voor beide exact dezelfde `answer`-vorm beschrijft (niet omdat
   `GAME-RULES.md` dat expliciet zegt — zie brondocument hierboven).
4. **Servercontext-invarianten worden per mechanisme vooraf gevalideerd.**
   (Reviewbevinding 9.) Zonder die checks kan een kapotte ronde een geldige
   clientpayload ten onrechte als (on)geldig bestempelen. Concreet, voor Golf 1:
   `validOptionIds` moet exact 4 unieke, niet-lege strings bevatten die
   `correctAnswer.optionId` insluiten; `optionCount` voor Buitenbeentje moet
   exact 4 zijn (Golf-1-invariant — geen generieke N, zie brondocument) en
   `correctAnswer.cardIndex` moet binnen bereik liggen; `correctAnswer.choice`
   moet `"real"`/`"fake"` zijn; `correctAnswer.side` moet `0`/`1` zijn.
5. **Strikte objectvorm voor `answer`: precies één eigen, enumerable property
   met de verwachte naam.** (Reviewbevinding 10, gekozen beleid.) Extra
   velden (`{ optionId: "opt_1", role: "host" }`), ontbrekende velden, of een
   niet-plain-object (array, class-instance, primitive) maken de payload
   ongeldig. Dit geldt alleen voor `answer` (client, dus `{ valid: false }`,
   geen throw) — niet voor `correctAnswer` (server, strengere eis is daar een
   throw, zie ontwerpbeslissing 1).
6. **Onbekende `gameType` in de dispatcher werpt een `RangeError`.** Niet per
   se een bug in GR4 (reviewbevinding 14) — kan ook versie-/feature-gate-drift
   zijn tussen dispatcher en roomconfig (bv. een net uitgezette feature flag).
   In beide gevallen is stilzwijgend "incorrect" antwoorden het verkeerde
   gedrag; de aanroeper moet dit expliciet zien.
7. **Alleen `validateAnswer()` is publiek.** (Reviewbevinding 12.) Een
   codecomment is geen afdwingbare grens in CommonJS — de vier
   per-mechanisme-validators worden daarom niet geëxporteerd en alleen
   indirect getest via de dispatcher.

## Nadrukkelijk buiten scope

- **Hoger of Lager: de metriekvergelijking zelf** (welk land meer inwoners/
  oppervlakte/BBP heeft) — bepaalt welke `side` correct is bij het
  samenstellen van de ronde; hoort bij vraagselectie/contentmodule (GR4).
- **Golf 2 met juridische vrijgave-eis** — dit geldt specifiek voor logo-/
  clubcontent (Logo Quiz, Voetballogo's, Logo: Echt of Nep?), niet voor
  Typen-invoer, dat wel Golf 2 is maar geen juridische vrijgave nodig heeft
  (reviewbevinding 14, redactionele correctie). Beide zijn hoe dan ook buiten
  scope voor GR3 (Golf 1 only).
- **Het niet-afleidbaar-zijn van het correcte antwoord uit ID/volgorde/seed**
  — een eis aan hoe vraagselectie opties genereert (GR4), niet aan validatie.

## Te bouwen functies

Bestand: `server/rules/validators.js`, plus `server/rules/validators.test.js`
met `node:test` + `node:assert`. Alleen `validateAnswer` is geëxporteerd.

```js
/**
 * Interne helper. Retourneert answer[key] als answer een plain object is met
 * precies één eigen, enumerable property genaamd `key`; anders null. Gooit
 * nooit — answer is onvertrouwde clientinput.
 * @param {unknown} answer
 * @param {string} key
 * @returns {unknown | null}
 */
function extractClientField(answer, key) {}

/**
 * flags_mc + capitals_mc. `answer` gooit nooit. `correctAnswer`/
 * `validOptionIds` zijn servercontext: TypeError/RangeError als
 * validOptionIds geen 4 unieke niet-lege strings zijn, of als
 * correctAnswer.optionId er niet tussen staat.
 * @param {unknown} answer
 * @param {{ optionId: string }} correctAnswer
 * @param {string[]} validOptionIds
 * @returns {{ valid: boolean, correct: boolean }}
 */
function validateOptionChoice(answer, correctAnswer, validOptionIds) {}

/**
 * real_or_fake_flag. correctAnswer.choice buiten {"real","fake"} -> throw.
 * @param {unknown} answer
 * @param {{ choice: "real" | "fake" }} correctAnswer
 * @returns {{ valid: boolean, correct: boolean }}
 */
function validateBinaryChoice(answer, correctAnswer) {}

/**
 * higher_lower. correctAnswer.side buiten {0,1} -> throw.
 * @param {unknown} answer
 * @param {{ side: 0 | 1 }} correctAnswer
 * @returns {{ valid: boolean, correct: boolean }}
 */
function validateHigherLowerChoice(answer, correctAnswer) {}

/**
 * odd_one_out. optionCount !== 4 (Golf-1-invariant), of
 * correctAnswer.cardIndex buiten [0, optionCount) -> throw.
 * @param {unknown} answer
 * @param {{ cardIndex: number }} correctAnswer
 * @param {number} optionCount
 * @returns {{ valid: boolean, correct: boolean }}
 */
function validateOddOneOutChoice(answer, correctAnswer, optionCount) {}

/**
 * Enige publieke functie. Dispatcht naar de juiste validator op basis van
 * gameType. Werpt RangeError bij een onbekende/niet-Golf-1 gameType.
 * @param {"flags_mc"|"capitals_mc"|"real_or_fake_flag"|"higher_lower"|"odd_one_out"} gameType
 * @param {unknown} answer
 * @param {object} correctAnswer
 * @param {{ validOptionIds?: string[], optionCount?: number }} roundContext
 * @returns {{ valid: boolean, correct: boolean }}
 */
function validateAnswer(gameType, answer, correctAnswer, roundContext) {}

module.exports = { validateAnswer };
```

## Verplichte testgevallen

Elke rij verwacht het **volledige** object `{ valid: boolean, correct: boolean }`
(reviewbevinding 11) — nooit een losse assertie op alleen `correct` of alleen
`valid`.

### Malformed client-`answer` is altijd graceful, nooit een throw

Toon dit minstens één keer per mechanisme (4×), met minstens deze varianten:

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `answer = null` | `{ valid: false, correct: false }` |
| 2 | `answer` is een array | `{ valid: false, correct: false }` |
| 3 | `answer` is een primitive (string/number/boolean) | `{ valid: false, correct: false }` |
| 4 | `answer` heeft een extra property naast de verwachte | `{ valid: false, correct: false }` |
| 5 | `answer` mist de verwachte property | `{ valid: false, correct: false }` |

### `validateOptionChoice` (flags_mc + capitals_mc)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 6 | `optionId` gelijk aan `correctAnswer.optionId` | `{ valid: true, correct: true }` |
| 7 | `optionId` is een andere geldige optie | `{ valid: true, correct: false }` |
| 8 | `optionId` staat niet in `validOptionIds` | `{ valid: false, correct: false }` (client) |
| 9 | `validOptionIds` heeft geen 4 unieke niet-lege strings | throw (servercontext) |
| 10 | `correctAnswer.optionId` staat niet in `validOptionIds` | throw (servercontext, kapotte ronde) |

### `validateBinaryChoice`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 11 | `choice` gelijk aan `correctAnswer.choice` | `{ valid: true, correct: true }` |
| 12 | `choice` is de andere geldige waarde | `{ valid: true, correct: false }` |
| 13 | `choice` buiten `{"real","fake"}` | `{ valid: false, correct: false }` (client) |
| 14 | `correctAnswer.choice` buiten `{"real","fake"}` | throw (servercontext) |

### `validateHigherLowerChoice`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 15 | `side` gelijk aan `correctAnswer.side` | `{ valid: true, correct: true }` |
| 16 | `side` is de andere waarde uit `{0,1}` | `{ valid: true, correct: false }` |
| 17 | `side` buiten `{0,1}` of niet-integer | `{ valid: false, correct: false }` (client) |
| 18 | `correctAnswer.side` buiten `{0,1}` | throw (servercontext) |

### `validateOddOneOutChoice`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 19 | `cardIndex` gelijk aan `correctAnswer.cardIndex` | `{ valid: true, correct: true }` |
| 20 | `cardIndex` geldig maar niet juist | `{ valid: true, correct: false }` |
| 21 | `cardIndex` buiten bereik of niet-integer | `{ valid: false, correct: false }` (client) |
| 22 | `optionCount !== 4` | throw (servercontext) |
| 23 | `correctAnswer.cardIndex` buiten `[0, optionCount)` | throw (servercontext) |

### `validateAnswer` — dispatcher (enige geëxporteerde functie)

| # | Scenario | Verwacht |
| --- | --- | --- |
| 24 | Voor elk van de 5 `gameType`s: één correct, één incorrect-maar-geldig, en één malformed antwoord (tabelgedreven, 15 combinaties) | telkens het volledige, juiste `{ valid, correct }`-object — bewijst routering, niet alleen "ongeveer goed gedrag" |
| 25 | Onbekende of Golf 2-`gameType` (bv. `"typed_capitals"`) | `RangeError` |

## Definition of done

- Alle 25 testgevallen (inclusief de 15 combinaties binnen #24) slagen via
  `node --test 'server/rules/**/*.test.js'`. (Niet `node --test server/rules/`
  — zie `REVIEW-GR2-GR3.md` bevinding 13.)
- Alleen `validateAnswer` staat in `module.exports`; de vier
  per-mechanisme-functies zijn module-interne, niet-geëxporteerde helpers.
- Geen enkele functie raadpleegt content-data (`data/`), Redis, sockets of de
  klok.
**Status: code uitgevoerd en geverifieerd (39/39 groen), maar formeel
GEBLOKKEERD op ontwerpbeslissing 2.** Niet aanhaken aan een echte
ronde/protocolimplementatie, en geen latere fase op de vijf `correctAnswer`-
vormen laten bouwen, totdat `server/protocol/` (of wie dat contract
uiteindelijk vastlegt) reageert op [`HANDOFF.md`](../HANDOFF.md).
