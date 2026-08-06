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

**Status: alle negen uitgevoerd (3 aug 2026).** Zie `../PROGRESS.md` per
scherm en `docs/frontend-plan/HANDOFF-UI.md` (`UI-13` t/m `UI-17`) voor de
opengebleven punten die uit het uitvoeren volgden.

Een tiende bouwprompt kwam er ná die negen bij, niet uit review maar uit een
gecorrigeerde scope-aanname. **Uitgevoerd (3 aug 2026).**

| # | Bestand | Dekt | Fase (roadmap) |
| --- | --- | --- | --- |
| 14 | [`14-S09-S10-echt-of-nep-en-hoger-of-lager.md`](14-S09-S10-echt-of-nep-en-hoger-of-lager.md) | S09, S10 — bevestigde Golf-1-spelvormen, server/protocol staan al klaar | 1, ten onrechte als "buiten scope" gemarkeerd |

`gameplay.mjs`/`round-model.mjs` takken nu af op `gameType`; nieuw
`flag-renderer.mjs` (canvas, poort van de singleplayer-renderer) voor S09's
`kind: "generated"`. Geverifieerd zonder `client/flow/`'s (nog vaste)
spelvorm-selector nodig te hebben, via een losse testharnas die
`createGameplayView` rechtstreeks aanstuurt met een hand-gebouwd
`round:started`-model per `gameType` — zie `../PROGRESS.md` S09/S10 voor de
volledige verificatie en één gevonden kanttekening (S10's reveal toont geen
rauwe metriekwaarden; `PROTOCOL.md` suggereert dat ze er wel zijn, de
daadwerkelijke serverimplementatie stuurt ze niet mee).

## Verzoeken/besluiten die uit het uitvoeren volgden

Vier van de vijf oorspronkelijke `HANDOFF`-kandidaten hieronder bleken bij
nader onderzoek (zie elk bestand voor de reproductie) al eerder besloten in
`docs/multiplayer/GAME-RULES.md`/`docs/game-rules-plan/` — alleen niet
geraadpleegd toen ze voor het eerst genoteerd werden. Geschreven zoals
`docs/handoff-principles.md` het voorschrijft, elk met een expliciete
intrekking of correctie waar van toepassing (principe 8):

| # | Bestand | Voor | Status |
| --- | --- | --- | --- |
| 10 | [`10-besluitverzoek-UI-15-tie-regel.md`](10-besluitverzoek-UI-15-tie-regel.md) | INT-A | Tie-regel zelf is al bevestigd; `scoreboard:updated` en `game:finished` passen 'm inconsistent toe |
| 11 | [`11-verzoek-streak-reactiezinnen.md`](11-verzoek-streak-reactiezinnen.md) | — | **Uitgevoerd (BOUWSPRINT doel 4, 3 aug 2026):** de opgeschorte "bevestig eerst"-vraag is door de bouwsprint zelf beantwoord (expliciet doel 4) — `views/streak-model.mjs`, opt-out in `app-menu.mjs`, zie `../PROGRESS.md` S14. |
| 12 | [`12-besluitverzoek-UI-14-dubbele-tab.md`](12-besluitverzoek-UI-14-dubbele-tab.md) | producteigenaar | Bevestig de al-gebouwde `BroadcastChannel`-aanpak voor dubbele tabs |
| 13 | [`13-verzoek-UI-17-tijd-per-ronde-en-teams.md`](13-verzoek-UI-17-tijd-per-ronde-en-teams.md) | `client/flow/`-eigenaar | Tijd-per-ronde heeft al een bevestigde default+range zonder veld; teams zijn al bevestigd voor "fase 1.5" |

`UI-13` (countdown-duur) kreeg geen eigen prompt: die bleek bij dezelfde
controle volledig opgelost door verduidelijking (`GAME-RULES.md` bevestigt 3s,
de mock is een zelf-gedocumenteerde testversnelling) — geen actie nodig, zie
`HANDOFF-UI.md`.

## Review

[`REVIEW.md`](REVIEW.md) — feitelijke controle van alle claims in deze negen
prompts tegen de code (3 aug 2026). Tien bevindingen; **prompt 04, 06 en 08
hebben elk een blokkerende correctie nodig vóórdat iemand ermee aan de slag
gaat.**

## Wat deze negen niet dekken

`S08`/`S11`/`S12`/`S18` staan in `../PROGRESS.md` al op niveau 1 zonder een
scherpe, direct uitvoerbare volgende stap. `S09`/`S10` stonden hier eerder ook
als "buiten de lanceerscope" — dat was fout (zie `../PROGRESS.md`, principe 8):
beide zijn bevestigde Golf-1-spelvormen (`PRODUCT.md`), nu gedekt door
[`14-S09-S10-echt-of-nep-en-hoger-of-lager.md`](14-S09-S10-echt-of-nep-en-hoger-of-lager.md).
Thema 2's eigen fundamentgat (wereldmotieven,
iconografie, lettertype/accentkleur — `O-002`/`O-003`) en thema 5's
device-/screenreadertests horen niet hier, ook al raken ze dezelfde schermen.

## Wat hierboven (bewust) niet is ingetrokken

- `07`'s twee resterende niet-bouwbare headline-typen (speleridentiteit bij
  "enige correct" voor een ándere speler, antwoordtijd voor "snelste
  speler") — daar vond het herzoek geen tegenbewijs, blijven een echte
  `HANDOFF` aan INT-A (`UI-16`, `HANDOFF-UI.md`).
- `02`'s keuze om `lobby.mjs`'s eigen QR/code-ingang te verwijderen (niet te
  laten bestaan naast de nieuwe permanente header) — dat is al uitgevoerd,
  geen open punt meer (zie `../PROGRESS.md` S05).
