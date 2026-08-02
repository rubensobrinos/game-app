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

## `docs/multiplayer/DECISIONS.md`

Op 2 augustus 2026 heeft de producteigenaar een aantal openstaande checkpoints
bindend besloten. Voor deze map het belangrijkste: **checkpoint 4 is opgelost**
— `contentVersion`/`rendererVersion` zijn canoniek en onveranderlijk op
`Match`, niet op `Room` (`DECISIONS.md` #21). `types/room.js` heette daardoor
tot voor kort `types/room-core.js`/`RoomCore` (een bewust gemarkeerde
tussenvorm zolang checkpoint 4 open stond) en is teruggedoopt naar het
volwaardige `Room`-type zodra de beslissing viel
(`docs/data-model-plan/prompts/DM-RESUME-AFTER-DECISIONS.md`).

## Modules

Legenda: ✅ gebouwd en getest.

| Module | DM-fase | Status | Tests |
| --- | --- | --- | --- |
| `redis-keys.js` | DM1, `sessionTokenLookupKey` toegevoegd (reactie op INTB-10) | ✅ | 67 |
| `ttl.js` | DM1 | ✅ | 1 |
| `types/game-configuration.js` | DM2a | ✅ | 27 |
| `types/session.js` | DM2a | ✅ | 17 |
| `types/room.js` (hernoemd van `room-core.js`) | DM2b | ✅ | 24 |
| `types/game-types.js` | DM3 | ✅ | gedeeld hulptype, getest via `game-configuration.test.js`/`round.test.js` |
| `types/player.js` | DM3 | ✅ | 31 |
| `types/match.js` (incl. `contentVersion`/`rendererVersion`, DECISIONS.md #21) | DM3 | ✅ | 32 |
| `types/round.js` (incl. `toActiveRoundSnapshot(round, match)`) | DM3 | ✅ | 36 |
| `types/answer.js` | DM3 | ✅ | 17 |
| `types/room-presentation.js` | DM3 | ✅ | 9 |
| `name-processing.js` | DM4 | ✅ | 34 |
| `privacy-guard.js` | DM5 | ✅ | 109 |
| `repository.js` + `in-memory-store.js` | DM6, uitgebreid door DM10–DM16 | ✅ | 59 |
| `answer-flow.js` | DM7, becommentarieerd door DM13/DM15 | ✅ | zie `docs/data-model-plan/DM-PROGRESS.md` |
| `types/player.js`'s `toStandingPlayerView()` | DM9 | ✅ | zie `docs/data-model-plan/DM-PROGRESS.md` |

**Totaal: 494 tests groen** (`node --test 'server/data/**/*.test.js'`) na
DM0–DM16. Analytics (DM8) levert bewust geen `server/`-code — dat blijft een
voorstel onder `docs/data-model-plan/proposals/`, niet als runtimecode
(`REVIEW-DM2-DM9.md` bevinding 11).

**DM10–DM16** (`docs/data-model-plan/HANDOFF.md` §6/§7a/§9/§10/§12) breidden
de repository-poort uit als reactie op `docs/integration-plan/`'s
HANDOFF-bevindingen: `loadRoomByInviteId(inviteId)` →
`loadRoomByInviteHash(inviteHash)`;
`claimRoomLocatorsAtomically`/`releaseRoomLocators`/`refreshRoomLocators`
toegevoegd (atomaire join-code + inviteHash-claim); `saveRound`/`loadAnswer`/
`loadActionCacheEntry` room-gescoped (bredere signaturen, geen nieuwe velden
op `Round`/`Answer`); scoreboard op `(roomId, matchId)` i.p.v. alleen
`matchId`; `saveAcceptedAnswerAtomically` controleert idempotentie en "één
antwoord per ronde" ín de atomaire stap (DM13, reactie op INTB-4) en geeft
sinds DM15 `{ replay: boolean }` terug in plaats van niets (reactie op
INT-14); `loadSessionByTokenHash` (DM14, reactie op INT-3, deblokkeerde
INT-A's stap 2); `rotateRoomLocators` (DM16, reactie op INTB-5 🔴 — een
geroteerde uitnodiging bleef geldig, nu een atomaire, fail-safe wissel). De
in-memory fake gebruikt sindsdien geneste Maps in plaats van met een spatie
samengestelde string-sleutels voor zijn interne, samengestelde identifiers.

**De poort is sinds DM13 bevroren, met een gevolgd voorstel-proces**
(`docs/data-model-plan/HANDOFF.md` §7b): elke wijziging aan het
`DataStore`-contract gaat eerst als HANDOFF-voorstel naar INT-A én INT-B, met
hun akkoord, vóór implementatie — DM14–DM16 zijn precies zo tot stand
gekomen.

## Wat hier bewust niet gebouwd is

- Concrete Redis-/PostgreSQL-adapters — `DECISIONS.md` legt de keuzes vast
  (Redis Lua-script, officiële `redis`-npm-package, PostgreSQL), maar de
  daadwerkelijke connectiecode is `deps`/`prod` en hoort bij een latere,
  aparte fase.
- Tokenhashing-/pepper-implementatie (`auth`, `DECISIONS.md` #26).
- Teams-, spectator-, Groepsbattle- en mixed-game-ondersteuning
  (`DM-RESUME-AFTER-DECISIONS.md`: "worden nu niet gebouwd").
