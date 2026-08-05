# Pakket A — Chrome & ruimtebudget

**Lees eerst `../README.md`.** Jij bezit het ruimtebudget; de andere drie
pakketten bouwen tegen jouw tokens aan. Stoppunt 1 is blokkerend voor C en D —
lever dat dus klein en snel.

## De opdracht in één alinea

De bovenkant van elk scherm bestaat nu uit **twee rijen**: een codebalk met
hamburger, en daaronder een losse rij met een zwevende pauzeknop en een
⋯-knop. Samen kosten ze ~180 px vóórdat de inhoud begint. Daardoor valt het
vierde antwoord van elke vraag buiten beeld. Jouw opdracht: **maak er één rij
van**, `[ 749 989 | QR | deel | ⋯ ]`, met de code als dominant element, en
breng de inhoud omhoog naar ≤ 60 px.

## Wat er nu staat

| Wat | Waar |
| --- | --- |
| Sticky appheader, `z-index: 60`, `padding: 0.75rem 1rem 0` | `frontend/css/base.css:400` |
| `--header-h: 3.5rem` (56 px) | `frontend/css/base.css:105` |
| Codebalk: code + QR-glyph + DEEL-knop | `frontend/js/views/room-header.mjs` (219 rgl) |
| Hamburger, eigen knop rechts in de header | `frontend/js/app-menu.mjs` (214 rgl) |
| Hostbalk (pauze + ⋯-paneel) — **eigen rij ín het scherm** | `frontend/js/views/hostbar.mjs`, gemount in `session-shell.mjs:186-230` |
| Compactregel tijdens spel (`:has`) — bestaat al, doet te weinig | `frontend/css/rounda-1c.css:718-737` |
| `.room-header-slot { display: contents }` — de codebalk is flex-kind van de header | `frontend/css/base.css:418` |

**Belangrijk:** de compacte codebalk uit `rounda-1c.css:718` is al gebouwd maar
**staat niet live** — de screenshots van de producteigenaar komen van een
oudere build. Ga er dus niet vanuit dat "het werkt niet"; kijk eerst wat de
regel doet en of hij genoeg doet. (Hij doet ~25 px; er moet ~155 px af.)

## De punten

| # | Punt | Label | Notitie |
| --- | --- | --- | --- |
| 1 | Startflow binnen één viewport | ontwerp | jouw deel: de chrome. De rest is C |
| 7 | Hamburger → drie compacte witte puntjes | ontwerp | een hamburger belooft hoofdnavigatie; dit zijn voorkeuren |
| 8 | Menuknoppen veel kleiner | ontwerp | |
| 13 | Code = ~70% van de aandacht in het blok | ontwerp | QR/deel/⋯ worden iconen, de code blijft groot |
| 14 | Code + QR + delen + opties in één blok | ontwerp | dit ís de kern van A |
| 15 | DEEL-tekstknop → deelicoon | ontwerp | scheelt direct breedte |
| 16 | QR-pictogram herkenbaar maken | ontwerp | de huidige 5×5-glyph leest niet als QR |
| 17 | Drie puntjes ín het codeblok | ontwerp | lost ook #45 op |
| 18 | Codebalk compact tijdens spel/reveal/eindstand | **deels gebouwd** | `rounda-1c.css:718` — uitbreiden tot het budget gehaald is |
| 35 | Vraag/antwoorden primair, code/host secundair | ontwerp | jouw bijdrage: kleiner en rustiger, niet weg |
| 45 | Pauzeknop zweeft niet meer los | ontwerp | verhuist mee naar het codeblok |
| 46 | Hostacties op één vaste plek | ontwerp | jij levert de **plek**; D vult de inhoud |
| 56 | Codebalk niet dominant op het eindscherm | ontwerp | zie hieronder |
| 57 | Compacte mobiele variant van de bovenbalk | ontwerp | |
| 58 | Kernschermen zonder scrollen | eindtoets | de lead toetst dit over alle pakketten heen |
| **A-x1** | **Codebalk overlapt content bij scrollen** | **bug (nieuw)** | zie IMG_0292: de sticky balk snijdt door de knop "Hard". `z-index: 60` zonder achtergrond onder de balk |
| **A-x2** | **Codebalk mag weg bij FINISHED** | voorstel | op het eindscherm doet de code niets meer. D-018 zegt "het hele potje" — een afgelopen potje is geen potje meer. Levert #56 gratis op |

## Stoppunten

### A1 — het contract (blokkerend, houd het klein)
- [ ] De vijf tokens uit `README.md §1` staan in `base.css :root`.
- [ ] De chrome is **één rij**: code + QR + deel + ⋯. Hamburger weg (#7, #14, #15, #16, #17).
- [ ] Gemeten hoogte ≤ 44 px, ruimte tot de eerste inhoud ≤ 60 px.
- [ ] Hostbalk-knoppen staan niet meer op een eigen rij (`session-shell.mjs`
      mount blijft, de **presentatie** verhuist).
- [ ] Screenshot van het spelscherm op 390×844 waarop **vier antwoorden**
      zichtbaar zijn. Dit is de acceptatie; zonder deze foto is A1 niet af.

### A2 — de compacte varianten per fase
- [ ] Spel, reveal en eindstand: codebalk binnen budget (#18, #35).
- [ ] Codebalk weg of geminimaliseerd bij FINISHED (#56, A-x2) — leg je keuze
      vast in een commentaarregel.
- [ ] Overlap bij scrollen weg (A-x1): de balk mag nooit door content snijden.

### A3 — menu en afwerking
- [ ] Drie puntjes openen het voorkeurenpaneel (taal/thema) — inhoud
      ongewijzigd, alleen de aanleiding (#7, #8).
- [ ] Plek voor hostacties gereed en gedocumenteerd voor D (#46).
- [ ] `?v=1cX` in `frontend/index.html` ophogen — **als laatste van alle
      pakketten**, in overleg met de lead.

## Niet doen

- Code of QR **weghalen** tijdens een lopend potje (D-018).
- De inhoud van het hostmenu wijzigen — dat is D.
- `home.mjs` of `lobby.mjs` aanraken — dat is C.
- De footer aanpassen (punt 6: die vond de producteigenaar goed).
