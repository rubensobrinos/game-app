# Prompts — DEPLOYMENT-AND-TESTING.md

Kant-en-klare prompts om één fase uit
[`../README.md`](../README.md#fasering) op te pakken, zonder dat we dan opnieuw de
hele context moeten opbouwen. Elke prompt is zelfstandig leesbaar: bevat het doel, de
relevante bronparagrafen, de aannames die al vastliggen (locatie, geen dependencies,
autonomiegrenzen) en de acceptatiecriteria.

Gebruik: kopieer de inhoud onder **Prompt** in een nieuwe sessie of agent-aanroep
wanneer we die fase daadwerkelijk gaan bouwen. De rest van het bestand is toelichting
voor onszelf, niet voor de uitvoerder.

| Bestand | Fase | Dekt |
| --- | --- | --- |
| [`DT0-scaffold.md`](DT0-scaffold.md) | DT0 | Alleen mapstructuur (5 `.gitkeep`-bestanden) — herzien na [`REVIEW.md`](REVIEW.md) — **afgerond** |
| [`DT0b-status-en-ci-gap.md`](DT0b-status-en-ci-gap.md) | DT0b | Statusregel + canoniek testcommando + CI-kloof in README — **afgerond** |
| [`DT1a-traceability-matrix.md`](DT1a-traceability-matrix.md) | DT1a | Traceability-matrix PROTOCOL.md → open beslispunten — **afgerond**, incl. addendum-kruisverwijzing met protocol-plan |
| [`DT2-fixtures-voorstel.md`](DT2-fixtures-voorstel.md) | DT2 | Pure data-factories conform DATA-MODEL.md (voorstel) — **afgerond** |
| [`DT3a-integratie-matrix.md`](DT3a-integratie-matrix.md) | DT3a | Genummerde integratiescenario-matrix met activatiecriteria — **afgerond** |
| [`DT3b-integratie-code.md`](DT3b-integratie-code.md) | DT3b | Direct actieve test per matrixrij (geen `test.skip` meer, zie REVIEW-DT3B-DT7.md #7), pas na activatiecriterium — **geblokkeerd**, 0/14 rijen voldoet nog |
| [`DT4a-playwright-e2e.md`](DT4a-playwright-e2e.md) | DT4a | Deel 1: 6 pseudocode-scenario's, elk met een eigen implementatieprerequisite — **klaar, 0/6 uitvoerbaar**. Deel 2 echte specs (na `deps`-akkoord + prerequisite) |
| [`DT4b-device-matrix.md`](DT4b-device-matrix.md) | DT4b | Handmatige device-/browsermatrix — **runbook klaar, 0/10 devicechecks uitgevoerd** |
| [`DT5-loadtests.md`](DT5-loadtests.md) | DT5 | Deel 1 evidence-tabel — **klaar, 0/10 criteria gemeten**. Deel 2/3 k6-scripts + uitvoering (na akkoord) |
| [`DT6-chaostests.md`](DT6-chaostests.md) | DT6 | Deel 1 runbook + preflight-stap — **klaar, 0/6 scenario's uitgevoerd**. Deel 2 uitvoering (na gefaseerde autorisatie) |
| [`DT7-ci-voorstel.md`](DT7-ci-voorstel.md) | DT7 | CI-volgordevoorstel — **overbodig geworden**: DT-R3 optie A (nieuw devkitprofiel) loste de kloof al op zonder dit voorstel te activeren |
| [`REVIEW-DT3B-DT7.md`](REVIEW-DT3B-DT7.md) | — | Review van de resterende fasen; beide DT7-blockers en de overige bevindingen zijn verwerkt, zie [`../DT-PROGRESS.md`](../DT-PROGRESS.md) |
| [`DT-RESUME-AFTER-DECISIONS.md`](DT-RESUME-AFTER-DECISIONS.md) | Hervatting | Uitvoeringsakkoord toepassen en technisch uitvoerbare tests activeren |
| [`DT-R1-heraudit-integratie.md`](DT-R1-heraudit-integratie.md) | DT-R1 | 14 DT3a-rijen herchecken tegen de huidige (placeholder-)server |
| [`DT-R2-chaos-preflight-echte-compose.md`](DT-R2-chaos-preflight-echte-compose.md) | DT-R2 | Chaos-runbook valideren tegen het echte `docker-compose.yml` |
| [`DT-R4-playwright-k6-target-check.md`](DT-R4-playwright-k6-target-check.md) | DT-R4 | Bevestigen of Playwright/k6 al een concreet target hebben |
| [`DT-R5-progress-bijwerken.md`](DT-R5-progress-bijwerken.md) | DT-R5 | `DT-PROGRESS.md` + rapportage — pas ná DT-R1/R2/R4 |
| [`DT-R3-ci-devkit-profiel.md`](DT-R3-ci-devkit-profiel.md) | DT-R3 | CI-fix: geverifieerd dat geen `.devkit.yaml`-execution-override en geen passend profiel bestaan, 3 opties voorgelegd — **opgelost: optie A gekozen**, nieuw devkitprofiel `node-esm-app` upstream gebouwd en geactiveerd |

DT-R1/R2/R4/R5 zijn herzien na review (2026-08-02): stale 5/400-bestandslimiet in
DT-R1 vervangen door de huidige 15/5.000-grens, DT-R2 staat nu expliciet
read-only `docker compose config` toe, DT-R4 vraagt niet langer opnieuw om een
akkoord dat `DECISIONS.md` al gaf, DT-R1/R4 schrijven nu naar een persistent
bestand (`integration-matrix.md`'s audit-log resp. `e2e-load-target-check.md`) in
plaats van een niet-bestaand mondeling "rapport", en DT-R5 voegt geen nieuw
bewijsniveau meer toe maar hergebruikt de bestaande 🚧-redenopsomming.

**DT0–DT3a** zijn de fases die ik zelfstandig kon doorlopen tot en met een matrix,
voorstel of mapstructuur — alle vijf zijn afgerond en gecommit. **DT1b is
vervallen** (de `PROTOCOL.md`-eigenaar bouwt die laag zelf, zie README.md's
bijwerking 2026-08-02). **DT3b t/m DT7** hebben nu allemaal een geschreven prompt,
zodat ze klaarliggen voor review — maar elk prompt-bestand bevat zijn eigen harde
knip tussen wat nu al uitvoerbaar is (documentatie/matrix, geen checkpoint nodig) en
wat op een expliciet `deps`/`prod`-akkoord of op concrete prerequisites uit DT3a
wacht. Zie [`../DT-PROGRESS.md`](../DT-PROGRESS.md) voor de actuele status per fase.
