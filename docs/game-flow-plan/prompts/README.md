# Prompts — GAME-FLOW.md

Kant-en-klare prompts om één fase uit [`../README.md`](../README.md#fasering) op te
pakken. Elke prompt is zelfstandig leesbaar: doel, brondocument, aannames die al
vastliggen (locatie, geen dependencies, autonomiegrenzen) en acceptatiecriteria.

Gebruik: kopieer de inhoud onder een prompt-bestand in een nieuwe sessie of
agent-aanroep wanneer die fase daadwerkelijk gebouwd wordt.

| Bestand | Fase | Dekt |
| --- | --- | --- |
| [`GF0-scaffold.md`](GF0-scaffold.md) | GF0 | Locatie-voorstel + testrunner, geen dependencies |
| [`GF1-route-resolver.md`](GF1-route-resolver.md) | GF1 | Pad → routetype, zonder rechten aan een URL te koppelen |
| [`REVIEW.md`](REVIEW.md) | — | Zelfreview van GF0/GF1 vóór uitvoering |
| [`REVIEW-CODEX.md`](REVIEW-CODEX.md) | — | Onafhankelijke review; vond 3 harde fouten die in GF0/GF1 zijn verwerkt |
| [`GF2a-join-state.md`](GF2a-join-state.md) | GF2 | Pure statemachine voor de joinflow (QR/link + code) |
| [`GF2b-host-setup-state.md`](GF2b-host-setup-state.md) | GF2 | Pure statemachine voor Snel starten / Game instellen |
| [`GF3-match-phase-state.md`](GF3-match-phase-state.md) | GF3 | Reflecteert serverfases zonder eigen legaliteitscontrole op transities |
| [`GF4-reconnect-state.md`](GF4-reconnect-state.md) | GF4 | Backoff + snapshotaanvraag; corrigeert een scopefout uit de vorige planversie |
| [`GF5-edge-case-messaging.md`](GF5-edge-case-messaging.md) | GF5 | Foutcode/reden/status → berichtsleutel; herziet de "14 losse gevallen"-aanname |
| [`GF6-share-actions.md`](GF6-share-actions.md) | GF6 | Deelacties + URL-vorm die `qr`/`shared_link` als `joinSource` onderscheidt (lost GF2a's open vraag op) |
| [`GF7-teams-and-spectator.md`](GF7-teams-and-spectator.md) | GF7 | Team-selectiestate (met een geconstateerd protocolgat) + bevestiging dat de spectatorroute geen nieuwe module nodig heeft |
| [`GF8-protocol-interface-proposal.md`](GF8-protocol-interface-proposal.md) | GF8 | Bundelt alle openstaande PROTOCOL.md-aannames uit GF2a/GF3/GF5/GF7 in één reviewdocument |
| [`REVIEW-GF7-GF8.md`](REVIEW-GF7-GF8.md) | — | Review van GF7/GF8; één blocker en aanbevolen uitvoeringsvolgorde |
| [`GF9-session-store.md`](GF9-session-store.md) | GF9 | Sessietoken lokaal bewaren/lezen; stond in de moduletabel maar miste een fasenummer |
| [`GF10-host-controls-state.md`](GF10-host-controls-state.md) | GF10 | Welke hostknop wanneer actief is + de eventpayload; nieuw gevonden gat |
| [`GF11-leave-state.md`](GF11-leave-state.md) | GF11 | Bevestiging-vóór-verlaten + `player:leave`; Randgeval 11 had geen module |

GF0–GF6 en GF9–GF11 zijn gebouwd en geverifieerd (**217/217 tests groen** in
`client/flow/`, 10 modules). GF7 blijft geblokkeerd tot GF8 beantwoord is (zie de
review hierboven) — GF8 zelf is al uitgevoerd, zie
[`../protocol-interface-proposal.md`](../protocol-interface-proposal.md). Zie
[`../GF-PROGRESS.md`](../GF-PROGRESS.md) voor de volledige stand.
