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
| S01 | Landing / Samen spelen | 1 | **Prompt 06 bevestigde: laadstatus en belofte-regel waren al gebouwd (thema 4) vóórdat deze prompt begon** — geen tweede keer gebouwd. Hero-knopstijl visueel gecontroleerd (screenshot): `.btn-primary` (gevuld paars, vet wit) vs. `.btn-secondary` (licht, rand, donkere tekst) zijn al duidelijk te onderscheiden — geen aanpassing nodig, geen `HANDOFF`. Alle drie de `04`-acceptatiecriteria voor Enter/plakken/enkele-dominante-knop zijn nu gehaald (zie S03). Blijft niveau 1: de tertiaire `Spel aanpassen`-link (`04`'s inhoudshiërarchie punt 6) bestaat nog niet — hangt op `09-S02-spel-aanpassen.md`. |
| S02 | Spel aanpassen | 0 | Bestaat niet. Quick-start gebruikt de vaste default; er is geen route naar instellingen. |
| S03 | Roomcode invoeren | 1 | **Alle drie gebouwd (prompt 06):** Enter submit't, live codeformattering ("123 456", `room-header.mjs`'s `formatCode()` hergebruikt en algemener gemaakt — was strikt `=== 6`, nu ook bruikbaar tijdens het typen), en een geplakte volledige join-URL (`/j/{inviteId}`) schakelt rechtstreeks door naar de invite-flow (keuze **a** uit de prompt: geen poging tot "code extraheren" uit een link zonder 6-cijferige code). Geverifieerd met Playwright. Zit nog steeds in S01 (geen eigen scherm), vandaar niveau 1 als kwalificatie van datzelfde scherm, niet als losse regel. |
| S04 | Naam kiezen | 1 | **Beide eerder gevonden gaten nu gedicht:** sociaal bewijs bleek al gebouwd (thema 4, conditioneel — alleen ná een invite-link, nooit ná code-invoer, geverifieerd); tekenteller nu toegevoegd (prompt 06, `graphemeCount()`/`NAME_MAX_GRAPHEMES` geëxporteerd uit `join-state.mjs`, geen `.length`). **Nieuw gevonden bij het uitvoeren, niet gebouwd (buiten prompt 06's scope):** `04`'s inhoudspunt "Je doet mee aan game 482 917" — een roombevestiging op dít scherm — ontbreekt nog; ook viel op dat de teller de invoer alleen zichtbaar markeert, niet live afkapt (het veld toont bv. 25 tekens met een teller die "25/20" zegt, terwijl `join-state.mjs` bij `SUBMIT` al langer stil afkapt op 20 — geen nieuwe validatie toegevoegd, dat zou verder gaan dan wat er al was). Beide zijn kandidaat voor een volgende, kleine correctie. |

## Lobby

| # | Scherm | Niveau | Wat er nog mist |
|---|---|---|---|
| S05 | Hostlobby | 1 | **Permanente QR/code en sticky startknop gebouwd (prompt 02):** `room-header.mjs` hangt nu permanent in `#app-header` (D-018/D-019, geverifieerd met Playwright: zichtbaar tijdens lobby/gameplay/pauze, ook na vergrendelen, verdwijnt pas bij het verlaten van de sessie); `lobby.mjs`'s eigen `show-qr`/`show-code` zijn bewust verwijderd (dubbele ingang) — `native-share`/`copy-link` blijven staan. Startknop is nu `position: sticky` op mobiel. De lege-staattekst bleek al eerder gebouwd (niet nieuw). Blijft op niveau 1: `04` vraagt ook een geluidstoggle in de kop en een tweekoloms compositie op groot scherm — geen van beide bestaat, en de lege staat toont een geruststellende tekst i.p.v. de letterlijk gevraagde `0 spelers`-teller (de teller verbergt zichzelf juist in die staat). Dat zijn compositiecriteria voor niveau 2, geen functionele bugs — buiten scope van deze prompt. |
| S06 | Spelerslobby | 1 | **Niet meer het niveau-0-grensgeval van hiervoor — bewust gebouwd (T4-5, gevonden tijdens het uitvoeren van prompt 03):** `lobby.mjs` toont nu een aparte `lobby-player-status`-sectie voor niet-hosts: eigen naam uitgelicht (`Je speelt als {naam}`), bevestiging (`Je bent binnen`), status (`De host start zo`) en `Nodig iemand uit` — geverifieerd met Playwright via een tweede (niet-host) sessie tegen `transport-mock.mjs`; hostcontrols (startknop, hostbalk) blijven correct verborgen. De `Nodig iemand uit`-actieset is al de kleinere set zonder `show-qr`/`show-code` (prompt 02 verwijderde die voor iedereen). Blijft niveau 1, niet 2: `04`'s "eigen naam **en symbool/kleur**" mist het tweede deel — dat hangt op `D-021` (letter/vorm-identiteit bewust uitgesteld), geen losse bug hier. |

## Ronde

| # | Scherm | Niveau | Wat er nog mist |
|---|---|---|---|
| S07 | Countdown | 1 | **Gebouwd (prompt 04), route A gekozen:** countdown als sub-state van `gameplay.mjs` (geen aparte view/mount-cyclus) — groot getal, afgeleid van `secondsRemaining(countdownEndsAt, offsetMs)`, geen vaste `3`/`2`/`1`-aanname (werkt bij elke serverduur). Geverifieerd met Playwright: verschijnt direct na `Start de game`, telt zichtbaar af, gaat zonder wit scherm over in de eerste vraag. **`UI-13` (HANDOFF-UI.md):** `transport-mock.mjs`'s `COUNTDOWN_MS` (1,2s) is intern tegenstrijdig met `03` §6's richtduur (2,5–3,0s) — aan INT-A of/welke leidend is; de weergave zelf werkt bij beide. Niet gebouwd: rondecontext klein tijdens de countdown, en de vraaginhoud zelf vooraf laden (die twee zijn `04`-niveau-2-composities, geen bug — het huidige protocol levert de vraag toch pas ná de countdown, zie de prompt voor de afweging). |
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
| S16 | Pauze | 1 | **Bereikbaarheidsbug opgelost (prompt 01):** de hostbalk (vergrendelen/verwijderen/beëindigen/hervatten) verplaatst zichzelf nu ín de pauze-overlay zolang `PAUSED` actief is (`session-shell.mjs`'s `renderPauseOverlay`/`restoreHostBarPosition`, geverifieerd met Playwright: alle drie de knoppen bereikbaar, vergrendelen tijdens pauze houdt de overlay open, hervatten zet de balk terug in de normale flow) — geen losse duplicaatknoppen meer nodig, dat probleem was eerder alleen voor Hervat opgelost. Blijft op niveau 1: `04`'s S16 vraagt ook `QR tonen` tijdens pauze, en die permanente code/QR bestaat pas na `02-S05-permanente-qr-code.md` (nog niet uitgevoerd) — dat ene resterende criterium houdt dit van niveau 2. |
| S17 | Spelers beheren | 1 | **Dubbele naamweergave opgelost (prompt 01):** de lobbylijst is nu de enige plek die namen toont tijdens `LOBBY` (met inline verwijderknop voor de host), de eigen lijst van de hostbalk blijft daar verborgen en verschijnt pas in latere fases (`hostbar.mjs`'s `update({phase})`, geverifieerd met Playwright). Verwijderen werkt met bevestiging. Blijft op niveau 1: `04` geeft een ontwerpvoorkeur voor een bottom sheet (mobiel) / paneel (desktop) — deze prompt loste alleen de dubbele-lijst-bug op, geen visuele herontwerp van hoe spelersbeheer gepresenteerd wordt. |
| S18 | Voorkeuren | 1 | Taal en thema werken en zijn toegankelijk. Zwevend paneel in plaats van bottom sheet — expliciet afgeraden in het benchmarkrapport §9. Geen geluidsinstelling. |
| S19 | Reconnecting | 1 | **Terugvalroute toegevoegd (prompt 01):** na `RECONNECT_FALLBACK_MS` (9s) onafgebroken niet-`connected` verschijnt een knop terug naar start (`onLeaveHome`) — de transportlaag blijft zelf de enige die opnieuw `connect()` aanroept, hier wordt niets geforceerd. Daarmee zijn alle vijf `04`-criteria voor S19 nu functioneel aanwezig (statustekst, veilige state blijft zichtbaar, geen antwoordwijziging zonder serverbevestiging, "opnieuw proberen"-vervolgactie, terugvalroute bij definitief falen). Blijft niveau 1, niet 2: dit is een kale knop (`btn-secondary`, geen eigen compositie/hiërarchie-pas) — niveau 2 vraagt om een bewuste visuele uitwerking, niet alleen functionele aanwezigheid (`NIVEAUS.md` regel 1). Geverifieerd via een codetraceren + reproductiescript tegen `reconnect-state.mjs`, niet via Playwright — er bestaat geen haak om een echte disconnect in de browser te simuleren. |
| S21 | Game beëindigd / verlopen | 1 | **Niet "0, bestaat niet":** voor `session:kicked`/`session:revoked` bestaat al een minimaal eindscherm (`session-shell.mjs`'s `terminate()` — bericht + terugkeeractie). Wat ontbreekt zijn de andere drie oorzaken uit `04`: host beëindigt vroeg, room verlopen, technische beëindiging. **Eén deelvraag nu wél gereproduceerd en gefixt (prompt 01):** een host die vanuit een écht lege `LOBBY` (`playerCount: 0`) op "Beëindig" drukt kreeg een leeg podium (`game:finished` → `{podium: [], self: null}`, bevestigd met een reproductiescript tegen `transport-mock.mjs`) — `session-shell.mjs` herkent dat nu (`isEmptyFinish`) en navigeert direct terug naar start i.p.v. dat lege podium te mounten. Niet end-to-end in de browser geverifieerd: `hostParticipates: false` (de enige manier om een écht lege lobby te bereiken) is nog niet bereikbaar via de UI — dat hangt op `09-S02-spel-aanpassen.md`. De andere twee oorzaken (room verlopen, technische beëindiging) blijven openstaand. |

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
| Aantal schermen | 5 | 16 | 0 | 0 |
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

`S07 countdown = 1` → het gezamenlijke startmoment bestaat nu (prompt 04).
`S13 reveal = 1` → de uitslag is een tekstregel.
`S14 sociale headline = 0` → er is geen groepsmoment.

Twee van de drie blijven, en dat is precies wat de roadmap "reveal/
leaderboard" noemt en op *zeer hoge* impact zet — het dunste stuk van de
reis blijft ná de uitslag, niet ervoor. Dat blijft de grootste hefboom.
