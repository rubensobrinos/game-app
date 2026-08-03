# Prompt — T5-2: Landscape-gedrag

**Status: uitgevoerd — gemeten, geen bugs gevonden.** Ad-hoc Playwright tegen
`node server/index.mjs` (zie `prompts/README.md`'s Playwright-notitie), niet
een committed spec.

## Brondocument

`07-RESPONSIVE-HOST-PLAYER-MODES.md` §10 (Oriëntatie): "portrait is primaire
spelerervaring; landscape wordt ondersteund maar hoeft niet andere
featurehiërarchie te krijgen... rotatie tijdens actieve vraag behoudt
antwoordstate en timer; geen reload of reset bij oriëntatiewissel."

## Wat er nu vaststaat en wat niet

Niets is vastgelegd of getest. `session-shell.mjs` houdt zijn state (fase,
`roundModel`, `participants`) in gewone JS-variabelen binnen de module-closure
— een rotatie triggert geen reload en dus per definitie geen state-verlies op
dat niveau. Onbekend: of de **CSS** in landscape bruikbaar blijft (`.screen`'s
`min-height: calc(100dvh - var(--header-h))` in een laag, breed viewport kan
de content boven de fold duwen; de vaste `max-width: 480px` op `#app-root`
laat in landscape veel zijruimte ongebruikt in plaats van 'm te benutten).

## Contract

Playwright: `page.setViewportSize({width: 844, height: 390})` (portrait-
afmetingen omgedraaid) op elk scherm uit `T5-1`'s lijst, plus expliciet een
rotatie **tijdens** een actieve vraag (portrait → landscape halverwege een
ronde, met de klok-API een paar seconden laten lopen ervoor en erna) om
`07` §10's harde eis te toetsen: geen reset van geselecteerd antwoord, timer
loopt door op dezelfde `endsAt`.

## Regels

- Geen reload/remount bij oriëntatiewissel — puur een CSS-vraag, geen
  JS-vraag (de state overleeft toch al, zie boven).
- Geen horizontale of verticale overflow in landscape op de geteste
  schermen.
- Niet verplicht: een andere compositie voor landscape (`07` §10 zegt
  expliciet dat dit niet hoeft) — dit is een verificatie- en
  overflow-fixprompt, geen redesign.

## Gemeten resultaten

Getest: lobby op 844×390, 926×428 en 1024×600 (tablet-landscape); gameplay op
844×390 tijdens een actieve ronde; rotatie portrait→landscape halverwege een
vraag (2s laten lopen, dan `setViewportSize` naar 844×390 — geen reload, dus
exact het scenario dat `07` §10 bedoelt).

| Check | Resultaat |
|---|---|
| Horizontale overflow, alle drie landscape-breedtes | ✅ geen |
| Verticale ruimte (`scrollHeight` vs. `clientHeight`) | Content is hoger dan de lage viewport (bv. 785px op 390px hoogte) — dat is **verticaal scrollen**, expliciet toegestaan (`07` §10 verbiedt alleen horizontale overflow). |
| Selectie behouden ná rotatie tijdens een vraag | ✅ — gekozen optie ("Laos") bleef `aria-pressed="true"` vóór én na de rotatie. |
| Timer loopt door, geen reset | ✅ — 15s vóór rotatie, 13s erna (2s verstreken, doorgeteld, niet terug naar 15). |

Geen CSS-breuken gevonden — `.screen`'s `min-height: calc(100dvh -
var(--header-h))` verdraagt de lage landscape-viewports prima zonder overflow
(het scherm wordt gewoon intern langer en scrollt verticaal, precies zoals
bedoeld). Geen fix nodig.

## Definition of done — behaald

- Landscape gemeten op drie breedtes, geen horizontale overflow.
- Rotatie-tijdens-vraag toont aan dat selectie én timer ongewijzigd
  doorlopen — `07` §10's harde eis gehaald zonder wijziging.
- `node --test`: 2788/2788 groen.
- `PROGRESS.md`'s rij gaat van "0, —" naar "2, gemeten — geen bugs gevonden".
