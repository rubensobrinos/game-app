# tests/integration/

Integratietestlaag uit
[`DEPLOYMENT-AND-TESTING.md`](../../docs/multiplayer/DEPLOYMENT-AND-TESTING.md)
§Testlagen, gebouwd via
[`docs/deployment-and-testing-plan/`](../../docs/deployment-and-testing-plan/README.md)
fase DT3.

- **DT3a — matrix (klaar):**
  [`integration-matrix.md`](../../docs/deployment-and-testing-plan/integration-matrix.md)
  legt 14 scenario's vast, elk met prerequisite en activatiecriterium.
- **DT3b — code (12 van de 14 rijen geactiveerd, stand 6 aug 2026):** zie
  [`prompts/DT3b-integratie-code.md`](../../docs/deployment-and-testing-plan/prompts/DT3b-integratie-code.md).
  Een rij wordt hier pas een bestand als haar activatiecriterium aantoonbaar is
  gehaald — **geen** `test.skip`, direct een actieve test die tegen de echte
  implementatie draait en slaagt (herzien na
  [`REVIEW-DT3B-DT7.md`](../../docs/deployment-and-testing-plan/prompts/REVIEW-DT3B-DT7.md)
  #7).

**Deze map is niet meer leeg** (gecorrigeerd 6 aug 2026). Er staan zestien
testbestanden en ze draaien mee in elke `npm test`: twaalf matrixrijen plus
`full-match`, `full-match-transport`, `games-vertical` en `metrics`.

De blokkade die hier beschreven stond — "elke rij vereist een implementatie die
de pure modules samenvoegt, die bestaat nog niet" — is opgeheven toen
`server/composition/` er kwam. Deze tekst bleef staan omdat niemand terugkwam
op een README nadat de reden om te wachten verdween.
