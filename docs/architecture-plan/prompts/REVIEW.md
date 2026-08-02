# Review — AR0 + AR1 state machine

Reviewdatum: 2026-08-02

## Conclusie

De prompt is goed afgebakend, zelfstandig leesbaar en zorgvuldig terughoudend met
dependencies en protocolbesluiten. Voor uitvoering moeten enkele overgangscontracten
echter preciezer worden gemaakt. In de huidige vorm moet de uitvoerder zelf
architectuurkeuzes invullen die de prompt juist buiten scope zet.

## Bevindingen

### 1. Hoog — de keuze na `SCOREBOARD` heeft geen invoer

De reducer moet na `SCOREBOARD` kiezen tussen een volgende ronde en `FINISHED`, maar
`roundIndex`, `totalRounds` en matchopbouw staan expliciet buiten scope. De voorgestelde
API bevat evenmin een eventveld dat de gewenste tak aangeeft. De reducer kan deze keuze
dus niet deterministisch maken zonder verborgen kennis of een nieuwe beleidsbeslissing.

**Voorstel:** laat de aanroeper de reeds bepaalde bestemming expliciet meegeven,
bijvoorbeeld `TIMER_ELAPSED`/`HOST_NEXT` met `nextPhase: "COUNTDOWN" | "ROUND_ACTIVE"
| "FINISHED"`, en valideer per bronfase welke bestemmingen zijn toegestaan. Een
alternatief is `isLastRound`, maar dan lekt ronde-bookkeeping alsnog bewust het
reducercontract in. Leg vast wie beslist of er nog een ronde volgt.

### 2. Hoog — het `HOST_PAUSE`-eventschema mist `remainingMs`

De tekst zegt dat de aanroeper `remainingMs` aan het pauze-event levert, maar het
event staat beschreven als alleen `HOST_PAUSE ({ reason })`. Daarmee kan de reducer
het vereiste `pausedState`-object niet opbouwen.

**Voorstel:** specificeer exact
`{ type: "HOST_PAUSE", reason: string, remainingMs: number }`; `pausedAt` komt uit
het vaste `now`-argument. Leg grensgedrag vast voor een negatieve of niet-eindige
`remainingMs` en voor een ontbrekende reden.

### 3. Hoog — direct hervatten naar `previousPhase` botst met herstelgedrag

De prompt eist dat `HOST_RESUME` rechtstreeks teruggaat naar `previousPhase`.
`ARCHITECTURE.md` zegt voor herstel na een serverrestart echter dat de room naar
`PAUSED` gaat en wordt hervat met een nieuwe korte countdown. `PROTOCOL.md` noemt bij
`game:resumed` eveneens "nieuwe countdown/tijden". Bovendien moeten absolute
`startsAt`/`endsAt` na iedere pauze opnieuw worden gepland; alleen de fase terugzetten
is daarvoor onvoldoende.

**Voorstel:** scheid handmatige pauze van herstelpauze, of laat `HOST_RESUME` een door
de aanroeper bepaalde en gevalideerde hervatbestemming plus nieuwe timing accepteren.
Als AR1 alleen handmatige pauze dekt, zeg dat expliciet en zet restart recovery buiten
scope. Bewaar `previousPhase` als context, niet automatisch als enige geldige
bestemming.

### 4. Hoog — scoreboardfrequentie ontbreekt in het overgangsmodel

`GameConfiguration.scoreboardFrequency` kan `every_round`, periodiek of uit zijn.
Toch verplicht het happy path na elke `ROUND_RESULT` de fase `SCOREBOARD`. Bij host-tempo
zegt `GAME-RULES.md` dat de game wacht na de uitslag **of** tussenstand; welke van die
twee wachtfasen optreedt hangt dus van de configuratie af.

**Voorstel:** maak de geldige bestemming na `ROUND_RESULT` expliciet:
`SCOREBOARD` wanneer er een tussenstand wordt getoond, anders de volgende ronde of
`FINISHED`. Laat de aanroeper de weergavebeslissing nemen, zodat
`scoreboardFrequency` niet aan deze pure reducer hoeft te worden toegevoegd.

### 5. Middel — "7 concrete testgevallen" zijn testcategorieën

De zeven punten bevatten meerdere fasen, pacingvarianten en uitkomsten, maar geen
exacte inputstates/events of volledig verwachte outputstates. Vooral "elke pijl voor
beide pacingwaarden" is ambigu omdat dezelfde pijl per pacing een andere eigenaar
heeft en sommige paden afhankelijk zijn van laatste ronde en scoreboardfrequentie.

**Voorstel:** maak een overgangstabel met minimaal: bronfase, pacing, event,
eventpayload, verwachte doelfase en `ok/code`. Voeg afzonderlijke fixtures toe voor
de volgende-ronde-, laatste-ronde- en scoreboard-overslaan-takken. Parameterized
tests mogen, zolang iedere rij een exacte verwachting heeft.

### 6. Middel — het state- en eventcontract is onvoldoende gedefinieerd

`MatchState` bevat volgens de prompt `phase`, `pausedState` en `pacing`, maar
`DATA-MODEL.md` plaatst `pacing` in `Room.config` en niet in `Match`. De concrete
eventvormen zijn op één gedeeltelijk pausevoorbeeld na niet gegeven. Hierdoor kan
iedere implementatie een ander intern contract kiezen en kunnen latere modules er
niet betrouwbaar op aansluiten.

**Voorstel:** presenteer een minimaal intern, niet-bindend contract, bijvoorbeeld:
`{ phase, pacing, pausedState }`, plus een discriminated union voor alle events.
Noteer expliciet dat `pacing` door de aanroeper uit roomconfig wordt geprojecteerd en
niet stilzwijgend aan het persistente `Match`-model wordt toegevoegd. Gebruik in de
prompt JavaScript/JSDoc als JavaScript het gevraagde uitvoerformaat blijft; het huidige
TypeScript-API-fragment kan anders onbedoeld TypeScript-uitvoer suggereren.

### 7. Middel — state-invarianten bij finish en mislukte transities ontbreken

`HOST_FINISH` is ook vanuit `PAUSED` toegestaan, maar de prompt zegt niet of
`pausedState` dan wordt gewist. Evenmin staat expliciet dat de invoerstate niet mag
worden gemuteerd en dat een afgewezen transitie geen statewijziging veroorzaakt.

**Voorstel:** eis voor iedere niet-`PAUSED` doelfase `pausedState: null`; zet bij
finish eventueel ook `finishedAt` buiten scope in plaats van het impliciet toe te
voegen. Eis een nieuwe state bij succes, geen mutatie van input, en test dat afwijzing
de oorspronkelijke state intact laat.

### 8. Laag — enkele randgevallen en formuleringen kunnen exact worden gemaakt

- `HOST_START` mist een test, ondanks het expliciete contract.
- Onbekende events en ongeldige fase-/pacingwaarden hebben geen verwacht resultaat.
- "genegeerd/afgewezen" laat twee gedragingen open; de API ondersteunt concreet
  `{ ok: false, code }`, dus kies "afgewezen".
- `HOST_PAUSE` vanuit `COUNTDOWN`, `ROUND_ACTIVE`, `ROUND_RESULT` en `SCOREBOARD`
  kan beter expliciet worden opgesomd dan "elke actieve fase".
- Corrigeer `test baar` naar `testbaar`.

## Wat al goed staat

- Stap 0 bewaakt terecht de architectuurgoedkeuring voordat buiten `docs/` wordt
  geschreven.
- De reducer blijft puur, deterministisch en dependency-vrij.
- De fasewaarden en vorm van `pausedState` zijn correct uit de bronnen overgenomen.
- Timer- versus hosteigenaarschap is als expliciete verantwoordelijkheid benoemd.
- Autorisatie en de minimale-spelerscheck blijven terecht bij de aanroeper.
- Redis, sockets, timers en protocol-ADR's blijven buiten AR1.
- De promptindex beperkt zich bewust tot de fase die nu aan de beurt is.

## Advies vóór uitvoering

Los minimaal bevindingen 1–4 op en leg daarna het minimale state-/eventcontract uit
bevinding 6 vast. Maak vervolgens de tests tabelgedreven met exacte verwachtingen.
Daarna is de prompt uitvoerbaar zonder dat de implementerende agent zelf ontbrekende
architectuurregels hoeft te verzinnen.
