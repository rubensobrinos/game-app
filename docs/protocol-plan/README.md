# Realisatieplan — PROTOCOL.md

Dit is het uitvoeringsplan voor het onderdeel waar ik verantwoordelijkheid voor heb
genomen: [`docs/multiplayer/PROTOCOL.md`](../multiplayer/PROTOCOL.md). Dit document
zelf verandert niets aan de specificatie — het beschrijft hoe ik die specificatie
omzet in geteste code, in welke volgorde, en waar ik moet stoppen om goedkeuring te
vragen.

Zie ook [`docs/multiplayer/README.md`](../multiplayer/README.md) voor de rolverdeling,
en de zusterplannen van de agents die
[`GAME-RULES.md`](../game-rules-plan/README.md),
[`ARCHITECTURE.md`](../architecture-plan/README.md),
[`GAME-FLOW.md`](../game-flow-plan/README.md) en
[`DATA-MODEL.md`](../data-model-plan/README.md) realiseren — zelfde aanpak (pure
logica/schema's eerst, dependencies pas na expliciet akkoord), zodat de losse
plannen straks zonder wrijving samenkomen. Waar dit plan een vorm voor
Redis-inhoud veronderstelt (zie Open vragen), is dat een voorstel ter review voor de
eigenaar van `docs/data-model-plan/`, geen besluit namens die.

## Uitgangspunten

1. **Dit is de public_api/auth-grens zelf, niet alleen een consument ervan.** De
   plannen voor `GAME-RULES.md`, `ARCHITECTURE.md` en `GAME-FLOW.md` bouwen pure
   logica die het `PROTOCOL.md`-contract alleen *consumeert*, via een gemockte
   transportlaag, zonder zelf een `public_api`- of `auth`-besluit te nemen. Dat
   onderscheid vervalt hier gedeeltelijk: dit plan bouwt precies de schema's,
   validators en foutcodes die het wire-contract vórmen. Ik houd daarom twee dingen
   uit elkaar:
   - **(a) Letterlijk coderen van wat al zwart-op-wit in `PROTOCOL.md` staat** — geen
     nieuw ontwerpbesluit, alleen het vertalen van een reeds vastgelegde specificatie
     naar schema's, validators en testcode. Dat kan zelfstandig.
   - **(b) Alles wat die specificatie daadwerkelijk laat werken** — een echte
     tokenimplementatie, echte Redis/Postgres-opslag, een gekozen
     library/dependency, of een wijziging ván de specificatie om een hiaat te
     dichten. Dat blijft `public_api`- en/of `auth`-ADR-plichtig en dus
     `always_ask`, ook al ben ik de aangewezen eigenaar van dit document.

   Dit onderscheid geldt ook ván binnen één en dezelfde spec-sectie: bij
   §Authenticatie en tijdelijke sessies is de vórm van `sessionToken`/`roles` en de
   handshake-payload (a) — letterlijk coderen — terwijl het kiezen van een
   generatie-/hashingalgoritme voor die token (b) is, ook al oogt het als "maar" een
   pure functie. Zie de `auth-shape`- versus `auth-session`-rij in de modulestabel
   hieronder, en de PR8a/PR8b-splitsing in de fasering.
2. **Geen nieuwe dependencies om te beginnen.** Er bestaat nog geen `package.json` in
   deze repo. Zolang een module een pure functie is (schema-validatie, envelope-
   opbouw, idempotentiebeslissing, foutcode-mapping), test ik met Node's ingebouwde
   `node:test` + `node:assert` tegen fakes/in-memory stand-ins voor Redis en
   Socket.IO — nul nieuwe packages, dus geen `deps`-goedkeuring nodig.
   `ARCHITECTURE.md` legt Node.js 22 + TypeScript + Fastify + Socket.IO al vast als
   uiteindelijke stack; die keuze staat al vast in de spec, maar het daadwerkelijk
   toevoegen van die dependencies aan een `package.json` blijft `always_ask`.
3. **Autonomie-limieten blijven gelden.** Max 15 bestanden en 5.000 regels per actie
   (CLAUDE.md). Elke fase hieronder is bewust klein genoeg om binnen die grens te
   passen; de fases die dat qua volume niet zijn (PR4, PR5, PR7) worden hieronder
   expliciet in meerdere sub-commits gesplitst, met een concrete batchindeling en
   een bestands-/regelbudget per sub-commit — niet alleen als generieke belofte,
   maar toegepast op de fasering zelf.
4. **Server is autoritair, dus de schema's ook.** Elke validator die ik bouw moet
   client-gestuurde velden die fase, correctheid, score of timing zouden kunnen
   bepalen actief weigeren (`INVALID_ANSWER_FORMAT` / schema-afwijzing), in plaats van
   ze passief door te laten.
5. **Ik bepaal geen inhoud, alleen vorm.** `round:started.question` bevat
   uiteindelijk content (promptKey, opties, moeilijkheidsgraad-afgeleide data) die uit
   een gedeelde content-module moet komen. Die module bestaat nog niet als
   importeerbaar package (de bestaande `data/*.js`-bestanden zijn browser-globals
   zonder `module.exports`) en heeft geen eigen plan-eigenaar. Ik valideer de *vorm*
   van `question`/`contentVersion`, niet de inhoud, en flag de ontbrekende
   extractie als open vraag (zie hieronder) in plaats van 'm zelf te bouwen.

## Modules en endpoints

| Module | Verantwoordelijkheid | Bron in PROTOCOL.md |
| --- | --- | --- |
| `envelope` | client→server actie-envelope, server→client event-envelope, ack-vorm, `actionId`-idempotentie, maximale payloadgrootte | §Event-envelope, §Inputveiligheid |
| `auth-shape` | vorm-validator voor de REST `Authorization: Bearer <token>`-header en de socket-handshake-payload (`{sessionToken, protocolVersion}`), incl. de `protocolVersion`-check — letterlijk coderen van de bestaande spec-vorm, geen tokenbeslissing | §Authenticatie en tijdelijke sessies |
| `auth-session` (voorstel, niet-bindend, checkpoint vóór code) | daadwerkelijke `generateSessionToken()`/`hashToken()`-functielichamen (algoritme, entropie, peppering) — expliciet géén vorm-validatie, die zit in `auth-shape` | §Authenticatie en tijdelijke sessies |
| `rest-games` | schema's + validatie voor de 5 REST-endpoints (`POST /games`, `POST /games/join`, `GET /{code}/state`, `POST /{code}/leave`, `GET /time`) | §REST-endpoints |
| `snapshot` | vorm van de state-snapshot + de invariant "geen correct antwoord van actieve ronde" | §State-snapshot |
| `client-events` | schema + rolvalidatie voor de 12 client→server events, incl. de 5 `round:answer`-varianten, de unknown-event-dispatch naar `UNSUPPORTED_EVENT`, en een negatieve test tegen een Bearer-token-achtig veld in de payload | §Client → server events |
| `server-events` | schema + ontvangersregel voor de 16 server→client events, incl. de throttle-regel voor `round:progress` | §Server → client events |
| `error-codes` | foutcode-enum (23 codes, 4 categorieën) + errorenvelope zonder debugdetails | §Foutcodes |
| `reconnect` | backoff-reeks, "snapshot leidend"-koppeling, regel voor niet-herverzenden van geaccepteerde antwoorden, hergebruik van `auth-shape` bij socketauth | §Reconnect |
| `input-safety` | naamnormalisatie/-validatie-contract (NFKC, max 20 zichtbare tekens, geen `innerHTML`) | §Inputveiligheid |
| `contract-tests` | fake-transportharnas dat bovenstaande modules end-to-end toetst, gesplitst per scenario (PR7a–PR7e) | DEPLOYMENT-AND-TESTING.md §Contracttests |

Elke module is (ten minste) een eigen bestand met eigen unit-/contracttests, zodat
een wijziging in bijvoorbeeld `round:answer`-validatie niet de errorcode-laag
raakt. Voor de omvangrijkere modules (`client-events`, `server-events`,
`contract-tests`) is dat bewust verdeeld over meerdere bestanden/sub-commits — zie
de expliciete PR4-, PR5- en PR7-sub-fasering hieronder, telkens binnen de
autonomie-limieten van 15 bestanden/5.000 regels per actie.

## Fasering

### PR0 — Scaffold (geen dependencies)
- Mapstructuur (voorstel, niet definitief): `server/protocol/`, naast
  `server/rules/` (game-rules-plan) en `server/architecture/` (architecture-plan).
- Testrunner: `node --test`, geen `package.json`-wijziging.
- **Checkpoint:** ik meld waar ik de map plaats vóórdat ik buiten `docs/` iets
  aanmaak, en stem af met de `architecture`-eigenaar zodat dit niet vooruitloopt op
  diens AR5/AR6-voorstel voor de serverstructuur.

### PR1 — Event-envelope & idempotentie
- Pure functies: parse/valideer client→server-envelope (`{event, actionId,
  payload}`), bouw server→client-envelope, bouw ack (`{actionId, ok, serverTime,
  payload}`).
- `assertPayloadSize(rawPayload, maxBytes)` — begrenst de grootte van elke
  binnenkomende client→server-payload vóórdat de envelope verder wordt geparsed
  (§Inputveiligheid: "payloadgrootte wordt begrensd" — een aparte eis naast de
  schema-validatie van individuele velden), met een fixturetest die een te grote
  payload laat weigeren via een bestaande generieke afwijzing uit de
  Input-categorie van `error-codes` (PR2); welke exacte code van de 23 hier van
  toepassing is, wordt bij PR2 getoetst aan `PROTOCOL.md` in plaats van hier
  aangenomen.
- `resolveDuplicateAction(store, actionId, event)` — beslist "zelfde ack, geen
  herexecutie" tegen een geïnjecteerde fake/in-memory store, exact zoals §Ack en de
  idempotentieregels bij `round:answer` voorschrijven (zelfde `actionId` → zelfde
  ack; nieuwe `actionId` met zelfde of ander antwoord na acceptatie →
  `ALREADY_ANSWERED`).

### PR2 — Foutcodes & errorenvelope
- Eén typed enum met alle 23 foutcodes in hun 4 categorieën (Room/join,
  Autorisatie, Game/ronde, Input), als single source of truth.
- `buildErrorPayload(code, meta)` — garandeert dat `meta` nooit displaynaam, token,
  IP-adres of volledige antwoordpayload bevat (koppelt de logging-veiligheidseisen
  uit de constraints direct aan een testbare functie, niet alleen aan een
  procesafspraak).
- Contracttest: elke code in de enum komt exact overeen met wat in `PROTOCOL.md`
  staat — geen méér, geen minder — zodat een latere wijziging van de specificatie
  hier meteen faalt in plaats van onopgemerkt te blijven.
- **Open vraag ingebed:** room-TTL-verlopen (na 4 uur) heeft geen eigen code — zie
  Open vragen §1.

### PR3 — REST-schema's
- Request/response-validators voor alle 5 endpoints, met de exacte voorbeeldpayloads
  uit `PROTOCOL.md` als testfixtures.
- `input-safety`-validator (NFKC-normalisatie, control characters strippen, max 20
  zichtbare tekens → `NAME_TOO_LONG`/`NAME_INVALID`) hoort hier bij, voor
  `displayName` in zowel `POST /games` als `POST /games/join`.
- `auth-shape`-validator (losstaand van het PR8-tokenvoorstel): een pure vorm-check
  voor de REST `Authorization: Bearer <token>`-header (correct prefix, niet-lege
  tokenstring) en voor de socket-handshake-payload `{sessionToken,
  protocolVersion}`, inclusief de `protocolVersion === 'v1'`-check die bij afwijking
  `PROTOCOL_VERSION_UNSUPPORTED` (PR2) oplevert. Dit is letterlijk coderen van een
  reeds vastgelegde vorm (Uitgangspunt 1a) — geen tokenbeslissing — en dus
  zelfstandig uit te voeren, onafhankelijk van en vóór het PR8-voorstel voor
  generatie/hashing. Waar `GET /{code}/state` en `POST /{code}/leave` "vereist
  geldige sessietoken" schrijven, leunt dat hier op deze vorm-check; de
  daadwerkelijke geldigheidscontrole tegen een echte sessiestore hoort bij het
  latere serverproces, niet bij dit plan.
- `joinSource`/`joinUrl` worden gevalideerd en doorgegeven als opake velden; de
  constructie van `joinUrl` (basis-URL + `inviteId`) en de opslag van `joinSource`
  richting analytics zijn niet hier belegd — zie Open vragen §5–6.

### PR4 — Client→server event-schema's (gesplitst in sub-commits, elk ≤15 bestanden/≤5.000 regels)
- Eén validator per event (`game:start` … `share:opened`), inclusief rolcontrole
  (host/player) uit de tabel in §Client → server events, plus vijf losse
  validators voor de `round:answer`-varianten (`optionId`, `choice`, `side`,
  `cardIndex`, `text`) — elk toetst alleen structuur, niet correctheid (dat is
  `GAME-RULES.md`'s validator-module, niet deze). In totaal 17 schema's (12
  events + 5 varianten); dat past niet in één actie binnen de autonomie-limieten
  (CLAUDE.md: max 15 bestanden/5.000 regels). Expliciete sub-commits, elk met een
  eigen validator-, fixture- en testbestand binnen het budget, gegroepeerd in
  batches van 3-4 events in de volgorde van de tabel in §Client → server events:
  - **PR4a** — eerste 3-4 client-events (te beginnen bij `game:start`) +
    rolcontrole-tests.
  - **PR4b** — volgende 3-4 client-events + rolcontrole-tests.
  - **PR4c** — resterende client-events tot en met `share:opened`, plus
    `resolveEventValidator(eventName)` — pure lookup die elke eventnaam buiten de
    bekende 12 herleidt naar `UNSUPPORTED_EVENT` (Basisregel 7), getest met een
    willekeurige onbekende eventstring.
  - **PR4d** — de 5 `round:answer`-varianten (`optionId`, `choice`, `side`,
    `cardIndex`, `text`) als aparte structuurvalidators.
- Expliciete negatieve test (cross-cutting over alle 17 schema's, hoort bij PR4c):
  geen enkel client-eventpayload-schema vereist of accepteert stilzwijgend een
  `sessionToken`/bearer-token-achtig veld (Basisregel 3: "Bearer tokens worden niet
  in iedere eventpayload herhaald") — de token reist alleen via de
  envelope/handshake (`auth-shape`), nooit via de payload zelf.

### PR5 — Server→client event-schema's & snapshot (gesplitst in sub-commits, elk ≤15 bestanden/≤5.000 regels)
- Eén validator per event (`room:state` … `error`), plus de losse
  snapshot-shape-validator voor `GET /state` en `room:state`. 16 events + de
  snapshot-validator + de invariant-test passen niet in één actie binnen de
  autonomie-limieten; expliciete sub-commits, gegroepeerd in batches van 3-4
  events in de volgorde van de tabel in §Server → client events:
  - **PR5a** — eerste batch server-events (te beginnen bij `room:state`) +
    ontvangersregel-tests.
  - **PR5b** — tweede batch server-events + ontvangersregel-tests.
  - **PR5c** — derde batch server-events + ontvangersregel-tests.
  - **PR5d** — resterende server-events tot en met `error`, plus de
    snapshot-shape-validator en de expliciete invariant-test "een snapshot bevat
    nooit het correcte antwoord van een actieve ronde" als testbare pure functie
    (fake-snapshot in, boolean/assert uit) — dit is letterlijk een genoemd
    contracttest-punt in `DEPLOYMENT-AND-TESTING.md`.
  - **PR5e** — `throttleRoundProgress(store, roundId, now)`: pure beslisfunctie die
    bepaalt of een volgende `round:progress`-broadcast is toegestaan, met een
    test die aantoont dat bij een reeks aanroepen binnen één seconde voor
    dezelfde ronde nooit meer dan 2 emissies worden toegestaan (§Server → client
    events: "maximaal tweemaal per seconde"). Dit is een pure teller/klok-functie
    op basis van een geïnjecteerde klok; het daadwerkelijk plannen en versturen
    van de broadcast zelf hoort bij het latere serverproces, niet bij dit plan.
- **Open vragen ingebed:** `question`-payloadvorm is alleen voor multiple-choice
  uitgewerkt (§Open vragen 10); `game:paused.reason` is een vrije string zonder
  enum en dekt inmiddels ook het server-restart-scenario (§Open vragen 2); geen
  `eligible`-veld voor late joiners (§Open vragen 3); geen "left"-status in
  scoreboard/`game:finished` (§Open vragen 4).

### PR6 — Reconnect-acceptatieregels
- Backoff-reeks 1, 2, 4, 8, 16, max 30 s als pure generator.
- Dit dupliceert bewust **niet** `architecture-plan`'s AR3 (`snapshot-precedence`) of
  AR4 (`server-time`) — die bouwstenen worden hier alleen aangeroepen/gerefereerd.
  Wat hier wél nieuw is: de PROTOCOL-specifieke regel dat een reeds geaccepteerd
  antwoord niet opnieuw wordt verzonden, tenzij de client geen ack ontving en
  dezelfde `actionId` herhaalt.
- Socketauth bij reconnect hergebruikt exact hetzelfde `auth-shape`-schema
  (`{sessionToken, protocolVersion}`) als de eerste handshake (PROTOCOL.md,
  Reconnect-stap 4: "Socketauth gebruikt dezelfde sessietoken") — geen apart
  reconnect-specifiek authschema, alleen een expliciete verwijzing hierheen.

### PR7 — Contracttest-suite tegen fake transport (gesplitst, net als PR0)
- Een handgerold, dependency-vrij fake-Socket.IO/fake-Fastify-harnas (event-emitter
  + request/response-stubs, geen echte netwerkcode) dat PR1–PR6 end-to-end
  doorloopt: create → join → snapshot → `round:answer` met dubbele `actionId` →
  idempotente ack → foutcodes. Qua omvang is dit zelf weer een "grotere fase" zoals
  bedoeld in Uitgangspunt 3, dus expliciet gesplitst in losse acties/commits:
  - **PR7a** — harnas-scaffold: de fake-transportlaag zelf (event-emitter +
    request/response-stubs), zonder nog een scenario te draaien.
  - **PR7b** — envelope/idempotentie-scenario (create → join → dubbele `actionId`
    → idempotente ack) tegen PR1/PR2.
  - **PR7c** — REST-scenario (de 5 endpoints, inclusief de `auth-shape`-header)
    tegen PR3.
  - **PR7d** — client-/server-eventscenario (inclusief de snapshot-invariant en
    de `round:progress`-throttle) tegen PR4/PR5.
  - **PR7e** — reconnect-scenario (backoff, niet-herverzenden van geaccepteerde
    antwoorden, socketauth-hergebruik) tegen PR6, plus een scenario voor
    pauze-op-recovery → hervatten-met-nieuwe-countdown na een serverherstart (zie
    Open vragen §2), met verwijzing naar `architecture-plan`'s
    Redis-restart-afhandeling in plaats van die te herbouwen.
- Dit is de daadwerkelijke invulling van de "Contracttests"-laag uit
  `DEPLOYMENT-AND-TESTING.md` (zie Testplan hieronder).

### PR8 — Voorstel: sessie/tokenmodule (`auth`, niet-bindend, checkpoint vóór code)
- **PR8a — Schriftelijk voorstel, geen code:** algoritme-keuze (bv. `node:crypto`
  `randomBytes`-lengte/entropie-doel), hashingschema en peppering-strategie als
  proza/pseudocode, met een afweging tussen alternatieven. Dit voorstel bevat
  uitdrukkelijk **geen** `generateSessionToken()`/`hashToken()`-implementatie —
  het kiezen van een generatie-/hashingaanpak ís al de `auth`-beslissing zelf, niet
  alleen de koppeling aan Redis-sessieopslag.
- **Checkpoint:** ik vraag expliciet akkoord op dit voorstel vóórdat ik ook maar
  één regel `generateSessionToken()`/`hashToken()`-code schrijf. Zonder akkoord
  stopt dit plan hier.
- **PR8b — Pas na akkoord:** `generateSessionToken()` en `hashToken()` als pure
  functies, getest op formaat, entropie en hash-consistentie (zelfde patroon als
  `architecture-plan`'s `room-codes`/AR2) — nog steeds **niet** op echte opslag of
  revocation-levenscyclus; dat blijft een aparte, latere `auth`-stap.

Na PR7 volgt geen verdere fase in dit plan zonder expliciet akkoord: PR8 splitst
zichzelf in een schriftelijk voorstel (PR8a) gevolgd door een checkpoint, en pas ná
akkoord de eerste functiecode (PR8b). Het daadwerkelijke serverproces
(Fastify-routes en Socket.IO-handlers die deze pure modules aanroepen tegen echte
Redis/Postgres) bouw ik pas na de checkpoints hieronder — dat is bewust buiten de
fasering gehouden, niet vergeten.

## Testplan

Dit plan is, in tegenstelling tot de zusterplannen (die vooral de "Unit"-laag
raken), de directe invulling van de **"Contracttests"-laag** uit
[`DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md#testlagen):

- alle REST-schema's → PR3;
- alle socketevents → PR4, PR5;
- protocolversie → de `auth-shape`-vormcheck van de socket-handshake-payload
  (`{sessionToken, protocolVersion}`) binnen PR3 — niet de envelopes zelf, want
  die dragen geen `protocolVersion` (zie PROTOCOL.md's envelope-voorbeelden,
  `{event, actionId, payload}` resp. `{event, eventId, serverTime, payload}`) —
  afgewezen via `PROTOCOL_VERSION_UNSUPPORTED` in PR2. Dit is een vorm-check
  (Uitgangspunt 1a) en dus onafhankelijk van en eerder testbaar dan het
  PR8-tokenvoorstel;
- maximale payloadgrootte → PR1 (`assertPayloadSize`, vóór de envelope verder
  wordt geparsed);
- `round:progress` maximaal tweemaal per seconde → PR5e (`throttleRoundProgress`);
- onbekende eventnaam → `UNSUPPORTED_EVENT` → PR4c (`resolveEventValidator`);
- geen Bearer-/sessietoken-veld in enige client-eventpayload → PR4 (cross-cutting
  negatieve test, Basisregel 3);
- foutcodes → PR2;
- snapshot bevat geen correct antwoord van actieve ronde → PR5d;
- pauze-op-recovery na een serverherstart → PR7e (zie Open vragen §2);
- client en server delen dezelfde `contentVersion` → PR3/PR7, voor zover de vorm
  betreft; de daadwerkelijke gelijkheid hangt af van de nog niet bestaande
  content-module-extractie (zie Open vragen §15).

Daarnaast raakt dit plan losse punten uit de "Unit"-laag: naamnormalisatie/XSS-achtige
input (PR3), sessierollen (PR3, `auth-shape`, alleen vorm — de daadwerkelijke
generatie/hashing blijft PR8, niet-bindend tot na het PR8a-checkpoint).
State-machine-transities, code-/inviteId-generatie en tokenhashing-als-
opslagbeslissing blijven bij `architecture-plan` resp. het `auth`-checkpoint van
PR8 — niet gedupliceerd hier.

Elke module krijgt tests vóór of samen met de implementatie, nooit erna.

## Open vragen (uit onderzoek)

Deze zijn geen dingen die ik zelf oplos door de specificatie uit te breiden — dat zou
een `public_api`-besluit zijn. Ik implementeer wat er staat, markeer expliciet waar
het stil is, en leg de vraag hier neer voor de mens die `PROTOCOL.md` accordeert.

**Host-tempo, pauzes en randgevallen**
1. Room-TTL-verlopen (4 uur) heeft geen eigen foutcode — hergebruikt dit impliciet
   `GAME_NOT_FOUND`, of komt er een aparte code? Blokkeert een deel van PR2.
2. `game:paused.reason` is een vrije string, geen enum. Minstens vier situaties
   delen dit veld: host-disconnect na 60 s → auto-tempo, 3 opeenvolgende lege
   rondes → host krijgt "Doorgaan"/"Beëindigen", expliciete hostpauze, én — uit
   `GAME-FLOW.md` edge case #14 — een serverherstart, waarna actieve rooms
   automatisch gepauzeerd en later automatisch hervat worden met een korte nieuwe
   countdown, "niet door stilzwijgend meerdere fases over te slaan". De client kan
   geen van deze vier onderscheiden. Voor dit vierde geval is bovendien onduidelijk
   of de pauze als live `game:paused`-broadcast reist (er kan op het moment van de
   crash niemand verbonden zijn) of uitsluitend zichtbaar wordt via `room.phase`
   in de post-reconnect snapshot — die ambiguïteit stond nergens anders in dit
   plan. Blokkeert een volledige PR5-validator voor `game:paused`; PR7e neemt een
   contracttestscenario op voor pauze-op-recovery → hervatten-met-nieuwe-countdown
   tegen de fake transport.
3. Geen proactief `eligible`-veld (bv. in `round:started` of `self`) voor late
   joiners die pas vanaf een volgende ronde mogen meedoen — nu alleen reactief via
   `PLAYER_NOT_ELIGIBLE` na een poging. Blokkeert volledige dekking van PR4/PR5.
4. `POST /leave` specificeert niet of dit de `sessionToken` intrekt. Als dat wel zo
   is, botst dat met de reactivatie-binnen-TTL die elders wordt verondersteld. Er is
   ook geen "verlaten"-statusveld in scoreboard/`game:finished`. Blokkeert een deel
   van PR3 en PR5.
5. `joinUrl`-constructie (basis-URL + `inviteId`) staat nergens gespecificeerd —
   waar komt de basis-URL vandaan (config/env)? Relevant voor PR3.
6. `joinSource`/`share:opened.method` (incl. `"native"`) hebben geen gedocumenteerd
   pad naar de Postgres-analytics-aggregaten. Niet blokkerend voor schema-validatie
   in PR3, wel voor een latere analytics-fase buiten dit plan. Daarnaast kent
   `share:opened.method` slechts drie waarden (`qr | link | native`), terwijl
   `GAME-FLOW.md`'s "Delen"-sectie vier deelacties beschrijft (QR fullscreen,
   native deelvenster, join-link kopiëren, handmatige code tonen) en
   `POST /games/join`'s `joinSource`-enum al vier waarden heeft, inclusief `code`.
   "Code tonen" levert dus geen onderscheidbaar analytics-signaal op via `method`,
   terwijl `joinSource` dat voor aankomst via een code wél kan. PR3/PR4 valideren
   `method` vooralsnog ongewijzigd (3 waarden); of `method` een vierde waarde
   krijgt die `joinSource` spiegelt, is aan de `PROTOCOL.md`-eigenaar om te
   beslissen.

**Sessies, rollen, teams, spectators**
7. `session:revoked` heeft geen duidelijk triggerend scenario — kick heeft al
   `session:kicked`, TTL-verval loopt vermoedelijk via REST-foutcodes. Onduidelijk
   wat dit event in de praktijk verstuurt. Relevant voor PR5.
8. Geen enkel protocol-oppervlak voor teams (event, `team`-veld in
   join/state/scoreboard, foutcode), terwijl "individueel of teams" al als
   live-configoptie elders wordt genoemd. Buiten scope tot dit is toegevoegd aan de
   specificatie (zie ook GAME-RULES-plan GR6 en GAME-FLOW-plan GF7, die hetzelfde
   gat signaleren).
9. Spectatorroute (`/screen/{code}`) heeft geen rol naast `host`/`player` en geen
   beschreven auth/subscribe-mechanisme voor read-only events.

**Vraaginhoud en scoring — grensvlak met GAME-RULES.md**
10. `question`-payloadvorm is alleen voor multiple-choice uitgewerkt; de andere vier
    spelvormen (binair, hoger/lager, buitenbeentje, typen) hebben geen
    gespecificeerde vraag-payload. PR4/PR5 valideren voorlopig alleen wat gedocumenteerd
    is en markeren de rest als geblokkeerd op een interfacevoorstel (vergelijkbaar
    met `game-rules-plan`'s GR7).
11. "Verdeling" (antwoordverdeling) in `round:ended` heeft geen genoemde eigenaar:
    protocol-aggregatie over ruwe antwoorden, of een GAME-RULES-outputveld? Moet
    worden vastgesteld vóór PR5 dit veld bindend valideert.
12. Deadlinegrace (≤250 ms, uit GAME-RULES.md) versus `DEADLINE_PASSED`: wordt een
    laat antwoord al vóór de protocollaag geweigerd, of alleen binnen de
    scoreberekening geaccepteerd-maar-zonder-bonus? Deze grens is niet expliciet en
    moet worden vastgelegd vóór PR4's `round:answer`-validator "te laat" definitief
    afhandelt.
13. `roundNumber` en `countdownEndsAt` hebben geen bronveld in `DATA-MODEL.md`
    (vermoedelijk afgeleid van `Match.roundIndex`) — af te stemmen met de eigenaar
    van [`docs/data-model-plan/`](../data-model-plan/README.md); diens plan noemt
    deze twee velden nog niet expliciet.
14. `game:rematch`: reset `Player.score/correctCount/...` voor de nieuwe match? Speler
    is room-scoped, niet match-scoped in `DATA-MODEL.md` — onduidelijk voor PR4/PR5.
15. De gedeelde content-module (`COUNTRIES`, `COUNTRY_FACTS`, `checkAnswer`, e.d.)
    bestaat nog niet als importeerbaar package — de bestaande `data/*.js`-bestanden
    zijn browser-globals zonder `module.exports`. Zolang dat niet is opgelost, kan
    "client en server delen dezelfde `contentVersion`" in PR7 alleen op vórm getest
    worden, niet op daadwerkelijke gelijkheid.
16. `GET /api/v1/time` heeft geen eigen foutcode voor een misvormde response —
    ontdekt tijdens PR3: dit endpoint valt buiten alle vier Foutcodes-categorieën
    (geen room, geen sessie, geen ronde). `validateTimeResponse`
    (`rest-games-session.mjs`) gebruikt daarom `PROTOCOL_VERSION_UNSUPPORTED` als
    niet-canonieke placeholder, uitsluitend om aan het gedeelde
    `ValidationResult<T>`-type te voldoen — expliciet niet als betekenisvolle
    claim, en aanroepers vertrouwen daarbij alleen op `ok`, nooit op de specifieke
    `code`. Blokkeert een nette, betekenisvolle foutcode voor dit endpoint totdat
    de `PROTOCOL.md`-eigenaar hier een keuze in maakt (nieuwe code, of expliciet
    hergebruik van een bestaande).

## Wat hier expliciet buiten valt

- Een echt draaiend serverproces: Fastify-routes, Socket.IO-handlers, een echte
  Redis-/Postgres-verbinding — dat vereist `deps`- én `architecture`-goedkeuring.
- De daadwerkelijke tokengeneratie/-hashing (de functie-lichamen van
  `generateSessionToken`/`hashToken`, niet alleen de koppeling aan opslag) als
  productie-implementatie, inclusief revocation-levenscyclus — `auth`,
  ADR-plichtig. PR8a levert uitsluitend een schriftelijk voorstel (algoritme,
  entropie, peppering); PR8b (de eerste regel functiecode) start pas na expliciet
  akkoord op dat voorstel.
- Het oplossen van de 15 open vragen door zelf velden, events of foutcodes aan
  `PROTOCOL.md` toe te voegen — dat is een `public_api`-wijziging, geen realisatie
  van de bestaande tekst.
- State-machine-transities, room-code-/`inviteId`-generatie, snapshot-precedentie en
  de server-time-midpointberekening — dat zijn `architecture-plan`'s bouwstenen
  (AR1–AR4); dit plan roept ze aan, het herbouwt ze niet.
- Puntentelling, antwoordcorrectheid, vraagselectie, spelvormvalidatie — eigendom van
  `game-rules-plan`; deze module valideert alleen de *vorm* van wat er doorheen
  stroomt.
- Client-side flow-/state-rendering en edge-case-messaging — `game-flow-plan`'s
  terrein.
- Redis-sleutelnaamgeving en opslagvorm — eigendom van
  [`docs/data-model-plan/`](../data-model-plan/README.md); dit plan levert
  hoogstens een voorstel ter review.
- Reverse-proxy-, HTTPS-, HSTS- en WS-origin-validatieconfiguratie — dat is
  `DEPLOYMENT-AND-TESTING.md`, `prod`.
- Teams- en spectator-protocoloppervlak — geen bestaande specificatietekst om te
  realiseren; pas relevant na een expliciete uitbreiding van `PROTOCOL.md`.
- Alles wat `TOKEN_PEPPER`, `.env` of productie-secrets raakt.

## Checkpoints die ik niet zelfstandig neem

- Nieuwe dependencies toevoegen (Fastify, Socket.IO, een Redis-client, een
  TypeScript-toolchain in een nog niet bestaande `package.json`) — `deps`,
  always_ask.
- Elke wijziging aan `PROTOCOL.md` zelf om een van de 15 open vragen te dichten
  (nieuwe velden, events, foutcodes, een enum voor `reason`) — `public_api`,
  ADR-plichtig; ik lever een voorstel, geen besluit.
- De daadwerkelijke tokengeneratie/-hashing-implementatie (PR8b: de eerste regel
  `generateSessionToken()`/`hashToken()`-code) en de koppeling aan echte
  sessieopslag/revocation — `auth`, ADR-plichtig. PR8a's schriftelijke voorstel is
  niet-bindend totdat dit is geaccordeerd; zonder akkoord schrijf ik geen
  PR8b-code.
- De definitieve mapindeling/serverstructuur waarin deze modules landen —
  `architecture`; ik loop niet vooruit op `architecture-plan`'s AR5/AR6-checkpoint.
- Redis-sleutelvormen of andere opslagbeslissingen namens `DATA-MODEL.md` bindend
  maken — `database_schema`, ADR-plichtig bij de eigenaar van
  `docs/data-model-plan/`.
- Alles binnen `infra/prod/**` of `.github/workflows/deploy.yml` — verboden pad.

Ik werk dus door tot en met PR7 (contracttest-suite tegen fakes) als losstaande,
geteste modules, lever bij PR8a uitdrukkelijk een niet-bindend, schriftelijk
voorstel voor de sessie/tokenmodule (geen code) en schrijf pas ná expliciet
akkoord de eerste PR8b-functiecode, en leg bij PR0 en vóór ieder daadwerkelijk
serverproces expliciet een vraag neer in plaats van door te bouwen op een
aanname.

## Prompts per fase

Net als bij de zusterplannen komen uitvoerbare, zelfstandige taakbeschrijvingen per
fase in `prompts/` te staan zodra dit plan is geaccordeerd — niet vooraf in bulk,
per fase vlak voordat die start, zodat elke prompt actueel blijft ten opzichte van
wat de vorige fase daadwerkelijk opleverde en van eventuele antwoorden op de Open
vragen hierboven. De gesplitste fases (PR4a–d, PR5a–e, PR7a–e, PR8a/PR8b) krijgen elk
hun eigen prompt in plaats van één prompt per hoofdfase.
