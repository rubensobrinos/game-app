# Prompt — M5: Performancebudget vastleggen

Onderdeel van [`README.md`](README.md), fase M5. Vereist `M1`, `M2` — dit
toetst wat daar gebouwd is, het bouwt zelf geen nieuwe motion.

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §9 (Performancebudget): transform/opacity
bij voorkeur, geen zware blur/glass op lage mobiele hardware, confetti/
particles-limiet, geluidassets slim vooraf geladen, motion blokkeert timer/
inputthread niet, test op middelmatige Androidtelefoon niet alleen
high-end desktop. `11-DESIGN-QA-CHECKLIST.md` M: "Zijn animaties performant
op middelmatige Androidhardware?"

## Waarom dit een aparte stap is, niet een bijzin bij `M1`/`M2`

`PROGRESS.md` markeerde dit fundament als "toevallig nog niet geschonden
omdat er nog geen motion is, maar ook niet getoetst" — na `M1`/`M2` is die
eerste helft niet meer waar. Dit is het moment om te controleren of wat
daar gebouwd is de regel ook echt volgt, in plaats van dat aan te nemen.

## Wat dit is

1. **Code-audit** van alle motion uit `M0`–`M3`: gebruikt elke transitie
   uitsluitend `transform`/`opacity`? Geen `width`/`height`/`top`/`left`-
   animaties die een reflow forceren (zeker niet op `E08`'s optiegroep of
   `E16`'s overlays, die het vaakst vuren).
2. **Vastleggen als regel, niet als losse observatie**: een korte comment-
   regel bij de motion-tokens in `base.css` die expliciet noemt dat nieuwe
   transities zich hieraan houden — zodat een volgende prompt (`E04`-
   choreografie zodra thema 1 `S07` levert, of toekomstig confetti-werk) een
   vaste regel heeft om tegen te toetsen, niet een aanname.
3. **Meten, niet alleen lezen** (`NIVEAUS.md`'s eigen onderscheid tussen
   "gelezen" en "gemeten", zoals thema 5 al toepast): minstens één sessie met
   Chrome DevTools' CPU-throttling (4x, benadert een middelmatige
   Androidtelefoon) over de rondecyclus (`M2`'s zes events) en de twee
   overlays (`M3`).

## Regels

- Geen nieuwe motion toevoegen hier — dit is uitsluitend auditeren en
  vastleggen, `M1`/`M2`/`M3` blijven inhoudelijk ongewijzigd tenzij de audit
  een overtreding vindt.
- Vind je een overtreding (bv. een transitie op een non-transform/opacity-
  property), fix 'm hier — dat hoort bij "de regel handhaven", niet bij een
  nieuwe prompt.

## Definition of done

- Elke transitie uit `M0`–`M3` genoemd met bestand + eigenschap, met een
  vinkje transform/opacity of een gevonden-en-gefixte afwijking.
- Minstens één CPU-throttled meting gerapporteerd (niet alleen "leest goed
  uit de code").
- `PROGRESS.md`: "Performancebudget" van niveau 0 naar 1 (vastgelegd +
  eenmalig getoetst) — niveau 2 pas bij herhaalde/geautomatiseerde toetsing,
  wat hier expliciet niet de eis is.
