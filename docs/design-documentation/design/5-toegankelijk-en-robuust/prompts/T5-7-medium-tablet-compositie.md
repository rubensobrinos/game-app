# Prompt — T5-7: Medium/tablet-compositie

**Status: uitgevoerd en geverifieerd.** Alle drie de onderdelen gebouwd,
tegen de échte server op 390/768/1024px gemeten (ad-hoc Playwright, geen
projectdependency).

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

**Herzien na eigen review — §3 "Medium" noemt drie dingen, de eerste versie
van dit contract dekte er twee.** `07` §3 zegt letterlijk: "QR en
spelerspreview naast elkaar", "**side panel voor voorkeuren**", "ruimere
leaderboardweergave." Het voorkeurenpaneel (het hamburgermenu,
`app-menu.mjs`) hoort er dus bij, niet alleen lobby en tussenstand.

Drie schermen/componenten krijgen een tweekoloms/paneel-variant bij
voldoende breedte:

1. **Lobby** (`views/lobby.mjs`) — QR/code/URL naast de spelerslijst (`07`
   §6).
2. **Tussenstand** (`scoreboard.mjs`) — ruimere leaderboardweergave, tijdens
   reveal eventueel groepsstatistiek naast controls (`07` §6).
3. **Hamburgermenu** (`app-menu.mjs`) — vanaf medium een vast side panel in
   plaats van een zwevend, met `hidden`/`aria-expanded` losgelaten
   dropdown-gedrag; dat is een ander interactiepatroon dan de huidige
   `setOpen()`, dus dit raakt meer code dan de andere twee.

Andere schermen (gameplay, podium, home/join) blijven bewust één kolom — dat
vraagt niemand.

- Layout via CSS Grid op `.screen` of een nieuwe wrapper, met een
  `@media (min-width: ...)`-omslagpunt bepaald door wanneer de content
  (niet een vast getal) prettig past — test empirisch met de daadwerkelijke
  QR-afbeelding + spelerslijst naast elkaar, niet met lorem ipsum.
- `#app-root`'s vaste `max-width: 480px` moet voor deze schermen specifiek
  verruimd worden (niet globaal — dat zou elk ander scherm onbedoeld
  meenemen).
- Zelfde tokens (`--r`, `--border`, `--surface`) — geen nieuwe visuele taal,
  puur een tweede kolom/paneel.

## Regels

- Geen andere featurehiërarchie in medium dan in compact (`07` §3: "hoeft
  niet andere featurehiërarchie te krijgen") — de tweede kolom toont extra
  context, niet een ander primair pad.
- Content-volgorde in de DOM blijft logisch voor toetsenbord/screenreader
  (visuele CSS-Grid-herordening mag de leesvolgorde niet omdraaien).
- Werkt zonder hover (`07` §12) — dit blijft evengoed een touchapparaat.

## Gebouwd

1. **Lobby**: `lobby.mjs`'s bestaande kinderen zijn gegroepeerd in een nieuwe
   `.lobby-main-column`-wrapper (zelfde DOM-volgorde, geen herordening) naast
   `.lobby-share`; vanaf 768px wordt `.lobby-screen` een CSS-grid
   (`grid-template-areas: 'main share' 'start start'`), eronder blijft het de
   bestaande verticale flex-kolom.
2. **Tussenstand**: `.scoreboard-list`/`.scoreboard-entry` krijgen vanaf
   768px meer ruimte (`max-width: 600px`, gecentreerd, grotere padding) —
   bewust alleen de scoreboard-selectors, niet de gedeelde
   `.podium-steps`/`.podium-step`, dus het podiumscherm blijft ongewijzigd.
3. **Hamburgermenu**: vanaf 768px verdwijnt `.app-hamburger` en toont
   `.app-menu` zich permanent inline in de header (`display: flex !important`
   overschrijft het `hidden`-attribuut), horizontaal i.p.v. verticaal.
   `app-menu.mjs`'s `setOpen()`/Escape/klik-buiten-logica is ongewijzigd
   gelaten — die blijft intern gewoon `hidden`/`aria-expanded` bijhouden, dat
   heeft op dit breekpunt alleen geen zichtbaar effect meer. Geen aparte
   tablet-tak in de JS nodig.

`#app-root`'s `max-width` wordt alleen voor lobby/tussenstand verruimd naar
760px (`session-shell.mjs` zet `.app-root-wide` per gemount scherm) — home,
join, gameplay en podium blijven op de compacte 480px-kolom.

## Definition of done — behaald

- Ad-hoc Playwright tegen `node server/index.mjs` op 390×844 (compact),
  768×1024 en 1024×1366: lobby toont de tweekoloms-layout side-by-side vanaf
  768px, `#app-root` verruimt naar 760px, geen horizontale overflow op geen
  van de drie breedtes. Tussenstand centreert op 600px zodra de fase
  `SCOREBOARD` mount. Hamburgerknop verdwijnt vanaf 768px, menu blijft
  permanent zichtbaar.
- Compact portrait (390×844) ongewijzigd bevestigd: geen grid, geen
  verruiming, hamburgerknop gewoon zichtbaar.
- `node --test`: 2819/2819 groen.
- `PROGRESS.md`'s rij gaat van "0, —" naar "2, gemeten".
