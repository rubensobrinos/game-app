# Voortgang — DEPLOYMENT-AND-TESTING.md realisatie

Bijgewerkt: 2026-08-02, na [`prompts/REVIEW-DT3B-DT7.md`](prompts/REVIEW-DT3B-DT7.md).
Zie [`README.md`](README.md) voor het volledige plan en [`prompts/`](prompts/) voor
de uitvoerbare prompt per fase. Dit bestand is de checklist — bijwerken bij elke
fase-afronding, niet alleen aan het eind.

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
| 🚧 Geblokkeerd | specifieke reden genoemd: implementatie, dependency, omgeving of autorisatie |
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
| Testlagen — Integratie | 📄 matrix klaar / 🚧 code geblokkeerd | DT3a: 14 scenario's, elk met prerequisite + activatiecriterium (📄, klaar). DT3b: 0/14 geactiveerd — elke rij vereist een server-implementatie die nog niet bestaat |
| Testlagen — Browser/E2E | 📄 klaar / 🚧 uitvoering geblokkeerd | DT4a Deel 1: 6 pseudocode-scenario's (📄), elk met een eigen implementatieprerequisite (geïntegreerde UI bestaat nog niet) — 0/6 uitvoerbaar, ook ná een `deps`-akkoord voor Playwright alleen. DT4b: runbook klaar (📄), **0/10 devicechecks uitgevoerd** |
| Testlagen — Restart-/chaostests | 📄 klaar / 🚧 uitvoering geblokkeerd | DT6 Deel 1: runbook + preflight-stap voor 6 scenario's (📄) — **0/6 uitgevoerd**; preflight zelf kan pas tegen een écht draaiende Compose-stack, die nog niet bestaat |
| Testlagen — Loadtests | 📄 klaar / 🚧 uitvoering geblokkeerd | DT5 Deel 1: 10/10 criteria toegewezen aan een bewijsmethode (📄) — **0/10 criteria daadwerkelijk gemeten**; wacht op loadtooling, een draaiende server, observability, een geschikte omgeving én een uitvoeringsakkoord |
| Testlagen — CI-integratie | 📄 voorstel klaar / 🚧 lost bestaande CI niet zelf op | DT7: voorstel geschreven en al eerder gecorrigeerd (zocht aanvankelijk alleen `.test.js`, miste `.test.mjs` in `server/protocol`/`client/flow` en `shared/product` volledig — nu gefixt). **Blijft geblokkeerd:** de bestaande, devkit-managed `ci.yml` draait nu al kapot (`npm ci`/Jest zonder `package.json`), en een tweede workflow repareert dat niet — voorstel bevat nu drie opties, keuze is aan een mens |
| Handmatige pilots | ⚪ Buiten scope | `prod`, always_ask |
| Release / Rollback | ⚪ Buiten scope | `prod`, always_ask |
| Definition of Done (MVP) | 🚧 Nog niet gestart | hangt af van bijna alle rijen hierboven |

**Uitvoeringsbesluit 2026-08-02:** de producteigenaar heeft akkoord gegeven om de
test-/deploymentonderdelen en benodigde dependencies te realiseren. Dit verwijdert
de menselijke akkoordblokkade, maar niet de expliciete technische prerequisites per
rij (server, UI, Compose-stack, meetomgeving). Zie
`docs/multiplayer/DECISIONS.md` §Uitvoeringsakkoord.

## Openstaande actiepunten

- [ ] DT3b — 0/14 scenario's geactiveerd. Wacht op een echte server-implementatie
      per rij; per rij een **direct actieve** test (geen `test.skip` meer, zie
      REVIEW-DT3B-DT7.md #7 — het plan gebruikte eerder een overbodige
      skip-dan-activeren-stap).
- [ ] DT4a — 0/6 scenario's uitvoerbaar. Wacht op zowel een `deps`-akkoord voor
      Playwright als de per-scenario implementatieprerequisite (geïntegreerde,
      gerenderde UI — bestaat nu niet).
- [ ] DT4b — 0/10 devicechecks uitgevoerd. Wacht op een draaiende app/server plus
      handmatige uitvoering op echte toestellen — geen Playwright-afhankelijkheid.
- [ ] DT5 — 0/10 criteria gemeten. Wacht op loadtooling, een draaiende server,
      observability, een geschikte omgeving, een providercheck (L2/L3) én een apart
      uitvoeringsakkoord.
- [ ] DT6 — 0/6 scenario's uitgevoerd. Wacht op een bestaande Compose-stack, een
      geslaagde preflight per scenario, en gefaseerde autorisatie (opstarten →
      resetten → uitvoeren, elk apart).
- [ ] DT7 — voorstel klaar en gecorrigeerd, maar activatie lost de kloof niet op
      zonder dat de bestaande kapotte `ci.yml` ook wordt aangepakt (3 opties in het
      voorstel, keuze aan een mens).
- [x] DT1b geretireerd; kruisverwijzing met protocol-plan's 15 open vragen
      toegevoegd aan `traceability-matrix.md`.
- [x] REVIEW-DT3B-DT7.md-bevindingen verwerkt (2026-08-02): DT7-globs `.js`+`.mjs`
      en `shared/product` toegevoegd, DT7 kreeg een expliciete
      bestaande-CI-is-al-kapot-sectie, DT3b vereenvoudigd (geen `test.skip` meer),
      DT4a kreeg per-scenario prerequisites, DT6 kreeg een preflight-stap, dit
      bestand is bijgewerkt.

## Cijfers

- **Daadwerkelijk uitgevoerd en geslaagd:** DT0 (mapstructuur bestaat), DT2
  (testfixtures, 7/7 groen).
- **Voorbereiding klaar, uitvoering nog niet:** DT0b, DT1a (26 open beslispunten,
  bevestiging openstaand), DT3a (14 scenario's), DT4a Deel 1 (6 scenario's, 0/6
  uitvoerbaar), DT4b (10 rijen, 0/10 uitgevoerd), DT5 Deel 1 (10 criteria, 0/10
  gemeten), DT6 Deel 1 (6 scenario's + preflight, 0/6 uitgevoerd), DT7 (voorstel,
  lost bestaande CI niet zelf op).
- **Vervallen:** DT1b — overgenomen door PROTOCOL.md's PR7.
- **Volledig geblokkeerd op implementatie (niet slechts op een akkoord):** DT3b (0
  van 14 rijen heeft een activatiecriterium gehaald).
- Er is dus **niet één** resterend `deps`/`prod`-akkoord dat alles ontgrendelt — elke
  fase heeft zijn eigen, verschillende resterende voorwaarde (zie tabel hierboven en
  REVIEW-DT3B-DT7.md #4).
