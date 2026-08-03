# Prompt — 08: Leaderboard + Podium (S15/S20)

Onderdeel van thema 1 ([`../PROGRESS.md`](../PROGRESS.md)). Horen inhoudelijk
bij elkaar: het podium is de laatste stand van de leaderboard plus
vervolgacties.

## Brondocument

[`../03-GAME-FLOW-AND-STATES.md`](../03-GAME-FLOW-AND-STATES.md) §4.5,
[`../04-SCREEN-SPECIFICATIONS.md`](../04-SCREEN-SPECIFICATIONS.md) S15, S20.

## S15 — Rankbeweging en tie-regel

**Rankbeweging (`↑2`/`↓1`/`—`):** bewaar in `session-shell.mjs` de vorige
`standingsFrom()`-uitkomst naast de huidige (niet alleen de ruwe
`standingsPayload` overschrijven), en bereken per `playerId` het
positieverschil. **Bouw dit één keer, gedeeld met
[`07-reveal-en-sociale-headline.md`](07-reveal-en-sociale-headline.md)'s
comeback-detectie** — beide hebben exact dezelfde vorige-versus-huidige-
standregen-vergelijking nodig. `views/standings-model.mjs` **bestaat al**
(`standingsFrom()`, `podiumTop3()`, vijf tests) — voeg de bewegingsfunctie
daaraan toe, in hetzelfde bestand en dezelfde teststijl, niet in een nieuw
bestand. Pure functie (invoer: vorige + huidige standings, uitvoer: beweging
per speler), niet in twee aparte, licht verschillende implementaties.

**Tie-regel:** `04` noemt dit expliciet een open productbesluit ("gedeelde
plaats of secundaire sortering wordt expliciet productbesluit"). Bouw geen
eigen aanname — als je gelijke scores tegenkomt tijdens het testen, meld het
als `HANDOFF`-item met een voorstel, kies niet stilzwijgend een tie-regel.

## S20 — Podium

1. **3→2→1-opbouw**: `podium.mjs` toont nu de volledige top 3 in één keer.
   `04` vraagt een korte, overslaanbare opbouw. Zonder motion-tokens (thema 3)
   is dit een reeks zichtbaarheidswissels met een korte vaste vertraging
   (`03` §6 noemt geen exacte duur voor het podium specifiek — kies iets in
   dezelfde orde als de andere reveal-stappen, 1–2s, en maak het
   overslaanbaar met een tik).
2. **`Deel uitslag`-actie**: privacyvriendelijke samenvatting (`03` §4.5) —
   waarschijnlijk tekst + `navigator.share`/klembord, zelfde patroon als
   `lobby.mjs`'s bestaande deelacties (`share-actions.mjs` hergebruiken, geen
   nieuwe deellogica verzinnen). Bepaal eerst wát er gedeeld wordt (eigen
   score? eindstand? game-link voor een revanche?) — dat staat nergens
   vastgelegd, dus expliciet kiezen en vastleggen.
3. **`Nieuw spel`-actie**: terug naar configuratie met relevante defaults
   (`03` §4.5) — onderscheiden van de bestaande `Revanche` (zelfde
   deelnemers/config, scores resetten). "Nieuw spel" impliceert een nieuwe
   room, dus terug naar `/` of naar
   [`09-S02-spel-aanpassen.md`](09-S02-spel-aanpassen.md) zodra die bestaat.
4. **Medaille-emoji zijn bewust placeholders (`D-015`).** Bouw hier geen
   eigen iconografie — dat is thema 2's territorium, en dat document is
   expliciet: "niet door een frontender op te lossen." Zorg alleen dat de
   3→2→1-opbouw en de nieuwe acties werken mét de huidige emoji. **De latere
   asset-swap is geen "pure CSS/asset-wijziging":** de medailles zitten als
   i18n-waarde in alle drie de locales (`podium.first`/`second`/`third`,
   opgehaald via `t(medals[index])` in `podium.mjs`), dus een echte swap raakt
   drie localebestanden plus de parity-test, niet alleen CSS. Dat een emoji
   als vertaalbare tekst gemodelleerd staat is op zichzelf al twijfelachtig
   (een medaille-emoji verandert niet per taal) — geen aanleiding om dat nu te
   herstructureren, maar wel om de aanname "pure CSS" hier niet door te geven.

## Regels

- Geen eigen tie-regel of deel-inhoud verzinnen zonder het als voorstel vast
  te leggen — dit zijn beide expliciet open besluiten.
- Rankbeweging en comeback-detectie: één gedeelde implementatie, niet twee.
- Geen `innerHTML`; nieuwe teksten in alle drie de locales.

## Definition of done

- Tegen `transport-mock.mjs` met minstens twee rondes: de tussenstand toont
  een bewegingsindicatie die klopt met de vorige ronde.
- Podium toont een korte, overslaanbare 3→2→1-opbouw, gevolgd door
  `Revanche`/`Nieuw spel`/`Deel uitslag`/`Afsluiten`.
- Tie-scenario (twee gelijke scores) is getest en het gedrag is vastgelegd —
  hetzij als bewust gekozen regel, hetzij als open `HANDOFF`-item.
- `../PROGRESS.md` bijgewerkt voor S15 en S20.
