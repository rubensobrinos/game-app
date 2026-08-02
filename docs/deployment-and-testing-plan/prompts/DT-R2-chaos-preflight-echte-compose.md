# Prompt — DT-R2: Chaos-runbook valideren tegen het echte `docker-compose.yml`

Onderdeel van [`DT-RESUME-AFTER-DECISIONS.md`](DT-RESUME-AFTER-DECISIONS.md).
Doel: de documentaannames in [`chaos-runbook.md`](../chaos-runbook.md) (die
geschreven zijn vóórdat er een echt Compose-bestand was) vergelijken met het
inmiddels bestaande `docker-compose.yml`, en corrigeren waar nodig — **zonder** de
stack te starten.

## Context

- `chaos-runbook.md` is geschreven tegen de referentie-Compose in
  `DEPLOYMENT-AND-TESTING.md`. Er bestaat inmiddels een echt `docker-compose.yml`
  in de repo-root, met een `compose.tunnel.override.yml`. Dit is een statische
  tekstvergelijking, geen uitvoering — dat blijft Deel 2, apart geautoriseerd.
- [`REVIEW-DT3B-DT7.md`](REVIEW-DT3B-DT7.md) #9 vroeg precies deze stap.

## Stappen

1. Vergelijk regel voor regel: servicenamen (`reverse-proxy`, `frontend`,
   `game-server`, `redis`, `postgres`, `cloudflared`), healthcheck-`interval`/
   `retries` per service, Redis' `--appendonly`/`--appendfsync`-vlaggen, en het
   `tunnel`-profiel, tussen `chaos-runbook.md`'s aannames en het echte
   `docker-compose.yml` + `compose.tunnel.override.yml`.
2. Corrigeer elke afwijking die je vindt direct in `chaos-runbook.md` (bijv. een
   ander healthcheck-interval, een andere volumenaam, een ontbrekende service).
3. Vul de "Preflight tegen de échte stack"-stap (in de sectie "Volgorde die voor
   élk scenario geldt") aan met een concrete verwijzing naar het daadwerkelijke
   bestand (`docker-compose.yml`) in plaats van alleen "de échte stack" abstract
   te noemen.
4. Noteer expliciet welke aannames **bevestigd** zijn (klopt met het echte
   bestand) versus welke **gecorrigeerd** zijn — niet alleen de eindstand, ook wat
   er fout stond, zodat duidelijk is dat dit een echte vergelijking was en geen
   automatische aanname dat het wel klopt.

## Harde grenzen

- Geen `docker compose`-commando uitvoeren, ook niet als "test" van deze stap.
- Alleen `chaos-runbook.md` wijzigen; geen ander bestand.
- Als `docker-compose.yml` een service of instelling bevat die niet in het
  runbook staat (bijv. de `frontend`-mounts), dat expliciet benoemen in plaats van
  te negeren — ook als het geen chaos-scenario direct raakt.

## Definition of done

- Elke aanname in `chaos-runbook.md` is expliciet gemarkeerd als bevestigd of
  gecorrigeerd tegen het echte bestand, met citaat.
- Geen enkel commando uit het runbook is uitgevoerd.
