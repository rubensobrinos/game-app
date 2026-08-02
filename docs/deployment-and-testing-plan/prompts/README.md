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
| [`DT3b-integratie-code.md`](DT3b-integratie-code.md) | DT3b | `test.skip`-code per matrixrij, pas na activatiecriterium — **geblokkeerd**, geen enkele rij voldoet nog |
| [`DT4a-playwright-e2e.md`](DT4a-playwright-e2e.md) | DT4a | Deel 1 pseudocode-scenario's (nu), Deel 2 echte specs (na `deps`-akkoord) |
| [`DT4b-device-matrix.md`](DT4b-device-matrix.md) | DT4b | Handmatige device-/browsermatrix — volledig nu uitvoerbaar |
| [`DT5-loadtests.md`](DT5-loadtests.md) | DT5 | Deel 1 evidence-tabel (nu), Deel 2/3 k6-scripts + uitvoering (na akkoord) |
| [`DT6-chaostests.md`](DT6-chaostests.md) | DT6 | Deel 1 runbook-tekst (nu), Deel 2 uitvoering (na gefaseerde autorisatie) |
| [`DT7-ci-voorstel.md`](DT7-ci-voorstel.md) | DT7 | CI-volgordevoorstel — volledig nu uitvoerbaar, activatie apart |

**DT0–DT3a** zijn de fases die ik zelfstandig kon doorlopen tot en met een matrix,
voorstel of mapstructuur — alle vijf zijn afgerond en gecommit. **DT1b is
vervallen** (de `PROTOCOL.md`-eigenaar bouwt die laag zelf, zie README.md's
bijwerking 2026-08-02). **DT3b t/m DT7** hebben nu allemaal een geschreven prompt,
zodat ze klaarliggen voor review — maar elk prompt-bestand bevat zijn eigen harde
knip tussen wat nu al uitvoerbaar is (documentatie/matrix, geen checkpoint nodig) en
wat op een expliciet `deps`/`prod`-akkoord of op concrete prerequisites uit DT3a
wacht. Zie [`../PROGRESS.md`](../PROGRESS.md) voor de actuele status per fase.
