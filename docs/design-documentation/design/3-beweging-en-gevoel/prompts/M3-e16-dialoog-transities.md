# Prompt — M3: `E16` (voorstel) — Overlay/dialoog open-dicht

**⏸️ Geparkeerd — nog niet uitvoeren.** Twee redenen, beide uit review: `E16`
is een onbevestigd ontwerpvoorstel (niet iets om zelf in `06` te verwerken
zonder bevestiging — "een gat vul je met een besluit", niet met een aanname),
én de eerdere versie van deze prompt onderschatte de techniek. Deze versie
legt vast wat er wél nodig is, zodat de prompt klaarstaat zodra `E16`
bevestigd is — het is geen werk om nu al te starten.

Onderdeel van [`README.md`](README.md), fase M3. Vereist `M1` én expliciete
bevestiging van `E16` als spec-toevoeging aan `06`.

## Brondocument

Geen bestaande sectie in `06` — dit voert het voorstel uit
`PROGRESS.md`'s §"Voorgestelde toevoeging: `E16`" uit, ná bevestiging.

## Waarom dit geen zuivere CSS-taak is

**Herzien ná review.** Een element dat via `hidden`/`display:none` verdwijnt
kan niet uitfaden — zodra `hidden` gezet wordt, is het weg, ongeacht welke
`transition` erop staat. Een echte sluitanimatie heeft een lifecycle nodig,
niet alleen twee CSS-regels:

```text
open → is-opening → open → is-closing → (na transitionend) hidden
```

Onderdelen die de eerdere versie miste:

- **Fallbacktimer** voor als `transitionend` niet vuurt (bv. de eigenschap
  waarop gewacht wordt verandert niet, of het element wordt tussentijds
  verwijderd) — anders blijft het element voor altijd "open" in de DOM.
- **Herhaald openen tijdens sluiten** — wat gebeurt er als de gebruiker de
  QR-knop opnieuw indrukt terwijl `is-closing` nog loopt? De state machine
  moet dat kunnen onderbreken, niet twee overlappende transities laten lopen.
- **Interactiviteit tijdens het sluiten voorkomen** — een dialoog die
  visueel wegfadet mag geen klikken meer accepteren (bv. `inert` of
  `pointer-events: none` zodra `is-closing` start, niet pas bij `hidden`).
- **Focus op het juiste moment teruggeven** — nu (vóór `M3`) gebeurt dat
  synchroon bij het zetten van `hidden`; met een fade-out moet focus terug
  zodra de sluit-transitie *start*, niet pas als 'm klaar is (anders staat
  de focus tijdelijk nergens terwijl het dialoog nog zichtbaar wegfadet).
- **Opruimen bij unmount** — een timer of event-listener die nog wacht op
  `transitionend` mag niet blijven hangen als `session-shell.mjs`/`lobby.mjs`
  zelf wordt afgebroken (bv. bij navigatie weg van de sessie).

## Aanpak, zodra `E16` bevestigd is

Niet drie losse open/close-implementaties (hamburgermenu, QR-overlay,
pauze-overlay) — één kleine, gedeelde dialog-transitionhelper die de
lifecycle hierboven regelt, door alle drie hergebruikt. Ontwerp die helper
eerst, test 'm tegen één dialoog, pas dan tegen de andere twee.

## Regels

- Niet starten vóór `E16` een bevestigd besluit is, geen aanname.
- Verander niets aan de bestaande focusvolgorde/Escape/aria-attributen
  inhoudelijk — de lifecycle hierboven *ordent* wanneer focus verschuift,
  maar de bestemming (welke knop, welk element) blijft ongewijzigd uit de
  vorige toegankelijkheidspas.
- Eén gedeelde helper, geen drie aparte implementaties (zie hierboven).

## Definition of done

- `E16` staat als bevestigd in `06` (of een equivalent besluitdocument) vóór
  implementatie begint.
- Lifecycle-helper getest op alle zes punten uit "Waarom dit geen zuivere
  CSS-taak is" (fallbacktimer, dubbel openen tijdens sluiten, interactiviteit
  tijdens sluiten, focustiming, unmount-opruiming) — niet alleen het
  gelukkige pad (open, wacht, sluit).
- Alle drie dialogen geverifieerd in headless Chromium, met en zonder
  `reducedMotion: 'reduce'`.
- Geen regressie op de bestaande dialoogtests (focus in/uit, Escape,
  aria-label) uit de eerdere toegankelijkheidspas.
- `PROGRESS.md`: `E16` blijft op niveau 0 tot bevestigd; daarna naar niveau 1
  zodra de helper werkt.
