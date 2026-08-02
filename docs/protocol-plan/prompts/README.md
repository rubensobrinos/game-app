# Prompts — PROTOCOL.md

Kant-en-klare prompts om één fase uit [`../README.md`](../README.md#fasering) op te
pakken. Elke prompt is zelfstandig leesbaar: doel, brondocument, aannames die al
vastliggen (locatie, moduleformaat, autonomiegrenzen) en acceptatiecriteria.

Gebruik: kopieer de inhoud onder een prompt-bestand in een nieuwe sessie of
agent-aanroep wanneer die fase daadwerkelijk gebouwd wordt.

| Bestand | Fase | Dekt |
| --- | --- | --- |
| [`PR2-error-codes.md`](PR2-error-codes.md) | PR2 | Foutcode-enum (23 codes, 4 categorieën) + errorenvelope zonder debugdetails |
| [`PR3-rest-schemas.md`](PR3-rest-schemas.md) | PR3 | REST-schema's (5 endpoints), input-safety naamvalidatie, auth-shape vormcheck |
| [`PR4-client-events.md`](PR4-client-events.md) | PR4 | Client→server event-schema's (PR4a–PR4d), incl. `UNSUPPORTED_EVENT`-dispatch |
| [`PR5-server-events.md`](PR5-server-events.md) | PR5 | Server→client event-schema's, snapshot-invariant, `round:progress`-throttle (PR5a–PR5e) |
| [`PR6-reconnect.md`](PR6-reconnect.md) | PR6 | Backoff-reeks, niet-herverzenden van geaccepteerde antwoorden, auth-shape-hergebruik |
| [`PR7-contract-tests.md`](PR7-contract-tests.md) | PR7 | Contracttest-suite tegen een fake Socket.IO/Fastify-harnas (PR7a–PR7e) |
| [`PR8-session-token-proposal.md`](PR8-session-token-proposal.md) | PR8 | Sessie/tokenvoorstel (PR8a, geen code) + verplicht checkpoint + PR8b ná akkoord |

PR0 en PR1 (scaffold + event-envelope/idempotentie) zijn al uitgevoerd — zie
`server/protocol/` en de rest van [`../README.md`](../README.md#fasering) voor wat
daar staat. Deze prompts zijn dus alle nog te bouwen fasen; ze zijn in één keer
vooraf geschreven (op verzoek), niet per fase vlak voordat die start zoals
[`../README.md`](../README.md#prompts-per-fase) oorspronkelijk als aanpak noemde.
Elke prompt kan daardoor iets moeten schuiven zodra een vorige fase in de praktijk
afwijkt van de aanname, of zodra een Open vraag uit `../README.md#open-vragen-uit-onderzoek`
alsnog wordt beantwoord — dat is bij gebruik expliciet te checken, niet blind te
kopiëren.

PR8 is de enige fase die `auth` raakt (ADR-plichtig): het bijbehorende bestand stopt
zelf bij een niet-bindend schriftelijk voorstel en bevat een letterlijke
checkpoint-instructie om op menselijke bevestiging te wachten vóór er ook maar één
regel token-/hashingcode wordt geschreven.
