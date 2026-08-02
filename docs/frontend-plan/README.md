# Realisatieplan — UI1: multiplayer-frontend

Dit is het uitvoeringsplan voor `frontend/`, toegewezen in
[`prompts/UI1-multiplayer-ui.md`](prompts/UI1-multiplayer-ui.md). Nieuw domein,
prefix `UI`. Dit document zet die opdracht om in kleinere, uitvoerbare stappen en
verandert er verder niets aan.

Zie [`UI-PROGRESS.md`](UI-PROGRESS.md) voor de voortgang per scherm en
[`HANDOFF-UI.md`](HANDOFF-UI.md) voor
contractvragen aan andere eigenaren.

## Uitgangspunten

1. **Dunne laag, geen dubbele state-logica.** Alle flow-state komt uit
   `client/flow/` (10 geteste reducers — zie
   [`docs/game-flow-plan/GF-HANDOFF-TO-INT-A.md`](../game-flow-plan/GF-HANDOFF-TO-INT-A.md)
   voor het volledige overzicht). Deze modules worden geïmporteerd, niet
   opnieuw geschreven. Een gat in die logica wordt een genummerd item in
   `HANDOFF-UI.md`, niet stilzwijgend hier opgelost.
2. **Transportlaag komt van INT-A.** Geen eigen fetch/Socket.IO-logica die
   afwijkt van zijn geïmplementeerde eindpunten. Zolang die er nog niet is,
   wordt tegen een **gemockte transportlaag** gebouwd die exact hetzelfde
   interface aanbiedt (zie `UI0`) — dezelfde discipline als `client/flow/` tegen
   `PROTOCOL.md` toepaste vóórdat er een server was.
3. **Vanilla JS, ES-modules, geen build-stap, geen framework** — consistent met
   de rest van de repo. Mobile-first (portrait), grote tap-targets, bruikbaar op
   een gemiddelde telefoon over 4G.
4. **Veiligheid:** nooit `innerHTML` voor gebruikersinput (namen) — altijd
   `textContent`. Timers renderen op `startsAt`/`endsAt` + gemeten
   serveroffset (`GET /api/v1/time`), nooit een eigen seconde-tick op
   clienttijd.
5. **Pure helpers apart en getest.** Formattering, i18n-lookup en
   timerberekening als eigen `.mjs`-bestanden met `node --test`. Schermgedrag
   (DOM, event-wiring) wordt handmatig geverifieerd tegen een (echte of
   gemockte) server en genoteerd in `UI-PROGRESS.md` — dat is de enige manier
   waarop een scherm ✅ wordt.
6. **Autonomie:** uitsluitend `frontend/`, kleine commits, nooit `git add -A`.

## Schermen en hun ondersteunende modules

| Scherm | client/flow-reducer(s) | Overig |
| --- | --- | --- |
| Home (Snel starten / code) | `host-setup-state`, `route-resolver` | `shared/product/flags-mc-quick-start-default.mjs` |
| Preview + join | `join-state` | `GET /api/v1/games/preview` (invite-only, `PROTOCOL.md`) |
| Lobby + Delen | `share-actions`, `host-controls-state` (start) | lokale QR-generator (vendor, MIT) |
| Spelscherm flags_mc | `match-phase-state`, `reconnect-state` | `shared/content` (landnamen), `flags/{iso2}.png` |
| Tussenstand + Eindpodium | `match-phase-state` | — |
| Hostbalk | `host-controls-state` | inklapbaar, overlay op spelscherm |
| Foutmeldingen/pauze (UI1b) | `edge-case-messaging` | i18n |
| Verlaten (UI1b) | `leave-state` | bevestigingsdialoog |

## Fasering

### UI0 — Scaffold
`frontend/`-mapstructuur, `index.html`-shell, basis-CSS, een lichte
viewswitcher die op `route-resolver`/`match-phase-state` reageert, i18n-loader
(NL leidend, patroon van de singleplayer-app), servertijd-offset-helper, en het
**transport-interfacecontract** dat alle latere UI-fases gebruiken (zie
`prompts/UI0-scaffold.md`). Geen enkel scherm inhoudelijk gevuld.

### UI1 — Home + Preview/Join
Schermen 1–2 uit UI1a. `host-setup-state` → room aanmaken; `join-state` →
preview + join, inclusief het invite-only-previewpad.

### UI2 — Lobby + Delen
Scherm 3. QR-generatie (vendor), live deelnemerslijst, hostknop Start via
`host-controls-state`.

### UI3 — Spelscherm flags_mc
Scherm 4. Vlag tonen, vier opties, timer-helper, antwoordbevestiging,
antwoordvoortgang, ronde-uitslag.

### UI4 — Tussenstand + Eindpodium
Scherm 5.

### UI5 — Hostbalk
Scherm 6, overlay op UI3/UI4.

### UI1b — Pilot A-afwerking (later, geen prompt nu)
Foutmeldingen, pauzeschermen per reden, verlaten-met-bevestiging, overige
Golf 1-spelvormen zodra de keten ze aankan, EN/ES-vertalingen, landscape-gedrag.

**Buiten scope (DECISIONS.md #8/#9/#31–34):** teams, spectators, groepsvlag,
Golf 2, logospellen, accounts, betalingen.

## Definition of done UI1a

Twee browsertabs (en daarna twee telefoons op het LAN) spelen een volledige
match van Snel starten tot rematch, zonder dat iemand uitleg nodig heeft.
