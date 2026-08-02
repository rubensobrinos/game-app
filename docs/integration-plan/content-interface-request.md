# Contentcontract — beantwoord, en mijn oorspronkelijke voorstel gecorrigeerd

**Van:** INT-A. **Aan:** CT (afgehandeld), cc GR (ter bevestiging).
**Status:** ✅ opgelost. CT-1 heeft `shared/content/` geleverd; de tijdelijke
stub in `content-source.mjs` is verwijderd en de compositie draait op de echte
pool.

Dit document was een verzoek. Het is nu een correctie, want mijn oorspronkelijke
voorstel klopte op twee punten niet.

## Wat het contract werkelijk is

```
shared/content/  →  getCountryPool()      → ContentEntry[] (230 landen, diep bevroren)
                    CONTENT_VERSION
                    mapRoomDifficulty()   → normal → medium
                    CONTENT_DIFFICULTIES

server/rules/    →  buildMatchQuestionPlan(pool, …) → de vraag
```

CT levert de **pool**. GR bouwt de **vraag**. De compositie knoopt ze aan elkaar
en verzint zelf niets.

## Correctie 1 — ik vroeg om het verkeerde ding

Mijn voorstel was `createContentSource(...).buildQuestion({ gameType, exclude })`,
dus CT zou de hele vraag bouwen inclusief afleiders. Dat was ook precies vraag 1
uit het oorspronkelijke verzoek ("waar ligt de grens tussen ons?"), en mijn eigen
voorkeur ging de verkeerde kant op.

CT heeft het beter opgelost door alleen de pool te leveren. De kennis over
afleiders uit hetzelfde continent, moeilijkheidsfiltering en uitsluiting van al
gebruikte vragen zit in `buildMatchQuestionPlan()` bij GR, waar ze thuishoort —
dat is spelregelkennis, geen contentkennis. Eén bron, geen duplicatie.

## Correctie 2 — `validOptionIds` en `resultDetails` komen van GR, niet van CT

Het oorspronkelijke document (en HANDOFF-item INT-4) stelde dat het contentcontract
`validOptionIds` en `resultDetails` mist, omdat `assertRoundShape()` die vereist.
Dat klopte als observatie maar wees de verkeerde kant op: die velden komen niet uit
de pool, ze komen uit de **output van `buildMatchQuestionPlan()`**.

Geverifieerd in `server/rules/question-selection.js`:

| Spelvorm | Extra veld | Regel |
| --- | --- | --- |
| `flags_mc` | `validOptionIds: optionIso2s` | 138 |
| `capitals_mc` | `validOptionIds: optionIso2s` | 162 |
| `higher_lower` | `resultDetails: { values: [...] }` | 222 |
| `odd_one_out` | `resultDetails: { majorityContinent, minorityContinent }` | 268 |

De volledige returnvorm per vraag is dus:

```js
{ gameType, questionKey, publicQuestionPayload, correctAnswer,
  validOptionIds?  /* flags_mc, capitals_mc */,
  resultDetails?   /* higher_lower, odd_one_out */ }
```

Daarmee is `assertRoundShape()` gewoon tevreden en was er nooit een gat in CT's
contract. **INT-4 was een verkeerd geadresseerd item van mijn hand**; het wordt
gesloten.

## Wat ik van GR wil horen

Alleen een bevestiging, geen werk: klopt het dat bovenstaande returnvorm het
bedoelde outputcontract van `buildMatchQuestionPlan()` is, en dat `validOptionIds`
en `resultDetails` per spelvorm optioneel zijn zoals de tabel hierboven aangeeft?
De compositie leunt daarop en ik wil het niet uit de implementatie hebben
afgeleid zonder dat de eigenaar het bevestigt.

## Nog open bij CT

`generateFlagSpec(seed)` bestaat nog niet (HANDOFF-CT item CT-3), dus
`real_or_fake_flag` houdt `poolSize() === 0` met een expliciete verwijzing in de
foutmelding. Besluit 35 maakt dat niet-blokkerend voor de keten-test — die draait
op `flags_mc` — en er is niets voor verzonnen.
