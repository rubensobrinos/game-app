# tests/contract/

Contracttestlaag uit
[`DEPLOYMENT-AND-TESTING.md`](../../docs/multiplayer/DEPLOYMENT-AND-TESTING.md)
§Testlagen. Oorspronkelijk gepland als DT1b in
[`docs/deployment-and-testing-plan/`](../../docs/deployment-and-testing-plan/README.md),
maar **vervallen**: de `PROTOCOL.md`-eigenaar claimde en bouwt deze laag zelf
(protocol-plan's PR7), tegen de échte modules in `server/protocol/` in plaats van
tegen een door deployment-and-testing-plan afgeleide fixture — zie
[`README.md`'s bijwerking 2026-08-02](../../docs/deployment-and-testing-plan/README.md).

- [`protocol/`](protocol/) — protocol-plan's fake-Fastify/fake-Socket.IO-harnas
  (PR7) en de contractscenario's die daartegen draaien. Eigendom van
  [`docs/protocol-plan/`](../../docs/protocol-plan/README.md), niet van
  deployment-and-testing-plan.

Deployment-and-testing-plan's eigen bijdrage aan deze laag is uitsluitend
documentair: een onafhankelijke traceability-matrix
([`traceability-matrix.md`](../../docs/deployment-and-testing-plan/traceability-matrix.md),
26 open beslispunten) plus een kruisverwijzing met protocol-plan's eigen 15 "Open
vragen" — geen code in deze map namens dat plan.
