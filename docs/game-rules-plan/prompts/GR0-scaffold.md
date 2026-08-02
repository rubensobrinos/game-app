# Prompt — GR0: Scaffold

Onderdeel van [`docs/game-rules-plan/README.md`](../README.md), fase GR0. Doel: een
lege map neerzetten voor de game-rules-module, zonder nieuwe dependencies en
zonder vooruit te lopen op een architecture-beslissing.

**Bijgewerkt na review** — zie [`REVIEW.md`](REVIEW.md), bevinding 5: een lege map
kan niet met `node --test` worden geverifieerd (`MODULE_NOT_FOUND` op Node.js
v24.16.0) en wordt zonder `.gitkeep` niet door Git vastgelegd. De echte testrun
verhuist naar GR1.

## Context

- Er bestaat nog geen `server/`-map of `package.json` in deze repo (geverifieerd).
- De hele repo draait momenteel zonder build-stap en zonder dependencies
  (`README.md`: "Runs entirely in the browser — no build step, no dependencies").
- `ARCHITECTURE.md` noemt uiteindelijk Node.js 22 + TypeScript + Fastify +
  Socket.IO voor de game-server, maar dat is een architectuurbeslissing over de
  hele server — niet over waar een geïsoleerde, framework-agnostische
  regels-module tijdelijk kan wonen.

## Stappen

1. **Stel de locatie voor, wacht op bevestiging.** Voorstel: `server/rules/`.
   Noem expliciet dat dit een placeholder is totdat de uiteindelijke server-layout
   architectuurmatig is vastgesteld, en vraag akkoord voordat je er iets
   aanmaakt. Ga pas door naar stap 2 na een go.
2. Maak na bevestiging uitsluitend:
   - `server/rules/.gitkeep` — de map bevat verder niets. Niet vooruit bouwen op
     GR1; het eerste echte modulebestand hoort daar, niet hier.
   - Geen `package.json`. Node's ingebouwde testrunner heeft die niet nodig.
3. Verifieer alleen structuur, niet gedrag:
   - de map en `.gitkeep` bestaan;
   - `git status` toont ze als toe te voegen/getrackt bestand, niet als
     genegeerd;
   - er is geen `package.json`, lockfile of `node_modules` bijgekomen.
   Draai hier bewust **geen** `node --test` — tegen een map zonder testbestand
   geeft dat op Node.js v24 een `MODULE_NOT_FOUND`-fout, geen geldig "leeg maar
   werkend" resultaat. De eerste echte testrun gebeurt in GR1 zodra
   `scoring.test.js` bestaat, met `node --test 'server/rules/**/*.test.js'`
   (niet met een kaal directorypad — zelfde reden).
4. Documenteer in een korte regel in `docs/game-rules-plan/README.md` (niet
   herschrijven, alleen aanvullen) dat GR0 is afgerond en waar de code staat.

## Harde grenzen

- Geen `npm init`, geen `package.json`, geen dependency van welke aard dan ook.
- Geen bestanden buiten `docs/` aanmaken vóór expliciete bevestiging van de
  locatie uit stap 1.
- Max 15 bestanden / 5.000 regels voor deze fase (ruim voldoende, dit is een lege
  scaffold).

## Definition of done

- Locatie is bevestigd door de gebruiker, niet aangenomen.
- `server/rules/.gitkeep` bestaat en is door Git getrackt.
- Geen `package.json`, lockfile of ander dependency-artifact aanwezig.
- Geen enkel bestand buiten `docs/` en de bevestigde map is aangeraakt.
- Geen `node --test`-run geprobeerd tegen de lege map — dat bewijst hier niets
  (zie hierboven) en gebeurt voor het eerst in GR1.

**Status: uitgevoerd.** Locatie `server/rules/` is gebruikt. `.gitkeep`
aangemaakt en bevestigd als getrackt (`git status` toont `?? server/`, niet
genegeerd), geen dependencies toegevoegd.
