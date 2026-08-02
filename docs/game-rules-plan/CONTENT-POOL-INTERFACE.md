# Content-pool interface — wat `question-selection.js` verwacht

**Aan:** de CT-agent (`docs/content-plan/prompts/CT1-shared-content-module.md`)
en integrators (INT-A). **Status: leidend contract** — `shared/content/`
bouwt hiernaar toe, niet andersom. Bron van waarheid is de daadwerkelijke
implementatie in [`server/rules/question-selection.js`](../../server/rules/question-selection.js)
(158/158 tests groen); bij verschil met dit document wint de code, en is dit
document dan verouderd.

## `ContentEntry`

```js
/**
 * @typedef {{
 *   iso2: string,
 *   difficulty: "easy" | "medium" | "hard" | "extreme",
 *   continent: string,
 *   name: { nl: string, en: string, es: string },
 *   capital: { nl: string, en: string, es: string } | null,
 *   population: number | null,
 *   area: number | null,
 *   gdp: number | null,
 * }} ContentEntry
 */
```

Eén pool = één platte array van deze entries, **alle drie de talen tegelijk
per entry** — geen aparte pool per taal. `buildMatchQuestionPlan()` neemt
`pool: ContentEntry[]` als parameter aan; er wordt niets uit `data/` of
elders zelf geladen.

## Per veld: exacte semantiek

| Veld | Nullable? | Leest `question-selection.js` dit? | Opmerking |
| --- | --- | --- | --- |
| `iso2` | nee | **Ja** — stabiele identiteit, `questionKey`-opbouw (bv. `flags:fr`), duplicaatdetectie | Moet uniek zijn over de hele pool — een dubbele `iso2` laat `buildMatchQuestionPlan()` een `RangeError` werpen. Geen hoofdlettereis in de code zelf, maar de bestaande `flags/`-assets zijn lowercase — gebruik dezelfde casing overal in de keten. |
| `difficulty` | nee | **Ja** — filtert de kandidatenpool per aanvraag | Moet **exact** `"easy"`, `"medium"`, `"hard"` of `"extreme"` zijn (hoofdlettergevoelig). Een andere waarde crasht niets — de entry wordt alleen stil onbereikbaar (matcht nooit een geldige `difficulty`-aanvraag). Zie de gotcha hieronder over `"normal"`. |
| `continent` | nee | **Ja** — groepering voor Vlaggen-afleiders (§"waar mogelijk zelfde continent") én voor Buitenbeentje (3-tegen-1) | Geen enum afgedwongen in de code — moet alleen consistent en betekenisvol partitioneren. De bestaande content gebruikt 6 waarden (zie tabel hieronder); gebruik dezelfde strings, anders raken de al-geteste continent-aannames (zie hieronder) hun geldigheid kwijt. |
| `name` | nee (object), strings binnenin verplicht | **Nee.** `question-selection.js` raakt dit veld niet aan. | Puur voor andere consumenten (rendering/i18n) — hoort in `ContentEntry` voor toekomstig gebruik, niet voor GR4's eigen selectielogica. |
| `capital` | ja | **Ja, maar alleen de aan/afwezigheid, nooit de inhoud** | Bepaalt capitals_mc-geschiktheid. **Zet altijd expliciet `capital: null`** voor een land zonder geldige hoofdstad in deze contentversie — laat de key niet gewoon weg. De code behandelt inmiddels een ontbrekende key hetzelfde als `null` (defensieve fix, zie hieronder), maar reken daar niet op: wees expliciet. |
| `population` / `area` / `gdp` | ja, elk apart | **Ja** — Hoger/Lager-paarvorming (`typeof x === 'number'` + ongelijkheidscheck) | `null` én een ontbrekende key worden hier wél gelijk behandeld (typeof-check, geen strikte `null`-vergelijking zoals bij `capital`). Geen bereikvalidatie — negatief of nul wordt niet apart geweigerd. |

## Gotcha 1 — `capital: null` vs. ontbrekende key

Oorspronkelijk gebruikte de code `capital !== null`, wat een **ontbrekende**
`capital`-key ten onrechte als "heeft een geldige hoofdstad" zou behandelen
(`undefined !== null` is `true` in JavaScript). Dit is inmiddels defensief
gefixt naar `capital != null` (dekt beide) — met een regressietest die
bewijst dat een land zonder de key nooit als capitals_mc-target of -afleider
verschijnt. **Bouw er desondanks niet op**: geef altijd expliciet `capital:
null` mee, dat is de bedoelde, leesbare vorm.

## Gotcha 2 — `"normal"` bestaat niet als content-tier

`DECISIONS.md` #35 en `DATA-MODEL.md`'s `GameConfiguration`-voorbeeld gebruiken
`"difficulty": "normal"` op roomniveau. De content kent dat niveau niet —
alleen `easy/medium/hard/extreme`. **Wie roomconfig naar een
`buildMatchQuestionPlan()`-aanroep vertaalt, moet `"normal"` zelf naar
`"medium"` mappen** (of een andere expliciete keuze); `question-selection.js`
doet dat niet en accepteert `"normal"` niet als geldige `difficulty`. Zie ook
[`HANDOFF.md`](HANDOFF.md) §4.

## Referentiecijfers uit de bestaande `data/`-content

Ter oriëntatie — geen harde eis, wel waar de huidige 26 testgevallen (met een
kleine handgeschreven fixture) hun aannames op baseren:

- 230 landen, sleutel `iso2`.
- Vier moeilijkheidsniveaus: `easy` (30), `medium` (66), `hard` (104),
  `extreme` (30).
- Zes continenten: Africa (58), Europe (52), Asia (50), North America (37),
  Oceania (19), South America (14).
- Continent × moeilijkheid is soms dun (bv. Oceanië: 1 land op `easy`) — elke
  moeilijkheidslaag heeft wel minstens één continent met ≥ 3 landen, dus een
  Buitenbeentje-ronde is altijd constructeerbaar per laag, met beperkte keuze
  in welk continent de meerderheid vormt.
- Hoofdstad-coverage: 230/230 (geen enkel land had `capital: null` nodig in
  de huidige dataset — de regel bestaat wel, wordt alleen niet geraakt).
- `gdp` heeft zware clustering (115 distincte waarden over 230 landen) — de
  "geen gelijke waarden"-regel bij Hoger/Lager wordt voor deze metriek dus
  regelmatig geraakt, niet een theoretisch randgeval.

## Wat `question-selection.js` NIET nodig heeft van de contentmodule

- **Vlagafbeeldingen zelf.** De client/asset-laag leest `flags/{iso2}.png`
  (bestaande conventie); GR4 geeft alleen `iso2` terug, nooit een pad of URL.
- **Vertaalde weergavenamen in de output.** `SelectedQuestion`-payloads
  verwijzen naar `iso2` (en `metric`/`side`/`cardIndex`), nooit naar een
  letterlijke naamstring. Wie dat rendert, haalt de naam zelf op via `iso2`.
- **Renderparameters voor Echt-of-Nep** worden niet door de pool geleverd —
  die komen van een apart geïnjecteerd `generateFlagSpec(seed)`, prioriteit 2
  in CT1 volgens de opdracht. Zie ontwerpbeslissing 2 in
  [`prompts/GR4-question-selection.md`](prompts/GR4-question-selection.md)
  voor het exacte contract (`(seed: string) => { pattern, palette, ...,
  rendererVersion }`, moet seed-deterministisch zijn — de bestaande
  singleplayer-`generateFakeParams()` is dat niet).

## Wat `question-selection.js` wél garandeert

- Geen mutatie van de meegegeven `pool`.
- Nooit `Math.random()`/`Date.now()` intern — willekeur en tijd komen altijd
  als parameter binnen, dus reproduceerbaar te testen aan integratorkant.
- `buildMatchQuestionPlan()` is de enige geëxporteerde functie. Zie
  [`prompts/GR4-question-selection.md`](prompts/GR4-question-selection.md)
  voor het volledige call-contract (`gameType`, `totalRounds`, `difficulty`,
  `metricMode`, `previousMatchQuestionKeys`, `random`, optioneel
  `generateFlagSpec`) en het per-spelvorm outputcontract
  (`publicQuestionPayload`/`correctAnswer`/`resultDetails`).

## Verificatie

[`server/rules/question-selection.test.js`](../../server/rules/question-selection.test.js)
bevat een kleine, handgeschreven pool-fixture (13 landen) die alle bovenstaande
velden correct gebruikt — bruikbaar als concreet, werkend voorbeeld bij het
bouwen van `shared/content/`.
