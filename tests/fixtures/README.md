# tests/fixtures/

Gedeelde testdata-factories, gebouwd via
[`docs/deployment-and-testing-plan/`](../../docs/deployment-and-testing-plan/README.md)
fase DT2.

- [`index.js`](index.js) — pure factoryfuncties (`makeGameConfiguration`,
  `makeRoom`, `makeSession`, `makePlayer`, `makeMatch`, `makeRound`,
  `makeAnswer`) met defaults conform de JSON-voorbeelden in
  [`DATA-MODEL.md`](../../docs/multiplayer/DATA-MODEL.md), elk met een
  `overrides`-parameter voor per-test afwijkingen.
- [`index.test.js`](index.test.js) — twee dingen: (1) elke factory zonder
  argumenten moet daadwerkelijk door zijn eigen `assert*Shape` uit
  `server/data/types/` heen komen, en (2) elke factory levert exact de
  veldenset uit het corresponderende `DATA-MODEL.md`-voorbeeld.

**Status (2026-08-02, INTB-8 opgelost):** ✅ uitgevoerd en geslaagd —
`node --test tests/fixtures/index.test.js` draait 9/9 groen. `makeRoom()` en
`makeMatch()` faalden eerder op hun eigen validator (`config: {}` was geen
geldige `GameConfiguration`; `contentVersion`/`rendererVersion` stonden op
Room in plaats van op Match, precies omgekeerd aan `DECISIONS.md` #21) — een
test die op die data leunde kon dus slagen op iets wat de echte store zou
weigeren. `makeRoom()` heeft nu een volledig geldige `config` (via de nieuwe
`makeGameConfiguration()`) en niet langer `contentVersion`/`rendererVersion`;
`makeMatch()` heeft die twee velden er juist bij gekregen. **Voorstel, geen
bindend contract:** de vorm volgt `DATA-MODEL.md` zoals het er nu staat; de
eigenaar van dat document kan de vorm nog laten wijzigen.

Geen dependency, geen I/O, geen Redis — puur in-memory objecten.
