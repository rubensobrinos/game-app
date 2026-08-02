# server/data/types/

Entiteitstypes uit [`docs/multiplayer/DATA-MODEL.md`](../../../docs/multiplayer/DATA-MODEL.md):
JSDoc-`@typedef` + een `assert*Shape(value)`-vormcontrole per entiteit. Zie
[`../README.md`](../README.md) voor het moduleformaat (CommonJS, geen
dependencies, `node --test` tegen een expliciete glob).

| Module | DM-fase | Tests | Typedef |
| --- | --- | --- | --- |
| `game-types.js` | DM3 | gedeeld, getest via `game-configuration.test.js`/`round.test.js` | `GOLF_1_GAME_TYPES` (geen entiteit, een gedeelde enum) |
| `game-configuration.js` | DM2a | 27 | `GameConfiguration` |
| `session.js` | DM2a | 17 | `Session` |
| `room.js` | DM2b | 24 | `Room` (hernoemd van `RoomCore`/`room-core.js` — zie `../README.md` "`docs/multiplayer/DECISIONS.md`") |
| `player.js` | DM3 (+ DM9) | 34 | `Player`, plus `toStandingPlayerView()` (DM9 — projectie voor `server/rules/standings.js`'s `rankPlayers()`) |
| `match.js` | DM3 | 32 | `Match` (incl. `contentVersion`/`rendererVersion`, `DECISIONS.md` #21) |
| `round.js` | DM3 | 36 | `Round` (incl. `validOptionIds`/`resultDetails`), plus `toActiveRoundSnapshot(round, match)` |
| `answer.js` | DM3 | 17 | `Answer` |
| `room-presentation.js` | DM3 | 9 | `RoomPresentation` (optioneel) |

Twee bestanden (`room.js`, `match.js`) transcriberen dezelfde zeven
fasewaarden (`LOBBY`/`COUNTDOWN`/.../`FINISHED`) lokaal i.p.v. te importeren
uit `server/architecture/state-machine.js` — zie `../README.md` voor waarom, en
`match.test.js` voor de cross-bestand-consistentietest die de twee kopieën
tegen elkaar bewaakt.

Volledige testcommando voor alleen deze map:
`node --test 'server/data/types/**/*.test.js'`.
