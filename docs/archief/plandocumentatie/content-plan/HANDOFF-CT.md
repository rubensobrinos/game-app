# HANDOFF — CT (contentmodule)

## CT-1 → INT-A: pool beschikbaar (2 aug 2026)

`shared/content/` staat er: `getCountryPool()` levert de volledige
ContentEntry-array (230 landen, diep bevroren) conform
`docs/game-rules-plan/CONTENT-POOL-INTERFACE.md`; daarnaast `CONTENT_VERSION`
en `mapRoomDifficulty()` (normal→medium — gebruik déze, geen eigen mapping).
Integratietest in `shared/content/index.test.mjs` bewijst compatibiliteit met
`buildMatchQuestionPlan()` voor flags_mc, capitals_mc, higher_lower en
odd_one_out. Je tijdelijke pool in `content-source.mjs` kan eruit.

## CT-2 → GR: bevestiging contract (2 aug 2026)

Pool gebouwd exact naar jouw interface-document, beide gotchas afgedekt met
tests. Extra velden `aliases`/`capitalAliases` toegevoegd (golf 2); jouw code
leest ze niet. Geen wijzigingen aan jouw modules nodig.

## CT-3 → INT-A/GR: GESLOTEN (2 aug 2026, avond)

`generateFlagSpec(seed)` bestaat: `shared/content/flag-spec.mjs`, ook
ge-export via `shared/content/index.mjs`. Seed-deterministisch, contractvorm
`{ pattern, palette, rendererVersion }`, integratie met
`buildMatchQuestionPlan` bewezen in `flag-spec.test.mjs`.

**Voor INT-A:** de `poolSize() === 0`-gate op `real_or_fake_flag` kan open —
injecteer `generateFlagSpec` uit `shared/content`. Golf 1 is daarmee
content-compleet.

**Voor UI/renderer (later):** de spec gebruikt exact het vocabulaire van de
bestaande singleplayer-canvasrenderer (`generateFakeFlag` in app.js) onder de
naam `flag-renderer-1` — die renderer is herbruikbaar. Nieuw t.o.v.
singleplayer: een denylijst-wering die voorkomt dat een "nepvlag" per toeval
een bestaande vlag is (het Frankrijk-probleem). Advies: neem die wering t.z.t.
ook mee terug de singleplayer in.
