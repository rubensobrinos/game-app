# Prompt — T5-8: Large/podium-compositie (gescoped, niet alles tegelijk)

**Status in `PROGRESS.md`:** Large / podium | niveau 0 | bewijs: **—** ("Geen
podiumcompositie, geen spelerswand, geen grote code op kamerafstand.")

**Correctie op de vorige versie van deze `PROGRESS.md`-pas:** die noemde dit
Fase 3/4 en dus te vroeg. Dat klopt niet — `10-IMPLEMENTATION-ROADMAP.md`'s
prioriteitsmatrix zet "podium" expliciet op **Fase 2** (hoog impact, middel
complexiteit), en Fase 2's eigen acceptatiecriteria noemen "groot hostscherm
heeft podiumcompositie" met naam. `P4` (`02-DESIGN-PRINCIPLES.md`: "het
hostscherm kan een podium worden") is een designprincipe, geen open vraag.

Wél terecht: dit is **groter** dan `T5-7` en niet in één stuk te doen. Vandaar
een gescoped contract — bouw wat kán, benoem expliciet wat waarop wacht, in
plaats van het geheel uit te stellen of het geheel te forceren.

**Nog niet geverifieerd, wél als aanname gebruikt:** de roadmap-rij "podium |
Fase 2" is niet eenduidig aan dit thema toe te schrijven. Thema 1's eigen
`PROGRESS.md` heeft óók een podium-item (`S20`, niveau 1: "geen
3→2→1-opbouw, geen `Deel uitslag`/`Nieuw spel`") — dat is het mobiele
podiumscherm zélf, andere scope dan de desktop/tv-compositie hier. Het is
aannemelijk dat de roadmap-rij (grotendeels) over `S20` gaat, of over beide.
**Stem dit af met thema 1's eigenaar vóór dit ticket start** — zoniet is de
kans reëel dat dit ticket iets bouwt dat op een nog niet afgeronde `S20`
leunt (bijvoorbeeld: de spelerswand/leaderboard-breedtelogica hieronder heeft
weinig zin te verfraaien zolang de onderliggende podiumdata/-indeling van
`S20` zelf nog verandert).

## Brondocument

`07-RESPONSIVE-HOST-PLAYER-MODES.md` §7 (Desktop/laptop als podium) en §8
(Tv/projectie). `02-DESIGN-PRINCIPLES.md` P4.

## Wat nu al kan (geen open besluit blokkeert dit)

- **Lobby als podium** (`07` §7 "Lobby"): linker zone QR/code/URL, rechter
  zone spelersteller + groeiende spelerswand, code leesbaar op afstand
  (grotere `clamp()`-typografie dan de telefoonversie). Dit is dezelfde
  databron als `T5-7`'s lobby-kolom, alleen een grotere/rijkere variant bij
  een nog bredere viewport — kan er logisch bovenop.
- **Grote code/QR-typografie** (`07` §11: "code en rank gebruiken responsive
  clamp... podiumlabels zijn veel groter dan telefoonlabels"): een
  `clamp()`-schaal die vanaf een bepaalde breedte serieus opschaalt, niet
  lineair meegroeit met de rest van de tekst.
- **Leaderboard met meer ruimte** (`07` §7 "Reveal": "leaderboard met rank
  movement" minus de rank-movement-animatie zelf, die is thema 3/1's scope —
  hier alleen de bredere lay-out, niet de beweging).

## Wat hier bewust niet gebouwd wordt, met reden

- **Antwoordverdeling op het podium** — wacht op `O-010` ("welk moment toont
  antwoordverdeling?"), een open Product Owner-besluit. Bouw geen aanname
  voor iets dat de PO nog moet vastleggen.
- **Sociale headline centraal in de compositie** — de headline-engine zelf
  bestaat nog niet (`E12`/thema 1 `S14`, allebei niveau 0). Reserveer er
  layoutruimte voor, toon 'm nog niet.
- **Podiumassets/3→2→1-opbouw** — medaille-emoji zijn bewust nog placeholders
  (`D-015`); eigen assets zijn thema 2/3-scope.
- **Tv/projectie-specifieke tests** (`07` §8: scanbaarheid op afstand, geen
  hoge refresh-afhankelijkheid) — dat is `T5-6`'s testmatrix-scope (een echt
  scherm nodig), niet iets dat hier gebouwd wordt.

## Regels

- Twee mogelijke vraagmodi uit `07` §7 ("volledig podium" vs. "hostconsole +
  podium") zijn allebei door de visuele spec ondersteund — kies er niet
  stilzwijgend één; als de productarchitectuur dat nog niet heeft bepaald, is
  dat een `HANDOFF`-item, geen aanname.
- Geen persoonlijke/geheime data op het gedeelde scherm (`07` §7 Reveal,
  laatste regel) — dit is dezelfde anti-afkijk/privacydiscipline als overal
  elders.

## Definition of done

**Status: nog niet gebouwd** — dit contract beschrijft wat gebouwd moet
worden. Wél gecorrigeerd: de DoD hing oorspronkelijk aan een committed
Playwright-testsuite die niet bestaat (zie `prompts/README.md`'s
Playwright-notitie), en (zie boven) dit wacht sowieso eerst op afstemming
met thema 1 over de `S20`-overlap. Zodra beide zijn opgelost:

- De drie "wat nu al kan"-punten zijn gebouwd en met ad-hoc Playwright (geen
  projectdependency, zelfde aanpak als `T5-1`/`T5-2`) op een paar
  grote-viewportbreedtes geverifieerd, resultaat vastgelegd in dit document.
- De vier "bewust niet"-punten staan als aparte, benoemde vervolgstappen in
  `PROGRESS.md` — niet stilzwijgend verdwenen zodra dit ticket sluit.
- `PROGRESS.md`'s rij gaat van "0, —" naar een niveau dat het gedeeltelijke
  karakter eerlijk weerspiegelt (waarschijnlijk 1, niet meteen 2 — een half
  podium is nog geen "alle staten vormgegeven").
