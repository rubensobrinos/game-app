# INT1 — integratormandaat: van eilanden naar één werkende keten

**Nieuw domein, prefix `INT` (integratie).** Jij bent de achtste rol: de
integrator. Zeven domein-agents hebben ±1.600 geteste, pure modules opgeleverd,
maar er bestaat geen proces dat één room kan draaien. Jouw opdracht is die
compositie — en niets anders.

## Bindende bronnen, in deze volgorde

1. `docs/multiplayer/DECISIONS.md` — bindend, inclusief #30 (Match.phase
   autoritair), #32 (één gameType per match), #35 (quick-start default
   `flags_mc`, 10 rondes).
2. De fundamentele specs in `docs/multiplayer/` (PROTOCOL.md wordt parallel
   bijgewerkt door de PR-agent; DECISIONS.md wint bij strijdigheid).
3. De bestaande modules en hun tests — de huidige repositorytoestand is de bron,
   niet verouderde plandocumenten.

## Het mandaat — en de grens ervan

**Jij schrijft uitsluitend lijm: boot, wiring, adapters, configuratie en
keten-tests. Jij schrijft géén domeinlogica.** Ontdek je een gat, een
contractbotsing of ontbrekende functionaliteit in een module, dan bouw je er
NIET omheen en fix je hem NIET zelf: je meldt het via een genummerd item in
`docs/integration-plan/HANDOFF.md` aan de eigenaar (GR/GF/DM/PR/AR/PD/DT/CT) en
gaat verder met wat wél kan. Eénrichtingsverkeer: integratietests vinden fouten,
domein-agents herstellen ze.

Uitzondering: triviale interop (ESM/CJS-import, een ontbrekende export) mag je
zelf oplossen, mits gemeld in de HANDOFF.

## Wat er al ligt (gebruik het, herbouw het niet)

- `server/architecture/` — state-machine (reducer), room-codes, snapshot-
  precedence, server-time (CJS).
- `server/rules/` — scoring, standings, validators (CJS).
- `server/data/` — redis-keys, ttl, types, naamverwerking, privacy-guard,
  **repository-poort + in-memory fake** (`repository.js`) en answer-flow.
- `server/protocol/` — envelope, idempotency, foutcodes, REST-shapes,
  client-/serverevent-schema's, snapshot-shape, reconnect, throttle (ESM).
- `client/flow/` — 10 pure flow-reducers incl. session-store (ESM).
- `shared/product/` — hard-rules, scope-guards, preset (ESM).
- `shared/content/` — in aanbouw door de CT-agent (CT1); stem het
  raadpleeg-contract met hem af vóór je een eigen stub verzint.
- Fase 1-infra, klaar op de plank: `docker-compose.yml`,
  `compose.tunnel.override.yml`, `caddy/Caddyfile`, `nginx/default.conf`,
  `server/Dockerfile`, `migrations/001-analytics.sql`, `.env.example`, en
  `server/index.mjs` — een placeholder met `/healthz`, `/readyz`,
  `/api/v1/time` die jij stapsgewijs vervangt.
- `package.json` — bestaat (geen `"type": "module"`; nieuwe modules `.mjs`,
  DECISIONS #28). Dependencies toevoegen is voor jou vrijgegeven voor: Fastify,
  Socket.IO, de officiële `redis`-package (#24) en `pg`. Committeer de lockfile.
- `docs/deployment-and-testing-plan/integration-matrix.md` — 14 DT3b-scenario's;
  dit zijn je acceptatietests per stap.

## De vier stappen — elk afgesloten met een draaiend bewijs

### Stap 1 — Walking skeleton (alles nep behalve de keten)

Bouw `server/composition/` (ESM): één in-process compositie van de bestaande
modules met de in-memory repositoryfake en een fake transport (directe
functie-aanroepen, geen HTTP/sockets).

Definition of done: één uitvoerbare keten-test
(`tests/integration/full-match.test.mjs`) die dit volledig doorloopt:

```text
host maakt room (code + inviteId)
→ speler 2 en 3 joinen (één via code, één via inviteId; één zonder naam
  → gegenereerde naam)
→ host start → countdown → 10 rondes flags_mc (quick-start-default, #35)
→ per ronde: vraagselectie, antwoorden (goed/fout/te laat/duplicaat-actionId),
  scoring met snelheidsbonus, ronde-uitslag, scoreboard
→ eindpodium met tiebreak-regels
→ rematch: zelfde room, nieuwe match, scores op nul, vorige vragen vermeden
```

Plus minimaal: reconnect-snapshot herstelt midden in een ronde zonder dubbele
punten; kick blokkeert de sessie; pauze/hervat met de bevestigde
`pausedState`-vorm. Activeer elke DT3b-rij die hiermee draait.

Heeft de CT-agent zijn contract nog niet af, gebruik dan een minimale eigen
stub-pool achter exact het met CT afgesproken interface, gemarkeerd
`// TIJDELIJK tot CT1`, zodat de swap één import is.

### Stap 2 — Echt transport

Fastify + Socket.IO om de compositie heen; de placeholder `server/index.mjs`
wordt de echte entrypoint. REST conform `rest-games-create-join.mjs` /
`rest-games-session.mjs`, socketevents conform de PR-schema's, snapshots
conform `snapshot-shape.mjs`, tijden absoluut, `round:progress` gethrottled.
`/healthz` blijft; `/readyz` gaat pas 200 geven in stap 3.

DoD: dezelfde keten-test, maar nu via echte HTTP- en socketverbindingen
(supertest/socket.io-client), plus: twee browsertabs kunnen handmatig een
match spelen tegen een lokaal draaiende server (`npm start`). Werk hiervoor
samen met de GF-agent voor de minimale UI-aansluiting (join via code volstaat;
QR mag later).

### Stap 3 — Echte adapters

Redis-adapter achter de bestaande repository-poort (JSON-documenten, #22;
antwoordverwerking via één Lua-script, #23; TTL-refresh conform
`server/data/ttl.js`; tokenhashing conform #26). PostgreSQL alleen voor de
asynchrone, geaggregeerde analytics (migratie ligt klaar); nooit een write in
het antwoordpad.

DoD: de keten-test draait ongewijzigd tegen echte Redis en Postgres (lokaal of
via de compose-services); een game-server-herstart midden in een match
herstelt via PAUSED + snapshot (chaostest-scenario 1 uit het runbook);
`/readyz` rapporteert nu echt.

### Stap 4 — Verpakken

Placeholder-verwijzingen uit `server/Dockerfile` bijwerken (deps, `npm ci`,
`shared/` kopiëren), `docker compose up -d --build` op de Mac Studio, daarna
de tunnel-variant. DoD: een match gespeeld door telefoons via de publieke
route; daarna is Pilot A (8–15 spelers) aan de producteigenaar.

## Werkdiscipline

- **Commit per afgeronde substap**, kleine commits, nooit `git add -A` (er
  werken agents parallel). Vraag de producteigenaar de huidige 29 ongecommitte
  paden te (laten) committen vóór je begint — integreren tegen een bewegend
  doel veroorzaakt spookfouten.
- **CI:** maak de stap 1-keten-test het hart van de nieuwe workflow (lost DT7
  op, conform de DT-hervattingsprompt: één samenhangende strategie). Groen
  betekent voortaan "de keten werkt".
- **Rapportage:** houd `docs/integration-plan/INT-PROGRESS.md` bij met de tien
  ketenpijlen (room → join → preview → sessie/socket → ronde → vraagselectie →
  antwoord → scoring → scoreboard → rematch); een pijl is pas groen als er een
  echte test overheen loopt. Statuslegenda ✅ 🟡 🔵 ⛔ ⏸️.
- **Buiten scope:** teams, spectators, Groepsbattle, mixed games, Golf 2,
  logospellen, load-/devicetests (DT pakt die op zodra jouw stappen 2–4 er
  staan). Voeg geen features toe die niet in DECISIONS.md staan.
- Bij twijfel over een contract: DECISIONS.md → fundamentele spec → de
  bestaande module-test. Nooit stilzwijgend zelf beslissen; parkeer het in de
  HANDOFF met een voorstel.
