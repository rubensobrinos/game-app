# Prompt — DT-R3: CI-fix — devkitprofiel, geen eslint/jest-devDependency-patch

Onderdeel van [`DT-RESUME-AFTER-DECISIONS.md`](DT-RESUME-AFTER-DECISIONS.md),
opdracht 4. Herzien na review (2026-08-02): het oorspronkelijke idee — `eslint`
en `jest` als devDependency toevoegen zodat de bestaande managed `ci.yml` nominaal
slaagt — repareert het verkeerde deel. De echte oorzaak is dat het gekoppelde
devkitprofiel niet bij deze repo past. **Dit prompt-bestand is zelf al de
investigatie** (hieronder, met bewijs) — het is geen "ga uitzoeken"-opdracht, maar
een "kies tussen deze concrete opties"-verzoek aan een mens.

## Bevindingen (geverifieerd 2026-08-02)

1. **`.devkit.yaml` ondersteunt geen `execution`-override.** De geïnstalleerde
   `devkit` (0.15.0, `~/.local/pipx/venvs/devkit`) leest per-repo alleen
   `profile` en `autonomy_overrides` uit `.devkit.yaml` — geverifieerd door de
   pakketbron te doorzoeken op `_override`-velden: alleen `autonomy_overrides`
   komt voor, nergens een `execution_override` of vergelijkbaar. De officiële
   documentatie (`~/dev/devkit/docs/configuration.md`) zegt zelfs expliciet dat
   `.devkit.yaml` **nooit handmatig** bewerkt hoort te worden na `devkit init`,
   en beschrijft alleen `profile`/`applied_devkit_version` als geldige velden.
   Zelf een `execution`-blok toevoegen aan `.devkit.yaml` is dus waarschijnlijk
   een no-op (genegeerd) of een ongeldige configuratie — niet getest, want dat zou
   `.devkit.yaml` precies zo handmatig wijzigen als de documentatie afraadt.
2. **Geen bestaand profiel past.** `devkit profiles` toont tien profielen. De
   dichtstbijzijnde, `node-api` ("Node.js API service, TypeScript,
   Express/Hono/Fastify"), veronderstelt nog steeds TypeScript-tooling. Deze repo
   gebruikt bewust platte ESM/JavaScript met JSDoc, geen TypeScript
   (`DECISIONS.md` #28). Omschakelen naar `node-api` verplaatst het probleem
   (`tsc`/`ts-jest`-achtige aannames) in plaats van het op te lossen.
3. **`npm ci` in de managed `test`-job werkt nu wél** (package.json + lockfile
   bestaan sinds commit `376bd4e`) — alleen `npx eslint .` (geen eslintconfig) en
   `npx jest` (geen jesttests, onze tests gebruiken `node:test`) blijven zinloos.

## Opties voor de mens die dit beslist

Geen van deze is `docs`/zelfstandig — elke optie raakt `architecture` en/of het
devkit-profiel zelf, buiten deze ene repo.

- **Optie A — nieuw devkitprofiel laten aanmaken** (bijv. `node-esm-app`: platte
  ESM, `node:test`, geen TypeScript, geen Expo-build) bij wie `devkit`'s
  `repo-profiles.yaml` beheert (buiten deze repo, in het devkit-tool zelf). Meest
  correcte fix, maar buiten de scope/rechten van deze repo alleen.
- **Optie B — pragmatische stopgap:** `eslint` + `jest` alsnog als devDependency
  toevoegen, met een minimale eslintconfig (zodat de lint-job niet crasht op
  "geen config") en een jest-config die bewust 0 bestanden target (zodat de
  test-job groen "slaagt" zonder iets zinvols te testen). **Nadeel, met reden
  afgeraden:** dit maakt de managed `test`-job misleidend groen — hij bewijst dan
  niets, wat precies het probleem is dat REVIEW-DT3B-DT7.md #2 al aankaartte.
- **Optie C — `devkit migrate` naar `node-api` ondanks de TypeScript-mismatch**,
  en de TypeScript-aannames in die jobs zelf lokaal negeren/uitschakelen. Onzeker
  of dat schoner is dan optie B; niet verder onderzocht.

**Aanbeveling van dit document:** optie A, met optie B als tijdelijke, expliciet
gelabelde stopgap totdat optie A er is — nooit optie B presenteren als
"CI-kloof opgelost".

## Wat hier niet gebeurt

- Geen wijziging aan `.devkit.yaml`, `.github/workflows/ci.yml` of enig
  devkit-beheerd bestand — dit document beslist niets, het legt de keuze voor.
- Geen `npm install` van eslint/jest voordat een mens optie A/B/C kiest.

## Definition of done

- Een mens heeft optie A, B of C gekozen (of een alternatief). Pas na die keuze
  volgt een nieuwe, uitvoerbare vervolgprompt — dit bestand blijft de
  onderbouwing, niet de uitvoering.
