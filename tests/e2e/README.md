# tests/e2e/

Browser-E2E-laag uit
[`DEPLOYMENT-AND-TESTING.md`](../../docs/multiplayer/DEPLOYMENT-AND-TESTING.md)
§Testlagen, gebouwd via
[`docs/deployment-and-testing-plan/`](../../docs/deployment-and-testing-plan/README.md)
fase DT4a.

- **Deel 1 — pseudocode (klaar, 0/6 uitvoerbaar):**
  [`e2e-playwright-scenarios.md`](../../docs/deployment-and-testing-plan/e2e-playwright-scenarios.md)
  beschrijft 6 scenario's als leesbare stappen, elk met een eigen
  implementatieprerequisite — er bestaat nog geen geïntegreerde, gerenderde UI om
  te besturen.
- **Deel 2 — echte specs:** pas na een `deps`-akkoord voor Playwright én de
  betreffende prerequisite. Nog geen enkel bestand hier.

Wat Playwright niet betrouwbaar kan bewijzen (schermlock, native share, echte
Safari/iPhone, echte trage 4G) staat niet hier, maar in
[`device-matrix.md`](../../docs/deployment-and-testing-plan/device-matrix.md)
(DT4b) — een handmatig runbook, geen code, ook niet in deze map.
