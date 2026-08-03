# Prompt — M8: E07, Laatste drie seconden (niveau 0 → 1)

Onderdeel van [`README.md`](README.md). Onafhankelijk van `M1`–`M5`, gebruikt
thema 2's tokens (geleverd, `8eb1996`). Raakt hetzelfde bestand als `M2`
(`gameplay.mjs`) maar een ander moment — geen inhoudelijke overlap.

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §4 E07: timercontrast neemt toe, progress
pulseert of ticktempo stijgt subtiel, geen volledige schermflits, geen
alarmgeluid tenzij expliciet gekozen.
`11-DESIGN-QA-CHECKLIST.md` F: "Is de timer rustig tijdens de normale fase?",
"Neemt urgentie pas in de laatste seconden toe?" — al in `PROGRESS.md`'s
Criteria-citatie (F stond er al).

## Huidige staat (geverifieerd in `gameplay.mjs`)

```js
timer.textContent = secondsLeft === null ? '' : String(Math.max(0, secondsLeft));
```

`.gameplay-timer` is platte tekst zonder enige urgentie-stijl, ongeacht
`secondsLeft`. Er ís geen zichtbare progressbalk in dit scherm —
`.gameplay-progress` toont alleen `"3/8 beantwoord"`-tekst, geen visuele
balk. `06`'s "progress pulseert of ticktempo stijgt" is dus twee
alternatieve routes; zonder een progressbalk-component is de tweede
("ticktempo") de enige die hier past zonder een nieuw UI-element te
verzinnen dat niet bestaat.

## Wat dit is

1. **`.gameplay-timer.is-urgent`**-klasse zodra `secondsLeft !== null &&
   secondsLeft <= 3` (en `model.result === null`, al gedekt doordat de
   timer dan sowieso leeg is).
2. **Contrast**: kleur/`font-weight` verandert naar `--color-warning`
   (`base.css:36`, `#f59e0b`/licht `#9a5b0a`, commentaar *"P12: tijd of
   aandacht, niet fout"* — vrijwel woordelijk deze eventomschrijving).
   **Ná review bevestigd (`REVIEW.md`): dit token bestaat al** (thema 2,
   `9ca5af0`, T2-1) — geen open punt meer, direct gebruiken.
3. **Subtiele puls**: een `@keyframes`-animatie op `.is-urgent`,
   `animation: <naam> 1s <ease> infinite` — één keer de klasse toevoegen
   volstaat, de animatie zelf loopt door zolang de klasse staat (geen JS
   nodig om 'm elke seconde te herstarten). Gebruik `--motion-fast` of
   `--motion-base` als basis voor de puls-cyclus, geschaald naar 1s (uitleg
   in commentaar waarom de duur niet letterlijk een van de tokens is —
   deze puls is aan de klok gekoppeld, niet aan een losse UI-actie).
4. **Geen schermflits**: puls blijft beperkt tot de timer zelf (`opacity`/
   `transform`/kleur op dat ene element) — geen `body`-brede of
   `.gameplay-header`-brede effect.

## Reduced motion

`is-urgent`'s animatie valt onder `M0`'s blanket-regel (near-zero duration)
— maar het **contrast/kleurwissel zelf moet blijven bestaan**, want dat is
geen "motion", het is een statewissel (`06` §7 vraagt om opacity/instant-
statewissel te behouden, niet om urgentie zelf te verbergen). Geverifieerd,
niet aangenomen: onder reduced motion is de puls weg maar de
waarschuwingskleur nog zichtbaar.

## Regels

- Geen alarmgeluid — blijft geparkeerd op `O-008`.
- Gebruik `--color-warning`, geen eigen kleurwaarde.

## Definition of done

- Handmatig geverifieerd: timer krijgt zichtbaar meer contrast + puls vanaf
  `secondsLeft === 3`, niet eerder.
- CDP-geverifieerd onder reduced motion: puls weg, contrastwissel blijft.
- Geen regressie op de rest van `gameplay.mjs` (`node --test` blijft groen —
  dit bestand heeft geen eigen DOM-tests, `round-model.test.mjs` blijft wel
  relevant voor de onderliggende logica die ongewijzigd blijft).
- `PROGRESS.md`: E07 van niveau 0 naar 1.
