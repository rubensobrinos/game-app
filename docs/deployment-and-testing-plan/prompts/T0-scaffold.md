# Prompt — T0: Mapstructuur

Onderdeel van [`docs/deployment-and-testing-plan/README.md`](../README.md), fase T0.
Doel: uitsluitend de lege testmapstructuur neerzetten — geen tests, geen
documentatie-update in dezelfde actie.

## Context (herzien na review)

[`REVIEW.md`](REVIEW.md) vond de oorspronkelijke versie van deze prompt niet
uitvoerbaar zoals geschreven:

- Ze vroeg zes bestandswijzigingen (vijf placeholdertests + een README-update) bij een
  harde limiet van vijf bestanden per actie.
- Ze gebruikte `node --test tests/` als verificatie. Op de hier geïnstalleerde
  Node v24.16.0 behandelt `node --test <map>` een expliciet meegegeven map als
  testmodule; een lege map faalt met `MODULE_NOT_FOUND`. Dat is geen geldige
  recursieve directory-discoverycheck.
- Een triviale groene `node:test` onder `e2e/`, `load/` of `chaos/` bewijst niets over
  Playwright, k6, echte browsers of een Compose-omgeving, en telt toch mee als
  "groen" — misleidend over wat er daadwerkelijk getoetst is.

Deze versie lost alle drie op: minder bestanden, geen placeholder-tests, en
bestaanscontrole in plaats van een testrun.

- Er bestaat nog geen `tests/`-map in deze repo.
- De repo draait zonder build-stap en zonder `package.json`.

## Stappen

1. **Stel de locatie voor, wacht op bevestiging.** Voorstel:
   ```
   tests/
     contract/
     integration/
     e2e/
     load/
     chaos/
   ```
   Ga pas door naar stap 2 na een go.
2. Maak na bevestiging **exact vijf bestanden**: één `.gitkeep` per map. Geen
   testbestanden, geen wijziging aan `docs/deployment-and-testing-plan/README.md` in
   deze actie — dat is T0b, een aparte, volgende actie.
3. Verifieer met een bestaanscontrole, niet met `node --test`:
   ```
   find tests -type f
   ```
   of `ls -R tests`. Dit bewijst dat de structuur bestaat; het bewijst niets over een
   testrunner en moet ook niet als zodanig worden gepresenteerd.

## Harde grenzen

- Precies 5 bestanden in deze actie, niet meer. Geen placeholder-tests, geen
  README-wijziging hier.
- Geen `npm init`, geen `package.json`, geen dependency van welke aard dan ook.
- Geen `node --test` (of een andere testrunner-aanroep) als bewijs voor deze fase —
  er is hier niets om te testen.
- Geen bestanden buiten `docs/` aanmaken vóór expliciete bevestiging van de locatie
  uit stap 1.

## Definition of done

- Locatie is bevestigd door de gebruiker, niet aangenomen.
- `tests/{contract,integration,e2e,load,chaos}/` bestaat, elk met precies één
  `.gitkeep` — vijf bestanden in totaal, verder niets.
- Een bestaanscontrole (niet een testrun) toont de structuur.
- Geen enkel bestand buiten `docs/` en de bevestigde map is aangeraakt.
- De documentatie-update (canoniek testcommando + CI-kloof, "T0 is afgerond") volgt
  in T0b, expliciet niet in deze actie.
