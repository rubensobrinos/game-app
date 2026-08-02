# Realisatieplan — DATA-MODEL.md

Uitvoeringsplan voor [`docs/multiplayer/DATA-MODEL.md`](../multiplayer/DATA-MODEL.md).
Dit document wijzigt de specificatie niet — het beschrijft hoe ik de daar vastgelegde
vormen omzet in geteste code, in welke volgorde, en waar ik stop om goedkeuring te
vragen. Zie ook [`docs/multiplayer/README.md`](../multiplayer/README.md)
("Wijzigingsdiscipline") en het sibling-plan
[`docs/game-rules-plan/README.md`](../game-rules-plan/README.md) (sectie 8 hieronder).

**Revisie na [`REVIEW.md`](REVIEW.md) (2026-08-02).** Die review vond 2 blockers en
10 hoge bevindingen: de kern was dat dit plan voorbeeldwaarden en open semantiek te
vaak als reeds bindend schema behandelde. Zie sectie 9 voor de volledige
bevinding-naar-wijziging-tabel.

**Tweede revisie na [`prompts/REVIEW-DM2-DM9.md`](prompts/REVIEW-DM2-DM9.md).**
Alle negen DM2–DM9-prompts zijn eerst uitgeschreven (`prompts/DM2a-*.md` t/m
`prompts/DM9-*.md`) en na die tweede, onafhankelijke review herzien: 3 blockers
(idempotentie-volgorde en scorelek in DM7, een niet-implementeerbare
invite-hash-lookup in DM6), 8 hoge en 3 middelhoge bevindingen — o.a. `Room` →
`RoomCore` hernoemd, `server/architecture`-import vervangen door lokale
transcriptie (+ voorstel voor een neutrale module in `HANDOFF.md` §5), en `Round`
uitgebreid na reconciliatie met de inmiddels herziene `GR4-question-selection.md`.
Zie [`DM-PROGRESS.md`](DM-PROGRESS.md) §Cijfers voor de volledige lijst.

**Uitgevoerd. Alle zeventien fases (DM2–DM16) staan in `server/data/`, 492/492
tests groen** (`node --test 'server/data/**/*.test.js'`). DM10–DM16
(§3 hieronder) zijn een latere ronde, gebouwd als reactie op
`docs/integration-plan/`'s HANDOFF-bevindingen. **De poort is sinds DM13
bevroren, met een gevolgd voorstel-proces voor DM14–DM16** — zie `HANDOFF.md`
§7b. Tijdens de uitvoering van
DM2–DM9 kwam
[`docs/multiplayer/DECISIONS.md`](../multiplayer/DECISIONS.md) binnen (2 augustus
2026, bevestigd door de producteigenaar) en loste daarmee checkpoint 4 op:
`contentVersion`/`rendererVersion` zijn canoniek op `Match`, niet Room —
`Match` is bijgewerkt, en `RoomCore` is teruggedoopt naar het volwaardige
`Room` nu de tussenvorm niet langer nodig is
(`prompts/DM-RESUME-AFTER-DECISIONS.md`). Zie [`DM-PROGRESS.md`](DM-PROGRESS.md)
voor de volledige, actuele status per sectie.

**Cross-plan vragen beantwoord in [`HANDOFF.md`](HANDOFF.md).** `game-rules-plan` en
`protocol-plan` hadden elk een vraag liggen die `DATA-MODEL.md`-eigenaarschap raakt
(de `Round.correctAnswer`-vorm per spelvorm; het bronveld voor `roundNumber`; of
`game:rematch` `Player`-velden in place reset). Alle drie zijn daar beantwoord —
bevestigd waar de bestaande spec het al toeliet, expliciet als voorstel gemarkeerd
waar niet. Dat is losstaand van de DM2–DM9-fasering hieronder; het is voorbereidend
werk voor DM3 (Round/Player/Match), niet een fase op zich.

## 1. Uitgangspunten

1. **Drieweg-onderscheid, niet tweeweg.** `DATA-MODEL.md` valt onder
   `database_schema` (`devkit policy --json` → `require_adr_for`). Ik onderscheid nu:
   - **(a) Letterlijk vastgelegd** — alleen wat woordelijk in `DATA-MODEL.md` staat:
     veldnamen in de JSON-voorbeelden, de exacte Redis-sleutelpatronen, de TTL-waarde
     (14.400 s), de tien stappen van de antwoordverwerking, de Postgres-tabel- en
     kolomnamen mét de daar gegeven kolomtypen. Eén voorbeeldwaarde is geen
     uitputtende enumlijst en een voorbeeld-JSON is geen volledig schema — required/
     optional/nullable/extra-properties-beleid en complete enumlijsten horen dus
     **niet** bij (a), ook al voelen ze vanzelfsprekend aan.
   - **(b) Echte ADR-plicht** — `deps`, `architecture`, `auth` of `database_schema`
     in de zin van devkit policy: clientlibrary-keuze, hash- vs. JSON-serialisatie,
     Lua vs. MULTI/EXEC, migratietool/database-engine, hashingalgoritmes.
   - **(c) Open semantiek zonder ADR-plicht, maar wél een voorstelstap nodig** —
     dingen die de bron simpelweg niet vastlegt en die ik daarom niet stilzwijgend
     mag verzinnen: volledige enumlijsten, de TTL-refreshmatrix, de exacte
     naamverwerkingsalgoritmes, het analytics-eventcontract, en de
     `contentVersion`/`rendererVersion`-locatie (zie bevinding 4 in `REVIEW.md`,
     ook gesignaleerd door `docs/protocol-plan/`). (c)-items landen als voorstel of
     traceability-tabel vóór ze als code "waar" worden, maar blokkeren geen ADR-flow.
2. **Dit document wijzigt de specificatie niet** — alles hier is transcriptie of
   voorstel, nooit een nieuwe bindende beslissing namens `DATA-MODEL.md`.
3. **Pure functies en domeinpoorten, geen vroegtijdige clientkeuze.** Net als het
   `GAME-RULES.md`-plan bouw ik logica zonder Redis/Postgres/sockets. Waar I/O nodig
   is, definieert de poort **domeinoperaties** (`loadRoom`,
   `saveAcceptedAnswerAtomically`), nooit Redis-vormige primitieven (`hSet`, `zAdd`,
   `multi`) — die zouden de hash/JSON- en Lua/MULTI-ADR al impliciet beslissen.
4. **Geen nieuwe dependencies om te beginnen.** Plain JavaScript met JSDoc, `node:test`
   + `node:assert`. Precedent in de repo: `server/rules/` en `server/architecture/`
   bestaan al en gebruiken dezelfde aanpak.
5. **Autonomie-limieten gelden ook voor dit plan zelf.** Max 15 bestanden/5.000 regels
   per actie. De vorige versie van dit document was zelf 461 regels — een interne
   inconsistentie (bevinding 15). Detailwerk staat daarom in `prompts/M*.md` per
   fase; dit bestand blijft een overzicht.
6. **De server is autoritair, dus de data-laag ook.** `Round.correctAnswer` mag nooit
   vóór `round:ended` in een client-gerichte projectie voorkomen — met een test die
   ook onbekende/gelekte velden via spread of `publicQuestionPayload` uitsluit, niet
   alleen de afwezigheid van `correctAnswer` (bevinding 5).
7. **Bewijsclaims kloppen met wat een pure functie kan bewijzen.** Een functie die een
   write-set teruggeeft bewijst dat de set compleet is — niet dat opslag ze atomair
   uitvoert. Die tweede claim hoort bij adapter-/integratietests ná de Lua/MULTI-ADR
   (bevinding 8).

## 2. Onderdelen en modules

| Onderdeel in DATA-MODEL.md | Module (voorstel) | Aard | Fase |
| --- | --- | --- | --- |
| Room, GameConfiguration, Session, Player, Match, Round, Answer, RoomPresentation | `types/*.js` — traceability-tabel + JSDoc voor zekere velden; **geen** enum-afdwingende runtime-validator totdat enumlijsten bevestigd zijn | (a) voor zekere velden, (c) voor enums/required/optional | DM2, DM3 |
| Redis-sleutels | `redis-keys.js` — pure builders, met invoervalidatie tegen key-injection | (a) patronen; (b)/(c) `inviteHash`-hashmechanisme en `answers:{id}`-interpretatie (aangenomen: ronde-ID, expliciet gedocumenteerd) | DM1 |
| TTL | `ttl.js` — alleen `ROOM_TTL_SECONDS` + key-builders | (a) waarde; refreshmatrix, cleanup-cadans en idempotency-TTL voor action-cache zijn (c), apart voorstel | DM1 |
| `contentVersion`/`rendererVersion` | — | (c), blokkerende reconciliatie tussen `DATA-MODEL.md` (Room), `ARCHITECTURE.md` ("iedere match pint") en `PROTOCOL.md` (veld op het round-payload) | vóór DM2/DM6, checkpoint 4 |
| Actieve-ronde-projectie | `toActiveRoundSnapshot()` (hernoemd van `toPublicRound`) met expliciet allowlist-outputcontract; aparte, nog te ontwerpen ended-resultaatvorm bij `PROTOCOL.md` | (a) kernregel; (c) exacte allowlist | DM3 |
| Naamverwerking | `name-processing.js` — vaste stappen (trim/NFKC/lengte) apart van open semantiek (grapheme- vs. code-point-definitie, control/format-tekenset, case-/accentgevoeligheid bij uniciteit, suffixgedrag, woordenlijsten) | (a) vaste stappen; (c) open semantiek als beslismatrix | DM4 |
| Privacy | `privacy-guard.js` — **allowlist per doeltabel**, geen denylist op veldnamen | (a) verboden-veldenlijst als ondergrens; (c) allowlist-precisie | DM5 |
| Repository | domeinpoort (`loadRoom`, `saveAcceptedAnswerAtomically`, `setRoomAndMatchPhaseAtomically`, ...) + in-memory fake die alleen domeinsemantiek bewijst, geen Redis-concurrency/failure-modi | (a) operatienamen; (b) uitvoeringsmechanisme | DM6 |
| Atomaire antwoordverwerking | `answer-flow.js` — resolutielogica; stap 6 via `GAME-RULES.md`'s `scoreAnswer()` (niet `computeScore()` — zie bevinding 8) | (a) stappen 1–5,7–10; (b) uitvoeringsmechanisme | DM7 |
| Analytics | eerst een kolomtraceability- + privacymatrix en een apart analytics-eventcontractvoorstel; `schema.sql` als niet-uitvoerbaar voorstel **onder `docs/`**, niet in `server/`-code (bevinding 9) | (a) tabel-/kolomnamen; (c) eventcontract en aggregatiesemantiek | DM8 |
| Interface naar GAME-RULES.md | reconciliatiemoment met kleine, per-use-case projecties (`toStandingPlayerView`, `toEligibilityPlayerView`, later `toTeamPlayerView`), samen met de consumer bepaald, niet vooraf | (c), geen ADR | DM9 |

Voorgestelde locatie: `server/data/` (checkpoint 1) — naast `server/rules/` en
`server/architecture/`, die al bestaan en dus een sterk precedent zijn, al is dat
geen vervanging voor expliciete bevestiging.

## 3. Fasering — status

**Herzien:** onderstaande statussen zijn opnieuw beoordeeld op wat *echt* extern
geblokkeerd is versus wat zelfopgelegde volgorde was. Zie sectie 10 voor de
gevolgen daarvan.

| Fase | Inhoud | Status |
| --- | --- | --- |
| DM0 | Scaffold `server/data/` | **Uitgevoerd** — [`prompts/DM0-scaffold.md`](prompts/DM0-scaffold.md) |
| DM1 | Key-builders + `ROOM_TTL_SECONDS` | **Uitgevoerd** — [`prompts/DM1-keys-and-ttl.md`](prompts/DM1-keys-and-ttl.md), 66/66 tests groen |
| DM2a | GameConfiguration, Session | **Uitgevoerd** — [`prompts/DM2a-game-configuration-and-session.md`](prompts/DM2a-game-configuration-and-session.md), 44/44 tests groen |
| DM2b | Room (incl. `contentVersion`/`rendererVersion`-uitzondering) | **Uitgevoerd** — [`prompts/DM2b-room.md`](prompts/DM2b-room.md), 24/24 tests groen; hernoemd van `RoomCore` naar `Room` na `DECISIONS.md` #21 (checkpoint 4 opgelost) |
| DM3 | Player, Match (incl. `contentVersion`/`rendererVersion`), Round (incl. `validOptionIds`/`resultDetails`), Answer, RoomPresentation, `toActiveRoundSnapshot(round, match)` | **Uitgevoerd** — [`prompts/DM3-player-match-round-answer-presentation.md`](prompts/DM3-player-match-round-answer-presentation.md), bijgewerkt na `DECISIONS.md` #21 |
| DM4 | Naamverwerking | **Uitgevoerd** — [`prompts/DM4-name-processing.md`](prompts/DM4-name-processing.md), 34/34 tests groen |
| DM5 | Privacy-guard | **Uitgevoerd** — [`prompts/DM5-privacy-guard.md`](prompts/DM5-privacy-guard.md), 109/109 tests groen |
| DM6 | Repository-domeinpoort + fake | **Uitgevoerd** — [`prompts/DM6-repository-port.md`](prompts/DM6-repository-port.md), 23/23 tests groen |
| DM7 | Answer-flow resolutielogica | **Uitgevoerd** — [`prompts/DM7-answer-flow.md`](prompts/DM7-answer-flow.md), 28/28 tests groen |
| DM8 | Analytics-voorstel | **Uitgevoerd** — [`prompts/DM8-analytics-proposal.md`](prompts/DM8-analytics-proposal.md), `docs/data-model-plan/proposals/` (bewust geen `server/`-code) |
| DM9 | Interfacereconciliatie met `GAME-RULES.md` | **Uitgevoerd** — [`prompts/DM9-game-rules-reconciliation.md`](prompts/DM9-game-rules-reconciliation.md); `toStandingPlayerView()` end-to-end getest tegen de echte `rankPlayers()` (GR2) |
| DM10 | Atomaire room-locator-claim (code + inviteHash) | **Uitgevoerd** — [`prompts/DM10-room-locator-claim.md`](prompts/DM10-room-locator-claim.md); reactie op `docs/integration-plan/HANDOFF.md` INT-1 + `HANDOFF-INTB.md` INTB-2, beantwoord in `HANDOFF.md` §6 |
| DM12 | `getScoreboardTop` expliciet op (roomId, matchId) keyen | **Uitgevoerd** — [`prompts/DM12-scoreboard-room-scoping.md`](prompts/DM12-scoreboard-room-scoping.md); reactie op `docs/integration-plan/HANDOFF-INTB.md` INTB-3, beantwoord in `HANDOFF.md` §6 |
| DM11 | Room-scoping op `Round`/`Answer` + action-cache-lookup | **Uitgevoerd** — [`prompts/DM11-room-scoped-round-answer.md`](prompts/DM11-room-scoped-round-answer.md); reactie op `docs/integration-plan/HANDOFF-INTB.md` INTB-1 (alleen signaturen verbreden, geen nieuwe velden op `Round`/`Answer`), beantwoord in `HANDOFF.md` §6; neemt ook `DECISIONS.md` #30-documentatie mee |
| DM13 | Idempotentie + "één antwoord per ronde" ín de atomaire schrijfactie | **Uitgevoerd** — [`prompts/DM13-answer-idempotency-in-atomic-write.md`](prompts/DM13-answer-idempotency-in-atomic-write.md); reactie op `docs/integration-plan/HANDOFF-INTB.md` INTB-4, beantwoord in `HANDOFF.md` §7a; INT-B's drie bewust-rode conformance-tests staan nu groen zonder dat hun testbody is aangeraakt |
| DM14 | `loadSessionByTokenHash` | **Uitgevoerd** — reactie op INT-3 (`HANDOFF.md` §10, formeel voorstel + product-akkoord + gebouwd); deblokkeerde INT-A stap 2 |
| DM15 | `saveAcceptedAnswerAtomically` geeft `{ replay: boolean }` terug | **Uitgevoerd** — reactie op INT-14 (`HANDOFF.md` §12); contract voor INT-B's Lua-script, geen ack in de replay-tak |
| DM16 | `rotateRoomLocators` | **Uitgevoerd** — reactie op INTB-5 🔴 (`HANDOFF.md` §9, formeel voorstel + product-akkoord + gebouwd); atomaire wissel, faalt veilig (oude locators blijven geldig bij conflict) |

**Poort bevroren sinds DM13, met een expliciet, gevolgd uitzonderingsproces
(`HANDOFF.md` §7b).** DM14–DM16 zijn precies via dat proces gegaan: voorstel
in `HANDOFF.md` → product-akkoord → (impliciet) integrator-akkoord → bouwen,
in de afgesproken volgorde (§10 → INT-14 → §9). Elke volgende wijziging aan
`repository.js`'s `DataStore`-contract doorloopt dezelfde stappen.

**DM0–DM16 zijn allemaal uitgevoerd — 492/492 tests groen**
(`node --test 'server/data/**/*.test.js'`). Checkpoint 4 is tijdens de
uitvoering opgelost door `docs/multiplayer/DECISIONS.md` #21. DM10–DM12 zijn
gebouwd na een eigen reviewronde die vóór uitvoering drie fundamentele
contractproblemen vond en corrigeerde (zie de "Herzien na een eigen
reviewronde"-secties in de betreffende promptbestanden). Tijdens de bouw
kwam via `docs/integration-plan/`'s conformance-suite INTB-4 aan het licht
(idempotentie in `saveAcceptedAnswerAtomically`) — als eigen fase DM13
gebouwd, gevalideerd tegen INT-B's eigen (bewust rode) tests, die nu groen
staan. Daarna DM14–DM16 (`loadSessionByTokenHash` voor INT-3,
`{ replay: boolean }` voor INT-14, `rotateRoomLocators` voor INTB-5 🔴), elk
via het voorstel-proces uit §7b: voorstel in `HANDOFF.md`, product-akkoord,
dan bouwen. **De poort blijft bevroren voor eenzijdige wijzigingen** —
zie `HANDOFF.md` §7b/§8 voor het volledige, actuele overzicht van wat er nog
aan DM gericht staat maar bewust niet gebouwd is. Resterende
externe wachtpunten: de (b)-ADR-items die de latere Redis/Postgres/token-
adapterlaag raken (checkpoints 2, 3, 5, 6, 7, 10) — nooit de types of de
domeinlogica hier. Zie [`DM-PROGRESS.md`](DM-PROGRESS.md) voor de volledige
status en `DECISIONS.md`-verwerking per sectie.

## 4. Testplan (ongewijzigd waar niet expliciet genoemd)

Gekoppeld aan [`DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md#testlagen).

- **Unit:** naamverwerking incl. XSS-achtige input als stringtransformatie-test —
  *niet* als bewijs dat `<script>` nooit rendert; die garantie hoort bij client-/
  E2E-tests (bevinding 6). Sleutel-/TTL-bouwstenen (DM1). Repository tegen de
  in-memory fake, met een expliciete disclaimer dat de fake domeinsemantiek bewijst,
  geen Redis-atomiciteit (DM6, bevinding 7). Answer-flow: idempotentie,
  `ALREADY_ANSWERED`, "complete write-set" — niet "geen half verwerkte score", dat is
  een opslagclaim (DM7, bevindingen 7–8).
- **Contract:** "snapshot bevat geen correct antwoord" via
  `toActiveRoundSnapshot()`, inclusief een test tegen onbekende/gelekte velden
  (bevinding 5). "Client/server delen contentVersion" blijft **open** totdat de
  reconciliatie in sectie 2 is afgerond — dit plan claimt niet langer dat het veld
  definitief op Room zit (bevinding 4; ook gesignaleerd in `docs/protocol-plan/`).
- **Niet hier, met reden:** puntenformule/validators/vraagselectie
  (`GAME-RULES.md`-plan), code-/inviteId-generatie-algoritme (`ARCHITECTURE.md`),
  sessierollen/state-machine-transities (architectuur/serverlaag), tokenhashing-
  implementatie (`auth`, ADR-plichtig).

## 5. Wat hier expliciet buiten valt

- Redis-clientlibrary, hash/JSON-serialisatie, Lua vs. MULTI/EXEC, het
  dual-write-mechanisme voor `Room.phase`/`Match.phase` — allemaal (b).
- Hash-algoritme achter `inviteHash` en `room_id_hash`.
- Database-engine, migratietool, indexen/constraints voorbij de gegeven kolomtypen,
  en het daadwerkelijk uitvoeren van een migratie.
- REST-/socketlaag (`PROTOCOL.md`), state-machine-overgangslogica
  (`ARCHITECTURE.md`/`GAME-FLOW.md`), scoring/validators/vraagselectie
  (`GAME-RULES.md`).
- Token-generatie/-hashing-implementatie, `TOKEN_PEPPER` en andere secrets.
- Laag 3 uit DATA-MODEL.md ("Lagen") — lokale clientsessie: clientrepo-terrein.
- Daadwerkelijke text-only-rendering van namen — clientcode-terrein; deze module
  garandeert alleen een inerte, ongeëscapete string.
- Proxy-/applicatielogeisen uit "Privacyduiding" — infra-/serverconfiguratie, dicht
  tegen `infra/prod/**`.
- Periodieke cleanup van achtergebleven indexes; exacte idempotency-TTL voor de
  action-cache-sleutel — beide genoemd, niet gewaardeerd in `DATA-MODEL.md`.
- Alles onder `infra/prod/**` en `.github/workflows/deploy.yml`.
- Analytics-eventcontract en -aggregatiesemantiek als bindende implementatie (pas na
  apart voorstel, bevinding 9).
- Verdere uitwerking van `RoomPresentation`/groepsvlag voorbij het kale voorstel.

## 6. Checkpoints die ik niet zelfstandig neem

> **Besluitupdate 2 augustus 2026:** checkpoints 2–5, 7–8, 10–12 zijn inhoudelijk
> of qua uitvoeringsbevoegdheid beantwoord in
> [`../multiplayer/DECISIONS.md`](../multiplayer/DECISIONS.md). Checkpoint 6 blijft
> deels open: JSON-opslag is bevestigd, maar de autoriteit tussen `Room.phase` en
> `Match.phase` nog niet. Technische prerequisites blijven gelden.

1. **Locatie `server/data/`.** `architecture`, `always_ask`. Precedent (`server/rules/`,
   `server/architecture/`) is sterk maar geen vervanging voor bevestiging.
2. **Redis-clientlibrary.** `deps` + `database_schema`.
3. **Hash- vs. JSON-serialisatie voor Room/Match/Round.** `database_schema`.
4. **`contentVersion`/`rendererVersion`-locatie en -semantiek. — OPGELOST**
   (`DECISIONS.md` #21, 2 augustus 2026): canoniek en onveranderlijk op
   `Match`; roundpayloads dragen ze mee. Verwerkt in `types/match.js` en
   `toActiveRoundSnapshot(round, match)`. Blokkeert DM2/DM3/DM6 niet meer.
5. **Lua-script vs. MULTI/EXEC** voor answer-flow. `database_schema` + `architecture`.
6. **Atomair dual-write-mechanisme** voor `Room.phase`/`Match.phase`. `database_schema`.
7. **Hash-mechanisme voor `inviteHash`/`room_id_hash`.** `database_schema`/`auth`.
8. **Postgres-migratietool, database-engine (Postgres vs. SQLite-pilot), indexen/
   constraints voorbij het gegevene.** `deps` + `database_schema`.
9. **Uitvoeren van een Postgres-migratie tegen een echte database.** `prod`.
10. **Token-hashing/generatie-implementatie en peppersbeheer.** `auth` + `prod`.
11. **Profanitylijst-bron voor naamverwerking.** Geen ADR, wel blokkerend vóór DM4.
12. **Elke wijziging aan `package.json` of nieuwe dependency.** `deps`.
13. **`infra/prod/**` en `.github/workflows/deploy.yml`.** Verboden pad, hard stop.

## 7. DM0/DM1 — wat al verifieerbaar is aangepast

- **Actiecache-sleutel hersteld.** `DATA-MODEL.md` definieert
  `room:{roomId}:action-cache` (room-scoped). De vorige versie van dit plan schreef
  abusievelijk `room:{roomId}:match:{matchId}:action-cache` (bevinding 1) — dat was
  geen transcriptie maar een andere keyspace/retentiesemantiek. Gecorrigeerd in
  `prompts/DM1-keys-and-ttl.md`.
- **`node --test <lege map>` is empirisch geverifieerd fout** op de lokaal aanwezige
  Node.js v24.16.0: het probeert de map als module te laden en faalt met
  `MODULE_NOT_FOUND` (exitcode 1, niet 0) — zelf getest, niet aangenomen. DM0 gebruikt
  daarom alleen een `.gitkeep`-scaffold; de eerste echte testrun gebeurt in DM1.

## 8. Coördinatie met GAME-RULES.md

`GAME-RULES.md`'s plan consumeert `DATA-MODEL.md`'s vormen, bepaalt ze niet. Twee
concrete koppelpunten:

- **DM7 (van mij) roept `scoreAnswer()` aan, niet `computeScore()`.** De huidige
  implementatie in `server/rules/scoring.js` maakt `scoreAnswer()` de aanbevolen
  ingang (combineert acceptatie + score); `computeScore()`/`isAnswerAcceptable()`
  blijven alleen voor gerichte unit tests geëxporteerd. DM7 mag pas landen nadat die
  functie bestaat, of werkt tot dan tegen een expliciete testfake.
- **DM9 is een reconciliatiemoment, geen eenzijdige levering.** In plaats van vooraf
  één brede `toScoringPlayerView()` te definiëren, ontwerp ik kleine
  use-case-projecties samen met de daadwerkelijke consumer-code, zodra die bestaat.
  Let op sequencing: `GAME-RULES.md`'s eigen teams-fase (GR6 daar) komt vóór hun
  interfacefase (GR7 daar) — `teamId` kan dus al nodig zijn bij de eerste
  reconciliatie, niet pas later (bevinding 11).
- **Locatie/importrichting** (`server/rules/` importeert uit `server/data/types/`,
  of een gedeelde derde locatie) blijft een open architectuurvraag — checkpoint 1.

## 9. Bevinding → wijziging (REVIEW.md, 2026-08-02)

| # | Bevinding (kort) | Wijziging in dit plan |
| --- | --- | --- |
| 1 (blocker) | Action-cache-sleutel match-scoped i.p.v. room-scoped | Hersteld, zie §7 en `prompts/DM1-keys-and-ttl.md` |
| 2 (blocker) | Voorbeelden behandeld als volledig schema/enumlijst | (a)/(b)/(c)-onderscheid aangescherpt (§1); DM2/DM3 leveren traceability-tabellen, geen enum-afdwingende validators totdat bevestigd |
| 3 | TTL-refreshset niet volledig vastgelegd | DM1 levert alleen key-builders + constante; refreshmatrix is (c), apart voorstel |
| 4 | contentVersion/rendererVersion cross-doc inconsistent | Nieuw checkpoint 4, blokkeert DM2/DM6; niet langer stilzwijgend op Room vastgelegd |
| 5 | `toPublicRound()` te breed, geen fasecontext | Hernoemd `toActiveRoundSnapshot()`, allowlist-outputcontract, test op onbekende velden |
| 6 | Naamverwerking heeft meer open keuzes dan profanitylijst | DM4 gesplitst: vaste stappen vs. beslismatrix; `<script>`-bewijs verplaatst naar client/E2E |
| 7 | Repositorypoort legt Redis/MULTI al vast | Poort wordt domeinoperaties, geen Redis-primitieven; fake bewijst alleen domeinsemantiek |
| 8 | Pure write-set bewijst geen opslagatomiciteit | Herbenoemd "complete write-set"; entry point `scoreAnswer()` i.p.v. `computeScore()` |
| 9 | Analyticskolommen ≠ event-/aggregatiecontract | DM8 beperkt tot traceability + privacymatrix; `schema.sql` voorstel verplaatst naar onder `docs/` |
| 10 | Denylist onvoldoende privacygarantie | `privacy-guard.js` wordt allowlist per doeltabel |
| 11 | DM9 legt subset vast vóór reconciliatie | DM9 wordt reconciliatiemoment met kleine use-case-projecties; teamId-sequencing benoemd |
| 12 | Losse typebestanden isoleren serialisatie niet werkelijk | Granulariteit expliciet bij gezamenlijke serverlayout te bepalen, niet hier vooruitgelopen |
| 13 | Keybuilders missen invoervalidatie/injectiebeleid | Toegevoegd aan DM1-scope; `answers:{id}`-interpretatie expliciet gedocumenteerd |
| 14 | DM0 herhaalt onjuist `node --test <dir>`-patroon | Empirisch geverifieerd fout; DM0 wordt `.gitkeep`-only, zie §7 |
| 15 | Oude globale regellimiet | Vervallen door de repo-eigen autonomy-override; inhoud hoeft niet om die reden te worden opgesplitst |
| 16 | "Commits" en "fasen" door elkaar gebruikt | Taal aangepast naar acties/subfasen (bijv. DM3a/DM3b/DM3c) in `prompts/`, geen commit-voorschrift |

## 10. Versnellingsplan

Na 24u stond er pas DM0–DM1. Bij het opstellen van [`DM-PROGRESS.md`](DM-PROGRESS.md)
bleek het gat tussen "af" en "nog te doen" grotendeels zelfopgelegd: elke fase
kreeg de vraag "wacht dit op iets extern?" nooit expliciet gesteld, dus werd
volgorde (eerst DM2, dán pas DM3, enzovoort) verward met afhankelijkheid. Bij
naloop bleken twee dingen:

1. `GameConfiguration`, `Session`, en het grootste deel van `Room` (min twee
   velden) hebben nooit op checkpoint 4 hoeven wachten — alleen
   `contentVersion`/`rendererVersion` doen dat.
2. `GAME-RULES.md`'s `scoreAnswer()` en validators — waar DM7 op leunt — bestaan
   al en zijn getest; die wachttijd was al voorbij vóórdat de status hierboven
   was bijgewerkt.

**Uitvoeringsvolgorde, als één doorlopende reeks kleine acties (elk binnen de
15-bestanden/5.000-regel-grens), zonder tussentijds te stoppen om door te mogen
gaan:**

```text
DM2a (GameConfiguration, Session)
→ DM2b (Room min contentVersion/rendererVersion)
→ DM3   (Player, Match, Round, Answer, RoomPresentation, toActiveRoundSnapshot)
→ DM4   (naamverwerking)
→ DM5   (privacy-guard)
→ DM6   (repository-domeinpoort + fake)
→ DM7   (answer-flow, tegen GAME-RULES' scoreAnswer/validators)
→ DM8   (analytics-traceability + eventcontractvoorstel)
→ DM9   (reconciliatie tegen GR3 nu; DM9-herziening zodra GR7 bestaat)
```

**Waar ik wél stop, expliciet:**
- checkpoint 1 is al akkoord (locatie bevestigd bij DM0) — geen nieuwe stop nodig
  zolang alles binnen `server/data/` blijft;
- de twee `Room`-velden achter checkpoint 4 — die bouw ik niet, ik markeer ze
  als pending in de type en in een aparte test;
- elk (b)-ADR-item (checkpoints 2, 3, 5–10) — dat blijft alleen de
  adapter-/uitvoeringslaag raken, niet de types/domeinlogica die hierboven
  gepland staan, dus dat stopt de reeks niet;
- als tijdens het bouwen een écht nieuwe open vraag opduikt (zoals bij DM2/DM3
  al gebeurde) — dan wordt dat een `HANDOFF.md`-toevoeging, geen reden om de
  hele reeks te pauzeren, tenzij het de fase die dan loopt zelf onmogelijk
  maakt.

**Uitgevoerd zoals gepland, met één aanpassing.** De reeks liep door van DM2a
t/m DM9 zonder tussentijdse stops. De "twee `Room`-velden achter checkpoint 4"
werden inderdaad niet gebouwd in DM2b/DM3 — maar halverwege DM6 kwam
`DECISIONS.md` binnen en loste checkpoint 4 op vóór commit, dus die twee velden
zijn alsnog toegevoegd (aan `Match`, niet Room) in dezelfde reeks, in plaats
van als losse latere fase. Zie `DM-PROGRESS.md` voor het resultaat: 456/456
tests groen.
