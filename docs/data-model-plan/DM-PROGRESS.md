# Voortgang — DATA-MODEL.md realisatie

Dekking van [`docs/multiplayer/DATA-MODEL.md`](../multiplayer/DATA-MODEL.md), per
sectie uit dát document — niet per DM-fase. Zie [`README.md`](README.md) voor het
volledige plan/de fasering en [`HANDOFF.md`](HANDOFF.md) voor cross-plan vragen.

Legenda: ✅ klaar en geverifieerd — 🟡 deels — **n.v.t./buiten scope** met reden
uit het brondocument zelf.

| DATA-MODEL.md sectie | DM-fase | Status | Toelichting |
| --- | --- | --- | --- |
| Lagen (overzicht) | — | **n.v.t. als eigen module** | Laag 3 (lokale clientsessie) is bewust buiten scope — clientrepo-terrein |
| Room | DM2b | ✅ Klaar en geverifieerd | `types/room.js`, 24 tests. Hernoemd van `RoomCore` na `DECISIONS.md` #21 — checkpoint 4 is definitief opgelost, dit is het volwaardige type |
| GameConfiguration | DM2a | ✅ Klaar en geverifieerd | `types/game-configuration.js`, 27 tests |
| Session | DM2a | ✅ Klaar en geverifieerd | `types/session.js`, 17 tests. `tokenHash` is vormcontrole; de hashing-implementatie zelf blijft `auth` (checkpoint 10/`DECISIONS.md` #26), raakt de typevorm niet |
| Player | DM3 | ✅ Klaar en geverifieerd | `types/player.js`, 31 tests + `toStandingPlayerView()` (DM9, 3 tests) |
| Match | DM3 | ✅ Klaar en geverifieerd | `types/match.js`, 32 tests. Bevat nu `contentVersion`/`rendererVersion` (`DECISIONS.md` #21) |
| Round | DM3 | ✅ Klaar en geverifieerd | `types/round.js`, 36 tests. `correctAnswer`-vorm bevestigd door zowel `HANDOFF.md` §1 als `DECISIONS.md` #15; `validOptionIds`/`resultDetails` toegevoegd na reconciliatie met de herziene `GR4-question-selection.md` |
| Answer | DM3 | ✅ Klaar en geverifieerd | `types/answer.js`, 17 tests |
| RoomPresentation (optioneel) | DM3 | ✅ Klaar en geverifieerd | `types/room-presentation.js`, 9 tests |
| Redis-sleutels | DM1 | ✅ Klaar en geverifieerd | `redis-keys.js`, 65 tests |
| TTL | DM1 | 🟡 Deels | Alleen `ROOM_TTL_SECONDS` (1 test); refreshmatrix/cleanup-cadans bewust apart voorstel, geen datum |
| Actieve-ronde-projectie (`toActiveRoundSnapshot`) | DM3 | ✅ Klaar en geverifieerd | Neemt sinds `DECISIONS.md` #21 ook `match` aan (voor `contentVersion`/`rendererVersion` in de output) en controleert `round.status === 'ACTIVE'` |
| Repository/domeinpoort | DM6, uitgebreid door DM10/DM11/DM12 | ✅ Klaar en geverifieerd | `repository.js` + `in-memory-store.js`, 23 → 43 tests in `repository.test.js`. `loadRoomByInviteHash` (hernoemd van `loadRoomByInviteId`, werkt op de hash) + `claimRoomLocatorsAtomically`/`releaseRoomLocators`/`refreshRoomLocators` (DM10); `saveRound`/`loadAnswer`/`loadActionCacheEntry` room-gescoped, geneste Maps i.p.v. samengestelde string-sleutels (DM11); scoreboard op (roomId, matchId) (DM12). Atomaire operaties bewijzen alleen single-threaded domeinsemantiek, geen Redis-concurrency |
| Atomische antwoordverwerking | DM7 | ✅ Klaar en geverifieerd | `answer-flow.js`, 28 tests. Idempotentie eerst, geen scorelek in de ack, `valid: false` → `INVALID_ANSWER_FORMAT` |
| Persistente analytics | DM8 | ✅ Voorstel klaar (bewust geen code) | `docs/data-model-plan/proposals/analytics-event-contract.md` + `schema.sql`. `id`/`room_id_hash`/`max_player_count` expliciet geblokkeerd, geen oneerlijke default |
| Wat niet persistent wordt opgeslagen | DM5 | ✅ Klaar en geverifieerd | `privacy-guard.js`, 109 tests. Allowlist per doeltabel, geen denylist |
| Privacyduiding | DM5 (deels) | Zie hierboven | Proxy-/applicatielogeisen blijven buiten scope (infra, `prod`) |
| Naamverwerking | DM4 | ✅ Klaar en geverifieerd | `name-processing.js`, 34 tests. Woordenlijsten injecteerbaar, geen hardgecodeerde productcontent in de module zelf |
| Interface naar GAME-RULES.md | DM9 | ✅ Klaar en geverifieerd | `toStandingPlayerView()` in `types/player.js`, end-to-end getest tegen de echte `rankPlayers()` (GR2). `toEligibilityPlayerView`/`toTeamPlayerView` wachten op GR5/GR6 |

## `docs/multiplayer/DECISIONS.md` (2 augustus 2026, producteigenaar)

Bindende besluiten die tijdens de uitvoering van DM6/DM7 binnenkwamen en direct
zijn verwerkt vóór commit:

- **#21 — checkpoint 4 opgelost.** `contentVersion`/`rendererVersion` zijn
  canoniek op `Match`, niet Room. `types/match.js` uitgebreid;
  `toActiveRoundSnapshot()` neemt nu ook `match` aan; `types/room-core.js` →
  `types/room.js` (`RoomCore` → `Room`, geen tussenvorm meer nodig).
- **#15/#16** bevestigen letterlijk wat DM3/`HANDOFF.md` al hadden
  (`correctAnswer`-vormen, 1-based `roundNumber` = `roundIndex + 1`,
  `countdownEndsAt` vluchtig) — geen codewijziging nodig, nu formeel bevestigd
  i.p.v. interpretatie.
- **#22–#26** (JSON-opslag eerst, Redis Lua, officiële `redis`-package,
  PostgreSQL, tokenhashing-algoritme) raken de latere adapterlaag (checkpoints
  2/3/5/7/10), niet de types/domeinlogica hier — geen actie in deze ronde.
- **#5** (game-flow) beantwoordt de ene sub-vraag die `HANDOFF.md` §3 nog open
  liet: een speler met `left: true` telt niet automatisch mee in een rematch.
  Geen codewijziging nodig (rematch-logica is nog niet gebouwd).

## Openstaande actiepunten

- [x] [`DM2a`](prompts/DM2a-game-configuration-and-session.md) — uitgevoerd
- [x] [`DM2b`](prompts/DM2b-room.md) — uitgevoerd, nadien hernoemd naar `Room`
- [x] [`DM3`](prompts/DM3-player-match-round-answer-presentation.md) — uitgevoerd, bijgewerkt na `DECISIONS.md` #21
- [x] [`DM4`](prompts/DM4-name-processing.md) — uitgevoerd
- [x] [`DM5`](prompts/DM5-privacy-guard.md) — uitgevoerd
- [x] [`DM6`](prompts/DM6-repository-port.md) — uitgevoerd
- [x] [`DM7`](prompts/DM7-answer-flow.md) — uitgevoerd
- [x] [`DM8`](prompts/DM8-analytics-proposal.md) — uitgevoerd (voorstel, geen code)
- [x] [`DM9`](prompts/DM9-game-rules-reconciliation.md) — uitgevoerd
- [x] [`DM10`](prompts/DM10-room-locator-claim.md) — uitgevoerd, reactie op INT-1/INTB-2
- [x] [`DM12`](prompts/DM12-scoreboard-room-scoping.md) — uitgevoerd (vóór DM11), reactie op INTB-3
- [x] [`DM11`](prompts/DM11-room-scoped-round-answer.md) — uitgevoerd (na DM12), reactie op INTB-1
- [x] Checkpoint 4 besloten en verwerkt (`DECISIONS.md` #21)

Resterende, echt externe wachtpunten: de (b)-ADR-items die de adapterlaag raken
(Redis-client, hash-/serialisatiemechanisme, migratie-uitvoering, token-pepper) —
`DECISIONS.md` #22–26 heeft de meeste daarvan al principieel beslist, maar de
daadwerkelijke connectiecode is een aparte, latere fase (`deps`/`prod`).

- [x] [`DM13`](prompts/DM13-answer-idempotency-in-atomic-write.md) — uitgevoerd, reactie op INTB-4

**Poort bevroren vanaf DM13.** Elke volgende wijziging aan `repository.js`'s
`DataStore`-contract gaat eerst als HANDOFF-voorstel naar INT-A én INT-B, met
hun akkoord, vóór implementatie.

**Audit uitgevoerd (`HANDOFF.md` §8):** de volledige DM-inventaris uit beide
integratie-HANDOFFs geverifieerd tegen de daadwerkelijke code, niet tegen
statustabellen. Belangrijkste vondst: **INTB-5 (🔴 security, geroteerde
uitnodiging blijft geldig) staat bij INT-B ten onrechte als "opgelost" —
zelf gereproduceerd, nog echt open.** Ook: INT-6/INTB-7 (invite-hash) is
inhoudelijk al opgelost, maar beide statustabellen zijn stale. Drie
voorstellen geschreven, geen enkele geïmplementeerd (poort-bevroren):

- [x] [`DM14`](HANDOFF.md#10-gebouwd-was-formeel-voorstel-akkoord-product-owner--int-3-loadsessionbytokenhash) — `loadSessionByTokenHash` voor INT-3. Gebouwd, deblokkeerde INT-A stap 2.
- [x] DM15 — `saveAcceptedAnswerAtomically` geeft `{ replay: boolean }` terug, reactie op INT-14 (`HANDOFF.md` §12). Gebouwd; contract voor INT-B's Lua-script.
- [x] [`DM16`](HANDOFF.md#9-gebouwd-was-formeel-voorstel-akkoord-product-owner--intb-5-rotateroomlocators) — `rotateRoomLocators` voor INTB-5 🔴. Gebouwd, in de afgesproken volgorde als laatste — zelf gereproduceerd dat het letterlijke INTB-5-scenario nu klopt (`repository.test.js` #57-58).
- [x] `HANDOFF.md` §11 — eenregelig voorstel aan spec-redactie voor INT-9
  (`deadlineGraceMs`-documentatie, geen poortwijziging). **Akkoord en
  ingediend** — geen INT-A/INT-B-akkoord nodig, geen poortwijziging.

**Bouwvolgorde uitgevoerd zoals afgesproken: §10 → INT-14 → §9.** Alle drie
gebouwd in één ronde, 15 nieuwe tests (#44-58), 494/494 groen (incl. INT-B's
eigen `sessionTokenLookupKey`-tests, compatibel gelandeerd).

**Nieuw, nog niet geïmplementeerd — `HANDOFF.md` §13, capability-principe.**
INT-B vond (en ik heb bevestigd) dat DM16 het achterliggende gat niet volledig
dichtte: `claimRoomLocatorsAtomically` zelf laat oude locators van dezelfde
room niet los bij een herclaim (INTB-5 heropend), en `saveRoom` omzeilt de
hele claim-machinerie nog steeds voor de code-index (INTB-9, nieuw, hoog).
Drie voorstellen geschreven, geen enkele geïmplementeerd — wacht op
gezamenlijk technisch akkoord:

- [x] `DM17` (`HANDOFF.md` §14) — reactie op INT-B's
  `BESLUIT-INTB-locators-en-sessieindex.md`. **Deel A (INTB-9):** `saveRoom`
  raakt de lookup-indexen niet meer aan; claim/rotate/release blijven de drie
  schrijvers (eigen eerdere aanbeveling om `rotateRoomLocators` te laten
  vervallen introk — INT-B's driedelige levenscyclus-framing overtuigt meer).
  **Deel B (INTB-10-rotatie):** `saveSession` geeft de vorige `tokenHash`-
  index-entry vrij bij een wijziging, in dezelfde stap; TTL blijft
  contract-only, geen touch-on-read. Gebouwd en akkoord in `HANDOFF.md` §14,
  inclusief een capability-audit (besluit #37) over alle drie de
  capabilities (room-locators, sessietoken, action-cache).

**Nieuw standaardcriterium, nu formeel toegepast (besluit #37):** élke
capability heeft één atomair schrijfpad en één atomair intrekpad — een lookup
die een ingetrokken capability nog vindt is een bug. Zie `HANDOFF.md` §14
voor de volledige toets-tabel.

INTB-8 ligt al bij de DT-agent, geen actie hier. INTB-6 (tiebreak) blijft
terecht open, wacht op GR. Verwacht nog een klein, regulier HANDOFF-item van
INT-A (versieprefix op `inviteHash`, volgt de tokens-versioneringslijn uit
besluit 26) — geen speciale voorrang zodra het binnenkomt.

## Cijfers

- **DM0–DM17: alle achttien fases uitgevoerd.** `node --test
  'server/data/**/*.test.js'` → **499/499 tests groen** (95 suites).
- Twee reviewrondes volledig verwerkt: [`REVIEW.md`](REVIEW.md) (2 blockers, 10
  hoge bevindingen, vóór DM0/DM1) en
  [`prompts/REVIEW-DM2-DM9.md`](prompts/REVIEW-DM2-DM9.md) (3 blockers, 8 hoge,
  3 middelhoge, vóór uitvoering van DM2–DM9). Een derde reviewronde (eigen,
  vóór uitvoering) op DM10–DM12 vond drie fundamentele contractproblemen —
  zie de "Herzien na een eigen reviewronde"-secties in die promptbestanden.
  DM13's contractvorm is geverifieerd tegen INT-B's eigen, onafhankelijk
  geschreven conformance-tests (77/80 → 80/80 groen, zonder hun testbody aan
  te raken).
- Eén productbesluitronde ([`docs/multiplayer/DECISIONS.md`](../multiplayer/DECISIONS.md),
  2 augustus 2026) tijdens uitvoering verwerkt — zie boven.
- [`HANDOFF.md`](HANDOFF.md) heeft zes beantwoorde/voorgestelde secties richting
  `game-rules-plan`, `protocol-plan`, `architecture-plan` en `integration-plan`
  (§6, nieuw: INT-1/INTB-1/INTB-2/INTB-3), waaronder het nog openstaande
  voorstel voor een neutrale `PHASES`/`PACING`-module (§5).
- Analytics (DM8) blijft bewust een voorstel onder
  [`proposals/`](proposals/), geen `server/`-code.

*Laatst bijgewerkt: na uitvoering van DM10–DM12 (reactie op
`docs/integration-plan/`'s HANDOFF-bevindingen INT-1/INTB-1/INTB-2/INTB-3).*
