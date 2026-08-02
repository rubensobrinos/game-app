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

## CT-3 → INT-A/GR: real_or_fake_flag nog niet gedekt (open)

De seed-deterministische `generateFlagSpec(seed)` (CT1 prioriteit 2) is nog
niet gebouwd; tot die tijd kan de keten-test die spelvorm overslaan of de
integrator injecteert tijdelijk zelf een stub conform het contract in
`GR4-question-selection.md`. Volgende CT-klus.
