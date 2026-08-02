# Voortgang — UI1 multiplayer-frontend

Bijgewerkt: 2026-08-02. Legenda (vast, uit `UI1-multiplayer-ui.md`):
✅ klaar (heeft tegen een echte server gedraaid) — 🟡 in uitvoering —
🔵 nog te doen — ⛔ geblokkeerd — ⏸️ bewust uitgesteld.

## Per scherm/onderdeel

| Onderdeel | Status | Toelichting |
| --- | --- | --- |
| UI0 — Scaffold + mock-transportlaag | 🔵 | prompt klaar |
| UI1 — Home + Preview/Join | 🔵 | prompt klaar, wacht op UI0 |
| UI2 — Lobby + Delen | 🔵 | prompt klaar, wacht op UI0/UI1 |
| UI3 — Spelscherm flags_mc | 🔵 | prompt klaar, wacht op UI0–UI2 |
| UI4 — Tussenstand + Eindpodium | 🔵 | prompt klaar, wacht op UI3 |
| UI5 — Hostbalk | 🔵 | prompt klaar, wacht op UI3/UI4 |
| Live end-to-end, 2 browsertabs | ⛔ | vereist INT-A's stap 2 (echte transportlaag) |
| Live end-to-end, 2 telefoons LAN | ⛔ | idem, ná de tabs-test |
| UI1b (foutmeldingen, pauze, verlaten, EN/ES, landscape) | ⏸️ | bewust uitgesteld tot UI1a end-to-end speelt |

## Openstaande actiepunten

- [x] `docs/frontend-plan/` opgezet (README, UI-PROGRESS, prompts/README).
- [x] `client/flow/join-state.mjs` gecorrigeerd: preview is invite-only
      (`PROTOCOL.md`), geen symmetrische code-preview meer aangenomen — nodig
      vóór UI1 tegen de juiste contractvorm kan bouwen.
- [ ] UI0 uitvoeren: scaffold + mock-transportlaag.
- [ ] UI1–UI5 uitvoeren, elk handmatig geverifieerd tegen de mock (en later de
      echte server).
- [ ] Afstemmen met INT-A over het echte aansluitpunt zodra stap 2 er is
      (`docs/integration-plan/HANDOFF.md`); mock-transportlaag vervangen.
- [ ] Definition of done UI1a: twee browsertabs spelen een volledige match.

## Bekende blockers

- INT-A's stap 2 (draaiende server/transportlaag) bestaat nog niet — schermen
  worden gebouwd en handmatig gecontroleerd tegen een gemockte transportlaag met
  hetzelfde interface (`frontend/js/transport.mjs`'s contract, zie
  `prompts/UI0-scaffold.md`). Geen enkel scherm kan dus al ✅ (echte server) zijn;
  hoogstens 🟡 tegen de mock geverifieerd.
