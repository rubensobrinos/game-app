# server/rules/

Deze map realiseert [`docs/multiplayer/GAME-RULES.md`](../../docs/multiplayer/GAME-RULES.md)
volgens het uitvoeringsplan in
[`docs/game-rules-plan/README.md`](../../docs/game-rules-plan/README.md).

## Locatie: voorlopig

Deze plek staat naast `server/protocol/` (protocol-plan) en
`server/architecture/` (architecture-plan) en is **niet definitief**. Ze kan
verschuiven zodra architecture-plan's AR5/AR6-voorstel voor een serverskeleton
landt en een bindende mapindeling oplevert (`architecture`-checkpoint).

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
| question-selection | — | 📝 Spec klaar, nog niet gebouwd | GR4 | — |
| rematch-exclusion | — | 📝 Spec klaar, nog niet gebouwd | GR4 | — |
| late-join | — | ⬜ Nog niet gestart | GR5 | — |
| disconnect-accounting | — | ⬜ Nog niet gestart | GR5 | — |
| teams-scoring | — | ⬜ Nog niet gestart (fase 1.5, na Golf 1) | GR6 | — |

**Totaal nu:** 94/94 tests groen (`node --test server/rules/*.test.js`).

Zie [`docs/game-rules-plan/GR-PROGRESS.md`](../../docs/game-rules-plan/GR-PROGRESS.md)
voor dekking per sectie van `GAME-RULES.md` en
[`docs/game-rules-plan/HANDOFF.md`](../../docs/game-rules-plan/HANDOFF.md) voor
openstaande punten richting `server/protocol/` en `server/architecture/`.
