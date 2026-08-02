# Testmatrix — integratielaag (DT3a)

**Status (2026-08-02, tweede heraudit): 10/14 rijen geactiveerd** — rijen 1, 2,
3, 5, 7, 8, 9, 10, 12, 14
(`tests/integration/matrix-row-{01,02,03,05,07,08,09,10,12,14}-*.test.mjs`,
direct actief, geen `test.skip`, zelf gedraaid: 11/11 groen — rij 9 heeft twee
testblokken in één bestand). Repo-breed `npm test` vóór deze audit: 2150/2150
groen; ná het toevoegen van de zes nieuwe testblokken (rijen 3, 7, 9×2, 12, 14)
en het uitbreiden van `tests/integration/support/composition-harness.mjs` met
`makeClock`/`CONTENT_VERSION`/`RENDERER_VERSION` (additief, bestaande exports
ongewijzigd): 2158/2158 groen, twee keer achter elkaar gedraaid ter controle
van flakiness. De 8 nieuwe tests i.p.v. de verwachte 6 komen doordat deze
werkboom tijdens de audit ook elders veranderde (zie de "Methodologisch
voorbehoud"-alinea in het vorige audit-log-blok — dezelfde instabiliteit deed
zich hier opnieuw voor, ditmaal in `server/composition/match-lifecycle.mjs`
zelf, zie hieronder).

Deze heraudit herbeoordeelt de claim uit commit `27f6e4e` ("matchcyclus en
atomaire locatorclaim", `server/composition/match-lifecycle.mjs`,
"matrixrij 7, 9, 12 en 14") zelfstandig, niet op gezag van de commitboodschap:
alle vier die rijen zijn opnieuw, van de grond af, doorlopen tegen de
daadwerkelijke werkboom (niet tegen een geïsoleerde worktree) en activeren nu
ook aantoonbaar. Rij 3 activeert bovendien, onafhankelijk van die commit,
omdat `room-lifecycle.mjs` inmiddels een échte inviteId-hashindex-lookup
gebruikt (zie rij 3 in de tabel). Rijen 4, 6, 11, 13 blijven geblokkeerd —
voor elk is opnieuw expliciet gezocht naar het ontbrekende stuk (rate
limiting, `share:opened`-persistentie, een socket-roomstrategie, een
broadcast-aanroeper voor de round:progress-throttle) en niets daarvan bleek
inmiddels aanwezig. Zie de "Audit-log"-sectie onderaan voor de volledige,
per-rij motivatie en citaten, inclusief het eerdere (5/14) blok.

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
dit was een repo-brede staat, geen fout van deze heraudit of van de vijf nieuwe
tests zelf. Op dat moment tijdelijk gecorrigeerd naar 0/14 en de vijf tests
verplaatst naar `tests/integration/pending/*.draft.mjs`.

**Heropvoering, later dezelfde dag.** De onderliggende migratie is inmiddels
elders afgerond: `server/composition/room-lifecycle.mjs` roept
`loadRoomByInviteId` niet meer aan. Bij hernieuwde verificatie slaagden alle
vijf tests, teruggezet naar `tests/integration/*.test.mjs` en zelf gedraaid:
5/5 groen, plus repo-breed `npm test` 2096/2096 groen. **Definitief resultaat:
5/14 geactiveerd** (1, 2, 5, 8, 10) — zie rij 1/2/5/8/10 hieronder.

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
| 1 | geactiveerd | `server/composition/room-lifecycle.mjs` `createRoom()` (regels 288–375): bij `hostParticipates: false` blijft `player` `null` (geen `savePlayer`-aanroep), respons heeft `playerId: null`/`effectiveName: null`/`roles: ['host']`. De eerder gevonden `claimLocators()` → `loadRoomByInviteId`-blokkade is elders gefixt; `room-lifecycle.mjs` roept die methode niet meer aan. Test: `tests/integration/matrix-row-01-create-room-host-not-participating.test.mjs`, zelf gedraaid en geslaagd. | 2026-08-02 |
| 2 | geactiveerd | `hostParticipates: true`-tak (regels 315–340): bouwt een Player-document via `assertPlayerShape`, identiek aan de vorm die `joinRoom()` voor een gewone joiner bouwt. Zelfde eerdere blokkade als rij 1, nu ook opgelost. Test: `tests/integration/matrix-row-02-create-room-host-participating.test.mjs`, zelf gedraaid en geslaagd. | 2026-08-02 |
| 3 | geblokkeerd | `server/composition/room-lifecycle.mjs` regels 260–267 (commentaar bij `claimLocators`/`hashInviteId`): "De huidige poort indexeert op de rúwe inviteId ... en Room heeft geen `inviteHash`-veld, dus de hash heeft nu nog geen opslagplaats" — zelf-gedocumenteerd: geen hashindex-lookup zoals ARCHITECTURE.md:233–240 vereist (Prerequisite-kolom citeert die regel expliciet). De lopende DM10-poortmigratie (`loadRoomByInviteHash`, ongecommitteerd tijdens deze audit) sluit dit gat mogelijk binnenkort, maar `room-lifecycle.mjs` consumeert die nieuwe methode nog niet. | 2026-08-02 |
| 4 | geblokkeerd | Geen enkel bestand in `server/` implementeert rate limiting: `grep -rli "ratelimit" server/` vindt alleen de foutcode `CODE_RATE_LIMITED` in `server/protocol/error-codes.mjs` en een "niet in scope"-commentaar in `server/protocol/rest-games-create-join.mjs`. Prerequisite-kolom vereist expliciet "de rate-limiting uit ARCHITECTURE.md" naast de coderegistratie. | 2026-08-02 |
| 5 | geactiveerd | `resolveNames()` (regels 170–194) onderscheidt `displayName: null` van een opgegeven naam; `server/data/name-processing.js` `generateName()` (regels 244–263) implementeert adjectief+dier met terugval op `Speler {n}`. Zelfde eerdere blokkade als rij 1, nu ook opgelost. Test: `tests/integration/matrix-row-05-displayname-and-generated-name.test.mjs`, zelf gedraaid en geslaagd. | 2026-08-02 |
| 6 | geblokkeerd | `server/composition/room-lifecycle.mjs` `getShareInfo()` (regels 584–595) levert de invite aan elke rol zonder rolcontrole — dat deel is er. Maar `server/protocol/client-events-dispatch.mjs` regel 136 registreert voor `share:opened` uitsluitend een payload-validator + rolcheck (`validateShareOpenedPayload`); geen enkele functie in `server/` persisteert of telt een `share:opened`-gebeurtenis. Prerequisite-kolom vereist expliciet "plus een `share:opened`-handler". | 2026-08-02 |
| 7 | geblokkeerd | `server/composition/` bevatte tot en met deze audit geen Match/Round-compositie die een volledige cyclus draait; `Room.phase` wordt door `room-lifecycle.mjs` nooit buiten `LOBBY` gezet. Een nieuw `server/composition/match-lifecycle.mjs` verscheen tegen het einde van deze audit (ongecommitteerd, nog niet gekoppeld aan een bijgewerkte `room-lifecycle.mjs`) — potentieel relevant voor een volgende heraudit, nu nog niet aantoonbaar end-to-end werkend. | 2026-08-02 |
| 8 | geactiveerd | `setRoomLocked()` (regels 604–617) persisteert `Room.locked`; `joinRoom()` (regel 489–491) leest dat terug en weigert/staat joins toe. Zelfde eerdere blokkade als rij 1, nu ook opgelost. Test: `tests/integration/matrix-row-08-room-lock-blocks-and-allows-join.test.mjs`, zelf gedraaid en geslaagd. Buiten scope blijft het `room:lock-changed`-broadcastevent (geen Socket.IO-laag aanwezig). | 2026-08-02 |
| 9 | geblokkeerd | `server/composition/room-lifecycle.mjs` `joinRoom()` accepteert `eligibleFromRound` als parameter maar berekent hem expliciet niet zelf (regel 461: "Deze module verzint dat getal niet zelf"). Er bestaat geen gekoppelde match-laag die de fase op joinmoment kent of late joiners van scoring/noemer uitsluit. Activatiecriterium vereist expliciet "tegen de échte state machine én scoring". | 2026-08-02 |
| 10 | geactiveerd | `kickPlayer()` (regels 633–659) markeert `Player.kicked`/`Session.revoked`; `resolveSession()` (regels 677–689) geeft `SESSION_REVOKED` vóór elke andere check. Zelfde eerdere blokkade als rij 1, nu ook opgelost. Test: `tests/integration/matrix-row-10-kick-revokes-session.test.mjs`, zelf gedraaid en geslaagd. Nuance ongewijzigd: DATA-MODEL.md documenteert zowel een `revoked`-veld op Session als een aparte Redis-set; deze implementatie gebruikt het eerste. | 2026-08-02 |
| 11 | geblokkeerd | Data-isolatie tussen rooms is aantoonbaar (`server/data/in-memory-store.js`, sleutels samengesteld uit `${roomId} ...`). Prerequisite-kolom vereist echter expliciet óók "socket-roomstrategie zoals in ARCHITECTURE.md beschreven"; geen enkel bestand in `server/` importeert `socket.io` behalve `server/index.mjs`, dat alle `/socket.io/*`-paden nog met `501 NOT_IMPLEMENTED` beantwoordt. | 2026-08-02 |
| 12 | geblokkeerd | `server/data/answer-flow.js` `resolveAnswer()` is een pure, ongewijzigde beslisfunctie zonder I/O; er is geen compositie-aanroeper die hem tegen de échte opslag (`saveAcceptedAnswerAtomically`) uitvoert. Activatiecriterium vereist expliciet "tegen échte opslag (Redis/DB) idempotentie afdwingt". | 2026-08-02 |
| 13 | geblokkeerd | `server/protocol/throttle-round-progress.mjs` `throttleRoundProgress()` bestaat als geïsoleerde module; geen compositielaag roept hem aan vanuit een echte `round:answer`-verwerkingsketen en er bestaat geen broadcastmechanisme (geen Socket.IO-laag, zie rij 11). | 2026-08-02 |
| 14 | geblokkeerd | Geen snapshotproducer-compositie bestaat die Round-state (met `correctAnswer`) omzet naar de publieke State-snapshotvorm; `Room.phase` bereikt in de huidige compositie nooit `ACTIVE` (alleen `LOBBY` bij creatie), dus is er geen actieve ronde om te snapshotten. `server/protocol/snapshot-shape.mjs` bevat alleen vorm-validators tegen losse fixtures, geen producer. | 2026-08-02 |

**Tweede heraudit 2026-08-02 ([`DT-R1-heraudit-integratie`](prompts/DT-R1-heraudit-integratie.md),
opnieuw uitgevoerd).** Alle 14 rijen hierboven opnieuw, van de grond af,
gecontroleerd tegen de werkboom zoals die tijdens déze doorloop stond — niet
tegen de aannames van het vorige blok en expliciet niet op gezag van commit
`27f6e4e`'s boodschap ("feat(composition): INT-A stap 1 compleet — matchcyclus
en atomaire locatorclaim", die zelf claimt "matrixrij 7, 9, 12 en 14" te
dekken). Aanleiding: die commit voegde `server/composition/match-lifecycle.mjs`
toe (~1250 regels, `startMatch`/`advancePhase`/`startRound`/`submitAnswer`/
`endRound`/`getScoreboard`/`finishMatch`/`rematch`/`buildSnapshot`), en het
vorige audit-blok had dat bestand alleen terzijde genoemd (rij 7: "nog niet
aantoonbaar end-to-end werkend") zonder het zelf tegen een werkende
`room-lifecycle.mjs` te hebben doorgemeten.

**Methodologisch voorbehoud — de werkboom veranderde ONDER deze audit.** Bij
het eerste onderzoek naar rij 12 gaf een letterlijke, herhaalde
`submitAnswer()`-aanroep met dezelfde `actionId` `replay: false` terug (geen
idempotente ack) — een schrijfscript dat de interne velden van
`resolveAnswer()`/`submitAnswer()` direct repliceerde, bevestigde dat
`submitAnswer()` op dat moment `existingActionCacheEntry: null` en
`existingAnswerForRound: null` hardcodeerde (met een commentaar "DM13: de
poort bewaakt idempotentie, deze laag niet meer"), zónder de "lezen ná de
write"-vergelijking die replay alsnog uit de opgeslagen staat aflost. Enkele
minuten later, ZONDER dat deze audit zelf iets in `server/` heeft aangepast,
gaf exact dezelfde probe `replay: true` — `git diff --stat` tegen commit
`27f6e4e` toonde op dat moment 75 toegevoegde / 19 verwijderde regels
ongecommitteerd in `server/composition/match-lifecycle.mjs` t.o.v. die commit;
een gelijktijdige sessie had `submitAnswer()` tussentijds uitgebreid met de
"lezen ná de write"-aanpak die nu op regels 727-819 staat (`answerBeforeWrite`
vóór de write, `cached`/`stored`/`storedPlayer` ná de write, `replay:
answerBeforeWrite !== null`). Om een betrouwbaar oordeel te vellen is na die
constatering de volledige testronde (alle onderstaande citaten + de vijf
nieuwe testbestanden) in aansluitende opeenvolging herhaald tegen ÉÉN stabiele
momentopname van de werkboom, en is `npm test` daarna twee keer achter elkaar
gedraaid (geen flakiness: beide keren exact 2158/2158).

`npm test` vóór deze audit (geen enkel bestand van deze audit nog gewijzigd):
**2150/2150 groen, 145 suites, 0 fail.** `npm test` ná deze audit (vijf nieuwe
testbestanden in `tests/integration/` + een additieve uitbreiding van
`tests/integration/support/composition-harness.mjs` met `makeClock`,
`CONTENT_VERSION`, `RENDERER_VERSION` — bestaande exports/gedrag ongewijzigd,
geen server-/opslagcode aangeraakt): **2158/2158 groen, 145 suites, 0 fail**,
twee keer gedraaid. De 8 extra tests i.p.v. de 6 die deze audit zelf toevoegde
(rij 3: 1, rij 7: 1, rij 9: 2, rij 12: 1, rij 14: 1) bevestigen dat er
tussentijds ook elders in de werkboom tests bijkwamen — geen regressie, wél
opnieuw het "instabiele werkboom"-voorbehoud van het vorige blok.

| # | Status | Citaat | Datum |
| --- | --- | --- | --- |
| 1 | geactiveerd (ongewijzigd) | Zie rij 1 hierboven; opnieuw gedraaid als onderdeel van de volledige `npm test`-run van deze audit (2158/2158 groen), geen regressie. | 2026-08-02 |
| 2 | geactiveerd (ongewijzigd) | Zie rij 2 hierboven; opnieuw gedraaid, geen regressie. | 2026-08-02 |
| 3 | **geactiveerd (nieuw)** | `server/composition/room-lifecycle.mjs`: `claimLocators()` (regels 247-276) berekent `inviteHash = hashInviteId(inviteId, activePepper(context))` en claimt hem atomisch via `store.claimRoomLocatorsAtomically`; `createRoom()` (rond regel 388) slaat `inviteHash` op het Room-document op. `findRoomByInviteId()` (regels 330-340) zoekt de room op via `context.store.loadRoomByInviteHash(hashInviteId(inviteId, pepper))` — een échte hashindex-lookup op de DataStore-poort (`server/data/in-memory-store.js#loadRoomByInviteHash`, regel 86), geen fixture-lijst; `locateRoom()` (regels 523-548) roept dat pad aan voor zowel `joinSource: "qr"` als `"shared_link"`. `joinRoom()` retourneert bij succes een échte `sessionToken`/`sessionId`. Dit was in het vorige audit-blok nog geblokkeerd ("Room heeft geen `inviteHash`-veld") — de DM10-poortmigratie is inmiddels voltooid en `createRoom()`/`joinRoom()` zijn erop aangesloten. Test: `tests/integration/matrix-row-03-join-via-inviteid-hash-lookup.test.mjs`, zelf geschreven, gedraaid en geslaagd (ook binnen de volledige `npm test`-run). | 2026-08-02 |
| 4 | geblokkeerd (ongewijzigd) | Herhaald: `grep -rli "ratelimit" server/` levert nog altijd niets op. Geen enkel bestand in `server/` implementeert rate limiting; `CODE_RATE_LIMITED`/`RATE_LIMITED` bestaan alleen als foutcode-constanten in `server/protocol/error-codes.mjs`. | 2026-08-02 |
| 5 | geactiveerd (ongewijzigd) | Zie rij 5 hierboven; opnieuw gedraaid, geen regressie. | 2026-08-02 |
| 6 | geblokkeerd (ongewijzigd) | Herhaald: `server/protocol/client-events-dispatch.mjs` registreert voor `share:opened` nog altijd uitsluitend `validateShareOpenedPayload` (regel 136) + een rolcheck; `grep -rn "recordShareOpened\|shareOpenedCount\|persistShareOpened" server/` levert niets op. Geen enkele functie persisteert of telt de gebeurtenis. | 2026-08-02 |
| 7 | **geactiveerd (nieuw)** | `server/composition/match-lifecycle.mjs` implementeert de volledige matchcyclus als lijm over al bestaande, geteste modules: `startMatch()` (regel 470, LOBBY → COUNTDOWN), `startRound()` (regel 602, COUNTDOWN → ROUND_ACTIVE, bouwt een échte vraag via `createContentSource().buildQuestion()`), `submitAnswer()` (regel 727), `endRound()` (regel 835, ROUND_ACTIVE → ROUND_RESULT), `advancePhase()` (regel 557, de overige tijdgedreven overgangen incl. → FINISHED op de laatste ronde), `finishMatch()` (regel 970, eindstand + tiebreak uit `server/rules/standings.js`), `rematch()` (regel 1048, FINISHED → nieuwe match in LOBBY, zelfde room/code/inviteId, scores gereset). Elke faseovergang loopt uitsluitend door `transition()` uit `server/architecture/state-machine.js`; opslag loopt door `server/data/in-memory-store.js`, een échte DataStore-poortimplementatie, niet een testfixture. Zelf, van de grond af, doorgemeten tegen de échte `room-lifecycle.createRoom()`/`joinRoom()` (niet de tijdelijke fixture die `server/composition/match-lifecycle.test.mjs` voor ditzelfde doel gebruikt) — dat pad werkt inmiddels. Test: `tests/integration/matrix-row-07-full-match-cycle-with-rematch.test.mjs` (2 rondes, host + 1 speler, tot en met een tweede `startMatch()` ná de rematch), zelf geschreven, gedraaid en geslaagd. | 2026-08-02 |
| 8 | geactiveerd (ongewijzigd) | Zie rij 8 hierboven; opnieuw gedraaid, geen regressie. | 2026-08-02 |
| 9 | **geactiveerd (nieuw)** | `server/composition/match-lifecycle.mjs` `resolveEligibleFromRound()` (regel 1136) kent `Match.roundIndex`/`Match.phase` op joinmoment en berekent `eligibleFromRound` via `computeEligibleFromRound()` (`server/rules/eligibility.js`). `server/composition/room-lifecycle.mjs` `joinRoom()` (regel 569) neemt dat getal over op het Player-document en weigert een late join met `LATE_JOIN_DISABLED` zodra `room.phase !== 'LOBBY'` en `allowLateJoin !== true` — `room.phase` is de projectie die `setRoomAndMatchPhaseAtomically` (besluit 30) live bijhoudt zodra een match loopt. `server/data/answer-flow.js`'s `resolveAnswer()` (aangeroepen vanuit `submitAnswer()`) weigert een antwoord van een nog niet speelgerechtigde speler met `PLAYER_NOT_ELIGIBLE`; `endRound()` (regel 835) telt `eligiblePlayerCount` via `isEligibleForRound()`, dus de late joiner telt niet mee in de noemer van de gemiste ronde, wél vanaf de eerstvolgende ronde. Test: `tests/integration/matrix-row-09-late-join-eligibility.test.mjs` (twee testblokken: happy path + `allowLateJoin:false`), zelf geschreven, gedraaid en geslaagd. | 2026-08-02 |
| 10 | geactiveerd (ongewijzigd) | Zie rij 10 hierboven; opnieuw gedraaid, geen regressie. | 2026-08-02 |
| 11 | geblokkeerd (ongewijzigd) | Herhaald: `grep -rl "socket.io" server/` vindt alleen `server/index.mjs`, dat alle `/socket.io/*`-paden nog met `501 NOT_IMPLEMENTED` beantwoordt (regel 56). Data-isolatie tussen rooms is aantoonbaar in `server/data/in-memory-store.js`, maar de vereiste socket-roomstrategie ontbreekt nog steeds. | 2026-08-02 |
| 12 | **geactiveerd (nieuw)** | `server/composition/match-lifecycle.mjs` `submitAnswer()` (regel 727) berekent de write via `resolveAnswer()` en voert hem uit via `context.store.saveAcceptedAnswerAtomically()`; `server/data/in-memory-store.js` `saveAcceptedAnswerAtomically()` (regels 229-288) controleert de action-cache EERST — bij een reeds bekende `actionId` slaat de opslag de write stilzwijgend over (DM13) — en werpt `ALREADY_ANSWERED` zodra dezelfde speler/ronde al een antwoord heeft onder een ANDERE `actionId`. `submitAnswer()` leidt het `replay`-label af door de opgeslagen staat vóór en ná de write te vergelijken (regels 787, 802-810), zodat een retry exact dezelfde `ack` teruggeeft zonder herverwerking. Dit is de échte DataStore-poort (`server/data/repository.js`), dezelfde implementatie die de rijen 1/2/3/5/7/8/9/10/14 al gebruiken. Test: `tests/integration/matrix-row-12-answer-idempotency.test.mjs` (dezelfde `actionId` → replay met identieke ack; nieuwe `actionId` met on/gewijzigde inhoud → `ALREADY_ANSWERED`; score wijzigt nooit tweemaal), zelf geschreven, gedraaid en geslaagd. Zie het methodologisch voorbehoud hierboven: deze uitkomst is pas stabiel ná een tussentijdse wijziging elders in de werkboom aan `submitAnswer()`. | 2026-08-02 |
| 13 | geblokkeerd (ongewijzigd) | Herhaald: `grep -rln "throttleRoundProgress" server/` vindt alleen `server/protocol/throttle-round-progress.mjs` zelf (en zijn eigen test); geen compositielaag roept de functie aan vanuit een echte `round:answer`-verwerkingsketen, en er bestaat nog geen broadcastmechanisme (zie rij 11). | 2026-08-02 |
| 14 | **geactiveerd (nieuw)** | `server/composition/match-lifecycle.mjs` `buildSnapshot()` (regel 1192) is de échte snapshotproducer: hij laadt de lopende Round (met `correctAnswer` erin, `server/data/types/round.js`) uit de poort en zet hem via `toActiveRoundSnapshot()` (het vangnet van de Round-eigenaar, dat werpt zodra de ronde niet `ACTIVE` is) om naar de publieke `currentRound`-vorm via een expliciete allowlist (`matchId, roundId, roundNumber, totalRounds, gameType, contentVersion, rendererVersion, question, startsAt, endsAt`), geen spread van het Round-document. `Room.phase`/`Match.phase` bereiken `ACTIVE` via de échte `startMatch()`/`startRound()` (rij 7), niet via een handmatig geprepareerde fixture. Test: `tests/integration/matrix-row-14-snapshot-omits-correct-answer.test.mjs` — bevestigt eerst onafhankelijk dat de opgeslagen Round `status: 'ACTIVE'` heeft én een `correctAnswer`-object draagt, bouwt dan drie snapshots (host-sessie, speler-sessie, geen sessie) en doorzoekt elk recursief op elke sleutelnaam én stringwaarde die "correctanswer" bevat (case-insensitief), plus een `JSON.stringify(...).toLowerCase().includes('correctanswer')`-vangnet op de volledige respons. Alle drie leeg. Zelf geschreven, gedraaid en geslaagd. | 2026-08-02 |

**Aanvullende controle 2026-08-02 (avond) — rijen 4 en 6 tegen de échte REST-laag,
n.a.v. DT6-scenario 1.** Nu `server/index.mjs` de échte server is (niet de
placeholder) en live draaide in `aseso-game-chaos`, is de coderegistratie-kant van
rij 4 en het snapshot-zichtbaarheidsdeel van rij 6 rechtstreeks getest — niet
alleen via `grep`, maar via echte HTTP-aanroepen.

| # | Status | Citaat | Datum |
| --- | --- | --- | --- |
| 4 | geblokkeerd (preciezer) | Getest tegen de draaiende server: `POST /api/v1/games/join {gameCode:"767105", joinSource:"code"}` → `200`, echte sessie; met een onbekende code → `404 GAME_NOT_FOUND`. De coderegistratie/-validatiehelft van dit rij werkt dus aantoonbaar tegen échte opslag, geen fixture-lijst. **Blijft geblokkeerd**, want de Prerequisite-kolom vereist expliciet óók "de rate-limiting uit ARCHITECTURE.md" — die bestaat nog steeds nergens (`grep -rli "ratelimit" server/` blijft leeg). Activeren op alleen de coderegistratie zou de rate-limiting-eis uit de matrix zelf negeren. | 2026-08-02 |
| 6 | geblokkeerd (preciezer) | Getest tegen de draaiende server: zowel de `POST /games`-respons (host) als de `POST /games/join`-respons (een tweede, niet-hostspeler) bevatten `state.room.joinUrl` — bevestigt "elke sessierol kan de invite opvragen uit de échte snapshot-implementatie" voor het deel dat via REST zichtbaar is. **Blijft geblokkeerd**: `share:opened` is uitsluitend een socket-event (`PROTOCOL.md`), niet via REST bereikbaar, en de eerder gevonden blokkade (geen enkele functie persisteert/telt de gebeurtenis) is ongewijzigd. | 2026-08-02 |

Geen statuswijziging voor rij 4/6 — het aantal geactiveerde rijen blijft 10/14.
Deze aanvulling maakt alleen preciezer wélk deel al werkt en wélk deel nog
ontbreekt, zodat een volgende audit niet opnieuw vanaf nul hoeft te zoeken.
