# Realisatieplan — PRODUCT.md

Dit is het uitvoeringsplan voor het onderdeel waar ik verantwoordelijkheid voor heb
genomen: [`docs/multiplayer/PRODUCT.md`](../multiplayer/PRODUCT.md). Dit document zelf
verandert niets aan de specificatie — het beschrijft hoe ik die specificatie omzet in
geteste artefacten, in welke volgorde, en waar ik moet stoppen om goedkeuring te vragen.

Zie ook [`docs/multiplayer/README.md`](../multiplayer/README.md) voor de rolverdeling
per document, en de zusterplannen van de andere eigenaren:
[`docs/game-rules-plan/README.md`](../game-rules-plan/README.md),
[`docs/architecture-plan/README.md`](../architecture-plan/README.md) en
[`docs/game-flow-plan/README.md`](../game-flow-plan/README.md). De eigenaren van
`DATA-MODEL.md`, `PROTOCOL.md` en `DEPLOYMENT-AND-TESTING.md` hadden op het moment van
schrijven nog geen plan gepubliceerd; waar dit plan iets van hen nodig heeft, staat dat
expliciet als open punt hieronder, niet als aanname.

## Verwerkte review

Een review van dit plan staat in
[`prompts/REVIEW.md`](prompts/REVIEW.md). Alle bevindingen zijn overgenomen vóór
uitvoering van PD0/PD1; de belangrijkste correcties:

- de MVP-uitsluitingslijst telt **12** items, niet 11 (feitelijke telfout, gecheckt
  tegen de brontekst);
- `node --test <map>` is geen geldige discoverycheck — Node behandelt een opgegeven
  pad als direct te laden testbestand en faalt op een map met `MODULE_NOT_FOUND`,
  ook als die map wél geldige testbestanden bevat (empirisch geverifieerd op de
  lokale Node-versie); alle stappen hieronder gebruiken nu expliciete bestandspaden;
- CommonJS (`module.exports`) is in `shared/` niet vanzelf bruikbaar in de browser;
  PD0 en PD1 gaan nu uit van ES modules (`.mjs`), die zonder bundler of `package.json`
  zowel in Node als via `<script type="module">` in de browser laden;
- `assertNotInMvpScope()` op vrije string-ID's beloofde meer bescherming dan het
  waarmaakt (typefouten/synoniemen passeren ongemerkt); PD1 presenteert de
  uitsluitingslijst nu primair als beleidsregister met een expliciet gedocumenteerde,
  beperkte lookup, niet als een volwaardige scope-guard;
- uitsluitingen en de harde regels worden nu als `{ id, text }` met de volledige
  brontekst gemodelleerd, en getest op die tekst, niet alleen op ID's;
- PD4's "disjointness"-toets is vervangen door een `qualifies`-referentie, omdat
  sommige latere uitbreidingen (bijv. optionele spectatorroute) een MVP-uitsluiting
  bewust kwalificeren in plaats van ermee in tegenspraak te zijn.

## Verwerkte review — PD2/PD3

Een review van PD2 en PD3 staat in
[`prompts/REVIEW-PD2-PD3.md`](prompts/REVIEW-PD2-PD3.md). Anders dan de PD0/PD1-review
waren dit geen zelfstandig te herstellen fouten: meerdere bevindingen raken bestanden
of beslissingen van andere eigenaren en zijn dus geblokkeerd, niet gecorrigeerd.
Geverifieerd vóór verwerking (niet blind overgenomen): `preset` i.p.v. `presetId`
komt inderdaad consequent voor in `DATA-MODEL.md`, `PROTOCOL.md` én het inmiddels
bestaande `client/flow/host-setup-state.mjs`; die laatste module bevat al een eigen,
werkende Groepsbattle-default met vier spelvormen; `"typed_capitals"` komt inderdaad
al voor als voorbeeld in `docs/game-rules-plan/prompts/GR3-validators.md` en
`server/rules/validators.test.js`; `GAME-RULES.md` §7 bevestigt dat de juridische
logo-flag alle drie de logo-/clubspelvormen dekt, niet alleen `Logo: Echt of Nep?`.

- **PD2 is geblokkeerd.** Naast de al bekende 4-versus-5-tegenstrijdigheid met
  `DATA-MODEL.md` is er nu ook overlap met `host-setup-state.mjs` (dreigende
  defaultdrift tussen twee bronnen) en blijft onduidelijk of dit object een
  preset-ID, een overlay of een volledige config moet zijn — dat laatste raakt
  `PROTOCOL.md` (`public_api`). Zie `prompts/PD2-quick-start-preset.md`.
- **PD3 is geblokkeerd** voor de ID-bindende versie: de Golf-2-gameType-ID's en het
  bestaan van `golf2Enabled` als runtimeflag zijn niet elders vastgelegd en botsen
  met een aanname van de game-rules-eigenaar (`typed_capitals` vs. mijn
  `typed_input`). De brede juridische lezing (drie logo-spelvormen, niet één) blijft
  wél overeind. Een niet-geblokkeerd alternatief met minder waarde (beleidsmatrix
  zonder runtime-ID's) staat beschreven in `prompts/PD3-feature-gate.md`.

## Uitgangspunten

1. **PRODUCT.md is grotendeels beleid, geen losstaande runtime-module.** In
   tegenstelling tot `GAME-RULES.md`, `GAME-FLOW.md` en `ARCHITECTURE.md` bevat dit
   document zelf nauwelijks iets dat op zichzelf kan draaien. Wat ik bouw zijn kleine,
   pure artefacten die de al gemaakte productbeslissingen herbruikbaar en toetsbaar
   maken voor de andere vijf eigenaren. Ik neem geen nieuwe productbeslissingen — dat
   is `design`, `always_ask` volgens `devkit policy --json` — ik codeer alleen wat er
   al letterlijk staat.
2. **Devkit-policygrens.** `devkit policy --json` zet `design` op `always_ask`.
   `PRODUCT.md` bevat de besluiten al (`docs/multiplayer/README.md`: "zonder zelf
   nieuwe kernbeslissingen ... te introduceren"). Zodra ik iets zou toevoegen dat niet
   letterlijk in `PRODUCT.md` staat — nieuwe copy, een nieuwe flag, een preset-waarde
   die er niet in staat — stop ik en vraag dat na. Dat is een nieuw designbesluit, geen
   realisatie van een bestaand besluit.
3. **Geen nieuwe dependencies om te beginnen.** Zelfde aanpak als de andere drie
   plannen: pure data/functies, getest met Node's ingebouwde `node --test` +
   `node:assert`, aangeroepen met expliciete bestandspaden (een map doorgeven aan
   `node --test` faalt met `MODULE_NOT_FOUND`, ook als die map testbestanden bevat —
   geverifieerd, zie "Verwerkte review"). Geen `package.json`, dus geen
   `deps`-goedkeuring nodig.
4. **Moduleformaat: ES modules (`.mjs`), niet CommonJS.** De bestaande app laadt
   losse `<script>`-tags zonder buildstap; `module.exports` is daar niet in te laden.
   `.mjs`-bestanden met `export`/`import` werken zonder package.json of bundler,
   zowel onder Node als via `<script type="module">` in de browser. Niet elke
   bouwsteen hieronder heeft die eis: `quick-start-preset` en `feature-gate` zijn
   gedeelde runtimegegevens die client én server echt laden; `hard-rules`,
   `mvp-scope-guard`, `later-extensions-registry` en `acceptance-criteria` zijn
   primair beleidsregisters/traceability-data voor tests en documentatie, geen
   code die de browser per se hoeft te laden. Ik gebruik voor alle bouwstenen
   consequent `.mjs` om twee moduleformaten naast elkaar te vermijden, niet omdat
   ze allemaal even hard "browser-shared" hoeven te zijn.
5. **Autonomie-limieten blijven gelden.** Max 15 bestanden en 5.000 regels per actie
   (`CLAUDE.md`). Elke fase hieronder is bewust klein genoeg om binnen die grens te
   passen.
6. **Ik bepaal geen schema's of transportvormen namens andere eigenaren.**
   `GameConfiguration` (`DATA-MODEL.md`, `database_schema`, ADR-plichtig) en de
   feature-flag-transportvorm (`PROTOCOL.md`, `public_api`, ADR-plichtig) blijven bij
   hen. Ik lever waarden en voorstellen, geen bindende vorm.

## Bouwstenen

| Bouwsteen | Verantwoordelijkheid | Bron in PRODUCT.md |
| --- | --- | --- |
| `hard-rules` | de drie harde productregels, elk als `{ id, text }` met de volledige brontekst | §Harde productregels |
| `mvp-scope-guard` | de "nadrukkelijk niet in de MVP"-lijst (12 items) als `{ id, text }`-beleidsregister + een expliciet beperkte `isExplicitlyExcluded(id)`-lookup | §Nadrukkelijk niet in de MVP |
| `quick-start-preset` | letterlijke defaultwaarden van de `Groepsbattle`-preset als platte, geteste constante | §Standaard quick-start preset |
| `feature-gate` | pure functie: gegeven golf + flags (`golf2Enabled`, `logoRealOrFakeEnabled`) → welke spelvormen beschikbaar zijn | §Spelvormen in multiplayer, §Juridische productgrens voor logo's |
| `later-extensions-registry` | de "latere uitbreidingen"-lijst als markering, zodat niemand die per ongeluk in Golf 1-scope trekt | §Latere uitbreidingen — niet launch-blocking |
| `acceptance-criteria` | de 9 succescriteria als gestructureerde traceability-tabel (criterium → eigenaar-document → teststatus) | §Succescriteria MVP |

Elke bouwsteen is een eigen bestand met eigen unit tests, zodat een wijziging in één
regel niet de andere raakt.

## Fasering

### PD0 — Scope-check (geen dependencies)
- Voorstel voor de locatie (`shared/product/`) **en** het moduleformaat (`.mjs`
  ES modules, zie "Uitgangspunten" punt 4) van deze bouwstenen — beide staan ter
  bevestiging in `prompts/PD0-scope-check.md`. `shared/product/` is een nieuwe
  top-level mapstructuur en dus een structurele keuze, geen architectuurneutrale
  aanname; dat is precies waarom PD0 bestaat.
- Verificatie gebeurt met een expliciet testbestand, niet met `node --test` op de
  lege map zelf (zie "Verwerkte review").

### PD1 — Hard rules & MVP scope guard
- `HARD_RULES`: de drie harde productregels als `{ id, text }` met de volledige
  brontekst, getest op die tekst.
- `EXCLUDED_FROM_MVP`: alle **12** uitgesloten items als `{ id, text }`.
- `isExplicitlyExcluded(id)`: eerlijke, beperkte lookup — herkent uitsluitend exacte
  canonieke ID's uit dit register, vangt geen synoniemen of typefouten. Een sterkere
  garantie vereist een gesloten, gedeeld feature-ID-enum met de andere eigenaren; dat
  is geen PD1-beslissing (zie "Checkpoints die ik niet zelfstandig neem").
- Laagste risico: één-op-één traceerbare representatie van bestaande tekst, geen
  nieuwe interpretatie.

### PD2 — Quick-start preset
- De `Groepsbattle`-defaultwaarden (taal, moeilijkheid, 10 rondes, auto-tempo,
  snelheidspunten aan, late join aan, spelvormen, modus individueel) als platte
  constante.
- Expliciet ter review aanbieden aan de `DATA-MODEL.md`-eigenaar, want dit zijn
  defaultwaarden voor hún `GameConfiguration`-schema, niet een nieuw schema.

### PD3 — Feature-gate
- Pure functie `availableGameTypes({ golf2Enabled, logoRealOrFakeEnabled })` die Golf
  1 altijd teruggeeft, Golf 2 alleen bij `golf2Enabled`, en `Logo: Echt of Nep?` alleen
  bij expliciete juridische vrijgave (`logoRealOrFakeEnabled`), gescheiden van de
  algemene Golf 2-vlag omdat `PRODUCT.md` dat als aparte voorwaarde stelt.
- Expliciet ter review aanbieden aan de `PROTOCOL.md`-eigenaar: hoe de flag zelf over
  de lijn gaat is hún terrein, ik lever alleen de beslisregel.

### PD4 — Later-extensions registry
- De lijst met niet-launch-blocking ideeën (groepsvlag/badge, teamcompetities,
  optionele spectatorroute, white-label, …) als `{ id, text, qualifies? }`-data.
  `qualifies` verwijst optioneel naar een `EXCLUDED_FROM_MVP`-id wanneer een latere
  uitbreiding een MVP-uitsluiting bewust versoepelt in plaats van ermee te botsen —
  bijvoorbeeld de optionele spectatorroute die `spectator_screen_required`
  kwalificeert. Geen automatische disjointness-check: inhoudelijke samenhang tussen
  een uitsluiting en een latere, nadrukkelijk optionele variant is geen
  tegenspraak. De enige geautomatiseerde toets is referentiële integriteit: elke
  ingevulde `qualifies` moet een bestaand `EXCLUDED_FROM_MVP`-id zijn.

### PD5 — Acceptance-criteria traceability
- De 9 succescriteria uit `PRODUCT.md` als tabel: criterium, brondocument dat het
  moet bewijzen (bijv. criterium 5 → `DEPLOYMENT-AND-TESTING.md` L1-loadtest,
  criterium 7 → `GAME-FLOW.md` rematch-flow), en een status-kolom (`open` totdat de
  betreffende eigenaar een test levert). Dit dupliceert geen tests, het maakt zichtbaar
  welke al bestaan en welke nog ontbreken.
- Wordt pas na PD1–PD4 ingevuld, zodat de tabel naar bestaande code kan verwijzen in
  plaats van naar aannames.

### PD6 — Interfacevoorstel voor DATA-MODEL.md / PROTOCOL.md
- Geen ADR, wel een voorstel: welke velden uit `quick-start-preset` (PD2) en welke
  beslisregel uit `feature-gate` (PD3) de eigenaren van die ADR-plichtige documenten
  kunnen overnemen. Zelfde patroon als GR7 in `game-rules-plan`, AR5 in
  `architecture-plan` en GF8 in `game-flow-plan`.

## Testplan

Dit dekt indirect de "Contracttests"-laag uit
[`DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md#testlagen) —
met name dat client en server dezelfde productgrenzen respecteren — zonder die laag
zelf te dupliceren:

- de drie harde regels zijn machine-leesbaar en dus opneembaar in andere agents' tests
  (PD1);
- de MVP-uitsluitingslijst is toetsbaar in plaats van alleen leesbaar (PD1);
- preset-defaults en feature-gate-uitkomst zijn los van UI of transport te unit-testen
  (PD2, PD3);
- de acceptance-criteria-tabel maakt testdekking zichtbaar in plaats van impliciet
  (PD5).

## Wat hier expliciet buiten valt

- Nieuwe productbeslissingen of copy die niet letterlijk in `PRODUCT.md` staat —
  `design`, `always_ask`.
- Het `GameConfiguration`-schema zelf en Redis-opslag — `DATA-MODEL.md`.
- De transportvorm van feature-flags (event, header, endpoint) — `PROTOCOL.md`.
- Schermen, routes en flow-state — `GAME-FLOW.md`.
- Scoring, vraagselectie en spelvormvalidatie — `GAME-RULES.md`.
- Infrastructuur, containers en deployment — `ARCHITECTURE.md`,
  `DEPLOYMENT-AND-TESTING.md`, `prod`.

## Checkpoints die ik niet zelfstandig neem

- Nieuwe productbeslissingen toevoegen die niet al in `PRODUCT.md` staan — `design`,
  `always_ask`.
- De bindende vorm van `GameConfiguration` of een feature-flag-payload vastleggen
  namens andere eigenaren — `database_schema` / `public_api`, ADR-plichtig bij hen.
- De definitieve locatie/mapindeling en het moduleformaat buiten `docs/` — zie PD0.
- Een gesloten, gedeeld feature-ID-enum afspreken met de andere eigenaren om
  `isExplicitlyExcluded()` sterker te maken dan een canonieke-ID-lookup — dat is
  cross-agent afstemming, geen eenzijdige PD1-beslissing.

Ik werk dus door tot en met PD5 als losstaande, geteste artefacten plus een reviewbaar
voorstel in PD6, en leg bij PD0 expliciet een vraag neer in plaats van door te bouwen op
een aanname.

## Prompts per fase

Uitvoerbare, zelfstandige taakbeschrijvingen per fase staan in
[`prompts/`](prompts/), zodat ze los te reviewen en los te starten zijn:

- [`prompts/PD0-scope-check.md`](prompts/PD0-scope-check.md)
- [`prompts/PD1-hard-rules-and-scope-guard.md`](prompts/PD1-hard-rules-and-scope-guard.md)
- [`prompts/PD2-quick-start-preset.md`](prompts/PD2-quick-start-preset.md) — bevat een
  blokkerende open vraag (PRODUCT.md vs. DATA-MODEL.md over het aantal spelvormen in
  de default-preset), nog niet uitgevoerd, ter review.
- [`prompts/PD3-feature-gate.md`](prompts/PD3-feature-gate.md) — nog niet uitgevoerd,
  ter review.

PD0 en PD1 zijn afgerond: `shared/product/` bestaat (`.mjs`-modules, locatie en
moduleformaat bevestigd zoals hierboven), met
[`shared/product/hard-rules.mjs`](../../shared/product/hard-rules.mjs) +
[`.test.mjs`](../../shared/product/hard-rules.test.mjs) en
[`shared/product/mvp-scope-guard.mjs`](../../shared/product/mvp-scope-guard.mjs) +
[`.test.mjs`](../../shared/product/mvp-scope-guard.test.mjs). Alle 16 tests
(3 hard-rules + 13 mvp-scope-guard) slagen via
`node --test shared/product/hard-rules.test.mjs shared/product/mvp-scope-guard.test.mjs`.

De gebruiker heeft de blockers in PD2/PD3 beantwoord (zie
[`REVIEW-PD2-PD3.md`](prompts/REVIEW-PD2-PD3.md) en de bijgewerkte promptbestanden):

- **PD2** is deels ontgrendeld: alleen `GROUP_BATTLE_DEFAULT_GAME_TYPES` (de vier
  bevestigde spelvormen) wordt gebouwd in `shared/product/`, plus een aanpassing van
  `client/flow/host-setup-state.mjs` (game-flow-eigenaar) om die lijst te importeren
  in plaats van te hardcoden — expliciet geautoriseerd door de gebruiker. De volledige
  preset-constante (taal/moeilijkheid/tempo) blijft ongebouwd zolang
  `host-setup-state.mjs` die rol al vervult.
- **PD3** blijft volledig geblokkeerd — de gebruiker koos expliciet voor wachten tot
  de canonieke Golf-2-ID's en de `golf2Enabled`-flagsemantiek zijn afgestemd met de
  eigenaren van `DATA-MODEL.md`, `PROTOCOL.md` en `GAME-RULES.md`. Ook de
  gereduceerde beleidsmatrix-versie wordt niet gebouwd.

Het ontgrendelde deel van **PD2 is afgerond**:
[`shared/product/quick-start-preset.mjs`](../../shared/product/quick-start-preset.mjs) +
[`.test.mjs`](../../shared/product/quick-start-preset.test.mjs) (3/3 tests groen) leveren
`GROUP_BATTLE_DEFAULT_GAME_TYPES`, en
[`client/flow/host-setup-state.mjs`](../../client/flow/host-setup-state.mjs) importeert die
lijst nu in `defaultHostConfig()` in plaats van hem te hardcoden. Het bestaande,
ongewijzigde `client/flow/host-setup-state.test.mjs` slaagt nog steeds volledig (32/32),
net als `shared/product/hard-rules.test.mjs` + `shared/product/mvp-scope-guard.test.mjs`
(16/16, ter controle dat die twee modules niet zijn geraakt).

**PD4 is afgerond**:
[`shared/product/later-extensions-registry.mjs`](../../shared/product/later-extensions-registry.mjs) +
[`.test.mjs`](../../shared/product/later-extensions-registry.test.mjs) (8/8 tests groen)
leveren `LATER_EXTENSIONS` (8 items, volledige brontekst), met `qualifies`-links voor
`optional_spectator_route` → `spectator_screen_required` en
`paid_white_label_or_event_versions` → `payments_or_premium`, referentieel getoetst tegen
`EXCLUDED_FROM_MVP` uit `mvp-scope-guard.mjs`. Alle 27 tests
(`hard-rules` + `mvp-scope-guard` + `quick-start-preset` + `later-extensions-registry`)
slagen samen: `node --test shared/product/hard-rules.test.mjs
shared/product/mvp-scope-guard.test.mjs shared/product/quick-start-preset.test.mjs
shared/product/later-extensions-registry.test.mjs`.

Overige fases (PD5–PD6) krijgen hun prompt vlak voordat ze starten, niet vooraf in bulk —
zo blijft elke prompt actueel ten opzichte van wat de vorige fase echt opleverde.

**PD5 is afgerond**:
[`shared/product/acceptance-criteria.mjs`](../../shared/product/acceptance-criteria.mjs) +
[`.test.mjs`](../../shared/product/acceptance-criteria.test.mjs) (8/8 tests groen) leveren
`ACCEPTANCE_CRITERIA` (9 items, volledige brontekst + statussnapshot: 1× `built`,
2× `not_started`, 6× `partial`) en `LAST_VERIFIED`. Alle 35 tests
(`hard-rules` + `mvp-scope-guard` + `quick-start-preset` + `later-extensions-registry`
+ `acceptance-criteria`) slagen samen: `node --test shared/product/hard-rules.test.mjs
shared/product/mvp-scope-guard.test.mjs shared/product/quick-start-preset.test.mjs
shared/product/later-extensions-registry.test.mjs shared/product/acceptance-criteria.test.mjs`.

**PD6 is afgerond**, als versmalde, niet-bindende variant (zie
[`prompts/PD6-interface-proposal.md`](prompts/PD6-interface-proposal.md) voor de
reden waarom het feature-gate-deel is uitgesteld):
[`data-model-and-protocol-interface-proposal.md`](data-model-and-protocol-interface-proposal.md)
stelt de `DATA-MODEL.md`-eigenaar voor om het `GameConfiguration`-voorbeeld te
corrigeren naar de vier bevestigde `GROUP_BATTLE_DEFAULT_GAME_TYPES`, en oppert
(als suggestie, geen eis) twee contract-/consistentietesten met `hard-rules.mjs`
en `mvp-scope-guard.mjs` voor de `PROTOCOL.md`- en `DATA-MODEL.md`-eigenaren. Het
feature-gate-deel (PD3) staat expliciet nog open tot Golf-2-ID's en
`golf2Enabled`-semantiek cross-agent zijn afgestemd. Hiermee is dit plan (PD0–PD6)
volledig doorlopen.
