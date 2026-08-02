# E2E/Load target-check — bestaat het bewijsdoel voor Playwright en k6?

**Datum van controle:** 2 augustus 2026
**Aanleiding:** [`prompts/DT-R4-playwright-k6-target-check.md`](prompts/DT-R4-playwright-k6-target-check.md),
opdracht 3 uit [`DT-RESUME-AFTER-DECISIONS.md`](prompts/DT-RESUME-AFTER-DECISIONS.md)
("voeg Playwright- en loadtesttooling toe wanneer hun concrete targets bestaan").
**Scope van deze controle:** alleen de vraag of de twee technische prerequisites nu
bestaan — niet de toestemmingsvraag. Die is al gegeven in
[`docs/multiplayer/DECISIONS.md`](../multiplayer/DECISIONS.md) §Uitvoeringsakkoord en
wordt hier niet opnieuw gesteld.

Dit bestand is het persistente overdrachtsartefact dat DT-R5 leest. Geen van de
bevindingen hieronder is uitgevoerd als actie (geen `npm install`, geen
`package.json`-wijziging, geen nieuw bestand onder `tests/e2e/` of `tests/load/`) —
dat is expliciet buiten scope van deze controle.

---

## Verdict Playwright: target bestaat niet

DT4a's scenario's vereisen een **geïntegreerde, gerenderde multiplayer-UI** —
een HTML-entrypoint of route-koppeling die `client/flow/`'s modules
(`route-resolver.mjs`, `join-state.mjs`, `match-phase-state.mjs`, enz.) daadwerkelijk
aan de DOM koppelt. Die bestaat niet.

**Bewijs:**

- Alle vier HTML-bestanden in de repo zijn geïnventariseerd: `index.html`,
  `preview-shapes.html`, `provinces-preview.html`, `preview-provinces.html`. Geen
  daarvan bevat een `<script type="module">`-tag of enige andere koppeling naar
  `client/flow/`. `index.html` is aantoonbaar de bestaande **singleplayer**-app
  (menu met Vlaggen/Logo's/Hoofdsteden/Geo/Voetbal-quiz, `screen-menu` /
  `screen-game` / `screen-results`, geladen via `app.js` + `data/*.js`) — geen
  room/lobby/join/host-scherm, geen multiplayer-route.
- `src/screens/` en `src/components/` bestaan als mappen maar zijn **leeg** (geen
  bestanden).
- `client/flow/README.md` bevestigt dit zelf expliciet, regel 46-48: *"Wiring these
  modules into the actual browser app (`<script type="module">`) or a real
  transport layer is a later, separate step; see
  `docs/game-flow-plan/GF-PROGRESS.md` for what's done and what's still open."*
- Een repo-brede zoekactie naar `client/flow`-referenties buiten `client/flow/`
  zelf levert alleen twee treffers op, beide documentatiestrings in
  `shared/product/acceptance-criteria.mjs` die verwijzen naar testaantallen
  (bijv. `'game-flow-plan GF1 — client/flow/route-resolver.mjs (33 tests, dekt
  /j/{inviteId})'`) — geen import, geen DOM-koppeling.
- `DT-PROGRESS.md` (regel 40, 60-62) noteerde dezelfde conclusie al eerder: *"DT4a
  Deel 1: … elk met een eigen implementatieprerequisite (geïntegreerde UI bestaat
  nog niet) — 0/6 uitvoerbaar, ook ná een `deps`-akkoord voor Playwright alleen."*
  Deze controle (2 aug 2026) bevestigt met verse evidence dat dat nog steeds klopt:
  er is sinds die eerdere audit geen HTML-entrypoint of route-koppeling voor
  multiplayer bijgekomen.

**Conclusie:** de eerdere blokkade **geldt nog steeds** op 2 augustus 2026. Er
verandert niets aan DT4a: Deel 1 (pseudocode-scenario's) blijft de huidige stand;
Deel 2 (echte `.spec.ts`-bestanden) blijft geblokkeerd op de ontbrekende
gerenderde multiplayer-UI, los van het feit dat het generieke `deps`-akkoord er al
is.

---

## Verdict k6: target bestaat niet

DT5's evidence-matrix wijst criteria toe aan k6 die een **draaiende,
spelbelastbare server** vereisen — echte `/api/v1/games`-afhandeling en echte
Socket.IO-events, niet `501 NOT_IMPLEMENTED`. Die server bestaat niet.

**Bewijs:**

- `server/index.mjs` (69 regels) is nog steeds letterlijk het placeholder-proces
  dat het eigen bovenschrift zo benoemt: *"FASE 1-PLACEHOLDER, bewust
  dependency-vrij (node:http). Dit is NIET de game-server uit ARCHITECTURE.md."*
  Het enige import is `node:http`. De routing:
  - `/healthz` → `200`
  - `/readyz` → `503` (`"placeholder: game-server (AR5/AR6) nog niet gebouwd"`)
  - `/api/v1/time` → `200 { serverTime }`
  - elke andere `/api/*` of `/socket.io/*` → `501 { code: 'NOT_IMPLEMENTED' }`
  - al het overige → `404 { code: 'GAME_NOT_FOUND' }`

  Dit is identiek aan de placeholder-beschrijving in de opdracht (§DT-R1) — geen
  regressie, maar ook geen vooruitgang.
- `package.json` bevat inmiddels wél `fastify`, `socket.io`, `redis` en `pg` als
  dependencies (toegevoegd in commit `376bd4e chore(deps): fastify, socket.io,
  redis en pg met lockfile`). Dat is een aanwezige *dependency*, geen aanwezige
  *implementatie*: een repo-brede zoekactie naar `fastify(`/`new Server(`
  (Socket.IO) / `createServer(`/`.listen(` binnen `server/**/*.mjs` (exclusief
  tests) levert alleen `server/index.mjs` zelf op — geen enkel ander bestand
  bootstrapt een Fastify- of Socket.IO-server.
- `server/protocol/`, `server/rules/`, `server/data/`, `server/architecture/` en
  `server/composition/` bevatten uitgebreide, goed geteste **losse** logica-modules
  (routing van client-events, error-codes, scoring, room-codes, sessietokens,
  contextbedrading, enz.) — maar `server/composition/context.mjs` is expliciet
  "LIJM, GEEN DOMEINLOGICA" die modules aan elkaar knoopt zónder zelf een
  HTTP-/Socket.IO-server op te zetten. Er is geen bestand dat deze modules aan een
  luisterende Fastify/Socket.IO-instance hangt.
  `npm start` (`"start": "node server/index.mjs"`) start nog steeds alleen de
  placeholder.
- `DT-PROGRESS.md` (regel 39, 65-67) noteerde dit patroon al: *"DT3b: 0/14
  geactiveerd — elke rij vereist een server-implementatie die nog niet bestaat"*
  en *"DT5 — 0/10 criteria gemeten. Wacht op loadtooling, een draaiende server,
  observability, een geschikte omgeving, een providercheck (L2/L3) én een apart
  uitvoeringsakkoord."* Deze controle (2 aug 2026) bevestigt met verse evidence
  dat dat nog steeds klopt.

**Conclusie:** de eerdere blokkade **geldt nog steeds** op 2 augustus 2026. Er
verandert niets aan DT5: Deel 1 (evidence-matrix) blijft de huidige stand; Deel 2
(k6-scripts) en Deel 3 (uitvoering) blijven geblokkeerd op de ontbrekende
spelbelastbare server, los van het feit dat het generieke `deps`-akkoord er al is.

---

## Wat als de targets wél bestaan — vervolgstappen (niet nu uitgevoerd)

Onderstaand is uitsluitend een beschrijving van toekomstig werk. Geen van beide
targets bestaat op dit moment (zie hierboven), dus geen van deze stappen wordt in
deze controle uitgevoerd — geen `npm install`, geen `package.json`-wijziging.

- **Playwright (zodra de multiplayer-UI gerenderd en geïntegreerd is):** voer
  DT4a Deel 2 uit —
  [`prompts/DT4a-playwright-e2e.md`](prompts/DT4a-playwright-e2e.md) §Deel 2:
  Playwright toevoegen aan `package.json` (eerste keer dat deze repo een
  frontend-testdependency krijgt — expliciet vermelden, het raakt de hele repo),
  daarna elk scenario uit `e2e-playwright-scenarios.md` omzetten naar een echt
  `tests/e2e/*.spec.ts`-bestand tegen een lokaal gestarte dev-server, en de suite
  daadwerkelijk groen draaien (`npx playwright test`) vóór het als klaar te
  melden. Het generieke `deps`-akkoord hiervoor staat al in
  `docs/multiplayer/DECISIONS.md` §Uitvoeringsakkoord; er is geen nieuwe
  mensgoedkeuring nodig om dit te starten, wél een eigen, aparte uitvoering.
- **k6 (zodra de game-server echte `/api/v1/games` en Socket.IO-events
  afhandelt):** voer DT5 Deel 2 uit —
  [`prompts/DT5-loadtests.md`](prompts/DT5-loadtests.md) §Deel 2: voor elke rij in
  `load-evidence-matrix.md` waar k6 als runner staat, een script in
  `tests/load/` met de p95/foutthreshold uit §Slagingscriteria L1 als assertie in
  het script zelf. Scripts *schrijven* mag zodra de server-prerequisite klopt;
  ze **uitvoeren** blijft Deel 3, met een eigen, apart akkoord (production-achtige
  belasting, óók lokaal/LAN, valt onder `prod` in CLAUDE.md §Beslisbevoegdheid).

## Harde grenzen gerespecteerd in deze controle

- Geen `npm install` uitgevoerd, geen wijziging aan `package.json`.
- Geen nieuw bestand onder `tests/e2e/` of `tests/load/` — beide mappen bevatten
  nog steeds alleen `.gitkeep` en hun bestaande `README.md`.
- Precies één nieuw bestand toegevoegd: dit bestand.
