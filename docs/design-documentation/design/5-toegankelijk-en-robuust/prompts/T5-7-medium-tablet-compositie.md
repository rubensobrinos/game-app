# Prompt — T5-7: Medium/tablet-compositie

**Status in `PROGRESS.md`:** Medium / tablet | niveau 0 | bewijs: **—** ("Geen
tweekoloms compositie; alles blijft één kolom van 480px.")

**Correctie op de vorige versie van deze `PROGRESS.md`-pas:** die zei dat dit
wacht op thema 2's open besluiten (`O-002` lettertype, `O-003` accentkleur).
Dat klopt niet — een tweekoloms breakpoint is een layoutvraag (grid/flex,
wanneer welke breedte welke compositie krijgt), geen typografie- of
kleurvraag. `O-002`/`O-003` bepalen hóe het eruitziet, niet óf de kolommen er
mogen staan. Vandaar alsnog een prompt.

## Brondocument

`07-RESPONSIVE-HOST-PLAYER-MODES.md` §3 "Medium" en §6 "Hosttablet".

## Wat er nu vaststaat en wat niet

Vaststaand (gelezen): `#app-root` heeft een vaste `max-width: 480px`,
ongeacht viewportbreedte — er is dus letterlijk geen breakpoint, alleen een
gecentreerde smalle kolom op elk apparaat. Niet vastgesteld: bij welke breedte
een tweede kolom zinvol wordt (`07` §3 zegt bewust "content-driven
omslagpunten", geen vaste pixelwaarde).

## Contract

Alleen de **lobby** (`views/lobby.mjs`) en **tussenstand** (`scoreboard.mjs`)
krijgen een tweekoloms variant bij voldoende breedte — dat zijn de twee
schermen waar `07` §6 dit expliciet vraagt ("QR en spelerslijst naast elkaar",
"tijdens reveal kunnen groepsstatistiek en controls naast elkaar"). Andere
schermen (gameplay, podium, home/join) blijven bewust één kolom — dat vraagt
niemand.

- Layout via CSS Grid op `.screen` of een nieuwe wrapper, met een
  `@media (min-width: ...)`-omslagpunt bepaald door wanneer de content
  (niet een vast getal) prettig past — test empirisch met de daadwerkelijke
  QR-afbeelding + spelerslijst naast elkaar, niet met lorem ipsum.
- `#app-root`'s vaste `max-width: 480px` moet voor deze twee schermen
  specifiek verruimd worden (niet globaal — dat zou elk ander scherm
  onbedoeld meenemen).
- Zelfde tokens (`--r`, `--border`, `--surface`) — geen nieuwe visuele taal,
  puur een tweede kolom.

## Regels

- Geen andere featurehiërarchie in medium dan in compact (`07` §3: "hoeft
  niet andere featurehiërarchie te krijgen") — de tweede kolom toont extra
  context, niet een ander primair pad.
- Content-volgorde in de DOM blijft logisch voor toetsenbord/screenreader
  (visuele CSS-Grid-herordening mag de leesvolgorde niet omdraaien).
- Werkt zonder hover (`07` §12) — dit blijft evengoed een touchapparaat.

## Definition of done

- Playwright-screenshots bij een paar representatieve tabletbreedtes (bv.
  768px, 1024px) van lobby en tussenstand, naast de bestaande compacte versie.
- Geen regressie op compact portrait (390×844 blijft ongewijzigd).
- `PROGRESS.md`'s rij gaat van "0, —" naar een eerlijk gemeten niveau.
