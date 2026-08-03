# Voortgang — 1. Schermen en flow

**Eigenaar:** _nog toe te wijzen_
**Documenten:** `03-GAME-FLOW-AND-STATES.md`, `04-SCREEN-SPECIFICATIONS.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` secties C t/m H · schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Bijgewerkt:** 3 augustus 2026 · commit `18b2d53`

De 21 schermen uit `04` staan hieronder **op volgorde van de spelersreis**, niet
op nummer: landing → lobby → ronde → uitslag → beheer. Zo lees je de tabel als
een doorloop en zie je waar iemand vastloopt, in plaats van als een inventaris.

`S09` en `S10` (Echt of Nep, Hoger of Lager) staan er wel in maar vallen buiten
de huidige lanceerscope — die blijven bewust op 0.

## Start en join

| # | Scherm | Niveau | Wat er nog mist |
|---|---|---|---|
| S01 | Landing / Samen spelen | 1 | Geen `Potje maken…`-laadstatus (S01, E02). Belofte-regel onder de fold ontbreekt. Hero is een gewone primary-knop. |
| S02 | Spel aanpassen | 0 | Bestaat niet. Quick-start gebruikt de vaste default; er is geen route naar instellingen. |
| S03 | Roomcode invoeren | 1 | Zit in S01. Geen plak-ondersteuning voor een volledige join-URL, geen visuele codeformattering, Enter/submit niet bedraad. |
| S04 | Naam kiezen | 2 | Voorinvulling, foutpad en retry werken en zijn vormgegeven. Mist sociaal bewijs (`19 spelers wachten al`) en een tekenteller bij de limiet. |

## Lobby

| # | Scherm | Niveau | Wat er nog mist |
|---|---|---|---|
| S05 | Hostlobby | 2 | Compositie, ruimte en deelblok staan. Code/QR nog achter knoppen in plaats van permanent (D-018 gekozen, `room-header.mjs` gebouwd maar niet ingehangen). Geen lege staat met uitnodigingstekst. Start niet sticky. |
| S06 | Spelerslobby | 1 | Geen eigen variant: speler ziet hetzelfde scherm als de host, zonder eigen naam/identiteit en zonder `Nodig iemand uit`. |

## Ronde

| # | Scherm | Niveau | Wat er nog mist |
|---|---|---|---|
| S07 | Countdown | 0 | Bestaat niet. De vraag verschijnt direct; geen gezamenlijk startmoment. |
| S08 | Meerkeuzevraag | 1 | Vraag, vlag, opties en timer werken. Letter/vorm-identiteit bewust uitgesteld (D-021). Timer is een getal, geen progressbalk. |
| S09 | Echt of Nep | 0 | Niet in multiplayer gebouwd; alleen singleplayer. |
| S10 | Hoger of Lager | 0 | Buiten de huidige lanceerscope. |
| S11 | Antwoord versturen | 1 | Vergrendeling en statustekst werken. Status staat naast de component in plaats van erin (D-021, bewust). |
| S12 | Antwoord bevestigd | 1 | Voortgang `3/7 beantwoord` werkt. Geen `Wachten op 4 spelers…`-formulering, geen afgeronde teller bij grote rooms. |

## Uitslag

| # | Scherm | Niveau | Wat er nog mist |
|---|---|---|---|
| S13 | Ronde-reveal | 1 | Correct antwoord, eigen keuze en punten verschijnen. Geen eigen fase met opbouw, geen rankbeweging, geen antwoordverdeling. |
| S14 | Sociale headline | 0 | Bestaat niet. Geen selectielogica, geen copy, geen plek in de flow. |
| S15 | Leaderboard | 1 | Top vijf plus eigen rij werkt. Geen bewegingsindicatie (`↑2`), geen rankanimatie, geen tie-regel. |
| S20 | Podium | 1 | Top drie en eigen positie werken. Emoji-medailles zijn placeholders (D-015). Geen 3→2→1-opbouw, geen `Deel uitslag`/`Nieuw spel`. |

## Beheer, pauze en fouten

| # | Scherm | Niveau | Wat er nog mist |
|---|---|---|---|
| S16 | Pauze | 1 | Overlay met reden werkt voor speler en host. Host krijgt geen beheermodus zoals `03` §4.4 beschrijft, alleen hervatten. |
| S17 | Spelers beheren | 1 | Lijst met verwijderen werkt, met bevestiging. Zit in de hostbalk, niet in een bottom sheet (S17). Toont dezelfde namen dubbel naast de lobbylijst. |
| S18 | Voorkeuren | 1 | Taal en thema werken en zijn toegankelijk. Zwevend paneel in plaats van bottom sheet — expliciet afgeraden in het benchmarkrapport §9. Geen geluidsinstelling. |
| S19 | Reconnecting | 1 | Statusbalk met reden werkt; transportlaag doet backoff. Geen `Opnieuw proberen` na enkele seconden, geen definitieve terugvalroute. |
| S21 | Game beëindigd / verlopen | 0 | Geen eigen scherm. De foutcodes en teksten bestaan (`edge-case-messaging`), maar er is geen bestemming die ze toont met een terugkeeractie. |

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Aantal schermen | 6 | 13 | 2 | 0 |

## Waar de reis hapert

Lees de tabel als doorloop en er valt één gat op. Van landing tot lobby komt
iemand er prima doorheen — dat zijn ook de enige twee 2'en. Maar zodra de game
begint, verdwijnt de dramaturgie:

`S07 countdown = 0` → er is geen gezamenlijk startmoment.
`S13 reveal = 1` → de uitslag is een tekstregel.
`S14 sociale headline = 0` → er is geen groepsmoment.

Dat is precies wat de roadmap "reveal/leaderboard" noemt en op *zeer hoge*
impact zet. Drie schermen die samen bepalen of dit als een game voelt of als
een formulier — en het is het dunste stuk van de hele reis.
