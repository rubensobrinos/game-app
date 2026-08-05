# 5 — `session-shell.mjs` opsplitsen (1169 regels)

**Geen gedragsverandering.**

## Waarom

Eén export, 32 functies. Dit is de spil van de voorkant: hij ontvangt élk
serverevent en beslist welk scherm wat doet. Elke nieuwe clientklus moet hier
langs, en dus kan er maar één tegelijk in.

## Wat je opsplitst

Er zitten drie duidelijk verschillende taken in één bestand:

| Nieuw bestand | Wat erin hoort |
| --- | --- |
| `session/events.mjs` | de grote `handleEvent`-schakelaar: `room:state`, `round:started`, `round:ended`, `scoreboard:updated`, … |
| `session/verbinding.mjs` | `handleStatus`, `scheduleReconnectFallback`, `cancelReconnectFallback`, `showRecoveredMessage` — verbinding kwijt, herstel, de melding erover |
| `session/hostbalk.mjs` | `buildHostContext`, `renderHostBar`, `plaatsHostmenu`, `ruimHostmenuOp`, `restoreHostBarPosition` |
| `session/overlays.mjs` | `renderBanner`, `renderPauseOverlay` |

Wat overblijft in `session-shell.mjs` is het samenstellen: de views maken, de
transport aansluiten, en opruimen bij `destroy()`.

## Let op

**De eventschakelaar is een contract.** Elke `case` hoort bij een event uit
`docs/multiplayer/PROTOCOL.md`. Verplaats ze letterlijk; verzin geen
samenvoegingen ("deze twee doen bijna hetzelfde"), want de verschillen zitten
vaak in één regel die er om een reden staat.

**`destroy()` moet alles blijven opruimen.** Deze shell sluit sockets en
timers af; blijft er één hangen, dan tikt er een oude ronde door in een nieuwe
partij. Controleer dat elk stuk dat je verplaatst zijn eigen opruiming
meeneemt.

## Hoe je oplevert

`npm test` groen, plus in een browser: een solopartij van begin tot eind
(lobby → spel → uitslag → podium), en tussendoor één keer verversen.

## Niet doen

- Views aanpassen (`views/*.mjs`) — dat is andermans werk.
- Eventafhandeling samenvoegen of "vereenvoudigen".
- `client/flow/` aanraken: dat is de gedeelde laag met de server.

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/refactor/5-session-shell.md` en voer dat uit: `frontend/js/session-shell.mjs` opsplitsen, zonder gedragsverandering. De eventschakelaar is een contract met `docs/multiplayer/PROTOCOL.md` — verplaats de cases letterlijk, voeg niets samen. Controleer dat `destroy()` alles blijft opruimen. Naast `npm test`: speel in een browser een solopartij van lobby tot podium en ververs één keer tussendoor. Blijf uit `frontend/js/views/` en `client/flow/`. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
