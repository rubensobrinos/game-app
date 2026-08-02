# Prompt — GF0: Scaffold

Onderdeel van [`../README.md`](../README.md), fase GF0. Doel: alleen een bevestigde,
lege plek voor de flow-modules neerzetten — geen code, geen tests. Dat gebeurt in GF1.

**Herzien** na [`REVIEW.md`](REVIEW.md) bevinding 1 en
[`REVIEW-CODEX.md`](REVIEW-CODEX.md) bevindingen 1 en 2: de vorige versie eiste in de
definition of done een testbestand dat volgens stap 3 pas in GF1 ontstaat
(cirkelverwijzing), en nam CommonJS aan zonder te checken of dat bruikbaar is in de
browserapp die deze module uiteindelijk moet draaien.

## Context

- Er bestaat nog geen `client/`- of `frontend/`-map in deze repo (geverifieerd); de
  bestaande app is `index.html` + losse `<script>`-tags, zonder build-stap en zonder
  modules (geen `type="module"`, geen `module.exports`, geen `package.json`).
- `DEPLOYMENT-AND-TESTING.md` mount in de referentie-Compose `./frontend/dist` in de
  nginx-container — dat impliceert een build-stap die vandaag nergens bestaat.
- Twee andere agents stellen in dezelfde ronde `server/rules/` (GAME-RULES) en
  `server/architecture/` (ARCHITECTURE) voor. Dat is servercode zonder
  browser-ladingseis; deze module moet wél rechtstreeks in de browser draaien, dus
  "consistent met de andere modules" mag niet automatisch hun moduleformaat
  overnemen.

## Bevestigde keuzes

Voorgelegd aan de gebruiker; die gaf expliciet aan de meest duurzame/professionele
optie te willen, dus zijn de aanbevolen opties hieronder de definitieve keuze — niet
een aanname van mijn kant.

1. **Locatie: `client/flow/`.** Tijdelijke, framework-agnostische naam. Claimt bewust
   niet de toekomstige `frontend/dist`-brontree uit `DEPLOYMENT-AND-TESTING.md`,
   zodat een latere bundelkeuze geen naamsconflict oplevert (zie
   [`REVIEW.md`](REVIEW.md) bevinding 1 voor de volledige afweging).
2. **Moduleformaat: native ES modules, `.mjs`.** Zonder `package.json` behandelt Node
   een kale `.js` als CommonJS; `.mjs` dwingt ESM af zonder configuratie. Dat draait
   zowel onder `node --test` als in de browser via
   `<script type="module" src="....mjs">`, zonder bundler en zonder nieuwe
   dependency. Open punt voor later, niet blokkerend: of de statische server
   (nginx/Caddy, `DEPLOYMENT-AND-TESTING.md`) `.mjs` met het juiste MIME-type
   serveert — dat is een configuratiedetail voor die eigenaar.

## Stappen

1. Maak `client/flow/.gitkeep`. Geen testbestand, geen eerste module — dat is GF1.
2. Voeg één regel toe aan `docs/game-flow-plan/README.md` dat GF0 klaar is, met de
   bevestigde locatie én het bevestigde moduleformaat.

## Harde grenzen

- Geen `package.json`, geen bundler, geen routing-library.
- Geen bestanden buiten `docs/` vóór bevestiging van stap 1.
- Max 15 bestanden / 5.000 regels voor deze fase (ruim voldoende: dit is een lege map).

## Definition of done

- `client/flow/` bestaat, met alleen een `.gitkeep`.
- Er draait nog geen test in deze fase — dat verifieert GF1, tegen een concreet
  bestand, niet tegen een lege map.
- Geen bestand buiten `docs/` en `client/flow/` is aangeraakt.
