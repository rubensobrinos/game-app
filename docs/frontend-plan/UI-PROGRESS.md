# Voortgang — UI1 multiplayer-frontend

Bijgewerkt: 2026-08-02. Legenda (vast, uit `UI1-multiplayer-ui.md`):
✅ klaar (heeft tegen een echte server gedraaid) — 🟡 in uitvoering —
🔵 nog te doen — ⛔ geblokkeerd — ⏸️ bewust uitgesteld.

## Per scherm/onderdeel

| Onderdeel | Status | Toelichting |
| --- | --- | --- |
| UI0 — Scaffold + mock-transportlaag | 🟡 | **Onafhankelijke review: changes requested (2 aug 2026).** Browsercheck ondertussen wél gelukt (headless Chromium via Playwright, console leeg, placeholder zichtbaar) — dat deel van de 🟡-reden is vervallen. Blijft 🟡, niet ✅, om een andere reden: de review vond 6 echte bugs in `transport-mock.mjs` (idempotentie, late-join-eligibility, dubbele-locator-validatie, `CONTENT_VERSION`-duplicatie, niet-grafeem-bewuste naamafkap, nul tests op 908 regels) plus een echte bug in `server-time.mjs` (`secondsRemaining` gaf de verkeerde waarde vóór `startsAt`) en een terecht gesignaleerd gat in `view-switcher.mjs` (`PAUSED` → `'unknown'`). `server-time.mjs` en `view-switcher.mjs` zijn gefixed en opnieuw getest (37/37 resp. 14/14 groen). De `transport-mock.mjs`-fixes + volledige testsuite lopen nu via een agent. UI1 bouwt hier pas op zodra dat klaar en geverifieerd is. |
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
- [x] UI0 uitgevoerd: `frontend/`-structuur, `view-switcher.mjs` +
      `server-time.mjs` (`node --test` groen, 32/32), `transport.mjs`-contract
      (placeholder) en `transport-mock.mjs` (volledige in-memory fake,
      handmatig doorlopen: createGame→previewInvite→joinGame→volledige
      rondecyclus). Zie het uitvoeringsrapport voor twee expliciete
      aannames (view-switcher's `PAUSED`-fase, `secondsRemaining`'s
      `startsAt`-ondergrens) die UI0-scaffold.md niet dicteerde.
- [x] Browsercheck alsnog gedaan: headless Chromium (Playwright via npx, geen
      nieuwe repo-dependency) tegen `python3 -m http.server` op de repo-root —
      `index.html` laadt met een lege console en toont de i18n-placeholder.
- [x] Onafhankelijke review van UI0 verwerkt: `server-time.mjs` (`secondsRemaining`
      negeerde stilzwijgend `endsAt - now` vóór `startsAt`) en `view-switcher.mjs`
      (`PAUSED` toonde `'unknown'` i.p.v. de onderliggende view via
      `pausedState.previousPhase`) direct gefixed en hertest.
- [ ] `transport-mock.mjs`-fixes + `transport-mock.test.mjs` (agent bezig):
      idempotentie per `actionId`, late-join-eligibility afdwingen, exact-één-
      locator + `joinSource`-validatie bij join, `CONTENT_VERSION` importeren
      i.p.v. dupliceren, grafeem-bewuste naamafkap + `"Sanne 2"`-suffixvorm,
      volledige testsuite (create/preview/join, autorisatie, idempotentie,
      eligibility, lock/kick/leave, pause/resume, snapshotvorm, rematch).
- [ ] UI1–UI5 uitvoeren, elk handmatig geverifieerd tegen de mock (en later de
      echte server) — **niet vóór de transport-mock-fixes hierboven landen.**
- [x] UI-1 ingediend bij INT-A (`HANDOFF-UI.md`): bevestig het
      transport-interfacecontract vóórdat er verder tegen gebouwd wordt.
      **🔵 open, wacht op antwoord.**
- [x] UI-2 vastgelegd (`HANDOFF-UI.md`): pauze-overlay met reden bouwen,
      uiterlijk bij UI5. Routeringsgat zelf (`view-switcher`) is al gefixed.
- [x] UI-3 vastgelegd (`HANDOFF-UI.md`): hoe worden `client/flow/` en `shared/`
      daadwerkelijk aan de browser geserveerd, gegeven dat `ARCHITECTURE.md`'s
      routingtabel ze niet noemt en de huidige relatieve `../../`-imports boven
      een geïsoleerde `frontend/`-root uitkomen. Bewust nog geen `<base>`-tag
      of absolute paden in `index.html` toegevoegd zolang dit open staat.
- [ ] Afstemmen met INT-A over het echte aansluitpunt zodra stap 2 er is en
      UI-1 beantwoord is; mock-transportlaag vervangen (één import-wijziging
      in `frontend/js/app.mjs`, mits UI-1 akkoord is).
- [ ] Definition of done UI1a: twee browsertabs spelen een volledige match.
- [ ] **Herinnering voor UI2:** QR-vendorkeuze (bibliotheek, licentie,
      herkomst) expliciet melden zodra UI2 wordt uitgevoerd — niet alleen in
      de prompt laten staan.

## Bekende blockers

- INT-A's stap 2 (draaiende server/transportlaag) bestaat nog niet — schermen
  worden gebouwd en handmatig gecontroleerd tegen een gemockte transportlaag met
  hetzelfde interface (`frontend/js/transport.mjs`'s contract, zie
  `prompts/UI0-scaffold.md`). Geen enkel scherm kan dus al ✅ (echte server) zijn;
  hoogstens 🟡 tegen de mock geverifieerd.
