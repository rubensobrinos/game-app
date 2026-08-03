# Prompt — M5: Performancebudget vastleggen

Onderdeel van [`README.md`](README.md), fase M5. Vereist `M1`, `M2` (niet
`M3` — die staat geparkeerd; zie hieronder). Dit toetst wat daar gebouwd is,
het bouwt zelf geen nieuwe motion.

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §9 (Performancebudget): "animaties
gebruiken **bij voorkeur** transform/opacity" — een voorkeur, geen verbod —
geen zware blur/glass op lage mobiele hardware, confetti/particles-limiet,
motion blokkeert timer/inputthread niet, test op middelmatige
Androidtelefoon niet alleen high-end desktop.
`11-DESIGN-QA-CHECKLIST.md` M: "Zijn animaties performant op middelmatige
Androidhardware?"

## Twee correcties ná review

**1. Geen absoluut verbod maken van een voorkeur.** De eerdere versie
vertaalde "bij voorkeur transform/opacity" naar "gebruikt élke transitie
uitsluitend transform/opacity?" — strenger dan de bron. Kleur-, rand- en
achtergrondtransities (die `M1`/`M2` juist bewust toevoegen naast
`transform`) zijn voor kleine controls prima. Vervang de audit door een
classificatie:

| Klasse | Beleid |
|---|---|
| `transform`, `opacity` | voorkeur voor ruimtelijke motion (scale, fade) |
| `color`/`border-color`/`background-color` | toegestaan voor kleine statusovergangen (E06's dim, E01's non-scale reduced-motion-alternatief) |
| `width`/`height`/`top`/`left`/`margin`/`padding` | vermijden — forceert reflow |
| blur/filter/grote box-shadow | meten en beperken, niet verbieden |
| JS-tellingen (E10) | eigen framebudget + reduced-motionpad, geen CSS-transitie om te auditen |

**2. Numerieke criteria, anders keurt "één keer meten" niets af.** Voeg toe:

- geen long tasks > 50 ms tijdens interactiemotion (E01, E06, E09);
- animatieframes niet structureel > ~16,7 ms (60 fps-doel), incidentele
  uitschieters getolereerd, geen patroon van gedropte frames;
- geen layout shifts veroorzaakt door motion (devtools' Layout Shift-regions
  of een CLS-achtige check);
- geen animatie die inputverwerking of timerupdates aantoonbaar vertraagt
  (bv. de gameplay-timer blijft doortikken tijdens een reveal-animatie).

## Wat dit is

1. **Code-audit** van alle motion uit `M0`–`M2` (niet `M3` — geparkeerd,
   zie onder) tegen de classificatietabel hierboven, niet tegen een
   transform/opacity-only-regel.
2. **Vastleggen als regel**, niet als losse observatie: een korte
   commentregel bij thema 2's motion-tokens die naar deze classificatie
   verwijst, zodat een volgende prompt (E04 zodra thema 1 `S07` levert, of
   toekomstig confetti-werk) een vaste regel heeft.
3. **Meten, niet alleen lezen**: minstens één sessie met Chrome DevTools'
   CPU-throttling (4×) over `M2`'s zes events, met de vier numerieke criteria
   hierboven expliciet gecontroleerd — niet alleen "voelt vloeiend".
   **Kanttekening, met naam genoemd, niet verzwegen:** 4×-CPU-throttling is
   een reproduceerbare ontwikkelcheck, geen vervanging voor een echt
   middelmatig Androidtoestel — het simuleert geen GPU-/compositorgedrag,
   thermische throttling of echt touch-gedrag. Dat blijft een apart,
   volwaardig testmoment (zie Definition of done).
4. **Traceartefact bewaren** (een geëxporteerd DevTools-performanceprofiel of
   -trace), niet alleen een tekstuele samenvatting — anders is de meting
   niet herleidbaar voor een volgende toetsing.

## Regels

- Geen nieuwe motion toevoegen hier — uitsluitend auditeren en vastleggen.
  `M1`/`M2` blijven inhoudelijk ongewijzigd tenzij de audit een overtreding
  vindt volgens de classificatietabel (niet volgens de oude, strengere lezing).
- `M3` blijft buiten deze audit zolang het geparkeerd is — niet alvast
  meenemen alsof het al gebouwd is.
- Vind je een overtreding (bv. een `width`/`top`-animatie), fix 'm hier.

## Definition of done

- Elke transitie uit `M0`–`M2` genoemd met bestand + eigenschap + klasse uit
  de tabel — geen gevonden afwijking blijft ongefixt.
- Minstens één CPU-throttled meting met traceartefact, getoetst tegen de vier
  numerieke criteria (long tasks, frametijd, layout shifts, input-
  blokkering) — niet alleen "leest goed uit de code" of "voelt vloeiend".
- `PROGRESS.md`: "Performancebudget" van niveau 0 naar 1 (vastgelegd +
  eenmalig, CPU-throttled getoetst). **Niveau 2 vereist expliciet een
  meting op een echt middelmatig Androidtoestel** — niet alleen herhaalde
  devtools-metingen — leg dat onderscheid met naam vast in `PROGRESS.md`,
  niet alleen "vaker meten".
