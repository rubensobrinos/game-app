# Prompt — M0: `prefers-reduced-motion` als vaste regel

**✅ Gedaan — commit `7a146a0`.** `base.css` bevat een
`@media (prefers-reduced-motion: reduce)`-blok met twee regels: de bestaande
blanket-regel (`*, *::before, *::after`, `animation-duration`/
`transition-duration` naar `0.001ms`, `scroll-behavior: auto`) plus de
aanvulling uit deze prompt, `transform: none !important` op de vier
`:active`-controls (`.btn-primary`, `.btn-secondary`, `.btn-destructive`,
`.gameplay-option:not(:disabled)`, ook `.podium-rematch`) met een
non-transform-vervanging (box-shadow/border-color/background) zodat de
interactie voelbaar blijft zonder scale.

**Reviewbevinding die dit oploste:** de blanket-regel verkortte een
`:active`-scale (`transform: scale(0.98)`) naar 0,001 ms, maar verwijderde
'm niet — `06` §7 zegt expliciet "geen scale/spring", en een scale van
0,001 ms is nog steeds een scale. De blanket-regel bleef een goed vangnet
voor *duur*, maar was geen vervanging voor `06`'s eis dat het *soort*
motion (scale) onder reduced motion wegvalt.

**`!important` nodig gebleken, niet optioneel:** een eerste versie zonder
`!important` op `transform: none` werd geverifieerd via CDP
(`forcePseudoState` + `getComputedStyle`) en bleek niet te werken — computed
`transform` bleef `matrix(0.98, 0, 0, 0.98, 0, 0)` onder reduced motion.
Oorzaak: `base.css` laadt vóór `components.css`; bij gelijke specificity
wint de latere, onvoorwaardelijke regel (`components.css`'s
`transform: scale(...)`), ongeacht de mediaquery. Met `!important` op
`transform: none` specifiek is dit opgelost en herverifieerd:

- `.btn-primary`/`.btn-secondary` direct via CDP in beide motion-modi:
  scale weg + vervanging zichtbaar onder `reduce`
  (`transform: none`, `box-shadow`/`border-color` zichtbaar), scale
  ongewijzigd onder `no-preference` (geen regressie).
- `.btn-destructive`/`.gameplay-option` delen dezelfde `!important`-regel
  in hetzelfde blok — niet los herverifieerd via CDP, maar structureel
  gedekt: `!important` wint sowieso over een niet-`!important`-regel,
  ongeacht specificity of brondocumentvolgorde, dus het mechanisme is
  selector-onafhankelijk.

Oorspronkelijke opzet, bewust de eerste stap, vóór er ook maar één nieuwe
animatie bijkomt:

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §7 (Reduced motion): geen scale/spring/
bewegende rankrows, opacity- of instantstatewissel, podium direct compleet,
score direct definitief, confetti uit, countdown blijft tekstueel
begrijpelijk, functionele durations niet onnodig langer.
`08-ACCESSIBILITY-AND-RESILIENCE.md` §2.4: "respecteer `prefers-reduced-
motion`" is een harde eis, geen aanbeveling.
`11-DESIGN-QA-CHECKLIST.md` K: "Respecteert motion de systeemvoorkeur?"

## Waarom dit vóór alles

Vandaag bestaat er nog nauwelijks motion (`components.css` heeft alleen
`:active`-scales op vier controls). Dat is precies het goedkope moment om dit
vast te leggen: één mediaquery, niets om te migreren. Na `M1`/`M2` (tokens,
choreografie) is dit dezelfde regel maar dan op tientallen plekken tegelijk
terug te bouwen — en foutgevoeliger, want dan is het een refactor in plaats
van een startpunt.

## Wat dit is

Een globale, blanket-regel in `base.css`, vóór alle overige motion-CSS:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Dit is een vangnet: elke animatie/transitie die later bijkomt (via `M1`,
`M2`, `M3`) wordt hierdoor automatisch bijna-instant voor wie de
systeemvoorkeur heeft staan — zonder dat elke latere prompt zelf een
reduced-motion-uitzondering hoeft te schrijven.

**Let op wat dit niet oplost:** `06` §7 vraagt ook om *inhoudelijke*
vervangingen (podium direct compleet i.p.v. een ingekorte animatie, score
direct de eindwaarde, geen carrousel-gedrag) — dat is per moment iets voor
`M2`/latere prompts, niet iets dat een CSS-blanket-regel alleen kan
garanderen. Deze prompt legt de vloer, niet de volledige eis.

## Regels

- Geen `!important` toevoegen buiten dit ene blok — dat zou het patroon
  uithollen dat juist bedoeld is om overal automatisch te gelden.
- Niet wachten op `M1`: deze regel moet vóór er ook maar één nieuwe
  `transition`/`animation` bijkomt, ongeacht welke prompt dat later doet.

## Definition of done

- ✅ Handmatig geverifieerd via CDP (`forcePseudoState` + `getComputedStyle`,
  niet alleen CSS-broncode gelezen): de bestaande `:active`-scales
  (primary/secondary geverifieerd, destructive/gameplay-option structureel
  gedekt door dezelfde `!important`-regel) worden onder reduced motion
  daadwerkelijk `transform: none`, niet alleen vrijwel instant.
- ✅ Geen visuele regressie in de normale modus
  (`reducedMotion: 'no-preference'`): scale blijft ongewijzigd
  (`matrix(0.98,...)`/`matrix(0.99,...)`), alleen het reduced-motion-pad is
  geraakt.
- ✅ `node --test`: 368/368 groen, geen regressie (CSS-only wijziging).
- `PROGRESS.md`'s fundament "`prefers-reduced-motion`" van niveau 0 naar 1
  (blanket-regel + scale-verwijdering bestaan) — niveau 2 pas zodra `M2`'s
  inhoudelijke vervangingen (podium direct compleet, score direct
  definitief, geen carrousel) ook staan.
