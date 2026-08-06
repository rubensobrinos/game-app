# tests/

Cross-cutting testlagen voor de multiplayer-realisatie, beheerd volgens
[`docs/deployment-and-testing-plan/README.md`](../docs/deployment-and-testing-plan/README.md)
(fase DT0 en verder). Dit is bewust gescheiden van de co-located unittests van elke
module-eigenaar (`server/rules/*.test.js`, `server/protocol/*.test.mjs`,
`client/flow/*.test.mjs`, `shared/product/*.test.mjs`, enz.) — die blijven bij hun
eigen module, dit is voor lagen die over meerdere modules heen gaan of nog geen
eigenaar-module hebben.

| Map | Laag | Status |
| --- | --- | --- |
| [`contract/`](contract/) | Contracttests | Bij mij vervallen (DT1b) — protocol-plan bouwt dit zelf, zie `contract/protocol/` |
| [`integration/`](integration/) | Integratietests over echt HTTP en echte websockets | 16 bestanden, 12 van de 14 matrixrijen actief (6 aug 2026) |
| [`e2e/`](e2e/) | Browser-E2E | Pseudocode klaar (DT4a), nog geen code |
| [`load/`](load/) | Loadtests | Evidence-tabel klaar (DT5), nog geen script |
| [`chaos/`](chaos/) | Restart-/chaostests | Runbook klaar (DT6), nog geen uitvoering |
| [`fixtures/`](fixtures/) | Gedeelde testdata | Klaar (DT2), 7/7 tests groen |

Canoniek testcommando per laag zodra er bestanden zijn:
`node --test tests/<laag>/*.test.js` (of `*.test.mjs` waar van toepassing) — nooit
`node --test <map>` zonder glob, zie
[`docs/deployment-and-testing-plan/prompts/DT0-scaffold.md`](../docs/deployment-and-testing-plan/prompts/DT0-scaffold.md)
voor waarom dat op een lege/gedeeltelijk gevulde map faalt.

De actuele voortgang per fase, met bewijsniveau (voorbereiding/testcode/uitgevoerd/
geblokkeerd), staat in
[`docs/deployment-and-testing-plan/DT-PROGRESS.md`](../docs/deployment-and-testing-plan/DT-PROGRESS.md).
