# Prompt — DM9: Interfacereconciliatie met GAME-RULES.md

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM9.
Afhankelijk van DM3 (`Player`-typedef). Corrigeert `REVIEW.md` bevinding 11: dit
mag geen nieuwe, eenzijdig bedachte subset zijn — alleen projecties bouwen voor
een consument die **al bestaat en getest is**, niets vooruit.

## Wat wél een echte consument heeft: `rankPlayers()`

`server/rules/standings.js` (GR2, 23/23 tests groen — geverifieerd door dit
bestand te lezen, niet aangenomen) eist via `assertValidPlayerForRanking` al
letterlijk:

```js
{ id: string (niet leeg), score: number (niet-negatieve integer),
  correctCount: number (niet-negatieve integer),
  correctResponseTimeMsTotal: number (niet-negatieve integer) }
```

Dat is precies een subset van `DM3`'s `Player`-typedef. `toStandingPlayerView()`
levert die vier velden, niets meer:

```js
function toStandingPlayerView(player) {
  assertPlayerShape(player); // uit DM3
  return {
    id: player.id,
    score: player.score,
    correctCount: player.correctCount,
    correctResponseTimeMsTotal: player.correctResponseTimeMsTotal,
  };
}
```

## Wat hier NIET gebouwd wordt, en waarom (bevinding 11 recht getrokken)

- **`toEligibilityPlayerView`** — géén consument: `docs/game-rules-plan/PROGRESS.md`
  toont "Late join | GR5 | ⬜ Nog niet gestart". Zonder een echte functiesignatuur
  om tegenaan te reconciliëren zou dit weer een eenzijdig bedachte vorm zijn —
  exact bevinding 11. Wacht tot GR5 bestaat.
- **`toTeamPlayerView`** — géén consument: "Teams — fase 1.5 | GR6 | ⬜ Nog niet
  gestart", en `PRODUCT.md` merkt teams zelf al als latere uitbreiding aan. Wacht
  tot GR6 bestaat. `teamId` staat al wél in `DM3`'s `Player`-typedef (het veld
  bestaat), alleen de projectie ernaartoe niet.
- **Een projectie voor GR4 (vraagselectie)** — GR4 staat in `game-rules-plan` als
  "📝 Spec klaar, in review", nog geen samengevoegde/getande functiesignatuur.
  `Match.usedQuestionKeys`/`previousMatchQuestionKeys` (DM3) zijn al beschikbare
  velden; een aparte projectiefunctie kan wachten tot GR4's echte signatuur
  bekend is — vermoedelijk heeft die geen aparte projectie nodig en kan hij
  `Match` rechtstreeks (of een deel ervan) binnenkrijgen.

## Stappen

1. `server/data/types/player.js` (DM3-bestand, kleine additieve wijziging):
   voeg `toStandingPlayerView(player)` toe naast `assertPlayerShape`.
2. Test: `toStandingPlayerView(player)` levert exact de vier genoemde velden en
   niets meer (test bevestigt dat `sessionId`/`displayName`/`nameSource`/
   `teamId`/etc. niet in de output lekken — allowlist-stijl, net als
   `toActiveRoundSnapshot` in DM3);
   aanvullend: een end-to-end-test die `toStandingPlayerView`'s output
   rechtstreeks door `rankPlayers()` heen haalt (echte import uit
   `server/rules/standings.js`, geen mock) en een zinnig gesorteerd resultaat
   teruggeeft — dit is de daadwerkelijke reconciliatie, geen aanname dat de
   vormen matchen.
3. Werk [`HANDOFF.md`](../HANDOFF.md) bij met een korte regel: "§1–§3
   beantwoord; `toStandingPlayerView()` is gebouwd en end-to-end getest tegen
   `rankPlayers()`. `toEligibilityPlayerView`/`toTeamPlayerView` volgen zodra
   GR5/GR6 bestaan — geen actie gevraagd tot dan."

## Harde grenzen

- Geen projecties voor niet-bestaande consumers (zie hierboven).
- Geen wijziging aan `server/rules/standings.js` zelf — alleen aan de
  `server/data/`-kant.
- 1 bestand gewijzigd (`player.js`) + 1 testbestand + 1 `HANDOFF.md`-regel.

## Definition of done

- `toStandingPlayerView()` bestaat, is allowlist-getest, en is end-to-end getest
  tegen de echte `rankPlayers()`.
- Geen nieuwe projectie voor GR5/GR6/GR4 totdat die fases zelf bestaan.
- `node --test 'server/data/**/*.test.js'` slaagt.

**Status: uitgevoerd.** `toStandingPlayerView()` staat in `server/data/types/player.js`,
3 nieuwe tests in `player.test.js` (34/34 totaal), inclusief de end-to-end-test
tegen de echte `rankPlayers()` uit `server/rules/standings.js`.
`docs/data-model-plan/HANDOFF.md` is bijgewerkt met de voorgeschreven regel.
