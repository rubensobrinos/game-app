# Prompt — PD0: Scope-check

Onderdeel van [`docs/product-plan/README.md`](../README.md), fase PD0. Doel:
bevestiging krijgen over de plek **en** het moduleformaat van de eerste,
dependency-vrije bouwstenen vóórdat er iets buiten `docs/` wordt aangemaakt — zelfde
patroon als GR0 in `game-rules-plan`, AR0 in `architecture-plan` en GF0 in
`game-flow-plan`. Bijgewerkt na [`REVIEW.md`](REVIEW.md); zie
[`../README.md#verwerkte-review`](../README.md) voor de volledige lijst correcties.

## Context

- Er bestaat nog geen map specifiek voor `PRODUCT.md`-bouwstenen. Wel al voorstellen
  van andere eigenaren: `server/rules/` (game-rules), `server/architecture/`
  (architecture), `client/flow/` (game-flow) — geen daarvan bevestigd op het moment
  van schrijven.
- De bouwstenen van dit plan zijn niet allemaal even hard "browser-shared": alleen
  `quick-start-preset` (PD2) en `feature-gate` (PD3) zijn gedeelde runtimegegevens die
  client én server echt laden. `hard-rules`, `mvp-scope-guard`,
  `later-extensions-registry` en `acceptance-criteria` zijn primair
  beleidsregisters/traceability-data voor tests en documentatie.
- **Moduleformaat.** De bestaande app laadt losse `<script>`-tags zonder buildstap;
  `module.exports` (CommonJS) is daar niet rechtstreeks in te laden. Voorstel: alle
  bouwstenen als `.mjs`-bestanden met `export`/`import` (ES modules). Dat werkt
  zonder `package.json` en zonder bundler, zowel onder Node (`node --test` leest
  `.mjs` prima) als in de browser via `<script type="module" src="...">`. Empirisch
  gecheckt op de lokale Node-versie (`v24.16.0`): een `.mjs`-bestand met
  `export const X = ...` en een los `.test.mjs`-bestand met `import` draaien beide
  zonder probleem onder `node --test <bestand>`.
- **Locatie.** Voorstel: `shared/product/`, naast — niet in — de mappen van de andere
  eigenaren. Dit is een nieuwe top-level mapstructuur en dus zelf een structurele
  keuze, geen architectuurneutrale aanname; dat is precies waarom deze fase bestaat
  in plaats van de map stilzwijgend aan te maken.

## Stappen

1. **Stel `shared/product/` + `.mjs` voor, wacht op bevestiging voor beide.** Noem
   expliciet dat de locatie samenvalt met keuzes die andere eigenaren (architecture,
   game-flow, game-rules) ook nog moeten laten bevestigen, en dat een latere,
   bindende mapindeling bij de architecture-eigenaar blijft liggen. Ga pas door naar
   stap 2 na een go op beide punten.
2. Maak na bevestiging alleen de lege map, of het eerste bestand uit PD1 — niet
   vooruitbouwen op latere fases.
3. Verifieer de setup met een minimaal, expliciet testbestand — **niet** door
   `node --test` op de map zelf aan te roepen. Een map doorgeven aan `node --test`
   faalt met `MODULE_NOT_FOUND`, ook als die map geldige testbestanden bevat
   (geverifieerd; zie Context). Voorbeeld:
   `node --test shared/product/smoke.test.mjs` met daarin één triviale `assert.ok(true)`
   — of wacht tot het eerste echte testbestand uit PD1 er is en verifieer daarmee
   direct.
4. Documenteer in een korte regel in `docs/product-plan/README.md` (niet herschrijven,
   alleen aanvullen) dat PD0 is afgerond, welke locatie is bevestigd en welk
   moduleformaat.

## Harde grenzen

- Geen `npm init`, geen `package.json`, geen dependency van welke aard dan ook.
- Geen bestanden buiten `docs/` aanmaken vóór expliciete bevestiging van zowel de
  locatie als het moduleformaat uit stap 1.
- Max 15 bestanden / 5.000 regels voor deze fase (ruim voldoende, dit is een lege
  scaffold).

## Definition of done

- Locatie én moduleformaat zijn bevestigd door de gebruiker, niet aangenomen.
- `shared/product/` (of het bevestigde alternatief) bestaat.
- Een expliciet `.mjs`-testbestand in die map draait zonder crash onder
  `node --test <bestandspad>`.
- Geen enkel bestand buiten `docs/` en de bevestigde map is aangeraakt.
