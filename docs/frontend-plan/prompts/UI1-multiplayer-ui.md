# UI1 — multiplayer-frontend: de mobiele schermen (`frontend/`)

**Nieuw domein, prefix `UI`.** Jij bouwt wat de speler straks in handen heeft:
de mobiele multiplayer-schermen. Dit was werkpakket 3 uit de projectoverdracht
en het laatste onderdeel op het kritieke pad zonder eigenaar. Alle logica
bestaat al — jouw werk is de schermlaag die haar zichtbaar maakt.

## Jouw map — en de grens

**Jij werkt uitsluitend in `frontend/`.** Blijf af van: de singleplayer-app in
de repo-root (`index.html`, `app.js`, `style.css` — die blijft ongewijzigd
werken), `client/flow/` (GF-agent), `server/**` (integrators/domein-agents),
`shared/**` (CT/PD — jij importeert, wijzigt niet). Gaten of contractvragen
meld je als genummerd item in `docs/frontend-plan/HANDOFF-UI.md` aan de
eigenaar; je bouwt er niet omheen.

## Bindende bronnen, in volgorde

1. `docs/multiplayer/DECISIONS.md` — bindend. Voor jou vooral: #7 (pre-join-
   preview met naamsuggestie), #10/#11 (pausedState + vier pauzeredenen met
   generieke fallback), #16 (1-based roundNumber), #18 (deelmethoden
   qr|link|native|code), #35 (quick-start default: flags_mc, 10 rondes).
2. `docs/multiplayer/PRODUCT.md` — de drie harde productregels staan boven
   alles: binnen seconden starten/joinen zonder account; altijd een zichtbare
   naam (invullen optioneel); alles werkt volledig op één telefoon, een
   centraal scherm is nooit vereist.
3. `docs/multiplayer/GAME-FLOW.md` — routes (`/`, `/j/{inviteId}`,
   `/game/{code}`, `/host/{code}`), het spelscherm-lijstje (wat een speler
   ziet), hostbediening, randgevallen.
4. `docs/multiplayer/PROTOCOL.md` — het wire-contract; de transportlaag zelf
   krijg je van INT-A (stap 2), bouw ertegen, niet eraan.

## Wat er al ligt — importeren, niet herbouwen

- `client/flow/` — ALLE schermlogica als pure, geteste reducers: route-resolver,
  join-state (incl. preview), host-setup-state, match-phase-state,
  host-controls-state, reconnect-state, session-store, share-actions,
  leave-state, edge-case-messaging. **Jouw schermen zijn een dunne laag op deze
  reducers; dupliceer géén state-logica.** Vragen/gaten → HANDOFF aan GF.
- `shared/product/` — `FLAGS_MC_QUICK_START_DEFAULT` en de scope-guards.
- `shared/content/` — `getCountryPool()` voor landnamen per `iso2` (3 talen);
  vlag-assets blijven `flags/{iso2}.png`.
- Vertalingen NL/EN/ES bestaan in de singleplayer; herbruik het patroon, NL is
  leidend voor de eerste versie.

## Technische kaders

- **Vanilla JavaScript, ES-modules, geen build-stap, geen framework** —
  consistent met de rest van de repo. Mobile-first (portrait), grote
  tap-targets, werkt op een gemiddelde telefoon over 4G.
- **Nooit `innerHTML` voor gebruikersinput** (namen!) — altijd `textContent`
  (PROTOCOL.md, inputveiligheid).
- Timers renderen op `startsAt`/`endsAt` + gemeten serveroffset
  (`GET /api/v1/time`) — nooit een eigen aftelklok op clienttijd
  (ARCHITECTURE.md, principe 2).
- QR-code lokaal in de browser genereren (DEPLOYMENT-AND-TESTING.md: geen
  externe QR-dienst). Eén kleine gevendorde MIT-gelicenseerde QR-generator in
  `frontend/vendor/` is hiervoor vrijgegeven door de producteigenaar —
  documenteer herkomst en licentie in het bestand zelf.
- Reconnect: toon de niet-blokkerende status uit `reconnect-state`; na
  reconnect is de snapshot leidend.

## Opdrachten, in volgorde

### UI1a — de slice (samen met INT-A's stap 2)

Precies genoeg schermen om de keten met echte mensen te spelen, getest in twee
browsertabs tegen INT-A's lokale server:

1. **Home** — `Snel starten` (één tik → room via #35-default) en code-invoer.
2. **Preview + join** — naamveld met servergegenereerde suggestie vooringevuld;
   leeg laten mag altijd (harde regel 2).
3. **Lobby** — deelnemerslijst live, `Delen`-actie (QR schermvullend,
   kopieerbare link, code als fallback), hostknop Start.
4. **Spelscherm flags_mc** — vlag, vier opties, timer, antwoordbevestiging
   ("ontvangen"-status, geen goed/fout vóór `round:ended`),
   antwoordvoortgang (x/y), ronde-uitslag met eigen punten.
5. **Tussenstand** — top 5 + eigen positie. **Eindpodium** + rematch-knop.
6. **Hostbalk** — inklapbaar: start, pauze/hervat, lock, speler verwijderen,
   beëindigen, rematch; een meespelende host houdt een rustig antwoordscherm.

Afstemming met INT-A over het aansluitpunt (socket-client, snapshotophaal) via
`docs/integration-plan/HANDOFF.md` — zijn transportlaag is jouw enige
datapad; geen eigen fetch-logica naast de zijne.

### UI1b — af richting Pilot A

Late-join- en foutmeldingen (room vol, ongeldige invite, vergrendeld — teksten
via `edge-case-messaging`), pauzeschermen per reden, verlaten-met-bevestiging,
de overige Golf 1-spelvormen zodra de keten ze aankan, EN/ES-vertalingen,
landscape-gedrag.

**Buiten scope:** teams, spectators (`/screen/`), groepsvlag, Golf 2,
logospellen, accounts, betalingen — zie DECISIONS.md #8/9/31–34.

## Werkdiscipline

- Kleine commits, alleen je eigen paden stagen, nooit `git add -A`.
- `docs/frontend-plan/UI-PROGRESS.md` bijhouden per scherm met de vaste
  legenda (✅ 🟡 🔵 ⛔ ⏸️); een scherm is pas ✅ als het tegen een echte
  server heeft gedraaid.
- Pure helpers (formatteren, i18n-lookup, timerberekening) als `.mjs` met
  `node --test`-tests; schermgedrag verifieer je handmatig tegen INT-A's
  server en noteer je in PROGRESS.
- Definition of done UI1a: twee browsertabs (en daarna twee telefoons op het
  LAN) spelen een volledige match van Snel starten tot rematch, zonder dat
  iemand uitleg nodig heeft.
