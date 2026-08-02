# Voortgang — ARCHITECTURE.md realisatie

Bijgewerkt: 2026-08-02 (stand geverifieerd tegen de daadwerkelijke inhoud van
`server/architecture/` en een live `node --test`-run, naar aanleiding van
`docs/STATUS-AUDIT-2026-08-02.md` §2.5). Zie [`README.md`](README.md) voor het
volledige plan, [`prompts/`](prompts/) voor de uitvoerbare prompt per fase, en
[`../../server/architecture/README.md`](../../server/architecture/README.md)
voor de modulelijst zoals die nu op schijf staat. Dit bestand is de checklist —
bijwerken bij elke fase-afronding, niet alleen aan het eind.

Legenda: ✅ Klaar (gebouwd en getest) — 🟡 Deels — ⬜ Nog niet gestart —
⏸️ Geblokkeerd/later — ⚪ Andere eigenaar/buiten scope voor architecture-plan.

## Per sectie in ARCHITECTURE.md

| § | Status | Fase / toelichting |
| --- | --- | --- |
| Overzicht | ⚪ Geen code | diagram; wordt waar gemaakt door AR5 + `prod` |
| Fysieke omgeving | ⚪ Buiten scope | Mac Studio, NAS, tunnel — `DEPLOYMENT-AND-TESTING.md` |
| Rooms zijn geen containers | ⚪ Geen code | ontwerpprincipe; bewaakt door AR5, niet zelf te bouwen |
| Componenten | ⬜ Nog niet gestart | de componenttabel krijgt pas invulling in AR5/AR6 |
| Principe 1 — server-authoritative | 🟡 Deels | AR1 bewaakt het voor faseovergangen; vraagselectie/scoring liggen bij `GAME-RULES.md` |
| Principe 2 — één timeline per room | 🟡 Deels | AR4 (`server-time.js`, offset-midpoint) is **klaar en getest — 193/193**; het serverdeel dat absolute tijden plant en `/api/v1/time` bedient, wacht op AR5/AR6 |
| Principe 3 — snapshot boven event replay | 🟡 Deels | AR3 (`snapshot-precedence.js`, `shouldApplySnapshot`/`shouldApplyEvent`) is **klaar en getest — 84/84**; toepassing in een echte reconnect-/sockethandler wacht op AR5/AR6 |
| Principe 4 — tijdelijke sessies | ⚪ Andere eigenaar | `DATA-MODEL.md` (Session) + `PROTOCOL.md` (tokens); ADR-plichtig `auth` |
| Principe 5 — QR/deel-link als joincapability | 🟡 Deels | `inviteId`-generatie zit in AR2 (klaar); de joinflow zelf is `GAME-FLOW.md` |
| Principe 6 — gedeelde contentmodule | ⚪ Andere eigenaar | `GAME-RULES.md` pint `contentVersion`; ik consumeer alleen |
| Principe 7 — deterministische generated content | ⚪ Andere eigenaar | `GAME-RULES.md` (seed + rendererVersion) |
| Principe 8 — assets agressief cachen | ⚪ Buiten scope | frontend + `prod` |
| Principe 9 — async analytics | ⚪ Andere eigenaar | `DATA-MODEL.md` (aggregaten, PostgreSQL) |
| Principe 10 — herstelbaarheid | 🟡 Deels | AR1 ondersteunt het herstelpad (`HOST_RESUME` naar nieuwe `COUNTDOWN`); Redis-AOF en room-index zijn `prod` resp. AR? |
| Containers | ⚪ Buiten scope | `DEPLOYMENT-AND-TESTING.md` |
| Routing | ⬜ Nog niet gestart | AR5/AR6 |
| Socketstrategie | ⬜ Nog niet gestart | AR6, na dependency-akkoord (Socket.IO) |
| **State machine** | ✅ **Klaar** | **AR1 — 127 fixtures, 132 tests groen** |
| Join-code en inviteId | ✅ Klaar | AR2 (`room-codes.js`) — **17/17 tests groen**: generator, `inviteId` (≥96 bits), invite-hashindex |
| Redisstructuur en schaal | ⬜ Nog niet gestart | `redis-keyspace` staat wél in de moduletabel maar **heeft nooit een AR-nummer gekregen** |
| Schaalpad (fase 0–3) | ⏸️ Later | AR7 — expliciet na een werkende Fase 0/1 |
| Niet-functionele uitgangspunten | ⚪ Geen code | loadtestdoelen; `DEPLOYMENT-AND-TESTING.md` bewijst ze |

## Per fase uit het plan

| Fase | Status | Toelichting |
| --- | --- | --- |
| AR0 — scope-check | ✅ Klaar | map `server/architecture/` bevestigd; sluit aan op bestaande `server/rules/` |
| AR1 — state machine | ✅ Klaar | 4 bouwrondes, 9 agents, 3 defecten gevonden en gefixt; 132/132 tests groen |
| AR2 — room-codes | ✅ Klaar | zescijferige code + `inviteId` (≥96 bits, `node:crypto`); 17/17 tests groen. **Geen apart promptbestand geschreven** — afwijking van de AR0/AR1-werkwijze, zie actiepunten hieronder |
| AR3 — snapshot-precedence | ✅ Klaar | pure beslisregel snapshot vs. events; 84/84 tests groen. **Geen apart promptbestand geschreven** |
| AR4 — server-time | ✅ Klaar | midpoint-offset uit round-trip-samples; 193/193 tests groen. **Geen apart promptbestand geschreven** |
| AR5 — server-skeleton (voorstel) | ⬜ Niet begonnen | review-baar voorstel, geen draaiende code; kan nu inhoudelijk beginnen (AR2–AR4 zijn niet langer een blokkade), maar blijft `architecture`/always_ask |
| AR6 — proces-skeleton | ⏸️ Geblokkeerd | vereist akkoord op AR5 **en** op dependencies (`deps`, always_ask) |
| AR7 — schaalpad | ⏸️ Later | geen launch-prioriteit |

## Openstaande actiepunten

- [ ] **`redis-keyspace` een AR-nummer geven.** Staat in de moduletabel van
      `README.md` maar ontbreekt volledig in de fasering — hetzelfde type gat als
      `session-store` bij `GAME-FLOW.md`. Raakt bovendien `DATA-MODEL.md`, dus het
      wordt een voorstel, geen bindende keuze.
- [ ] **Prompts alsnog schrijven voor AR2, AR3 en AR4.** De code + testsuites
      zijn inmiddels gebouwd en volledig groen (`room-codes.js` 17/17,
      `snapshot-precedence.js` 84/84, `server-time.js` 193/193), maar — anders
      dan bij AR0/AR1 — is daar geen apart promptbestand in `prompts/` voor
      geschreven. Procesafwijking, geen inhoudelijke blokkade; met terugwerkende
      kracht documenteren zodat `prompts/` het echte bouwproces blijft
      weerspiegelen.
- [ ] AR5 (server-skeleton-voorstel) opstellen. AR2–AR4 zijn nu klaar, dus het
      voorstel kan concrete modules aanwijzen in plaats van lege dozen.
- [x] AR0 + AR1 uitvoeren en committen (branch `architecture/state-machine`).
- [x] Autonomy-limiet verruimd via `autonomy_overrides` in `.devkit.yaml`; de
      oude globale grens maakte één module + testsuite onnodig versnipperd.

## Besluiten die bij anderen liggen

Volledige toelichting in [`README.md`](README.md#openstaande-besluiten).

- [ ] **Host-tempo** — AR1 vereist nu `HOST_NEXT` ná zowel `ROUND_RESULT` als
      `SCOREBOARD` (twee bevestigingen per ronde). `GAME-RULES.md` laat ook één tik
      per ronde toe. Besluit bij de `GAME-RULES.md`-eigenaar; omschakelen kost één
      tabelregel plus fixtures.
- [ ] **`INVALID_PAUSE_STATE`** — staat niet in de foutcodelijst van `PROTOCOL.md`.
      Apart gezet in `INTERNAL_ERROR_CODES` zodat de adapter hem niet ongefilterd
      doorstuurt. Verzoek bij de `PROTOCOL.md`-eigenaar.
- [x] **Verplichte `reason`** — `PROTOCOL.md` maakt hem optioneel. Opgelost als
      aanroepercontract: de protocol-adapter vult hem in, de reducer verzint geen
      protocol-defaults.

## Audit-bevindingen verwerkt (2026-08-02)

`docs/STATUS-AUDIT-2026-08-02.md` §2.1 meldde twee rode tests in `room-codes`
op het moment van die doorlichting. Bij verificatie voor dit voortgangsbestand
(latere `node --test`-run, dezelfde dag) staan beide **groen**:

- **"isTaken wordt gerespecteerd"** — de test gebruikt nu afwijzingsaantallen
  `[1, 2, 3, 5]`, ruim onder `DEFAULT_MAX_CODE_ATTEMPTS = 10` in
  `room-codes.js`. Een aparte test dekt het uitputtingspad (`isTaken` altijd
  `true`) apart af.
- **"hashInviteId is deterministisch"** — de test gebruikt nu `inviteId`-
  invoer van 16 en 22 tekens, wat voldoet aan `INVITE_ID_MIN_LENGTH = 16` in
  `room-codes.js` (het 96-bits-contract uit `ARCHITECTURE.md`).

Dit is precies de door de audit voorgestelde oplossingsrichting (testinvoer
aanpassen aan het bestaande modulecontract, niet het budget/de ondergrens
aanpassen aan de test). Er is voor dit voortgangsbestand geen module- of
testcode gewijzigd — de stand was al zo bij verificatie.

## Bekende beperking

Een property-getter die zelf werpt propageert naar buiten `transition()`. Op platte
data werpt de reducer nooit. Omdat de aanroeper schema-gevalideerde payloads levert
is dat pad geen onderdeel van het contract; een try/catch eromheen zou echte fouten
verbergen. Staat als zodanig in de modulekop.

## Cijfers

- **AR0–AR4:** gebouwd en geverifieerd, **426/426 tests groen** in
  `server/architecture/` (`node --test server/architecture/*.test.js`):
  state-machine 132, room-codes 17, snapshot-precedence 84, server-time 193.
- **AR1 — mutatiescore vóór ronde 4:** 18/28 mutanten gedood. De overlevers zaten
  allemaal aan de invoervalidatie-grens; 39 fixtures toegevoegd, de twee bekende
  overlevers (volgorde-lemma en fase met trailing spatie) worden nu gedood.
- **AR1 — 3 defecten gevonden ná een groene suite** (TOCTOU in resume én pause,
  ongevalideerde `now`, ongevalideerde `pacing`) — alle drie zelf gereproduceerd
  vóór de fix en daarna opnieuw geverifieerd.
- **Prompts:** 6 van de 8 fases missen nog een apart promptbestand in
  `prompts/` (AR2 t/m AR7). Voor AR5–AR7 valt dat samen met "geen code". Voor
  **AR2, AR3 en AR4 niet meer**: die drie zijn gebouwd en volledig getest zonder
  dat er een prompt voor is geschreven — zie openstaande actiepunten hierboven.
  `redis-keyspace` heeft nog steeds geen fasenummer.
