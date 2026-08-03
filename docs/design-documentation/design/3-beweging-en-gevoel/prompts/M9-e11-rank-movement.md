# Prompt — M9: E11, Rank movement (niveau 1 → richting 2)

**Herschreven 3 aug 2026 — de oorspronkelijke versie is grotendeels
overbodig geworden.** Terwijl deze prompt nog klaarlag voor uitvoering,
bouwde thema 1 (`b547c8f`, prompt 08 — S15/S20) zelfstandig al het grootste
deel van `E11`: `rankMovementFrom()` (pure delta-functie,
`standings-model.mjs`), `previousStandings`-state (`session-shell.mjs`), en
de `↑2`/`↓1`-badge met kleur en volledige-zin-`aria-label` (`scoreboard.mjs`,
`standings.moveUp`/`moveDown` in de locales). Dat dekt "een 1 hier betekent
dat er íéts van feedback is" ruimschoots.

**Wat dit betekent voor mijn eerder gevlagde coördinatievraag:** thema 1
koos een compacte visuele badge (`↑2`) + een volledige-zin-`aria-label`
("2 plaatsen gestegen") — feitelijk al een hybride van "compacte notatie"
en "09's volledige-zin-stijl", zonder dat er ooit overleg over is geweest.
Werkt in de praktijk, dus **niet meer blokkerend** — geen aparte
coördinatiestap meer nodig vóór verder bouwen hier.

**Wat overblijft, en dat is dit hele werk nu:** de rijen springen nog
instant naar hun nieuwe positie (`scoreboard.mjs`'s `update()` doet
`list.textContent = ''` en herbouwt bij elke aanroep — geverifieerd,
ongewijzigd sinds eerdere check) — `06` §4 E11 vraagt ook om "row beweegt
gecontroleerd naar nieuwe positie", niet alleen de tekst/kleur-badge. Dat is
een FLIP-aanvulling, geen state/data-werk meer.

Onderdeel van [`README.md`](README.md). Onafhankelijk van `M1`–`M5`,
gebruikt thema 2's tokens — specifiek `--ease-rank`
(`06` §3: "rank movement: spring-achtig maar beheerst").

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §4 E11: row beweegt gecontroleerd naar
nieuwe positie (— dit stuk ontbreekt nog —), `↑2`/`↓1` blijft tekstueel
zichtbaar (— al gedaan door thema 1 —), eigen row krijgt korte emphasis
(— nog te doen —), geen complexe animatie bij 100+ deelnemers (— al
gedekt, zie onder).

## Wat dit is (het restant)

1. **FLIP-beweging**: vóór `scoreboard.mjs`'s `update()` de lijst herbouwt,
   meet de `boundingClientRect` van elke bestaande `<li>` (op `playerId`,
   niet op DOM-index — de volgorde kan wijzigen). Ná de herbouw: voor elke
   rij die zowel vóór als ná bestond, zet direct een
   `transform: translateY(<oud - nieuw>)` zonder transitie, forceer een
   reflow, verwijder de transform mét een transitie (`--motion-emphasis`,
   `--ease-rank`) naar `translateY(0)`.
2. **Eigen rij-emphasis**: `.scoreboard-entry.is-self` krijgt een korte,
   losstaande nadruk (bv. kort oplichtende rand/achtergrond,
   `--motion-emphasis`) bovenop de FLIP-beweging, niet in plaats daarvan.
3. **"Geen complexe animatie bij 100+ deelnemers"**: al automatisch gedekt
   — `scoreboard.mjs` toont sowieso alleen `entries.slice(0, 5)`. Vastleggen
   in `PROGRESS.md`, geen extra werk.

## Reduced motion

`06` §7: "geen scale/spring/bewegende rankrows" — dit moment met naam
genoemd. Onder reduced motion: **geen FLIP-transform**, rijen verschijnen
direct op hun nieuwe positie; de tekstuele `↑2`/`↓1`-badge (al gebouwd)
blijft gewoon staan. Check `window.matchMedia('(prefers-reduced-motion:
reduce)').matches` in JS vóór de FLIP-stappen — een CSS-duurverkorting
alleen is hier niet genoeg, de transform-berekening zelf moet worden
overgeslagen (zelfde discipline als `M10`'s podium-check).

## Regels

- Geen wijziging aan `rankMovementFrom()`, `previousStandings`, of de
  bestaande badge/`aria-label` — die zijn al klaar en correct.
- FLIP-logica puur in `scoreboard.mjs` (rendering), niet in
  `standings-model.mjs` (die blijft puur data/geen DOM).

## Definition of done

- Handmatig/Playwright geverifieerd: bij een ranghersschikking bewegen de
  rijen zichtbaar naar hun nieuwe positie.
- CDP-geverifieerd onder reduced motion: geen FLIP-beweging, rijen direct
  op hun plek, badge blijft zichtbaar.
- `node --test`: geen regressie op bestaande `rankMovementFrom`-tests.
- `PROGRESS.md`: E11 van niveau 1 (al bereikt door thema 1) naar niveau
  2-richting (volledige choreografie: beweging + emphasis + badge samen).
