# Prompt — DT2: Voorstel gedeelde testfixtures

Onderdeel van [`docs/deployment-and-testing-plan/README.md`](../README.md), fase
DT2. Doel: pure data-factories voor Room/Session/Player/Match/Round/Answer conform
`DATA-MODEL.md`, als voorstel voor iedereen die integratie- of E2E-tests schrijft.

## Context

- Bron: [`docs/multiplayer/DATA-MODEL.md`](../../multiplayer/DATA-MODEL.md) — de
  JSON-voorbeelden voor Room, Session, Player, Match, Round, Answer.
- Dit is een voorstel, geen ADR: de eigenaar van `DATA-MODEL.md` kan de vorm nog
  wijzigen. Fixtures die daarvan afwijken moeten makkelijk aan te passen zijn — dus
  overrides toestaan, niets hardcoden dat niet in de spec staat.
- Geen nieuwe dependency: pure JavaScript-object-factories, geen validatielibrary.

## Stappen

1. Eén bestand `tests/fixtures/index.js` met een factoryfunctie per entiteit
   (`makeRoom(overrides)`, `makeSession(overrides)`, `makePlayer(overrides)`,
   `makeMatch(overrides)`, `makeRound(overrides)`, `makeAnswer(overrides)`), elk met
   defaults die exact overeenkomen met de voorbeelden in `DATA-MODEL.md` en een
   `overrides`-object om per test af te wijken.
2. Eén los testbestand `tests/fixtures/index.test.js` dat controleert dat elke
   factory zonder argumenten een object teruggeeft met exact de velden uit het
   bijbehorende `DATA-MODEL.md`-voorbeeld — geen extra, geen ontbrekende velden.
3. Vermeld bovenaan `index.js` in een korte regel dat dit een voorstel is en dat de
   `DATA-MODEL.md`-eigenaar de vorm kan laten wijzigen.

## Harde grenzen

- Maximaal 2 bestanden: `tests/fixtures/index.js` en `tests/fixtures/index.test.js`.
- Geen dependency toevoegen, geen `package.json`.
- Geen Redis, geen opslag, geen I/O — uitsluitend platte object-factories.

## Definition of done

- Beide bestanden bestaan; `node --test tests/fixtures/index.test.js` draait groen.
- Elke factory dekt exact de velden uit het corresponderende `DATA-MODEL.md`-
  voorbeeld, geen extra aannames.
