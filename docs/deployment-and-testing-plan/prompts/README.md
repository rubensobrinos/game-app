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
| [`T0-scaffold.md`](T0-scaffold.md) | T0 | Alleen mapstructuur (5 `.gitkeep`-bestanden) — herzien na [`REVIEW.md`](REVIEW.md) — **in uitvoering** |
| [`T0b-status-en-ci-gap.md`](T0b-status-en-ci-gap.md) | T0b | Statusregel + canoniek testcommando + CI-kloof in README |
| [`T1a-traceability-matrix.md`](T1a-traceability-matrix.md) | T1a | Traceability-matrix PROTOCOL.md → open beslispunten |
| [`T2-fixtures-voorstel.md`](T2-fixtures-voorstel.md) | T2 | Pure data-factories conform DATA-MODEL.md (voorstel) |
| [`T3a-integratie-matrix.md`](T3a-integratie-matrix.md) | T3a | Genummerde integratiescenario-matrix met activatiecriteria |

Deze vijf zijn de fases die ik zelfstandig kan doorlopen tot en met een matrix,
voorstel of mapstructuur (zie README.md "Ik werk dus zelfstandig door tot..."). T1b,
T3b, T4, T5, T6 en T7 krijgen hun prompt pas vlak voordat ze starten, omdat die
allemaal wachten op een expliciet checkpoint (bevestiging door een andere
document-eigenaar, of een `deps`/`prod`-goedkeuring) — geen zin om ze nu al te
schrijven voor werk dat nog kan schuiven.
