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
| S04 | Naam kiezen | 1 | Voorinvulling, foutpad en retry werken en zijn vormgegeven. Mist twee harde `04`-criteria: sociaal bewijs (`19 spelers wachten al`) én een tekenteller bij de limiet — per `NIVEAUS.md` regel 1 ("half niveau 2 blijft een 1") is dit dus geen 2, hoe compleet de rest ook aanvoelt. |

## Lobby

| # | Scherm | Niveau | Wat er nog mist |
|---|---|---|---|
| S05 | Hostlobby | 1 | Compositie, ruimte en deelblok staan, maar drie `04`-criteria ontbreken tegelijk: permanente QR/code (`D-018`, een BESLOTEN eis — `room-header.mjs` bestaat al maar hangt nergens), een lege staat met uitnodigingstekst, en een sticky startknop. Drie missende criteria is geen 2 (`NIVEAUS.md` regel 1). |
| S06 | Spelerslobby | 1 | Geen eigen variant: speler ziet hetzelfde scherm als de host (toevallig geen hostcontrols dankzij een generieke `isHost`-check, geen bewust ontworpen spelersscherm), zonder eigen naam/identiteit en zonder `Nodig iemand uit`. Grensgeval met niveau 0 — er is nooit een los spelersscherm gebouwd, alleen hergebruikt. |

## Ronde

| # | Scherm | Niveau | Wat er nog mist |
|---|---|---|---|
| S07 | Countdown | 0 | Bestaat niet. De vraag verschijnt direct; geen gezamenlijk startmoment. |
| S08 | Meerkeuzevraag | 1 | Vraag, vlag, opties en timer werken. Letter/vorm-identiteit bewust uitgesteld (D-021). Timer is een getal, geen progressbalk. |
| S09 | Echt of Nep | 0 | Niet in multiplayer gebouwd; alleen singleplayer. |
| S10 | Hoger of Lager | 0 | Buiten de huidige lanceerscope. |
| S11 | Antwoord versturen | 1 | Vergrendeling en statustekst werken. Status staat naast de component in plaats van erin (D-021, bewust). |
| S12 | Antwoord bevestigd | 1 | Voortgang `3/7 beantwoord` werkt. Geen `Wachten op 4 spelers…`-formulering, geen afgeronde teller bij grote rooms. |

**Let op bij het inschatten van deze sectie:** de rijen staan gelijkwaardig in
de tabel, maar de bouwomvang loopt sterk uiteen. `S07` is een volledig nieuwe
fase/scherm (niveau 0 → er bestaat nog niets). `S11`/`S12` zijn tekst- en
statuswijzigingen bínnen het al bestaande `gameplay.mjs` — geen nieuw bestand,
geen nieuwe fase. Wie hier tickets van maakt op rijgrootte alleen, onderschat
`S07` en overschat `S11`/`S12`.

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
| S16 | Pauze | 1 | Overlay met reden werkt voor speler en host, incl. hervatten. **Precisering:** de beheeracties uit `03` §4.4 (vergrendelen/verwijderen/beëindigen) *bestaan al* in de hostbalk en `availableHostActions()` berekent zelfs correct dat ze tijdens `PAUSED` beschikbaar zijn — het echte probleem is dat de pauze-overlay (`position:fixed`) er visueel overheen ligt en ze onbereikbaar maakt. Exact hetzelfde probleem is al opgelost voor de Hervat-knop specifiek (die staat daarom ín de overlay). Dit is dus geen nieuwe UI bouwen, maar drie bestaande knoppen ook in de overlay tonen. |
| S17 | Spelers beheren | 1 | Drie losse dingen: (a) verwijderen werkt met bevestiging, (b) zit in de hostbalk i.p.v. een bottom sheet zoals `04` voorschrijft, (c) **dezelfde spelersnamen staan dubbel op het scherm** — de lobbylijst en de hostbalk se beheerlijst tonen allebei dezelfde `participants`-Map tegelijk, onafhankelijk van elkaar opgebouwd. (c) is een concreet, apart oplosbaar issue, geïntroduceerd bij het bouwen van de hostbalk, en verdient een eigen fix, niet alleen deze bijzin. |
| S18 | Voorkeuren | 1 | Taal en thema werken en zijn toegankelijk. Zwevend paneel in plaats van bottom sheet — expliciet afgeraden in het benchmarkrapport §9. Geen geluidsinstelling. |
| S19 | Reconnecting | 1 | Statusbalk met reden werkt; transportlaag doet backoff. Geen `Opnieuw proberen` na enkele seconden, geen definitieve terugvalroute. |
| S21 | Game beëindigd / verlopen | 1 | **Niet "0, bestaat niet":** voor `session:kicked`/`session:revoked` bestaat al een minimaal eindscherm (`session-shell.mjs`'s `terminate()` — bericht + terugkeeractie). Wat ontbreekt zijn de andere drie oorzaken uit `04`: host beëindigt vroeg, room verlopen, technische beëindiging. Open vraag, nergens getest: `finish` is beschikbaar in élke fase behalve `FINISHED`, dus een host die vanuit een lege `LOBBY` beëindigt routeert vermoedelijk naar het podiumscherm met nul gespeelde rondes — waarschijnlijk onzinnig, niet als eigen state afgevangen. |

## Randgevallen zonder eigen schermnummer

`03` beschrijft deze expliciet, maar ze hebben geen `S`-nummer in `04` en
stonden daarom nergens getrackt — niet in dit gebied, niet in een van de
andere vier.

| Randgeval | Niveau | Toelichting |
|---|---|---|
| Dubbele tab (`03` §7) | 0 | "De nieuwste of eerste actieve sessie moet deterministisch leidend zijn." Niets in de code regelt dit; twee tabs met dezelfde `sessionToken` roepen allebei `connect()` aan met onbekend resultaat. Ongetest. |
| Gedifferentieerde foutafhandeling bij `ROOM_VALIDATING` (`03` §5.1) | 1 | "Iedere fout heeft een specifieke vervolgstap" — maar `join.mjs` toont voor alle 23 foutcodes dezelfde generieke `Opnieuw proberen`-knop. `Room zit vol` of `code bestaat niet` opnieuw proberen is zinloos; dat verdient een andere vervolgactie (terug naar start) dan een netwerkfout. De teksten zelf zijn wel compleet en vertaald (zie thema 4) — dit gaat om de vervolgáctie per fout, niet om de tekst. |

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Aantal schermen | 6 | 15 | 0 | 0 |
| Randgevallen (nieuw) | 1 | 1 | 0 | 0 |

## Waar de reis hapert

**Gecorrigeerd na review:** deze sectie zei eerder dat landing→lobby "prima"
gaat en noemde `S04`/`S05` de enige twee 2'en. Beide bleken bij toetsing aan
`NIVEAUS.md` regel 1 niet volledig te voldoen (zie hun rijen hierboven) en
staan nu op 1. Er staat dus nergens in dit hele gebied een scherm op niveau 2
— ook het begin van de reis is pas "het staat er", niet "het is ontworpen".
Dat is een eerlijker, kritischer uitgangspunt dan de vorige versie van dit
document suggereerde.

Los daarvan valt met de tabel als doorloop nog steeds hetzelfde gat op zodra
de game zelf begint:

`S07 countdown = 0` → er is geen gezamenlijk startmoment.
`S13 reveal = 1` → de uitslag is een tekstregel.
`S14 sociale headline = 0` → er is geen groepsmoment.

Dat is precies wat de roadmap "reveal/leaderboard" noemt en op *zeer hoge*
impact zet. Drie schermen die samen bepalen of dit als een game voelt of als
een formulier — en het is het dunste stuk van de hele reis. Dat blijft de
grootste hefboom, ook na de correctie hierboven.
