# Review — GF7 teams/spectator en GF8 protocolinterface

## Oordeel

**GF7 nog niet uitvoeren. GF8 eerst bijstellen en daarna als voorstel uitvoeren.**

De prompts herkennen terecht dat teamkeuze een publiek protocolgat is en dat de
flow-eigenaar dat contract niet zelfstandig mag invullen. Er blijft echter één
blocker in de volgorde van de joinflow zitten, plus enkele belangrijke ontbrekende
protocolvragen.

## Bevindingen

### 1. Blocker — teamkeuze past niet tussen de bestaande joinstappen

`GAME-FLOW.md` plaatst teamkeuze na naamkeuze en vóór de lobby. Het bestaande
`POST /api/v1/games/join` maakt meteen een sessie en speler aan en geeft een state
terug; de joinflow gaat daarna rechtstreeks naar lobby of de actuele gamefase. Een
later `player:choose-team`-event vereist juist die reeds aangemaakte sessie.

Er zijn minstens drie wezenlijk verschillende contracten mogelijk: teamkeuze in de
joinrequest, een beperkte pre-join-sessie, of een verplichte tussenstate ná formeel
joinen. GF7 kiest nu impliciet de laatste route. Voeg dit als hoofdvraag toe aan GF8
en laat GF7 wachten op het antwoord.

### 2. Hoog — teamnaam en team-ID worden door elkaar gebruikt

GF7 ontvangt `availableTeams: string[]`, selecteert een `selectedTeam: string`, maar
bevestigt vervolgens een `teamId`. `DATA-MODEL.md` heeft `teamNames: []` in de
configuratie en `Player.teamId`, zonder mapping of uniciteitsregel. Ook
`{ team: string }` zegt niet of dit een naam of stabiele ID is.

GF8 moet expliciet vragen of de client op ID of naam kiest, waar een lijst zoals
`{ teamId, displayName }` vandaan komt en of teamnamen uniek moeten zijn. Dit raakt
zowel PROTOCOL als DATA-MODEL.

### 3. Hoog — spectatorroute is qua reducer herbruikbaar, maar niet end-to-end gedekt

Route-resolver, match-phase-state en edge-case-messaging hebben terecht geen aparte
spectatorvariant nodig. `PROTOCOL.md` kent echter alleen host/player-rollen en geen
read-only authenticatie, subscribe-mechanisme of veilige spectatorprojectie van
persoonlijke snapshot-/eventvelden.

Maak hiervan een extra punt in GF8. Formuleer GF7 als: *geen nieuwe pure
flow-statemodule nodig; integratie geblokkeerd op spectator-auth/subscription en een
veilige spectatorprojectie*.

### 4. Hoog — alleen een clientevent is onvoldoende

De reducer verwacht `TEAM_CONFIRMED`, ook bij automatische indeling, maar GF8 stelt
alleen het clientevent `player:choose-team` voor. Nog open is hoe de definitieve
toewijzing binnenkomt: ack, `room:player-changed`, een nieuw gericht serverevent of
snapshot. Automatische indeling heeft bovendien geen voorafgaande clientactie waarop
een ack kan volgen. Laat GF8 command, bevestiging/broadcast en idempotentie samen
voorleggen.

### 5. Hoog — GF8 heeft een onduidelijke afhankelijkheid van GF7

GF8 noemt `team-selection-state.mjs` als bron en zeven gebouwde modules uit GF0–GF6.
Na uitvoering van GF7 zijn het acht modules; vóór uitvoering bestaat het genoemde
bestand niet. Maak GF8 uitvoerbaar zonder GF7-code: verwijs voor het teamitem naar de
GF7-prompt en toon de GF7-signatuur apart als onbevestigd ontwerp. Zo kan GF8 juist
de blokkade oplossen vóór GF7 begint.

### 6. Middel — `pausedState` wordt aan de verkeerde bronvorm gekoppeld

De volledige vorm met `remainingMs` en `pausedAt` staat in `DATA-MODEL.md`;
`PROTOCOL.md` noemt bij `game:paused` alleen reden en vorige fase. Laat GF8 daarom
apart bevestigen of de snapshot de DATA-MODEL-vorm bevat en of het live event die
volledige vorm of slechts een subset draagt.

### 7. Middel — “geen functie gooit” is niet aantoonbaar getest

De tien tests dekken geen ongeldige `availableTeams`, ongeldige state, malformed
events of vreemde IDs. Voeg dezelfde invalid-inputtests toe als bij de andere
flowmodules. Leg ook vast dat de inputarray wordt gekopieerd, zodat externe mutatie
de reducerstate niet achteraf verandert.

## Wat al goed staat

- GF7 neemt teamscore en automatische verdeling terecht niet over van de server- en
  game-rules-laag.
- Een pure reducer met abstracte requestprojectie past goed zodra joinmoment en
  teamidentifier bevestigd zijn.
- GF8 is terecht een voorstel, geen ADR of wijziging aan `PROTOCOL.md`.
- De bestaande aannames zijn helder naar hun bronmodules te herleiden.

## Aanbevolen volgorde

1. Werk GF8 bij met joinvolgorde, teamidentifier, serverbevestiging en
   spectator-auth/projectie.
2. Voer GF8 uit en laat PROTOCOL/DATA-MODEL de contractvragen beantwoorden.
3. Pas daarna GF7 aan en voer de reducer met robuustheidstests uit.
