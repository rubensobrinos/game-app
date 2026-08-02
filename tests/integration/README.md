# tests/integration/

Integratietestlaag uit
[`DEPLOYMENT-AND-TESTING.md`](../../docs/multiplayer/DEPLOYMENT-AND-TESTING.md)
§Testlagen, gebouwd via
[`docs/deployment-and-testing-plan/`](../../docs/deployment-and-testing-plan/README.md)
fase DT3.

- **DT3a — matrix (klaar):**
  [`integration-matrix.md`](../../docs/deployment-and-testing-plan/integration-matrix.md)
  legt 14 scenario's vast, elk met prerequisite en activatiecriterium. Nog geen
  code.
- **DT3b — code (0/14 rijen geactiveerd):** zie
  [`prompts/DT3b-integratie-code.md`](../../docs/deployment-and-testing-plan/prompts/DT3b-integratie-code.md).
  Een rij wordt hier pas een bestand als haar activatiecriterium aantoonbaar is
  gehaald — **geen** `test.skip`, direct een actieve test die tegen de echte
  implementatie draait en slaagt (herzien na
  [`REVIEW-DT3B-DT7.md`](../../docs/deployment-and-testing-plan/prompts/REVIEW-DT3B-DT7.md)
  #7).

**Waarom deze map nu leeg is:** elke rij vereist een implementatie die de bestaande
pure modules (`server/rules`, `server/architecture`, `server/data`,
`server/protocol`) daadwerkelijk samenvoegt. Die bestaat nog niet. Zie
[`server-composition-request.md`](../../docs/deployment-and-testing-plan/server-composition-request.md)
voor het verzoek aan architecture-plan om dat te ontgrendelen.
