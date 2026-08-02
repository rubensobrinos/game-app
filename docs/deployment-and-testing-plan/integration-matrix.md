# Testmatrix — integratielaag (DT3a)

**Status (2026-08-02, heraudit [`DT-R1`](prompts/DT-R1-heraudit-integratie.md),
gecorrigeerd bij verificatie): 0/14 rijen daadwerkelijk geactiveerd.** De
heraudit vond aanvankelijk 5/14 (rijen 1, 2, 5, 8, 10) geactiveerd, geverifieerd
tegen een geïsoleerde `git worktree` op commit `c7ce43b` (48/48 bestaande +
5 nieuwe tests slaagden dáár). Bij eigen verificatie tegen de actuele werkboom
faalden alle 5 nieuwe tests alsnog:
`TypeError: context.store.loadRoomByInviteId is not a function`
(`server/composition/room-lifecycle.mjs:253`) — dezelfde fout breekt ook de
reeds bestaande `server/composition/room-lifecycle.test.mjs`, dus dit is geen
regressie die deze audit veroorzaakte. Oorzaak: `server/data/repository.js` is
via DM10/DM11 gemigreerd van `loadRoomByInviteId(inviteId)` naar
`loadRoomByInviteHash(inviteHash)`; `room-lifecycle.mjs` roept nog de
verwijderde methode aan. De 5 nieuwe tests zijn inhoudelijk correct en
verplaatst naar `tests/integration/pending/*.draft.mjs` (niet in de actieve
`*.test.*`-glob) totdat die ene aanroep is bijgewerkt — zie de
"Audit-log"-sectie onderaan voor de volledige, per-rij motivatie en citaten.

Onderdeel van [`README.md`](README.md), fase DT3a, uitgevoerd volgens
[`prompts/DT3a-integratie-matrix.md`](prompts/DT3a-integratie-matrix.md). Bron:
[`docs/multiplayer/DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md)
§Testlagen → Integratie (regels 291–304).

Dit is **geen uitvoerbare code**. Dit is de stap die
[`prompts/REVIEW.md`](prompts/REVIEW.md) #6 vraagt: eerst vastleggen wát er moet
gebeuren, welke andere documenteigenaren het scenario raakt, wat er eerst moet
bestaan (prerequisite), en wannéér het scenario van matrixregel naar `test.skip`-code
mag (activatiecriterium, DT3b). Zolang de prerequisite niet is vervuld, blijft het
scenario hier staan.

Rijen 1–12 volgen letterlijk de bullets uit §Integratie. Rijen 13 en 14 zijn geen
letterlijke bullets in die paragraaf, maar zijn opgenomen omdat het plan-README
(§Uitgangspunt 3, Fasering DT1b) ze expliciet uit de contractlaag (DT1b) naar deze laag
verplaatst: ze vereisen echte verwerking/opslagstate of de échte snapshotproducer, niet
alleen assertions tegen een eigen fixture (zie ook `REVIEW.md` #4 en #6).

| # | Scenario | Bronregel(s) | Raakt eigenaar(s) | Prerequisite | Activatiecriterium |
| --- | --- | --- | --- | --- | --- |
| 1 | Room aanmaken met `hostParticipates: false`: host krijgt alleen de hostrol, geen `playerId`/`effectiveName`. | DEPLOYMENT-AND-TESTING.md:293; PROTOCOL.md:108–141 (met name regel 141). | PROTOCOL.md, DATA-MODEL.md | Werkende `POST /api/v1/games`-implementatie die `hostParticipates` verwerkt en een Room/Session-representatie oplevert conform DATA-MODEL.md (geen Player-entiteit voor de host). | Zodra die endpoint bestaat en "hostParticipates:false ⇒ playerId/effectiveName null" aantoonbaar in code zit (niet alleen in doc), mag dit naar test.skip-code (DT3b). |
| 2 | Room aanmaken met `hostParticipates: true`: host krijgt `playerId`/`effectiveName` en een normale spelerplek. | DEPLOYMENT-AND-TESTING.md:294; PROTOCOL.md:108–141. | PROTOCOL.md, DATA-MODEL.md | Zelfde create-endpoint als rij 1, met de tak die bij `hostParticipates:true` een Player-entiteit voor de host aanmaakt. | Zodra die tak aantoonbaar in code zit (host krijgt dezelfde Player-vorm als een gewone joiner), mag dit naar test.skip-code (DT3b). |
| 3 | Join via `inviteId` (QR/deel-link), `joinSource: "qr"` of `"shared_link"`, levert geldige sessie op. | DEPLOYMENT-AND-TESTING.md:295; PROTOCOL.md:143–167. | PROTOCOL.md, ARCHITECTURE.md (§Join-code en inviteId, regel 233–240: hashindex-lookup) | Werkende `POST /api/v1/games/join`-implementatie die op `inviteId` matcht via een echte hashindex-lookup, niet een fixture-lijst. | Zodra join-endpoint échte inviteId-lookup gebruikt en een sessie/token retourneert, mag dit naar test.skip-code (DT3b). |
| 4 | Join via het zescijferige gamecode, `joinSource: "code"`, levert geldige sessie op; ongeldige/onbekende code geeft correcte foutcode. | DEPLOYMENT-AND-TESTING.md:296; PROTOCOL.md:143–167. | PROTOCOL.md, ARCHITECTURE.md (§Join-code en inviteId, regel 225–231: generatie, uniekheid, rate limiting) | Zelfde join-endpoint als rij 3, plus echte coderegistratie/-validatie en de rate-limiting uit ARCHITECTURE.md. | Zodra join-endpoint tegen échte coderegistratie valideert (geen fixture-lijst), mag dit naar test.skip-code (DT3b). |
| 5 | Speler geeft zelf een `displayName` op (blijft behouden) of laat het leeg (server genereert adjectief+dier of `Speler {n}`). | DEPLOYMENT-AND-TESTING.md:297; PROTOCOL.md:121,152,162,447 (normalisatie); DATA-MODEL.md:102,339 (generatievorm). | PROTOCOL.md, DATA-MODEL.md | Join/create-implementatie die `displayName: null` onderscheidt van een opgegeven naam, plus een echte naamgenerator conform het "adjectief + dier / Speler {n}"-patroon uit DATA-MODEL.md:339. | Zodra zowel het null-vs-opgegeven-onderscheid als de naamgenerator in code bestaan (niet als losse testfixture), mag dit naar test.skip-code (DT3b). |
| 6 | Elke speler (niet alleen de host) kan de invite-QR/link opnieuw tonen en openen; `share:opened` wordt geregistreerd. | DEPLOYMENT-AND-TESTING.md:298; PROTOCOL.md:253 (`share:opened`); ARCHITECTURE.md:99–107 (§5 QR en deel-link zijn publieke joincapaciteiten). | PROTOCOL.md, ARCHITECTURE.md | Room-state/snapshot die `joinUrl`/`inviteId` aan elke sessierol beschikbaar stelt (niet alleen host), plus een `share:opened`-handler. | Zodra elke sessierol de invite kan opvragen uit de échte snapshot-implementatie en `share:opened` verwerkt wordt, mag dit naar test.skip-code (DT3b). |
| 7 | Volledige matchcyclus: `game:start` vanuit LOBBY → opeenvolgende `round:started`/`round:ended` → `game:finished` → `game:rematch` start nieuwe match binnen dezelfde room. | DEPLOYMENT-AND-TESTING.md:299; PROTOCOL.md (events, regel 242,326–335); GAME-RULES.md:6–74 (rondestructuur, vraagselectie, rematchuitsluiting); DATA-MODEL.md:121,273 (Match/Round, `rematch_of`); ARCHITECTURE.md:78–98,202–222 (state machine, één timeline per room). | PROTOCOL.md, GAME-RULES.md, DATA-MODEL.md, ARCHITECTURE.md | End-to-end state-machine-implementatie die alle fases (LOBBY→ROUND_ACTIVE→…→FINISHED) doorloopt, gekoppeld aan echte vraagselectie/scoring (`server/rules/`) en Match/Round-opslag conform DATA-MODEL.md. | Zodra een game-server-instantie een volledige match end-to-end kan draaien tegen een testroom (start, ≥1 ronde, finish, rematch) zonder gemockte tussenlagen, mag dit naar test.skip-code (DT3b). Zwaarste scenario; typisch een van de laatste die activeert. |
| 8 | Host vergrendelt/ontgrendelt room via `game:lock`; nieuwe joins worden geweigerd resp. weer toegelaten; `room:lock-changed` gaat naar de room. | DEPLOYMENT-AND-TESTING.md:300; PROTOCOL.md:246,325. | PROTOCOL.md, DATA-MODEL.md (`Room.locked`) | `game:lock`-handler die `Room.locked` persisteert, en een join-endpoint dat locked-state daadwerkelijk respecteert. | Zodra de lock-toggle joins aantoonbaar blokkeert/toelaat in de échte join-implementatie, mag dit naar test.skip-code (DT3b). |
| 9 | Speler joint ná ronde-start terwijl `allowLateJoin: true`: geen punten voor gemiste rondes, telt pas mee in `eligiblePlayerCount` vanaf de eerstvolgende nieuwe ronde; bij `allowLateJoin:false` of locked room geeft join `LATE_JOIN_DISABLED`. | DEPLOYMENT-AND-TESTING.md:301; GAME-RULES.md:152–160 (§Late join); PROTOCOL.md:214,388 (`allowLateJoin`, `LATE_JOIN_DISABLED`). | GAME-RULES.md, PROTOCOL.md, DATA-MODEL.md (`late_join_count`, regel 266) | Join-implementatie die de matchfase kent op joinmoment, plus scoring-/voortgangslogica die late joiners uitsluit van gemiste rondes en van de noemer tot de eerstvolgende ronde. | Zodra join-tijdens-actieve-match end-to-end werkt tegen de échte state machine én scoring, mag dit naar test.skip-code (DT3b). |
| 10 | Host kickt speler via `game:kick`: speler ontvangt `session:kicked`, sessie belandt in `room:{roomId}:revoked-sessions`; hernieuwde poging met dezelfde token geeft `SESSION_REVOKED`. | DEPLOYMENT-AND-TESTING.md:302; PROTOCOL.md:247,336,337,396; DATA-MODEL.md:85,113,218. | PROTOCOL.md, DATA-MODEL.md | Kick-handler die de revoked-sessions-set daadwerkelijk vult, plus sessie-/tokenmiddleware die die set raadpleegt bij elke inkomende actie. | Zodra een gekickte sessie aantoonbaar geweigerd wordt door de échte tokenmiddleware (niet een in-memory testdouble), mag dit naar test.skip-code (DT3b). |
| 11 | Acties/events in room A (antwoorden, scoreboard, kicks) zijn niet zichtbaar of van invloed in een gelijktijdig actieve room B. | DEPLOYMENT-AND-TESTING.md:303; ARCHITECTURE.md:185–222 (§Socketstrategie, §State machine); ARCHITECTURE.md:244–260 (§Redisstructuur en schaal, roomgescopede keys). | ARCHITECTURE.md, DATA-MODEL.md | Werkende multi-room state-opslag (roomgescopede keys of gelijkwaardig) en socket-roomstrategie zoals in ARCHITECTURE.md beschreven, met minimaal twee gelijktijdig draaiende rooms in de testomgeving. | Zodra twee onafhankelijke rooms tegelijk tegen dezelfde server-instantie kunnen draaien (geen single-room-only prototype), mag dit naar test.skip-code (DT3b). |
| 12 | Retry van `round:answer` met identieke `actionId` levert dezelfde ack zonder herverwerking; nieuwe `actionId` met (on)gewijzigde inhoud ná een al geaccepteerd antwoord geeft `ALREADY_ANSWERED`; score/state wijzigt nooit tweemaal. | DEPLOYMENT-AND-TESTING.md:304; PROTOCOL.md:103–104,310–317. | PROTOCOL.md, DATA-MODEL.md (Answer-opslag per `actionId`/`roundId`/`playerId`) | Echte answer-verwerking met opslag die op `actionId` dedupliceert, niet een fixture die toevallig hetzelfde teruggeeft. | Zodra de answer-handler tegen échte opslag (Redis/DB) idempotentie afdwingt, mag dit naar test.skip-code (DT3b). |
| 13 | `round:progress` wordt bij een reeks binnenkomende antwoorden maximaal tweemaal per seconde naar de room gebroadcast, ongeacht het aantal antwoorden in die periode. | Geen letterlijke bullet in §Integratie of §Contracttests van DEPLOYMENT-AND-TESTING.md. Verplaatst uit de contractlaag (DT1b) volgens dit plan-README (§Uitgangspunt 3, Fasering DT1b, regel 114–117) en REVIEW.md #4/#6. Normatieve eis: PROTOCOL.md:340. | PROTOCOL.md | Echte `round:progress`-broadcastlogica met throttling/debounce tegen een tijdklok (niet een test die één enkele emit controleert). | Zodra de broadcastimplementatie bestaat, mag dit naar test.skip-code (DT3b) — de test moet meerdere antwoorden binnen <500 ms simuleren en het daadwerkelijke aantal emits binnen 1 seconde tellen (≤2), niet alleen de eerste emit checken. |
| 14 | Een `room:state`-snapshot die tijdens een actieve ronde door de échte snapshotproducer wordt opgebouwd, bevat op geen enkel niveau `correctAnswer`. Aanvulling op de fixture-gebaseerde contractcheck (DT1b), nu tegen echte serverstate. | DEPLOYMENT-AND-TESTING.md:288 (§Contracttests) benoemt de eis, niet apart herhaald onder §Integratie. Verplaatsing van "bewijs tegen echte producer" naar deze laag volgt uit dit plan-README (§Uitgangspunt 3, Fasering DT1b, regel 114–117) en REVIEW.md #4/#6. Normatieve eis: PROTOCOL.md:236; DATA-MODEL.md:159,166–167. | PROTOCOL.md, DATA-MODEL.md | Echte snapshotproducer die Round-state (met `correctAnswer` in Redis/servermemory, DATA-MODEL.md:166–167) omzet naar de publieke State-snapshot-vorm. | Zodra de snapshotproducer bestaat en tegen een actieve ronde (status `ACTIVE`) draait, mag dit naar test.skip-code (DT3b) — de test moet de volledige serverresponse diepgaand doorzoeken op de string `correctAnswer`, niet alleen de topleveltoetsen controleren. |

## Expliciet

Geen van de veertien scenario's in deze matrix wordt als `test.skip`-code geschreven
vóórdat het activatiecriterium in die rij is gehaald — dat is precies de volgorde die
DT3a (deze matrix) en DT3b (latere code) van elkaar scheidt, en de reden dat DT3b pas
start nadat de betrokken eigenaren (GAME-RULES.md, PROTOCOL.md, DATA-MODEL.md,
ARCHITECTURE.md) de geraakte interfaces concreet hebben gemaakt.

## Audit-log

**Heraudit 2026-08-02 ([`DT-R1-heraudit-integratie`](prompts/DT-R1-heraudit-integratie.md)),
gecorrigeerd bij eigen verificatie dezelfde dag.**
Elke rij hieronder opnieuw gecontroleerd tegen de daadwerkelijke inhoud van
`server/`, niet tegen de aanname (uit `DT3b-integratie-code.md`) dat alles nog
geblokkeerd is. De heraudit rapporteerde **5/14 geactiveerd** (1, 2, 5, 8, 10),
geverifieerd tegen een geïsoleerde `git worktree` op commit `c7ce43b`. Bij
verificatie tegen de daadwerkelijke, actieve werkboom (dezelfde dag, ná de
heraudit) faalden alle 5 nieuwe tests met
`TypeError: context.store.loadRoomByInviteId is not a function` — dezelfde fout
breekt ook de reeds bestaande `server/composition/room-lifecycle.test.mjs`, dus
dit is een repo-brede staat, geen fout van deze heraudit of van de vijf nieuwe
tests zelf. **Gecorrigeerd resultaat: 0/14 daadwerkelijk actief in de werkboom.**
De vijf tests zijn verplaatst naar `tests/integration/pending/*.draft.mjs`
(inhoudelijk ongewijzigd, alleen niet meer in de `*.test.*`-glob) totdat
`server/composition/room-lifecycle.mjs` `loadRoomByInviteHash` aanroept in
plaats van het verwijderde `loadRoomByInviteId` — zie rij 1/2/5/8/10 hieronder
voor het exacte citaat.

**Methodologisch voorbehoud — instabiele werkboom tijdens deze audit.** Op het
moment van schrijven liepen er meerdere gelijktijdige sessies op dezelfde
werkboom: `server/data/repository.js` en `server/data/in-memory-store.js`
werden middenin een poortmigratie bewerkt (DM10:
`docs/data-model-plan/prompts/DM10-room-locator-claim.md`, `loadRoomByInviteId`
→ `loadRoomByInviteHash` + atomaire locator-claim), en er verscheen een nieuw,
nog niet door `server/composition/room-lifecycle.mjs` geconsumeerd bestand
`server/composition/match-lifecycle.mjs` (~1230 regels, potentieel relevant
voor rijen 7/9/12/13/14 zodra het stabiliseert en gekoppeld wordt). Op géén
moment tijdens deze audit implementeerde de ongecommitte werkboom een
consistente combinatie (`room-lifecycle.mjs` riep tot en met het einde van
deze audit nog `store.loadRoomByInviteId` aan, een methode die na de
`in-memory-store.js`-migratie niet meer bestaat — geverifieerd met een lokale
`node --test`-wachtlus van 5 minuten die niet stabiliseerde). Om toch een
betrouwbaar, reproduceerbaar oordeel te vellen is elke hieronder geciteerde
regel gelezen uit de werkboom (voor de rijen die niet activeren, waar de
instabiliteit niet relevant is) én zijn de vijf geactiveerde tests bovendien
apart bevestigd te slagen tegen de laatst gecommitte, interne consistente
stand (`git worktree add --detach <tmp> HEAD`, commit `c7ce43b`): 48/48
bestaande tests in `server/composition/room-lifecycle.test.mjs` én alle 5
nieuwe `tests/integration/matrix-row-*.test.mjs` slaagden daar. Geen
server-/opslagcode is door deze audit zelf aangepast. Zodra de lopende
poortmigratie is afgerond en `room-lifecycle.mjs` weer aansluit, horen deze
tests ook in de actieve werkboom weer te slagen; als dat niet zo is, is dat
een regressie in díe migratie, niet in de hier geactiveerde rijen.

| # | Status | Citaat | Datum |
| --- | --- | --- | --- |
| 1 | geblokkeerd (dicht bij) | `server/composition/room-lifecycle.mjs` `createRoom()` (regels 288–375) implementeert het gevraagde gedrag correct — bij `hostParticipates: false` blijft `player` `null`, respons heeft `playerId: null`/`effectiveName: null`/`roles: ['host']` — maar `createRoom()` roept intern `claimLocators()` aan, die op regel 253 `context.store.loadRoomByInviteId(...)` aanroept. Die methode bestaat niet meer in `server/data/repository.js` (gemigreerd naar `loadRoomByInviteHash` via DM10/DM11): `TypeError: context.store.loadRoomByInviteId is not a function`, geverifieerd tegen actuele HEAD. Test klaar en inhoudelijk correct in `tests/integration/pending/matrix-row-01-create-room-host-not-participating.draft.mjs`; hernoem naar `.test.mjs` in `tests/integration/` zodra die ene aanroep is bijgewerkt. | 2026-08-02 |
| 2 | geblokkeerd (dicht bij) | Zelfde onderliggende functie en zelfde blokkade als rij 1 (`claimLocators()` → verwijderde `loadRoomByInviteId`). De `hostParticipates: true`-tak zelf (regels 315–340, Player-document via `assertPlayerShape`) is inhoudelijk correct. Test klaar in `tests/integration/pending/matrix-row-02-create-room-host-participating.draft.mjs`, faalt nu op dezelfde `TypeError` als rij 1. | 2026-08-02 |
| 3 | geblokkeerd | `server/composition/room-lifecycle.mjs` regels 260–267 (commentaar bij `claimLocators`/`hashInviteId`): "De huidige poort indexeert op de rúwe inviteId ... en Room heeft geen `inviteHash`-veld, dus de hash heeft nu nog geen opslagplaats" — zelf-gedocumenteerd: geen hashindex-lookup zoals ARCHITECTURE.md:233–240 vereist (Prerequisite-kolom citeert die regel expliciet). De lopende DM10-poortmigratie (`loadRoomByInviteHash`, ongecommitteerd tijdens deze audit) sluit dit gat mogelijk binnenkort, maar `room-lifecycle.mjs` consumeert die nieuwe methode nog niet. | 2026-08-02 |
| 4 | geblokkeerd | Geen enkel bestand in `server/` implementeert rate limiting: `grep -rli "ratelimit" server/` vindt alleen de foutcode `CODE_RATE_LIMITED` in `server/protocol/error-codes.mjs` en een "niet in scope"-commentaar in `server/protocol/rest-games-create-join.mjs`. Prerequisite-kolom vereist expliciet "de rate-limiting uit ARCHITECTURE.md" naast de coderegistratie. | 2026-08-02 |
| 5 | geblokkeerd (dicht bij) | `resolveNames()` (regels 170–194) en `generateName()` (`server/data/name-processing.js`, regels 244–263) zijn zelf correct, maar de test roept ze aan via `createRoom()`/`joinRoom()`, die dezelfde `claimLocators()`-blokkade als rij 1 raken. Test klaar in `tests/integration/pending/matrix-row-05-displayname-and-generated-name.draft.mjs`. | 2026-08-02 |
| 6 | geblokkeerd | `server/composition/room-lifecycle.mjs` `getShareInfo()` (regels 584–595) levert de invite aan elke rol zonder rolcontrole — dat deel is er. Maar `server/protocol/client-events-dispatch.mjs` regel 136 registreert voor `share:opened` uitsluitend een payload-validator + rolcheck (`validateShareOpenedPayload`); geen enkele functie in `server/` persisteert of telt een `share:opened`-gebeurtenis. Prerequisite-kolom vereist expliciet "plus een `share:opened`-handler". | 2026-08-02 |
| 7 | geblokkeerd | `server/composition/` bevatte tot en met deze audit geen Match/Round-compositie die een volledige cyclus draait; `Room.phase` wordt door `room-lifecycle.mjs` nooit buiten `LOBBY` gezet. Een nieuw `server/composition/match-lifecycle.mjs` verscheen tegen het einde van deze audit (ongecommitteerd, nog niet gekoppeld aan een bijgewerkte `room-lifecycle.mjs`) — potentieel relevant voor een volgende heraudit, nu nog niet aantoonbaar end-to-end werkend. | 2026-08-02 |
| 8 | geblokkeerd (dicht bij) | `setRoomLocked()` (regels 604–617) en `joinRoom()`'s locked-check (regel 489–491) zijn zelf correct, maar de test moet eerst een room aanmaken via `createRoom()`, wat dezelfde `claimLocators()`-blokkade als rij 1 raakt. Test klaar in `tests/integration/pending/matrix-row-08-room-lock-blocks-and-allows-join.draft.mjs`. Buiten scope blijft het `room:lock-changed`-broadcastevent (geen Socket.IO-laag aanwezig). | 2026-08-02 |
| 9 | geblokkeerd | `server/composition/room-lifecycle.mjs` `joinRoom()` accepteert `eligibleFromRound` als parameter maar berekent hem expliciet niet zelf (regel 461: "Deze module verzint dat getal niet zelf"). Er bestaat geen gekoppelde match-laag die de fase op joinmoment kent of late joiners van scoring/noemer uitsluit. Activatiecriterium vereist expliciet "tegen de échte state machine én scoring". | 2026-08-02 |
| 10 | geblokkeerd (dicht bij) | `kickPlayer()` (regels 633–659) en `resolveSession()` (regels 677–689) zijn zelf correct, maar de test moet eerst een room aanmaken en laten joinen via `createRoom()`/`joinRoom()`, die dezelfde `claimLocators()`-blokkade als rij 1 raken. Test klaar in `tests/integration/pending/matrix-row-10-kick-revokes-session.draft.mjs`. Nuance ongewijzigd: DATA-MODEL.md documenteert zowel een `revoked`-veld op Session als een aparte Redis-set; deze implementatie gebruikt het eerste. | 2026-08-02 |
| 11 | geblokkeerd | Data-isolatie tussen rooms is aantoonbaar (`server/data/in-memory-store.js`, sleutels samengesteld uit `${roomId} ...`). Prerequisite-kolom vereist echter expliciet óók "socket-roomstrategie zoals in ARCHITECTURE.md beschreven"; geen enkel bestand in `server/` importeert `socket.io` behalve `server/index.mjs`, dat alle `/socket.io/*`-paden nog met `501 NOT_IMPLEMENTED` beantwoordt. | 2026-08-02 |
| 12 | geblokkeerd | `server/data/answer-flow.js` `resolveAnswer()` is een pure, ongewijzigde beslisfunctie zonder I/O; er is geen compositie-aanroeper die hem tegen de échte opslag (`saveAcceptedAnswerAtomically`) uitvoert. Activatiecriterium vereist expliciet "tegen échte opslag (Redis/DB) idempotentie afdwingt". | 2026-08-02 |
| 13 | geblokkeerd | `server/protocol/throttle-round-progress.mjs` `throttleRoundProgress()` bestaat als geïsoleerde module; geen compositielaag roept hem aan vanuit een echte `round:answer`-verwerkingsketen en er bestaat geen broadcastmechanisme (geen Socket.IO-laag, zie rij 11). | 2026-08-02 |
| 14 | geblokkeerd | Geen snapshotproducer-compositie bestaat die Round-state (met `correctAnswer`) omzet naar de publieke State-snapshotvorm; `Room.phase` bereikt in de huidige compositie nooit `ACTIVE` (alleen `LOBBY` bij creatie), dus is er geen actieve ronde om te snapshotten. `server/protocol/snapshot-shape.mjs` bevat alleen vorm-validators tegen losse fixtures, geen producer. | 2026-08-02 |
