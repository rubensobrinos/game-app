# Prompts — UI1 multiplayer-frontend

[`UI1-multiplayer-ui.md`](UI1-multiplayer-ui.md) is de oorspronkelijke opdracht
(niet aanpassen). De bestanden hieronder breken die opdracht op in kleinere,
uitvoerbare stappen — zelfde stijl als `docs/game-flow-plan/prompts/`: doel,
brondocument, exacte contracten, en een Definition of Done.

| Bestand | Fase | Dekt |
| --- | --- | --- |
| [`UI1-multiplayer-ui.md`](UI1-multiplayer-ui.md) | — | Oorspronkelijke, volledige opdracht (UI1a + UI1b) |
| [`UI0-scaffold.md`](UI0-scaffold.md) | UI0 | Mapstructuur, `index.html`-shell, viewswitcher, i18n, servertijd-offset, mock-transportlaag |
| [`UI1-home-and-join.md`](UI1-home-and-join.md) | UI1 | Home (Snel starten/code) + Preview/join-scherm |
| [`UI2-lobby-and-share.md`](UI2-lobby-and-share.md) | UI2 | Lobby, deelnemerslijst, Delen-actie, Start |
| [`UI3-gameplay-screen.md`](UI3-gameplay-screen.md) | UI3 | Spelscherm flags_mc: vraag, timer, antwoord, uitslag |
| [`UI4-scoreboard-and-podium.md`](UI4-scoreboard-and-podium.md) | UI4 | Tussenstand + eindpodium + rematch |
| [`UI5-host-bar.md`](UI5-host-bar.md) | UI5 | Inklapbare hostbediening |

UI0 is een harde vereiste voor UI1–UI5: die introduceert de viewswitcher, de
i18n-loader en het mock-transportcontract die alle schermen gebruiken. UI1b
(foutmeldingen, pauze, verlaten, EN/ES, landscape) krijgt pas een prompt zodra
UI1a end-to-end speelt — zie `../UI-PROGRESS.md`.
