# Status-audit — waar loopt het spaak, wat moet gerealiseerd worden

**Datum:** 2 augustus 2026, ± 12:00
**Auteur:** onafhankelijke doorlichting (Cowork-sessie Mac Studio)
**Scope:** hele repo, alle zeven planlijnen, testsuite live gedraaid

> Let op: er werkten tijdens deze audit agents live in de repo (bestanden in
> `server/architecture/` zijn tijdens de doorlichting gewijzigd). Cijfers zijn
> een momentopname.

---

## 1. Geverifieerde stand

- **Testsuite:** 1.151 tests, **1.149 groen, 2 rood** (`node --test`, alle
  `.test.js`/`.test.mjs`). De eerdere "608 groen"-analyse is dus al ingehaald —
  het volume is bijna verdubbeld, maar het aantal *geïntegreerde* regels code is
  nog steeds **nul**.
- Verdeling (indicatief): architecture ±426, protocol ±417, client/flow ±217,
  rules ±94, data ±66, product ±35, fixtures 7.
- **Geen `package.json`, geen server-entrypoint, geen `docker-compose.yml`, geen
  Caddyfile.** Van de vijf doelcontainers bestaan er nul. Er is geen proces dat
  ook maar één room kan aanmaken.

De kernconclusie van de eerdere agent-analyse blijft dus staan en is sterker
geworden: **de eilanden groeien, het systeem niet.**

## 2. Waar het spaak loopt — acht bevindingen

### 2.1 ROOD: twee falende tests in `server/architecture/room-codes`

Beide zijn een **contractbotsing tussen module-agent en test-agent**, precies het
integratierisico waarvoor gewaarschuwd was:

1. *"isTaken wordt gerespecteerd"* — de test wijst 10 kandidaten af, maar de
   module heeft `DEFAULT_MAX_CODE_ATTEMPTS = 10` en werpt dan terecht
   `CODE_SPACE_EXHAUSTED`. De test moet ofwel `maxAttempts` meegeven, ofwel het
   default-budget moet omhoog. Keuze nodig, daarna 5 min werk.
2. *"hashInviteId is deterministisch"* — de test voert `'x'.repeat(4)` (4 tekens)
   in, maar de module valideert bewust op ≥ 16 base64url-tekens (96-bits-eis uit
   ARCHITECTURE.md) en werpt TypeError. De module heeft gelijk; de test toetst
   een ander contract.

Bestanden zijn minuten vóór deze audit nog gewijzigd: dit is een botsing tussen
twee parallel werkende agents, niet oud zeer.

### 2.2 ROOD: vrijwel al het werk is **niet gecommit** en er ligt een `index.lock`

`git status`: **54 paden** modified/untracked, waaronder complete mappen
`client/`, `shared/`, `server/rules/`, het merendeel van `server/protocol/` en
vijf van de zeven planmappen. De laatste commit dekt slechts een fractie van wat
er staat. Bovendien ligt er een lege **`.git/index.lock`** — een crashende of
racende git-operatie. PR-PROGRESS meldt al een eerdere commit-race (PR3-modules
"meegelift" in een commit van de DT-agent).

Risico: één verkeerde agent-actie of schijfprobleem en dagen werk zijn weg, en
niets van dit werk is reviewbaar via `git log`.

### 2.3 ROOD: CI is kapot en devkit-profiel klopt niet

`.github/workflows/ci.yml` draait `npm ci` en `npx jest` — er is geen
`package.json` en er wordt geen Jest gebruikt (`node --test`). Elke push faalt
dus per definitie. DT7 heeft hiervoor een voorstel met drie opties klaarliggen;
**de keuze wacht op een mens.** Verwant: `CLAUDE.md`/`.devkit.yaml` claimen nog
steeds `react-native-app` (TypeScript/Expo) met bijbehorende lege
`src/`-`android/`-`ios/`-scaffolds. Beide bestanden zijn devkit-managed
(hash-gepind), dus dit vergt een devkit-profielwissel, geen handmatige edit.

### 2.4 GEEL: source-of-truth-drift in de vier fundamentele documenten

- **Mix vs. single-game-type:** de beslissing is genomen (GR4: één `gameType`
  per match, "mixgames geschrapt op instructie"), maar `PRODUCT.md` r.133,
  `GAME-FLOW.md` r.58 en `GAME-RULES.md` r.71 beschrijven mix nog als MVP-optie.
  Ook de Groepsbattle-preset (`gameTypes` = lijst van 4) is met single-game-type
  onderbepaald: welke van de vier wordt de match?
- **4-vs-5 preset:** beslist (4, zonder `capitals_mc`), gebouwd in
  `shared/product/quick-start-preset.mjs`, maar `DATA-MODEL.md` toont nog 5.
- **inviteId-voorbeeld:** `DATA-MODEL.md` toont `"N4x7pQm2K8tW"` (12 tekens ≈ 72
  bits); de gebouwde module eist ≥ 16 tekens (96 bits). Dit voorbeeld is
  letterlijk de oorzaak van falende test 2.

Niemand is eigenaar van de zeven bron-documenten zelf; elke plan-agent zegt
terecht "niet mijn bestand". **De specs hebben een redacteur nodig.**

### 2.5 GEEL: progressbestanden lopen achter op de werkelijkheid (beide kanten op)

- `AR-PROGRESS.md` zegt over AR2/AR3/AR4 "prompt ontbreekt / geen code" — maar
  `room-codes.js`, `snapshot-precedence.js` én `server-time.js` staan er met
  volledige testsuites (vanochtend gebouwd).
- `GR-PROGRESS.md` markeert GR3 ✅ maar herhaalt in dezelfde regel de oude
  blokkade "correctAnswer-vorm geblokkeerd op protocol-team", terwijl
  DM-HANDOFF die vorm al bevestigt.

De eerder voorgestelde vaste statuslegenda (✅ 🟡 🔵 ⛔ ⏸️) is in DM en DT al
ingevoerd, in AR en GR nog niet.

### 2.6 GEEL: de gedeelde contentmodule heeft nog steeds geen eigenaar

`ARCHITECTURE.md` §6 eist één versieerbare contentmodule (landen, pools,
aliassen, `contentVersion`). AR-PROGRESS wijst naar GAME-RULES ("ik consumeer
alleen"), GR4 verwacht een "genormaliseerde pool" en een seed-deterministische
nepvlaggenerator **die niet bestaan**. In `shared/` staat alleen `product/`.
Ondertussen zit alle echte content in `app.js` (108 KB browser-globals) en
`data/`. Dit is werkpakket 1 uit de overdracht, launch-kritiek, en niemand bouwt
eraan.

### 2.7 GEEL: alles convergeert naar één ontbrekende rol — de integrator

De afhankelijkheidsketens eindigen momenteel allemaal in een wachtstand:

- AR5 (server-skeleton) → wacht op **deps-akkoord** (Fastify/Socket.IO — "altijd
  vragen aan een mens");
- PR8a (auth/tokens) → ADR-plichtig, wacht op mens;
- DT3b (integratietests): 0/14 activeerbaar → wacht op server-implementatie;
- DT4a (E2E): 0/6 → wacht op geïntegreerde UI;
- GF: 7 protocolvragen open → wachten op mens;
- PD3 (Golf-2/feature-flag) → wacht op mens;
- DM: alle 9 prompts geschreven → wachten op review/go.

Zeven plan-agents produceren elk keurig binnen hun eigen domein, maar **niemand
heeft het mandaat om te componeren**, en de menselijke beslissingen die de
compositie deblokkeren stapelen zich op. Dat is de echte flessenhals — niet
capaciteit, maar besluitvorming + een ontbrekende achtste rol.

### 2.8 KLEIN: ESM/CJS-mix

CommonJS: `server/rules`, `server/data`, `server/architecture` (`.js`).
ESM: `server/protocol`, `client/flow`, `shared/product` (`.mjs`). Werkt los
prima; de server-skeleton moet één lijn kiezen. Advies: **alles ESM** — de
client is al ESM en de contentmodule moet in browser én Node draaien. Vastleggen
in de `package.json` die er toch moet komen (`"type": "module"`).

---

## 3. Wat moet gerealiseerd worden — kritieke pad naar de verticale slice

Doel onveranderd: **één room, één spelvorm (`flags_mc`), twee telefoons, tien
rondes, eindpodium** — dwars door alle lagen heen. Volgorde:

| # | Actie | Wie | Blokkeert |
| --- | --- | --- | --- |
| 0 | `index.lock` opruimen; al het staande werk committen (desnoods in 3–4 thematische commits) | mens/agent op de Mac zelf | alles |
| 1 | **Beslisronde Ruben** (zie §4): deps, CI-optie, single-game-type, auth-richting | Ruben | AR5, PR8b, DT7, docredactie |
| 2 | Specredactie: mix→single in 4 docs, preset 5→4, inviteId-voorbeeld 12→22 tekens; één eigenaar voor `docs/multiplayer/` benoemen | 1 agent, klein | GR4, DM2b |
| 3 | 2 rode tests fixen conform gekozen contract | AR-agent | groene basis |
| 4 | `package.json` + `"type": "module"` + `node --test`-script; CI-optie doorvoeren | integrator | CI groen |
| 5 | **Contentmodule** (`shared/content/`): extractie uit `app.js`/`data/` — voor de slice alléén landen+vlagpool NL, `contentVersion` | nieuwe eigenaar (werkpakket 1) | GR4, AR5 |
| 6 | DM2–DM7: entiteiten, in-memory repository-fake, atomische answer-flow (prompts liggen klaar) | DM-agent | AR5, DT3b |
| 7 | GR4 beperkt tot `flags_mc`-vraagselectie tegen de echte contentmodule | GR-agent | AR5 |
| 8 | **AR5/AR6: server-skeleton dat componeert** — REST create/join, sockets, state machine, scoring, snapshots; fase 0-modus: in-memory i.p.v. Redis (mag expliciet van het Schaalpad) | integrator | de slice |
| 9 | Minimale client-integratie: bestaande flow-reducers aan echte sockets knopen; join via code volstaat (QR mag later) | GF/client-agent | de slice |
| 10 | PR7-contracttests + DT3b-rijen activeren die de slice raakt; daarna pas breder | PR/DT-agents | pilot A |

Nadrukkelijk **niet** nu: teams (GF7), spectator, groepsvlag, Golf 2, logo's,
Redis-productie-setup, Compose/Caddy/tunnel, loadtests L1+. Alles daarvan is
post-slice.

## 4. Beslispunten die alleen Ruben kan nemen (de wachtrij leegmaken)

1. **Dependencies-akkoord:** Fastify + Socket.IO (+ later Redis-client) — ja/nee.
   Zonder dit start AR5 niet.
2. **CI:** kies één van de drie DT7-opties (advies: `node --test`-workflow die de
   devkit-`ci.yml` vervangt of overschaduwt, plus devkit-profielwissel weg van
   react-native).
3. **Single-game-type bekrachtigen** als tijdelijke MVP-regel én akkoord dat de
   vier fundamentele docs daarop worden geredigeerd (met "mix = post-slice"
   expliciet als latere uitbreiding).
4. **Auth-voorstel PR8a** (ligt klaar als document) lezen en akkoord geven, of
   voor de slice expliciet een tijdelijke, simpele tokenvariant toestaan.
5. **Eigenaarschap benoemen:** (a) redacteur `docs/multiplayer/`,
   (b) eigenaar contentmodule, (c) integrator (AR5+compositie). Dit mogen drie
   petten van één agent zijn, maar nu zijn het er nul.
6. Antwoorden op de 7 open GF-protocolvragen (staan gebundeld in
   `docs/game-flow-plan/protocol-interface-proposal.md`) — mag ook ná de slice
   voor alles wat niet de joinflow raakt.

## 5. Werkafspraak-suggesties (voorkomen dat dit terugkomt)

- **Commit-discipline:** geen module "klaar" zonder eigen commit; nooit twee
  agents tegelijk laten committen (de index.lock en de PR3-race zijn hiervan de
  symptomen). Eventueel: één commit-agent als poortwachter.
- **Module + test door dezelfde agent-run** laten schrijven (of test-review
  verplicht tegen het module-contract) — bevinding 2.1 is anders herhaalbaar.
- Vaste statuslegenda ook in AR/GR-PROGRESS doorvoeren; "prompt ontbreekt" mag
  nooit naast een bestaand, getest bestand staan.
- Elke nieuwe module vanaf nu **ESM**, ook onder `server/`.

---

*Verifieerbaar: `node --test 'server/**/*.test.*' 'client/**/*.test.*'
'shared/**/*.test.*' 'tests/**/*.test.*'` · `git status --short | wc -l` ·
`ls server/architecture/` naast `docs/architecture-plan/AR-PROGRESS.md`.*
