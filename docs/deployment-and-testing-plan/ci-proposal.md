# CI-volgordevoorstel (DT7)

Onderdeel van [`README.md`](README.md), fase DT7, uitgevoerd volgens
[`prompts/DT7-ci-voorstel.md`](prompts/DT7-ci-voorstel.md). Lost het gat op dat DT0b
al benoemde: de bestaande, devkit-managed `.github/workflows/ci.yml` draait `npm ci`
+ ESLint + Jest en dekt de `node:test`-boom onder `tests/` (en de module-eigen
`*.test.js`-bestanden in `server/*` en `client/flow`) niet — en deze repo heeft ook
geen `package.json`.

## Status: voorstel, geen wijziging

**Dit document verandert geen enkel bestaand bestand, voegt niets toe aan het
devkit-managed blok in `.github/workflows/ci.yml`, en activeert zichzelf niet.** Het
is input voor een mens om te beoordelen. Er is op het moment van schrijven geen
`.github/workflows/tests-node.yml` of enig ander nieuw workflow-bestand aangemaakt —
alleen dit ene document, `docs/deployment-and-testing-plan/ci-proposal.md`, bestaat
na deze actie. Zie [Activatie](#activatie--apart-checkpoint) hieronder voor wat er
wél nodig is om dit voorstel om te zetten in draaiende CI.

Twee onafhankelijke redenen om `ci.yml` zelf niet aan te raken:

1. **Beleid.** `agent_rules.decisions.always_ask` (CLAUDE.md / `devkit policy --json`)
   bevat `deps`/`architecture`; een nieuwe CI-workflow — zeker een die straks ook
   k6/Playwright kan raken — is een architectuurbeslissing, geen zelfstandig uit te
   voeren `docs`-taakje. Alleen het *opschrijven* van dit voorstel is `docs` en dus
   zelfstandig te doen.
2. **Mechanisme.** `.devkit.yaml` bevat een `managed_hashes`-entry voor
   `.github/workflows/ci.yml` (`e14232b5...`). Devkit bewaakt de integriteit van dat
   bestand; een handmatige wijziging daaraan zou die hash-check laten falen. Dat is
   precies waarom README.md (Uitgangspunt 7) het devkit-managed blok nooit handmatig
   wijzigt en dit voorstel in plaats daarvan een **nieuw, apart** bestand beschrijft.

## Voorgestelde workflow: `.github/workflows/tests-node.yml`

Naam is een voorstel, geen vaststaand feit — een mens kan een andere bestandsnaam
kiezen bij goedkeuring. Kernpunten:

- **Triggers**: identiek aan het bestaande `ci.yml` — `push` en `pull_request` op
  alle branches (`branches: ["**"]`). Dat betekent dat `tests-node.yml` en `ci.yml`
  onafhankelijk van elkaar, parallel, op dezelfde events zouden starten (zie
  [Openstaande vraag hieronder](#openstaande-vragen-voor-de-beoordelaar) over of dat
  gewenst is of dat er een striktere volgorde tussen de twee workflow-bestanden moet
  komen).
- **Geen nieuwe dependency, geen `package.json` nodig**: `node:test` zit ingebouwd in
  Node 18+, dus geen `npm ci`-stap voor deze workflow (Uitgangspunt 6, README.md:
  "geen nieuwe dependencies om te beginnen"). `actions/setup-node@v4` met
  `node-version: "20"` volstaat, gelijk aan de Node-versie die `ci.yml` al gebruikt.
- **Geen duplicatie van lint/security**: die lagen blijven exclusief eigendom van
  `ci.yml`. Dit voorstel voegt alleen de ontbrekende `test`/`validate`-laag toe voor
  de `node:test`-boom, niet een parallelle lint- of securitycheck.
- **Geen falende stap op lege mappen**: `tests/contract/` en `tests/integration/`
  bevatten nu alleen een `.gitkeep` (`tests/integration` sowieso zolang DT3b
  geblokkeerd is; zie README.md-status). `node --test <map>` faalt op een lege map
  met `MODULE_NOT_FOUND` (al vastgesteld tijdens DT0-scaffold, zie README.md). Elke
  stap expandeert daarom eerst zelf de glob en slaat over — met een duidelijke
  logregel, exit 0 — als er niets te draaien is, in plaats van de map direct aan
  `node --test` door te geven.
- **Beide bestandsextensies, niet alleen `.js`.** Een eerdere versie van dit
  voorstel zocht uitsluitend `*.test.js` en zou daarmee alle bestaande
  `.test.mjs`-suites in `server/protocol/` (15 bestanden) en `client/flow/` (10
  bestanden) stilzwijgend als "leeg" hebben overgeslagen — precies de fout die
  `REVIEW-DT3B-DT7.md` #1 als blocker aanmerkte. Elke glob hieronder verzamelt
  daarom zowel `*.test.js` als `*.test.mjs`.

### Lagen in volgorde, gekoppeld aan `agent_rules.deployment_order`

`agent_rules.deployment_order` (`devkit policy --json`) is
`lint → security → test → validate → build → deploy`. Deze workflow bestrijkt alleen
het `test`/`validate`-deel van die keten voor de `node:test`-boom; `lint`/`security`
blijven in `ci.yml`, en `build`/`deploy` zijn hier niet van toepassing.

| `deployment_order`-fase | Invulling in dit voorstel | Job in `tests-node.yml` |
| --- | --- | --- |
| `lint` | — blijft in `ci.yml`, niet gedupliceerd | *(geen)* |
| `security` | — blijft in `ci.yml`, niet gedupliceerd | *(geen)* |
| `test` | `node --test` unittests per module-eigenaar (`server/rules`, `server/architecture`, `server/protocol`, `server/data`, `client/flow`, `shared/product`, `tests/fixtures`) — elke eigenaar test zijn eigen module, ik dupliceer niets (README.md, tabel "Testlagen → eigenaarschap") | `unit` (matrix-job) |
| `validate` | eerst `tests/contract/*.test.js` (bevestigt dat module-output aan het gedeelde protocol-/datacontract voldoet), dán `tests/integration/*.test.js` (bevestigt samenwerking tussen modules — breder, dus pas ná contract) | `contract`, gevolgd door `integration` |
| `build` | n.v.t. voor deze workflow | *(geen)* |
| `deploy` | n.v.t. voor deze workflow | *(geen)* |

`unit` gate dus `contract`, en `contract` gate `integration` (via `needs:`) — een
module-unittest die faalt houdt een contract- of integratietest tegen die toch op
verkeerde aannames zou draaien, conform de algemene `deployment_order`-gedachte dat
een latere, duurdere/bredere laag pas draait als de eerdere, goedkopere laag
geslaagd is.

### Voorgestelde YAML (illustratief, geen bestand)

```yaml
# Voorstel — nog GEEN bestand op .github/workflows/tests-node.yml.
name: tests-node

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

jobs:
  unit:
    name: "Unit: ${{ matrix.module }}"
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        module:
          - server/rules
          - server/architecture
          - server/protocol
          - server/data
          - client/flow
          - shared/product
          - tests/fixtures
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: node --test (both .test.js and .test.mjs; no-op if none yet)
        shell: bash
        run: |
          shopt -s nullglob
          files=(${{ matrix.module }}/*.test.js ${{ matrix.module }}/*.test.mjs)
          if [ ${#files[@]} -eq 0 ]; then
            echo "No *.test.js or *.test.mjs files yet in ${{ matrix.module }} — skipping."
            exit 0
          fi
          node --test "${files[@]}"

  contract:
    name: Contract tests
    runs-on: ubuntu-latest
    needs: [unit]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: node --test tests/contract (both extensions; no-op if none yet)
        shell: bash
        run: |
          shopt -s nullglob
          files=(tests/contract/*.test.js tests/contract/*.test.mjs)
          if [ ${#files[@]} -eq 0 ]; then
            echo "No *.test.js or *.test.mjs files yet in tests/contract — skipping."
            exit 0
          fi
          node --test "${files[@]}"

  integration:
    name: Integration tests
    runs-on: ubuntu-latest
    needs: [contract]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: node --test tests/integration (both extensions; no-op if none yet — DT3b not activated)
        shell: bash
        run: |
          shopt -s nullglob
          files=(tests/integration/*.test.js tests/integration/*.test.mjs)
          if [ ${#files[@]} -eq 0 ]; then
            echo "No *.test.js or *.test.mjs files yet in tests/integration — skipping (DT3b not activated)."
            exit 0
          fi
          node --test "${files[@]}"
```

Lokaal geverifieerd tegen de daadwerkelijke boom (2026-08-02, vóór dit voorstel als
tekst vast te leggen): `server/protocol` → 15 `.test.mjs`-bestanden,
`client/flow` → 10 `.test.mjs`, `shared/product` → 5 `.test.mjs`,
`server/rules`/`server/architecture`/`server/data`/`tests/fixtures` → 9 `.test.js`
samen. Met de gecombineerde glob hierboven vindt elke module-job dus daadwerkelijk
tests; met de oude, `.js`-only versie zouden `server/protocol`, `client/flow` en
`shared/product` (30 van de 39 bestaande testbestanden) stil zijn overgeslagen.

`fail-fast: false` op de `unit`-matrix is een bewuste keuze: een falende
`server/data`-test mag `server/rules`s eigen resultaat niet verbergen — elke
module-eigenaar krijgt zijn eigen groen/rood, niet één samengevouwen matrix-uitkomst.

## Wat deze workflow bewust niet doet

- **Geen E2E/load/chaos op elke push.** `tests/e2e/*.test.js`, `tests/load/*.test.js`
  en `tests/chaos/*.test.js` staan hier niet in. Playwright en k6/Artillery zijn nog
  niet-geïnstalleerde dependencies (`deps`, `always_ask`, README.md Uitgangspunt 6);
  chaostests raken bovendien externe proces-/datastate (DT6, eigen checkpoints per
  stap). Die lagen blijven `workflow_dispatch`/handmatig totdat hun eigen
  `deps`/`prod`-akkoord er is — dat is een aparte beslissing, geen automatisch gevolg
  van dit voorstel. Ter illustratie (niet ter activatie) zou een latere, los
  goedgekeurde workflow er zo kunnen uitzien:

  ```yaml
  # Louter illustratief voor een MOGELIJKE latere, apart goedgekeurde workflow.
  # Geen onderdeel van de activatie van dit DT7-voorstel.
  on:
    workflow_dispatch: {}
  jobs:
    e2e:
      runs-on: ubuntu-latest
      steps:
        - run: echo "vereist eerst een deps-akkoord voor Playwright (DT4a)"
  ```

- **Geen wijziging aan `.github/workflows/ci.yml`** en geen aanraking van het
  devkit-managed blok daarin.
- **Geen nieuw bestand in `.github/workflows/`** — dat is de aparte, hieronder
  beschreven activatiestap.
- **Geen `npm ci`/nieuwe dependency-installatie**: `node:test` is ingebouwd, dus
  niets hier vereist een `deps`-akkoord op zichzelf.

## De bestaande `ci.yml` is al kapot — dit voorstel lost dat niet op

**Blocker, vastgesteld door `REVIEW-DT3B-DT7.md` #2.** Een eerdere versie van dit
document suggereerde dat een nieuwe, parallelle `tests-node.yml` de "CI-kloof"
dichtzet. Dat is onjuist. De bestaande, devkit-managed `ci.yml` draait `npm ci`,
`npx eslint .` en `npx jest` — en deze repo heeft geen `package.json`. Die stappen
falen dus nu al, onafhankelijk van dit voorstel en onafhankelijk van of
`tests-node.yml` ooit wordt geactiveerd. Een tweede, groene workflow naast een
kapotte eerste workflow is geen oplossing: dezelfde push/PR toont dan nog steeds een
rode `ci.yml`-check.

Dit gat voorafde aan het hele `DEPLOYMENT-AND-TESTING.md`-realisatieplan (het volgt
uit het `react-native-app`-devkitprofiel, niet uit iets wat in deze plan-map is
gebouwd) en dit voorstel lost het bewust niet zelf op — elke concrete oplossing is
zelf al `deps`/`architecture`, `always_ask`:

- **Optie A — minimale `package.json` toevoegen** zodat `npm ci`/`eslint`/`jest`
  daadwerkelijk iets hebben om tegen te draaien. Dit is een `deps`-beslissing (de
  repo gaat dan voor het eerst dependencies/een lockfile hebben) en raakt het
  bestaande "geen build-stap, geen dependencies"-uitgangspunt van de hele repo, niet
  alleen van dit testplan.
- **Optie B — het devkit-profiel/de managed `execution`-config aanpassen** (`lint`/
  `test`/`build` in `devkit policy --json` staan nu vast op
  `eslint`/`jest`/`expo export`) zodat die commando's passen bij een repo zonder
  package-manager-project. Dit is een wijziging op profielniveau, niet iets wat één
  document-eigenaar voor deze ene repo beslist.
- **Optie C — bewust uitstellen tot een latere, sowieso al `deps`-plichtige stap**
  (bijvoorbeeld wanneer Playwright of TypeScript wordt goedgekeurd) een
  `package.json` meebrengt, en de bestaande `ci.yml`-stappen dan pas voor het eerst
  iets zinnigs hebben om te draaien. Dit voorstel raadt deze optie aan als
  standaardpad: geen aparte `deps`-vraag nu voor iets dat toch al aankomt, maar wel
  expliciet benoemd zodat niemand aanneemt dat `tests-node.yml` het probleem al
  heeft opgelost.

Welke optie ook gekozen wordt, dat is een keuze voor een mens, niet voor dit
document. Tot die keuze gemaakt is, blijft `ci.yml`'s `lint`/`test`-job rood op elke
push/PR, ongeacht of `tests-node.yml` bestaat.

## Openstaande vragen voor de beoordelaar

Dit zijn bewust geen beslissingen die ik als voorstel-schrijver zelf neem — het zijn
`architecture`/`deps`-achtige keuzes (`always_ask`, CLAUDE.md):

1. **Volgorde tussen workflow-bestanden.** `ci.yml` en `tests-node.yml` zouden als
   twee losse GitHub Actions-workflows onafhankelijk van elkaar op hetzelfde `push`/
   `pull_request`-event starten — GitHub Actions sequentiëert aparte workflow-
   bestanden niet vanzelf. Is dat acceptabel (beide moeten los slagen, PR-checks
   tonen beide), of moet `tests-node.yml` pas ná `ci.yml`s `lint`/`security` starten
   (bijv. via `workflow_run`)? Dat laatste is een striktere aansluiting op
   `deployment_order` maar voegt cross-workflow-complexiteit toe.
2. **Bestandsnaam.** `tests-node.yml` is een voorstel; een beoordelaar kan een andere
   naam prefereren.
3. **Node-versie.** Dit voorstel volgt `ci.yml`s `node-version: "20"` voor
   consistentie; er is geen inhoudelijke reden gevonden om af te wijken.
4. **Branch-protection.** Of `tests-node.yml`s jobs (straks) verplichte status checks
   worden voor merges naar een beschermde branch, is een repo-instelling die buiten
   dit voorstel valt.

## Activatie — apart checkpoint

Dit voorstel activeert zichzelf niet. Het daadwerkelijk aanmaken van
`.github/workflows/tests-node.yml` (of een andere naam, zie boven) vraagt expliciet
akkoord van een mens, los van het schrijven van dit document — pas ná dat akkoord
lost dit de CI-kloof uit DT0b daadwerkelijk op. Tot die tijd blijven de
`node --test`-commando's uit DT0b uitsluitend lokaal draaien, niet in CI.
