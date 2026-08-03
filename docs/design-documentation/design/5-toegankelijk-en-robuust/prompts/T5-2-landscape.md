# Prompt — T5-2: Landscape-gedrag

**Status in `PROGRESS.md`:** Landscape (Responsive) | niveau 0 | bewijs: **—**
("Niet getest, geen gedrag vastgelegd.")

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

## Definition of done

- Playwright-screenshots van elk scherm in landscape (844×390 en een paar
  extra veelvoorkomende landscape-afmetingen).
- De rotatie-tijdens-vraag-test toont aan dat `selectedOptionId` en de
  resterende tijd ongewijzigd blijven.
- Gevonden CSS-breuken gefixt (waarschijnlijk: `.screen`'s vaste
  `padding`/`min-height`-aannames herzien voor een lage viewport, niet de
  `max-width` op `#app-root` aanpakken — dat laatste is bewust compositiewerk
  voor thema 2/medium-breakpoint, geen quick fix hier).
- `PROGRESS.md`'s rij gaat van "0, —" naar een eerlijk gemeten niveau.
