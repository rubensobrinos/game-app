# Prompts — DATA-MODEL.md

Kant-en-klare prompts om één fase uit [`../README.md`](../README.md#3-fasering--status)
op te pakken. Elke prompt is zelfstandig leesbaar: doel, brondocument, aannames
die al vastliggen, stappen, tests en acceptatiecriteria ("Definition of done").

Gebruik: kopieer de inhoud onder een prompt-bestand in een nieuwe sessie of
agent-aanroep wanneer die fase daadwerkelijk gebouwd wordt.

| Bestand | Fase | Dekt | Status |
| --- | --- | --- | --- |
| [`DM0-scaffold.md`](DM0-scaffold.md) | DM0 | `server/data/`-locatie + `.gitkeep`, geen dependencies | **Uitgevoerd** |
| [`DM1-keys-and-ttl.md`](DM1-keys-and-ttl.md) | DM1 | Redis-key-builders + `ROOM_TTL_SECONDS`, invoervalidatie | **Uitgevoerd**, 66/66 tests groen |
| [`DM2a-game-configuration-and-session.md`](DM2a-game-configuration-and-session.md) | DM2a | `GameConfiguration` + `Session`, gesloten vs. open enums | Prompt klaar, herzien na review |
| [`DM2b-room.md`](DM2b-room.md) | DM2b | `RoomCore` (Room minus `contentVersion`/`rendererVersion`) | Prompt klaar, herzien na review |
| [`DM3-player-match-round-answer-presentation.md`](DM3-player-match-round-answer-presentation.md) | DM3 | `Player`, `Match`, `Round` (incl. `validOptionIds`/`resultDetails`), `Answer`, `RoomPresentation`, `toActiveRoundSnapshot()` | Prompt klaar, herzien na review |
| [`DM4-name-processing.md`](DM4-name-processing.md) | DM4 | Naamverwerking: vaste stappen vs. gedocumenteerde defaults, injecteerbare woordenlijsten | Prompt klaar, herzien na review |
| [`DM5-privacy-guard.md`](DM5-privacy-guard.md) | DM5 | Allowlist per analyticstabel (i.p.v. denylist) | Prompt klaar, herzien na review |
| [`DM6-repository-port.md`](DM6-repository-port.md) | DM6 | Domeinpoort + in-memory fake, atomaire operaties | Prompt klaar, herzien na review |
| [`DM7-answer-flow.md`](DM7-answer-flow.md) | DM7 | Atomische antwoordverwerking: resolutielogica, idempotentie eerst | Prompt klaar, herzien na review |
| [`DM8-analytics-proposal.md`](DM8-analytics-proposal.md) | DM8 | Analytics-eventcontract + `schema.sql`-voorstel (alleen `docs/`, geen code) | Prompt klaar, herzien na review |
| [`DM9-game-rules-reconciliation.md`](DM9-game-rules-reconciliation.md) | DM9 | `toStandingPlayerView()` tegen `rankPlayers()` (GAME-RULES.md GR2) | Prompt klaar, herzien na review |

DM0 en DM1 zijn uitgevoerd vóórdat de rest bestond. DM2a–DM9 zijn in één keer
vooraf geschreven (op verzoek), onafhankelijk gereviewd in
[`REVIEW-DM2-DM9.md`](REVIEW-DM2-DM9.md) (3 blockers, 8 hoge en 3 middelhoge
bevindingen), en op basis daarvan herzien — elke prompt noemt zijn eigen
correcties bovenaan. Zie [`../DM-PROGRESS.md`](../DM-PROGRESS.md) voor de
actuele status per sectie van `DATA-MODEL.md` en [`../HANDOFF.md`](../HANDOFF.md)
voor openstaande cross-plan-vragen. Geen van DM2a–DM9 is uitgevoerd; ze wachten
op akkoord vóórdat er code landt.

## Reviews

| Bestand | Dekt |
| --- | --- |
| [`REVIEW-DM2-DM9.md`](REVIEW-DM2-DM9.md) | Onafhankelijke review van alle negen DM2–DM9-prompts, vóór uitvoering |

Zie ook [`../REVIEW.md`](../REVIEW.md) voor de eerdere review van het plan zelf
(vóór DM0/DM1 werden uitgevoerd).
