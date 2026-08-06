# Prompt — T2-10: Typografierollen

Onderdeel van [`README.md`](README.md). Blokkeert thema 1 (code, score, timer).

Deze prompt ontbrak in de eerste twee rondes. Typografie staat op niveau 1 en
blokkeert thema 1, maar had geen ticket en stond ook niet bij de bewuste
weglatingen — hetzelfde gat als bij `Overlays` (`T2-9`).

## Brondocument

`05-DESIGN-SYSTEM.md` §2.3 (Typografie). `07-RESPONSIVE-HOST-PLAYER-MODES.md`
§11 (Typografie en kijkafstand). `04-SCREEN-SPECIFICATIONS.md` `S05` (code
leesbaar op kijkafstand) en `S15`.

## Wat er nu staat

Eén lettertype, één schaal, en verder niets. `components.css` heeft **elf losse
`font-size`-waarden** — `2.2rem` voor `h1`, `1.6rem` voor de timer, `1.15rem`
voor de timerwaarde, `1.05rem` voor knoppen, `0.95rem` voor quiet, enzovoort.
Elke nieuwe component kiest zelf een getal.

`tabular-nums` staat op zes plekken, telkens los meegegeven. Dat is precies het
soort herhaling waar een rol voor is: wie een score of een code toont hoort niet
te hoeven weten dát dat tabulair moet.

`05` §2.3 vraagt om negen rollen: `display-hero`, `display-code`, `heading-1`,
`heading-2`, `body-lg`, `body`, `label`, `caption`, `numeric`.

Gevolg vandaag: de gamecode en de score krijgen geen eigen moment. Ze zijn
gewoon iets grotere body-tekst, terwijl `04` S05 vraagt dat de code op
kamerafstand leesbaar is en `05` §2.3 expliciet zegt dat "de cijfers van de
roomcode bijna sportscorebordachtig groot" mogen.

## Wat dit is

1. **De rollen als klassen** in `components.css`, met de bestaande waarden als
   vertrekpunt — dit is in eerste instantie een inventarisatie, geen
   herontwerp. Elke bestaande `font-size` valt onder precies één rol.

2. **`numeric` als echte rol.** Eén klasse die `font-variant-numeric:
   tabular-nums` plus de juiste uitlijning zet, en die de zes losse plekken
   vervangt. Score, rank, code en timer gebruiken hem.

3. **`display-code` krijgt een eigen schaal.** De gamecode is het enige element
   dat door een ander persoon van een afstand wordt overgetypt. `07` §11 vraagt
   om `clamp()` voor code en rank, zodat hij meegroeit met de schermbreedte.

4. **Rollen zijn semantisch, niet groottes.** `.text-2xl` is geen rol,
   `.display-code` wel. Wie later besluit dat de code kleiner moet, wijzigt één
   plek — niet elf.

5. **Meet de code op afstand.** `04` S05's criterium is "leesbaar op relevante
   kijkafstand", en dat is geen CSS-vraag maar een meetvraag. Een echte
   telefoon op een meter afstand; dat hoort bij thema 5's testmatrix (`T5-6`)
   maar de waarde die je kiest moet erop gebaseerd zijn.

## Regels

- **Lettertypekeuze valt hierbuiten.** `O-002` staat open en blokkeert niveau 3,
  niet niveau 2 — de rollen kunnen nu al bestaan op de systeemfont-stack, en
  krijgen later een ander font zonder dat de rolindeling verandert. Ga niet
  wachten, en kies ook geen font.
- **Geen nieuwe groottes verzinnen** in deze pas. Wat er staat wordt
  ondergebracht; alleen `display-code` mag groeien, omdat daar een concrete
  eis onder ligt.
- **Raak `style.css` niet aan.** De singleplayer heeft zijn eigen
  levenscyclus; dezelfde afspraak als bij de kleurtokens (`T2-1`).

## Definition of done

- `grep -n "font-size" frontend/css/components.css` geeft alleen nog treffers
  binnen de rolklassen zelf.
- `font-variant-numeric` staat op één plek, niet op zes.
- De gamecode is op een echt scherm op een meter afstand af te lezen —
  gemeten, niet aangenomen.
- Beide thema's en 320/390/768px zien er verder onveranderd uit; screenshot
  vóór en na.
- `node --test frontend/ client/` blijft groen.
- De rolnamen staan in `HANDOFF-UI.md`, zodat thema 1 ze kan gebruiken zonder
  `components.css` te lezen.
