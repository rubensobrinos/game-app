# server/rules/

Deze map realiseert [`docs/multiplayer/GAME-RULES.md`](../../docs/multiplayer/GAME-RULES.md)
volgens het uitvoeringsplan in
[`docs/game-rules-plan/README.md`](../../docs/game-rules-plan/README.md).

## Locatie

Deze map staat waar hij staat. De eerdere kanttekening dat hij "kan verschuiven
zodra het serverskeleton landt" is ingetrokken (6 aug 2026): dat skeleton draait
allang, en geen van deze mappen is verhuisd. De indeling is daarmee stilzwijgend
definitief geworden — nu ook hardop.


## Moduleformaat

- Platte JavaScript, CommonJS (`.js`, `module.exports`) — anders dan
  `server/protocol/`'s native ES modules (`.mjs`); nog niet gereconcilieerd,
  zie [`docs/game-rules-plan/HANDOFF.md`](../../docs/game-rules-plan/HANDOFF.md) §4.
- Typering via JSDoc, geen TypeScript.
- Testrunner: Node's ingebouwde `node --test`, tegen expliciete bestanden,
  bijv. `node --test server/rules/scoring.test.js` (of `server/rules/*.test.js`
  voor de hele map) — nooit tegen een directorypad zonder patroon.
- Geen `package.json`, geen enkele nieuwe dependency.
- Pure logica: geen Redis, geen sockets, geen REST, geen timers. Elke module
  krijgt platte data binnen en geeft platte data terug.

## Modules

Legenda: ✅ klaar en geverifieerd — 📝 spec klaar, nog niet gebouwd —
⬜ nog niet gestart.

| Module | Bestand(en) | Status | GR-fase | Tests |
| --- | --- | --- | --- | --- |
| scoring | `scoring.js` | ✅ Klaar | GR1 | 32/32 |
| standings | `standings.js` | ✅ Klaar | GR2 | 23/23 |
| validators | `validators.js` | ✅ Klaar | GR3 | 39/39 |
| question-selection (incl. rematch-exclusion) | `question-selection.js` | ✅ Klaar | GR4 | 26/26 |
| eligibility (late-join + disconnect-accounting) | `eligibility.js` | ✅ Klaar | GR5 | 25/25 |
| answer-distribution | `answer-distribution.js` | ✅ Klaar | GR8 | 12/12 |
| ~~teams-scoring~~ | — | **Gesloten** — producteigenaar: "Teams worden nu niet gebouwd" | GR6 | — |

**Testen:** `node --test 'server/rules/**/*.test.js'`. Bewust geen aantal hier — dat is verouderd zodra iemand een test toevoegt.
Alle geplande GR-fases voor `GAME-RULES.md` zijn hiermee afgerond (GR6
gesloten, GR7 ingehaald door `HANDOFF.md`).

Zie [`docs/game-rules-plan/GR-PROGRESS.md`](../../docs/game-rules-plan/GR-PROGRESS.md)
voor dekking per sectie van `GAME-RULES.md` en
[`docs/game-rules-plan/HANDOFF.md`](../../docs/game-rules-plan/HANDOFF.md) voor
openstaande punten richting `server/protocol/` en `server/architecture/`.
