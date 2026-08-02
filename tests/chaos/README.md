# tests/chaos/

Restart-/chaostestlaag uit
[`DEPLOYMENT-AND-TESTING.md`](../../docs/multiplayer/DEPLOYMENT-AND-TESTING.md)
§Testlagen, gebouwd via
[`docs/deployment-and-testing-plan/`](../../docs/deployment-and-testing-plan/README.md)
fase DT6.

- **Deel 1 — runbook + preflight (klaar, 0/6 uitgevoerd):**
  [`chaos-runbook.md`](../../docs/deployment-and-testing-plan/chaos-runbook.md)
  beschrijft zes scenario's (game-server-restart, Redis-restart, PostgreSQL weg,
  tunnel-reconnect, host offline, 10% disconnect/reconnect), elk met een
  preflight-stap die de aannames van het runbook tegen de échte Compose-stack
  controleert vóórdat een scenario draait.
- **Deel 2 — uitvoering:** drie losse, apart geautoriseerde momenten (installeren/
  opstarten → resetten → scenario uitvoeren), pas als de Compose-stack bestaat.

Puur tekst tot nu toe — geen commando uit het runbook is ooit uitgevoerd, en er
staat hier geen enkel scriptbestand, alleen `.gitkeep`.
