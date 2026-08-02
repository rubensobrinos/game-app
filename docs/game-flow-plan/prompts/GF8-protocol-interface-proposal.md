# Prompt — GF8: Interfacevoorstel voor PROTOCOL.md

Onderdeel van [`../README.md`](../README.md), fase GF8. Dit is **geen ADR en geen
codewijziging** — het is één samenhangend leesdocument voor de `PROTOCOL.md`-
eigenaar, dat alle aannames bundelt die de gebouwde `client/flow/`-modules (GF0–GF6)
al moesten maken omdat het wire-contract op die punten nog niets vastlegt.

**Bijgesteld na [`REVIEW-GF7-GF8.md`](REVIEW-GF7-GF8.md).** Die review wees uit dat
de vorige versie een echte blocker miste (waar teamkeuze in de joinvolgorde past) en
vier punten te vaag liet. Deze versie is uitvoerbaar **zonder dat GF7 al gebouwd
is** — dat was zelf ook een bevinding (#5 in de review): GF8 moet los van GF7 kunnen
draaien, niet ernaar verwijzen als bestaande code.

## Waarom dit nu, en niet later

Elke keer dat twee losse stukken van dit plan naast elkaar klaar waren, bleek een
aanname die in isolatie prima leek, ergens tegen een andere aanname aan te schuren.
De aannames hieronder raken het wire-contract zelf — daar is een latere verrassing
duurder dan een testfix. Vandaar bundelen vóórdat GF7 iets bouwt op een aanname die
misschien niet klopt.

## Te produceren bestand

`docs/game-flow-plan/protocol-interface-proposal.md` — géén nieuwe modulecode, géén
tests. Structuur:

### 1. Hoofdvraag — waar past teamkeuze in de joinvolgorde?

Dit is de blocker uit de review, vóór alle andere teampunten. `POST
/api/v1/games/join` maakt vandaag in één stap een sessie + speler aan en de joinflow
gaat daarna direct naar lobby of de actuele gamefase. `GAME-FLOW.md` plaatst
teamkeuze echter "na naamkeuze en vóór de lobby". Leg minstens deze drie opties voor,
zonder er zelf één te kiezen:

- **(a) Team in de joinrequest zelf** — `POST /api/v1/games/join` krijgt een
  optioneel `team`-veld; de speler kiest vóór er een sessie bestaat. Vereist dat de
  beschikbare teams al bekend zijn vóórdat iemand joint (bijvoorbeeld via de
  invite-validatie of een publiek deel van de roomconfig).
- **(b) Beperkte pre-join-sessie** — een tijdelijke, niet-volwaardige sessie
  uitsluitend om een team te kiezen; pas daarna volgt de "echte" join.
- **(c) Verplichte tussenstate ná formeel joinen, vóór de lobby zichtbaar wordt** —
  wat `GF7`'s reducer nu impliciet aanneemt: de sessie bestaat al, de client houdt de
  lobby-UI bewust vast totdat een team-event is afgerond.

`GF7` mag pas verder zodra hier een keuze ligt — de reducer-vorm hangt hier
inhoudelijk van af.

### 2. Team-identifier

`DATA-MODEL.md` kent `teamNames: string[]` in de config en `Player.teamId`, zonder
mapping of uniciteitsregel. Vragen:

- Kiest de client op een stabiele `teamId`, of op de zichtbare naam?
- Komt er een lijst `{ teamId, displayName }[]` in plaats van kale `teamNames`?
- Moeten teamnamen uniek zijn binnen een room (zoals spelersnamen dat al zijn)?

### 3. Serverbevestiging en automatische toewijzing

Alleen een clientevent voorstellen is onvoldoende (review #4). Vragen:

- Hoe komt de bevestiging terug: een ack op het client-event, een nieuw gericht
  serverevent, een uitbreiding van `room:player-changed`, of alleen via de
  eerstvolgende snapshot?
- Bij automatische indeling (geen voorafgaande clientactie): welk signaal
  informeert de speler over het toegewezen team?
- Idempotentie: wat gebeurt er bij een dubbele/herhaalde teamkeuze-poging (zelfde
  patroon als `round:answer`'s `actionId`-afhandeling, of iets anders)?

### 4. Spectator-auth, subscription en veilige projectie

`route-resolver`, `match-phase-state` en `edge-case-messaging` hebben geen aparte
spectatorvariant nodig als pure reducers (review #3) — maar `PROTOCOL.md` kent alleen
`host`/`player`-rollen, geen read-only rol. Vragen:

- Hoe authenticeert/identificeert een spectator zich, zonder host- of spelersrol?
- Hoe abonneert een spectator zich op roomupdates (dezelfde socketroom? een aparte
  read-only kanaal?)
- Welke velden uit snapshot/events moeten voor een spectator wég-geprojecteerd
  worden (bijvoorbeeld individuele antwoorden of namen die niet voor een
  niet-deelnemer bedoeld zijn)?

### 5. `pausedState` — twee losse vragen, niet één

De vorige versie van dit voorstel koppelde de volledige `DATA-MODEL.md`-vorm
(`previousPhase`, `remainingMs`, `reason`, `pausedAt`) direct aan zowel de snapshot
als het live event. Dat klopt niet vanzelfsprekend (review #6) — `PROTOCOL.md` noemt
voor het live `game:paused`-event alleen "reden, vorige fase". Twee aparte vragen:

- Bevat de `room:state`-snapshot een `pausedState`-veld in de volledige
  `DATA-MODEL.md`-vorm?
- Draagt het live `game:paused`-*event* diezelfde volledige vorm, of alleen
  `reason`/`previousPhase`, met `remainingMs`/`pausedAt` elders of afwezig?

### 6. Naamsuggestie vóór join

Ongewijzigd t.o.v. de vorige versie: komt er een licht `GET`-previewendpoint, of is
de eerste getoonde naam bewust lokaal/voorlopig en pas bij join definitief? (Bron:
`join-state.mjs`, zie `GF2a-join-state.md` §Open spec-vraag.)

### 7. `game:paused`-reden-enum

Ongewijzigd: wat is de volledige, officiële lijst mogelijke `reason`-waarden voor
`game:paused`? (Bron: `edge-case-messaging.mjs`, zie `GF5-edge-case-messaging.md`
§Open spec-vraag.)

### 8. Wat al zelf is opgelost (ter info, geen actie nodig)

- `joinSource` (`qr` vs `shared_link`): opgelost via een `src`-queryparameter op de
  gegenereerde QR- resp. kopieerlink (`share-actions.mjs`, zie
  `GF6-share-actions.md`). Geen wijziging aan `PROTOCOL.md` nodig.

### 9. Cross-team item, niet voor deze eigenaar

- `PRODUCT.md` vs. `DATA-MODEL.md`: de Groepsbattle-preset heeft 4 spelvormen
  volgens `PRODUCT.md`, 5 volgens `DATA-MODEL.md`'s voorbeeldconfig (zie
  `GF2b-host-setup-state.md` §Gevonden tegenstrijdigheid). Alleen genoemd voor
  volledigheid — hoort bij de `data-model`-eigenaar.

### 10. Bijlage: functiesignaturen als concreet reviewmateriaal

Twee soorten materiaal, expliciet niet door elkaar presenteren:

- **Gebouwd en getest (GF0–GF6):** kopieer de JSDoc-typedefs van de zeven publieke
  module-exports (`route-resolver`, `join-state`, `host-setup-state`,
  `match-phase-state`, `reconnect-state`, `edge-case-messaging`, `share-actions`)
  rechtstreeks uit hun bronbestanden in `client/flow/`.
- **Nog niet gebouwd, alleen ontwerp (GF7):** neem de `team-selection-state`-
  signatuur over uit [`GF7-teams-and-spectator.md`](GF7-teams-and-spectator.md) en
  markeer die expliciet als **onbevestigd ontwerp, nog geen code** — dit bestand
  (`team-selection-state.mjs`) bestaat pas ná antwoord op vraag 1 hierboven, en zal
  daarna waarschijnlijk wijzigen.

## Regels

- Dit document verandert niets aan bestaande code of specs. Puur samenvattend en
  vragend.
- Geen van de tien punten wordt hier "opgelost" door zelf een keuze te maken — elk
  blijft een vraag, ook waar een voorstel ter overweging bij staat.
- Behandel vraag 1 (joinvolgorde) als voorwaardelijk voor de rest van het
  teamgedeelte (vragen 2–3) — zonder antwoord daarop zijn 2 en 3 nog niet eens goed
  te formuleren in een concreet contractvoorstel.

## Niet in scope voor GF8

- Zelf een ADR schrijven namens de `PROTOCOL.md`-eigenaar — `public_api` blijft
  ADR-plichtig bij hen (`devkit policy --json`).
- Wijzigingen aan `client/flow/`-modules op basis van verwachte antwoorden — pas ná
  een echt antwoord.
- Het cross-team `PRODUCT.md`/`DATA-MODEL.md`-punt inhoudelijk oplossen — alleen
  doorverwijzen.
- GF7 daadwerkelijk uitvoeren of herschrijven — dat gebeurt pas ná antwoord, als
  aparte stap.

## Definition of done

- `docs/game-flow-plan/protocol-interface-proposal.md` bestaat, met alle tien de
  secties hierboven.
- Vraag 1 (joinvolgorde) staat expliciet vóór vraag 2/3 en benoemt alle drie de
  opties zonder een voorkeur uit te spreken.
- Het document is leesbaar en zelfstandig te reviewen zonder dat `GF7` al is
  uitgevoerd.
- Geen enkel bestand buiten dit ene document is gewijzigd.
