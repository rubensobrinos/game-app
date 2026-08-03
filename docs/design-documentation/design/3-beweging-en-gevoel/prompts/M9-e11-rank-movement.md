# Prompt — M9: E11, Rank movement (niveau 0 → 1)

Onderdeel van [`README.md`](README.md). Onafhankelijk van `M1`–`M5`, gebruikt
thema 2's tokens (geleverd, `8eb1996`) — inclusief `--ease-rank`, die
letterlijk voor dit moment is bedoeld (`06` §3: "rank movement:
spring-achtig maar beheerst").

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §4 E11: row beweegt gecontroleerd naar
nieuwe positie, `↑2`/`↓1` blijft tekstueel zichtbaar, eigen row krijgt korte
emphasis, geen complexe animatie bij 100+ deelnemers op hostscherm.
`11-DESIGN-QA-CHECKLIST.md` G: "Is rankbeweging tekstueel en visueel
aangegeven?" — al in `PROGRESS.md`'s Criteria-citatie (G stond er al).

## Belangrijke bevinding: er bestaat vandaag geen enkel begrip van "vorige positie"

**Geverifieerd, niet aangenomen:** `standings-model.mjs`'s `standingsFrom()`
berekent `position` puur uit de huidige payload-volgorde
(`index + 1`); er wordt nergens een vorige stand bewaard. In
`session-shell.mjs` wordt `standingsPayload` bij elke
`scoreboard:updated` gewoon overschreven (`standingsPayload =
envelope.payload`), zonder de oude waarde ergens te bewaren. Er is dus
letterlijk geen data om een `↑2`/`↓1` uit af te leiden — dit is geen
render-fix, dit vraagt een nieuw stukje state.

Ook geldt hier hetzelfde patroon als `M7`'s bevinding voor `lobby.mjs`:
`scoreboard.mjs`'s `update()` doet `list.textContent = ''` en herbouwt de
hele lijst bij elke aanroep. Voor rank-*beweging* (FLIP-stijl: meten waar
een rij ná de update staat t.o.v. vóór de update) is dat hier **geen
probleem** zoals bij `M7` — FLIP heeft geen persistente DOM-node nodig,
alleen een positie-meting vóór en ná, gekoppeld op `playerId`. Geen
node-reconciliatie nodig zoals bij `lobby.mjs`.

## Wat dit is

1. **Vorige stand bewaren**: `session-shell.mjs` houdt naast
   `standingsPayload` ook `previousStandingsEntries` bij (de `entries` van
   de vórige `standingsFrom()`-aanroep, per `playerId`), bijgewerkt ná elke
   render, vóór de volgende `scoreboard:updated` 'm overschrijft.
2. **Delta-berekening als pure functie** in `standings-model.mjs` (zelfde
   plek als `standingsFrom`/`podiumTop3`, getest in
   `standings-model.test.mjs`): een functie die huidige `entries` +
   vorige `entries` (per `playerId`) combineert tot entries met een
   `delta: number | null` (positief = omhoog, negatief = omlaag, `null` =
   nieuw/onbekend, geen delta tonen).
3. **Tekstuele weergave**: `↑2`/`↓1` (of gelokaliseerde variant, check
   `09-CONTENT-AND-MICROCOPY.md`) naast elke rij in `scoreboard.mjs` —
   **altijd zichtbaar, ongeacht reduced motion** (dit is tekst, geen
   motion, `06` §7 vraagt niet om tekst te verbergen).
4. **Visuele beweging (FLIP)**: vóór de lijst herbouwd wordt, meet de
   `boundingClientRect` van elke bestaande rij (op `playerId`); ná de
   herbouw, voor elke rij die zowel vóór als ná bestond: zet direct een
   `transform: translateY(<oude - nieuwe positie>)` zonder transitie, forceer
   een reflow, verwijder de transform mét een transitie
   (`--motion-emphasis`, `--ease-rank`) naar `translateY(0)`.
5. **Eigen rij-emphasis**: `.scoreboard-entry.is-self` krijgt een korte,
   losstaande nadruk (bv. een kort oplichtende rand/achtergrond via
   `--motion-emphasis`) bovenop de FLIP-beweging, niet in plaats daarvan.
6. **"Geen complexe animatie bij 100+ deelnemers"**: al automatisch gedekt
   — `scoreboard.mjs` toont sowieso alleen `entries.slice(0, 5)`
   (bestaande code), dus er is nooit meer dan 5 rijen om te animeren. Geen
   extra werk nodig, alleen vastleggen in `PROGRESS.md` dat dit punt al
   voldaan is.

## Reduced motion

`06` §7: "geen scale/spring/bewegende rankrows" — dit is letterlijk dít
moment met naam genoemd. Onder reduced motion: **geen FLIP-transform**,
rijen verschijnen direct op hun nieuwe positie; de tekstuele `↑2`/`↓1`
blijft gewoon staan (tekst is geen "beweging"). Dit is een striktere eis
dan `M0`'s blanket-regel alleen kan afdwingen (die verkort duur, maar de
FLIP-transform zelf moet hier expliciet worden overgeslagen in JS, niet
alleen CSS-matig verkort) — check `prefers-reduced-motion` ook
programmatisch (`window.matchMedia`) vóór de FLIP-stappen worden
uitgevoerd, net zoals `M2` dat voor de podium-opbouw al moet doen.

## Regels

- Delta-logica is een pure, testbare functie in `standings-model.mjs` —
  geen berekening verstopt in `scoreboard.mjs`'s DOM-code.
- FLIP-transform wordt in JS overgeslagen onder
  `matchMedia('(prefers-reduced-motion: reduce)').matches`, niet alleen aan
  CSS overgelaten.
- Geen wijziging aan `podium.mjs` — dat is `M10`.

## Definition of done

- Nieuwe pure functie in `standings-model.mjs`, getest in
  `standings-model.test.mjs`: gegeven vorige + huidige entries, correcte
  `delta`-waarden (inclusief `null` voor een speler die nieuw in de top 5
  komt).
- Handmatig/Playwright geverifieerd: bij een ranghersschikking bewegen de
  rijen zichtbaar naar hun nieuwe positie, `↑2`/`↓1` staat correct.
- CDP-geverifieerd onder reduced motion: geen FLIP-beweging, rijen direct
  op hun plek, delta-tekst blijft zichtbaar.
- `node --test`: nieuwe tests groen, geen regressie.
- `PROGRESS.md`: E11 van niveau 0 naar 1, met een aparte regel dat
  "geen complexe animatie bij 100+ deelnemers" al voldaan was vóór dit werk
  (door de bestaande `slice(0, 5)`).
