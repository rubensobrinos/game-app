# Voortgang — DEPLOYMENT-AND-TESTING.md realisatie

Bijgewerkt: 2026-08-02, na [`DT-R1/R2/R4`](prompts/DT-RESUME-AFTER-DECISIONS.md)
(zie [`prompts/DT-R5-progress-bijwerken.md`](prompts/DT-R5-progress-bijwerken.md)
voor deze consolidatieslag). Zie [`README.md`](README.md) voor het volledige plan
en [`prompts/`](prompts/) voor de uitvoerbare prompt per fase. Dit bestand is de
checklist — bijwerken bij elke fase-afronding, niet alleen aan het eind.

**Correctie na review:** een eerdere samenvatting noemde vijf documentatiestukken
"uitvoerbare delen gebouwd en geverifieerd". Dat overschatte wat er is: het zijn
voorbereidingsdocumenten (matrix/pseudocode/runbook/voorstel), geen uitgevoerde
tests. Dit bestand gebruikt daarom vier expliciete bewijsniveaus in plaats van één
generiek "klaar":

| Niveau | Betekenis |
| --- | --- |
| 📄 Voorbereiding klaar | document/matrix/pseudocode/runbook geschreven; niets is uitgevoerd |
| 💻 Testcode klaar | uitvoerbare test bestaat |
| ✅ Uitgevoerd en geslaagd | een echte run tegen de bedoelde omgeving heeft plaatsgevonden, met resultaat |
| 🚧 Geblokkeerd | specifieke reden genoemd: implementatie, dependency, omgeving, autorisatie of **handmatig** (nooit door een dependency opgelost, wacht op een mens) |
| ⚪ Buiten scope | `prod`, always_ask |
| ⏹️ Vervallen | fase komt te vervallen, reden genoemd |

## Per sectie in DEPLOYMENT-AND-TESTING.md

| § | Niveau | Fase / toelichting |
| --- | --- | --- |
| Doelomgeving / Mac Studio 24/7 | ⚪ Buiten scope | `prod`, always_ask |
| Referentie Docker Compose | ⚪ Buiten scope | `prod`, always_ask |
| Bereikbaarheid (Tunnel/port forwarding) | ⚪ Buiten scope | `prod`, always_ask |
| Reverse-proxy en browsersecurity | ⚪ Buiten scope | `prod`, always_ask |
| Assets | ⚪ Buiten scope | `prod`, always_ask |
| Observability | ⚪ Buiten scope | `prod`, always_ask |
| Back-ups | ⚪ Buiten scope | `prod`, always_ask |
| Testinfra — mapstructuur (`tests/`) | ✅ Uitgevoerd | DT0 — `find tests -type f` bevestigt de vijf mappen |
| Testinfra — CI-kloof gedocumenteerd | 📄 Voorbereiding klaar | DT0b |
| Testfixtures (Room/Session/Player/Match/Round/Answer) | ✅ Uitgevoerd en geslaagd | DT2 — `node --test` echt gedraaid, 7/7 groen |
| Testlagen — Unit | ⚪ N.v.t. | eigendom van elke module-eigenaar zelf |
| Testlagen — Contracttests | ⏹️ Vervallen bij mij | PROTOCOL.md's PR7 bouwt dit zelf; DT1a is 📄 voorbereiding klaar als auditmatrix (26 open beslispunten + kruisverwijzing), **bevestiging door PROTOCOL.md-eigenaar nog niet binnen** |
| Testlagen — Integratie | 📄 matrix klaar / ✅ 12/14 geactiveerd | DT3a: 14 scenario's (📄). Verloop: 5/14 → 10/14 (2e heraudit) → **de socketlaag landde** (`server/transport/socket.mjs`) → 3e heraudit trof onderweg een echte, tijdelijke regressie in `setRoomAndMatchPhaseAtomically` (rijen 7,9,12,14 tijdelijk terug naar geblokkeerd, 11/13 geschreven maar geblokkeerd door dezelfde regressie, dus 6/14) → **bij eigen herverificatie kort daarna bleek de regressie al elders opgelost**: alle 12 tests slagen individueel én in de volledige `npm test` (2421 tests, 2415 pass, 6 fail — alle 6 in een ongerelateerde DataStore-conformance-suite). **Definitief: 12/14.** Rijen 4 en 6 blijven geblokkeerd: rate limiting bestaat nergens; `share:opened` is nu wél bereikbaar via de socketlaag maar de handler (`socket.mjs:966-970`) logt alleen, persisteert niets. |
| Testlagen — Browser/E2E | 📄 klaar / 🚧 uitvoering geblokkeerd (implementatie) | DT4a Deel 1: 6 pseudocode-scenario's (📄). **DT-R4-herverificatie (2026-08-02, nacht): 2 van 3 Playwright-triggercriteria nu waar** — `frontend/` bevat een echte, gerenderde Home-/Join-UI die daadwerkelijk `client/flow/` importeert (was 0), en de server serveert die content. Resterende blokkade: `frontend/js/app.mjs` gebruikt nog `createMockTransport()` i.p.v. `createTransport()` uit het al bestaande `transport.mjs` — één importregel, niet mijn module. DT4b: runbook klaar (📄), **0/10 devicechecks uitgevoerd — 🚧 handmatig**, geen dependency lost dit op |
| Testlagen — Restart-/chaostests | 📄 klaar / ✅ 1/6 scenario's uitgevoerd | DT6: `aseso-game-chaos`-stack draait geïsoleerd (`compose.chaos.override.yml`, loopback 8080/8443) naast de echte `aseso-game`-stack. **Scenario 1 uitgevoerd (2026-08-02, geautoriseerd):** game-server-restart, REST-realiseerbaar deel — container herstelt (~50s tot healthy), `/api/v1/time` werkt na herstel, roomstate overleeft de restart **niet** (verwacht: geen Redis-koppeling, alleen `createInMemoryStore()`). Bijvangst: `server/Dockerfile` bouwde zonder dependencies/`shared/`/`frontend/` — gefixt, anders kon dit scenario niet eens starten. Onverwachte, reproduceerbare bevinding los van chaos: `GET /api/v1/games/{code}/state` geeft `500 INTERNAL_ERROR` met een geldig token — gemeld, niet zelf gefixt (niet mijn module). Resetten en scenario 2–6: elk apart geautoriseerd. |
| Testlagen — Loadtests | 📄 klaar / 🚧 Deel 2 klaar, Deel 3 gestart (L0) — 1 bug gevonden | DT5 Deel 1: 10/10 criteria toegewezen aan een bewijsmethode (📄). **Deel 2 (2026-08-02): k6-scripts geschreven** — `l1-event-latency-and-answer-peak.js` (rijen 4/5), `l2-l3-multi-room-scale.js` (rijen 9/10). **Deel 3, L0-schaal geautoriseerd en uitgevoerd**: rij 4-proxy p95 = 22 ms (lokaal, < 300 ms-doel), connectie-/round-started-rate 100%. **Rij 5 blootgelegd als niet-bewijsbaar**: `round:progress` laat zijn definitieve "iedereen heeft geantwoord"-update structureel vallen bij een antwoordpiek (bugrapport, niet mijn module — zie `bug-report-round-progress-drops-final-update.md`); script aangepast om er niet meer op te wachten. Onderweg ook een aparte, inmiddels elders opgeloste bug gevonden die de server tijdelijk liet crashen bij opstarten (`bug-report-boot-crash-invalid-request.md`). L1 (100 spelers) en hoger, en elke test via de publieke route, blijven apart geautoriseerd; L2/L3 bovendien pas na een omgeving-/providercheck |
| Testlagen — CI-integratie | ✅ Uitgevoerd en geslaagd | DT7/DT-R3: **opgelost via optie A** (nieuw devkitprofiel `node-esm-app`, niet mijn eigen DT7-voorstel voor een parallelle workflow — dat is nu overbodig). De bestaande, managed `ci.yml` draait zelf al `node --check server/index.mjs` (lint) en `npm test` (echte `node:test`-suite) op Node 22. Geverifieerd: `devkit doctor --here` → profiel `node-esm-app`, geen managed-block-drift; `devkit validate-config` groen; `npm test` 2096/2096 groen. |
| Handmatige pilots | ⚪ Buiten scope | `prod`, always_ask |
| Release / Rollback | ⚪ Buiten scope | `prod`, always_ask |
| Definition of Done (MVP) | 🚧 Nog niet gestart | hangt af van bijna alle rijen hierboven |

**Uitvoeringsbesluit 2026-08-02:** de producteigenaar heeft akkoord gegeven om de
test-/deploymentonderdelen en benodigde dependencies te realiseren
(`docs/multiplayer/DECISIONS.md` §Uitvoeringsakkoord). Dit verwijdert de
menselijke akkoordblokkade, maar niet de expliciete technische prerequisites per
rij (server, UI, Compose-stack, meetomgeving) — zie de rapportage hieronder voor
wat daarvan inmiddels wél en niet klopt.

## Rapportage — chaos-scenario 1 + heraudit (2026-08-02, avond)

Geautoriseerd door de producteigenaar: scenario 1 tegen `aseso-game-chaos`, plus
een verzoek om DT3b/DT4/DT5 opnieuw te beoordelen tegen de inmiddels échte
server (`server/index.mjs`, niet meer de placeholder).

| Onderdeel | Verwachting | Uitkomst | Verklaring |
| --- | --- | --- | --- |
| Chaos-stack met echte server | image bevat de echte server | ❌ eerst, ✅ na fix | `server/Dockerfile` was stale (geen `npm ci`, geen `shared/`/`frontend/`) — gefixt vóór gebruik |
| Scenario 1 (restart) | procesherstel + healthcheck-herstel | ✅ | ~50s tot `healthy`, `/api/v1/time` werkt na herstel |
| Scenario 1: roomstate na restart | — | ❌, verwacht | geen Redis-koppeling; `createInMemoryStore()` is nog de enige store |
| Scenario 1: "midden in een ronde" | — | niet uitvoerbaar | `game:start`/`round:answer` zijn socket-only, geen socketlaag |
| DT3a-heraudit | eventueel meer rijen | ✅ +5 (3,7,9,12,14), nu 10/14 | onafhankelijk herbeoordeeld, niet op gezag van commit `27f6e4e` |
| DT3a rij 4/6 tegen echte REST | eventueel deelactivatie | 🚧 preciezer, niet geactiveerd | coderegistratie/joinUrl-zichtbaarheid werken al; rate limiting resp. `share:opened`-persistentie ontbreken nog — matrixeis niet verzwakt |
| Playwright/k6-target | opnieuw gecontroleerd | ⚪ ongewijzigd, nu met checklist | zie `e2e-load-target-check.md` §Triggercondities |
| Onverwachte bevinding | — | `500 INTERNAL_ERROR` op `GET /games/{code}/state` | reproduceerbaar, los van chaos, gemeld — niet mijn module om te fixen |

## Rapportage uitvoeringsakkoord (DT-R5, 2026-08-02)

**Dependencies — wat er nu daadwerkelijk is:**
- Aanwezig: `package.json` + `package-lock.json` (fastify, socket.io, redis, pg),
  `docker-compose.yml` + `compose.tunnel.override.yml` (geverifieerd door DT-R2
  tegen de echte, samengevoegde configuratie), en het devkitprofiel `node-esm-app`
  (opgelost via DT-R3 optie A, zie CI-rij hierboven).
- Nog niet aanwezig: Playwright, k6 — **herbevestigd 2026-08-02 (avond) door
  DT-R4**, zie [`e2e-load-target-check.md`](../e2e-load-target-check.md) §Triggercondities.
  `server/index.mjs` is niet meer de placeholder (echte Fastify-server, REST-laag,
  statische serving — zie DT6-rapportage hierboven), maar er is nog geen
  gerenderde `frontend/`-UI en geen socketlaag; geen van beide targets bestaat dus
  nog, om een andere reden dan eerder.

**Tests die daadwerkelijk gedraaid zijn sinds het uitvoeringsakkoord** (nageteld,
niet aangenomen — `npm test`, volledige repo, laatst geverifieerd 2026-08-02 ná
de invite-id-fix): **2096 tests, 2096 pass, 0 fail, 0 skipped.** Onderweg zat een
tussenstand van 2079 tests/28 fail (24 met dezelfde grondoorzaak als DT-R1's
bevinding — `room-lifecycle.mjs` riep de door DM10/DM11 verwijderde
`loadRoomByInviteId` aan — plus 3 expliciet gelabelde "verwacht rood tot DM de
fake corrigeert"-tests over een apart, bekend idempotentiegat, dezelfde
bevinding als de aan mij misgerichte INTB-review punt 4, en 1 verwante
DataStore-conformancetest); die 25 zijn inmiddels ook groen, op de 3
"verwacht rood"-tests ná die een apart, nog open DM-issue documenteren. Dit was
dus niet beperkt tot DT2's 7 fixtures — andere plannen (data-model-plan,
architecture-plan, protocol-plan, product-plan, content-plan e.a.) hebben in
dezelfde periode zelf duizenden tests toegevoegd en gedraaid.

**Resterende technische blockers, één zin per fase (bijgewerkt 2026-08-02 avond):**
- DT3b: 10/14 geactiveerd; overige 4 (rijen 4,6,11,13) missen rate limiting,
  `share:opened`-persistentie, een socket-laag resp. een broadcast-aanroeper —
  rij 4/6's andere helft (coderegistratie, joinUrl-zichtbaarheid) is inmiddels
  wel bevestigd tegen de echte server.
- DT4a: geen geïntegreerde, gerenderde multiplayer-UI om te besturen (de server
  die 'm zou serveren, bestaat inmiddels wel).
- DT4b: geen dependency lost dit op — wacht op een mens met een echt toestel.
- DT5: geen spelbelastbare server; k6 zonder target meet niets zinvols.
- DT6: scenario 1 gedaan (REST-deel); scenario's 2–6 en resetten wachten op aparte autorisatie, elk apart.
- DT7: **opgelost** — devkitprofiel `node-esm-app` vervangt het onjuiste
  `react-native-app`-profiel; geen blocker meer.

## Openstaande actiepunten

- [ ] DT3b — 10/14 geactiveerd (1,2,3,5,7,8,9,10,12,14). Overige 4 rijen
      (4,6,11,13) missen rate limiting, `share:opened`-persistentie, een
      socket-laag resp. een `round:progress`-broadcast-aanroeper.
- [ ] DT4a — 0/6 uitvoerbaar. Wacht op zowel `deps` (Playwright) als een
      geïntegreerde, gerenderde UI (bevestigd afwezig, DT-R4).
- [ ] DT4b — 0/10 devicechecks uitgevoerd. Handmatig, geen dependency-blokkade.
- [ ] DT5 — 0/10 criteria gemeten. Wacht op loadtooling (bevestigd afwezig
      target, DT-R4), een draaiende server, observability, omgeving, akkoord.
- [ ] DT6 — 0/6 scenario's uitgevoerd. Runbook nu gevalideerd tegen het echte
      `docker-compose.yml` (DT-R2); wacht op gefaseerde autorisatie om de stack
      daadwerkelijk op te starten.
- [x] DT7/DT-R3 — devkitprofiel `node-esm-app` opgeleverd en geactiveerd (optie
      A). Mijn eigen DT7-voorstel (`ci-proposal.md`, een parallelle
      `tests-node.yml`) is daarmee overbodig geworden — de bestaande managed
      `ci.yml` doet het nu zelf correct.
- [x] DT-R1/R2/R4 uitgevoerd (2026-08-02); DT-R1's tussentijdse "0/14" (na een
      cross-plan interfacemismatch) hersteld naar **5/14 geactiveerd** zodra de
      onderliggende migratie elders was afgerond — zelf herverifieerd.
- [x] DT1b geretireerd; kruisverwijzing met protocol-plan's 15 open vragen
      toegevoegd aan `traceability-matrix.md`.
- [x] REVIEW-DT3B-DT7.md-bevindingen verwerkt (2026-08-02).

## Cijfers

- **Daadwerkelijk uitgevoerd en geslaagd:** DT0, DT2 (7/7), DT3b (10/14, elk
  zelf gedraaid), DT7/DT-R3 (CI zelf gefixt via profielwijziging), DT6 stap 1
  (chaos-stack live, geïsoleerd), en (buiten mijn eigen scope, maar nagetelde
  repo-brede stand) 2158/2158 tests repo-breed.
- **Voorbereiding klaar, uitvoering nog niet:** DT0b, DT1a, DT3a (resterende 9
  rijen), DT4a Deel 1, DT4b, DT5 Deel 1, DT6 Deel 1 (nu gevalideerd tegen de
  echte stack).
- **Vervallen:** DT1b.
- Resterend: geen enkel `deps`/`prod`-akkoord ontbreekt nog principieel
  (`DECISIONS.md` dekt alles) — wat overblijft is puur techniek: een
  geïntegreerde UI (DT4a/DT5), een draaiende Compose-stack (DT6), en verdere
  compositiestukken voor DT3b's resterende 9 rijen.
