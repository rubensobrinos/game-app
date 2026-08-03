# Prompts — thema 1: Schermen en flow

Negen uitvoerbare stappen op basis van [`../PROGRESS.md`](../PROGRESS.md) (na
review) en de brondocumenten [`../03-GAME-FLOW-AND-STATES.md`](../03-GAME-FLOW-AND-STATES.md)/
[`../04-SCREEN-SPECIFICATIONS.md`](../04-SCREEN-SPECIFICATIONS.md). Zelfde
stijl als `docs/frontend-plan/prompts/`: brondocument, exacte contracten,
Definition of Done.

Volgorde is een voorstel, geen harde afhankelijkheidsketen — alleen 07 en 08
delen bewust één stuk logica (rankbeweging/comeback-detectie) en worden het
best na elkaar gedaan.

| # | Bestand | Dekt | Fase (roadmap) |
| --- | --- | --- | --- |
| 01 | [`01-snelle-reparaties.md`](01-snelle-reparaties.md) | S16, S17, S19, S21 — vier kleine fixes op bestaande code | doorlopend |
| 02 | [`02-S05-permanente-qr-code.md`](02-S05-permanente-qr-code.md) | S05 — `room-header.mjs` inhangen (`D-018`/`D-019`) | 1, hoog impact |
| 03 | [`03-S06-spelerslobby.md`](03-S06-spelerslobby.md) | S06 — eigen spelerslobby-variant | 2 |
| 04 | [`04-S07-countdown.md`](04-S07-countdown.md) | S07 — countdown, data bestaat al (`countdownEndsAt`) | 1, hoog impact |
| 05 | [`05-randgevallen.md`](05-randgevallen.md) | Dubbele tab + gedifferentieerde foutafhandeling bij `ROOM_VALIDATING` | doorlopend |
| 06 | [`06-start-en-join-polish.md`](06-start-en-join-polish.md) | S01, S03, S04 — landing/code/naam-polish | 1 |
| 07 | [`07-reveal-en-sociale-headline.md`](07-reveal-en-sociale-headline.md) | S13, S14 — grootste losse stuk, deels `HANDOFF` nodig | 2, zeer hoog impact |
| 08 | [`08-leaderboard-en-podium.md`](08-leaderboard-en-podium.md) | S15, S20 — rankbeweging, tie-regel, podiumopbouw | 2, hoog impact |
| 09 | [`09-S02-spel-aanpassen.md`](09-S02-spel-aanpassen.md) | S02 — instellingen-sheet, reducer bestaat al | 2 |

## Wat deze negen niet dekken

`S08`/`S09`/`S10`/`S11`/`S12`/`S18` staan in `../PROGRESS.md` al op niveau 1
zonder een scherpe, direct uitvoerbare volgende stap (S09/S10 vallen sowieso
buiten de lanceerscope). Thema 2's eigen fundamentgat (wereldmotieven,
iconografie, lettertype/accentkleur — `O-002`/`O-003`) en thema 5's
device-/screenreadertests horen niet hier, ook al raken ze dezelfde schermen.

## Bekende `HANDOFF`-kandidaten die uit deze prompts kunnen volgen

- `07`: drie sociale-headline-typen die meer serverdata nodig hebben dan nu
  beschikbaar is (speleridentiteit bij "enige correct", antwoordtijd,
  streak-historie).
- `09`: teammodus (`mode` kent alleen `'individual'`) en tijd-per-ronde
  (bestaat niet in `HostConfig`) — alleen als teams/tijdslimiet alsnog
  gewenst blijken.
- `02`: de keuze of `lobby.mjs`'s eigen QR/code-ingang blijft bestaan naast
  de nieuwe permanente header, of vervalt.
