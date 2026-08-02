# Prompt — PD4: Later-extensions registry

Onderdeel van [`docs/product-plan/README.md`](../README.md), fase PD4. Vereist dat
PD1 is afgerond (`EXCLUDED_FROM_MVP` bestaat, want deze fase verwijst ernaar via
`qualifies`). Doel: de "Latere uitbreidingen — niet launch-blocking"-lijst uit
`PRODUCT.md` omzetten in een `.mjs`-module met de volledige brontekst — zelfde
laagste-risicopatroon als PD1: één-op-één traceerbare representatie van bestaande
tekst, geen nieuwe interpretatie.

## Brondocument

[`docs/multiplayer/PRODUCT.md`](../../multiplayer/PRODUCT.md), sectie "Latere
uitbreidingen — niet launch-blocking" (8 items, volledige brontekst):

1. `generated_group_flag_or_badge`: "gegenereerde groepsvlag of groepsbadge"
2. `vote_on_generated_designs`: "stemmen op meerdere gegenereerde ontwerpen"
3. `save_and_reuse_flag_or_badge`: "vlag/badge bewaren en opnieuw gebruiken"
4. `branded_end_card`: "branded eindkaart"
5. `seasonal_or_event_formats`: "seizoens- of eventformats"
6. `multi_night_team_competitions`: "teamcompetities over meerdere avonden"
7. `optional_spectator_route`: "optionele spectator-route"
8. `paid_white_label_or_event_versions`: "betaalde white-label- of eventversies"

Tel dit na tegen de brontekst vóór je begint (8 items, niet 7 of 9) — bij PD1 was een
telfout de belangrijkste reviewbevinding.

Losse zin direct na de lijst, ook relevant: "De gegenereerde groepsvlag/badge is
expliciet een **extra feature**. De kern moet zonder die feature volledig
aantrekkelijk, deelbaar en commercieel testbaar zijn." — dit bevestigt item 1, voegt
geen nieuw item toe.

### `qualifies` — welke items een bestaande MVP-uitsluiting kwalificeren

Twee van de acht items relateren inhoudelijk aan een item uit
[`shared/product/mvp-scope-guard.mjs`](../../../shared/product/mvp-scope-guard.mjs)'s
`EXCLUDED_FROM_MVP` (PD1) — niet als tegenspraak, maar als een nadrukkelijk optionele,
latere variant van iets dat in de MVP zelf uitgesloten is:

- `optional_spectator_route` → kwalificeert `spectator_screen_required`
  ("spectator-scherm **als vereiste**" is uitgesloten; een niet-verplichte,
  optionele spectatorroute is precies het toegestane alternatief — `GAME-FLOW.md`
  §Spectatorroute bevestigt dit expliciet: "is niet nodig om te spelen").
- `paid_white_label_or_event_versions` → kwalificeert `payments_or_premium`
  ("betalingen of premium" is uitgesloten uit de MVP-kern; betaalde
  white-label/eventversies zijn expliciet een latere, niet-launch-blocking laag
  bovenop een gratis kern, geen onderdeel van de MVP-launch zelf).

De overige zes items (`vote_on_generated_designs`, `save_and_reuse_flag_or_badge`,
`branded_end_card`, `seasonal_or_event_formats`, `multi_night_team_competitions`,
`generated_group_flag_or_badge`) hebben geen tegenhanger in `EXCLUDED_FROM_MVP` en
krijgen dus `qualifies: null`. In het bijzonder: teams zijn in `GAME-RULES.md`/
`GAME-FLOW.md` een "fase 1.5"-onderwerp, maar staan niet letterlijk in de 12
MVP-uitsluitingen van PD1 — dus geen `qualifies`-link, ook al lijkt dat op het eerste
gezicht misschien voor de hand te liggen.

## Te bouwen

Bestand: `shared/product/later-extensions-registry.mjs` + `.test.mjs`.

```js
// later-extensions-registry.mjs
//
// "Latere uitbreidingen — niet launch-blocking" uit PRODUCT.md, letterlijk
// overgenomen. `qualifies` is optioneel en verwijst naar een EXCLUDED_FROM_MVP-id
// (mvp-scope-guard.mjs, PD1) wanneer dit item een MVP-uitsluiting bewust
// kwalificeert/versoepelt in plaats van ermee te botsen — bijvoorbeeld een
// optionele spectatorroute tegenover de MVP-uitsluiting "spectator-scherm als
// vereiste". Geen disjointness-check: inhoudelijke samenhang is hier het punt,
// geen tegenspraak.
export const LATER_EXTENSIONS = Object.freeze([
  { id: 'generated_group_flag_or_badge', text: 'gegenereerde groepsvlag of groepsbadge', qualifies: null },
  { id: 'vote_on_generated_designs', text: 'stemmen op meerdere gegenereerde ontwerpen', qualifies: null },
  { id: 'save_and_reuse_flag_or_badge', text: 'vlag/badge bewaren en opnieuw gebruiken', qualifies: null },
  { id: 'branded_end_card', text: 'branded eindkaart', qualifies: null },
  { id: 'seasonal_or_event_formats', text: 'seizoens- of eventformats', qualifies: null },
  { id: 'multi_night_team_competitions', text: 'teamcompetities over meerdere avonden', qualifies: null },
  { id: 'optional_spectator_route', text: 'optionele spectator-route', qualifies: 'spectator_screen_required' },
  { id: 'paid_white_label_or_event_versions', text: 'betaalde white-label- of eventversies', qualifies: 'payments_or_premium' },
]);
```

Referentiële-integriteitscheck (de enige geautomatiseerde cross-check met PD1, geen
disjointness):

```js
// binnen hetzelfde bestand, of als losse geëxporteerde functie — implementatiekeuze
// vrij, zolang de test hieronder maar aantoont dat elke ingevulde qualifies-waarde
// een bestaand EXCLUDED_FROM_MVP-id is (importeer daarvoor mvp-scope-guard.mjs)
```

## Verplichte testgevallen — `later-extensions-registry.test.mjs`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `LATER_EXTENSIONS.length` | `8` |
| 2 | `LATER_EXTENSIONS.map(i => i.id)` komt exact overeen met de 8 canonieke ID's hierboven, in die volgorde | pass |
| 3 | de `text` van elk item is exact gelijk aan de brontekst hierboven | pass |
| 4 | `optional_spectator_route.qualifies === 'spectator_screen_required'` | pass |
| 5 | `paid_white_label_or_event_versions.qualifies === 'payments_or_premium'` | pass |
| 6 | de overige 6 items hebben `qualifies === null` | pass |
| 7 | elke niet-`null` `qualifies`-waarde komt voor in `EXCLUDED_FROM_MVP.map(i => i.id)` uit `mvp-scope-guard.mjs` (referentiële integriteit, geïmporteerd, niet gedupliceerd) | pass |
| 8 | `LATER_EXTENSIONS` is bevroren: een mutatiepoging verandert de inhoud niet | pass, zelfde patroon als PD1/PD2 (`Object.freeze` + `assert.throws`/inhoud ongewijzigd) |

## Niet in scope

- Enforcement dat een later-uitbreiding-item niet per ongeluk toch in Golf 1/MVP-scope
  belandt — dat is aan de bouwer van de betreffende feature, dit is een registry, geen
  guard.
- Nieuwe `qualifies`-links bedenken die niet expliciet uit de brontekst of een ander
  brondocument (zoals hierboven bij `GAME-FLOW.md` §Spectatorroute) af te leiden zijn
  — dat zou een nieuwe interpretatie zijn, geen realisatie van een bestaand besluit.
- Teams als aparte, uitgebreide registry-entry (fase 1.5 heeft al eigen dekking in
  `GAME-RULES.md`/`GAME-FLOW.md`); hier staat alleen het letterlijke PRODUCT.md-item
  `multi_night_team_competitions`.

## Definition of done

- Alle 8 testgevallen slagen: `node --test shared/product/later-extensions-registry.test.mjs`.
- `node --test shared/product/hard-rules.test.mjs shared/product/mvp-scope-guard.test.mjs shared/product/quick-start-preset.test.mjs shared/product/later-extensions-registry.test.mjs`
  blijft volledig groen (bewijst dat niets uit PD1/PD2 is geraakt).
- Precies 2 bestanden aangeraakt (nieuw), ruim binnen de 15-bestanden-grens.
