# Prompts — PROTOCOL.md

Kant-en-klare prompts om één fase uit [`../README.md`](../README.md#fasering) op te
pakken. Elke prompt is zelfstandig leesbaar: doel, brondocument, aannames die al
vastliggen (locatie, moduleformaat, autonomiegrenzen) en acceptatiecriteria.

Gebruik: kopieer de inhoud onder een prompt-bestand in een nieuwe sessie of
agent-aanroep wanneer die fase daadwerkelijk gebouwd wordt.

| Bestand | Fase | Dekt | Status |
| --- | --- | --- | --- |
| [`PR0-scaffold.md`](PR0-scaffold.md) | PR0 | Locatie + moduleformaat, geen dependencies | Retroactief geschreven, uitgevoerd |
| [`PR1-envelope-idempotency.md`](PR1-envelope-idempotency.md) | PR1 | Event-envelope + idempotentiebeslissing | Retroactief geschreven, uitgevoerd |
| [`PR2-error-codes.md`](PR2-error-codes.md) | PR2 | Foutcode-enum (23 codes, 4 categorieën) + errorenvelope zonder debugdetails | Uitgevoerd |
| [`PR3-rest-schemas.md`](PR3-rest-schemas.md) | PR3 | REST-schema's (5 endpoints), input-safety naamvalidatie, auth-shape vormcheck | Uitgevoerd |
| [`PR4-client-events.md`](PR4-client-events.md) | PR4 | Client→server event-schema's (PR4a–PR4d), incl. `UNSUPPORTED_EVENT`-dispatch | Uitgevoerd |
| [`PR5-server-events.md`](PR5-server-events.md) | PR5 | Server→client event-schema's, snapshot-invariant, `round:progress`-throttle (PR5a–PR5e) | Uitgevoerd |
| [`PR6-reconnect.md`](PR6-reconnect.md) | PR6 | Backoff-reeks, niet-herverzenden van geaccepteerde antwoorden, auth-shape-hergebruik | Uitgevoerd |
| [`PR7-contract-tests.md`](PR7-contract-tests.md) | PR7 | Contracttest-suite tegen een fake Socket.IO/Fastify-harnas (PR7a–PR7e) | Uitgevoerd |
| [`PR8-session-token-proposal.md`](PR8-session-token-proposal.md) | PR8 | Sessie/tokenvoorstel (PR8a) + checkpoint + PR8b | Uitgevoerd (akkoord ontvangen) |
| [`PR9-decisions-spec-update.md`](PR9-decisions-spec-update.md) | PR9 | `PROTOCOL.md` zelf bijwerken naar `DECISIONS.md` (eerste keer dat dit plan het spec-document mag wijzigen) | Uitgevoerd |
| [`PR10-preview-endpoint.md`](PR10-preview-endpoint.md) | PR10 | Nieuw pre-join-previewendpoint (vorm-validator), vereist PR9 | Uitgevoerd |
| [`PR11-validators-decisions-update.md`](PR11-validators-decisions-update.md) | PR11 | `eligibleFromRound`, discriminated `question`-payloads (5 spelvormen, echte `question-selection.js`-vorm), `share:opened.method` 4e waarde, lokale `/time`-foutcode | Uitgevoerd |
| [`PR12-auth-session-extension.md`](PR12-auth-session-extension.md) | PR12 | Pepper-versionering + `verifyToken()` (constant-time) bovenop PR8b | Uitgevoerd |
| [`PR13-contract-tests-update.md`](PR13-contract-tests-update.md) | PR13 | PR7 uitbreiden met scenario's voor PR9/PR10/PR11/PR12 + traceability-tabel | Herzien na review, klaar om uit te voeren |

PR9–PR13 zijn geschreven na `DECISIONS.md` (2 augustus 2026) en dekken samen alle 17
Open vragen uit `../README.md`. Op 2 augustus 2026 is een mens-review uitgevoerd
(14 bevindingen, 2 blockers) en verwerkt — zie elk bestand z'n eigen "Verwerkte
review-feedback"-sectie. Aanbevolen uitvoeringsvolgorde: **PR9 → PR10 + PR11
(parallel kan, PR11 leunt niet op PR10) → PR12 → PR13**.

PR0 en PR1 zijn al uitgevoerd vóórdat hun promptbestand bestond; die twee zijn dus
retroactief geschreven (documentatie van wat al gebouwd is), terwijl PR2–PR8 vooraf
zijn geschreven en pas daarna (deels) uitgevoerd. Zie [`../PR-PROGRESS.md`](../PR-PROGRESS.md)
voor de actuele status per fase. PR2–PR8 zijn in één keer vooraf geschreven (op
verzoek), niet per fase vlak voordat die start zoals
[`../README.md`](../README.md#prompts-per-fase) oorspronkelijk als aanpak noemde.
Elke prompt kan daardoor iets moeten schuiven zodra een vorige fase in de praktijk
afwijkt van de aanname, of zodra een Open vraag uit `../README.md#open-vragen-uit-onderzoek`
alsnog wordt beantwoord — dat is bij gebruik expliciet te checken, niet blind te
kopiëren.

PR8 is de enige fase die `auth` raakt (ADR-plichtig): het bijbehorende bestand stopt
zelf bij een niet-bindend schriftelijk voorstel en bevat een letterlijke
checkpoint-instructie om op menselijke bevestiging te wachten vóór er ook maar één
regel token-/hashingcode wordt geschreven.

Na de productbesluiten van 2 augustus 2026 is de bindende hervattingsprompt:
[`PR-RESUME-AFTER-DECISIONS.md`](PR-RESUME-AFTER-DECISIONS.md). Die vervangt de
oude menselijke checkpointinstructie voor PR8 en ontdubbelt de open vragen.
