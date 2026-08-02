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

Legenda: ✅ gebouwd en getest — ⬜ prompt klaar, nog niet gebouwd (wacht op
akkoord, zie [`docs/data-model-plan/DM-PROGRESS.md`](../../docs/data-model-plan/DM-PROGRESS.md)
§Cijfers). Status hieronder is de daadwerkelijke stand van dit bestandensysteem,
niet een planningsintentie.

| Module | DM-fase | Status | Tests | Omschrijving |
| --- | --- | --- | --- | --- |
| `redis-keys.js` | DM1 | ✅ | 65 | Pure Redis-key-builders met invoervalidatie |
| `ttl.js` | DM1 | ✅ | 1 | `ROOM_TTL_SECONDS` |
| `types/game-configuration.js` | DM2a | ⬜ | — | Prompt klaar: [`prompts/DM2a-…`](../../docs/data-model-plan/prompts/DM2a-game-configuration-and-session.md) |
| `types/session.js` | DM2a | ⬜ | — | Prompt klaar, zelfde bestand als hierboven |
| `types/room-core.js` | DM2b | ⬜ | — | Prompt klaar: [`prompts/DM2b-room.md`](../../docs/data-model-plan/prompts/DM2b-room.md); `contentVersion`/`rendererVersion` blijven expliciet pending achter checkpoint 4 |
| `types/game-types.js` | DM3 | ⬜ | — | Gedeeld hulptype, onderdeel van de DM3-prompt |
| `types/player.js` | DM3 | ⬜ | — | Prompt klaar: [`prompts/DM3-…`](../../docs/data-model-plan/prompts/DM3-player-match-round-answer-presentation.md) |
| `types/match.js` | DM3 | ⬜ | — | Zelfde prompt |
| `types/round.js` | DM3 | ⬜ | — | Zelfde prompt, incl. `toActiveRoundSnapshot()` |
| `types/answer.js` | DM3 | ⬜ | — | Zelfde prompt |
| `types/room-presentation.js` | DM3 | ⬜ | — | Zelfde prompt |
| `name-processing.js` | DM4 | ⬜ | — | Prompt klaar: [`prompts/DM4-name-processing.md`](../../docs/data-model-plan/prompts/DM4-name-processing.md) |
| `privacy-guard.js` | DM5 | ⬜ | — | Prompt klaar: [`prompts/DM5-privacy-guard.md`](../../docs/data-model-plan/prompts/DM5-privacy-guard.md) |
| `repository.js` | DM6 | ⬜ | — | Prompt klaar: [`prompts/DM6-repository-port.md`](../../docs/data-model-plan/prompts/DM6-repository-port.md) |
| `in-memory-store.js` | DM6 | ⬜ | — | Zelfde prompt, testfake |
| `answer-flow.js` | DM7 | ⬜ | — | Prompt klaar: [`prompts/DM7-answer-flow.md`](../../docs/data-model-plan/prompts/DM7-answer-flow.md) |

Alle negen DM2–DM9-prompts zijn geschreven én onafhankelijk herzien
([`prompts/REVIEW-DM2-DM9.md`](../../docs/data-model-plan/prompts/REVIEW-DM2-DM9.md)),
maar nog niet uitgevoerd — uitvoering wacht op akkoord (zie
[`docs/data-model-plan/README.md`](../../docs/data-model-plan/README.md) §10).

`analytics/` levert in deze fase geen `server/`-code — DM8 blijft een voorstel
onder `docs/data-model-plan/prompts/DM8-analytics-proposal.md`, bewust nog niet
als runtimecode.
