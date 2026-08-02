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

Deze vijf zijn de fases die ik zelfstandig kon doorlopen tot en met een matrix,
voorstel of mapstructuur (zie README.md "Ik werk dus zelfstandig door tot...") — alle
vijf zijn nu afgerond en gecommit. **DT1b is vervallen** (de `PROTOCOL.md`-eigenaar
bouwt die laag zelf, zie README.md's bijwerking 2026-08-02) en krijgt dus geen
prompt meer. DT3b, DT4, DT5, DT6 en DT7 krijgen hun prompt pas vlak voordat ze
starten, omdat die allemaal wachten op een expliciet checkpoint (concrete
prerequisites uit DT3a, of een `deps`/`prod`-goedkeuring) — geen zin om ze nu al te
schrijven voor werk dat nog kan schuiven.
