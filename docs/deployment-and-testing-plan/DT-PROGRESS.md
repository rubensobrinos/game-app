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
| Testlagen — Integratie | 📄 matrix klaar / 🚧 code geblokkeerd (implementatie, dicht bij) | DT3a: 14 scenario's (📄). **DT-R1-heraudit (2026-08-02):** een echte compositielaag bleek te bestaan (`server/composition/`, niet via Fastify/Socket.IO maar als direct aanroepbare functies — zie `server-composition-request.md`). 5 rijen (1,2,5,8,10) kregen direct actieve tests die slaagden tegen een geïsoleerde snapshot (commit `c7ce43b`), maar faalden bij verificatie tegen de actuele werkboom: `context.store.loadRoomByInviteId is not a function` (`room-lifecycle.mjs:253` roept een methode aan die `server/data/repository.js` via de DM10/DM11-poortmigratie verving door `loadRoomByInviteHash`). **Gecorrigeerd: 0/14 daadwerkelijk actief**, 5 tests staan klaar in `tests/integration/pending/*.draft.mjs`, één citaat verwijderd van reactivatie. Dezelfde oorzaak breekt ook 24 van de 28 huidige repo-brede testfalen (zie rapportage onderaan) — dit is dus geen DT-specifiek probleem. |
| Testlagen — Browser/E2E | 📄 klaar / 🚧 uitvoering geblokkeerd (implementatie) | DT4a Deel 1: 6 pseudocode-scenario's (📄), elk met een eigen implementatieprerequisite — **DT-R4 (2026-08-02) bevestigd met verse citaten: nog geen enkele HTML koppelt aan `client/flow/`**, 0/6 uitvoerbaar. DT4b: runbook klaar (📄), **0/10 devicechecks uitgevoerd — 🚧 handmatig**, geen dependency lost dit op |
| Testlagen — Restart-/chaostests | 📄 klaar / 🚧 uitvoering geblokkeerd (omgeving) | DT6 Deel 1: runbook + preflight-stap voor 6 scenario's — **DT-R2 (2026-08-02): gevalideerd tegen het echte `docker-compose.yml`** (read-only `docker compose config`), 8 aannames bevestigd, 1 gecorrigeerd (tunnel-override ontbrak in twee opstartcommando's), 5 nieuwe details gesignaleerd. **0/6 uitgevoerd** — preflight is nu concreet maar de stack zelf is nog niet opgestart |
| Testlagen — Loadtests | 📄 klaar / 🚧 uitvoering geblokkeerd (dependency + implementatie) | DT5 Deel 1: 10/10 criteria toegewezen aan een bewijsmethode (📄) — **DT-R4 (2026-08-02) bevestigd: geen spelbelastbare server aanwezig**, dus 0/10 criteria daadwerkelijk gemeten; wacht op loadtooling, een draaiende server, observability, een geschikte omgeving én een uitvoeringsakkoord |
| Testlagen — CI-integratie | 📄 voorstel klaar / 🚧 lost bestaande CI niet zelf op | DT7: voorstel geschreven en al eerder gecorrigeerd (zocht aanvankelijk alleen `.test.js`, miste `.test.mjs` in `server/protocol`/`client/flow` en `shared/product` volledig — nu gefixt). **Blijft geblokkeerd:** de bestaande, devkit-managed `ci.yml` draait nu al kapot (`npm ci`/Jest zonder `package.json`), en een tweede workflow repareert dat niet — voorstel bevat nu drie opties, keuze is aan een mens |
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
  tegen de echte, samengevoegde configuratie).
- Nog niet aanwezig: Playwright, k6 — **bevestigd met verse citaten door DT-R4**,
  zie [`e2e-load-target-check.md`](../e2e-load-target-check.md). Geen HTML in de
  repo koppelt aan `client/flow/`; `server/index.mjs` is nog steeds de
  `node:http`-placeholder (501 op alle echte routes).

**Tests die daadwerkelijk gedraaid zijn sinds het uitvoeringsakkoord** (nageteld,
niet aangenomen — `npm test`, volledige repo, 2026-08-02):
`2079 tests, 2051 pass, 28 fail, 0 skipped`. Dit is dus niet beperkt tot DT2's
7 fixtures zoals eerder aangenomen — andere plannen (data-model-plan,
architecture-plan, protocol-plan, product-plan, content-plan e.a.) hebben in
dezelfde periode zelf duizenden tests toegevoegd en gedraaid. Van de 28 falende
tests:
- **24** hebben dezelfde grondoorzaak als DT-R1's bevinding: `room-lifecycle.mjs`
  roept de door DM10/DM11 verwijderde `loadRoomByInviteId` aan.
- **3** zijn expliciet gelabeld "verwacht rood tot DM de fake corrigeert"
  (idempotentie van `saveAcceptedAnswerAtomically`, dezelfde bevinding als de
  — aan mij misgerichte — INTB-review, punt 4) — een bewust bijgehouden, bekend
  gat, geen verrassing.
- **1** is een verwante DataStore-conformancetest over hetzelfde invite-id-gat.

**Resterende technische blockers, één zin per fase:**
- DT3b: 0/14 — 5 rijen zijn één methodeaanroep (`loadRoomByInviteHash` i.p.v.
  `loadRoomByInviteId`) verwijderd van activeren, de overige 9 missen grotere
  compositiestukken (match-laag, Socket.IO, rate limiting).
- DT4a: geen geïntegreerde, gerenderde multiplayer-UI om te besturen.
- DT4b: geen dependency lost dit op — wacht op een mens met een echt toestel.
- DT5: geen spelbelastbare server; k6 zonder target meet niets zinvols.
- DT6: de Compose-stack bestaat als configuratie maar draait nog niet.
- DT7: de bestaande managed `ci.yml` is los van dit alles al kapot (`npm ci`/Jest
  zonder passend profiel); wacht op een mensenkeuze uit DT-R3's drie opties.

## Openstaande actiepunten

- [ ] DT3b — 0/14 geactiveerd, maar 5 rijen (1,2,5,8,10) zijn nog maar één
      methodeaanroep verwijderd van slagen — zie
      `tests/integration/pending/*.draft.mjs` en `integration-matrix.md`
      §Audit-log voor het exacte citaat. Overige 9 rijen missen grotere
      compositiestukken.
- [ ] DT4a — 0/6 uitvoerbaar. Wacht op zowel `deps` (Playwright) als een
      geïntegreerde, gerenderde UI (bevestigd afwezig, DT-R4).
- [ ] DT4b — 0/10 devicechecks uitgevoerd. Handmatig, geen dependency-blokkade.
- [ ] DT5 — 0/10 criteria gemeten. Wacht op loadtooling (bevestigd afwezig
      target, DT-R4), een draaiende server, observability, omgeving, akkoord.
- [ ] DT6 — 0/6 scenario's uitgevoerd. Runbook nu gevalideerd tegen het echte
      `docker-compose.yml` (DT-R2); wacht op gefaseerde autorisatie om de stack
      daadwerkelijk op te starten.
- [ ] DT7 — voorstel klaar, DT-R3 legt drie opties voor (profielwijziging vs.
      stopgap vs. profielmigratie); wacht op mensenkeuze.
- [x] DT-R1/R2/R4 uitgevoerd (2026-08-02); DT-R1's aanvankelijke "5/14
      geactiveerd" gecorrigeerd naar 0/14 na eigen verificatie tegen de actuele
      werkboom (zie `integration-matrix.md` §Audit-log).
- [x] DT1b geretireerd; kruisverwijzing met protocol-plan's 15 open vragen
      toegevoegd aan `traceability-matrix.md`.
- [x] REVIEW-DT3B-DT7.md-bevindingen verwerkt (2026-08-02).

## Cijfers

- **Daadwerkelijk uitgevoerd en geslaagd:** DT0, DT2 (7/7), en (buiten mijn
  eigen scope, maar nagetelde repo-brede stand) 2051/2079 tests repo-breed.
- **Dicht bij, precies geciteerd:** DT3b-rijen 1,2,5,8,10 — draft-tests klaar,
  wachten op één methodeaanroep elders.
- **Voorbereiding klaar, uitvoering nog niet:** DT0b, DT1a, DT3a, DT4a Deel 1,
  DT4b, DT5 Deel 1, DT6 Deel 1 (nu gevalideerd tegen de echte stack), DT7.
- **Vervallen:** DT1b.
- Er is **niet één** resterend akkoord dat alles ontgrendelt — elke fase heeft
  zijn eigen resterende technische voorwaarde (zie rapportage hierboven).
