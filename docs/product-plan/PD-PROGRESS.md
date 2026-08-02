# Voortgang — PRODUCT.md realisatie

Bijgewerkt: 2026-08-02. Zie [`README.md`](README.md) voor het volledige plan en
[`prompts/`](prompts/) voor de uitvoerbare prompt per fase. Dit bestand is de
checklist — bijwerken bij elke fase-afronding, niet alleen aan het eind.

Legenda: ✅ Klaar — 🟡 Deels — ⏸️ On hold (geblokkeerd, wacht op cross-agent-
afstemming) — ⬜ Nog niet gestart — **Gerealiseerd elders**/**n.v.t. voor PD** met
reden.

## Per sectie in PRODUCT.md

| § | PD-fase | Status | Toelichting |
| --- | --- | --- | --- |
| Harde productregels | PD1 | ✅ Klaar | `hard-rules.mjs`, 3/3 tests, volledige brontekst |
| Visie in één zin | — | **n.v.t. voor PD** | Beschrijvende tekst, geen toetsbaar artefact nodig |
| Kernmoment | — | **n.v.t. voor PD** | Beschrijvende context, geen artefact nodig |
| Rollen (Host / Speler) | — | **Gerealiseerd elders** | Session/Player-vorm is `DATA-MODEL.md` (`database_schema`); host/join-UI-state is `GAME-FLOW.md` (`host-setup-state.mjs`, `join-state.mjs`) |
| Primaire toegang: QR en link | — | **Gerealiseerd elders** | inviteId/QR-mechaniek is `ARCHITECTURE.md` + `GAME-FLOW.md` (`share-actions.mjs`) |
| MVP-scope — verplicht (starten/joinen, spelen, delen, talen) | — | **Gerealiseerd elders** | Checklist wordt vervuld door de features zelf (vooral `GAME-FLOW.md`); PD toetst dit pas indirect via PD5 |
| Spelvormen in multiplayer (Golf 1/Golf 2) | PD3 | ⏸️ On hold | Beleidslezing correct bevonden in review, maar Golf-2-ID's en `golf2Enabled` zijn niet cross-agent afgestemd — gebruiker koos expliciet: wachten |
| Juridische productgrens voor logo's | PD3 | ⏸️ On hold | Zelfde fase/reden; de brede lezing (3 spelvormen onder de flag, niet 1) staat inhoudelijk al wel vast |
| Nadrukkelijk niet in de MVP | PD1 | ✅ Klaar | `mvp-scope-guard.mjs`, 13/13 tests, 12 items met volledige brontekst + `isExplicitlyExcluded()` |
| Latere uitbreidingen — niet launch-blocking | PD4 | ✅ Klaar | `later-extensions-registry.mjs`, 8/8 tests, 8 items met volledige brontekst + `qualifies`-links naar `spectator_screen_required` en `payments_or_premium` |
| Standaard quick-start preset | PD2 | 🟡 Deels | Alleen `GROUP_BATTLE_DEFAULT_GAME_TYPES` (4 spelvormen) gebouwd en gekoppeld aan `host-setup-state.mjs`; volledige preset (taal/moeilijkheid/tempo) bewust niet gebouwd — die rol vervult `host-setup-state.mjs` al |
| Succescriteria MVP | PD5 | ✅ Klaar | `acceptance-criteria.mjs`, 8/8 tests, 9 items met volledige brontekst + statussnapshot (1× `built`, 2× `not_started`, 6× `partial`) |
| Interfacevoorstel naar DATA-MODEL.md / PROTOCOL.md | PD6 | ✅ Klaar | [`data-model-and-protocol-interface-proposal.md`](data-model-and-protocol-interface-proposal.md); feature-gate-deel expliciet nog open (⏸️, wacht op PD3) |

## Openstaande actiepunten

- [ ] PD3 blijft geblokkeerd tot de canonieke Golf-2-ID's en de
      `golf2Enabled`-flagsemantiek zijn afgestemd met de eigenaren van
      `DATA-MODEL.md`, `PROTOCOL.md` en `GAME-RULES.md` — bevestigde
      gebruikersbeslissing, niet een aanname van mij.
- [ ] `DATA-MODEL.md`'s voorbeeldconfiguratie corrigeren (toont nog 5 spelvormen,
      incl. `capitals_mc`, i.p.v. de bevestigde 4). Niet mijn bestand — moet bij de
      `DATA-MODEL.md`-eigenaar worden neergelegd.
- [x] PD4 (`later-extensions-registry`) schrijven en uitvoeren — 8/8 tests groen.
- [x] PD5 (`acceptance-criteria`-traceability) schrijven — 8/8 tests groen.
- [x] PD6 (interfacevoorstel) schrijven —
      [`data-model-and-protocol-interface-proposal.md`](data-model-and-protocol-interface-proposal.md),
      niet-bindend, feature-gate-deel expliciet nog open tot PD3 ontgrendelt.
- [ ] Eventueel later: de volledige quick-start-preset (taal/moeilijkheid/tempo) alsnog
      in `shared/product/` bouwen, mocht `host-setup-state.mjs` ooit niet meer die rol
      vervullen. Nu bewust niet gedaan (gebruikersbeslissing).

## Cijfers

- **PD0–PD1:** gebouwd en geverifieerd, 16/16 tests groen.
- **PD2:** gedeeltelijk — 3 nieuwe tests groen (`quick-start-preset.test.mjs`) +
  `client/flow/host-setup-state.test.mjs` blijft ongewijzigd 32/32 groen (bewijst dat
  de koppeling geen gedrag heeft veranderd).
- **PD3:** geblokkeerd, geen code — gebruikersbeslissing: wachten.
- **PD4:** gebouwd en geverifieerd, 8/8 tests groen (`later-extensions-registry.test.mjs`).
- **PD5:** gebouwd en geverifieerd, 8/8 tests groen (`acceptance-criteria.test.mjs`).
- **PD6:** afgerond — geen code, één niet-bindend voorstelsdocument
  (`data-model-and-protocol-interface-proposal.md`); geen `shared/product/`-bestand
  gewijzigd of toegevoegd, dus de testtelling hieronder blijft ongewijzigd.
- **`shared/product/` totaal:** 35/35 tests groen (27 bestaand + 8 nieuw uit PD5, niet 36 —
  9 criteria maar 8 testgevallen, zelf nageteld via de testrunner-output, niet blind
  overgenomen)
  (`node --test shared/product/hard-rules.test.mjs shared/product/mvp-scope-guard.test.mjs shared/product/quick-start-preset.test.mjs shared/product/later-extensions-registry.test.mjs shared/product/acceptance-criteria.test.mjs`).
