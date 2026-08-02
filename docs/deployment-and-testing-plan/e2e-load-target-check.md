# E2E/Load target-check — bestaat het bewijsdoel voor Playwright en k6?

**Aanleiding:** [`prompts/DT-R4-playwright-k6-target-check.md`](prompts/DT-R4-playwright-k6-target-check.md),
opdracht 3 uit [`DT-RESUME-AFTER-DECISIONS.md`](prompts/DT-RESUME-AFTER-DECISIONS.md)
("voeg Playwright- en loadtesttooling toe wanneer hun concrete targets bestaan").
**Scope van deze controle:** alleen de vraag of de twee technische prerequisites nu
bestaan — niet de toestemmingsvraag. Die is al gegeven in
[`docs/multiplayer/DECISIONS.md`](../multiplayer/DECISIONS.md) §"Uitvoeringsakkoord
test- en deploymentwerk" en wordt hier niet opnieuw gesteld.

Dit bestand is het persistente overdrachtsartefact dat DT-R5 leest. Geen van de
bevindingen hieronder is uitgevoerd als actie (geen `npm install`, geen
`package.json`-wijziging, geen nieuw bestand onder `tests/e2e/` of `tests/load/`) —
dat is expliciet buiten scope van deze controle. Deze prompt is herbruikbaar en is
inmiddels twee keer gedraaid; onderstaand staan beide controles, nieuwste eerst.

## Triggercondities voor de volgende ronde (checklist, geen heraudit)

Vastgelegd 2026-08-02 zodat een volgende ronde kan afvinken in plaats van opnieuw
vanaf nul te moeten uitzoeken wát "een target" precies betekent.

**Playwright-target bestaat zodra ALLE drie waar zijn:**

- [ ] Een van `docs/frontend-plan`'s UI-fasen (UI0/UI1/…) heeft daadwerkelijk
      gerenderde schermen opgeleverd — niet alleen een mandaat/scaffold. Check:
      `find frontend -type f` levert meer op dan `.gitkeep`, én minstens één
      bestand daarin bevat een `<script type="module">` die `client/flow/`
      importeert.
- [ ] `server/index.mjs` serveert die `frontend/`-inhoud daadwerkelijk (dat deel
      bestaat al: `registerStaticRoutes()` — dit vinkje volgt automatisch zodra
      het vorige punt waar is, geen aparte actie nodig).
- [ ] De gerenderde UI kan minstens de joinflow tegen een draaiende server
      doorlopen (hoeft geen sockets te hebben — DT4a's scenario's 1/3/4 zijn
      REST-only bereikbaar; scenario's 2/5/6 hebben wél de socketlaag nodig).

**k6-target bestaat zodra BEIDE waar zijn:**

- [ ] `server/transport/socket.mjs` bestaat en `attachSocketsIfAvailable()`
      (`server/index.mjs`) koppelt hem daadwerkelijk (niet de huidige stille
      no-op bij een ontbrekend bestand — zie INT-3 in
      `docs/integration-plan/HANDOFF.md`, blokkeert dit).
- [ ] Een keten-test over écht verkeer (niet in-process, maar via een
      luisterende server) draait groen — bijv. `tests/integration/full-match.test.mjs`
      (per `INT-PROGRESS.md` stap 1b, nog te bouwen) uitgevoerd tegen `inject()`
      of een echte poort, niet tegen losse compositiefuncties.

**Wat dit checklist niet doet:** het geeft geen `deps`-akkoord — dat staat al vast
in `DECISIONS.md`. Het bepaalt alleen wanneer het zinvol is om Playwright/k6
daadwerkelijk toe te voegen, zodat die stap niet voortijdig gebeurt tegen een
target dat nog niet af is.

---

# Controle 2 augustus 2026 (nacht, tweede ronde) — k6-target compleet, Playwright nog niet

**Aanleiding:** herverificatie van de twee open blokkades uit de vorige controle
(hieronder), specifiek omdat de vorige controle zelf al voorspelde dat de
`startMatch`-regressie er "gezien de snelheid van deze repo mogelijk al bij de
volgende controle achterhaald is". Geen nieuwe DT-R4-agent, gewoon dezelfde twee
commando's opnieuw, zelf uitgevoerd.

## Verdict k6: target bestaat nu — beide vinkjes waar

- [x] **Punt 1 (attach)** — ongewijzigd waar, zie vorige controle.
- [x] **Punt 2 (keten-test over echt verkeer draait groen) — NU WAAR.**
      `node --test tests/integration/full-match-transport.test.mjs`:
      **6 pass / 0 fail** (was 2 pass / 4 fail). De `startMatch`-regressie in
      `server/composition/match-lifecycle.mjs`/`server/data/in-memory-store.js`
      die de vorige controle blokkeerde, is inmiddels door een andere,
      gelijktijdige sessie opgelost — dezelfde regressie die DT-R1's derde
      heraudit ook trof en die bij herverificatie daar ook al bleek opgelost
      (zie `integration-matrix.md`). Volledige testnamen die nu slagen: de
      hoofdketen (room → preview → twee joins → drie sockets → start → twee
      rondes → eindstand → rematch → nog een ronde), matrixrijen 11 en 13 over
      de wire, authenticatie over de wire, en de lekdetector op een uitgelokte
      `INVALID_PAUSE_STATE`.

**Conclusie:** het k6-target zoals de checklist het definieert **bestaat nu
volledig**. DT5 §Deel 2 (scripts schrijven in `tests/load/`) kan starten — het
generieke `deps`-akkoord staat al in `DECISIONS.md`; het **uitvoeren** van
loadtests (Deel 3) blijft `prod` en vereist een eigen, apart akkoord.

## Verdict Playwright: ongewijzigd — nog steeds 2 van 3

- [ ] **Punt 3 (joinflow tegen een draaiende server) — nog steeds NIET waar.**
      `frontend/js/app.mjs` regel 25 importeert nog steeds
      `createMockTransport` uit `./transport-mock.mjs`; geen enkele view
      importeert `./transport.mjs`. Ongewijzigd t.o.v. de vorige controle,
      opnieuw met een verse `grep` bevestigd.

**Conclusie:** Playwright-target bestaat nog niet; enige resterende blokkade is
de eenregelige import-swap in `app.mjs`, niet mijn module om te fixen.

## Harde grenzen gerespecteerd in deze controle

- Geen `npm install` uitgevoerd, geen wijziging aan `package.json`.
- Geen nieuw bestand onder `tests/e2e/` of `tests/load/`.
- Precies één bestand gewijzigd: dit bestand.
- De testsuite is uitsluitend uitgevoerd om de pass/fail-status vast te leggen,
  niet gewijzigd.

---

# Controle 2 augustus 2026 (nacht) — DT-R4-herhaling, eerste keer echte beweging

**Aanleiding:** [`prompts/DT-R4-playwright-k6-target-check.md`](prompts/DT-R4-playwright-k6-target-check.md)
opnieuw gedraaid. Sinds de avondcontrole hieronder is `frontend/` gevuld met een
substantiële UI (`index.html`, `css/base.css`, `js/app.mjs`, `js/transport.mjs`,
`js/transport-mock.mjs`, `js/views/{home,join,gameplay,scoreboard,podium}.mjs`,
e.a.) en bestaat `server/transport/socket.mjs`. Deze controle toetst dat concreet
tegen de Triggercondities-checklist hierboven, met levende code — niet op
bestandsnamen alleen. De repo bewoog letterlijk tijdens dit onderzoek: bij de
eerste `Read` van `frontend/js/transport.mjs` was dat bestand nog 62 regels en
een placeholder die synchroon gooide; enkele minuten later, nog steeds binnen
deze controle, was het 1019 regels en een volledige implementatie. `git status`
op het moment van schrijven toont `frontend/js/transport.mjs`,
`frontend/js/views/{home,join}.mjs`, `server/data/in-memory-store.js` en meer als
**ongecommitte wijzigingen van een andere, gelijktijdige sessie**. Onderstaande
bevindingen zijn een bestandsniveau-momentopname op dat tijdstip, met de exacte
bewijzen erbij; een volgende ronde kan zijn afgeschoven.

## Verdict Playwright: target bestaat nog niet — 2 van 3 vinkjes nu waar (nieuw)

Getoetst tegen de drie checklistpunten hierboven:

- [x] **Punt 1 (gerenderde UI, geen scaffold).** `frontend/index.html` bevat
      `<script type="module" src="/js/app.mjs">`. `frontend/js/app.mjs` importeert
      `../../client/flow/route-resolver.mjs` en
      `../../client/flow/share-actions.mjs`; `frontend/js/views/join.mjs`
      importeert `../../../client/flow/join-state.mjs`,
      `.../session-store.mjs` en `.../edge-case-messaging.mjs`. Dit zijn
      werkende Home- en Join-schermen (DOM-opbouw, formuliervalidatie via
      `join-state.mjs`'s reducer), geen scaffold-placeholder meer — dit vinkje
      is voor het eerst waar.
- [x] **Punt 2 (server serveert `frontend/`).** `server/index.mjs` bevat
      `registerStaticRoutes(fastify)` (regel 236-276) die `FRONTEND_ROOT =
      path.join(REPO_ROOT, 'frontend')` als root serveert, met een SPA-fallback
      naar `frontend/index.html` voor extensieloze paden (deep links als
      `/j/{inviteId}`). Wordt aangeroepen in `buildServer()` (regel 365). Volgt
      automatisch uit punt 1, zoals de checklist voorspelde — bevestigd.
- [ ] **Punt 3 (joinflow tegen een draaiende server) — NIET waar.**
      `frontend/js/app.mjs` regel 17 en 22:
      `import { createMockTransport } from './transport-mock.mjs';` /
      `const transport = createMockTransport();`. Geen enkele view importeert
      `./transport.mjs`; een repo-brede zoekactie naar consumenten van
      `createTransport` buiten `transport.mjs` zelf levert niets op. Dat is
      opmerkelijk, want `frontend/js/transport.mjs` bevat op dit moment (zie
      hierboven, nog ongecommitteerd) wél een volledige, echte implementatie
      (`createTransport({ baseUrl })`: REST via `fetch` tegen
      `/api/v1/games/*`, plus een eigen Engine.IO-/Socket.IO-v4-wireclient over
      de kale `WebSocket`, met reconnect-backoff en de
      snapshot-precedentiepoort). Die module bestaat dus, maar is **niet
      bedraad** in de gerenderde app: een Playwright-test die vandaag de
      join-flow door de UI heen aanstuurt, raakt uitsluitend de in-memory mock
      en spreekt de draaiende Fastify-server nooit aan.

**Conclusie:** vooruitgang t.o.v. de vorige twee controles (punt 1 en 2 zijn
voor het eerst waar), maar het target bestaat nog niet: punt 3 blokkeert, en de
blokkade is nu specifiek "de echte transportlaag is geschreven maar nog niet
aan `app.mjs` gekoppeld" — geen `deps`-vraag, gewoon een resterende
bedradingsstap die (gezien de snelheid van deze repo) mogelijk al bij de
volgende controle achterhaald is.

## Verdict k6: target bestaat nog niet — attach-vinkje nu waar, keten-test rood

Getoetst tegen de twee checklistpunten hierboven:

- [x] **Punt 1 (socket.mjs bestaat én wordt echt aangehaakt) — WAAR.**
      `server/transport/socket.mjs` bestaat (44.951 bytes) en exporteert
      `attachSocketServer(httpServer, { context, config })` (regel 223).
      `server/index.mjs`'s `attachSocketsIfAvailable()` (regel 297-311)
      importeert dat bestand dynamisch en geeft alleen bij een letterlijk
      ontbrekend bestand (`ERR_MODULE_NOT_FOUND`) `null` terug; elke andere
      fout wordt doorgegooid, en bij succes wordt `module.attachSocketServer(...)`
      echt aangeroepen. Operationeel bevestigd:
      `tests/integration/support/transport-harness.mjs` bouwt de server exact
      zoals `start()` in `server/index.mjs` (`readConfigFromEnvironment` →
      `buildServer` → `listen` → `attachSocketsIfAvailable`) en doet
      `assert.notEqual(attached, null, ...)`. Bij het uitvoeren van de
      bijbehorende testsuite slaagt de subtest "Authenticatie over de wire"
      (zie hieronder) — dat bewijst dat de socketlaag daadwerkelijk luistert en
      handshakes afhandelt, geen stille no-op.
- [ ] **Punt 2 (keten-test over echt verkeer draait groen) — NIET waar.**
      `tests/integration/full-match-transport.test.mjs` bestaat exact zoals de
      checklist vereist: echte HTTP (`fetch`) tegen een server gestart met
      `fastify.listen({ port: 0, ... })` (niet `inject()`) plus drie echte
      WebSocket-verbindingen met de Engine.IO/Socket.IO-handshake
      (`tests/integration/support/socket-io-test-client.mjs`). Uitgevoerd op
      het moment van deze controle (`node --test
      tests/integration/full-match-transport.test.mjs`):
      **2 pass / 4 fail** van de 6 tests. De falende asserties zijn geen
      auth-/attach-fouten (die subtest slaagt) maar `INVALID_PHASE`-acks en een
      timeout op het `game:started`-event zodra de test een match probeert te
      starten. Dezelfde onderliggende fout is reproduceerbaar in-process, dus
      losstaand van de socketlaag: `tests/integration/full-match.test.mjs`
      (de niet-transport-keten-test, "definition of done van stap 1") draait op
      hetzelfde moment **1 pass / 2 fail**, met
      `RangeError: setRoomAndMatchPhaseAtomically: pausedState moet null zijn
      buiten de fase "PAUSED" (newPhase was undefined)` vanuit
      `server/composition/match-lifecycle.mjs` → `startMatch` →
      `server/data/in-memory-store.js`. `git status` bevestigt dat
      `server/data/in-memory-store.js` op dit moment ongecommitte, actief
      gewijzigde code van een andere sessie bevat — dit lijkt een lopende
      regressie in de matchstart-/faseovergangslaag, niet een ontbrekende
      socketkoppeling.

**Conclusie:** ook hier voor het eerst echte structurele vooruitgang (punt 1,
het aanhaakpunt zelf, staat er en werkt aantoonbaar), maar het target bestaat
nog niet: de keten-test die punt 2 letterlijk vereist ("draait groen") is
vandaag rood, met een concrete, geïsoleerde oorzaak (een fasetransitie-bug in
`startMatch`/`in-memory-store.js`) die niets met k6 zelf te maken heeft maar wel
de checklist-eis blokkeert.

## Wat als de targets alsnog voor de volgende ronde beide waar worden

Ongewijzigd t.o.v. de secties hieronder — zodra `app.mjs` `createTransport()`
i.p.v. `createMockTransport()` gebruikt (Playwright punt 3) resp. de
`startMatch`-regressie is opgelost zodat `full-match-transport.test.mjs` volledig
groen draait (k6 punt 2), zijn beide targets compleet. Zie DT4a §Deel 2
(Playwright toevoegen aan `package.json`, dat is de eerste
frontend-testdependency van deze repo) en DT5 §Deel 2 (k6-scripts per rij in
`load-evidence-matrix.md`) voor de uitvoerbare vervolgstappen; het generieke
`deps`-akkoord staat al in `docs/multiplayer/DECISIONS.md` §Uitvoeringsakkoord,
er is geen nieuwe mensgoedkeuring nodig om die stap te starten — wél blijft de
daadwerkelijke `npm install` een eigen, aparte actie.

## Harde grenzen gerespecteerd in deze controle

- Geen `npm install` uitgevoerd, geen wijziging aan `package.json`.
- Geen nieuw bestand onder `tests/e2e/` of `tests/load/`.
- Precies één bestand gewijzigd: dit bestand (uitbreiding, geschiedenis van de
  eerdere controles behouden).
- De twee testsuites (`full-match-transport.test.mjs`, `full-match.test.mjs`)
  zijn uitsluitend uitgevoerd om hun huidige pass/fail-status als bewijs vast te
  leggen, niet gewijzigd.

---

# Controle 2 augustus 2026 (avond) — herbevestiging

**Aanleiding voor deze herhaalde run:** sinds de ochtendcontrole hieronder is commit
`cd3a9c1` ("docs(ui): UI1-mandaat + frontend/-map — nieuw domein voor de
multiplayer-schermen") geland, die een nieuwe `frontend/`-map en een UI-mandaat
introduceert. Dat riep de vraag op of dit een Playwright-target oplevert. Op het
moment van deze controle draaien er bovendien meerdere concurrente sessies direct
tegen `main`; de working tree bevatte tijdens het onderzoek al verder-bijgewerkte,
nog ongecommitte content (o.a. `docs/frontend-plan/UI-PROGRESS.md`,
`docs/frontend-plan/prompts/UI0-scaffold.md`,
`docs/frontend-plan/prompts/UI1-home-and-join.md` — de opvolgers van het
`UI1-multiplayer-ui.md`-mandaat uit `cd3a9c1` zelf). Onderstaande bevindingen zijn
op bestandsniveau geverifieerd op dat moment, niet aangenomen.

## Verdict Playwright: target bestaat nog steeds niet

`cd3a9c1` voegt alleen een **mandaat-document**
(`docs/frontend-plan/prompts/UI1-multiplayer-ui.md`, inmiddels alweer opgesplitst
in `UI0-scaffold.md`/`UI1-home-and-join.md` e.a.) en een lege map toe — geen
gerenderde UI.

**Bewijs:**

- `frontend/` bevat op dit moment uitsluitend `frontend/.gitkeep`:
  `find frontend -type f` levert precies één bestand op. `git log --oneline --all
  -- frontend/` levert precies één commit op (`cd3a9c1`, dat exact dat
  `.gitkeep`-bestand toevoegt) — geen enkele commit heeft ooit code in
  `frontend/` gezet.
- Geen van de vier HTML-bestanden in de repo-root
  (`index.html`, `preview-shapes.html`, `provinces-preview.html`,
  `preview-provinces.html`) bevat een `<script type="module">`-tag:
  `grep -l 'type="module"' *.html` levert niets op.
- `src/screens/` en `src/components/` bevatten nog steeds alleen `.gitkeep`.
- Het (ongecommitte, door een andere sessie geschreven) eigen voortgangsdocument
  `docs/frontend-plan/UI-PROGRESS.md` bevestigt dit onafhankelijk: alle schermen
  UI0–UI5 staan op 🔵 ("nog te doen"), met expliciet: *"Geen enkel scherm kan dus
  al ✅ (echte server) zijn; hoogstens 🟡 tegen de mock geverifieerd"* en de
  blocker *"INT-A's stap 2 (draaiende server/transportlaag) bestaat nog niet"*.
  Dit is corroborerend bewijs uit een andere, gelijktijdig actieve sessie — geen
  vervanging van de eigen bestandscontrole hierboven, die onafhankelijk tot
  dezelfde conclusie komt.

**Conclusie:** `cd3a9c1` is een **mandaat/planningscommit**, geen
implementatiecommit. De blokkade voor DT4a Deel 2 geldt onverkort: er is nog
steeds geen HTML-entrypoint of route-koppeling die `client/flow/` aan de DOM
knoopt.

## Verdict k6: target bestaat nog steeds niet

Los van de frontend-vraag opnieuw gecontroleerd of `server/composition/`
(`match-lifecycle.mjs`, `room-lifecycle.mjs`, `context.mjs`) inmiddels aan een
luisterende Fastify-/Socket.IO-server hangt.

**Bewijs:**

- `server/index.mjs` is ongewijzigd de `node:http`-placeholder: nog steeds
  hetzelfde opschrift *"FASE 1-PLACEHOLDER, bewust dependency-vrij (node:http).
  Dit is NIET de game-server uit ARCHITECTURE.md"*, en het enige `.listen(`-
  aanroep in `server/**/*.mjs` (buiten tests) staat op regel 62 van dat bestand,
  op de `http.createServer(...)`-instance uit regel 39 — geen Fastify, geen
  Socket.IO.
- Repo-brede zoekactie naar `createServer(`, `fastify(`, `new Server(` binnen
  `server/**/*.mjs` (exclusief tests) levert nog steeds alleen `server/index.mjs`
  zelf op.
- `server/composition/context.mjs` (het naadpunt tussen room-lifecycle en
  match-lifecycle) noemt zichzelf expliciet *"LIJM, GEEN DOMEINLOGICA"* en leest
  bewust geen `process.env` — het is er nadrukkelijk niet op ingericht zelf een
  server op te zetten. `grep -rl "composition/context"` vindt alleen
  `server/composition/context.mjs` zelf en de testharness
  `tests/integration/support/composition-harness.mjs` (in-process test-glue, geen
  netwerklaag) als importeurs.
- Er is sinds de vorige controle wél een nieuwe, nog **ongecommitte** map
  `server/data/adapters/redis/` bijgekomen (`connection.mjs`, `documents.mjs`,
  e.a.). Deze is uitdrukkelijk een opslagadapter, geen HTTP-/Socket.IO-laag: het
  bestand documenteert zelf *"GEEN POORTMETHODEN"* en leest expliciet geen
  `process.env` — dit verandert niets aan het k6-verdict.
- `tests/load/` bevat nog steeds alleen `.gitkeep` en `README.md`;
  `package.json` bevat nog geen `k6`- of `playwright`-vermelding
  (`grep -iE "playwright|k6" package.json` levert niets op) en is niet gewijzigd
  door deze controle.

**Conclusie:** de blokkade voor DT5 Deel 2/3 geldt onverkort. `npm start`
(`"start": "node server/index.mjs"`) start nog steeds alleen de placeholder.

## Wat als de targets wél bestaan — vervolgstappen (ongewijzigd, niet nu uitgevoerd)

Zie de sectie hieronder bij de vorige controle (2 augustus 2026, ochtend) — deze
blijft ongewijzigd van toepassing zodra een van beide targets alsnog ontstaat:
Playwright zodra `frontend/` een werkende, gerenderde multiplayer-UI bevat (zie
`docs/frontend-plan/UI-PROGRESS.md` voor de actuele stand van UI0–UI5), k6 zodra
`server/composition/` daadwerkelijk aan een luisterende Fastify-/Socket.IO-
instance hangt.

## Harde grenzen gerespecteerd in deze herhaalcontrole

- Geen `npm install` uitgevoerd, geen wijziging aan `package.json`.
- Geen nieuw bestand onder `tests/e2e/` of `tests/load/`.
- Precies één bestand gewijzigd: dit bestand (uitbreiding, geschiedenis van de
  vorige controle behouden).

---

# Controle 2 augustus 2026 (ochtend) — eerste run

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
