# Voortgang — PRODUCT.md realisatie

Bijgewerkt: 2026-08-02. Zie [`README.md`](README.md) voor het volledige plan en
[`prompts/`](prompts/) voor de uitvoerbare prompt per fase. Dit bestand is de
checklist — bijwerken bij elke fase-afronding, niet alleen aan het eind.

Legenda: ✅ Klaar — 🟡 Deels — 🔒 Bevestigd uitgesteld (productbesluit, geen
openstaande vraag meer) — ⬜ Nog niet gestart — **Gerealiseerd elders**/**n.v.t.
voor PD** met reden.

**Bijgewerkt na `docs/multiplayer/DECISIONS.md` en
[`prompts/PD-RESUME-AFTER-DECISIONS.md`](prompts/PD-RESUME-AFTER-DECISIONS.md)
(uitgevoerd 2026-08-02):** wat hieronder eerder "⏸️ On hold, wacht op mens" heette
is nu "🔒 Bevestigd uitgesteld" — de producteigenaar heeft niet alsnog Golf 2/
Groepsbattle vrijgegeven, maar wél expliciet bevestigd dat dit voor nu bewust
geen implementatieopdracht is (DECISIONS.md #31, #34), geen losse vraag meer die
op antwoord wacht. Zie ook `docs/PROGRESS.md` voor het overkoepelende, repo-brede
beeld na de besluitronde.

## Per sectie in PRODUCT.md

| § | PD-fase | Status | Toelichting |
| --- | --- | --- | --- |
| Harde productregels | PD1 | ✅ Klaar | `hard-rules.mjs`, 3/3 tests, volledige brontekst |
| Visie in één zin | — | **n.v.t. voor PD** | Beschrijvende tekst, geen toetsbaar artefact nodig |
| Kernmoment | — | **n.v.t. voor PD** | Beschrijvende context, geen artefact nodig |
| Rollen (Host / Speler) | — | **Gerealiseerd elders** | Session/Player-vorm is `DATA-MODEL.md` (`database_schema`); host/join-UI-state is `GAME-FLOW.md` (`host-setup-state.mjs`, `join-state.mjs`) |
| Primaire toegang: QR en link | — | **Gerealiseerd elders** | inviteId/QR-mechaniek is `ARCHITECTURE.md` + `GAME-FLOW.md` (`share-actions.mjs`) |
| MVP-scope — verplicht (starten/joinen, spelen, delen, talen) | — | **Gerealiseerd elders** | Checklist wordt vervuld door de features zelf (vooral `GAME-FLOW.md`); PD toetst dit pas indirect via PD5 |
| Spelvormen in multiplayer (Golf 1/Golf 2) | PD3 | 🔒 Bevestigd uitgesteld | DECISIONS.md #34: "Voor Golf 2 is geen nieuw besluit genomen. Canonieke IDs en feature-gates blijven uitgesteld." Geen code bouwen, geen ID's verzinnen (PD-RESUME, opdracht 2) |
| Juridische productgrens voor logo's | PD3 | 🔒 Bevestigd uitgesteld | Zelfde besluit; de brede beleidslezing (3 spelvormen onder de flag, niet 1) staat inhoudelijk vast maar wordt niet gecodeerd zolang PD3 niet gebouwd wordt |
| Nadrukkelijk niet in de MVP | PD1 | ✅ Klaar | `mvp-scope-guard.mjs`, 13/13 tests, 12 items met volledige brontekst + `isExplicitlyExcluded()` |
| Latere uitbreidingen — niet launch-blocking | PD4 | ✅ Klaar | `later-extensions-registry.mjs`, 8/8 tests, 8 items met volledige brontekst + `qualifies`-links naar `spectator_screen_required` en `payments_or_premium` |
| Standaard quick-start preset | PD2 | 🔒 Bevestigd uitgesteld | DECISIONS.md #31: Groepsbattle wordt nu niet verder gebouwd — `GROUP_BATTLE_DEFAULT_GAME_TYPES` blijft staan als onschadelijk artefact (PD-RESUME, opdracht 3: niet verder integreren, niet zonder aparte opdracht verwijderen), maar is geen actieve implementatieopdracht meer. DECISIONS.md #35 bevestigt wél een nieuw, ander quick-start-default (`flags_mc`-only) — dat is aan wie de daadwerkelijke quick-start-flow bouwt (game-flow-plan), niet aan PD |
| Succescriteria MVP | PD5 | ✅ Klaar | `acceptance-criteria.mjs`, 8/8 tests, 9 items met volledige brontekst + statussnapshot (1× `built`, 2× `not_started`, 6× `partial`) |
| Interfacevoorstel naar DATA-MODEL.md / PROTOCOL.md | PD6 | ✅ Klaar | [`data-model-and-protocol-interface-proposal.md`](data-model-and-protocol-interface-proposal.md); feature-gate-deel expliciet nog open (⏸️, wacht op PD3) |

## Openstaande actiepunten

**Scopebesluit 2026-08-02 (DECISIONS.md, bevestigd door producteigenaar):**
Groepsbattle wordt nu niet verder gebouwd (#31); mixed games niet (#32); teams en
spectators blijven latere uitbreidingen (#33); voor Golf 2 is geen nieuw besluit
genomen, canonieke ID's en feature-gates blijven uitgesteld (#34); de
quick-start-kernflow blijft wél bestaan, met een nieuw `flags_mc`-only default
(#35). `PD-RESUME-AFTER-DECISIONS.md` is uitgevoerd: geen PD3-code gebouwd, geen
Golf-2-ID's verzonnen, het bestaande Groepsbattle-artefact niet verder
geïntegreerd en niet verwijderd, scope-guards gecontroleerd op ongewenste
"huidig vereist"-claims (geen gevonden — `grep` op team/spectator/Golf 2/
Groepsbattle in `shared/product/*.mjs` bevestigt dat alles al correct als
uitsluiting/latere-uitbreiding stond), tests gedraaid (35/35 groen, geen
inconsistenties).

- [x] PD3 blijft uitgesteld — dit is nu een **bevestigd, blijvend scopebesluit**
      (DECISIONS.md #34), geen openstaande cross-agent-vraag meer die op
      antwoord wacht. Heropen alleen na een nieuw, expliciet Golf-2-besluit.
- [ ] `DATA-MODEL.md`'s voorbeeldconfiguratie corrigeren (toont nog 5 spelvormen,
      incl. `capitals_mc`, i.p.v. de eerder bevestigde 4) — nu een kleine,
      niet-urgente documentatie-inconsistentie sinds Groepsbattle zelf is
      uitgesteld (#31); nog steeds niet mijn bestand om te wijzigen.
- [x] PD4 (`later-extensions-registry`) schrijven en uitvoeren — 8/8 tests groen.
- [x] PD5 (`acceptance-criteria`-traceability) schrijven — 8/8 tests groen.
- [x] PD6 (interfacevoorstel) schrijven —
      [`data-model-and-protocol-interface-proposal.md`](data-model-and-protocol-interface-proposal.md),
      niet-bindend; het feature-gate-deel blijft net als PD3 zelf bevestigd
      uitgesteld, geen openstaande vraag.
- [x] `PD-RESUME-AFTER-DECISIONS.md` uitgevoerd (deze bijwerking).
- [ ] Geen verdere PD-code gepland zolang DECISIONS.md #31/#34 gelden. Dit plan
      heropent pas bij een nieuw, expliciet productbesluit over Golf 2 of
      Groepsbattle — niet uit eigen beweging.

## Cijfers

- **PD0–PD1:** gebouwd en geverifieerd, 16/16 tests groen.
- **PD2:** gedeeltelijk, nu bevestigd uitgesteld (DECISIONS.md #31) — 3 tests
  groen (`quick-start-preset.test.mjs`); artefact blijft onaangeroerd staan, geen
  verdere integratie gepland.
- **PD3:** bevestigd uitgesteld, geen code — DECISIONS.md #34: geen nieuw
  Golf-2-besluit, blijft dicht totdat dat verandert.
- **PD4:** gebouwd en geverifieerd, 8/8 tests groen (`later-extensions-registry.test.mjs`).
- **PD5:** gebouwd en geverifieerd, 8/8 tests groen (`acceptance-criteria.test.mjs`).
- **PD6:** afgerond — geen code, één niet-bindend voorstelsdocument
  (`data-model-and-protocol-interface-proposal.md`); geen `shared/product/`-bestand
  gewijzigd of toegevoegd, dus de testtelling hieronder blijft ongewijzigd.
- **`shared/product/` totaal:** 35/35 tests groen (27 bestaand + 8 nieuw uit PD5, niet 36 —
  9 criteria maar 8 testgevallen, zelf nageteld via de testrunner-output, niet blind
  overgenomen)
  (`node --test shared/product/hard-rules.test.mjs shared/product/mvp-scope-guard.test.mjs shared/product/quick-start-preset.test.mjs shared/product/later-extensions-registry.test.mjs shared/product/acceptance-criteria.test.mjs`).
