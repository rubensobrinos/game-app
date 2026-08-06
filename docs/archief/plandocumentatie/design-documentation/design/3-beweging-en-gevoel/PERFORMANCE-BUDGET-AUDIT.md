# Performancebudget-audit — `M5`

Datum: 3 augustus 2026. Codeaudit van alle motion uit `M0`–`M2` tegen de
classificatietabel uit `prompts/M5-performancebudget.md` (niet tegen een
transform/opacity-only-regel — dat was de fout in de eerdere lezing).

## Classificatietabel (ter herinnering)

| Klasse | Beleid |
|---|---|
| `transform`, `opacity` | voorkeur voor ruimtelijke motion (scale, fade) |
| `color`/`border-color`/`background-color` | toegestaan voor kleine statusovergangen |
| `width`/`height`/`top`/`left`/`margin`/`padding` | vermijden — forceert reflow |
| blur/filter/grote box-shadow | meten en beperken, niet verbieden |
| JS-tellingen | eigen framebudget + reduced-motionpad, geen CSS-transitie |

## Elke transitie/animatie uit `M0`–`M2`, met klasse

| Bestand:regel | Selector | Eigenschap | Klasse | Oordeel |
|---|---|---|---|---|
| `base.css:448` | `.btn-opt` | `transform`, `border-color`, `background-color`, `color` | transform (voorkeur) + kleur (toegestaan) | ✅ |
| `base.css:530` | `.btn-icon` | `transform`, `border-color` | transform + kleur | ✅ |
| `base.css:761` | `.lobby-count-pulse` | `transform` (scale via keyframes) | transform | ✅ |
| `base.css:773` | `.lobby-player-enter` | `opacity`, `transform` (scale, via keyframes) | transform/opacity | ✅ |
| `base.css:925` | `.session-banner` | `background-color` | kleur | ✅ |
| `base.css:932` | `.session-banner-success` | `opacity` (via keyframes) | opacity | ✅ |
| `components.css:92` | `.btn`-familie | `transform`, `box-shadow`, `border-color`, `background-color` | transform + kleur + box-shadow | ✅ (bestond al vóór thema 3) |
| `components.css:226` | `button.is-loading::after` | `transform` (rotate) | transform | ✅ (thema 2) |
| `components.css:606` | **`.timer-fill`** | **`width`** | **vermijden — forceert reflow** | 🔴 **overtreding, zie onder** |
| `components.css:632` | `.timer-urgent-pulse` | `transform` (scale, infinite) | transform | ✅, maar zie kanttekening infinite hieronder |
| `components.css:682` | `.gameplay-option.is-dimmed` | `opacity` | opacity | ✅ |
| `components.css:734` | `.gameplay-reveal-enter` | `opacity` (via keyframes) | opacity | ✅ |
| `components.css:746` | `.gameplay-option.is-correct` | `box-shadow` (via keyframes) | meten/beperken | 🟡 zie onder |
| `components.css:810` | `.scoreboard-entry-emphasis` | `box-shadow` (via keyframes) | meten/beperken | 🟡 zie onder |
| `components.css:881` | `.podium-step-enter` | `opacity`, `transform` (translateY+scale) | transform/opacity | ✅ |
| `components.css:907` | `.podium-confetti-piece` | `opacity`, `transform` (translateY+rotate) | transform/opacity | ✅ |
| `scoreboard.mjs` (FLIP) | `.scoreboard-entry` | `transform` (translateY, JS-gezet) | transform | ✅, zie kanttekening `getBoundingClientRect()` hieronder |
| `gameplay.mjs` (E10) | `.gameplay-score-animated` | `textContent` via `requestAnimationFrame` | JS-telling | ✅ eigen reduced-motionpad (`matchMedia`), geen CSS-transitie om te auditen |

## 🔴 Overtreding: `.timer-fill`'s `width`-transitie

`components.css:599-608` (thema 2, T2-3 — niet door thema 3 geschreven, wel
door `M8` bedraad met JS die de breedte elke tick zet):

```css
.timer-fill {
  transition: width var(--motion-fast) linear, ...;
}
```

`width` staat letterlijk in de "vermijden — forceert reflow"-klasse.
Praktisch effect hier is klein — `.timer-track` is een geïsoleerd,
niet-groot element (geen andere content eronder die herstroomt), en de
breedte verandert maximaal één keer per seconde (niet 60×/s) — dus dit is
geen acute performanceregressie, maar wél een classificatie-afwijking die
`M5`'s eigen regel ("vind je een overtreding, fix 'm hier") in principe
vraagt op te lossen.

**Niet hier gefixt, bewust.** Dit is thema 2's component (`T2-3`), niet iets
dat `M0`–`M2` heeft toegevoegd — een omzetting naar `transform: scaleX()`
(met `transform-origin: left`) zou de layout-kant oplossen maar raakt hun
eigendom, en een dergelijke visuele wijziging hoort geverifieerd te worden
in een echte browser (zie hieronder waarom dat hier niet kon). Vastgelegd
als bevinding, niet stilzwijgend genegeerd — thema 2 kan 'm oppakken, of
thema 3 in een latere prompt zodra visuele verificatie mogelijk is.

## 🟡 Te meten, niet te verbieden: drie `box-shadow`-animaties

`.gameplay-option.is-correct` (`M2`), `.scoreboard-entry-emphasis` (`M9`) en
de bestaande `.btn-primary:hover`/`.podium-rematch:hover` gebruiken
`box-shadow`-overgangen. Dit is expliciet de klasse "meten en beperken, niet
verbieden" — geen van deze loopt oneindig door (allemaal eenmalig, `both`/
geen `infinite`), en de betrokken elementen zijn klein (één knop, één rij),
dus het risico is laag. Zonder live profiling (zie onder) kan ik dit niet
hard bevestigen met een getal — vastgelegd als openstaand meetpunt, niet als
"goedgekeurd".

**Kanttekening bij `.timer-urgent-pulse`:** dit is de enige `infinite`-
animatie uit `M0`–`M2` (loopt door zolang `.is-urgent` staat, dus tot 3
seconden per ronde). `transform: scale` op een klein tekstelement — laag
risico, maar wél de enige animatie die structureel lang genoeg doorloopt om
in een frametijd-analyse zichtbaar te worden.

## FLIP (`M9`): `getBoundingClientRect()` forceert een synchrone reflow

Niet de animatie zelf (die is `transform`, netjes) maar de **meetstap**
ervóór: FLIP moet de rij-posities lezen vóór en ná de herbouw, en
`getBoundingClientRect()` forceert een synchrone layout-berekening op dat
moment. Begrensd doordat `scoreboard.mjs` sowieso maximaal 5 rijen toont
(`slice(0, 5)`) — dit is dus 5 metingen, geen honderden. Geen wijziging
nodig, wel benoemd zodat een volgende uitbreiding (meer zichtbare rijen)
dit niet per ongeluk laat groeien.

## Numerieke criteria — **niet geverifieerd, geen meettool beschikbaar**

`M5` vraagt expliciet om te méten, niet alleen te lezen: minstens één
CPU-throttled (4×) DevTools-sessie over `M2`'s zes events, getoetst tegen
vier criteria (long tasks > 50ms, frametijd > ~16,7ms, layout shifts,
inputblokkering), met een bewaard traceartefact.

**Dit kon in deze omgeving niet uitgevoerd worden.** Geen browser
beschikbaar: `node -e "require('playwright')"` geeft `Cannot find module`,
er is geen geïnstalleerde Chromium/Chrome-binary (`which chromium
chromium-browser google-chrome` geeft niets terug), en eerdere pogingen
deze sessie om Playwright alsnog te installeren liepen dood. Dit is
expliciet vastgelegd — niet stilzwijgend overgeslagen alsof "leest goed uit
de code" hetzelfde is als "gemeten". Zie Definition of done in
`prompts/M5-performancebudget.md`, die dit letterlijk verbiedt.

**Wat een volgende sessie met een werkende browseromgeving zou moeten
doen:** `page.emulateCPUThrottling(4)` (of Playwright-equivalent), de zes
`M2`-events doorlopen (E05 selectie, E06 bevestiging, E07 laatste 3
seconden, E09 reveal, E10 score-telling, E15 reconnect), een
performance-trace exporteren, en tegen de vier criteria hierboven toetsen —
inclusief specifiek de `.timer-fill`-breedte-overgang (bovenstaande
overtreding) en de drie `box-shadow`-animaties.

## Conclusie

- Code-audit: **compleet**, één overtreding gevonden (`.timer-fill`'s
  `width`), bewust niet zelf gefixt (thema 2's component, vereist visuele
  verificatie).
- Live-meting: **niet uitgevoerd**, geen browsertool beschikbaar in deze
  sessie — expliciet als blokkade vastgelegd, niet als "gedaan" verkocht.
- Niveau: blijft **0**, niet 1 — `M5`'s eigen Definition of done vereist de
  meting voor niveau 1, en die is er niet. Zie `PROGRESS.md`.
