# Prompt — M0: `prefers-reduced-motion` als vaste regel

**✅ Al gedaan — door een andere agent, vóórdat deze prompt werd uitgevoerd.**
`base.css` bevat inmiddels precies deze blanket-regel (`@media
(prefers-reduced-motion: reduce)`, `*, *::before, *::after`,
`animation-duration`/`transition-duration` naar `0.001ms`,
`scroll-behavior: auto`), met een verwijzing naar dezelfde bronnen (`08` §2.4,
QA-checklist K) als hieronder. Nog niet gecommit op het moment van schrijven,
dus geen commit-hash hier — controleer bij uitvoering of 'm inmiddels
gecommit is. **Niet opnieuw bouwen.** Deze prompt blijft staan als
documentatie van de eis en als basis voor `M1`–`M3`'s Definition of Done
(die hier tegen toetsen), en om te bevestigen dat de bestaande implementatie
aan onderstaande criteria voldoet — dat laatste is nog niet apart
geverifieerd.

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

- Handmatig geverifieerd in headless Chromium met
  `page.emulateMedia({ reducedMotion: 'reduce' })`: de bestaande
  `:active`-scales (primary/secondary/destructive/gameplay-option) worden
  vrijwel instant in plaats van over hun huidige duur.
- Geen visuele regressie in de normale modus (`reducedMotion: 'no-preference'`
  of niet gezet) — de blanket-regel raakt alleen het reduced-motion-pad.
- `PROGRESS.md`'s fundament "`prefers-reduced-motion`" van niveau 0 naar 1
  (blanket-regel bestaat) — niveau 2 pas zodra `M2`'s inhoudelijke
  vervangingen ook staan.
