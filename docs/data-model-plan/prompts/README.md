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
| [`DM2a-game-configuration-and-session.md`](DM2a-game-configuration-and-session.md) | DM2a | `GameConfiguration` + `Session`, gesloten vs. open enums | **Uitgevoerd**, 44/44 tests groen |
| [`DM2b-room.md`](DM2b-room.md) | DM2b | `Room` (hernoemd van `RoomCore` na `DECISIONS.md` #21 — checkpoint 4 is opgelost, geen tussenvorm meer) | **Uitgevoerd**, 24/24 tests groen |
| [`DM3-player-match-round-answer-presentation.md`](DM3-player-match-round-answer-presentation.md) | DM3 | `Player`, `Match` (incl. `contentVersion`/`rendererVersion`), `Round` (incl. `validOptionIds`/`resultDetails`), `Answer`, `RoomPresentation`, `toActiveRoundSnapshot(round, match)` | **Uitgevoerd**, bijgewerkt na `DECISIONS.md` #21 |
| [`DM4-name-processing.md`](DM4-name-processing.md) | DM4 | Naamverwerking: vaste stappen vs. gedocumenteerde defaults, injecteerbare woordenlijsten | **Uitgevoerd**, 34/34 tests groen |
| [`DM5-privacy-guard.md`](DM5-privacy-guard.md) | DM5 | Allowlist per analyticstabel (i.p.v. denylist) | **Uitgevoerd**, 109/109 tests groen |
| [`DM6-repository-port.md`](DM6-repository-port.md) | DM6 | Domeinpoort + in-memory fake, atomaire operaties | **Uitgevoerd**, 23/23 tests groen |
| [`DM7-answer-flow.md`](DM7-answer-flow.md) | DM7 | Atomische antwoordverwerking: resolutielogica, idempotentie eerst | **Uitgevoerd**, 28/28 tests groen |
| [`DM8-analytics-proposal.md`](DM8-analytics-proposal.md) | DM8 | Analytics-eventcontract + `schema.sql`-voorstel (alleen `docs/`, geen code) | **Uitgevoerd** — `docs/data-model-plan/proposals/` |
| [`DM9-game-rules-reconciliation.md`](DM9-game-rules-reconciliation.md) | DM9 | `toStandingPlayerView()` tegen `rankPlayers()` (GAME-RULES.md GR2) | **Uitgevoerd**, end-to-end getest |

DM0–DM9 zijn allemaal uitgevoerd. DM2a–DM9 zijn eerst in één keer vooraf
geschreven (op verzoek), onafhankelijk gereviewd in
[`REVIEW-DM2-DM9.md`](REVIEW-DM2-DM9.md) (3 blockers, 8 hoge en 3 middelhoge
bevindingen), op basis daarvan herzien, en na de productbesluiten in
`docs/multiplayer/DECISIONS.md` nogmaals bijgewerkt (`DM-RESUME-AFTER-
DECISIONS.md`) vóór uitvoering. Zie [`../DM-PROGRESS.md`](../DM-PROGRESS.md)
voor de volledige status per sectie van `DATA-MODEL.md` en
[`../HANDOFF.md`](../HANDOFF.md) voor cross-plan-antwoorden.

## Reviews

| Bestand | Dekt |
| --- | --- |
| [`REVIEW-DM2-DM9.md`](REVIEW-DM2-DM9.md) | Onafhankelijke review van alle negen DM2–DM9-prompts, vóór uitvoering |

Zie ook [`../REVIEW.md`](../REVIEW.md) voor de eerdere review van het plan zelf
(vóór DM0/DM1 werden uitgevoerd).

Gebruik na de productbesluiten van 2 augustus 2026
[`DM-RESUME-AFTER-DECISIONS.md`](DM-RESUME-AFTER-DECISIONS.md) om de herziene
keuzes te verwerken en de uitvoerbare DM-fasen te hervatten.
