# Voortgang — 58 feedbackpunten

Eén plek waar te zien is hoe ver we zijn. **Bijgehouden door de lead**, na elke
review. Agents schrijven hier niet in; zij leveren op via hun stoppunt.

**Stand: 5 aug 2026.** A1 ✅ en C0 ✅ gemerged, B1 opgeleverd. Vier agents draaien
nu parallel (A2 · B2 · C1 · D1). De lead pakt losse punten er zelf tussendoor
bij — een deletie van één regel hoort niet in een briefing.

Gemeten op `main` @390×650: home 883 px · lobby 1319 px · spel 810 px
(baseline was 879 / 1438 / 912; de chrome ging van 74-78 naar 44 px).

**Deploy gebeurt pas ná alle rondes** (producteigenaar, 5 aug) — de build
kopieert de werkboom, dus mid-sprint deployen is precies wat STATUS afraadt.
De zes 🟡-punten blijven dus tot het eind op die status staan; ze zijn wél
bewezen (B1 draaide er tests op).

| Status | Betekenis |
| --- | --- |
| ⬜ open | nog niemand aan begonnen |
| 🔄 bezig | een agent werkt eraan |
| 🟡 al in tree | gebouwd maar niet live — **deploy + verse screenshot** haalt dit weg |
| ⏸ wacht | geblokkeerd op een besluit van de producteigenaar |
| ✅ klaar | gereviewd door de lead en gemerged |
| 🚫 niet doen | de producteigenaar vond dit goed |

---

## Startscherm

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| 1 | Startflow binnen één viewport | C (+A) | 🔄 |
| 2 | Zes codevelden + compacte Go | C | ⬜ |
| 3 | Knop "Meedoen met code" weg | C | ⬜ |
| 4 | Subtekst "Geen account · jij leidt" weg | C | ⬜ |
| 5 | Logo ~20% groter (96 → ~115 px) | C | ⬜ |
| 6 | Footer behouden | — | 🚫 |

## Navigatie

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| 7 | Hamburger → drie puntjes | A | ✅ |
| 8 | Menuknoppen kleiner | A | ✅ |

## Lobby

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| 9 | Titel "Lobby" weg | C | ✅ |
| 10 | "1 speler" weg als eigen regel | C | ✅ |
| 11 | Lege zwarte ruimtes weg | C | ⬜ besluit genomen: warm-up blijft open |
| 12 | Spelersweergave is goed | — | 🚫 |

## Codeblok

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| 13 | Code dominant (~70%) | A | ✅ |
| 14 | Code + QR + delen + opties in één blok | A | ✅ |
| 15 | DEEL → deelicoon | A | ✅ |
| 16 | Herkenbaar QR-icoon | A | ✅ |
| 17 | Drie puntjes ín het codeblok | A | ✅ |
| 18 | Codebalk compact tijdens spel | A | 🟡 deels |

## Spelersidentiteit

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| 19 | Niet standaard 8 kleurknoppen | C | ⬜ |
| 20 | Kleurvlak → palet (~36 kleuren) | C | ⏸ server kent er 8 |
| 21 | Naam + kleur uit één blok | C | ⬜ |

## Hostinstellingen en gamekeuze

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| 22 | Hostinstellingen in/uitklapbaar | C | 🟡 bestaat |
| 23 | Horizontaal swipen tussen games | C | ⬜ |
| 24 | Kleine pijlen mogen blijven | C | ⬜ |
| 25 | Kies/Mix/Typ klikbaar | B | 🔄 B1 |
| 26 | Easy/Medium/Hard is goed | — | 🚫 |
| 27 | "Antwoord automatisch tonen" moet werken | B | ⏸ serverwerk |
| 28 | Meer instellingen is goed | — | 🚫 |
| 29 | Taalinstelling zo laten | — | 🚫 |
| 30 | Snelheidsbonus + later meedoen blijven | — | 🚫 |
| 31 | "Start Rounda" hoger | C | ⬜ |
| 32 | Startknop bedekt niets | B (+C) | 🔄 B1 |

## Vraagweergave

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| 33 | Vraag + vlag + 4 antwoorden in één viewport | D | ⬜ wacht op A1 |
| 34 | Vlag, witruimte, bovenbalk verkleinen | D | ⬜ wacht op A1 |
| 35 | Vraag/antwoorden primair | D (+A) | 🔄 |
| 36 | Segmententimer i.p.v. cijfer | B | 🟡 |
| 37 | Timer telt vloeiend af | B | 🟡 |
| 38 | Toon hoeveel spelers geantwoord | D | 🟡 |
| 39 | Die status hoog in beeld | D | 🟡 |

## Reveal

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| 40 | Voortgangsbalk loopt af | B | 🔄 B1 |
| 41 | Direct de volgende vraag | B | 🟡 |
| 42 | Lege ruimte weg, voortgangsgevoel | D | ⬜ wacht op A1 |
| 43 | Consistentie vlag/antwoord/spelersantwoord | B | 🔄 B1 |

## Hostbediening

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| 44 | Pauzeren werkt en is bereikbaar | D | ⬜ |
| 45 | Pauzeknop zweeft niet los | A | ✅ |
| 46 | Hostacties op één plek | A plek / D inhoud | 🔄 |
| 47 | Hostinstellingen niet zomaar weg | D | ⬜ |
| 48 | Menu sluit aan op verwachting | D | ⬜ |
| 49 | Beëindigen/verwijderen niet dominant | D | ⬜ |
| 50 | Destructief gescheiden + bevestiging | D | ⬜ |
| 51 | Menu bedekt de vraag niet | D | ⬜ |
| 52 | Lege menuactie met alleen puntjes | B | 🔄 B1 |
| 53 | Menu rendert consistent | B | 🔄 B1 |

## Eindstand

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| 54 | Eindstand compacter | **lead** | ✅ |
| 55 | Revanche primair, rest secundair | **lead** | ✅ |
| 56 | Codebalk/menu niet dominant | A + D | 🔄 |

## Overkoepelend

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| 57 | Compacte mobiele bovenbalk | A | 🔄 |
| 58 | Alles speelbaar zonder scrollen | eindtoets lead | ⬜ |

## Erbij gekomen (niet uit de 58)

| # | Punt | Pakket | Status |
| -: | --- | :-: | :-: |
| A-x1 | Sticky header zonder achtergrond | A | ✅ |
| A-x2 | Codebalk mag weg bij FINISHED | A | 🔄 |

---

## Telling

| | Aantal |
| --- | -: |
| 🚫 niet doen | 6 |
| 🟡 al in tree (deploy haalt ze weg) | 6 |
| ⏸ wacht op een besluit | 3 |
| 🔄 in behandeling | 17 |
| ⬜ open | 26 |
| **Totaal** | **58 + 2** |

## Openstaande besluiten producteigenaar

1. ~~Warm-up in de lobby~~ ✅ **5 aug: blijft opengeklapt.** Gevolg: de lobby past
   niet in één viewport; de eis wordt "alles wat je nodig hebt boven de vouw,
   de warm-up mag eronder".
2. **Palet van 36 kleuren** — de server kent er acht (gesloten enum). Meer
   betekent protocolwerk. Blokkeert punt 20.
3. **"Antwoord automatisch tonen"** — besluit C uit doelbeeld v2, serverwerk.
   Blokkeert punt 27.
4. **Screenshottool** — er zit geen headless browser in de repo (geen
   devDependencies). Zonder tool kan de lead "past binnen één viewport" niet
   zelf natrekken en leunt hij op de meting van de agent. Een dependency
   toevoegen is een `deps`-besluit.
