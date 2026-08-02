# Voortgang — UI1 multiplayer-frontend

Bijgewerkt: 2026-08-02. Legenda (vast, uit `UI1-multiplayer-ui.md`):
✅ klaar (heeft tegen een echte server gedraaid) — 🟡 in uitvoering —
🔵 nog te doen — ⛔ geblokkeerd — ⏸️ bewust uitgesteld.

## Per scherm/onderdeel

| Onderdeel | Status | Toelichting |
| --- | --- | --- |
| UI0 — Scaffold + mock-transportlaag | 🟡 | Onafhankelijke review verwerkt: alle 6 gevonden bugs in `transport-mock.mjs` + de bugs in `server-time.mjs`/`view-switcher.mjs` zijn gefixed en (opnieuw) getest. **UI-1 en UI-3 zijn inmiddels ✅ beantwoord door INT-A** (`HANDOFF-UI.md`) — de vier contractcorrecties zijn verwerkt in `transport.mjs`/`transport-mock.mjs`, en `index.html` heeft nu `<base href="/">` + absolute paden. Blijft 🟡 i.p.v. ✅ om de enige overgebleven reden: er is nog geen echte server (INT-A's stap 2) om tegen te draaien — dat vereist de ✅-lat zelf, niet een openstaand contractpunt. |
| UI1 — Home + Preview/Join | 🟡 | `views/home.mjs` + `views/join.mjs` gebouwd, bedraad via `app.mjs` (`route-resolver` + `view-switcher`). Handmatig doorlopen in headless Chromium tegen `transport-mock.mjs`: Snel starten → `/host/{code}` in één tik; code-invoer → direct naamveld zonder previewaanroep, leeg naamveld geaccepteerd, join → `/game/{code}`; invite-URL → preview → vooringevulde suggestienaam → join → `/game/{code}`; ongeldige invite → foutmelding + retry. Geen consolefouten, geen `innerHTML` op de naamvelden (gegrept). Blijft 🟡, niet ✅: vereist nog een echte server. |
| UI2 — Lobby + Delen | 🔵 | prompt klaar, wacht op UI1 (nu klaar); QR-vendorkeuze al gedaan door CT/regie (`HANDOFF-UI.md` UI-4) |
| UI3 — Spelscherm flags_mc | 🟡 | pure view-modellaag al gebouwd en getest (`views/round-model.mjs`, `views/gameplay.mjs`, `views/country-names.mjs`); DOM-montage/scherm zelf nog niet gebouwd |
| UI4 — Tussenstand + Eindpodium | 🟡 | pure view-modellaag al gebouwd en getest (`views/standings-model.mjs`, `views/scoreboard.mjs`, `views/podium.mjs`); DOM-montage/scherm zelf nog niet gebouwd |
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
- [x] `transport-mock.mjs`-fixes + `transport-mock.test.mjs`: idempotentie per
      `actionId`, late-join-eligibility afdwingen, exact-één-locator +
      `joinSource`-validatie bij join, `CONTENT_VERSION` importeren i.p.v.
      dupliceren, grafeem-bewuste naamafkap + `"Sanne 2"`-suffixvorm,
      volledige testsuite. Onafhankelijk geverifieerd (diffs gelezen, niet
      alleen het rapport vertrouwd).
- [x] UI-1 ingediend bij en beantwoord door INT-A (`HANDOFF-UI.md`): **✅
      opgelost**, optie 2 (grotendeels akkoord, vier correcties). Alle vier
      verwerkt in `transport.mjs`/`transport-mock.mjs`
      (`createGame(request)`, `connect(sessionToken, {onEvent, onStatus})`,
      `send()` verwerpt bij `ok:false`, `actionId`-hergebruik bij retry).
      Testsuite groen (83/83 incl. `views/`).
- [x] UI-2 vastgelegd (`HANDOFF-UI.md`): pauze-overlay met reden bouwen,
      uiterlijk bij UI5. Routeringsgat zelf (`view-switcher`) is al gefixed.
      **🔵 blijft open tot UI5.**
- [x] UI-3 vastgelegd bij en beantwoord door INT-A (`HANDOFF-UI.md`): **✅
      opgelost**, route 1 (`/client/*` en `/shared/*` als statische mappings,
      INT-A's Fastify-entrypoint in stap 2). `index.html` heeft nu
      `<base href="/" />` + absolute paden.
- [x] Pure view-modellaag voor UI3/UI4 vooruit gebouwd en getest, los van de
      DOM-montage: `views/round-model.mjs`, `views/gameplay.mjs`,
      `views/country-names.mjs` (spelscherm), `views/standings-model.mjs`,
      `views/scoreboard.mjs`, `views/podium.mjs` (tussenstand/podium).
- [ ] Mock-transportlaag vervangen door de echte (`transport.mjs`) zodra
      INT-A's stap 2 bestaat — één import-wijziging in `frontend/js/app.mjs`,
      contract ligt al vast.
- [x] UI1 (Home + Preview/Join) gebouwd: `views/home.mjs` (Snel starten,
      code-invoer), `views/join.mjs` (preview/name-entry/submit/error,
      hergebruikt voor zowel invite- als code-locators), `app.mjs` bedraadt
      route → view. Routes `game`/`host` tonen bewust nog de UI0-placeholder
      zolang UI2's lobby niet bestaat — `view-switcher.viewFor()` valt daar
      zonder actieve fase terug op `'preview-join'`, wat na een net gelukte
      create/join geen locator heeft om op te tonen; de placeholder is dus
      correcter dan een tweede naamveld voorspiegelen. `node --test` groen.
- [ ] UI2 (Lobby + Delen), UI3/UI4 (DOM-montage bovenop de al bestaande
      view-modellen), UI5 (Hostbalk + pauze-overlay/UI-2) uitvoeren, elk
      handmatig geverifieerd tegen de mock (en later de echte server).
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
