# Prompt — T3a: Testmatrix integratielaag

Onderdeel van [`docs/deployment-and-testing-plan/README.md`](../README.md), fase
T3a. Doel: een genummerde matrix van integratiescenario's uit
`DEPLOYMENT-AND-TESTING.md` §Testlagen → Integratie, mét eigenaar-afhankelijkheid
en activatiecriterium — nog geen uitvoerbare code.

## Context

- [`REVIEW.md`](REVIEW.md) #6: onbeperkte `test.skip`-specs kunnen permanent groen
  blijven zonder ooit echt te draaien. Deze matrix is de stap ervoor: eerst
  vastleggen wát er moet gebeuren en wannéér het geactiveerd mag worden, pas
  daarna (T3b) code met verval-/eigenaarmetadata.
- Bron: [`docs/multiplayer/DEPLOYMENT-AND-TESTING.md`](../../multiplayer/DEPLOYMENT-AND-TESTING.md)
  §Testlagen → Integratie, plus de temporele/idempotente checks die in T1b bewust
  zijn weggelaten uit de contractlaag (`round:progress` max. 2×/seconde,
  `actionId`-idempotentie, snapshot bevat nooit `correctAnswer` van een actieve
  ronde).

## Stappen

1. Maak `docs/deployment-and-testing-plan/integration-matrix.md` met één tabelrij
   per scenario: volgnummer | scenario | bronregel in
   `DEPLOYMENT-AND-TESTING.md` | welke andere eigenaren dit scenario raakt
   (`GAME-RULES.md`/`PROTOCOL.md`/`DATA-MODEL.md`/`ARCHITECTURE.md`) | prerequisite
   (wat moet eerst bestaan) | activatiecriterium (wanneer mag dit van matrix naar
   `test.skip`-code).
2. Dek minimaal: create met/zonder hostdeelname, join via QR/inviteId, join via
   code, optionele en gegenereerde naam, share-QR door elke speler, volledige
   match-cyclus (start→rondes→finish→rematch), lock/unlock, late join, kick +
   sessierevocation, room-isolatie tussen twee rooms, idempotente `actionId`,
   `round:progress`-frequentie, en dat een actieve snapshot nooit `correctAnswer`
   bevat.
3. Sluit af met een expliciete opmerking dat geen van deze scenario's als
   `test.skip`-code wordt geschreven vóórdat het activatiecriterium in die rij is
   gehaald.

## Harde grenzen

- Eén nieuw bestand: `docs/deployment-and-testing-plan/integration-matrix.md`.
  Geen code in `tests/integration/` in deze fase.
- Geen scenario overslaan dat expliciet in de bron staat.

## Definition of done

- Matrix bestaat, dekt alle genoemde scenario's plus de twee verplaatste
  temporele/idempotente checks plus de snapshotcheck.
- Elke rij heeft een prerequisite én een activatiecriterium — geen rij zonder.
- Geen enkel bestand in `tests/` is aangeraakt.
