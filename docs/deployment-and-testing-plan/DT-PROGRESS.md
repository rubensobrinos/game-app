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
| Testlagen — Integratie | 📄 matrix klaar / ✅ 5/14 geactiveerd | DT3a: 14 scenario's (📄). **DT-R1-heraudit (2026-08-02):** een echte compositielaag bleek te bestaan (`server/composition/`, niet via Fastify/Socket.IO maar als direct aanroepbare functies — zie `server-composition-request.md`). Rijen 1,2,5,8,10 kregen direct actieve tests. Tussentijds (zie `integration-matrix.md` §Audit-log voor het volledige verloop) faalden ze kort op een cross-plan interfacemismatch (`loadRoomByInviteId` verwijderd door DM10/DM11), maar die is elders gerepareerd. **Definitief: 5/14 geactiveerd, zelf gedraaid: 5/5 groen**, plus repo-breed `npm test`: 2096/2096 groen. Rijen 3,4,6,7,9,11,12,13,14 blijven geblokkeerd — grotere compositiestukken (match-laag, Socket.IO, rate limiting) ontbreken nog. |
| Testlagen — Browser/E2E | 📄 klaar / 🚧 uitvoering geblokkeerd (implementatie) | DT4a Deel 1: 6 pseudocode-scenario's (📄), elk met een eigen implementatieprerequisite — **DT-R4 (2026-08-02) bevestigd met verse citaten: nog geen enkele HTML koppelt aan `client/flow/`**, 0/6 uitvoerbaar. DT4b: runbook klaar (📄), **0/10 devicechecks uitgevoerd — 🚧 handmatig**, geen dependency lost dit op |
| Testlagen — Restart-/chaostests | 📄 klaar / 🚧 uitvoering geblokkeerd (omgeving) | DT6 Deel 1: runbook + preflight-stap voor 6 scenario's — **DT-R2 (2026-08-02): gevalideerd tegen het echte `docker-compose.yml`** (read-only `docker compose config`), 8 aannames bevestigd, 1 gecorrigeerd (tunnel-override ontbrak in twee opstartcommando's), 5 nieuwe details gesignaleerd. **0/6 uitgevoerd** — preflight is nu concreet maar de stack zelf is nog niet opgestart |
| Testlagen — Loadtests | 📄 klaar / 🚧 uitvoering geblokkeerd (dependency + implementatie) | DT5 Deel 1: 10/10 criteria toegewezen aan een bewijsmethode (📄) — **DT-R4 (2026-08-02) bevestigd: geen spelbelastbare server aanwezig**, dus 0/10 criteria daadwerkelijk gemeten; wacht op loadtooling, een draaiende server, observability, een geschikte omgeving én een uitvoeringsakkoord |
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

## Rapportage uitvoeringsakkoord (DT-R5, 2026-08-02)

**Dependencies — wat er nu daadwerkelijk is:**
- Aanwezig: `package.json` + `package-lock.json` (fastify, socket.io, redis, pg),
  `docker-compose.yml` + `compose.tunnel.override.yml` (geverifieerd door DT-R2
  tegen de echte, samengevoegde configuratie), en het devkitprofiel `node-esm-app`
  (opgelost via DT-R3 optie A, zie CI-rij hierboven).
- Nog niet aanwezig: Playwright, k6 — **bevestigd met verse citaten door DT-R4**,
  zie [`e2e-load-target-check.md`](../e2e-load-target-check.md). Geen HTML in de
  repo koppelt aan `client/flow/`; `server/index.mjs` is nog steeds de
  `node:http`-placeholder (501 op alle echte routes).

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

**Resterende technische blockers, één zin per fase:**
- DT3b: 5/14 geactiveerd; overige 9 missen grotere compositiestukken (match-laag,
  Socket.IO, rate limiting).
- DT4a: geen geïntegreerde, gerenderde multiplayer-UI om te besturen.
- DT4b: geen dependency lost dit op — wacht op een mens met een echt toestel.
- DT5: geen spelbelastbare server; k6 zonder target meet niets zinvols.
- DT6: de Compose-stack bestaat als configuratie maar draait nog niet.
- DT7: **opgelost** — devkitprofiel `node-esm-app` vervangt het onjuiste
  `react-native-app`-profiel; geen blocker meer.

## Openstaande actiepunten

- [ ] DT3b — 5/14 geactiveerd (1,2,5,8,10). Overige 9 rijen missen grotere
      compositiestukken (match-laag, Socket.IO, rate limiting) — geen quick fix.
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

- **Daadwerkelijk uitgevoerd en geslaagd:** DT0, DT2 (7/7), DT3b (5/14, elk
  zelf gedraaid), DT7/DT-R3 (CI zelf gefixt via profielwijziging), en (buiten
  mijn eigen scope, maar nagetelde repo-brede stand) 2096/2096 tests repo-breed.
- **Voorbereiding klaar, uitvoering nog niet:** DT0b, DT1a, DT3a (resterende 9
  rijen), DT4a Deel 1, DT4b, DT5 Deel 1, DT6 Deel 1 (nu gevalideerd tegen de
  echte stack).
- **Vervallen:** DT1b.
- Resterend: geen enkel `deps`/`prod`-akkoord ontbreekt nog principieel
  (`DECISIONS.md` dekt alles) — wat overblijft is puur techniek: een
  geïntegreerde UI (DT4a/DT5), een draaiende Compose-stack (DT6), en verdere
  compositiestukken voor DT3b's resterende 9 rijen.
