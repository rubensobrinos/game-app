# Prompt — DM0: Scaffold

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM0. Doel: een
lege map neerzetten voor de data-model-module, zonder nieuwe dependencies en zonder
vooruit te lopen op een architectuurbeslissing.

**Gebaseerd op [`REVIEW.md`](../REVIEW.md), bevinding 14**: een lege map kan niet met
`node --test <map>` worden geverifieerd — op de lokaal aanwezige Node.js v24.16.0
probeert dat de map als module te laden en faalt met `MODULE_NOT_FOUND` (exitcode 1).
Zelf getest, niet aangenomen. De echte testrun verhuist naar DM1.

## Context

- `server/rules/` (`GAME-RULES.md`-plan) en `server/architecture/`
  (`ARCHITECTURE.md`-plan) bestaan al in deze repo, beide als kale mappen met
  losse `.js`/`.test.js`-bestanden zonder `package.json`. Dat is een sterk precedent
  voor `server/data/` als locatie, maar geen vervanging voor expliciete bevestiging
  (checkpoint 1 in het plan) — ik neem niet aan dat mijn locatiekeuze al is
  goedgekeurd alleen omdat de sibling-mappen bestaan.
- De hele repo draait zonder build-stap en zonder dependencies.
- `ARCHITECTURE.md` noemt uiteindelijk Node.js 22 + TypeScript + Fastify + Socket.IO
  voor de game-server — een beslissing over de hele server, niet over waar een
  geïsoleerde, framework-agnostische data-module tijdelijk kan wonen.

## Stappen

1. **Stel de locatie voor, wacht op bevestiging.** Voorstel: `server/data/`, naast
   (niet in) `server/rules/` en `server/architecture/`. Vraag expliciet akkoord
   voordat je iets aanmaakt. Ga pas door naar stap 2 na een go.
2. Maak na bevestiging uitsluitend:
   - `server/data/.gitkeep` — de map bevat verder niets. Het eerste echte
     modulebestand (`redis-keys.js`, `ttl.js`) hoort in DM1, niet hier.
   - Geen `package.json`.
3. Verifieer alleen structuur, niet gedrag:
   - de map en `.gitkeep` bestaan;
   - `git status` toont ze als toe te voegen/getrackt, niet als genegeerd;
   - geen `package.json`, lockfile of `node_modules` bijgekomen.
   Draai hier bewust **geen** `node --test` — tegen een map zonder testbestand geeft
   dat op Node.js v24 een `MODULE_NOT_FOUND`-fout, geen geldig "leeg maar werkend"
   resultaat (zie boven). De eerste echte testrun gebeurt in DM1, met
   `node --test 'server/data/**/*.test.js'` (glob, geen kaal directorypad).
4. Vul in `docs/data-model-plan/README.md` sectie 3 (Fasering — status) de statusregel
   voor DM0 aan met waar de code staat. Niet verder herschrijven.

## Harde grenzen

- Geen `npm init`, geen `package.json`, geen dependency.
- Geen bestanden buiten `docs/` aanmaken vóór expliciete bevestiging van de locatie
  uit stap 1.
- Max 15 bestanden / 5.000 regels voor deze fase (ruim voldoende voor een lege scaffold).

## Definition of done

- Locatie is bevestigd door de gebruiker, niet aangenomen — ook niet op basis van het
  `server/rules/`/`server/architecture/`-precedent.
- `server/data/.gitkeep` bestaat en is door Git getrackt.
- Geen `package.json`, lockfile of ander dependency-artefact aanwezig.
- Geen bestand buiten `docs/` en de bevestigde map is aangeraakt.
- Geen `node --test`-run tegen de lege map geprobeerd.

**Status: uitgevoerd.** Locatie `server/data/` gebruikt (naast `server/rules/` en
`server/architecture/`). `.gitkeep` aangemaakt en bevestigd als getrackt
(`git status --short server/` toont `?? server/`, niet genegeerd), geen
`package.json`, lockfile of dependency toegevoegd.
