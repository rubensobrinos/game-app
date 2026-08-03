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
| S02 | Spel aanpassen | 1 | **Gebouwd (prompt 09):** `views/host-setup.mjs`, gemount door `home.mjs` zodra de nieuwe tertiaire `Spel aanpassen`-link `OPEN_ADVANCED` dispatcht (geen eigen route). Drie van de vijf `04`-groepen volledig bouwbaar en gebouwd, progressief onthuld via `<details>`: moeilijkheid/taal, aantal rondes, aanvullende regels (tempo/snelheidsbonus/laat-meedoen/zelf-meedoen). `Start met deze instellingen` hergebruikt `createRequestFor` ongewijzigd; geverifieerd tot en met de reducer dat gewijzigde velden (`difficulty`/`totalRounds`) daadwerkelijk aankomen bij `createGame` (mock's `room.config` bevestigt dit — al negeert de mock `totalRounds` zelf bewust voor de vraaginhoud, gedocumenteerd in `transport-mock.mjs`, dus dat is niet in de gameplay zelf zichtbaar). `Herstel standaardinstellingen` reset config/naam maar niet `state.mode` (blijft op het geavanceerde scherm). Nieuwe `CLOSE_ADVANCED`-event toegevoegd aan `host-setup-state.mjs` (symmetrisch met `OPEN_ADVANCED`) zodat teruggaan geen keuzes verliest — ontbrak nog, nodig voor dat acceptatiecriterium. Twee groepen bewust NIET interactief (`UI-17`, HANDOFF-UI.md): spelvorm (`gameTypes` kent precies één waarde) en teams/tijd-per-ronde (geen van beide bestaat in `HostConfig`) — beide tonen vaste tekst, geen schijnkeuze. Niet naar niveau 2: twee van de vijf groepen ontbreken, dat zijn expliciete `04`-criteria. |
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
| S13 | Ronde-reveal | 1 | **Opbouw als reeks gebouwd (prompt 07), bewust twee stappen i.p.v. zes:** `reveal-model.mjs` (puur, `node:test`) bepaalt of de sociale headline al getoond mag worden — resultaat (antwoord/eigen keuze/label/punten, die vier horen bij hetzelfde moment) verschijnt meteen, de headline pas na 1,4s (overslaanbaar met een tik op de uitslag, geverifieerd met Playwright). Rankbeweging zit bewust NIET in deze opbouw: `round:ended` komt vóór `scoreboard:updated` (transport-mock.mjs), de bijgewerkte stand voor déze ronde bestaat dus nog niet op het moment dat dit scherm 'm zou tonen — die stap landt op scoreboard.mjs (S15), waar de data wél al klopt. Antwoordverdeling zelf blijft impliciet (via de headline-condities), geen los diagram — dat vroeg `04` ook niet expliciet. |
| S14 | Sociale headline | 1 | **Vier van de zeven typen gebouwd (prompt 07):** `social-headline.mjs` (puur, 14 `node:test`-gevallen) selecteert in prioriteitsvolgorde: (1) enige correct — alléén de self-variant, (2) comeback (≥ 2 plaatsen, gedeeld met S15's `rankMovementFrom()`, toont op scoreboard.mjs), (4) iedereen correct (vergeleken met `eligiblePlayerCount`, niet totaal aantal antwoorden), (5) iedereen fout (met databorging tegen "niemand antwoordde"), (6) opvallende misleider (fout antwoord minstens zo vaak gekozen als het juiste). Geverifieerd met Playwright tegen `transport-mock.mjs`: een ronde goed beantwoord toont "iedereen correct", een ronde fout beantwoord toont "iedereen fout"; comeback apart geverifieerd met een testharnas. Drie typen blijven `HANDOFF` (`UI-16`): "enige correct" voor een ándere speler, snelste speler, streak — alle drie vereisen serverdata die er nu niet is. Niet naar niveau 2: drie van de zeven typen ontbreken nog. |
| S15 | Leaderboard | 1 | **Bewegingsindicatie gebouwd (prompt 08):** `standings-model.mjs`'s nieuwe `rankMovementFrom()` (gedeeld met 07's comeback-detectie, één implementatie) vergelijkt de vorige met de huidige stand; `scoreboard.mjs` toont `↑2`/`↓1`/`—` per rij met een vertaald `aria-label`. Geverifieerd met `node:test` (3 nieuwe gevallen: stijgen, dalen, nieuwe speler zonder vorige positie). **Tie-regel blijft bewust open** (`UI-15`, HANDOFF-UI.md): getest met een tie-scenario, servervolgorde wordt getoond zonder gedeelde-plaats-indicatie — geen eigen aanname, `04` noemt dit zelf al een openstaand productbesluit. Geen rankanimatie (thema 3's territorium, motion-tokens nog niet toegepast hier). |
| S20 | Podium | 1 | **Alle drie de gevraagde stukken gebouwd (prompt 08):** 3→2→1-opbouw (brons→zilver→goud, 1,4s per stap, overslaanbaar met een tik op het podium — geverifieerd met een losse testharnas: 1→2→3 zichtbare stappen na resp. 0/1,5s/1,5s, en direct 3 na de tik); `Deel uitslag` (alléén de eigen score/positie, privacyvriendelijk, geen roomcode/link — klembord-fallback geverifieerd); `Nieuw spel` (host, terug naar start — directe route naar `09-S02-spel-aanpassen.md` zodra die bestaat). Ook toegevoegd, niet expliciet gevraagd maar een reëel gat: `Afsluiten`, nu ook voor niet-hosts (die zaten eerder vast te wachten op een revanche zonder enige uitweg). Emoji-medailles blijven placeholders (D-015), niet aangeraakt. |

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
| Dubbele tab (`03` §7) | 1 | **Gereproduceerd én gedeeltelijk gefixt (prompt 05).** Bevestigd tegen `transport-mock.mjs` (reproductiescript + Playwright, twee tabs in dezelfde browsercontext): een tweede `connect()` met dezelfde `sessionToken` overschrijft stilzwijgend de listener-entry van de eerste tab (`room.listeners.set()`) — die tab ontvangt daarna nooit meer een event, zonder dat 'ie dat zelf weet. **Voorstel, geen vastgelegd besluit** (`00-DESIGN-INDEX.md` §6 punt 9): `BroadcastChannel` (browser-native) laat elke tab zijn opening aankondigen; de oudere tab toont nu een banner zodra een nieuwere tab dezelfde sessie claimt, i.p.v. stil door te draaien. Dit lost de onderliggende overschrijving niet op (transportlaag-gedrag, niet aangeraakt) — maakt 'm alleen zichtbaar. Blijft niveau 1: geen diepere reconciliatie (welke tab definitief "wint", geen geforceerde redirect), en het voorstel zelf wacht nog op bevestiging. |
| Gedifferentieerde foutafhandeling bij `ROOM_VALIDATING` (`03` §5.1) | 2 | **Criterium volledig gehaald (prompt 05):** `join-error-category` (nieuw, `edge-case-messaging.mjs`) onderscheidt drie categorieën op basis van de daadwerkelijk mogelijke join-foutcodes (niet alle 23 — de meeste horen bij een lopende ronde). Blijvend ongeldig (`GAME_NOT_FOUND`/`INVITE_INVALID`): alléén "Terug naar start", geen zinloze retry. Kan veranderen (`GAME_FULL`/`ROOM_LOCKED`/`GAME_ALREADY_STARTED`/`LATE_JOIN_DISABLED`): beide knoppen, "Terug naar start" primair. Tijdelijk/naamfout: ongewijzigd, retry blijft de juiste actie (join-state.mjs's eigen `RETRY`-afhandeling wist de naam al). Geverifieerd met Playwright tegen twee echte scenario's (`GAME_NOT_FOUND`, `ROOM_LOCKED`). |

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Aantal schermen | 3 | 18 | 0 | 0 |
| Randgevallen (nieuw) | 0 | 1 | 1 | 0 |

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
`S13 reveal = 1` → een opbouw in twee stappen, niet meer één tekstregel (prompt 07).
`S14 sociale headline = 1` → vier van de zeven groepsmomenten bestaan nu (prompt 07).

Alle drie zijn niet langer "0" of "één tekstregel", maar geen enkele staat op
niveau 2 — dat blijft precies wat de roadmap "reveal/leaderboard" noemt, zeer
hoge impact, nog steeds het dunste stuk van de reis om tot een écht ontworpen
niveau te tillen. De grootste hefboom is dus verschoven van "bestaat het al"
naar "voelt het als een game" — een ander soort werk, niet minder werk.
