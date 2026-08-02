# Prompt — UI2: Lobby + Delen

Onderdeel van [`../README.md`](../README.md), fase UI2. Vereist UI0 en UI1
(een sessie bestaat al tegen de tijd dat dit scherm toont). Bouwt scherm 3 van
UI1a.

## Brondocument

`GAME-FLOW.md` §Hoofdroute (lobby toont deelnemers live), §QR- en deelgedrag,
§Hostbediening (start). `PROTOCOL.md` `room:state`/`room:player-changed`
(server→client), `game:start` (client→server).

## Scherm 3 — Lobby

Bereikt op `/host/{code}` (host) of `/game/{code}` (speler) zodra
`match-phase-state`'s fase `LOBBY` is.

1. Bij binnenkomst: `transport.connect(sessionToken, onEvent)` als dat nog niet
   liep, en/of `transport.fetchState(code, sessionToken)` voor een verse
   snapshot. Voer elk binnenkomend event door `match-phase-state.applyServerEvent`
   vóór je iets anders doet met de fase.
2. **Deelnemerslijst.** `match-phase-state` bewaart bewust geen spelerscount of
   -lijst (zie `GF-HANDOFF-TO-INT-A.md`) — houd dat hier lokaal bij, gevuld uit
   `room:state`'s `room.playerCount` en (indien de snapshot een lijst bevat)
   uit `room:player-changed`. Toon namen altijd via `textContent`.
3. **`Delen`-actie**, exact de volgorde uit `share-actions.shareActionsFor(capabilities)`:
   - `show-qr`: schermvullende QR, gegenereerd uit `shareUrlsFor(joinUrl).qrUrl`
     met een lokale, gevendorde generator in `frontend/vendor/` (klein, MIT,
     zonder dependencies — bijvoorbeeld `qrcode-generator`
     (kazuhiko-arase, MIT); documenteer bron + licentie bovenaan het
     gevendorde bestand). Geen externe QR-dienst (`DEPLOYMENT-AND-TESTING.md`).
   - `native-share`: alleen tonen als `'share' in navigator`; geef
     `shareUrlsFor(joinUrl).copyUrl` mee.
   - `copy-link`: `navigator.clipboard.writeText(shareUrlsFor(joinUrl).copyUrl)`
     met een zichtbare fallback (tekst selecteerbaar) als de Clipboard API
     ontbreekt.
   - `show-code`: de zescijferige `gameCode`, als tekst.
   - Bij elke geopende actie: `share-actions.shareOpenedMethodFor(action)` →
     verstuur `share:opened` via de socket (mag falen zonder UX-effect,
     `PROTOCOL.md`).
4. **Hostknop Start** (alleen zichtbaar met `host`-rol in de sessie):
   `host-controls-state.availableHostActions(context)` bepaalt of `'start'`
   getoond wordt (`LOBBY` + minstens één speler). Bij een tik:
   `hostActionRequest('start', context)` → verstuur via de socket.

## Regels

- Geen eigen aanname over wélke velden een snapshot bevat buiten wat
  `PROTOCOL.md` toont — als iets ontbreekt dat dit scherm nodig heeft, is dat
  een `HANDOFF-UI.md`-item aan INT-A/PR, geen giswerk.
- QR/link/code zijn voor **alle** deelnemers identiek en geven alleen
  joinrechten (`GAME-FLOW.md`) — geen hostspecifieke variant genereren.
- Geen `innerHTML` voor spelersnamen.

## Definition of done

- Tegen `transport-mock.mjs`: lobby toont een groeiende deelnemerslijst als de
  mock een tweede "speler" simuleert, alle vier de deelacties zijn bruikbaar
  (QR zichtbaar, copy-link werkt, code zichtbaar; native-share degradeert
  netjes als `navigator.share` ontbreekt), en Start (als host) triggert de
  volgende fase in de mock.
- Het gevendorde QR-bestand vermeldt bron en licentie in de eerste regels.
- `UI-PROGRESS.md` bijgewerkt.
