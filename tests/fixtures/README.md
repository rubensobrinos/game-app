# tests/fixtures/

Gedeelde testdata-factories, gebouwd via
[`docs/deployment-and-testing-plan/`](../../docs/deployment-and-testing-plan/README.md)
fase DT2.

- [`index.js`](index.js) — pure factoryfuncties (`makeRoom`, `makeSession`,
  `makePlayer`, `makeMatch`, `makeRound`, `makeAnswer`) met defaults conform de
  JSON-voorbeelden in
  [`DATA-MODEL.md`](../../docs/multiplayer/DATA-MODEL.md), elk met een
  `overrides`-parameter voor per-test afwijkingen.
- [`index.test.js`](index.test.js) — bevestigt dat elke factory zonder argumenten
  exact de veldenset uit het corresponderende `DATA-MODEL.md`-voorbeeld teruggeeft.

**Status:** ✅ uitgevoerd en geslaagd — `node --test tests/fixtures/index.test.js`
draait 7/7 groen. **Voorstel, geen bindend contract:** de vorm volgt `DATA-MODEL.md`
zoals het er nu staat; de eigenaar van dat document kan de vorm nog laten wijzigen.

Geen dependency, geen I/O, geen Redis — puur in-memory objecten.
