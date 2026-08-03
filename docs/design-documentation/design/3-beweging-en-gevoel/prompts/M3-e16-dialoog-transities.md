# Prompt — M3: `E16` (voorstel) — Overlay/dialoog open-dicht

Onderdeel van [`README.md`](README.md), fase M3. Vereist `M1` (tokens).

## Brondocument

Geen bestaande sectie in `06` — dit voert het voorstel uit
`PROGRESS.md`'s §"Voorgestelde toevoeging: `E16`" uit. **Dat voorstel is nog
niet bevestigd als spec-wijziging op `06` zelf** (zie de eigenaarsgrens in
`00-DESIGN-INDEX.md` §1: agents mogen `06` niet zelf herschrijven). Deze
prompt bouwt de motion; het bijwerken van `06` met een officiële `E16` blijft
een aparte, expliciete stap die niet stilzwijgend hierin meelift.

## Wat er nu staat

Drie dialogen wisselen puur via `hidden`: het hamburgermenu (`app-menu.mjs`),
de QR-overlay en de pauze-overlay (beide `lobby.mjs`/`session-shell.mjs`).
Alle drie hebben al correcte `role="dialog"`/`aria-modal`/focusbeheer/Escape
— dit gaat uitsluitend over de visuele transitie, niet over toegankelijkheid
die al staat.

## Wat dit is

Voor alle drie dezelfde twee stappen, met `M1`'s tokens:

1. **Overlay/paneel:** een korte fade + lichte scale-in (`--motion-fast`) bij
   openen, omgekeerd bij sluiten. Geen bounce/spring — dit zijn functionele
   panelen, geen podiummoment (`06` §2: "motion gebruikt een kleine set
   durations en easings").
2. **Achtergrond (waar van toepassing, QR/pauze):** de bestaande
   `rgba(0,0,0,…)`-achtergrond faded mee, niet abrupt.

## Regels

- Verander niets aan de bestaande focusvolgorde/Escape/aria-attributen — dit
  raakt alleen `opacity`/`transform`, niet de toegankelijkheidslaag uit de
  vorige pas.
- Sluiten mag niet trager aanvoelen dan openen — gebruik dezelfde duration
  in beide richtingen, dat is expres géén asymmetrische in/uit-timing.
- `M0`'s blanket-regel moet dit automatisch dekken zonder aparte
  reduced-motion-code hier — als dat niet zo blijkt, is dat een signaal dat
  de transitie niet via `transition`/`animation` is opgebouwd en dus de
  verkeerde CSS-aanpak gebruikt.

## Definition of done

- Alle drie dialogen geverifieerd in headless Chromium, open én dicht, met
  `reducedMotion: 'reduce'` (vrijwel instant via `M0`, geen aparte code) en
  zonder (zichtbare fade/scale).
- Geen regressie op de bestaande dialoogtests (focus in/uit, Escape,
  aria-label) uit de eerdere toegankelijkheidspas.
- `PROGRESS.md`: `E16` van niveau 0 naar 1 als voorstel — niet naar "definitief
  toegevoegd aan `06`" zonder dat iemand met die bevoegdheid het bevestigt.
