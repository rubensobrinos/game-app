# Voortgang — GAME-FLOW.md realisatie

Bijgewerkt: 2026-08-02. Zie [`README.md`](README.md) voor het volledige plan en
[`prompts/`](prompts/) voor de uitvoerbare prompt per fase. Dit bestand is de
checklist — bijwerken bij elke fase-afronding, niet alleen aan het eind.

## Per sectie in GAME-FLOW.md

| § | Status | Fase / toelichting |
| --- | --- | --- |
| Routes | ✅ Klaar | GF1 — 33 tests |
| Hostflow (Snel starten / instellen) | ✅ Klaar | GF2b |
| Joinflow + Naamgedrag | ✅ Klaar | GF2a, herzien met een echte pre-join-previewstap (DECISIONS.md #7) |
| QR- en deelgedrag | ✅ Klaar | GF6 |
| Randgeval 1 — host disconnect | ✅ Klaar | GF4 + GF5 |
| Randgeval 2 — speler reconnect | ✅ Klaar | reconnect-logica (GF4) + lokaal bewaren van het sessietoken (GF9) |
| Randgeval 3 — late join | ✅ Klaar | GF5 |
| Randgevallen 4, 5 — naam | ⚪ N.v.t. | bewust geen melding nodig, server lost dit stil op |
| Randgeval 6 — niemand antwoordt | ✅ Klaar | pauzemelding (GF5) + hostkeuze Doorgaan/Beëindigen via `host-controls-state` (GF10) |
| Randgeval 7 — te laat antwoord | ✅ Klaar | GF5 |
| Randgeval 8 — room vol | ✅ Klaar | GF5 |
| Randgeval 9 — ongeldige invite | ✅ Klaar | GF5 |
| Randgeval 10 — kick | ✅ Klaar | GF5 |
| Randgeval 11 — vrijwillig verlaten | ✅ Klaar | GF11 |
| Randgeval 12 — rematch | ✅ Klaar | GF3 |
| Randgeval 13 — TTL verlopen | ✅ Klaar | GF5, zelfde pad als randgeval 9 |
| Randgeval 14 — serverherstart | ✅ Klaar | via GF3 + GF4 |
| Spelscherm (wat een speler ziet) | 🟡 Deels | data aanwezig; UI-samenstelling bewust buiten dit plan |
| Hostbediening (pauze/volgende/vergrendel/kick/beëindig/rematch) | ✅ Klaar | GF10 |
| `session-store` | ✅ Klaar | GF9 |
| Teams | ⚪ Vervallen voor deze MVP | DECISIONS.md #8/#33 — GF7 niet uitgevoerd, blijft ontwerpschets |
| Spectatorroute | ⚪ Vervallen voor deze MVP | DECISIONS.md #9/#33 — GF7 niet uitgevoerd, blijft ontwerpschets |
| Groepsvlag/badge | ⚪ Bewust buiten scope | PRODUCT.md: expliciete latere uitbreiding |
| Groepsbattle-preset / mixed games | ⚪ Vervallen voor deze MVP | DECISIONS.md #31/#32 — host-setup-state default is nu enkelvoudig (`flags_mc`) |
| Interfacevoorstel naar PROTOCOL.md | ✅ Beantwoord | GF8 → [`protocol-interface-proposal.md`](protocol-interface-proposal.md); antwoorden vastgelegd in `docs/multiplayer/DECISIONS.md` |

## Openstaande actiepunten

- [x] GF9 `session-store` bouwen — 10/10 tests groen, geverifieerd.
- [x] GF10 `host-controls-state` bouwen — 18/18 tests groen, geverifieerd.
- [x] GF11 `leave-state` bouwen — 16/16 tests groen, geverifieerd.
- [x] GF8 bijstellen per `prompts/REVIEW-GF7-GF8.md` (joinvolgorde-hoofdvraag,
      team-identifier, serverbevestiging/idempotentie, spectator-auth, gesplitste
      snapshot-/`game:paused`-vraag, GF7-onafhankelijkheid).
- [x] GF8 uitvoeren — `docs/game-flow-plan/protocol-interface-proposal.md` staat er,
      alle 10 secties, vraag 1 (joinvolgorde) vóór vraag 2/3, niets zelf beantwoord.
- [x] Antwoorden van de producteigenaar ontvangen en centraal vastgelegd in
      `docs/multiplayer/DECISIONS.md`.
- [x] GF7 gesloten zonder uitvoering: teams en spectators vallen buiten de huidige
      bouwscope. De prompt blijft alleen historisch ontwerpvoorstel.
- [x] `GF-RESUME-AFTER-DECISIONS.md` uitgevoerd (2 aug 2026):
      - `join-state` herzien met een echte `previewing`-fase (DECISIONS.md #7).
      - `edge-case-messaging` uitgebreid met de vier bevestigde pauzeredenen
        (`host`, `host_disconnected`, `no_answers`, `server_recovery`).
      - `host-controls-state` teruggebracht naar één hostactie per ronde
        (`'next'` alleen nog vanuit `SCOREBOARD`).
      - `host-setup-state`'s default losgekoppeld van de vervallen
        Groepsbattle-preset (nu enkelvoudig `flags_mc`, per DECISIONS.md #35).
      - `share-actions` uitgebreid met `shareOpenedMethodFor` (DECISIONS.md #18).
      - `leave-state`/`session-store`/rematchgedrag gecontroleerd tegen
        DECISIONS.md #4/#5 — geen wijziging nodig, al consistent.
      - Alle 10 prompt-bestanden bijgewerkt zodat ze de gebouwde code weer
        weerspiegelen.
- [x] Handoff naar INT-A voor UI-aansluiting (stap 2) — zie
      `GF-HANDOFF-TO-INT-A.md`.
- [x] `join-state.mjs` gecorrigeerd: `GET /api/v1/games/preview` bleek in het
      inmiddels uitgeschreven `PROTOCOL.md` invite-only (geen `gameCode`-
      variant). Mijn eerdere aanname (symmetrische preview voor beide
      locatortypes) was geschreven vóórdat die sectie bestond. Een
      code-locator slaat `previewing` nu over en gaat direct naar
      `name-entry`. Gevonden tijdens het opzetten van UI1 (frontend-plan),
      vóórdat er tegen de oude aanname gebouwd werd. 231/231 tests blijven
      groen. Zie `prompts/GF2a-join-state.md`.

## Bekende, niet-zelf-op-te-lossen gaten

- `shared/product/quick-start-preset.mjs`'s `GROUP_BATTLE_DEFAULT_GAME_TYPES` (4
  spelvormen) is stale per DECISIONS.md #31 — niet meer geïmporteerd door
  `host-setup-state.mjs`, maar het bestand zelf is niet aangepast (eigendom van
  product-plan, niet van dit plan). Zie `GF-HANDOFF-TO-INT-A.md`.
- `preset: 'default'` in `host-setup-state.mjs` is een placeholder-waarde —
  DECISIONS.md #31 schrapt de oude preset-id maar noemt geen vervanger.

## Cijfers

- **GF0–GF6 + GF9–GF11:** gebouwd en geverifieerd, **231/231 tests groen** in
  `client/flow/` (10 modules).
- **GF7:** vervallen voor de huidige MVP — teams en spectators worden niet gebouwd.
- **GF8:** beantwoord; de bindende keuzes staan in
  `docs/multiplayer/DECISIONS.md`.
- Alle opdrachten uit `prompts/GF-RESUME-AFTER-DECISIONS.md` zijn verwerkt. Geen
  bekende blockers meer binnen `client/flow/` — klaar voor INT-A's UI-aansluiting.
