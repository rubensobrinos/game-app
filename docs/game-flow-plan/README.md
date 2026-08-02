# Realisatieplan — GAME-FLOW.md

Dit is het uitvoeringsplan voor het onderdeel waar ik verantwoordelijkheid voor heb
genomen: [`docs/multiplayer/GAME-FLOW.md`](../multiplayer/GAME-FLOW.md). Dit document
verandert niets aan de specificatie — het beschrijft hoe ik die specificatie omzet in
geteste client-side flow/state-logica, in welke volgorde, en waar ik moet stoppen om
goedkeuring te vragen.

Zie ook [`docs/multiplayer/README.md`](../multiplayer/README.md) voor de rolverdeling
per document, en [`docs/game-rules-plan/README.md`](../game-rules-plan/README.md) voor
het zusterplan van de agent die `GAME-RULES.md` realiseert — dezelfde grenzen
(devkit policy, autonomie-limieten) gelden hier.

**[`GF-PROGRESS.md`](GF-PROGRESS.md)** houdt de voortgang per sectie van `GAME-FLOW.md`
bij, inclusief openstaande actiepunten — dat bestand bijwerken bij elke
fase-afronding, niet dit plan zelf herschrijven.

## Uitgangspunten

1. **Pure flow/state, geen transport en geen visuele vormgeving.** De module kent geen
   echte `fetch`, geen Socket.IO en geen definitieve CSS/DOM-styling. Ze krijgt
   gebeurtenissen en snapshots binnen in de vorm die `PROTOCOL.md` beschrijft, en geeft
   een client-state + lijst van te versturen intenties terug. Dat is een bewuste grens:
   `PROTOCOL.md` (`public_api`) en `DATA-MODEL.md` (`database_schema`) zijn
   ADR-plichtig volgens `devkit policy --json` en zijn eigendom van andere agents — ik
   consumeer hun contract via een gemockte transportlaag, ik bepaal het niet.
2. **Geen nieuwe dependencies om te beginnen.** De bestaande app heeft geen build-stap
   en geen router-library (`index.html` laadt losse `<script>`-tags, `app.js` bevat geen
   `history`/`hash`-routing). Zolang mijn werk pure route-parsing en state-machines zijn
   zonder DOM, test ik met Node's ingebouwde `node --test` + `node:assert` — nul nieuwe
   packages, dus geen `deps`-goedkeuring nodig. Zodra er wél DOM-rendering of een
   routerkeuze nodig is, leg ik dat als checkpoint neer in plaats van zelf een library
   te kiezen.
3. **Autonomie-limieten blijven gelden.** Max 15 bestanden en 5.000 regels per actie
   (CLAUDE.md). Elke fase hieronder is bewust klein genoeg om binnen die grens te
   passen; grotere fases worden in meerdere commits gesplitst.
4. **Server is autoritair, de client reflecteert alleen.** Niets in deze module
   beslist of een antwoord goed is, welke fase actief is, of wie mag joinen of
   meetellen. Ze vertaalt server-snapshots/events naar UI-state en gebruikersacties
   naar intenties (`round:answer`, `game:start`, …) — nooit andersom.

## Modules

| Module | Verantwoordelijkheid | Bron in GAME-FLOW.md |
| --- | --- | --- |
| `route-resolver` | pad → routetype (`home`/`join`/`game`/`host`/`screen`) + extractie van `inviteId`/`code` | §Routes |
| `session-store` | lokaal bewaren/lezen van sessietoken + minimale herstelgegevens | §Randgeval 2, DATA-MODEL §Lokale clientsessie |
| `join-state` | statemachine QR/link (primair) en code (fallback): validatie → naamkeuze → joinen → gejoind/fout | §Joinflow |
| `host-setup-state` | Snel starten vs. Game instellen, preset, `hostParticipates`-keuze | §Hostflow |
| `match-phase-state` | zuivere reflectie van serverfases (`LOBBY→COUNTDOWN→ROUND_ACTIVE→ROUND_RESULT→SCOREBOARD→FINISHED`, plus `PAUSED`) | §Hoofdroute, ARCHITECTURE §State machine |
| `reconnect-state` | backoff-schema, snapshot-aanvraag na reconnect, "snapshot is leidend" | §Randgeval 1, 2, 14 |
| `edge-case-messaging` | 14 randgevallen → gebruikersstatus/foutmelding-sleutel (host offline, room vol, ongeldige invite, gekickt, TTL verlopen, …) | §Randgevallen (1–14) |
| `share-actions` | welke deelactie beschikbaar is (QR schermvullend, native share, kopieer-link, code) en wanneer | §QR- en deelgedrag |

Elke module is een eigen bestand met eigen unit tests, zodat een wijziging in bv. de
joinflow niet de reconnect-logica raakt.

## Fasering

### GF0 — Scaffold (geen dependencies)
- Mapstructuur voor de module (voorstel, niet definitief totdat de
  architecture-eigenaar de frontend-layout bevestigt naast `ARCHITECTURE.md`'s
  `frontend`-container): `client/flow/`.
- Testrunner: `node --test`, geen `package.json`-wijziging nodig.
- **Checkpoint:** ik meld waar ik de map plaats en of die naast de bestaande
  `index.html`/`app.js`-structuur past, vóórdat ik buiten `docs/` iets aanmaak.
- **Status: klaar.** Locatie `client/flow/` en moduleformaat (native ES modules,
  `.mjs`) bevestigd en toegepast — zie `prompts/GF0-scaffold.md`.

### GF1 — Route-resolver
- Zuivere functie: pad + querystring → `{ route, inviteId?, code? }` voor alle vijf
  routes uit §Routes, inclusief het expliciete verschil tussen `inviteId` (geen
  hostrechten) en de hostroute (rechten komen uit het sessietoken, nooit uit de URL).

### GF2 — Join-state en host-setup-state
- Joinflow: QR/link-pad met voorgestelde willekeurige naam, code-pad als fallback,
  naamregels (max 20 zichtbare tekens, leeg = serverkeuze) als **client-side
  UX-validatie vóór** verzending — de server blijft autoritair over uniek maken en
  filteren (§Naamverwerking in DATA-MODEL.md blijft daar).
- Host-setup: Snel starten met preset-defaults, ingeklapte geavanceerde instellingen,
  `hostParticipates`-toggle die bepaalt of een naamveld verschijnt.

### GF3 — Match-phase-state
- Statemachine die uitsluitend transities accepteert die de server stuurt; geen eigen
  timers die een fase laten "doorschieten". Lokale countdown-weergave rekent op basis
  van `startsAt`/`endsAt` + gemeten serveroffset, nooit op een eigen seconde-tick los
  van die ankers (ARCHITECTURE §2).

### GF4 — Reconnect-state
- Backoff-reeks exact 1, 2, 4, 8, 16, max 30 s (PROTOCOL.md §Reconnect), als pure
  functie van het aantal pogingen — geen eigen timer die afloopt, alleen de vertraging
  berekenen.
- Bij elke geslaagde doorverbinding: signaleert dat een snapshotaanvraag nodig is;
  de snapshot zelf overschrijft altijd lokale fase/score/antwoordstatus — nooit
  andersom (dat is `match-phase-state`'s kant van de afspraak).
- **Correctie t.o.v. de vorige versie van dit plan:** de host-tempo-wachttijd van
  60 s (Randgeval 1) is een servertimer ("daarna schakelt de server over..."), geen
  clientverantwoordelijkheid. Deze module modelleert alleen de eigen
  socket-reconnectbackoff van déze client; het tonen van een "host is offline"-status
  is `edge-case-messaging` (GF5), niet iets wat hier een eigen 60s-klok krijgt.

### GF5 — Edge-case messaging (Randgevallen 1–14)
- **Correctie t.o.v. de vorige versie:** dit is geen 1-op-1-mapping van 14 gevallen
  naar 14 sleutels. Bij uitwerking (zie `prompts/GF5-edge-case-messaging.md`) blijkt:
  randgevallen 4, 5 en 14 hebben geen eigen melding nodig; 9 en 13 landen op precies
  dezelfde foutcodes (er bestaat geen apart "verlopen"-foutcode in `PROTOCOL.md`); 6
  en 11 hebben elk een niet-messaging-component (een hostkeuze resp. een
  bevestigingsdialoog) die buiten deze module valt.
- Vier functies: foutcode → sleutel (grotendeels passthrough, met fallback voor
  onbekende codes), pauzereden → sleutel, connectiestatus → sleutel, kick/revoke →
  sleutel. Elke onbekende/onbevestigde waarde krijgt een vaste fallback, nooit een
  verzonnen specifieke sleutel.
- Meldingen zijn sleutels, geen vrije tekst — vertaling blijft in de bestaande
  NL/EN/ES-laag (PRODUCT.md §Talen: technische foutcodes worden client-side vertaald).

### GF6 — Share-actions
- Beschikbaarheid van QR-schermvullend, native share sheet (feature-detect), kopieer-
  link en code-fallback; volgorde en zichtbaarheid exact zoals §QR- en deelgedrag.
- QR zelf lokaal gegenereerd uit `joinUrl` (DEPLOYMENT-AND-TESTING.md §Assets) — geen
  externe QR-dienst, dus geen nieuwe dependency nodig zolang een bestaande
  in-browser-generator volstaat; anders is dat een `deps`-checkpoint.
- Lost onderweg GF2a's opengelaten vraag op: de QR-URL en de kopieerlink krijgen elk
  een eigen `src`-queryparameter, zodat `join-state` alsnog `qr` van `shared_link`
  kan onderscheiden ondanks dat beide dezelfde route (`/j/{inviteId}`) raken.

### GF7 — Teams & spectatorroute (na Golf 1, niet launch-blocking)
- Teamkeuze-stap tussen naamkeuze en lobby (§Teams — latere MVP-uitbreiding).
- `/screen/{code}` zonder hostbediening en zonder antwoordknoppen (§Spectatorroute) —
  de reducers (`route-resolver`, `match-phase-state`, `edge-case-messaging`) zijn
  herbruikbaar, maar spectator-auth/subscription/veilige projectie ontbreken nog in
  `PROTOCOL.md`.
- **Blokkade:** niet alleen het ontbrekende teamkeuze-event, maar ook onduidelijk
  wáár teamkeuze in de joinvolgorde past (`POST /api/v1/games/join` maakt nu al in
  één stap een sessie aan). Een onafhankelijke review
  (`prompts/REVIEW-GF7-GF8.md`) vond dit plus vier verdere open punten
  (teamidentifier, serverbevestiging/idempotentie, spectator-auth, en een te vage
  koppeling van `pausedState` aan de verkeerde bronvorm).
- **Status: ⏸️ on hold.** Prompt staat klaar als ontwerpschets, maar wordt pas
  uitgevoerd ná antwoord op het bijgestelde GF8-voorstel. Zie
  `prompts/GF7-teams-and-spectator.md` en `GF-PROGRESS.md`.

### GF8 — Interfacevoorstel voor PROTOCOL.md
- Geen ADR, wel een voorstel: bundelt de vijf openstaande aannames uit GF2a, GF3
  (×2), GF5 en GF7 in één leesdocument voor de PROTOCOL-eigenaar, plus de
  functiesignaturen van alle zeven gebouwde modules als concreet reviewmateriaal.
  Zelfde patroon als de vergelijkbare fase in het GAME-RULES-plan.
- **Status: uitgevoerd.** [`protocol-interface-proposal.md`](protocol-interface-proposal.md)
  staat er, wacht op antwoord van de PROTOCOL-eigenaar.

### GF9 — Session-store
- Stond al in de moduletabel bovenaan dit document, maar kreeg bij het schrijven van
  deze fasering per ongeluk geen nummer — pas bij een voortgangscheck ontdekt (zie
  `GF-PROGRESS.md`). Functioneel het belangrijkste van de drie nieuwe gaten: zonder dit
  heeft `reconnect-state` (GF4) in de praktijk niets om mee te authenticeren.
- Sessietoken + minimale herstelgegevens lokaal bewaren/lezen, met een geïnjecteerd
  storage-object (`{getItem,setItem,removeItem}`) i.p.v. rechtstreeks `localStorage`,
  zodat het zonder browser test baar blijft.
- **Status: klaar.** 10/10 tests groen. Zie `prompts/GF9-session-store.md`.

### GF10 — Host-controls-state
- Nooit in de oorspronkelijke moduletabel opgenomen — een echt gemist onderdeel, niet
  alleen een vergeten fasenummer. Welke hostknop (start/pauze/hervat/volgende/
  vergrendel/kick/beëindig/rematch) wanneer actief is, en de bijbehorende
  event-payload — allemaal al volledig gedekt door bestaande validatieregels in
  `PROTOCOL.md`, dus niet geblokkeerd.
- **Status: klaar.** 18/18 tests groen. Zie `prompts/GF10-host-controls-state.md`.

### GF11 — Leave-state
- Randgeval 11 (vrijwillig verlaten) had nooit een module — de bevestigingsstap vóór
  `player:leave` ontbrak volledig.
- **Status: klaar.** 16/16 tests groen. Zie `prompts/GF11-leave-state.md`.

## Testplan

Dit dekt direct de "Contracttests" en een deel van "Browser/E2E" uit
[`DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md#testlagen):

- route-resolver: alle vijf routes + malformed input (GF1);
- join-state/host-setup-state: elke transitie inclusief foutpaden (GF2);
- match-phase-state: alleen server-geïnitieerde transities worden geaccepteerd (GF3);
- reconnect-state: backoff-tijden en "snapshot wint altijd" (GF4);
- edge-case-messaging: alle 14 gevallen hebben een dekkende test (GF5);
- een **gemockte transportlaag** die exact de PROTOCOL.md-eventnamen en -payloads
  volgt, zodat wanneer de echte implementatie klaar is alleen die laag wisselt en de
  statemachines ongewijzigd blijven.

Echte browser/E2E-tests (QR-scan, app-switch, trage 4G, echte toestellen) zijn pas
zinvol zodra `PROTOCOL.md`, `DATA-MODEL.md` en `ARCHITECTURE.md` een werkende server
opleveren; die fase staat hier alvast genoemd maar niet ingepland.

## Wat hier expliciet buiten valt

- Sessietoken *aanmaken*, hashen of valideren op de server — `PROTOCOL.md`/`auth`,
  ADR-plichtig, niet mijn beslissingsterrein.
- Puntentelling, antwoordcorrectheid, vraagselectie — eigendom van de
  `GAME-RULES.md`-agent; ik render en verstuur alleen.
- Redis/opslagstructuur — `DATA-MODEL.md`.
- Deployment, secrets, hosting, Cloudflare Tunnel — `DEPLOYMENT-AND-TESTING.md`,
  `prod`.
- Definitieve visuele vormgeving van nieuwe schermen — als dat wezenlijk afwijkt van
  de bestaande app-stijl is dat `ux`/`design`, niet iets wat ik zelfstandig invul.
- Groepsvlag/badge — expliciete "latere uitbreiding" in PRODUCT.md, geen
  launch-afhankelijkheid.

## Checkpoints die ik niet zelfstandig neem

- Een routing- of state-management-library toevoegen als vanilla route-parsing niet
  volstaat — `deps`, always_ask.
- De definitieve map-/bundlingkeuze voor de multiplayer-frontendcode, zeker als dat
  een build-stap toevoegt aan een repo die er nu geen heeft — `architecture`.
- Concrete types vastleggen die `PROTOCOL.md` bindt (event- en snapshotvormen) —
  `public_api`, ADR-plichtig; ik lever een voorstel (GF8), geen besluit.
- Alles wat een echte verbinding maakt met een nog niet bestaande serverimplementatie
  — ik bouw en test tegen een mock die het gedocumenteerde contract volgt, en wissel
  pas naar de echte transportlaag zodra die er is.

Ik werk dus door tot en met GF6 als losstaande, geteste module, plaats GF7 na Golf 1,
en leg bij GF0 en GF8 expliciet een vraag neer in plaats van door te bouwen op een
aanname.
