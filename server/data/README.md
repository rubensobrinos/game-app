# server/data/

Deze map realiseert [`docs/multiplayer/DATA-MODEL.md`](../../docs/multiplayer/DATA-MODEL.md)
volgens het uitvoeringsplan in
[`docs/data-model-plan/README.md`](../../docs/data-model-plan/README.md).

## Locatie: voorlopig

Deze plek staat naast `server/rules/` (game-rules-plan), `server/architecture/`
(architecture-plan) en `server/protocol/` (protocol-plan) en is **niet
definitief**. Ze kan verschuiven zodra architecture-plan's serverskeleton-
voorstel landt en een bindende mapindeling oplevert (`architecture`-checkpoint,
zie `docs/data-model-plan/README.md` §6 checkpoint 1).

## Moduleformaat

- Platte JavaScript, CommonJS (`.js`, `module.exports`) — zelfde als
  `server/rules/`, anders dan `server/protocol/`'s `.mjs`. Zie
  `docs/data-model-plan/HANDOFF.md` §4 voor die constatering.
- Typering via JSDoc, geen TypeScript.
- Testrunner: Node's ingebouwde `node --test`, altijd tegen een expliciete glob,
  bijv. `node --test 'server/data/**/*.test.js'` — nooit tegen een kaal
  directorypad (zie `docs/data-model-plan/prompts/DM0-scaffold.md` voor waarom:
  op Node.js v24 geeft dat een `MODULE_NOT_FOUND`-fout, geen geldig "leeg maar
  werkend" resultaat).
- Geen `package.json`, geen enkele nieuwe dependency.
- Fasewaarden (`LOBBY`/.../`FINISHED`) en `pacing`-waarden (`auto`/`host`)
  worden **lokaal getranscribeerd**, niet geïmporteerd uit
  `server/architecture/state-machine.js` — dat bestand is een gedragslaag, geen
  neutrale constantsmodule. Zie `docs/data-model-plan/HANDOFF.md` §5 voor een
  voorstel om dit later via een gedeelde module op te lossen.

## Modules

Gebouwd (zie [`docs/data-model-plan/DM-PROGRESS.md`](../../docs/data-model-plan/DM-PROGRESS.md)
voor de actuele status per `DATA-MODEL.md`-sectie):

- `redis-keys.js` — pure Redis-key-builders met invoervalidatie (DM1).
- `ttl.js` — `ROOM_TTL_SECONDS` (DM1).

Nog te bouwen (prompts klaar, zie
[`docs/data-model-plan/prompts/README.md`](../../docs/data-model-plan/prompts/README.md)):
`types/game-configuration.js`, `types/session.js`, `types/room-core.js`,
`types/game-types.js`, `types/player.js`, `types/match.js`, `types/round.js`,
`types/answer.js`, `types/room-presentation.js`, `name-processing.js`,
`privacy-guard.js`, `repository.js`, `in-memory-store.js`, `answer-flow.js`.

`analytics/` levert in deze fase geen `server/`-code — dat blijft een voorstel
onder `docs/data-model-plan/proposals/` (DM8), bewust nog niet als runtimecode.
